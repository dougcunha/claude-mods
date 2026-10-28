import { expect, mock, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

import { EMPTY_TEXT, flip } from '../hooks/pane'
import { REPORT_TOOL } from '../hooks/spec'

type On = Parameters<TestBody>[1]

const NOW = Date.UTC(2026, 9, 25, 10, 0, 0)
const MINUTE_MS = 60_000
const FOLDER = '/repo/.claude/feature-progress'

const PANE = {
  plugin: 'feature-progress',
  component: 'Pane',
  requestId: 'feature-progress',
  props: { title: 'Feature progress', isFocused: true, bodyColumns: 80, placement: 'dock', scroll: { offset: 0, bodyRows: 200 }, view: {} },
} as const

const BAND = {
  plugin: 'feature-progress',
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 20, bodyColumns: 100, scroll: { offset: 0, bodyRows: 20 }, view: {} },
} as const

const keyOf = (path: string): string => path.replace(/\\/g, '/').replace(/^[a-zA-Z]:/, '')

/** A storage folder in memory, the engine's band beneath the plugins, and its pane nouns; `reads` counts listings, `colors` the `backgroundColor` of each open. */
function world(on: On, files: Record<string, string> = {}) {
  const state = { listings: 0, panes: [] as string[], toasts: [] as string[], colors: [] as unknown[] }
  on('session.cwd', async () => ({ value: '/repo' }))
  on('fs.exists', async (_, e) => ({ value: keyOf(e.path) === FOLDER ? Object.keys(files).length > 0 : keyOf(e.path) in files }))
  on('fs.read', async (_, e) => {
    const text = files[keyOf(e.path)]
    if (text === undefined) throw new Error('ENOENT')
    return { value: text }
  })
  on('fs.list', async () => {
    state.listings += 1
    return { value: Object.keys(files).map(path => ({ name: path.slice(FOLDER.length + 1), kind: 'file', size: 1, mtimeMs: 0, isLink: false })) } as never
  })
  on('fs.write', async (_, e) => {
    files[keyOf(e.path)] = e.text
    return { value: undefined }
  })
  on('ui.render', { component: 'AbovePrompt' }, async ($, e) => {
    const { Box } = $.ui.resolve(e)
    return h(Box, { key: 'engine' }) as never
  })
  on('ui.panes', async () => ({ value: state.panes.map(id => ({ id, title: 'Feature progress', isShown: true, isFocused: true, isPlaced: true })) }) as never)
  on('ui.open', async (_, e) => (state.panes.push(e.id), state.colors.push((e as { backgroundColor?: string }).backgroundColor), { value: { isPlaced: true } }) as never)
  on('ui.close', async (_, e) => ((state.panes = state.panes.filter(id => id !== e.id)), { value: undefined }) as never)
  on('ui.toast', async (_, e) => (state.toasts.push(String(e.text)), { value: undefined }))

  return state
}

const TASKS = [
  { id: 'T01', title: 'Cart', state: 'done' },
  { id: 'T02', title: 'Payment', state: 'active', steps: { done: 2, total: 5 }, note: 'waiting on the gateway sandbox' },
  { id: 'T08', title: 'Fix CR-01', state: 'pending', group: 'Review #1' },
]

const report = (id: string, title: string, state: string, tasks: object[] = TASKS) => ({ tool: REPORT_TOOL, feature: { id, title, state }, tasks }) as never

for (const surface of ['terminal', 'desktop'] as const) {
  test(`TC-16 FR-11 FR-12 the pane lists open features latest first and expanded, task rows and a collapsed Done section (${surface})`, async ($, on) => {
    const clock = mock.clock(on, { now: NOW })
    world(on)
    await $.tool.call(report('refunds', 'Refunds', 'active', [{ id: 'R01', title: 'Refund rules' }]))
    await $.tool.call(report('legacy', 'Legacy cleanup', 'done', [{ id: 'L01', title: 'Remove old API', state: 'done' }]))
    await clock.advance(MINUTE_MS)
    await $.tool.call(report('checkout', 'Checkout', 'review'))

    const ui = await $.ui.mount({ ...PANE, surface })

    expect(await ui.find({ type: 'Text', text: 'Checkout' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: 'Refunds' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: '2 open · 1 done' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: ' review ' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: ' 1/3' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: ' 33%' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: 'updated just now' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: 'Payment' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: ' 2/5' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: '<1 min' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: '└ waiting on the gateway sandbox' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: 'Review #1' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: '0/1' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: 'Refund rules' })).toBeUndefined()
    expect(await ui.find({ type: 'Text', text: 'Done (1)' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: 'Legacy cleanup' })).toBeUndefined()
    await ui.unmount()
  })
}

