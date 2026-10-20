import { expect, mock, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

import type { CacheState, KeepWarm } from '../types'

import { cacheStatus, contextOf, moveToNewSession, NO_CACHE, pingVerdict, readTouches, shouldHold, span, withCompact, withPing, withRecovered, withRequest, withResume, withSeed, withSwitch, withTouch } from '../hooks/cache'
import type { CacheStatus, CacheUsage, Submission } from '../hooks/cache'
import type { Host } from '../hooks/host'

type On = Parameters<TestBody>[1]

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const MESSAGE = 'Now add the export button.'
const CONTEXT = 200_000
const PLAN_LIMITS = [{ kind: 'five_hour', percentUsed: 10 }]

/** A request over a 200k context that read it from the cache. */
const WARM: CacheUsage = { input_tokens: 1_000, cache_read_input_tokens: 190_000, cache_creation_input_tokens: 9_000 }
/** A request over a 200k context that wrote it to the cache again. */
const RECACHE: CacheUsage = { input_tokens: 1_000, cache_read_input_tokens: 9_000, cache_creation_input_tokens: 190_000 }

const BAND = {
  plugin: 'session-info',
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 20, bodyColumns: 100, scroll: { offset: 0, bodyRows: 20 }, view: {} },
} as const

const PANE = {
  plugin: 'session-info',
  component: 'Pane',
  requestId: 'session-info',
  props: { title: 'Session info', isFocused: true, bodyColumns: 100, placement: 'dock', scroll: { offset: 0, bodyRows: 200 }, view: {} },
} as const

/** A cache whose last request ended at `touchedAt`, on the 1-hour TTL the plan gave. */
const touched = (touchedAt: number, extra: Partial<CacheState> = {}): CacheState => ({ ...NO_CACHE, touchedAt, tokens: CONTEXT, ...extra })

const request = (usage: CacheUsage, startedAt: number, hasPlanLimits = true) => ({ usage, startedAt, endedAt: startedAt + 1_000, hasPlanLimits })

test('plan limits give 1h; no limits give 5m from the second request, since the first can come before the limits', () => {
  const first = withRequest(NO_CACHE, request(WARM, 0, false))

  expect(withRequest(touched(0, { ttl: '5m' }), request(WARM, 0, true))).toMatchObject({ ttl: '1h', ttlSource: 'plan', touchedAt: 1_000, tokens: CONTEXT })
  expect(first).toMatchObject({ ttl: '1h', ttlSource: 'plan' })
  expect(withRequest(first, request(WARM, MINUTE, false))).toMatchObject({ ttl: '5m', ttlSource: 'plan' })
})

test('a re-cache after an idle gap between the TTLs measures 5m; one after an hour only counts the restart', () => {
  expect(withRequest(touched(0), request(RECACHE, 10 * MINUTE))).toMatchObject({ ttl: '5m', ttlSource: 'measured', restarts: 1, restartTokens: 190_000 })
  expect(withRequest(touched(0), request(RECACHE, 2 * HOUR))).toMatchObject({ ttl: '1h', ttlSource: 'plan', restarts: 1 })
})

test('a warm read after 20 idle minutes measures 1h', () => {
  const measured = withRequest(touched(0, { ttl: '5m', ttlSource: 'measured' }), request(WARM, 20 * MINUTE))

  expect(measured).toMatchObject({ ttl: '1h', ttlSource: 'measured', restarts: 0 })
})

test('the first request after a compaction writes the shorter context and is no restart', () => {
  const after = withRequest(withCompact(touched(0)), request(RECACHE, 10 * MINUTE))

  expect(after).toMatchObject({ restarts: 0, ttl: '1h', isAfterCompact: false })
})

test('a switch to a new model forgets the cache, the same model restored on a resume keeps it, and both keep the TTL named', () => {
  const restored = withSwitch(touched(0), '5m', false)
  const switched = withSwitch(touched(0), '1h', true)
  const later = withRequest(withRequest(switched, request(WARM, 0)), request(RECACHE, 10 * MINUTE))

  expect(restored).toMatchObject({ touchedAt: 0, ttl: '5m', ttlSource: 'switch' })
  expect(switched.touchedAt).toBeUndefined()
  expect(later).toMatchObject({ ttl: '1h', ttlSource: 'switch', restarts: 1 })
})

