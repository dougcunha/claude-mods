import type { Created, FileItem, GitItem, Scan } from '../types'

import { groupUnderFolders, isGuarded, judge } from './candidates'
import type { Guard } from './candidates'
import { gitItems, parseStatus, rootArgv, STATUS_ARGV, trackedArgv } from './git'
import type { RepoStatus } from './git'
import type { Env, Host } from './host'
import { absolute, hash, keyOf, norm, parentOf, relativeTo } from './paths'
import { quarantineRoot } from './remove'

/** A folder's size is summed over at most this many entries; past it the size reads as a lower bound. */
export const SIZE_ENTRY_LIMIT = 2000

/** A temp folder scan looks at no more than this many entries. */
const TEMP_ENTRY_LIMIT = 1000

/** What the scan starts from. */
export type ScanInput = {
  /** The paths the session created, from session-info and the shell commands. */
  created: Created[]
  /** Every path the session touched, created, modified or deleted: each one's repository is checked. */
  touched: string[]
  /** When the mod first loaded in this process: a temp entry changed since then is listed. */
  since: number
  sessionIds: string[]
  env: Env
  now: number
}

/** Where a listed path came from: it decides the pre-selection. */
type Origin = 'created' | 'temp' | 'scratchpad'

type Found = { path: string; isFolder: boolean; origin: Origin }

/** The repository root of each folder, read once per folder. */
function rootFinder(host: Host): (dir: string) => Promise<string | null> {
  const cache = new Map<string, Promise<string | null>>()

  return dir => {
    const key = keyOf(dir)
    const known = cache.get(key)
    if (known !== undefined) return known
    const found = host
      .run(rootArgv(dir))
      .then(ran => (ran.exitCode === 0 && ran.stdout.trim() !== '' ? norm(ran.stdout.trim()) : null))
      .catch(() => null)
    cache.set(key, found)

    return found
  }
}

/** The entries of the temp folders changed since `since`; Claude Code's own `claude` folder is left out. */
async function tempEntries(host: Host, temps: string[], since: number): Promise<Found[]> {
  const found: Found[] = []
  for (const temp of temps) {
    const entries = await host.list(temp).catch(() => [])
    for (const entry of entries.slice(0, TEMP_ENTRY_LIMIT)) {
      if (entry.name.toLowerCase() === 'claude') continue
      const path = `${norm(temp)}/${entry.name}`
      const isFolder = entry.kind === 'directory'
      const mtime = isFolder ? (await host.stat(path).catch(() => undefined))?.mtimeMs ?? 0 : entry.mtimeMs
      if (mtime >= since) found.push({ path, isFolder, origin: 'temp' })
    }
  }

  return found
}

/**
 * The entries of each scratchpad folder of the session ids, at `<temp>/claude/<project>/<session id>/scratchpad`.
 * The location is what Claude Code uses today, not a documented API: when it moves, this finds nothing.
 */
async function scratchpadEntries(host: Host, temps: string[], sessionIds: string[]): Promise<Found[]> {
  const found: Found[] = []
  for (const temp of temps) {
    const projects = await host.list(`${norm(temp)}/claude`).catch(() => [])
    for (const project of projects.filter(one => one.kind === 'directory')) {
      for (const id of sessionIds) {
        const pad = `${norm(temp)}/claude/${project.name}/${id}/scratchpad`
        const entries = await host.list(pad).catch(() => [])
        for (const entry of entries) found.push({ path: `${pad}/${entry.name}`, isFolder: entry.kind === 'directory', origin: 'scratchpad' })
      }
    }
  }

  return found
}

/** The size of a path; a folder's is summed over at most SIZE_ENTRY_LIMIT entries. */
async function sizeOf(host: Host, path: string, isFolder: boolean): Promise<{ size: number; isAtLeast: boolean }> {
  if (!isFolder) return { size: (await host.stat(path).catch(() => undefined))?.size ?? 0, isAtLeast: false }
  let size = 0
  let seen = 0
  const queue = [path]
  while (queue.length > 0) {
    const dir = queue.shift() ?? ''
    for (const entry of await host.list(dir).catch(() => [])) {
      seen += 1
      if (seen > SIZE_ENTRY_LIMIT) return { size, isAtLeast: true }
      if (entry.kind === 'directory') queue.push(`${dir}/${entry.name}`)
      else size += entry.size
    }
  }

  return { size, isAtLeast: false }
}

