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

type World = { judged: string[]; ran: string[]; entered: string[]; filled: string[]; toasts: string[]; logged: string[]; logFiles: string[] }

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
  const state: World = { judged: [], ran: [], entered: [], filled: [], toasts: [], logged: [], logFiles: [] }
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
