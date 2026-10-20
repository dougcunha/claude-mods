import { expect, mock, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

type On = Parameters<TestBody>[1]

const BAND = {
  plugin: 'topic-guard',
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 20, bodyColumns: 100, scroll: { offset: 0, bodyRows: 20 }, view: {} },
} as const

const NEW_TOPIC = '{"decision": "new-topic", "reason": "The docs theme is another feature."}'
const RELATED = '{"decision": "related", "reason": "Same task."}'
const MESSAGE = 'Add a dark theme to the docs site.'
const USAGE = { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }

type World = { judged: string[]; ran: string[]; entered: string[]; filled: string[]; toasts: string[]; statuses: (string | undefined)[]; logged: string[]; logFiles: string[] }

/**
 * The engine beneath the mod: a session at 62% context with one exchange, whose judging model answers `replies` in
 * turn (the last one repeats; null is no answer). /clear gives the session a new id and empties the prompt box when
 * `isBoxCleared`, or fails with `isClearFailing`.
 */
function world(
  on: On,
  replies: readonly (string | null)[] = [NEW_TOPIC],
  { isClearFailing = false, isBoxCleared = false } = {},
): World & { clock: ReturnType<typeof mock.clock> } {
  const state: World = { judged: [], ran: [], entered: [], filled: [], toasts: [], statuses: [], logged: [], logFiles: [] }
  let sessionId = 's-1'
  let box = MESSAGE
  const clock = mock.clock(on)
  mock.env(on, { TEMP: '/tmp' })
  on('session.usage', async () => ({ value: { startedAt: 0, rateLimits: [], context: { window: 200_000, percent: 62 } } }) as never)
  on('session.id', async () => ({ value: sessionId }))
  on('session.messages', async () => ({ value: [{ role: 'user', content: 'Commit T03.' }, { role: 'assistant', content: 'T03 is committed.' }] }) as never)
  on('model.complete', async (_, e) => {
    const reply = replies[Math.min(state.judged.length, replies.length - 1)] ?? null
    state.judged.push(e.model)

    return { value: reply === null ? { isAnswered: false, reason: 'empty-reply' } : { isAnswered: true, text: reply, usage: USAGE } } as never
  })
  on('fs.write', async (_, e) => ((/debug\.log$/.test(e.path) ? (state.logged.push(e.text), state.logFiles.push(e.path)) : undefined), { value: undefined }) as never)
  on('fs.read', async () => { throw new Error('missing') })
  on('ui.invalidate', async () => ({ value: undefined }) as never)
  on('command.run', async (_, e) => {
    state.ran.push(e.command)
    if (e.command === 'clear' && isClearFailing) throw new Error('clear failed')
    if (e.command === 'clear') sessionId = 's-2'
    if (e.command === 'clear' && isBoxCleared) box = ''

    return { text: '' }
  })
  on('prompt.read', async () => ({ value: { text: box, cursor: box.length } }) as never)
  on('prompt.fill', async (_, e) => (state.filled.push(e.text), { isFilled: true }) as never)
  on('prompt.submit', async (_, e) => (state.entered.push(e.text), { text: e.text }) as never)
  on('ui.render', async ($, e) => h($.ui.resolve(e).Box, {}) as never)
  on('ui.toast', async (_, e) => (state.toasts.push(e.text), { value: undefined }) as never)
  on('ui.status', async (_, e) => (state.statuses.push(e.text), { value: undefined }) as never)
  on('session.start', async (_, e) => ({ cwd: e.cwd }))

  return { ...state, clock }
}

const typed = (text = MESSAGE): never => ({ text, origin: { kind: 'composer' }, wait: false }) as never

for (const surface of ['terminal', 'desktop'] as const) {
  test(`a prompt the model judges a new topic is held, and the band shows why (${surface})`, async ($, on) => {
    const { entered } = world(on)

    const result = await $.prompt.submit(typed())

    const band = await $.ui.mount({ ...BAND, surface })
    expect(result).toEqual({ drop: expect.stringContaining('Press Enter to keep it here') })
    expect(entered).toEqual([])
    expect(await band.find({ type: 'Text', text: /The docs theme is another feature\./ })).toBeDefined()
    expect(await band.find({ key: 'new' })).toBeDefined()
    await band.unmount()
  })
}

test('a related prompt enters as typed and shows no band', async ($, on) => {
  const { entered, judged } = world(on, [RELATED])

  await $.prompt.submit(typed())

  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(judged).toEqual(['haiku'])
  expect(entered).toEqual([MESSAGE])
  expect(await band.find({ key: 'new' })).toBeUndefined()
  await band.unmount()
})

test('a judging model with no answer lets the prompt enter', async ($, on) => {
  const { entered } = world(on, [null])

  await $.prompt.submit(typed())

  expect(entered).toEqual([MESSAGE])
})

