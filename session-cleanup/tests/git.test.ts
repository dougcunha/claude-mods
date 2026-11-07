import { expect, test } from 'claude-code/testing'

import { fixPrompt, gitItems, parseStatus } from '../hooks/git'

const z = (...lines: string[]): string => `${lines.join('\0')}\0`

test('parseStatus reads the branch, the upstream, ahead and behind, tracked changes and submodule flags', () => {
  const status = parseStatus(
    z(
      '# branch.oid 1234',
      '# branch.head main',
      '# branch.upstream origin/main',
      '# branch.ab +2 -1',
      '1 .M N... 100644 100644 100644 abc abc src/a file.ts',
      '2 R. N... 100644 100644 100644 abc abc R100 new.ts',
      'old.ts',
      '1 .M SC.U 160000 160000 160000 abc abc libs/core',
    ),
  )

  expect(status).toEqual({
    branch: 'main',
    upstream: 'origin/main',
    ahead: 2,
    behind: 1,
    changed: ['src/a file.ts', 'new.ts'],
    submodules: [{ path: 'libs/core', hasNewCommit: true, hasChanges: false, hasUntracked: true }],
    hasCommits: true,
  })
})

test('gitItems lists changes, submodules, a detached HEAD, unpushed commits and a missing upstream', () => {
  const detached = parseStatus(z('# branch.oid 1', '# branch.head (detached)', '1 M. N... 1 1 1 a a x.ts'))
  expect(gitItems('/r', detached).map(item => item.text)).toEqual(['1 tracked file with uncommitted changes', 'HEAD is detached'])

  const ahead = parseStatus(z('# branch.oid 1', '# branch.head main', '# branch.upstream origin/main', '# branch.ab +3 -0'))
  expect(gitItems('/r', ahead).map(item => item.text)).toEqual(['3 commits not pushed to origin/main'])

  const local = parseStatus(z('# branch.oid 1', '# branch.head topic'))
  expect(gitItems('/r', local).map(item => item.text)).toEqual(['branch topic has no upstream, so its commits are not pushed'])

  const clean = parseStatus(z('# branch.oid 1', '# branch.head main', '# branch.upstream origin/main', '# branch.ab +0 -0'))
  expect(gitItems('/r', clean)).toEqual([])
})

test('a submodule with a new commit reports its own detached HEAD and unpushed commits', () => {
  const parent = parseStatus(z('# branch.oid 1', '# branch.head main', '# branch.upstream o/main', '# branch.ab +0 -0', '1 .M SC.. 1 1 1 a a sub'))
  const inner = parseStatus(z('# branch.oid 2', '# branch.head (detached)'))

  expect(gitItems('/r', parent, { sub: inner }).map(item => item.text)).toEqual(['submodule sub: a commit the parent does not record, a detached HEAD'])
})

test('item ids are stable per repository and kind', () => {
  const status = parseStatus(z('# branch.oid 1', '# branch.head (detached)'))

  expect(gitItems('/r', status)[0]?.id).toBe(gitItems('/r', status)[0]?.id)
  expect(gitItems('/r', status)[0]?.id).not.toBe(gitItems('/other', status)[0]?.id)
})

test('fixPrompt names each repository relative to the session folder and asks before risky steps', () => {
  const text = fixPrompt(
    [
      { id: 'a', repo: 'D:/work/app', text: 'HEAD is detached' },
      { id: 'b', repo: 'D:/work/app/libs/core', text: '1 commit not pushed to origin/main' },
      { id: 'c', repo: 'E:/other', text: 'branch x has no upstream, so its commits are not pushed' },
    ],
    'D:/work/app',
  )

  expect(text).toBe(
    [
      'session-cleanup: fix these Git items that this session left. Check each one first, and ask me before you commit, push, discard changes or move a HEAD.',
      '- .: HEAD is detached',
      '- libs/core: 1 commit not pushed to origin/main',
      '- E:/other: branch x has no upstream, so its commits are not pushed',
    ].join('\n'),
  )
})