test('a load dates an unseen cache from the last turn, and a cache whose requests it saw keeps its own touch', () => {
  expect(withSeed(NO_CACHE, 5_000, CONTEXT)).toMatchObject({ touchedAt: 5_000, tokens: CONTEXT })
  expect(withSeed(touched(1_000), 5_000, 9)).toMatchObject({ touchedAt: 1_000, tokens: CONTEXT })
})

const KEEP: KeepWarm = { until: 4 * HOUR, pings: 0 }
const STATUS_CASES: [string, CacheState, KeepWarm | null, '5m' | '1h', number, CacheStatus][] = [
  ['no request yet', NO_CACHE, null, '1h', 0, { kind: 'unknown' }],
  ['1h, 5m and 1ms left', touched(0), null, '1h', 55 * MINUTE - 1, { kind: 'warm', ms: 5 * MINUTE + 1 }],
  ['1h, 5m left', touched(0), null, '1h', 55 * MINUTE, { kind: 'cooling', ms: 5 * MINUTE }],
  ['1h, at expiry', touched(0), null, '1h', HOUR, { kind: 'cold', ms: 0 }],
  ['5m, 1m left', touched(0), null, '5m', 4 * MINUTE, { kind: 'cooling', ms: MINUTE }],
  ['5m, 61s left', touched(0), null, '5m', 4 * MINUTE - 1_000, { kind: 'warm', ms: MINUTE + 1_000 }],
  ['keep warm, 1m left', touched(0), KEEP, '1h', 59 * MINUTE, { kind: 'kept', ms: 4 * HOUR - 59 * MINUTE }],
  ['keep warm, expired', touched(0), KEEP, '1h', 2 * HOUR, { kind: 'cold', ms: HOUR }],
]
for (const [name, state, keep, ttl, at, expected] of STATUS_CASES)
  test(`cache status: ${name}`, () => {
    expect(cacheStatus(state, keep, ttl, at)).toEqual(expected)
  })

test('span reads under a minute, minutes, and hours with minutes', () => {
  expect([span(59_000), span(42 * MINUTE + 59_000), span(HOUR + MINUTE)]).toEqual(['<1m', '42m', '1h 1m'])
})

const typed = (extra: Partial<Submission> = {}): Submission => ({ text: MESSAGE, origin: { kind: 'composer' }, ...extra })
const COLD: CacheStatus = { kind: 'cold', ms: MINUTE }
const HOLD_CASES: [string, Submission, CacheStatus, number, boolean][] = [
  ['a typed prompt over a cold cache at the minimum', typed(), COLD, 150_000, true],
  ['a context one token under the minimum', typed(), COLD, 149_999, false],
  ['a cooling cache', typed(), { kind: 'cooling', ms: MINUTE }, CONTEXT, false],
  ['a prompt typed during a turn', typed({ turnId: 't1' }), COLD, CONTEXT, false],
  ['a prompt from Remote Control', typed({ origin: { kind: 'bridge' } }), COLD, CONTEXT, false],
  ['a slash command', typed({ command: { name: 'compact' } }), COLD, CONTEXT, false],
]
for (const [name, submission, status, context, expected] of HOLD_CASES)
  test(`the guard holds ${name}: ${expected}`, () => {
    expect(shouldHold(submission, { status, tokens: context, minTokens: 150_000 })).toBe(expected)
  })

const PING_CASES: [string, CacheUsage | undefined, string][] = [
  ['no answer', undefined, 'none'],
  ['a write of a tenth of the read', { input_tokens: 10, cache_read_input_tokens: 100_000, cache_creation_input_tokens: 10_000 }, 'hit'],
  ['a write past a tenth of the read', { input_tokens: 10, cache_read_input_tokens: 100_000, cache_creation_input_tokens: 10_001 }, 'miss'],
]
for (const [name, usage, expected] of PING_CASES)
  test(`a keep-warm ping with ${name} is a ${expected}`, () => {
    expect(pingVerdict(usage)).toBe(expected)
  })

