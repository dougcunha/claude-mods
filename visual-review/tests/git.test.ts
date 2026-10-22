import { expect, test } from 'claude-code/testing'

import { collect, diffHunks, mainBranch, parseHunks, parseNumstat } from '../hooks/git'
import type { Host } from '../hooks/host'

const ROOT = 'C:/work/shop'
const BASE = '540a81830da84d6bfb7a47bc4be3d229520b577b'
const HEAD_REF = 'feature/cart'

// Real output of Git 2.x on Windows: a binary file, a name with a space, and a staged rename with edits.
const NUMSTAT = '-\t-\timg.bin\x001\t0\tmy file.cs\x002\t1\t\x00old.ts\x00new.ts\x00'
const UNTRACKED = 'raw.dat\x00un tracked.py\x00'
// `git diff --no-index --numstat -z -- /dev/null <path>`: Git prints /dev/null as `nul` on Windows, as a rename.
const NO_INDEX_TEXT = '3\t0\t\x00nul\x00un tracked.py\x00'
const NO_INDEX_BINARY = '-\t-\t\x00nul\x00raw.dat\x00'

type Answers = Record<string, { exitCode?: number; stdout?: string }>

/** A Git that answers each argv (joined by spaces) from `answers`, and exits with 128 for any other; it records each argv. */
function fakeGit(answers: Answers): { host: Host; ran: string[] } {
  const ran: string[] = []
  const host = {
    cwd: async () => ROOT,
    run: async (argv: string[]) => {
      const command = argv.join(' ')
      ran.push(command)
      const answer = answers[command]

      return { exitCode: answer?.exitCode ?? (answer === undefined ? 128 : 0), stdout: answer?.stdout ?? '' }
    },
  } as unknown as Host

  return { host, ran }
}

const repo = (extra: Answers): Answers => ({
  'git rev-parse --show-toplevel': { stdout: `${ROOT}\n` },
  'git rev-parse --abbrev-ref HEAD': { stdout: `${HEAD_REF}\n` },
  ...extra,
})

test('TC-04 numstat keeps a binary file with null counts, a name with spaces, and a rename once under its new path', () => {
  expect(parseNumstat(NUMSTAT)).toEqual([
    { path: 'img.bin', added: null, removed: null, isUntracked: false },
    { path: 'my file.cs', added: 1, removed: 0, isUntracked: false },
    { path: 'new.ts', oldPath: 'old.ts', added: 2, removed: 1, isUntracked: false },
  ])
})

test('TC-04 numstat reads nothing from empty or malformed output', () => {
  expect(parseNumstat('')).toEqual([])
  expect(parseNumstat('fatal: bad revision\n')).toEqual([])
})

test('TC-02 the default base is the merge-base with the target of origin/HEAD, and untracked files are added with Git counts', async () => {
  const { host, ran } = fakeGit(
    repo({
      'git symbolic-ref --short refs/remotes/origin/HEAD': { stdout: 'origin/main\n' },
      'git rev-parse --verify --quiet origin/main^{commit}': { stdout: 'abc\n' },
      'git merge-base HEAD origin/main': { stdout: `${BASE}\n` },
      [`git diff --numstat -z -M ${BASE}`]: { stdout: NUMSTAT },
      'git ls-files --others --exclude-standard -z': { stdout: UNTRACKED },
      'git diff --no-index --numstat -z -- /dev/null raw.dat': { exitCode: 1, stdout: NO_INDEX_BINARY },
      'git diff --no-index --numstat -z -- /dev/null un tracked.py': { exitCode: 1, stdout: NO_INDEX_TEXT },
    }),
  )

  const result = await collect(host, '')

  expect(result).toEqual({
    isOk: true,
    value: {
      root: ROOT,
      branch: HEAD_REF,
      base: BASE,
      baseLabel: 'origin/main',
      files: [
        ...parseNumstat(NUMSTAT),
        { path: 'raw.dat', added: null, removed: null, isUntracked: true },
        { path: 'un tracked.py', added: 3, removed: 0, isUntracked: true },
      ],
    },
  })
  expect(ran).toEqual([
    'git rev-parse --show-toplevel',
    'git symbolic-ref --short refs/remotes/origin/HEAD',
    'git rev-parse --verify --quiet origin/main^{commit}',
    'git merge-base HEAD origin/main',
    `git diff --numstat -z -M ${BASE}`,
    'git ls-files --others --exclude-standard -z',
    'git diff --no-index --numstat -z -- /dev/null raw.dat',
    'git diff --no-index --numstat -z -- /dev/null un tracked.py',
    'git rev-parse --abbrev-ref HEAD',
  ])
})

const MAIN_CASES = [
  ['origin/HEAD', { 'git symbolic-ref --short refs/remotes/origin/HEAD': { stdout: 'origin/trunk\n' }, 'git rev-parse --verify --quiet origin/trunk^{commit}': {} }, 'origin/trunk'],
  ['main', { 'git rev-parse --verify --quiet main^{commit}': {}, 'git rev-parse --verify --quiet master^{commit}': {} }, 'main'],
  ['master', { 'git rev-parse --verify --quiet master^{commit}': {} }, 'master'],
  ['none', {}, null],
] as const

for (const [name, answers, expected] of MAIN_CASES) {
  test(`TC-02 the main branch comes from ${name}`, async () => {
    const { host } = fakeGit(answers)

    expect(await mainBranch(host, ROOT)).toBe(expected)
  })
}