test('sending the held message again keeps it here, and the next prompts are not judged until the context grows', async ($, on) => {
  const { entered, judged } = world(on)
  await $.prompt.submit(typed())

  await $.prompt.submit(typed(` ${MESSAGE}\n`))
  await $.prompt.submit(typed('Now the footer.'))

  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(entered).toEqual([` ${MESSAGE}\n`, 'Now the footer.'])
  expect(judged).toHaveLength(1)
  expect(await band.find({ key: 'new' })).toBeUndefined()
  await band.unmount()
})

test('another message the person types replaces the held one and is judged', async ($, on) => {
  const { entered, judged } = world(on, [NEW_TOPIC, RELATED])
  await $.prompt.submit(typed())

  await $.prompt.submit(typed('Commit it.'))

  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(judged).toHaveLength(2)
  expect(entered).toEqual(['Commit it.'])
  expect(await band.find({ key: 'new' })).toBeUndefined()
  await band.unmount()
})

for (const [name, isBoxCleared, filled] of [
  ['leaves the message the box kept', false, []],
  ['puts the message back in a box the clear emptied', true, [MESSAGE]],
] as const) {
  test(`New session clears the session, sends nothing and ${name}`, async ($, on) => {
    const { clock, ran, entered, filled: fills } = world(on, [NEW_TOPIC], { isBoxCleared })
    await $.prompt.submit(typed())
    const band = await $.ui.mount({ ...BAND, surface: 'terminal' })

    await band.press({ key: 'new' })
    await clock.settle()

    expect(ran).toEqual(['clear'])
    expect(entered).toEqual([])
    expect(fills).toEqual(filled)
    await band.unmount()
  })
}

test('a failed clear keeps the session and the band, and says the message is still in the box', async ($, on) => {
  const { clock, toasts } = world(on, [NEW_TOPIC], { isClearFailing: true })
  await $.prompt.submit(typed())
  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })

  await band.press({ key: 'new' })
  await clock.settle()

  expect(toasts).toEqual([expect.stringContaining('The message is still in the prompt box')])
  expect(await band.find({ key: 'new' })).toBeDefined()
  await band.unmount()
})

test('analyze false judges no prompt and holds none', { options: { analyze: false } }, async ($, on) => {
  const { entered, judged } = world(on)

  await $.prompt.submit(typed())

  expect(judged).toEqual([])
  expect(entered).toEqual([MESSAGE])
})

test('debug true logs the judgment as metadata in the session folder, without prompt or reply text', { options: { debug: true } }, async ($, on) => {
  const { logged, logFiles } = world(on)

  await $.prompt.submit(typed())

  expect(logged.at(-1)).toMatch(/ s-1 judge: new topic at 62%\n$/)
  expect(logged.join('')).not.toContain('dark theme')
  expect(logged.join('')).not.toContain('another feature')
  expect(logFiles[0]).toMatch(/claude-topic-guard[\\/]s-1[\\/]debug\.log$/)
})

test('debug false, the default, writes no log', async ($, on) => {
  const { logged } = world(on)

  await $.prompt.submit(typed())

  expect(logged).toEqual([])
})

const jevResult = (classification: string, newTopic: number) => ({
  isError: false,
  content: [{ type: 'text', text: JSON.stringify({ results: [{ classification, probabilities: { related: 1 - newTopic, 'new-topic': newTopic }, decision: 'auto' }] }) }],
})
const JEV_NEW_TOPIC = jevResult('new-topic', 0.96)
const JEV_RELATED = jevResult('related', 0.01)
const JEV_OPTIONS = { options: { judge: 'jev' } }
const JEV_DOWN_TOAST = 'topic-guard: the Jev MCP failed or did not answer in time. Judging with haiku instead.'

/** The Jev MCP beside `world`: the `tools` it lists, and the `answers` it gives in turn (the last repeats; 'down' fails, 'hang' never answers). */
function jevServer(on: On, answers: readonly unknown[], tools: readonly string[] = ['mcp__jev__jev_classify']): { calls: { server: string; tool: string }[] } {
  const calls: { server: string; tool: string }[] = []
  on('tool.list', async () => ({ value: tools.map(name => ({ name, description: '', mcp: true })) }))
  on('mcp.call', async (_, e) => {
    const answer = answers[Math.min(calls.length, answers.length - 1)]
    calls.push({ server: e.server, tool: e.tool })
    if (answer === 'down') throw new Error('connection closed')
    if (answer === 'hang') return await new Promise<never>(() => undefined)

    return { value: answer } as never
  })

  return { calls }
}

test('with the Jev judge, a new topic is held on Jev alone, with its probability as the reason', JEV_OPTIONS, async ($, on) => {
  const { judged } = world(on)
  const { calls } = jevServer(on, [JEV_NEW_TOPIC])

  const result = await $.prompt.submit(typed())

  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(result).toEqual({ drop: expect.stringContaining('Press Enter to keep it here') })
  expect(calls).toEqual([{ server: 'jev', tool: 'jev_classify' }])
  expect(judged).toEqual([])
  expect(await band.find({ type: 'Text', text: /Jev is 96% sure/ })).toBeDefined()
  await band.unmount()
})