/** A host whose /clear switches the session id on the second read, with the prompt box holding `box` afterwards. */
function moveHost(box: string): { host: Host; calls: string[] } {
  const calls: string[] = []
  let reads = 0
  const host = {
    sessionId: async () => (reads++ < 2 ? 's1' : 's2'),
    clear: async () => void calls.push('clear'),
    sleep: async () => undefined,
    readBox: async () => box,
    fill: async (text: string) => void calls.push(`fill:${text}`),
  } as unknown as Host

  return { host, calls }
}

test('a new session gets the held prompt only when its box is empty', async () => {
  const empty = moveHost('')
  const kept = moveHost(MESSAGE)

  await moveToNewSession(empty.host, MESSAGE)
  await moveToNewSession(kept.host, MESSAGE)

  expect(empty.calls).toEqual(['clear', `fill:${MESSAGE}`])
  expect(kept.calls).toEqual(['clear'])
})

type World = { entered: string[]; ran: string[]; filled: string[]; toasts: string[]; forks: number }

/**
 * The engine beneath the mod: a 200k context, plan limits when `hasPlan`, requests that answer `usage`, and keep-warm
 * pings that answer `ping`. /clear switches the session id and empties the prompt box.
 */
function world(on: On, { hasPlan = true, ping = WARM as CacheUsage | null, now = 0, live = CONTEXT } = {}): World & { clock: ReturnType<typeof mock.clock> } {
  const state: World = { entered: [], ran: [], filled: [], toasts: [], forks: 0 }
  let sessionId = 's1'
  let box = MESSAGE
  const clock = mock.clock(on, { now })
  on('session.usage', async () => ({ value: { startedAt: 0, rateLimits: hasPlan ? PLAN_LIMITS : [], context: { window: 1_000_000, tokens: live, percent: 20 } } }) as never)
  on('session.id', async () => ({ value: sessionId }))
  on('session.cwd', async () => ({ value: '/repo' }))
  on('agent.list', async () => ({ value: [] }))
  on('env.get', async () => ({ value: undefined }))
  on('process.run', async () => ({ value: { exitCode: 128, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }) as never)
  on('turn.step', async function* (_, e) {
    return { turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: 'end_turn', usage: { ...WARM, output_tokens: 500, model: 'claude-opus-5-5' } } as never
  })
  on('model.fork', async () => {
    state.forks += 1

    return { value: ping === null ? { isAnswered: false, reason: 'empty-reply', usage: WARM } : { isAnswered: true, text: 'ok', usage: { ...ping, output_tokens: 1 } } } as never
  })
  on('command.run', async (_, e) => {
    state.ran.push(e.command)
    if (e.command === 'clear') (sessionId = 's2'), (box = '')

    return { text: '' }
  })
  on('prompt.read', async () => ({ value: { text: box, cursor: box.length } }) as never)
  on('prompt.fill', async (_, e) => (state.filled.push(e.text), { isFilled: true }) as never)
  on('prompt.submit', async (_, e) => (state.entered.push(e.text), { text: e.text }) as never)
  on('ui.toast', async (_, e) => (state.toasts.push(e.text), { value: undefined }) as never)
  on('ui.invalidate', async () => ({ value: undefined }) as never)
  on('ui.render', async ($, e) => h($.ui.resolve(e).Box, {}) as never)
  on('session.start', async (_, e) => ({ cwd: e.cwd }))
  on('command.register', async (_, e) => ({ value: { command: e.name } }))
  on('turn.complete', async (_, e) => ({ text: e.answer }) as never)

  // The same object the hooks write to, so a count read after the act is the current one.
  return Object.assign(state, { clock })
}

const step = async ($: Parameters<TestBody>[0]): Promise<void> => {
  for await (const _ of $.turn.step({ turnId: 't1', index: 0, messageCount: 1, model: 'claude-opus-5-5' })) void _
}

/** Keep warm's timer starts with the session; the sections whose start needs more of the engine stay off. */
const QUIET = { showTodos: false, showAutopick: false, showJira: false, showCi: false, showChecks: false, showGit: false }

async function start($: Parameters<TestBody>[0]): Promise<void> {
  await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })
}

