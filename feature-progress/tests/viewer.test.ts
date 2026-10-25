import { expect, test } from 'claude-code/testing'

import type { Host } from '../hooks/host'
import { openArgv, openLink } from '../hooks/viewer'

const CWD = 'C:/repo'

type Recorded = { runs: string[][]; toasts: string[] }

/** A fake Host on `os`, where `files` exist and `code` is on the PATH when `hasCode`. */
function hostOf(os: 'Windows_NT' | 'Darwin' | 'Linux', files: string[], hasCode: boolean): Host & Recorded {
  const recorded: Recorded = { runs: [], toasts: [] }
  const host = {
    ...recorded,
    cwd: async () => CWD,
    exists: async (path: string) => files.includes(path),
    env: async () => ({ os: os === 'Windows_NT' ? os : undefined }),
    toast: (text: string) => void recorded.toasts.push(text),
    run: async (argv: string[]) => {
      recorded.runs.push(argv)
      if (argv[0] === 'uname') return { exitCode: 0, stdout: `${os}\n` }
      const isLookup = argv[0] === 'where' || argv.includes('command -v "$1"')
      return { exitCode: isLookup && !hasCode ? 1 : 0, stdout: '' }
    },
  }

  return host as unknown as Host & Recorded
}

test('TC-18 FR-15 the open argv per program and platform', () => {
  expect(openArgv('windows', 'vscode', 'C:/repo/a.md')).toEqual(['cmd', '/c', 'code', 'C:/repo/a.md'])
  expect(openArgv('windows', 'system', 'C:/repo/a.md')).toEqual(['explorer.exe', 'C:\\repo\\a.md'])
  expect(openArgv('mac', 'system', '/r/a.md')).toEqual(['open', '/r/a.md'])
  expect(openArgv('linux', 'system', '/r/a.md')).toEqual(['xdg-open', '/r/a.md'])
  expect(openArgv('linux', 'vscode', '/r/a.md')).toEqual(['code', '/r/a.md'])
})

test('TC-18 FR-15 auto opens a relative link in VS Code when code is on the PATH, else in the default program', async () => {
  const withCode = hostOf('Windows_NT', [`${CWD}/tasks/task_08.md`], true)
  const withoutCode = hostOf('Windows_NT', [`${CWD}/tasks/task_08.md`], false)

  await openLink(withCode, 'auto', 'tasks/task_08.md')
  await openLink(withoutCode, 'auto', 'tasks/task_08.md')

  expect(withCode.runs.at(-1)).toEqual(['cmd', '/c', 'code', `${CWD}/tasks/task_08.md`])
  expect(withoutCode.runs.at(-1)).toEqual(['explorer.exe', 'C:\\repo\\tasks\\task_08.md'])
})

test('TC-18 FR-15 system on Linux uses xdg-open without looking for code', async () => {
  const host = hostOf('Linux', ['/home/dev/a.md'], true)

  await openLink(host, 'system', '/home/dev/a.md')

  expect(host.runs).toEqual([['uname', '-s'], ['xdg-open', '/home/dev/a.md']])
})

test('TC-18 FR-15 a missing file toasts its path and starts nothing', async () => {
  const host = hostOf('Windows_NT', [], true)

  await openLink(host, 'vscode', 'tasks/none.md')

  expect(host.toasts).toEqual([`feature-progress: ${CWD}/tasks/none.md does not exist.`])
  expect(host.runs).toEqual([])
})

test('a link with a character cmd reads as syntax never reaches cmd /c code', async () => {
  const path = `${CWD}/a&calc.md`
  const host = hostOf('Windows_NT', [path], true)

  await openLink(host, 'vscode', path)

  expect(host.runs.some(argv => argv.includes('code'))).toBe(false)
  expect(host.toasts).toEqual(['feature-progress: the task link has a character cmd would read as a command; open the file by hand.'])
})
