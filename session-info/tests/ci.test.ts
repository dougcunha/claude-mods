import { expect, mock, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

import type { CiRun } from '../types'

import { ciTrigger, isWatching, pollWatch, runDetail, startWatch, stateOf, waitingText, watchState } from '../hooks/ci'
import type { Runner } from '../hooks/ci'

const PANE = {
  plugin: 'session-info',
  component: 'Pane',
  requestId: 'session-info',
  props: { title: 'Session info', isFocused: true, bodyColumns: 80 },
} as const

const SHA = 'a1b2c3d4e5f6a7b8c9d0'
const URL = 'https://github.com/owner/repo/actions/runs/42'

const raw = (status: string, conclusion = '', jobs?: object[]) => ({
  databaseId: 42,
  workflowName: 'CI',
  displayTitle: 'Add the CI section',
  headBranch: 'main',
  headSha: SHA,
  status,
  conclusion,
  url: URL,
  createdAt: '2026-10-12T10:00:00Z',
  updatedAt: '2026-10-12T10:04:32Z',
  ...(jobs === undefined ? {} : { jobs }),
})

const JOBS = [
  { name: 'build', status: 'completed', conclusion: 'success' },
  { name: 'test', status: 'completed', conclusion: 'success' },
]

/** Answers git and gh like a repository whose push started one run that is already done. */
const ran = (stdout: string, exitCode = 0) => ({ exitCode, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false })

function answer(argv: readonly string[]) {
  const line = argv.join(' ')
  if (line === 'git rev-parse HEAD') return ran(`${SHA}\n`)
  if (line === 'git rev-parse --abbrev-ref HEAD') return ran('main\n')
  if (line.startsWith('gh run list')) return ran(JSON.stringify([raw('in_progress')]))
  if (line.startsWith('gh run view 42')) return ran(JSON.stringify(raw('completed', 'success', JOBS)))

  return ran('', 128)
}

const later = (ms: number) =>
  new Promise<void>(resolve => (globalThis as unknown as { setTimeout: (fn: () => void, ms: number) => void }).setTimeout(resolve, ms))

/** The GitHub poll runs on after the hook returns: the pane is mounted again until the poll lands. */
async function mountPolled($: Parameters<TestBody>[0], surface: 'terminal' | 'desktop', done: string) {
  for (let tries = 0; ; tries++) {
    const ui = await $.ui.mount({ ...PANE, surface })
    if (tries === 50 || (await ui.find({ type: 'Text', text: done }))) return ui
    await ui.unmount()
    await later(20)
  }
}

const pane = (on: Parameters<TestBody>[1]) => {
  on('session.cwd', async () => ({ value: '/repo' }))
  on('agent.list', async () => ({ value: [] }))
  on('session.usage', async () => ({ value: { startedAt: 0, rateLimits: [], context: { window: 200_000 } } }) as never)
  on('env.get', async () => ({ value: undefined }))
  on('fs.exists', async () => ({ value: false }))
}

for (const surface of ['terminal', 'desktop'] as const) {
  test(`a push the session makes shows its runs, their jobs and a link (${surface})`, async ($, on) => {
    const notified: string[] = []
    const spawned: string[][] = []
    pane(on)
    on('process.spawn', async function* (_, e) {
      spawned.push([...e.argv])

      return { value: { code: 0, signal: null } }
    })
    on('process.run', async (_, e) => ({ value: answer(e.argv) }) as never)
    on('ui.notify', async (_, e) => (notified.push(String(e.text)), { value: { isSent: true } }) as never)
    on('tool.call', { tool: 'Bash' }, async () => ({ result: { stdout: '', stderr: '', interrupted: false }, text: 'pushed' }) as never)

    const empty = await $.ui.mount({ ...PANE, surface })
    expect(await empty.find({ type: 'Text', text: 'No GitHub Actions run started from this session yet.' })).toBeDefined()
    await empty.unmount()

    await $.tool.call({ tool: 'Bash', command: 'rtk git push origin main' })
    const ui = await mountPolled($, surface, '✓ success')
    expect(await ui.find({ type: 'Text', text: '✓ success' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: 'main · a1b2c3d · 4m 32s' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: '  ✓ build' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /github\.com/ })).toBeUndefined()
    await ui.press({ key: 'ci:42' })
    expect(spawned).toEqual([['xdg-open', URL]])
    expect(notified).toEqual(['CI · success · main · a1b2c3d · 4m 32s'])
    await ui.unmount()
  })
}

test('a /clear or a resume drops the watch of the conversation that pushed', async ($, on) => {
  let id = 's1'
  const clock = mock.clock(on)
  pane(on)
  on('session.id', async () => ({ value: id }))
  on('session.end', async (_, e) => ({ sessionId: e.sessionId }))
  on('process.run', async (_, e) => ({ value: answer(e.argv) }) as never)
  on('ui.notify', async () => ({ value: { isSent: true } }) as never)
  on('tool.call', { tool: 'Bash' }, async () => ({ result: { stdout: '', stderr: '', interrupted: false }, text: 'pushed' }) as never)

  await $.tool.call({ tool: 'Bash', command: 'rtk git push origin main' })
  const watched = await mountPolled($, 'terminal', '✓ success')
  expect(await watched.find({ type: 'Text', text: '✓ success' })).toBeDefined()
  await watched.unmount()

  await $.session.end({ reason: 'clear', sessionId: 's1', resume: { id: 's1' } })
  id = 's2'
  await clock.advance(200)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: 'No GitHub Actions run started from this session yet.' })).toBeDefined()
  await ui.unmount()
})

