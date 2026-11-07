import type { GitItem } from '../types'

import { hash, keyOf, norm, relativeTo } from './paths'

/** One submodule the parent reports as changed, by the flags of `git status --porcelain=v2`. */
export type SubmoduleState = { path: string; hasNewCommit: boolean; hasChanges: boolean; hasUntracked: boolean }

/** The state of one repository as `git status --porcelain=v2 --branch -z` reports it. */
export type RepoStatus = {
  /** The branch, or null when HEAD is detached. */
  branch: string | null
  upstream: string | null
  ahead: number
  behind: number
  /** Tracked paths with changes, staged or not, submodules left out. */
  changed: string[]
  submodules: SubmoduleState[]
  hasCommits: boolean
}

/** The argv that reads a repository's state; untracked files stay out, as the Files section lists them. */
export const STATUS_ARGV = ['git', 'status', '--porcelain=v2', '--branch', '-z', '--untracked-files=no', '--ignore-submodules=none']

/** The argv that finds the top folder of the repository that holds `dir`. */
export const rootArgv = (dir: string): string[] => ['git', '-C', dir, 'rev-parse', '--show-toplevel']

/** The argv that lists which of `paths` (relative to the root) Git tracks. */
export const trackedArgv = (paths: string[]): string[] => ['git', 'ls-files', '-z', '--', ...paths]

/** Reads `git status --porcelain=v2 --branch -z`. */
export function parseStatus(text: string): RepoStatus {
  const status: RepoStatus = { branch: null, upstream: null, ahead: 0, behind: 0, changed: [], submodules: [], hasCommits: true }
  const fields = text.split('\0')
  for (let i = 0; i < fields.length; i++) {
    const line = fields[i] ?? ''
    if (line.startsWith('# branch.oid ')) status.hasCommits = line.slice(13) !== '(initial)'
    else if (line.startsWith('# branch.head ')) {
      const head = line.slice(14)
      status.branch = head === '(detached)' ? null : head
    } else if (line.startsWith('# branch.upstream ')) status.upstream = line.slice(18)
    else if (line.startsWith('# branch.ab ')) {
      const match = /^\+(\d+) -(\d+)$/.exec(line.slice(12))
      status.ahead = Number(match?.[1] ?? 0)
      status.behind = Number(match?.[2] ?? 0)
    } else if (/^[12u] /.test(line)) {
      const parts = line.split(' ')
      const sub = parts[2] ?? 'N...'
      const pathAt = line[0] === '1' ? 8 : line[0] === '2' ? 9 : 10
      const path = parts.slice(pathAt).join(' ')
      if (line[0] === '2') i += 1
      if (sub.startsWith('S')) {
        status.submodules.push({ path, hasNewCommit: sub[1] === 'C', hasChanges: sub[2] === 'M', hasUntracked: sub[3] === 'U' })
      } else status.changed.push(path)
    }
  }

  return status
}

const plural = (count: number, one: string, many: string): string => `${count} ${count === 1 ? one : many}`

/** What a submodule holds that the person may want to fix. */
function submoduleText(sub: SubmoduleState, inner: RepoStatus | undefined): string {
  const parts: string[] = []
  if (sub.hasNewCommit) parts.push('a commit the parent does not record')
  if (sub.hasChanges) parts.push('uncommitted changes')
  if (sub.hasUntracked) parts.push('untracked files')
  if (inner !== undefined && sub.hasNewCommit && inner.branch === null) parts.push('a detached HEAD')
  if (inner !== undefined && inner.branch !== null && inner.upstream !== null && inner.ahead > 0) {
    parts.push(`${plural(inner.ahead, 'commit', 'commits')} not pushed`)
  }

  return `submodule ${sub.path}: ${parts.join(', ')}`
}

const itemOf = (repo: string, kind: string, text: string): GitItem => ({ id: `g${hash(`${repo}\n${kind}`)}`, repo: norm(repo), text })

/** The items of one repository; `inner` holds the state of each submodule with a new commit, by its path. */
export function gitItems(repo: string, status: RepoStatus, inner: Record<string, RepoStatus> = {}): GitItem[] {
  const items: GitItem[] = []
  if (status.changed.length > 0) {
    items.push(itemOf(repo, 'changes', `${plural(status.changed.length, 'tracked file', 'tracked files')} with uncommitted changes`))
  }
  for (const sub of status.submodules) items.push(itemOf(repo, `sub:${sub.path}`, submoduleText(sub, inner[sub.path])))
  if (status.branch === null) items.push(itemOf(repo, 'detached', 'HEAD is detached'))
  else if (status.upstream !== null && status.ahead > 0) {
    items.push(itemOf(repo, 'ahead', `${plural(status.ahead, 'commit', 'commits')} not pushed to ${status.upstream}`))
  } else if (status.upstream === null && status.hasCommits) {
    items.push(itemOf(repo, 'upstream', `branch ${status.branch} has no upstream, so its commits are not pushed`))
  }

  return items
}

/** The prompt that asks Claude to fix the chosen Git items, one line each, the repository relative to the session folder. */
export function fixPrompt(items: GitItem[], cwd: string): string {
  const lines = items.map(item => `- ${keyOf(item.repo) === keyOf(cwd) ? '.' : relativeTo(cwd, item.repo)}: ${item.text}`)

  return [
    'session-cleanup: fix these Git items that this session left. Check each one first, and ask me before you commit, push, discard changes or move a HEAD.',
    ...lines,
  ].join('\n')
}