test('a repository with no main branch asks for a base', async () => {
  const { host } = fakeGit(repo({}))

  expect(await collect(host, '')).toEqual({ isOk: false, error: { kind: 'no-main' } })
})

test('FR-03 a named base is resolved to its commit and keeps its name as the label', async () => {
  const { host } = fakeGit(
    repo({
      'git rev-parse --verify --quiet HEAD~1^{commit}': { stdout: `${BASE}\n` },
      [`git diff --numstat -z -M ${BASE}`]: { stdout: '1\t0\tmy file.cs\x00' },
      'git ls-files --others --exclude-standard -z': {},
    }),
  )

  const result = await collect(host, 'HEAD~1')

  expect(result.isOk && { base: result.value.base, label: result.value.baseLabel }).toEqual({ base: BASE, label: 'HEAD~1' })
})

test('FR-03 a base that starts with a dash is an unknown reference, never an option of git', async () => {
  const { host, ran } = fakeGit(repo({ 'git rev-parse --verify --quiet --all^{commit}': { stdout: `${BASE}\n` } }))

  expect(await collect(host, '--all')).toEqual({ isOk: false, error: { kind: 'unknown-ref', ref: '--all' } })
  expect(ran).toEqual(['git rev-parse --show-toplevel'])
})

// Real `git -c core.quotePath=false diff -U0 --no-color -M` output: a new file, a non-ASCII name, a deletion, a binary
// file, a name with spaces (Git ends its ---/+++ lines with a tab), and a rename with 2 hunks.
const HUNKS = [
  'diff --git a/added.ts b/added.ts',
  'new file mode 100644',
  'index 0000000..2fe4df4',
  '--- /dev/null',
  '+++ b/added.ts',
  '@@ -0,0 +1,2 @@',
  '+n1',
  '+n2',
  'diff --git a/ação.ts b/ação.ts',
  'index b68fde2..ab8f396 100644',
  '--- a/ação.ts',
  '+++ b/ação.ts',
  '@@ -1,0 +2 @@ k',
  '+l',
  'diff --git a/gone.py b/gone.py',
  'deleted file mode 100644',
  'index 988cd72..0000000',
  '--- a/gone.py',
  '+++ /dev/null',
  '@@ -1,2 +0,0 @@',
  '-gone1',
  '-gone2',
  'diff --git a/img.bin b/img.bin',
  'index bdc955b..8835708 100644',
  'Binary files a/img.bin and b/img.bin differ',
  'diff --git a/my file.cs b/my file.cs',
  'index b77b4eb..04ec35a 100644',
  '--- a/my file.cs\t',
  '+++ b/my file.cs\t',
  '@@ -2,0 +3 @@ y',
  '+z',
  'diff --git a/old.ts b/new.ts',
  'similarity index 66%',
  'rename from old.ts',
  'rename to new.ts',
  'index 9405325..91ac79b 100644',
  '--- a/old.ts',
  '+++ b/new.ts',
  '@@ -2 +2 @@ a',
  '-b',
  '+B',
  '@@ -5,0 +6 @@ e',
  '+f',
  '',
].join('\n')

// A removed SQL comment reads `--- old note`, like a file header line, inside the hunk.
const SQL_HUNK = ['diff --git a/schema.sql b/schema.sql', 'index 57bf7f8..e0d690b 100644', '--- a/schema.sql', '+++ b/schema.sql', '@@ -1,2 +1 @@', '--- old note', '-CREATE TABLE carts (id int);', '+CREATE TABLE carts (id int, total int);', ''].join('\n')

test('TC-04 -U0 hunks per file: a new and a deleted file, a name with spaces or accents, a rename, 0-length sides, and no binary hunks', () => {
  expect([...parseHunks(HUNKS)]).toEqual([
    ['added.ts', [{ oldStart: 0, oldCount: 0, newStart: 1, newCount: 2 }]],
    ['ação.ts', [{ oldStart: 1, oldCount: 0, newStart: 2, newCount: 1 }]],
    ['gone.py', [{ oldStart: 1, oldCount: 2, newStart: 0, newCount: 0 }]],
    ['my file.cs', [{ oldStart: 2, oldCount: 0, newStart: 3, newCount: 1 }]],
    [
      'new.ts',
      [
        { oldStart: 2, oldCount: 1, newStart: 2, newCount: 1 },
        { oldStart: 5, oldCount: 0, newStart: 6, newCount: 1 },
      ],
    ],
  ])
})

test('TC-04 a removed line that starts with --- stays a hunk line, not a file header', () => {
  expect([...parseHunks(SQL_HUNK)]).toEqual([['schema.sql', [{ oldStart: 1, oldCount: 2, newStart: 1, newCount: 1 }]]])
})

test('FR-10 the hunks come with the a/ and b/ prefixes forced, whatever diff.mnemonicPrefix or diff.noprefix says, and a folder named a keeps its name', async () => {
  const calls: string[][] = []
  const stdout = ['--- a/a/x.ts', '+++ b/a/x.ts', '@@ -1 +1 @@', '-old', '+new', ''].join('\n')
  const host = { run: async (argv: string[]) => (calls.push(argv), { exitCode: 0, stdout }) } as unknown as Host

  const hunks = await diffHunks(host, ROOT, BASE)

  expect(calls).toEqual([['git', '-c', 'core.quotePath=false', 'diff', '-U0', '--no-color', '-M', '--src-prefix=a/', '--dst-prefix=b/', BASE]])
  expect([...hunks.files]).toEqual([['a/x.ts', [{ oldStart: 1, oldCount: 1, newStart: 1, newCount: 1 }]]])
})
