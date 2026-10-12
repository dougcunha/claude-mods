import { expect, mock, test } from 'claude-code/testing'

import { clientArgv, splitCommand } from '../hooks/client'
import type { Host } from '../hooks/host'
import { age, branchText, countParts, mergeSubmodules, operationText, parseCommit, parseStatus, parseSubmoduleStatus, readOperation, repoRowCount } from '../hooks/repo'
import type { Repo } from '../types'

const PANE = {
  plugin: 'session-info',
  component: 'Pane',
  requestId: 'session-info',
  props: { title: 'Session info', isFocused: true, bodyColumns: 100 },
} as const

const STATUS = [
  '# branch.oid 699b1112222333444555',
  '# branch.head main',
  '# branch.upstream origin/main',
  '# branch.ab +2 -1',
  '1 M. N... 100644 100644 100644 aaa bbb src/a.ts',
  '1 .M N... 100644 100644 100644 aaa bbb src/b c.ts',
  '1 MM N... 100644 100644 100644 aaa bbb src/d.ts',
  '2 R. N... 100644 100644 100644 aaa bbb R100 src/new.ts',
  'src/old.ts',
  'u UU N... 100644 100644 100644 100644 a b c src/conflict.ts',
  '? notes.md',
  '1 .M S.M. 160000 160000 160000 aaa aaa libs/core',
  '1 M. SC.. 160000 160000 160000 aaa bbb libs/ui',
  '',
].join('\0')

const SUBMODULES = [
  ' aaa111 libs/core (heads/main)',
  '+bbb222 libs/ui (v1.0-3-gbbb222)',
  '-ccc333 libs/docs',
  ' ddd444 libs/clean (heads/main)',
  '',
].join('\n')

const repoOf = (patch: Partial<Repo>): Repo => ({
  root: '/repo',
  branch: 'main',
  head: '699b111',
  upstream: { ahead: 0, behind: 0 },
  counts: { staged: 0, modified: 0, untracked: 0, conflicts: 0 },
  commit: { hash: '699b111', subject: 'fix: draw', at: 0 },
  operation: null,
  submodules: { total: 0, changed: [] },
  at: 0,
  ...patch,
})

test('parses porcelain v2: branch, upstream, counts and submodules apart from the counts', async () => {
  const parsed = parseStatus(STATUS)
  expect(parsed.branch).toBe('main')
  expect(parsed.head).toBe('699b111')
  expect(parsed.upstream).toEqual({ ahead: 2, behind: 1 })
  expect(parsed.counts).toEqual({ staged: 3, modified: 2, untracked: 1, conflicts: 1 })
  expect([...parsed.submodules.entries()].map(([path, issues]) => [path, [...issues]])).toEqual([
    ['libs/core', ['modified']],
    ['libs/ui', ['commit']],
  ])
})

test('tells a local-only branch, a gone upstream and a detached HEAD apart', async () => {
  expect(parseStatus('# branch.oid abc1234567\0# branch.head topic\0').upstream).toBe('none')
  expect(parseStatus('# branch.oid abc1234567\0# branch.head topic\0# branch.upstream origin/topic\0').upstream).toBe('gone')

  const detached = parseStatus('# branch.oid abc1234567\0# branch.head (detached)\0')
  expect(detached.branch).toBe(null)
  expect(detached.head).toBe('abc1234')
  expect(parseStatus('# branch.oid (initial)\0# branch.head main\0').head).toBe(null)

  expect(branchText(repoOf({}))).toBe('main')
  expect(branchText(repoOf({ upstream: { ahead: 2, behind: 1 } }))).toBe('main ↑2 ↓1')
  expect(branchText(repoOf({ upstream: { ahead: 0, behind: 3 } }))).toBe('main ↓3')
  expect(branchText(repoOf({ upstream: 'none' }))).toBe('main · local only')
  expect(branchText(repoOf({ upstream: 'gone' }))).toBe('main · upstream gone')
  expect(branchText(repoOf({ branch: null, head: 'abc1234' }))).toBe('detached abc1234')
})

test('merges submodule status with porcelain flags, one row per submodule', async () => {
  const listed = parseSubmoduleStatus(SUBMODULES)
  expect(listed.paths).toEqual(['libs/core', 'libs/ui', 'libs/docs', 'libs/clean'])

  const merged = mergeSubmodules(listed.paths, listed.issues, parseStatus(STATUS).submodules)
  expect(merged.total).toBe(4)
  expect(merged.changed).toEqual([
    { path: 'libs/core', issues: ['modified'] },
    { path: 'libs/docs', issues: ['uninitialized'] },
    { path: 'libs/ui', issues: ['commit'] },
  ])
})

test('reads an operation in progress from the files in the git folder', async () => {
  const hostWith = (files: Record<string, string>) =>
    ({
      exists: async (path: string) => Object.keys(files).some(file => file === path || file.startsWith(`${path}/`)),
      readFile: async (path: string) => files[path] ?? Promise.reject(new Error('ENOENT')),
    }) as unknown as Host

  const rebase = await readOperation(hostWith({ '/g/rebase-merge/msgnum': '3\n', '/g/rebase-merge/end': '7\n' }), '/g')
  expect(rebase).toEqual({ kind: 'rebase', step: 3, total: 7 })
  expect(operationText(rebase!)).toBe('Rebase in progress: step 3 of 7')
  expect(await readOperation(hostWith({ '/g/MERGE_HEAD': 'x' }), '/g')).toEqual({ kind: 'merge' })
  expect(operationText({ kind: 'cherry-pick' })).toBe('Cherry-pick in progress')
  expect(await readOperation(hostWith({}), '/g')).toBe(null)
})

