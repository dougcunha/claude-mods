import { expect, mock, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

import { countdown, hasRival, minutesOf, pickDetail, picksDetail, picksOf, settingsOf, statusText, stepMinutes, STORE_MINUTES, STORE_ON } from '../hooks/autopick'

const PANE = {
  plugin: 'session-info',
  component: 'Pane',
  requestId: 'session-info',
  props: { title: 'Session info', isFocused: true, bodyColumns: 100, placement: 'dock', scroll: { offset: 0, bodyRows: 200 }, view: {} },
} as const

const MINUTE = 60_000

const QUESTIONS = [
  { question: 'Color?', header: 'Color', multiSelect: false, options: [{ label: 'Blue (Recommended)', description: '' }, { label: 'Red', description: '' }] },
]

const ASK = { tool: 'AskUserQuestion', tool_use_id: 'ask1', questions: QUESTIONS } as never

type On = Parameters<TestBody>[1]

/** A countdown redraws the pane each second of the mocked clock, and each tick takes real time. */
const SLOW = { timeoutMs: 20_000 }

/** The engine beneath: the pane's reads, the command list, and a dialog the person answers `Red` after `answerAfter`. */
function world(on: On, store: Record<string, unknown>, answerAfter = 60 * MINUTE, commands: { name: string; plugin?: string }[] = []) {
  const clock = mock.clock(on)
  on('store.get', async (_, e) => ({ value: store[e.key] }) as never)
  on('store.set', async (_, e) => ((store[e.key] = e.value), { value: undefined }))
  on('ui.toast', async () => ({ value: undefined }))
  on('ui.log', async () => ({ value: undefined }))
  on('session.cwd', async () => ({ value: '/repo' }))
  on('agent.list', async () => ({ value: [] }))
  on('session.usage', async () => ({ value: { startedAt: 0, rateLimits: [], context: { window: 200_000 } } }) as never)
  on('command.list', async () => ({ value: commands.map(c => ({ description: '', source: 'plugin', ...c })) }) as never)
  on('tool.call', { tool: 'AskUserQuestion' }, async () => {
    await clock.sleep(answerAfter)

    return { result: { questions: QUESTIONS, answers: { 'Color?': 'Red' } } } as never
  })

  return clock
}

const answersOf = (done: unknown) => (done as { result?: { answers?: unknown } }).result?.answers

test('the pick takes the first option when only it carries the recommended mark', async () => {
  const q = (labels: string[], multiSelect = false) => ({ question: 'Q?', multiSelect, options: labels.map(label => ({ label })) })
  expect(picksOf([q(['Blue (Recommended)', 'Red'])])).toEqual({ 'Q?': 'Blue (Recommended)' })
  expect(picksOf([q(['Azul (Recomendado)', 'Vermelho'])])).toEqual({ 'Q?': 'Azul (Recomendado)' })
  expect(picksOf([q(['Mavi（Önerilen）', 'Kırmızı'])])).toEqual({ 'Q?': 'Mavi（Önerilen）' })
  expect(picksOf([q(['Blue', 'Red (Recommended)'])])).toBeUndefined()
  expect(picksOf([q(['Blue (Recommended)', 'Red (Recommended)'])])).toBeUndefined()
  expect(picksOf([q(['Blue (Recommended)', 'Red'], true)])).toBeUndefined()
  expect(picksOf([q(['Blue (Recommended)', 'Red']), q(['A', 'B'])])).toBeUndefined()
  expect(picksOf([])).toBeUndefined()
})

test('the picks read one per line, and a pick says why it happened', async () => {
  const picks = { 'Color?': 'Blue (Recommended)', 'Size?': 'L' }
  expect(picksDetail(picks)).toBe('Color? → Blue (Recommended)\nSize? → L')
  expect(pickDetail({ picks, at: 0, minutes: 5, isByHand: false })).toBe('No answer in 5 min\nColor? → Blue (Recommended)\nSize? → L')
  expect(pickDetail({ picks, at: 0, minutes: 5, isByHand: true }).startsWith('Pick now pressed\n')).toBe(true)
})

test('the settings, the minute steps, the countdown and the rival check', async () => {
  expect(settingsOf(undefined, undefined)).toEqual({ isOn: false, minutes: 10 })
  expect(settingsOf(true, 25)).toEqual({ isOn: true, minutes: 25 })
  expect(settingsOf('yes', 500)).toEqual({ isOn: false, minutes: 10 })
  expect(minutesOf('7')).toBe(7)
  expect(minutesOf('0')).toBeUndefined()
  expect(minutesOf('121')).toBeUndefined()
  expect(minutesOf('5m')).toBeUndefined()
  expect(stepMinutes(10, 1)).toBe(15)
  expect(stepMinutes(10, -1)).toBe(5)
  expect(stepMinutes(7, 1)).toBe(10)
  expect(stepMinutes(7, -1)).toBe(5)
  expect(stepMinutes(120, 1)).toBe(120)
  expect(stepMinutes(1, -1)).toBe(1)
  expect(countdown(5 * MINUTE)).toBe('5:00')
  expect(countdown(65_400)).toBe('1:06')
  expect(countdown(-1)).toBe('0:00')
  expect(hasRival([{ name: 'session-info' }])).toBe(false)
  expect(hasRival([{ name: 'ask-autopick', plugin: 'ask-autopick' }])).toBe(true)
  expect(statusText({ isOn: true, minutes: 10 }, true)).toMatch(/^off · the ask-autopick mod is loaded/)
})

test('while the switch is off the question waits for the person', async ($, on) => {
  const clock = world(on, {}, 30 * MINUTE)
  const call = $.tool.call(ASK)
  await clock.advance(30 * MINUTE)
  expect(answersOf(await call)).toEqual({ 'Color?': 'Red' })
})

test('a question left unanswered past the wait gets its recommended option', SLOW, async ($, on) => {
  const clock = world(on, { [STORE_ON]: true, [STORE_MINUTES]: 1 })
  const call = $.tool.call(ASK)
  await clock.settle()

  // A mounted pane redraws on each second's tick, so it is mounted only to look.
  const look = async (query: Parameters<Awaited<ReturnType<typeof $.ui.mount>>['find']>[0]) => {
    const ui = await $.ui.mount({ ...PANE, surface: 'terminal', viewport: { columns: 100, rows: 80 } })
    const found = await ui.find(query)
    await ui.unmount()

    return found
  }
  expect(await look({ type: 'Text', text: /^◷ 1:00$/ })).toBeDefined()
  expect(await look({ type: 'Text', text: 'Color? → Blue (Recommended)' })).toBeDefined()
  await clock.advance(25_000)
  expect(await look({ type: 'Text', text: /^◷ 0:35$/ })).toBeDefined()

  await clock.advance(35_000)
  expect(answersOf(await call)).toEqual({ 'Color?': 'Blue (Recommended)' })
  expect(await look({ type: 'Text', text: /^◷/ })).toBeUndefined()
  expect(await look({ type: 'Text', text: /^✓ Picked 0s ago: Color\? → Blue/ })).toBeDefined()

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal', viewport: { columns: 100, rows: 80 } })
  await ui.press({ key: 'detail:autopick:last' })
  expect(await ui.find({ type: 'Text', text: 'Picked 0s ago' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'No answer in 1 min\nColor? → Blue (Recommended)' })).toBeDefined()
  await ui.press({ key: 'detail-back' })
  expect(await ui.find({ type: 'Button', key: 'detail:autopick:last' })).toBeDefined()
  await ui.unmount()

  const narrow = await $.ui.mount({ ...PANE, props: { ...PANE.props, bodyColumns: 40 }, surface: 'terminal', viewport: { columns: 40, rows: 80 } })
  expect(await narrow.find({ type: 'Text', text: /^✓ Picked 0s ago: .*…$/ })).toBeDefined()
  await narrow.unmount()
})

test('an answer within the wait goes through and nothing is picked', SLOW, async ($, on) => {
  const clock = world(on, { [STORE_ON]: true, [STORE_MINUTES]: 1 }, 30_000)
  const call = $.tool.call(ASK)
  await clock.advance(30_000)
  expect(answersOf(await call)).toEqual({ 'Color?': 'Red' })
  await clock.advance(MINUTE)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /^✓ Picked/ })).toBeUndefined()
  await ui.unmount()
})

