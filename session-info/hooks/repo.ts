import type { Operation, Repo, Submodule, SubmoduleIssue, Upstream } from '../types'

import type { Host } from './host'
import { norm } from './paths'

const ISSUE_ORDER: readonly SubmoduleIssue[] = ['conflict', 'uninitialized', 'commit', 'modified']

/** What `git status --porcelain=v2 --branch -z` says: the branch, its upstream, the counts and the changed submodules. */
export type StatusV2 = Pick<Repo, 'branch' | 'head' | 'upstream' | 'counts'> & { submodules: Map<string, Set<SubmoduleIssue>> }

const addIssue = (all: Map<string, Set<SubmoduleIssue>>, path: string, issue: SubmoduleIssue): void => {
  const issues = all.get(path) ?? new Set<SubmoduleIssue>()
  issues.add(issue)
  all.set(path, issues)
}

/** Submodule entries go to `submodules`, not to the counts: the section shows them on their own rows. */
export function parseStatus(stdout: string): StatusV2 {
  let branch: string | null = null
  let head: string | null = null
  let hasUpstream = false
  let ab: { ahead: number; behind: number } | undefined
  const counts = { staged: 0, modified: 0, untracked: 0, conflicts: 0 }
  const submodules = new Map<string, Set<SubmoduleIssue>>()

  const fields = stdout.split('\0')
  for (let i = 0; i < fields.length; i++) {
    const field = fields[i] ?? ''
    const parts = field.split(' ')
    const kind = parts[0]
    if (kind === '#') {
      const value = parts.slice(2).join(' ')
      if (parts[1] === 'branch.oid') head = value === '(initial)' ? null : value.slice(0, 7)
      else if (parts[1] === 'branch.head') branch = value === '(detached)' ? null : value
      else if (parts[1] === 'branch.upstream') hasUpstream = true
      else if (parts[1] === 'branch.ab') ab = { ahead: Math.abs(Number(parts[2])), behind: Math.abs(Number(parts[3])) }
      continue
    }
    if (kind === '?') counts.untracked++
    if (kind !== '1' && kind !== '2' && kind !== 'u') continue

    const xy = parts[1] ?? '..'
    const sub = parts[2] ?? 'N...'
    const path = parts.slice(kind === '1' ? 8 : kind === '2' ? 9 : 10).join(' ')
    if (kind === '2') i++
    if (sub.startsWith('S')) {
      if (kind === 'u') addIssue(submodules, path, 'conflict')
      if (sub[1] === 'C') addIssue(submodules, path, 'commit')
      if (sub[2] === 'M' || sub[3] === 'U') addIssue(submodules, path, 'modified')
      continue
    }
    if (kind === 'u') counts.conflicts++
    else {
      if (xy[0] !== '.') counts.staged++
      if (xy[1] !== '.') counts.modified++
    }
  }

  const upstream: Upstream = !hasUpstream ? 'none' : ab === undefined ? 'gone' : ab

  return { branch, head, upstream, counts, submodules }
}

/** `git submodule status`: every submodule path, and the ones not initialized, out of step or in conflict. */
export function parseSubmoduleStatus(stdout: string): { paths: string[]; issues: Map<string, Set<SubmoduleIssue>> } {
  const paths: string[] = []
  const issues = new Map<string, Set<SubmoduleIssue>>()
  for (const line of stdout.split(/\r?\n/)) {
    if (line.length < 3) continue
    const match = /^[0-9a-f]+ (.*?)(?: \(.*\))?$/.exec(line.slice(1))
    if (!match?.[1]) continue
    const path = match[1]
    paths.push(path)
    if (line[0] === '-') addIssue(issues, path, 'uninitialized')
    else if (line[0] === '+') addIssue(issues, path, 'commit')
    else if (line[0] === 'U') addIssue(issues, path, 'conflict')
  }

  return { paths, issues }
}

export function mergeSubmodules(paths: readonly string[], ...sources: Map<string, Set<SubmoduleIssue>>[]): Repo['submodules'] {
  const all = new Map<string, Set<SubmoduleIssue>>()
  for (const source of sources) for (const [path, issues] of source) for (const issue of issues) addIssue(all, path, issue)
  const changed: Submodule[] = [...all.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([path, issues]) => ({ path, issues: ISSUE_ORDER.filter(issue => issues.has(issue)) }))

  return { total: Math.max(paths.length, changed.length), changed }
}

/** `%h%x00%s%x00%ct` of `git log -1`; null for a repository with no commit yet. */
export function parseCommit(stdout: string): Repo['commit'] {
  const [hash, subject, seconds] = stdout.replace(/\r?\n$/, '').split('\0')
  if (!hash || seconds === undefined) return null

  return { hash, subject: subject ?? '', at: Number(seconds) * 1_000 }
}

const readNumber = async (host: Host, path: string): Promise<number | undefined> => {
  const text = await host.readFile(path).catch(() => '')
  const value = Number.parseInt(text.trim(), 10)

  return Number.isFinite(value) ? value : undefined
}