/** The paths of `paths` (under `repo`) that Git tracks; a folder counts as tracked when Git tracks anything in it. */
async function trackedOf(host: Host, repo: string, paths: string[]): Promise<Set<string>> {
  if (paths.length === 0) return new Set()
  const relative = paths.map(path => relativeTo(repo, path))
  const ran = await host.run(trackedArgv(relative), repo).catch(() => ({ exitCode: 1, stdout: '' }))
  if (ran.exitCode !== 0) return new Set()
  const listed = ran.stdout.split('\0').filter(Boolean).map(one => keyOf(absolute(repo, one)))

  return new Set(paths.filter(path => listed.some(one => one === keyOf(path) || one.startsWith(`${keyOf(path)}/`))).map(keyOf))
}

/** The Files section: what the session created and is still there, untracked, outside the guarded folders. */
async function fileItems(host: Host, input: ScanInput, guard: Guard, rootOf: (dir: string) => Promise<string | null>): Promise<FileItem[]> {
  const temps = input.env.temps
  const found = new Map<string, Found>()
  const add = (one: Found): void => {
    if (!found.has(keyOf(one.path))) found.set(keyOf(one.path), one)
  }
  input.created.forEach(entry => add({ path: entry.path, isFolder: entry.isFolder, origin: 'created' }))
  ;(await scratchpadEntries(host, temps, input.sessionIds)).forEach(add)
  ;(await tempEntries(host, temps, input.since)).forEach(add)

  const present: Found[] = []
  for (const one of found.values()) {
    if (isGuarded(one.path, guard)) continue
    const stat = await host.stat(one.path).catch(() => undefined)
    if (stat !== undefined) present.push({ ...one, isFolder: stat.kind === 'directory' })
  }
  const grouped = groupUnderFolders(present.map(one => ({ path: one.path, isFolder: one.isFolder, source: 'shell', at: 0 })))
  const kept = present.filter(one => grouped.some(entry => keyOf(entry.path) === keyOf(one.path)))

  const repoOf = new Map<string, string | null>()
  for (const one of kept) repoOf.set(keyOf(one.path), await rootOf(parentOf(one.path)))
  const byRepo = new Map<string, string[]>()
  for (const one of kept) {
    const repo = repoOf.get(keyOf(one.path))
    if (repo) byRepo.set(repo, [...(byRepo.get(repo) ?? []), one.path])
  }
  const tracked = new Set<string>()
  for (const [repo, paths] of byRepo) (await trackedOf(host, repo, paths)).forEach(key => tracked.add(key))

  const items: FileItem[] = []
  for (const one of kept) {
    if (tracked.has(keyOf(one.path))) continue
    const repo = repoOf.get(keyOf(one.path)) ?? null
    const judged = judge({ path: one.path, temps, repo })
    // Another program's folder in the temp folder is not walked: the row of those entries shows a lower bound.
    const size = one.origin === 'temp' && one.isFolder ? { size: 0, isAtLeast: true } : await sizeOf(host, one.path, one.isFolder)
    const byOrigin =
      one.origin === 'scratchpad'
        ? { tags: ['scratchpad'], isLikelyTemp: true }
        : one.origin === 'temp'
          ? { tags: [], isLikelyTemp: false }
          : judged
    items.push({
      id: `f${hash(keyOf(one.path))}`,
      path: norm(one.path),
      isFolder: one.isFolder,
      size: size.size,
      isSizeAtLeast: size.isAtLeast,
      ...byOrigin,
      isOther: one.origin === 'temp',
    })
  }

  return groupRows(items).sort((a, b) => Number(a.isOther) - Number(b.isOther) || Number(b.isLikelyTemp) - Number(a.isLikelyTemp) || a.path.localeCompare(b.path))
}

/** The tag of the row of entries only the temp folder scan found. */
export const OTHER_TAG = 'other programs write here too'

/** One row for several entries of one folder; the folder itself is never removed. */
function groupRow(folder: string, kind: string, members: FileItem[], extra: Pick<FileItem, 'tags' | 'isLikelyTemp' | 'isOther'>): FileItem {
  return {
    id: `d${hash(`${keyOf(folder)}\n${kind}`)}`,
    path: norm(folder),
    isFolder: true,
    size: members.reduce((sum, member) => sum + member.size, 0),
    isSizeAtLeast: members.some(member => member.isSizeAtLeast),
    ...extra,
    members: members.map(member => ({ path: member.path, isFolder: member.isFolder })),
  }
}

