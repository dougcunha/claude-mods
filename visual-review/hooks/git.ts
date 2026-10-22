import type { Host } from './host'
import { norm } from './paths'

/** One changed file against the base: the new path of a rename and its old one, and its line counts, null for a binary file. */
export type ChangedFile = { path: string; oldPath?: string; added: number | null; removed: number | null; isUntracked: boolean }

/** What a run compares: the repository root, its branch, the base commit with the name the person reads, and the changed files. */
export type Collection = { root: string; branch: string; base: string; baseLabel: string; files: ChangedFile[] }

/** Why a run stops before the analysis; each kind has the text `commandText` answers with. */
export type CollectError =
  | { kind: 'not-repo' }
  | { kind: 'unknown-ref'; ref: string }
  | { kind: 'no-main' }
  | { kind: 'no-base'; main: string }
  | { kind: 'git-failed'; exitCode: number }
  | { kind: 'empty'; baseLabel: string }

export type CollectResult = { isOk: true; value: Collection } | { isOk: false; error: CollectError }

type Base = { commit: string; label: string }

/** The branches tried for the default base after the target of `origin/HEAD`, in this order (FR-02). */
const MAIN_CANDIDATES = ['main', 'master'] as const

/** One `--numstat -z` record: added, removed, then the path, or an empty path when a rename's two paths follow. */
const NUMSTAT_RECORD = /^(\d+|-)\t(\d+|-)\t(.*)$/s

const fail = (error: CollectError): CollectResult => ({ isOk: false, error })

const count = (text: string): number | null => (text === '-' ? null : Number(text))

/** Parses `git diff --numstat -z -M`: one entry per file, a rename once under its new path, a binary file with null counts. */
export function parseNumstat(stdout: string): ChangedFile[] {
  const fields = stdout.split('\0')
  const files: ChangedFile[] = []
  for (let i = 0; i < fields.length; i++) {
    const match = NUMSTAT_RECORD.exec(fields[i] ?? '')
    if (match === null) continue
    const [, added = '-', removed = '-', path = ''] = match
    const counts = { added: count(added), removed: count(removed), isUntracked: false }
    if (path !== '') {
      files.push({ path, ...counts })
      continue
    }
    const oldPath = fields[i + 1] ?? ''
    const newPath = fields[i + 2] ?? ''
    i += 2
    if (newPath !== '') files.push({ path: newPath, oldPath, ...counts })
  }

  return files
}

/** Parses a NUL-separated path list, such as `git ls-files -z`. */
export const parsePaths = (stdout: string): string[] => stdout.split('\0').filter(path => path !== '')

async function isCommit(host: Host, root: string, ref: string): Promise<boolean> {
  return (await host.run(['git', 'rev-parse', '--verify', '--quiet', `${ref}^{commit}`], root)).exitCode === 0
}

/** The main branch: the target of `origin/HEAD`, else `main`, else `master`; null when none of them is a commit. */
export async function mainBranch(host: Host, root: string): Promise<string | null> {
  const origin = await host.run(['git', 'symbolic-ref', '--short', 'refs/remotes/origin/HEAD'], root)
  const candidates = origin.exitCode === 0 ? [origin.stdout.trim(), ...MAIN_CANDIDATES] : [...MAIN_CANDIDATES]
  for (const candidate of candidates) if (candidate !== '' && (await isCommit(host, root, candidate))) return candidate

  return null
}

async function defaultBase(host: Host, root: string): Promise<Base | CollectError> {
  const main = await mainBranch(host, root)
  if (main === null) return { kind: 'no-main' }
  const mergeBase = await host.run(['git', 'merge-base', 'HEAD', main], root)
  if (mergeBase.exitCode !== 0) return { kind: 'no-base', main }

  return { commit: mergeBase.stdout.trim(), label: main }
}

async function namedBase(host: Host, root: string, ref: string): Promise<Base | CollectError> {
  // A leading dash would read as an option of rev-parse, not as a reference.
  if (ref.startsWith('-')) return { kind: 'unknown-ref', ref }
  const resolved = await host.run(['git', 'rev-parse', '--verify', '--quiet', `${ref}^{commit}`], root)
  if (resolved.exitCode !== 0) return { kind: 'unknown-ref', ref }

  return { commit: resolved.stdout.trim(), label: ref }
}

/** The line counts of a file Git does not track, from Git itself so they match the tracked files; null counts on a failure. */
async function untrackedFile(host: Host, root: string, path: string): Promise<ChangedFile> {
  // Git reads the literal /dev/null as an empty file on every platform, and exits with 1 when it lists a difference.
  const diff = await host.run(['git', 'diff', '--no-index', '--numstat', '-z', '--', '/dev/null', path], root)
  const [counts] = diff.exitCode <= 1 ? parseNumstat(diff.stdout) : []

  return { path, added: counts?.added ?? null, removed: counts?.removed ?? null, isUntracked: true }
}

/**
 * Collects what `/visual-review [ref]` compares: the base (the merge-base of HEAD and the main branch, or `ref`), and
 * the committed, staged, unstaged and untracked changes against it. Every Git command is read-only.
 */
export async function collect(host: Host, ref: string): Promise<CollectResult> {
  const top = await host.run(['git', 'rev-parse', '--show-toplevel'], await host.cwd())
  if (top.exitCode !== 0) return fail({ kind: 'not-repo' })
  const root = norm(top.stdout.trim())
  const base = ref === '' ? await defaultBase(host, root) : await namedBase(host, root, ref)
  if ('kind' in base) return fail(base)
  const files = await changedFiles(host, root, base.commit)
  if (!Array.isArray(files)) return fail(files)
  if (files.length === 0) return fail({ kind: 'empty', baseLabel: base.label })
  const branch = await host.run(['git', 'rev-parse', '--abbrev-ref', 'HEAD'], root)

  return { isOk: true, value: { root, branch: branch.exitCode === 0 ? branch.stdout.trim() : 'HEAD', base: base.commit, baseLabel: base.label, files } }
}

