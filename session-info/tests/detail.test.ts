import { expect, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

import { clip, DETAIL_LIMIT, detailLines, detailOf } from '../hooks/detail'

const PANE = {
  plugin: 'session-info',
  component: 'Pane',
  requestId: 'session-info',
  props: { title: 'Session info', isFocused: true, bodyColumns: 100, placement: 'dock', scroll: { offset: 0, bodyRows: 200 }, view: {} },
} as const

const LONG_COMMAND = `npm run dev -- --port 4010 --host 0.0.0.0 ${'--flag '.repeat(30)}--end`

test('a detail keeps its title and the text trimmed, and cuts a text past the limit with a mark', () => {
  expect(detailOf('Task', '  write the report\n')).toEqual({ title: 'Task', text: 'write the report' })
  const cut = detailOf('Task', 'x'.repeat(DETAIL_LIMIT + 10))
  expect(cut.text.startsWith('x'.repeat(DETAIL_LIMIT))).toBe(true)
  expect(cut.text.endsWith('(cut)')).toBe(true)
  expect(detailOf('Task', 'x'.repeat(DETAIL_LIMIT)).text).toHaveLength(DETAIL_LIMIT)
})

test('the parts of a detail join one per line and an empty part drops out', () => {
  expect(detailLines(['Start the server', undefined, '', '  ', 'npm run dev'])).toBe('Start the server\nnpm run dev')
  expect(detailLines([])).toBe('')
})

test('a text longer than its room is cut to the room with a trailing ellipsis, and a text that fits stays whole', () => {
  expect(clip('abcdefghij', 6)).toBe('abcde…')
  expect(clip('abcdef', 6)).toBe('abcdef')
  expect(clip('abc', 6)).toBe('abc')
  expect(clip('abcdef', 0)).toBe('abcdef')
  expect(clip('a😀b😀c', 3)).toBe('a😀…')
})

/** Answers what the pane reads, and a Bash call that starts the background task `b1`. */
function stub(on: Parameters<TestBody>[1]): void {
  on('session.cwd', async () => ({ value: '/repo' }))
  on('agent.list', async () => ({ value: [] }))
  on('session.usage', async () => ({ value: { startedAt: 0, context: {}, rateLimits: [] } }) as never)
  on('env.get', async () => ({ value: undefined }))
  on('process.run', async () => ({ value: { exitCode: 128, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }))
  on('fs.read', async () => {
    throw new Error('no file')
  })
  on('tool.call', { tool: 'Bash' }, async (_, e) => {
    const command = String((e as { command?: unknown }).command)
    if (command.startsWith('npm run dev')) return { result: { stdout: '', stderr: '', interrupted: false, backgroundTaskId: 'b1' }, text: 'ok' } as never

    return { result: 'Exit code 2', isError: true, text: `src/app.ts(3,1): error TS2304: Cannot find name 'missingThing'.\nsrc/app.ts(9,5): error TS2322: Type 'string' is not assignable to type 'number'.` } as never
  })
}

for (const surface of ['terminal', 'desktop'] as const) {
  test(`pressing a cut command shows it whole with a Back button, and Back returns to the sections (${surface})`, async ($, on) => {
    stub(on)

    await $.tool.call({ tool: 'Bash', command: LONG_COMMAND, description: 'Start the dev server', run_in_background: true })
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ type: 'Button', key: 'detail:background:b1:command' })).toBeDefined()
    expect(await ui.find({ type: 'Button', key: 'detail-back' })).toBeUndefined()

    await ui.press({ key: 'detail:background:b1:command' })
    expect(await ui.find({ type: 'Text', text: `Start the dev server\n${LONG_COMMAND}` })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: 'Background command' })).toBeDefined()
    expect(await ui.find({ type: 'Button', key: 'detail-back' })).toBeDefined()
    expect(await ui.find({ type: 'Button', key: 'detail-copy' })).toBeDefined()
    expect(await ui.find({ type: 'Button', key: 'section:#background' })).toBeUndefined()

    await ui.press({ key: 'detail-back' })
    expect(await ui.find({ type: 'Button', key: 'detail-back' })).toBeUndefined()
    expect(await ui.find({ type: 'Button', key: 'section:#background' })).toBeDefined()
    await ui.unmount()
  })
}

for (const surface of ['terminal', 'desktop'] as const) {
  test(`a cut row ends in an ellipsis in a narrow pane, and a row that fits has none (${surface})`, async ($, on) => {
    stub(on)

    await $.tool.call({ tool: 'Bash', command: LONG_COMMAND, description: 'Start the dev server', run_in_background: true })
    await $.tool.call({ tool: 'Bash', command: 'tsc -p app' })
    const ui = await $.ui.mount({ ...PANE, props: { ...PANE.props, bodyColumns: 40 }, surface, viewport: { columns: 40, rows: 80 } })
    expect(await ui.find({ type: 'Text', text: /^  npm run dev.*…$/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /^  tsc -p app$/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: 'Start the dev server' })).toBeDefined()
    await ui.unmount()
  })
}

test('pressing a line of a failed build shows its command and every error line', async ($, on) => {
  stub(on)

  await $.tool.call({ tool: 'Bash', command: 'tsc -p app' })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'detail:check:build:command' })
  const texts = (await ui.findAll({ type: 'Text' })).map(one => String(one.text))
  const whole = texts.find(text => text.startsWith('tsc -p app\n'))
  expect(whole).toContain("TS2304: Cannot find name 'missingThing'.")
  expect(whole).toContain('TS2322')
  await ui.unmount()
})

test('a short row with no text to show is no button', async ($, on) => {
  stub(on)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Button', key: 'detail:background:b1:name' })).toBeUndefined()
  expect(await ui.find({ type: 'Button', key: 'detail:ci:error' })).toBeUndefined()
  await ui.unmount()
})
