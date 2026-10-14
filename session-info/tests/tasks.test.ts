import { expect, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

import type { Host } from '../hooks/host'
import { finishedRuns, taskEnds, withFinished } from '../hooks/tasks'
import type { CheckRun, Checks } from '../types'

const PANE = {
  plugin: 'session-info',
  component: 'Pane',
  requestId: 'session-info',
  props: { title: 'Session info', isFocused: true, bodyColumns: 100 },
} as const

const OUTPUT = 'C:/tmp/tasks/b1.output'

const notification = (taskId: string, status: string, outputFile = OUTPUT) => `<task-notification>
<task-id>${taskId}</task-id>
<tool-use-id>toolu_1</tool-use-id>
<output-file>${outputFile}</output-file>
<status>${status}</status>
<summary>Background command "Run tests" ${status === 'completed' ? 'completed (exit code 0)' : 'failed with exit code 1'}</summary>
</task-notification>`

const host = (files: Record<string, string> = {}): Host =>
  ({
    readFile: async (path: string) => {
      if (path in files) return files[path]
      throw new Error(`no ${path}`)
    },
    env: async () => ({ home: 'C:/Users/me' }),
  }) as unknown as Host

const running = (kind: CheckRun['kind'], taskId: string): CheckRun =>
  ({ kind, status: 'running', command: 'dotnet test', at: 0, isAgent: false, taskId, errors: [], failures: [] })

test('reads each task end of a notification and skips an incomplete one', () => {
  const text = `${notification('b1', 'completed')}\n${notification('b2', 'failed', 'C:/tmp/tasks/b2.output')}\n<task-notification><status>killed</status></task-notification>`
  expect(taskEnds(text)).toEqual([
    { taskId: 'b1', status: 'completed', outputFile: OUTPUT },
    { taskId: 'b2', status: 'failed', outputFile: 'C:/tmp/tasks/b2.output' },
  ])
  expect(taskEnds('Run the tests')).toEqual([])
})

test('a task end replaces the check that waits on it with what its output says', async () => {
  const checks: Checks = { build: null, test: running('test', 'b1') }
  const [end] = taskEnds(notification('b1', 'failed'))
  if (end === undefined) throw new Error('no task end')
  const output = 'Failed Divide_Throws [3 ms]\nFailed!  - Failed:     1, Passed:     2, Skipped:     0, Total:     3'
  const runs = await finishedRuns(host({ [OUTPUT]: output }), checks, end, 5)
  expect(runs).toHaveLength(1)
  expect(runs[0]).toMatchObject({ kind: 'test', status: 'failed', failed: 1, total: 3, at: 5 })
  expect(runs[0]?.taskId).toBeUndefined()
  expect(withFinished(checks, end, runs).test).toBe(runs[0])

  const newer = { build: null, test: running('test', 'b9') }
  expect(withFinished(newer, end, runs)).toBe(newer)
  expect(await finishedRuns(host(), newer, end, 5)).toEqual([])
})

test('a completed task with no output file to read shows as passed', async () => {
  const [end] = taskEnds(notification('b1', 'completed', 'C:/tmp/gone.output'))
  if (end === undefined) throw new Error('no task end')
  const runs = await finishedRuns(host(), { build: running('build', 'b1'), test: null }, end, 0)
  expect(runs[0]).toMatchObject({ kind: 'build', status: 'passed' })
})

const later = (ms: number) =>
  new Promise<void>(resolve => (globalThis as unknown as { setTimeout: (fn: () => void, ms: number) => void }).setTimeout(resolve, ms))

/** The output file is read after the hook returns: the pane is mounted again until the result lands. */
async function mountUntil($: Parameters<TestBody>[0], done: string) {
  for (let tries = 0; ; tries++) {
    const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
    if (tries === 50 || (await ui.find({ type: 'Text', text: done }))) return ui
    await ui.unmount()
    await later(20)
  }
}

test('the checks section shows a background test run when its task notification arrives', async ($, on) => {
  on('session.cwd', async () => ({ value: '/repo' }))
  on('agent.list', async () => ({ value: [] }))
  on('session.usage', async () => ({ value: { startedAt: 0, context: {}, rateLimits: [] } }) as never)
  on('env.get', async () => ({ value: undefined }))
  on('process.run', async () => ({ value: { exitCode: 128, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }))
  on('fs.read', async (_, e) => {
    if (e.path.replaceAll('\\', '/') !== OUTPUT) throw new Error(`no ${e.path}`)

    return { value: 'ok dotnet test: 12 tests passed, 0 warnings in 1 projects (807 ms)' }
  })
  on('prompt.submit', async (_, e) => ({ text: e.text }) as never)
  on('tool.call', { tool: 'Bash' }, async () =>
    ({ result: { stdout: '', stderr: '', interrupted: false, backgroundTaskId: 'b1' }, text: 'Command running in background with ID: b1.' }) as never)

  await $.tool.call({ tool: 'Bash', command: 'dotnet test', run_in_background: true })
  const waiting = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await waiting.find({ type: 'Text', text: '  running in background' })).toBeDefined()
  await waiting.unmount()

  await $.prompt.submit({ text: notification('b1', 'completed'), origin: { kind: 'task-notification' }, wait: false } as never)
  const ui = await mountUntil($, '  12 passed')
  expect(await ui.find({ type: 'Text', text: '  12 passed' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '  running in background' })).toBeUndefined()
  await ui.unmount()
})