/**
 * Folds the rows that are temporary for certain (the scratchpad, and what the session created in a temp folder)
 * into 1 row per folder when a folder holds 2 or more, and every entry only the temp scan found into 1 row per folder.
 */
export function groupRows(items: FileItem[]): FileItem[] {
  const byFolder = (list: FileItem[]): Map<string, FileItem[]> => {
    const map = new Map<string, FileItem[]>()
    for (const item of list) map.set(keyOf(parentOf(item.path)), [...(map.get(keyOf(parentOf(item.path))) ?? []), item])
    return map
  }
  const isCertain = (item: FileItem): boolean => !item.isOther && (item.tags.includes('scratchpad') || item.tags.includes('temp folder'))
  const rows = items.filter(item => !item.isOther && !isCertain(item))
  for (const members of byFolder(items.filter(isCertain)).values()) {
    const folder = parentOf(members[0]?.path ?? '')
    if (members.length < 2) rows.push(...members)
    else rows.push(groupRow(folder, 'certain', members, { tags: [...new Set(members.flatMap(member => member.tags))], isLikelyTemp: true, isOther: false }))
  }
  for (const members of byFolder(items.filter(item => item.isOther)).values()) {
    rows.push(groupRow(parentOf(members[0]?.path ?? ''), 'other', members, { tags: [OTHER_TAG], isLikelyTemp: false, isOther: true }))
  }

  return rows
}

/** The entries a row stands for: its members, or the row itself. */
export function entriesOf(item: FileItem): FileItem[] {
  const { members, ...row } = item
  if (members === undefined) return [item]

  return members.map(member => ({ ...row, id: `${item.id}:${member.path}`, path: member.path, isFolder: member.isFolder }))
}

/** The state of the repository at `root`, or undefined when Git cannot read it. */
async function statusOf(host: Host, root: string): Promise<RepoStatus | undefined> {
  const ran = await host.run(STATUS_ARGV, root).catch(() => undefined)

  return ran === undefined || ran.exitCode !== 0 ? undefined : parseStatus(ran.stdout)
}

/** The Git section: the repository of the session folder and of every path the session touched. */
async function gitSection(host: Host, input: ScanInput, cwdRepo: string | null, rootOf: (dir: string) => Promise<string | null>): Promise<GitItem[]> {
  const repos = new Map<string, string>()
  if (cwdRepo !== null) repos.set(keyOf(cwdRepo), cwdRepo)
  for (const path of input.touched) {
    const root = await rootOf(parentOf(path))
    if (root !== null && !repos.has(keyOf(root))) repos.set(keyOf(root), root)
  }
  const items: GitItem[] = []
  for (const root of repos.values()) {
    const status = await statusOf(host, root)
    if (status === undefined) continue
    const inner: Record<string, RepoStatus> = {}
    for (const sub of status.submodules.filter(one => one.hasNewCommit)) {
      const subStatus = await statusOf(host, absolute(root, sub.path))
      if (subStatus !== undefined) inner[sub.path] = subStatus
    }
    items.push(...gitItems(root, status, inner))
  }

  return items
}

/** Scans the files and the repositories of the session. */
export async function scan(host: Host, input: ScanInput): Promise<Scan> {
  const cwd = norm(await host.cwd())
  const rootOf = rootFinder(host)
  const cwdRepo = await rootOf(cwd)
  const home = input.env.home === undefined ? undefined : norm(input.env.home)
  const guard: Guard = {
    cwd,
    cwdRepo,
    ...(home === undefined ? {} : { home }),
    temps: input.env.temps,
    protectedTrees: home === undefined ? [] : [`${home}/.claude`, quarantineRoot(home)],
  }
  const files = await fileItems(host, input, guard, rootOf)
  const git = await gitSection(host, input, cwdRepo, rootOf)

  return { files, git, at: input.now }
}

/** The ids a fresh scan pre-selects: the likely temporary files; no Git item. */
export const preselected = (scanned: Scan): string[] => scanned.files.filter(item => item.isLikelyTemp).map(item => item.id)