test('formats the commit, the counts, the age and the row count', async () => {
  expect(parseCommit('a1b2c3d\0feat: add the Git section\x001700000000\n')).toEqual({ hash: 'a1b2c3d', subject: 'feat: add the Git section', at: 1_700_000_000_000 })
  expect(parseCommit('')).toBe(null)
  expect(countParts({ staged: 2, modified: 0, untracked: 1, conflicts: 0 }).map(part => part.text)).toEqual(['● 2 staged', '? 1 untracked'])
  expect([age(45_000), age(12 * 60_000), age(3 * 3_600_000), age(2 * 86_400_000), age(30 * 86_400_000)]).toEqual(['45s', '12m', '3h', '2d', '4w'])

  expect(repoRowCount('outside')).toBe(1)
  expect(repoRowCount(repoOf({}))).toBe(1)
  const changed = Array.from({ length: 7 }, (_, i) => ({ path: `s${i}`, issues: ['modified' as const] }))
  expect(repoRowCount(repoOf({ operation: { kind: 'merge' }, counts: { staged: 1, modified: 0, untracked: 0, conflicts: 0 }, submodules: { total: 9, changed } }))).toBe(1 + 1 + 1 + 1 + 5 + 1)
})

test('builds the argv that opens the Git client in a new terminal window', async () => {
  expect(splitCommand('lazygit')).toEqual(['lazygit'])
  expect(splitCommand('"C:\\Program Files\\Fork\\Fork.exe" --flag')).toEqual(['C:\\Program Files\\Fork\\Fork.exe', '--flag'])

  expect(clientArgv('windows', 'D:/My Repo', ['lazygit'])).toEqual(['cmd', '/c', 'start', 'Git client', '/D', 'D:\\My Repo', 'lazygit'])
  expect(clientArgv('mac', "/Users/me/it's", ['lazygit'])).toEqual([
    'osascript',
    '-e',
    `tell application "Terminal" to do script "cd '/Users/me/it'\\\\''s' && 'lazygit'"`,
    '-e',
    'tell application "Terminal" to activate',
  ])
  expect(clientArgv('linux', '/repo', ['lazygit'], ['xterm', '-e'])).toEqual(['xterm', '-e', 'lazygit'])
  expect(clientArgv('linux', '/repo', ['lazygit'])).toBe(undefined)
})

for (const surface of ['terminal', 'desktop'] as const) {
  test(`the Git section draws the repository and the branch opens the client (${surface})`, async ($, on) => {
    const clock = mock.clock(on, { now: 1_700_000_600_000 })
    const spawned: string[][] = []
    const toasts: string[] = []
    const run = (stdout: string, exitCode = 0) =>
      ({ value: { exitCode, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }) as never
    on('session.start', async (_, e) => ({ cwd: e.cwd }))
    on('command.register', async (_, e) => ({ value: { command: e.name } }))
    on('tool.register', async (_, e) => ({ value: { tool: `mcp__session-info__${e.name}` } }) as never)
    on('session.messages', async () => ({ value: [] }) as never)
    on('session.cwd', async () => ({ value: 'D:/repo' }))
    on('session.usage', async () => ({ value: { startedAt: 0, context: {}, rateLimits: [] } }) as never)
    on('agent.list', async () => ({ value: [] }))
    on('env.get', async (_, e) => ({ value: e.name === 'OS' ? 'Windows_NT' : undefined }))
    on('fs.exists', async () => ({ value: false }))
    on('ui.toast', async (_, e) => (toasts.push(String(e.text)), { value: undefined }))
    on('process.run', async (_, e) => {
      const argv = e.argv.join(' ')
      if (argv.startsWith('git rev-parse')) return run('D:/repo\nD:/repo/.git\n')
      if (argv.startsWith('git status --porcelain=v2')) return run(STATUS)
      if (argv.startsWith('git log -1')) return run('a1b2c3d\0feat: add the Git section\x001700000000\n')
      if (argv === 'where lazygit') return run('C:\\bin\\lazygit.exe\n')

      return run('', 128)
    })
    on('process.spawn', async function* (_, e) {
      spawned.push([...e.argv])
      return { value: { code: 0, signal: null } }
    })

    await $.session.start({ cwd: 'D:/repo', surface, isInteractive: true })
    await clock.settle()

    const ui = await $.ui.mount({ ...PANE, surface, viewport: { columns: 100, rows: 60 } })
    expect(await ui.find({ type: 'Button', key: 'git-client' })).toBeDefined()
    expect(await ui.find({ text: /⎇ main ↑2 ↓1/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: '● 3 staged' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: 'feat: add the Git section' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /^\d+[smhdwy]$/ })).toBeDefined()

    await ui.press({ key: 'git-client' })
    expect(toasts).toEqual([])
    expect(spawned).toEqual([['cmd', '/c', 'start', 'Git client', '/D', 'D:\\repo', 'lazygit']])
    await ui.unmount()
  })
}

test('outside a repository the section says so and draws no client button', async ($, on) => {
  const clock = mock.clock(on)
  on('session.start', async (_, e) => ({ cwd: e.cwd }))
  on('command.register', async (_, e) => ({ value: { command: e.name } }))
  on('session.cwd', async () => ({ value: '/tmp' }))
  on('session.usage', async () => ({ value: { startedAt: 0, context: {}, rateLimits: [] } }) as never)
  on('agent.list', async () => ({ value: [] }))
  on('process.run', async () => ({ value: { exitCode: 128, stdout: '', stderr: 'fatal', isStdoutTruncated: false, isStderrTruncated: false } }) as never)

  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true })
  await clock.settle()

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal', viewport: { columns: 100, rows: 60 } })
  expect(await ui.find({ type: 'Text', text: 'Not a Git repository.' })).toBeDefined()
  expect(await ui.findAll({ type: 'Button', key: 'git-client' })).toEqual([])
  await ui.unmount()
})