test('a Jev MCP that fails hands the judgment to the model and warns once per outage', JEV_OPTIONS, async ($, on) => {
  const { entered, judged, toasts } = world(on, [RELATED])
  jevServer(on, ['down', 'down', JEV_RELATED, 'down'])

  await $.prompt.submit(typed('One.'))
  await $.prompt.submit(typed('Two.'))
  expect(toasts).toEqual([JEV_DOWN_TOAST])
  await $.prompt.submit(typed('Three.'))
  await $.prompt.submit(typed('Four.'))

  expect(entered).toEqual(['One.', 'Two.', 'Three.', 'Four.'])
  expect(judged).toEqual(['haiku', 'haiku', 'haiku'])
  expect(toasts).toEqual([JEV_DOWN_TOAST, JEV_DOWN_TOAST])
})

test('a missing Jev MCP is named in the toast, and the model holds a new topic', JEV_OPTIONS, async ($, on) => {
  const { judged, toasts } = world(on, [NEW_TOPIC])
  const { calls } = jevServer(on, [JEV_NEW_TOPIC], [])

  const result = await $.prompt.submit(typed())

  expect(result).toEqual({ drop: expect.stringContaining('Press Enter to keep it here') })
  expect(calls).toEqual([])
  expect(judged).toEqual(['haiku'])
  expect(toasts).toEqual(['topic-guard: the Jev MCP is not connected. Judging with haiku instead.'])
})

test('a Jev MCP that does not answer in 4 seconds hands the judgment to the model', JEV_OPTIONS, async ($, on) => {
  const { clock, entered, toasts } = world(on, [RELATED])
  jevServer(on, ['hang'])

  const submitted = $.prompt.submit(typed())
  await clock.advance(4_000)
  await submitted

  expect(entered).toEqual([MESSAGE])
  expect(toasts).toEqual([JEV_DOWN_TOAST])
})

test('the default judge asks the model and never calls the MCP tools', async ($, on) => {
  const { judged } = world(on, [RELATED])
  const { calls } = jevServer(on, [JEV_NEW_TOPIC])

  await $.prompt.submit(typed())

  expect(judged).toEqual(['haiku'])
  expect(calls).toEqual([])
})

const START = { cwd: '/repo', surface: 'terminal', isInteractive: true } as const

test('the status line names who judges when the session starts, before any judgment', async ($, on) => {
  const { statuses } = world(on)

  await $.session.start(START)

  expect(statuses.at(-1)).toBe('haiku')
})

test('the status line follows the last thing the mod did: a held topic, a kept message, a related prompt', async ($, on) => {
  const { statuses } = world(on, [NEW_TOPIC, RELATED])

  await $.prompt.submit(typed())
  expect(statuses.at(-1)).toBe('haiku · held a new topic at 62%')
  await $.prompt.submit(typed())
  expect(statuses.at(-1)).toBe('haiku · kept here at 62%')
  await $.prompt.submit(typed('Now the footer.'))
  expect(statuses.at(-1)).toBe('haiku · skipped at 62%, judging from 72%')
})

test('the status line says a prompt was skipped below the minimum context', { options: { minContextPercent: 70 } }, async ($, on) => {
  const { statuses } = world(on)

  await $.prompt.submit(typed())

  expect(statuses.at(-1)).toBe('haiku · skipped at 62%, judging from 70%')
})

test('with the Jev judge, the status line shows Jev, then that it is down while the model judges, then Jev again', JEV_OPTIONS, async ($, on) => {
  const { statuses } = world(on, [RELATED])
  jevServer(on, [JEV_RELATED, 'down', JEV_RELATED])

  await $.prompt.submit(typed('One.'))
  expect(statuses.at(-1)).toBe('Jev · related at 62%')
  await $.prompt.submit(typed('Two.'))
  expect(statuses.at(-1)).toBe('Jev down, haiku judging · related at 62%')
  await $.prompt.submit(typed('Three.'))
  expect(statuses.at(-1)).toBe('Jev · related at 62%')
})

test('analyze false shows the mod as off', { options: { analyze: false } }, async ($, on) => {
  const { statuses } = world(on)

  await $.session.start(START)

  expect(statuses.at(-1)).toBe('off')
})

test('showStatus false pins no line and clears an old one', { options: { showStatus: false } }, async ($, on) => {
  const { statuses } = world(on)

  await $.session.start(START)
  await $.prompt.submit(typed())

  expect(statuses.filter(text => text !== undefined)).toEqual([])
  expect(statuses.length).toBeGreaterThan(0)
})
