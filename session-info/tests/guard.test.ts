import { expect, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

import { commandKey, GUARD_STORE, GUARD_TTL_MS, guardReply, isBypassed, NO_GUARD, reusable, savedText, skipText, treeKey, withoutRun, withRun, withSkip } from '../hooks/guard'
import type { Host } from '../hooks/host'
import type { GuardRun } from '../types'

const PANE = {
  plugin: 'session-info',
  component: 'Pane',
  requestId: 'session-info',
  props: { title: 'Session info', isFocused: true, bodyColumns: 100, placement: 'dock', scroll: { offset: 0, bodyRows: 200 }, view: {} },
} as const

const usage = { value: { startedAt: 0, context: {}, rateLimits: [] } } as never

const ran = (stdout = '', exitCode = 0) => ({ exitCode, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false })

/** A repository whose diff and untracked files the test changes; any other command fails as outside a repository. */
type Tree = { diff: string; untracked: string[]; isRepo: boolean; isDiffCut?: boolean }

function gitAnswer(tree: Tree, argv: readonly string[]) {
  const line = argv.join(' ')
  if (!tree.isRepo) return ran('', 128)
  if (line === 'git rev-parse --show-toplevel') return ran('/repo\n')
  if (line === 'git rev-parse HEAD') return ran('abc123\n')
  if (line.startsWith('git diff HEAD')) return { ...ran(tree.diff), isStdoutTruncated: tree.isDiffCut === true }
  if (line.startsWith('git ls-files --others')) return ran(tree.untracked.map(name => `${name}\0`).join(''))
  if (line.startsWith('git hash-object')) return ran(argv.slice(3).map(name => `h-${name}`).join('\n'))

  return ran('', 128)
}

const hostOf = (tree: Tree): Host => ({ run: async (argv: string[]) => gitAnswer(tree, argv) }) as unknown as Host

const PASSED: GuardRun = { kinds: ['build'], command: 'dotnet build', results: ['Build: passed'], at: 1_000, ms: 40_000, chars: 2_000 }

test('the command key drops rtk, spaces and the rerun comment, and keeps env assignments', () => {
  expect(commandKey('rtk dotnet   build App.sln')).toBe('dotnet build App.sln')
  expect(commandKey('cd app && rtk proxy npm test')).toBe('cd app && npm test')
  expect(commandKey('dotnet test # rerun')).toBe('dotnet test')
  expect(commandKey('PORT=1 npm test')).toBe('PORT=1 npm test')
  expect(isBypassed('npm test # rerun, flaky')).toBe(true)
  expect(isBypassed('npm test')).toBe(false)
})

test('the tree key follows the diff and the untracked files, and is absent outside a repository or on a cut diff', async () => {
  const tree: Tree = { diff: 'diff --git a/x b/x', untracked: ['new.ts'], isRepo: true }
  const first = await treeKey(hostOf(tree), '/repo', 'dotnet build')
  expect(first).toMatch(/^[0-9a-f]{16}$/)
  expect(await treeKey(hostOf(tree), '/repo', 'rtk dotnet build')).toBe(first)
  expect(await treeKey(hostOf(tree), '/repo', 'dotnet test')).not.toBe(first)

  expect(await treeKey(hostOf({ ...tree, diff: 'diff --git a/x b/x\n+1' }), '/repo', 'dotnet build')).not.toBe(first)
  expect(await treeKey(hostOf({ ...tree, untracked: ['new.ts', 'other.ts'] }), '/repo', 'dotnet build')).not.toBe(first)
  expect(await treeKey(hostOf({ ...tree, isRepo: false }), '/repo', 'dotnet build')).toBeUndefined()
  expect(await treeKey(hostOf({ ...tree, isDiffCut: true }), '/repo', 'dotnet build')).toBeUndefined()
  const many = Array.from({ length: 201 }, (_, i) => `f${i}.ts`)
  expect(await treeKey(hostOf({ ...tree, untracked: many }), '/repo', 'dotnet build')).toBeUndefined()
})

test('a passed run is reused until the TTL, a failure forgets it, and skips add up', () => {
  const guard = withRun(NO_GUARD, 'k', PASSED)
  expect(reusable(guard, 'k', PASSED.at + 1_000)).toBe(PASSED)
  expect(reusable(guard, 'k', PASSED.at + GUARD_TTL_MS)).toBeUndefined()
  expect(reusable(guard, 'other', PASSED.at)).toBeUndefined()
  expect(withoutRun(guard, 'k').runs).toEqual({})

  const reply = guardReply(PASSED, PASSED.at + 65_000)
  expect(reply).toContain('the build did not run again')
  expect(reply).toContain('passed 1m 5s ago')
  expect(reply).toContain('Build: passed')
  expect(reply).toContain('# rerun')

  const skip = { kinds: PASSED.kinds, command: PASSED.command, reply, at: PASSED.at + 65_000, from: PASSED.at, ms: PASSED.ms }
  const twice = withSkip(withSkip(guard, PASSED, skip), PASSED, skip)
  expect(twice.count).toBe(2)
  expect(twice.savedMs).toBe(80_000)
  expect(savedText(twice)).toBe(`2 skipped · 1m 20s · ~${Math.round((2 * (2_000 - reply.length)) / 4)} tokens`)
  expect(skipText(skip)).toBe('Build skipped, same as 1m 5s earlier')
  expect(savedText(NO_GUARD)).toBe('')
})

/** A session in a repository whose Bash tool counts its runs and answers with `output`; the guard switch comes from `store`. */
function world(on: Parameters<TestBody>[1], tree: Tree, store: Record<string, unknown>, output: { text: string; isError: boolean }) {
  const runs: string[] = []
  on('session.cwd', async () => ({ value: '/repo' }))
  on('agent.list', async () => ({ value: [] }))
  on('session.usage', async () => usage)
  on('env.get', async () => ({ value: undefined }))
  on('store.get', async (_, e) => ({ value: store[e.key] }) as never)
  on('store.set', async (_, e) => ((store[e.key] = e.value), { value: undefined }))
  on('process.run', async (_, e) => ({ value: gitAnswer(tree, e.argv) }))
  on('tool.call', { tool: 'Bash' }, async (_, e) => {
    runs.push(e.command)

    return (output.isError
      ? { isError: true, result: `Error: ${output.text}`, text: output.text }
      : { result: { stdout: output.text, stderr: '', interrupted: false }, text: output.text }) as never
  })

  return runs
}

const BUILD_OK = 'Build succeeded.\n    0 Warning(s)\n    0 Error(s)'

test('with the guard on, an unchanged build is answered from the last pass and the pane counts it', async ($, on) => {
  const tree: Tree = { diff: '', untracked: [], isRepo: true }
  const runs = world(on, tree, { [GUARD_STORE]: true }, { text: BUILD_OK, isError: false })

  await $.tool.call({ tool: 'Bash', command: 'dotnet build' })
  const skipped = await $.tool.call({ tool: 'Bash', command: 'rtk dotnet build' })
  expect(runs).toEqual(['dotnet build'])
  expect(JSON.stringify(skipped.result)).toContain('build guard')

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /^1 skipped · 0s/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Build skipped, same as/ })).toBeDefined()
  // The guard sits above the general hook: the skipped call is no new build run in the section.
  expect(await ui.find({ type: 'Text', text: '  dotnet build' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '  rtk dotnet build' })).toBeUndefined()
  await ui.unmount()

  tree.diff = 'diff --git a/x b/x\n+1'
  await $.tool.call({ tool: 'Bash', command: 'dotnet build' })
  await $.tool.call({ tool: 'Bash', command: 'dotnet build # rerun' })
  expect(runs).toEqual(['dotnet build', 'dotnet build', 'dotnet build # rerun'])
})