for (const surface of ['terminal', 'desktop'] as const) {
  test(`Pick now answers at once and Cancel leaves the question to the person (${surface})`, SLOW, async ($, on) => {
    const clock = world(on, { [STORE_ON]: true, [STORE_MINUTES]: 10 }, 20 * MINUTE)

    const picked = $.tool.call(ASK)
    await clock.settle()
    const ui = await $.ui.mount({ ...PANE, surface })
    await ui.press({ key: 'autopick-pick:ask1' })
    expect(answersOf(await picked)).toEqual({ 'Color?': 'Blue (Recommended)' })

    const held = $.tool.call(ASK)
    await clock.settle()
    await ui.press({ key: 'autopick-cancel:ask1' })
    expect(await ui.find({ type: 'Text', text: /^◌$/ })).toBeDefined()
    await clock.advance(20 * MINUTE)
    expect(answersOf(await held)).toEqual({ 'Color?': 'Red' })
    await ui.unmount()
  })
}

test('the layout does not change while a countdown runs', SLOW, async ($, on) => {
  const clock = world(on, { [STORE_ON]: true, [STORE_MINUTES]: 1 }, 5 * MINUTE)
  const sets: unknown[] = []
  on('config.set', async (_, e) => (sets.push(e.key), { value: e.value }))
  const call = $.tool.call(ASK)
  await clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'layout' })
  await ui.press({ key: 'hide:#skills' })
  expect(sets).toEqual([])
  await ui.unmount()

  await clock.advance(MINUTE)
  expect(answersOf(await call)).toEqual({ 'Color?': 'Blue (Recommended)' })
  const after = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await after.press({ key: 'hide:#skills' })
  expect(sets).toEqual(['session-info.showSkills'])
  await after.unmount()
})