test('showCi false leaves the section out', { options: { showCi: false } }, async ($, on) => {
  pane(on)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /^No GitHub Actions run/ })).toBeUndefined()
  await ui.unmount()
})

test('pushes, pull requests, dispatches and reruns start a watch; other commands do not', async () => {
  expect(ciTrigger('rtk git push origin main', '')).toEqual({ kind: 'push' })
  expect(ciTrigger('cd app && gh pr create --fill', '')).toEqual({ kind: 'pr' })
  expect(ciTrigger('gh workflow run ci.yml', `Created workflow_dispatch event\n${URL}`)).toEqual({ kind: 'workflow', runId: 42 })
  expect(ciTrigger('gh workflow run ci.yml', 'Created workflow_dispatch event')).toEqual({ kind: 'workflow' })
  expect(ciTrigger('gh run rerun 7 --failed', '')).toEqual({ kind: 'rerun', runId: 7 })
  expect(ciTrigger('git push --dry-run', '')).toBeUndefined()
  expect(ciTrigger('git status', '')).toBeUndefined()
})

test('a poll finds the runs of the commit, reads each open run and reports the ones that completed', async () => {
  const calls: string[] = []
  const run: Runner = async argv => (calls.push(argv.join(' ')), answer(argv))
  const watch = startWatch({ kind: 'push' }, { sha: SHA, branch: 'main' }, Date.parse('2026-10-12T10:00:00Z'))
  expect(waitingText(watch, watch.since)).toBe('Waiting for the runs of a1b2c3d…')

  const { watch: polled, finished } = await pollWatch(run, watch, watch.since + 1_000)
  expect(calls.map(call => call.split(' --json')[0])).toEqual([`gh run list --commit ${SHA} --limit 20`, 'gh run view 42'])
  expect(finished.map(one => one.conclusion)).toEqual(['success'])
  expect(polled.runs[0]?.jobs.map(job => job.name)).toEqual(['build', 'test'])
  expect(watchState(polled)).toBe('success')
  expect(isWatching(polled, watch.since + 1_000)).toBe(true)
  expect(isWatching(polled, watch.since + 200_000)).toBe(false)
  expect(waitingText({ ...watch, runs: [] }, watch.since + 200_000)).toBe('No workflow run started for a1b2c3d.')

  calls.length = 0
  const again = await pollWatch(run, polled, watch.since + 20_000)
  expect(calls.map(call => call.split(' --json')[0])).toEqual([`gh run list --commit ${SHA} --limit 20`])
  expect(again.finished).toEqual([])
})

test('a gh error stops the watch with its first line', async () => {
  const missing: Runner = async () => {
    throw new Error('spawn gh ENOENT')
  }
  const watch = startWatch({ kind: 'rerun', runId: 7 }, {}, 0)
  const { watch: failed } = await pollWatch(missing, watch, 0)
  expect(failed.error).toBe('gh not found: install the GitHub CLI and run gh auth login')
  expect(isWatching(failed, 0)).toBe(false)

  const unauthenticated: Runner = async () => ({ exitCode: 4, stdout: '', stderr: 'To get started with GitHub CLI, please run:  gh auth login\nmore' })
  expect((await pollWatch(unauthenticated, watch, 0)).watch.error).toBe('To get started with GitHub CLI, please run:  gh auth login')
})

test('run and job states read the status before the conclusion', async () => {
  expect(stateOf({ status: 'in_progress', conclusion: '' })).toBe('running')
  expect(stateOf({ status: 'queued', conclusion: '' })).toBe('queued')
  expect(stateOf({ status: 'completed', conclusion: 'timed_out' })).toBe('failure')
  expect(stateOf({ status: 'completed', conclusion: 'cancelled' })).toBe('cancelled')
  expect(stateOf({ status: 'completed', conclusion: 'skipped' })).toBe('skipped')
  const done: CiRun = { id: 1, workflow: 'CI', title: '', branch: 'dev', sha: SHA, status: 'completed', conclusion: 'success', url: '', createdAt: 1, updatedAt: 65_001, jobs: [] }
  expect(runDetail(done, 0)).toBe('dev · a1b2c3d · 1m 5s')
  expect(watchState({ ...startWatch({ kind: 'push' }, {}, 0), runs: [done, { ...done, status: 'in_progress', conclusion: '' }] })).toBe('running')
})