test('a failed build is never reused', async ($, on) => {
  const runs = world(on, { diff: '', untracked: [], isRepo: true }, { [GUARD_STORE]: true }, { text: 'Build FAILED.\n    1 Error(s)', isError: true })

  await $.tool.call({ tool: 'Bash', command: 'dotnet build' })
  await $.tool.call({ tool: 'Bash', command: 'dotnet build' })
  expect(runs).toEqual(['dotnet build', 'dotnet build'])
})

test('the guard starts off; its switch in the Checks section turns it on in the store', async ($, on) => {
  const store: Record<string, unknown> = {}
  const runs = world(on, { diff: '', untracked: [], isRepo: true }, store, { text: BUILD_OK, isError: false })

  await $.tool.call({ tool: 'Bash', command: 'dotnet build' })
  await $.tool.call({ tool: 'Bash', command: 'dotnet build' })
  expect(runs).toHaveLength(2)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: '[ ]' })).toBeDefined()
  await ui.press({ key: 'guard-switch' })
  expect(store[GUARD_STORE]).toBe(true)
  expect(await ui.find({ type: 'Text', text: '[x]' })).toBeDefined()
  await ui.unmount()

  await $.tool.call({ tool: 'Bash', command: 'dotnet build' })
  await $.tool.call({ tool: 'Bash', command: 'dotnet build' })
  expect(runs).toHaveLength(3)
})