const submit = ($: Parameters<TestBody>[0], text = MESSAGE) => $.prompt.submit({ text, origin: { kind: 'composer' }, wait: false } as never)

for (const surface of ['terminal', 'desktop'] as const)
  test(`a prompt over an expired cache is held with a band, and Enter sends it (${surface})`, async ($, on) => {
    const { clock, entered } = world(on)
    await step($)
    await clock.set(2 * HOUR)

    const held = await submit($)
    const band = await $.ui.mount({ ...BAND, surface })
    const isBandDrawn = (await band.find({ key: 'cache-compact' })) !== undefined && (await band.find({ key: 'cache-new' })) !== undefined
    await submit($)

    expect(held).toEqual({ drop: expect.stringContaining('expired 1h 0m ago, and this prompt would write 200k tokens') })
    expect(isBandDrawn).toBe(true)
    expect(entered).toEqual([MESSAGE])
    expect(await band.find({ key: 'cache-compact' })).toBeUndefined()
    await band.unmount()
  })

test('with the cache guard off a prompt over an expired cache enters', { options: { cacheGuard: false } }, async ($, on) => {
  const { clock, entered } = world(on)
  await step($)
  await clock.set(2 * HOUR)

  await submit($)

  expect(entered).toEqual([MESSAGE])
})

test('Compact runs /compact and New session runs /clear and puts the prompt in the new box', async ($, on) => {
  const { clock, ran, filled } = world(on)
  await step($)
  await clock.set(2 * HOUR)
  await submit($)
  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })

  await band.press({ key: 'cache-compact' })
  const afterCompact = await band.find({ key: 'cache-new' })
  await submit($, 'Another prompt.')
  await band.press({ key: 'cache-new' })

  expect(afterCompact).toBeUndefined()
  expect(ran).toEqual(['compact', 'clear'])
  expect(filled).toEqual(['Another prompt.'])
  await band.unmount()
})

test('a session resumed two hours after its last response holds the first prompt', async ($, on) => {
  const { entered } = world(on)
  on('classic.SessionStart', async () => ({}))

  await $.classic.SessionStart({ source: 'resume', seconds_since_last_response: 7_200 } as never)
  const held = await submit($)

  expect(held).toEqual({ drop: expect.stringContaining('expired 1h 0m ago') })
  expect(entered).toEqual([])
})

test('a resumed session whose live context reads empty holds the first prompt by the context the resume reported', async ($, on) => {
  const { entered } = world(on, { live: 0 })
  on('classic.SessionStart', async () => ({}))

  await $.classic.SessionStart({ source: 'resume', seconds_since_last_response: 7_200, context_tokens: 300_000 } as never)
  const held = await submit($)

  expect(held).toEqual({ drop: expect.stringContaining('this prompt would write 300k tokens') })
  expect(entered).toEqual([])
})

test('a resumed session with no context reported anywhere lets the first prompt in', async ($, on) => {
  const { entered } = world(on, { live: 0 })
  on('classic.SessionStart', async () => ({}))

  await $.classic.SessionStart({ source: 'resume', seconds_since_last_response: 7_200 } as never)
  await submit($)

  expect(entered).toEqual([MESSAGE])
})

test('the context to write is the live reading when it has one, else the last one the cache knew', () => {
  expect(contextOf(120_000, touched(0))).toBe(120_000)
  expect(contextOf(0, touched(0))).toBe(CONTEXT)
  expect(contextOf(undefined, touched(0))).toBe(CONTEXT)
})