for (const surface of ['terminal', 'desktop'] as const) {
  test(`paneBackground paints the pane body in the terminal only (${surface})`, { options: { paneBackground: '#2e3440' } }, async ($, on) => {
    mock.clock(on, { now: NOW })
    world(on)

    const ui = await $.ui.mount({ ...PANE, surface })
    const [root] = await ui.findAll({ type: 'Box' })
    const props = (root as unknown as { props: Record<string, unknown> }).props

    expect(props.backgroundColor).toBe(surface === 'terminal' ? '#2e3440' : undefined)
    expect(props.minHeight).toBe(surface === 'terminal' ? 200 : undefined)
    await ui.unmount()
  })
}

for (const paneBackground of ['#2e3440', undefined]) {
  test(`/feature-progress opens the pane ${paneBackground === undefined ? 'with the theme frame without' : 'transparent with'} paneBackground`, { options: paneBackground === undefined ? {} : { paneBackground } }, async ($, on) => {
    const state = world(on)

    await $.command.run({ command: 'feature-progress', args: '' } as never)

    expect(state.colors).toEqual([paneBackground === undefined ? undefined : 'transparent'])
  })
}

test('the pane body has no background by default', async ($, on) => {
  mock.clock(on, { now: NOW })
  world(on)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const [root] = await ui.findAll({ type: 'Box' })

  expect((root as unknown as { props: Record<string, unknown> }).props.backgroundColor).toBeUndefined()
  await ui.unmount()
})

test('NFR-05 on a narrow pane the task details move under the title', async ($, on) => {
  mock.clock(on, { now: NOW })
  world(on)
  await $.tool.call(report('checkout', 'Checkout', 'active'))

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal', props: { ...PANE.props, bodyColumns: 40 } })

  expect(await ui.find({ type: 'Text', text: 'Payment' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: ' 2/5' })).toBeDefined()
  await ui.unmount()
})

for (const surface of ['terminal', 'desktop'] as const) {
  test(`FR-12 NFR-04 a labelled task row shows its glyph and the word for its kind (${surface})`, async ($, on) => {
    mock.clock(on, { now: NOW })
    world(on)
    await $.tool.call(report('checkout', 'Checkout', 'review', [{ id: 'T03', title: 'Review', state: 'review', round: 1, label: 'Revisão' }]))

    const ui = await $.ui.mount({ ...PANE, surface })

    expect(await ui.find({ type: 'Text', text: '◎' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: 'review #1 · Revisão' })).toBeDefined()
    await ui.unmount()
  })
}

test('TC-16 pressing a collapsed feature and the Done section expands them', async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  world(on)
  await $.tool.call(report('refunds', 'Refunds', 'active', [{ id: 'R01', title: 'Refund rules' }]))
  await $.tool.call(report('legacy', 'Legacy cleanup', 'done', [{ id: 'L01', title: 'Remove old API', state: 'done' }]))
  await clock.advance(MINUTE_MS)
  await $.tool.call(report('checkout', 'Checkout', 'review'))
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  await ui.press({ key: 'feature-progress-toggle:refunds' })
  await ui.press({ key: 'feature-progress-toggle:done' })

  expect(await ui.find({ type: 'Text', text: 'Refund rules' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'Legacy cleanup' })).toBeDefined()
  await ui.unmount()
})

test('TC-16 FR-18 an unreadable file shows a warning row, and an empty folder shows the empty state', async ($, on) => {
  mock.clock(on, { now: NOW })
  world(on, { [`${FOLDER}/broken.json`]: '{' })
  on('session.start', async (_, e) => ({ cwd: e.cwd }))
  on('tool.register', async () => ({ value: { tool: REPORT_TOOL } }) as never)
  on('command.register', async (_, e) => ({ value: { command: e.name } }) as never)

  await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  expect(await ui.find({ type: 'Text', text: `⚠ Not a readable feature file: ${FOLDER}/broken.json` })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: EMPTY_TEXT })).toBeDefined()
  await ui.unmount()
})

test('TC-15 FR-10 /feature-progress opens the pane and a second run closes it; another argument prints the usage', async ($, on) => {
  const state = world(on)

  const opened = await $.command.run({ command: 'feature-progress', args: '' } as never)
  const closed = await $.command.run({ command: 'feature-progress', args: '' } as never)
  const usage = await $.command.run({ command: 'feature-progress', args: 'list' } as never)

  expect(opened).toMatchObject({ text: 'Feature progress pane opened.' })
  expect(closed).toMatchObject({ text: 'Feature progress pane closed.' })
  expect(usage).toMatchObject({ text: expect.stringContaining('Usage: /feature-progress') })
  expect(state.panes).toEqual([])
})