/** The merge, rebase, cherry-pick, revert or bisect that stopped halfway, from the files git keeps while it waits. */
export async function readOperation(host: Host, gitDir: string): Promise<Operation | null> {
  const at = (name: string) => `${gitDir}/${name}`
  if (await host.exists(at('rebase-merge'))) {
    return { kind: 'rebase', step: await readNumber(host, at('rebase-merge/msgnum')), total: await readNumber(host, at('rebase-merge/end')) }
  }
  if (await host.exists(at('rebase-apply'))) {
    return { kind: 'rebase', step: await readNumber(host, at('rebase-apply/next')), total: await readNumber(host, at('rebase-apply/last')) }
  }
  if (await host.exists(at('MERGE_HEAD'))) return { kind: 'merge' }
  if (await host.exists(at('CHERRY_PICK_HEAD'))) return { kind: 'cherry-pick' }
  if (await host.exists(at('REVERT_HEAD'))) return { kind: 'revert' }
  if (await host.exists(at('BISECT_LOG'))) return { kind: 'bisect' }

  return null
}

/** The repository of the session's folder, or null outside one. Runs 3 git commands, 4 with submodules. */
export async function readRepo(host: Host, now: number): Promise<Repo | null> {
  const where = await host.run(['git', 'rev-parse', '--show-toplevel', '--absolute-git-dir'])
  if (where.exitCode !== 0) return null
  const [top, dir] = where.stdout.split(/\r?\n/)
  if (!top || !dir) return null
  const root = norm(top.trim())
  const gitDir = norm(dir.trim())

  const status = await host.run(['git', 'status', '--porcelain=v2', '--branch', '-z'], root)
  if (status.exitCode !== 0) return null
  const parsed = parseStatus(status.stdout)
  const log = await host.run(['git', 'log', '-1', '--format=%h%x00%s%x00%ct'], root)
  const listed = (await host.exists(`${root}/.gitmodules`))
    ? parseSubmoduleStatus((await host.run(['git', 'submodule', 'status'], root)).stdout)
    : { paths: [], issues: new Map<string, Set<SubmoduleIssue>>() }

  return {
    root,
    branch: parsed.branch,
    head: parsed.head,
    upstream: parsed.upstream,
    counts: parsed.counts,
    commit: log.exitCode === 0 ? parseCommit(log.stdout) : null,
    operation: await readOperation(host, gitDir),
    submodules: mergeSubmodules(listed.paths, listed.issues, parsed.submodules),
    at: now,
  }
}

const ISSUE_TEXT: Record<SubmoduleIssue, string> = {
  conflict: 'conflict',
  uninitialized: 'not initialized',
  commit: 'new commit',
  modified: 'modified',
}

export const ISSUE_COLOR: Record<SubmoduleIssue, string | undefined> = {
  conflict: 'error',
  uninitialized: undefined,
  commit: 'suggestion',
  modified: 'warning',
}

export const issueText = (issue: SubmoduleIssue): string => ISSUE_TEXT[issue]

/** The header's right side: `main ↑2 ↓1`, `main · local only`, `detached a1b2c3d`. */
export function branchText(repo: Repo): string {
  const name = repo.branch ?? `detached ${repo.head ?? ''}`.trim()
  if (repo.branch === null) return name
  if (repo.upstream === 'none') return `${name} · local only`
  if (repo.upstream === 'gone') return `${name} · upstream gone`
  const arrows = [repo.upstream.ahead > 0 && `↑${repo.upstream.ahead}`, repo.upstream.behind > 0 && `↓${repo.upstream.behind}`].filter(Boolean)

  return arrows.length === 0 ? name : `${name} ${arrows.join(' ')}`
}

/** `Rebase in progress: step 3 of 7`. */
export function operationText(operation: Operation): string {
  const name = operation.kind === 'cherry-pick' ? 'Cherry-pick' : `${operation.kind[0]?.toUpperCase()}${operation.kind.slice(1)}`
  const step = operation.step !== undefined && operation.total !== undefined ? `: step ${operation.step} of ${operation.total}` : ''

  return `${name} in progress${step}`
}

/** The non-zero working-tree counts, in the order git status reads them. */
export function countParts(counts: Repo['counts']): { key: string; text: string; color: string }[] {
  return [
    { key: 'conflicts', text: `✖ ${counts.conflicts} conflict${counts.conflicts === 1 ? '' : 's'}`, color: 'error', count: counts.conflicts },
    { key: 'staged', text: `● ${counts.staged} staged`, color: 'success', count: counts.staged },
    { key: 'modified', text: `✎ ${counts.modified} modified`, color: 'warning', count: counts.modified },
    { key: 'untracked', text: `? ${counts.untracked} untracked`, color: 'suggestion', count: counts.untracked },
  ]
    .filter(part => part.count > 0)
    .map(({ key, text, color }) => ({ key, text, color }))
}

export const SUBMODULE_ROWS = 5

/** 45s, 12m, 3h, 2d, 5w, 1y. */
export function age(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1_000))
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 14) return `${days}d`
  if (days < 365) return `${Math.floor(days / 7)}w`

  return `${Math.floor(days / 365)}y`
}

/** How many rows the open section draws, so the Changes tree below keeps its room; the last commit row is always there. */
export function repoRowCount(repo: Repo | 'outside' | null): number {
  if (repo === null || repo === 'outside') return 1
  const submoduleRows =
    repo.submodules.total === 0 ? 0 : 1 + Math.min(repo.submodules.changed.length, SUBMODULE_ROWS) + (repo.submodules.changed.length > SUBMODULE_ROWS ? 1 : 0)

  return Math.max(1, (repo.operation ? 1 : 0) + (countParts(repo.counts).length > 0 ? 1 : 0) + 1 + submoduleRows)
}