/** The committed, staged, unstaged and untracked files that changed against `base`, with their Git line counts. */
export async function changedFiles(host: Host, root: string, base: string): Promise<ChangedFile[] | CollectError> {
  const numstat = await host.run(['git', 'diff', '--numstat', '-z', '-M', base], root)
  if (numstat.exitCode !== 0) return { kind: 'git-failed', exitCode: numstat.exitCode }
  const others = await host.run(['git', 'ls-files', '--others', '--exclude-standard', '-z'], root)
  if (others.exitCode !== 0) return { kind: 'git-failed', exitCode: others.exitCode }
  const untracked: ChangedFile[] = []
  for (const path of parsePaths(others.stdout)) untracked.push(await untrackedFile(host, root, path))

  return [...parseNumstat(numstat.stdout), ...untracked]
}

/** One `-U0` hunk: the removed lines start at `oldStart` in the base file, the added lines at `newStart` in the current one. */
export type Hunk = { oldStart: number; oldCount: number; newStart: number; newCount: number }

/** The hunks of each changed file, by its current path (its base path when deleted); `isTruncated` when Git's output was cut. */
export type DiffHunks = { files: Map<string, Hunk[]>; isTruncated: boolean }

/** A `-U0` hunk header; a side whose count is left out has 1 line. */
const HUNK_HEADER = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/

/** A `---` or `+++` line: the side's path after its `a/` or `b/` prefix, or `/dev/null`. */
const SIDE_LINE = /^(?:---|\+\+\+) (.*?)\t?$/

/** Undoes Git's C-style quoting of a path with special characters (`"a/say \"hi\".ts"`). */
function unquote(path: string): string {
  if (!(path.startsWith('"') && path.endsWith('"'))) return path
  const escapes: Record<string, string> = { n: '\n', t: '\t', '"': '"', '\\': '\\' }

  return path.slice(1, -1).replace(/\\(["\\nt])/g, (_, char: string) => escapes[char] ?? char)
}

const sidePath = (raw: string): string | null => {
  const path = unquote(raw)

  return path === '/dev/null' ? null : path.replace(/^[ab]\//, '')
}

/** Parses `git diff -U0 --no-color -M`: the hunks per file, skipping each hunk's own lines by its counts. */
export function parseHunks(stdout: string): Map<string, Hunk[]> {
  const files = new Map<string, Hunk[]>()
  let oldPath: string | null = null
  let current: Hunk[] | undefined
  let linesLeft = 0
  for (const line of stdout.split('\n')) {
    if (linesLeft > 0 && (line.startsWith('+') || line.startsWith('-'))) {
      linesLeft--
      continue
    }
    const side = SIDE_LINE.exec(line)
    if (side !== null && line.startsWith('---')) oldPath = sidePath(side[1] ?? '')
    if (side !== null && line.startsWith('+++')) {
      const path = sidePath(side[1] ?? '') ?? oldPath
      current = path === null ? undefined : (files.get(path) ?? [])
      if (path !== null && current !== undefined) files.set(path, current)
      continue
    }
    const header = HUNK_HEADER.exec(line)
    if (header === null || current === undefined) continue
    const [, oldStart = '0', oldCount = '1', newStart = '0', newCount = '1'] = header
    const hunk = { oldStart: Number(oldStart), oldCount: Number(oldCount), newStart: Number(newStart), newCount: Number(newCount) }
    current.push(hunk)
    linesLeft = hunk.oldCount + hunk.newCount
  }

  return files
}

/**
 * The `-U0` hunks of the change against `base`; quotePath off keeps non-ASCII names as they are, and the forced `a/` and
 * `b/` prefixes override the person's `diff.mnemonicPrefix` or `diff.noprefix`, so `sidePath` strips a known prefix.
 */
export async function diffHunks(host: Host, root: string, base: string): Promise<DiffHunks> {
  const diff = await host.run(['git', '-c', 'core.quotePath=false', 'diff', '-U0', '--no-color', '-M', '--src-prefix=a/', '--dst-prefix=b/', base], root)
  if (diff.exitCode !== 0) return { files: new Map(), isTruncated: true }

  return { files: parseHunks(diff.stdout), isTruncated: diff.isStdoutTruncated === true }
}

/** The text the command answers with: the cause of a stop, or the analysis it starts with the count of changed files. */
export function commandText(result: CollectResult): string {
  if (result.isOk) {
    const { files, baseLabel } = result.value

    return `Analyzing the design of ${files.length} changed ${files.length === 1 ? 'file' : 'files'} against ${baseLabel}.`
  }
  const { error } = result
  switch (error.kind) {
    case 'not-repo':
      return 'visual-review needs a Git repository.'
    case 'unknown-ref':
      return `Unknown Git reference: ${error.ref}.`
    case 'no-main':
      return 'No main branch found (origin/HEAD, main or master). Name a base: /visual-review <ref>.'
    case 'no-base':
      return `No common commit with ${error.main}. Name a base: /visual-review <ref>.`
    case 'git-failed':
      return `visual-review: git diff failed with exit code ${error.exitCode}.`
    case 'empty':
      return `No changes against ${error.baseLabel}.`
  }
}