test('a question with no recommended option shows that it waits', async ($, on) => {
  const clock = world(on, { [STORE_ON]: true, [STORE_MINUTES]: 1 }, 5 * MINUTE)
  const plain = [{ ...QUESTIONS[0], options: [{ label: 'Blue', description: '' }, { label: 'Red', description: '' }] }]
  const call = $.tool.call({ tool: 'AskUserQuestion', tool_use_id: 'ask2', questions: plain } as never)
  await clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /^No recommended option/ })).toBeDefined()
  await clock.advance(5 * MINUTE)
  expect(answersOf(await call)).toEqual({ 'Color?': 'Red' })
  await ui.unmount()
})

test('the switch and the minute buttons write the store, and switching off stops a countdown', async ($, on) => {
  const store: Record<string, unknown> = {}
  const clock = world(on, store, 20 * MINUTE)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: 'off' })).toBeDefined()

  await ui.press({ key: 'autopick-switch' })
  await ui.press({ key: 'autopick-more' })
  expect(store[STORE_ON]).toBe(true)
  expect(store[STORE_MINUTES]).toBe(15)
  expect(await ui.find({ type: 'Text', text: 'on · 15 min' })).toBeDefined()

  const call = $.tool.call(ASK)
  await clock.settle()
  await ui.press({ key: 'autopick-switch' })
  expect(store[STORE_ON]).toBe(false)
  await clock.advance(20 * MINUTE)
  expect(answersOf(await call)).toEqual({ 'Color?': 'Red' })
  await ui.unmount()
})

test('while ask-autopick is loaded the switch stays off and the question waits', async ($, on) => {
  const store: Record<string, unknown> = { [STORE_ON]: true, [STORE_MINUTES]: 1 }
  const clock = world(on, store, 5 * MINUTE, [{ name: 'ask-autopick', plugin: 'ask-autopick' }])
  const call = $.tool.call(ASK)
  await clock.advance(5 * MINUTE)
  expect(answersOf(await call)).toEqual({ 'Color?': 'Red' })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /^⚠ The ask-autopick mod is loaded/ })).toBeDefined()
  await ui.press({ key: 'autopick-switch' })
  await ui.press({ key: 'autopick-switch' })
  // The first press turned it off; the second is refused while the rival is loaded.
  expect(store[STORE_ON]).toBe(false)
  await ui.unmount()
})

test('/autopick reads and changes the settings', async ($, on) => {
  const store: Record<string, unknown> = {}
  world(on, store)
  const run = async (args: string) => ((await $.command.run({ command: 'autopick', args } as never)) as { text?: string }).text
  expect(await run('')).toMatch(/^off/)
  expect(await run('on')).toMatch(/^on · .* 10 min/)
  expect(await run('30')).toMatch(/30 min/)
  expect(await run('500')).toMatch(/^Usage/)
  expect(store[STORE_MINUTES]).toBe(30)
})