test('TC-15 FR-10 pressing the band opens the pane', async ($, on) => {
  mock.clock(on, { now: NOW })
  const state = world(on)
  await $.tool.call(report('checkout', 'Checkout', 'active'))
  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })

  await band.press({ key: 'feature-progress-open' })

  expect(state.panes).toEqual(['feature-progress'])
  await band.unmount()
})

test('TC-15 FR-10 pressing the band while the pane is open keeps it open', async ($, on) => {
  mock.clock(on, { now: NOW })
  const state = world(on)
  await $.tool.call(report('checkout', 'Checkout', 'active'))
  await $.command.run({ command: 'feature-progress', args: '' } as never)
  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })

  await band.press({ key: 'feature-progress-open' })

  expect(state.panes).toContain('feature-progress')
  await band.unmount()
})

test('TC-15 FR-16 Refresh reads the folder once more and shows a feature another session wrote', async ($, on) => {
  mock.clock(on, { now: NOW })
  const files: Record<string, string> = {}
  const state = world(on, files)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: EMPTY_TEXT })).toBeDefined()
  files[`${FOLDER}/refunds.json`] = JSON.stringify({ schemaVersion: 1, id: 'refunds', title: 'Refunds', state: 'active', updatedAt: new Date(NOW).toISOString(), tasks: [] })

  await ui.press({ key: 'feature-progress-refresh' })

  expect(state.listings).toBe(1)
  expect(await ui.find({ type: 'Text', text: 'Refunds' })).toBeDefined()
  await ui.unmount()
})

test('flip adds an id that is absent and removes one that is present', () => {
  expect(flip(['a'], 'b')).toEqual(['a', 'b'])
  expect(flip(['a', 'b'], 'a')).toEqual(['b'])
})

test('TC-19 FR-17 clean deletes the files of done features in the storage folder and toasts the count', async ($, on) => {
  mock.clock(on, { now: NOW })
  mock.env(on, { OS: 'Windows_NT' })
  const files: Record<string, string> = {}
  const state = world(on, files)
  const runs: { argv: readonly string[]; cwd?: string }[] = []
  on('process.run', async (_, e) => {
    runs.push({ argv: e.argv, cwd: e.init?.cwd })
    for (const name of e.argv.filter(arg => arg.endsWith('.json'))) delete files[`${FOLDER}/${name}`]
    return { value: { exitCode: 0, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  await $.tool.call(report('legacy', 'Legacy cleanup', 'done'))
  await $.tool.call(report('refunds', 'Refunds', 'done'))
  await $.tool.call(report('checkout', 'Checkout', 'active'))

  const answer = await $.command.run({ command: 'feature-progress', args: 'clean' } as never)

  expect(runs).toEqual([{ argv: ['cmd', '/d', '/c', 'del', '/f', '/q', 'legacy.json', 'refunds.json'], cwd: FOLDER }])
  expect(answer).toMatchObject({ text: 'Deleted 2 done features.' })
  expect(state.toasts).toEqual(['feature-progress: Deleted 2 done features.'])
  expect(Object.keys(files)).toEqual([`${FOLDER}/checkout.json`])
})

test('TC-19 FR-17 a delete that fails reports the files that are left', async ($, on) => {
  mock.clock(on, { now: NOW })
  mock.env(on, { OS: 'Windows_NT' })
  const state = world(on)
  on('process.run', async () => ({ value: { exitCode: 1, stdout: '', stderr: 'denied', isStdoutTruncated: false, isStderrTruncated: false } }))
  await $.tool.call(report('legacy', 'Legacy cleanup', 'done'))

  const answer = await $.command.run({ command: 'feature-progress', args: 'clean' } as never)

  expect(answer).toMatchObject({ text: `Deleted 0 of 1 done features; the others are still in ${FOLDER}.` })
  expect(state.toasts).toHaveLength(1)
})

test('TC-18 FR-15 pressing a task link opens its file', async ($, on) => {
  mock.clock(on, { now: NOW })
  mock.env(on, { OS: 'Windows_NT' })
  const files: Record<string, string> = { [`/repo/tasks/task_08.md`]: '# T08' }
  world(on, files)
  const runs: (readonly string[])[] = []
  on('process.run', async (_, e) => (runs.push(e.argv), { value: { exitCode: 0, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }))
  await $.tool.call(report('checkout', 'Checkout', 'active', [{ id: 'T08', title: 'Fix CR-01', link: 'tasks/task_08.md' }]))
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  await ui.press({ key: 'feature-progress-link:T08' })

  expect(runs.at(-1)).toEqual(['cmd', '/c', 'code', '/repo/tasks/task_08.md'])
  await ui.unmount()
})
