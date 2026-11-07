import { expect, test } from 'claude-code/testing'

import type { FileItem } from '../types'

import { outcomeLines, reasonOf } from '../hooks/apply'
import { entriesOf, groupRows } from '../hooks/scan'
import { groupUnderFolders, isGuarded, isTempName, judge, mergeCreated } from '../hooks/candidates'
import type { Guard } from '../hooks/candidates'
import { cutLeft, rowName, shownPath } from '../hooks/pane'
import { deleteArgv, expiredRuns, isPurgeable, moveArgv, quarantinedPath, trashArgv } from '../hooks/remove'

const guard: Guard = {
  cwd: 'D:/work/app/src',
  cwdRepo: 'D:/work/app',
  home: 'C:/Users/me',
  temps: ['C:/Users/me/AppData/Local/Temp'],
  protectedTrees: ['C:/Users/me/.claude'],
}

test('temporary names: tmp, temp and scratch words, debug_ and test output prefixes, backup and log suffixes', () => {
  for (const name of ['tmp.txt', 'out.tmp', 'my-temp-file.json', 'scratch', 'debug_dump.json', 'test_out.txt', 'run.log', 'a.ts.orig', 'b.bak', 'notes.md~']) {
    expect(isTempName(`/x/${name}`)).toBe(true)
  }
  for (const name of ['template.html', 'temperature.ts', 'README.md', 'catalog.ts']) expect(isTempName(`/x/${name}`)).toBe(false)
})

test('guarded paths: the session folder, its repository and their parents, the home, the temp folders, ~/.claude and .git', () => {
  for (const path of ['D:/work/app/src', 'D:/work/app', 'D:/work', 'C:/Users/me', 'c:/users/me/appdata/local/temp', 'C:/Users/me/.claude/projects/x/memory/a.md', 'D:/x/.git/index']) {
    expect(isGuarded(path, guard)).toBe(true)
  }
  for (const path of ['D:/work/app/src/tmp.txt', 'C:/Users/me/AppData/Local/Temp/probe.txt', 'C:/Users/me/notes.txt']) {
    expect(isGuarded(path, guard)).toBe(false)
  }
})

test('entries under a created folder are one item; merge keeps the first record of a path', () => {
  const entries = [
    { path: 'D:/t/venv', isFolder: true, source: 'shell' as const, at: 1 },
    { path: 'D:/t/venv/bin/python', isFolder: false, source: 'shell' as const, at: 2 },
    { path: 'D:/t/venvy.txt', isFolder: false, source: 'shell' as const, at: 3 },
  ]
  expect(groupUnderFolders(entries).map(entry => entry.path)).toEqual(['D:/t/venv', 'D:/t/venvy.txt'])

  const merged = mergeCreated({}, [entries[1]!, { ...entries[1]!, source: 'session-info', at: 9 }])
  expect(Object.values(merged)).toEqual([entries[1]])
})

test('judge pre-selects a temp folder, a temp name or a path outside every repository', () => {
  const temps = guard.temps
  expect(judge({ path: 'C:/Users/me/AppData/Local/Temp/x.txt', temps, repo: null })).toEqual({ tags: ['temp folder'], isLikelyTemp: true })
  expect(judge({ path: 'D:/work/app/notes.md', temps, repo: 'D:/work/app' })).toEqual({ tags: ['untracked in app'], isLikelyTemp: false })
  expect(judge({ path: 'D:/work/app/debug_out.json', temps, repo: 'D:/work/app' })).toEqual({ tags: ['temp name', 'untracked in app'], isLikelyTemp: true })
  expect(judge({ path: 'E:/data/report.csv', temps, repo: null })).toEqual({ tags: ['outside repos'], isLikelyTemp: true })
})