/** The store the mod keeps the last touch of each session in, and a session that has `turns` turns behind it. */
function storeWith(on: On, record: Record<string, unknown>, turns = 5): Record<string, unknown> {
  const store: Record<string, unknown> = { ...record }
  on('store.get', async (_, e) => ({ value: store[e.key] }) as never)
  on('store.set', async (_, e) => ((store[e.key] = e.value), { value: undefined }))
  on('session.turns', async () => ({ value: turns }))

  return store
}

const TOUCHES_KEY = 'cacheTouches'

/** The session starts with turns behind it, and the recovery that runs beside the start gets its moment before a prompt. */
async function startResumed($: Parameters<TestBody>[0], clock: ReturnType<typeof mock.clock>): Promise<void> {
  await start($)
  await clock.advance(1_000)
}

test('a resume with no SessionStart reaching the mod dates the cache from the touch the store kept', { options: QUIET }, async ($, on) => {
  const { entered, clock } = world(on, { now: 10 * HOUR, live: 0 })
  storeWith(on, { [TOUCHES_KEY]: { s1: { at: 0, tokens: 300_000 } } })

  await startResumed($, clock)
  const held = await submit($)

  expect(held).toEqual({ drop: expect.stringContaining('expired 9h 0m ago, and this prompt would write 300k tokens') })
  expect(entered).toEqual([])
})

test('a resume whose store kept a recent touch lets the first prompt in', { options: QUIET }, async ($, on) => {
  const { entered, clock } = world(on, { now: 10 * HOUR })
  storeWith(on, { [TOUCHES_KEY]: { s1: { at: 10 * HOUR - 10 * MINUTE, tokens: CONTEXT } } })

  await startResumed($, clock)
  await submit($)

  expect(entered).toEqual([MESSAGE])
})

for (const surface of ['terminal', 'desktop'] as const)
  test(`a resume with no touch on record holds the first prompt as probably cold (${surface})`, { options: QUIET }, async ($, on) => {
    const { entered, clock } = world(on, { now: 10 * HOUR })
    storeWith(on, {})

    await startResumed($, clock)
    const held = await submit($)
    const band = await $.ui.mount({ ...BAND, surface })
    const pane = await $.ui.mount({ ...PANE, surface, viewport: { columns: 100, rows: 80 } })

    expect(held).toEqual({ drop: expect.stringContaining('The session was resumed, so its prompt cache has probably expired, and this prompt would write 200k tokens') })
    expect(entered).toEqual([])
    expect(await band.find({ type: 'Text', text: ' · the prompt cache has probably expired' })).toBeDefined()
    expect(await band.find({ type: 'Text', text: 'resumed' })).toBeDefined()
    expect(await pane.find({ type: 'Text', text: 'probably cold' })).toBeDefined()
    await band.unmount()
    await pane.unmount()
  })

test('a session with no turns behind it, a new one, has no cache to recover', { options: QUIET }, async ($, on) => {
  const { entered, clock } = world(on, { now: 10 * HOUR })
  storeWith(on, {}, 0)

  await startResumed($, clock)
  await submit($)

  expect(entered).toEqual([MESSAGE])
})

test('a request writes the session\'s touch to the store, and a ping renews it', { options: QUIET }, async ($, on) => {
  const warm = world(on, { hasPlan: false })
  const store = storeWith(on, {}, 0)
  await start($)
  await step($)
  const first = readTouchesOf(store)
  const pane = await $.ui.mount({ ...PANE, surface: 'terminal', viewport: { columns: 100, rows: 80 } })
  await step($)
  await pane.press({ key: 'keep-warm' })
  await warm.clock.advance(4 * MINUTE + 30_000)
  const renewed = readTouchesOf(store)

  expect(first).toEqual({ s1: { at: 0, tokens: CONTEXT } })
  expect(renewed.s1?.at).toBeGreaterThan(0)
  await pane.unmount()
})

const readTouchesOf = (store: Record<string, unknown>): Record<string, { at: number; tokens: number } | undefined> => readTouches(store[TOUCHES_KEY])

