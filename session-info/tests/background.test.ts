import { expect, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

import {
  BACKGROUND_LIMIT,
  backgroundSummary,
  firstLine,
  hasCommandLine,
  orderedTasks,
  startedTask,
  statusOf,
  taskLabel,
  taskRowCount,
  taskState,
  TEXT_LIMIT,
  withEnd,
  withTask,
} from '../hooks/background'
import type { BackgroundTask } from '../types'

const PANE = {
  plugin: 'session-info',
  component: 'Pane',
  requestId: 'session-info',
  props: { title: 'Session info', isFocused: true, bodyColumns: 100, placement: 'dock', scroll: { offset: 0, bodyRows: 200 }, view: {} },
} as const

const NOW = 1_700_000_000_000

const task = (id: string, extra: Partial<BackgroundTask> = {}): BackgroundTask => ({ id, command: `run ${id}`, status: 'running', at: NOW, ...extra })

const ran = (taskId?: string, extra: Record<string, unknown> = {}) => ({ result: { stdout: '', stderr: '', interrupted: false, backgroundTaskId: taskId }, ...extra })

test('a shell call that left a background task starts a running one from the id its result carries', () => {
  expect(startedTask({ command: 'npm run dev' }, ran('b1'), NOW)).toEqual({ id: 'b1', command: 'npm run dev', status: 'running', at: NOW })
  expect(startedTask({ command: 'npm run dev', description: 'Start the dev server' }, ran('b1'), NOW)).toEqual({
    id: 'b1',
    command: 'npm run dev',
    description: 'Start the dev server',
    status: 'running',
    at: NOW,
  })
})

test('a call with no task id, a refused one and a failed one start nothing', () => {
  expect(startedTask({ command: 'ls' }, ran(undefined), NOW)).toBeUndefined()
  expect(startedTask({ command: 'ls' }, ran(''), NOW)).toBeUndefined()
  expect(startedTask({ command: 'ls' }, { result: 'plain text' }, NOW)).toBeUndefined()
  expect(startedTask({ command: 'ls' }, ran('b1', { deny: 'no' }), NOW)).toBeUndefined()
  expect(startedTask({ command: 'ls' }, ran('b1', { isError: true }), NOW)).toBeUndefined()
})

test('the task keeps the whole command and the first line of the description, cut to the limit, and no output', () => {
  const long = 'x'.repeat(TEXT_LIMIT + 50)
  const started = startedTask({ command: `\n  ${long}\nsecond line`, description: 'Named\nmore' }, ran('b1', { text: 'secret output' }), NOW)
  expect(started?.command).toBe(`${long}\nsecond line`.slice(0, TEXT_LIMIT))
  expect(started?.description).toBe('Named')
  expect(JSON.stringify(started)).not.toContain('secret')
  expect(startedTask({ command: 7, description: '  ' }, ran('b1'), NOW)).toEqual({ id: 'b1', command: '', status: 'running', at: NOW })
})

test('the newest task goes first, a repeated id is replaced and the list keeps BACKGROUND_LIMIT tasks', () => {
  expect(withTask([task('b1')], task('b2')).map(one => one.id)).toEqual(['b2', 'b1'])
  expect(withTask([task('b1'), task('b2')], task('b1', { command: 'again' })).map(one => one.command)).toEqual(['again', 'run b2'])
  const full = Array.from({ length: BACKGROUND_LIMIT }, (_, index) => task(`t${index}`))
  const next = withTask(full, task('new'))
  expect(next).toHaveLength(BACKGROUND_LIMIT)
  expect(next[0]?.id).toBe('new')
  expect(next.at(-1)?.id).toBe(`t${BACKGROUND_LIMIT - 2}`)
})

test('a notification status is completed, killed or failed', () => {
  expect(statusOf('completed')).toBe('completed')
  expect(statusOf('killed')).toBe('killed')
  expect(statusOf('failed')).toBe('failed')
  expect(statusOf('anything else')).toBe('failed')
})

test('a task end marks the running task it names and leaves the rest, and a second end changes nothing', () => {
  const tasks = [task('b2'), task('b1')]
  const ended = withEnd(tasks, { taskId: 'b1', status: 'failed' }, NOW + 5_000)
  expect(ended).toEqual([task('b2'), task('b1', { status: 'failed', endedAt: NOW + 5_000 })])
  expect(withEnd(ended, { taskId: 'b1', status: 'completed' }, NOW + 9_000)).toBe(ended)
  expect(withEnd(tasks, { taskId: 'b9', status: 'completed' }, NOW)).toBe(tasks)
})

test('running tasks list first and each group keeps its newest-first order', () => {
  const tasks = [task('c', { status: 'completed' }), task('b'), task('a', { status: 'failed' }), task('d')]
  expect(orderedTasks(tasks).map(one => one.id)).toEqual(['b', 'd', 'c', 'a'])
})

test('a task is named by its description, else its command, else its id, and a description gets the command under it', () => {
  expect(taskLabel(task('b1', { description: 'Start the server' }))).toBe('Start the server')
  expect(taskLabel(task('b1'))).toBe('run b1')
  expect(taskLabel(task('b1', { command: '' }))).toBe('b1')
  expect(taskLabel(task('b1', { command: 'make all\nmake test' }))).toBe('make all')
  expect(firstLine('\n  one\ntwo')).toBe('one')
  expect(hasCommandLine(task('b1', { description: 'Start the server' }))).toBe(true)
  expect(hasCommandLine(task('b1'))).toBe(false)
  expect(taskRowCount([task('a'), task('b', { description: 'Named' })])).toBe(3)
  expect(taskRowCount([])).toBe(0)
})

test('the state reads running and ended times in words, so color is no more than a hint', () => {
  expect(taskState(task('b1'), NOW + 3_000)).toBe('running · 3s')
  expect(taskState(task('b1'), NOW + 125_000)).toBe('running · 2m 5s')
  expect(taskState(task('b1', { status: 'completed', endedAt: NOW + 12_000 }), NOW + 999_000)).toBe('done · 12s')
  expect(taskState(task('b1', { status: 'failed', endedAt: NOW + 1_000 }), NOW)).toBe('failed · 1s')
  expect(taskState(task('b1', { status: 'killed', endedAt: NOW + 1_000 }), NOW)).toBe('stopped · 1s')
})

test('the summary counts the tasks by status and says none for an empty list', () => {
  expect(backgroundSummary([])).toBe('none')
  const tasks = [task('a'), task('b'), task('c', { status: 'completed' }), task('d', { status: 'failed' }), task('e', { status: 'killed' })]
  expect(backgroundSummary(tasks)).toBe('2 running · 1 done · 1 failed · 1 stopped')
})

const notification = (taskId: string, status: string) => `<task-notification>
<task-id>${taskId}</task-id>
<tool-use-id>toolu_1</tool-use-id>
<output-file>C:/tmp/tasks/${taskId}.output</output-file>
<status>${status}</status>
<summary>Background command "Run" ${status}</summary>
</task-notification>`

const later = (ms: number) =>
  new Promise<void>(resolve => (globalThis as unknown as { setTimeout: (fn: () => void, ms: number) => void }).setTimeout(resolve, ms))

/** Answers what the pane reads, and a Bash call that starts the background task `b1`. */
function stub(on: Parameters<TestBody>[1], taskIds: Record<string, string> = { 'npm run dev': 'b1' }): void {
  on('session.cwd', async () => ({ value: '/repo' }))
  on('agent.list', async () => ({ value: [] }))
  on('session.usage', async () => ({ value: { startedAt: 0, context: {}, rateLimits: [] } }) as never)
  on('env.get', async () => ({ value: undefined }))
  on('process.run', async () => ({ value: { exitCode: 128, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }))
  on('fs.read', async () => {
    throw new Error('no file')
  })
  on('prompt.submit', async (_, e) => ({ text: e.text }) as never)
  on('tool.call', { tool: 'Bash' }, async (_, e) => {
    const id = taskIds[String((e as { command?: unknown }).command)]

    return { result: { stdout: '', stderr: '', interrupted: false, ...(id === undefined ? {} : { backgroundTaskId: id }) }, text: 'ok' } as never
  })
}

/** The task ends are handled after the hook returns: the pane is mounted again until the summary shows. */
async function mountUntil($: Parameters<TestBody>[0], surface: 'terminal' | 'desktop', done: string) {
  for (let tries = 0; ; tries++) {
    const ui = await $.ui.mount({ ...PANE, surface })
    if (tries === 50 || (await ui.find({ type: 'Text', text: done }))) return ui
    await ui.unmount()
    await later(20)
  }
}

for (const surface of ['terminal', 'desktop'] as const) {
  test(`the background section lists a command Claude started and marks it ended by its notification (${surface})`, async ($, on) => {
    stub(on)

    const empty = await $.ui.mount({ ...PANE, surface })
    expect(await empty.find({ type: 'Text', text: 'No command started in the background in this conversation yet.' })).toBeDefined()
    await empty.unmount()

    await $.tool.call({ tool: 'Bash', command: 'npm run dev', description: 'Start the dev server', run_in_background: true })
    const running = await $.ui.mount({ ...PANE, surface })
    expect(await running.find({ type: 'Text', text: '1 running' })).toBeDefined()
    expect(await running.find({ type: 'Text', text: 'Start the dev server' })).toBeDefined()
    expect(await running.find({ type: 'Text', text: '  npm run dev' })).toBeDefined()
    await running.unmount()

    await $.prompt.submit({ text: notification('b1', 'completed'), origin: { kind: 'task-notification' }, wait: false } as never)
    const ended = await mountUntil($, surface, '1 done')
    expect(await ended.find({ type: 'Text', text: '1 done' })).toBeDefined()
    expect(await ended.find({ type: 'Text', text: '1 running' })).toBeUndefined()
    await ended.unmount()
  })
}

test('a failed notification marks the task failed, and a command run in the foreground is not listed', async ($, on) => {
  stub(on, { 'npm run dev': 'b1' })

  await $.tool.call({ tool: 'Bash', command: 'ls' })
  await $.tool.call({ tool: 'Bash', command: 'npm run dev', run_in_background: true })
  await $.prompt.submit({ text: notification('b1', 'failed'), origin: { kind: 'task-notification' }, wait: false } as never)
  const ui = await mountUntil($, 'terminal', '1 failed')
  expect(await ui.find({ type: 'Text', text: '1 failed' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'run ls' })).toBeUndefined()
  await ui.unmount()
})

test('a notification typed by the person is no task end', async ($, on) => {
  stub(on)

  await $.tool.call({ tool: 'Bash', command: 'npm run dev', run_in_background: true })
  await $.prompt.submit({ text: notification('b1', 'completed'), wait: false } as never)
  await later(100)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: '1 running' })).toBeDefined()
  await ui.unmount()
})

test('showBackground false leaves the section out and records nothing', { options: { showBackground: false } }, async ($, on) => {
  stub(on)

  await $.tool.call({ tool: 'Bash', command: 'npm run dev', run_in_background: true })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Button', key: 'section:#background' })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: '1 running' })).toBeUndefined()
  await ui.unmount()
})

test('the background section is on by default and folds', async ($, on) => {
  stub(on)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Button', key: 'section:#background' })).toBeDefined()
  await ui.press({ key: 'section:#background' })
  expect(await ui.find({ type: 'Text', text: 'No command started in the background in this conversation yet.' })).toBeUndefined()
  await ui.unmount()
})