test('removal argv quotes the path for each platform', () => {
  expect(trashArgv('windows', "C:/a/it's.txt", false)).toEqual([
    'powershell',
    '-NoProfile',
    '-NonInteractive',
    '-Command',
    "Add-Type -AssemblyName Microsoft.VisualBasic; [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile('C:\\a\\it''s.txt', 'OnlyErrorDialogs', 'SendToRecycleBin')",
  ])
  expect(trashArgv('linux', '/tmp/a b', true)).toEqual(['gio', 'trash', '--', '/tmp/a b'])
  expect(trashArgv('mac', '/tmp/"x"', false)).toEqual(['osascript', '-e', 'tell application "Finder" to delete POSIX file "/tmp/\\"x\\""'])
  expect(moveArgv('linux', '/tmp/a', '/q/1-a')).toEqual(['mv', '--', '/tmp/a', '/q/1-a'])
  expect(deleteArgv('linux', '/q/1')).toEqual(['rm', '-rf', '--', '/q/1'])
  expect(quarantinedPath('/q/run', 0, 'D:/x/out.log')).toBe('/q/run/1-out.log')
})

test('the purge takes only run folders older than the limit, and only under the quarantine root', () => {
  const now = Date.UTC(2026, 10, 2)
  const old = String(now - 8 * 86_400_000)
  const young = String(now - 86_400_000)
  expect(expiredRuns('/q', [old, young, 'notes'], now, 7)).toEqual([`/q/${old}`])
  expect(isPurgeable('/q', `/q/${old}`)).toBe(true)
  expect(isPurgeable('/q', '/q')).toBe(false)
  expect(isPurgeable('/q', '/qx/1')).toBe(false)
})

const row = (path: string, extra: Partial<FileItem> = {}): FileItem => ({
  id: path,
  path,
  isFolder: false,
  size: 10,
  isSizeAtLeast: false,
  tags: [],
  isLikelyTemp: false,
  isOther: false,
  ...extra,
})

test('certain temp rows of one folder fold into 1 row; the temp scan rows always fold; the others stay', () => {
  const rows = groupRows([
    row('/pad/a.txt', { tags: ['scratchpad'], isLikelyTemp: true }),
    row('/pad/b', { tags: ['scratchpad'], isLikelyTemp: true, isFolder: true, size: 5, isSizeAtLeast: true }),
    row('/tmp/one.txt', { tags: ['temp folder'], isLikelyTemp: true }),
    row('/tmp/x.tmp', { isOther: true }),
    row('/tmp/y.tmp', { isOther: true }),
    row('/repo/notes.md', { tags: ['untracked in repo'] }),
  ])

  expect(rows.map(one => [one.path, one.members?.length ?? 0, one.size, one.isSizeAtLeast, one.isLikelyTemp, one.tags])).toEqual([
    ['/repo/notes.md', 0, 10, false, false, ['untracked in repo']],
    ['/pad', 2, 15, true, true, ['scratchpad']],
    ['/tmp/one.txt', 0, 10, false, true, ['temp folder']],
    ['/tmp', 2, 20, false, false, ['other programs write here too']],
  ])
  expect(entriesOf(rows[1]!).map(one => [one.path, one.isFolder, one.members])).toEqual([
    ['/pad/a.txt', false, undefined],
    ['/pad/b', true, undefined],
  ])
  expect(rowName(rows[1]!)).toBe('2 entries in pad/')
})

test('more than 3 failures with one reason read as one line with the count', () => {
  const failed = ['/t/1', '/t/2', '/t/3', '/t/4'].map(path => ({ path, reason: 'in use by another program' }))
  expect(outcomeLines({ removed: ['/t/0'], quarantined: [], failed: [...failed, { path: '/t/5', reason: 'access denied' }] }, 'delete')).toEqual([
    'Deleted: 1',
    '✗ 4 entries: in use by another program',
    '✗ 5: access denied',
  ])
})

test('a failure reads as a short reason', () => {
  expect(reasonOf('Exception: The process cannot access the file because it is being used by another process.')).toBe('in use by another program')
  expect(reasonOf('rm: cannot remove x: Permission denied')).toBe('access denied')
  expect(reasonOf('\nweird failure\nAt line:1 char:2')).toBe('weird failure')
  expect(reasonOf('')).toBe('the command left it in place')
})

test('the pane shows paths relative to the session folder or the home, cut from the left', () => {
  expect(shownPath('D:/work/app/src/tmp/a.txt', 'D:/work/app/src', 'C:/Users/me')).toBe('tmp/a.txt')
  expect(shownPath('C:/Users/me/AppData/x.txt', 'D:/work', 'C:/Users/me')).toBe('~/AppData/x.txt')
  expect(cutLeft('abcdefghij', 5)).toBe('…ghij')
})