test('the store keeps the most recent touches and drops entries of another shape', () => {
  const crowded = Object.fromEntries(Array.from({ length: 30 }, (_, index) => [`s${index}`, { at: index, tokens: 1 }]))
  const kept = withTouch(readTouches({ ...crowded, broken: { at: 'now' }, list: [1] }), 'fresh', { at: 99, tokens: 2 })

  expect(Object.keys(kept)).toHaveLength(24)
  expect(kept.fresh).toEqual({ at: 99, tokens: 2 })
  expect(kept.s0).toBeUndefined()
  expect(readTouches('nope')).toEqual({})
  expect(readTouches([{ at: 1, tokens: 1 }])).toEqual({})
})

test('a recovered cache keeps a dated one, takes a found touch, and guesses past every TTL without one', () => {
  const dated = touched(5 * MINUTE)

  expect(withRecovered(dated, { at: 0, tokens: 1 }, HOUR, 1)).toBe(dated)
  expect(withRecovered(NO_CACHE, { at: 7, tokens: 300_000 }, HOUR, 1)).toMatchObject({ touchedAt: 7, tokens: 300_000, isAgeUnknown: false })
  expect(cacheStatus(withRecovered(NO_CACHE, undefined, HOUR, CONTEXT), null, '1h', HOUR)).toMatchObject({ kind: 'cold' })
  expect(withRecovered(NO_CACHE, undefined, HOUR, CONTEXT)).toMatchObject({ tokens: CONTEXT, isAgeUnknown: true })
})

test('a request, a resume report and a ping make the age known again', () => {
  const guessed = withRecovered(NO_CACHE, undefined, HOUR, CONTEXT)

  expect(withRequest(guessed, request(WARM, 2 * HOUR))).toMatchObject({ isAgeUnknown: false })
  expect(withResume(guessed, { secondsSince: 60 }, HOUR)).toMatchObject({ isAgeUnknown: false })
  expect(withPing(guessed, HOUR)).toMatchObject({ isAgeUnknown: false })
})

test('keep warm pings the cache while it cools', { options: QUIET }, async ($, on) => {
  const warm = world(on, { hasPlan: false })
  await start($)
  await step($)
  await step($)
  const pane = await $.ui.mount({ ...PANE, surface: 'terminal', viewport: { columns: 100, rows: 80 } })
  await pane.press({ key: 'keep-warm' })

  await warm.clock.advance(4 * MINUTE + 30_000)

  expect(warm.forks).toBe(1)
  expect(await pane.find({ type: 'Text', text: / kept warm · 3h 5\dm left$/ })).toBeDefined()
  expect(await pane.find({ type: 'Text', text: '1 ping' })).toBeDefined()
  await pane.unmount()
})

test('a keep-warm ping that writes the cache stops keep warm', { options: QUIET }, async ($, on) => {
  const missed = world(on, { hasPlan: false, ping: RECACHE })
  await start($)
  await step($)
  await step($)
  const pane = await $.ui.mount({ ...PANE, surface: 'terminal', viewport: { columns: 100, rows: 80 } })
  await pane.press({ key: 'keep-warm' })

  await missed.clock.advance(4 * MINUTE + 30_000)

  expect(missed.toasts).toContain('session-info: keep warm stopped: the ping wrote the cache instead of reading it.')
  expect(await pane.find({ type: 'Text', text: /^ cools in / })).toBeDefined()
  await pane.unmount()
})

test('a load after a finished turn shows the cache warm from that turn, before any new request', { options: QUIET }, async ($, on) => {
  // The turn's end is read from the real clock; the engine's clock starts a minute after it.
  const { clock } = world(on, { now: Date.now() + MINUTE })
  await $.turn.complete({ answer: 'done', durationMs: 1_000, isAborted: false, turnId: 't1', reason: 'answer' } as never)

  await start($)
  await clock.settle()
  const pane = await $.ui.mount({ ...PANE, surface: 'terminal', viewport: { columns: 100, rows: 80 } })

  expect(await pane.find({ type: 'Text', text: /^ warm · 5\dm left$/ })).toBeDefined()
  await pane.unmount()
})
