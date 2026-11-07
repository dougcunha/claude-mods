import type { Created } from '../types'

import { baseName, isUnder, keyOf } from './paths'

/** Base names that look like temporary files: tmp, temp, scratch, debug_ and test output words, and backup or log suffixes. */
export const TEMP_NAME =
  /(^|[._-])(tmp|temp|scratch)([._-]|\d|$)|^debug[_-]|^test[_-]?(out|output)([._-]|$)|\.(log|bak|orig|rej|tmp|temp|swp|old)$|~$/i

export const isTempName = (path: string): boolean => TEMP_NAME.test(baseName(path))

/** The folders the mod never lists or removes, nor anything under the protected ones. */
export type Guard = {
  cwd: string
  /** The root of the repository that holds the session folder, when there is one. */
  cwdRepo: string | null
  home?: string
  /** The system temp folders: never listed themselves, their entries are. */
  temps: string[]
  /** Folders whose whole content is off limits: Claude Code's own folder in the home, the quarantine. */
  protectedTrees: string[]
}

/**
 * Whether a path must never be offered: the session folder, its repository, the home or a temp folder itself,
 * a folder that holds the session folder, anything under a protected tree, or Git's own data.
 */
export function isGuarded(path: string, guard: Guard): boolean {
  const key = keyOf(path)
  const exact = [guard.cwd, guard.cwdRepo, guard.home, ...guard.temps].filter((one): one is string => one !== undefined && one !== null)
  if (exact.some(one => keyOf(one) === key)) return true
  if (/(^|\/)\.git(\/|$)/i.test(key)) return true
  if (isUnder(path, guard.cwd)) return true

  return guard.protectedTrees.some(tree => isUnder(tree, path))
}

/**
 * Drops each entry that lies under another entry that is a folder, so a created folder is one item.
 * The order stays: folders first by depth is not needed, as the check is against the whole set.
 */
export function groupUnderFolders(entries: Created[]): Created[] {
  const folders = entries.filter(entry => entry.isFolder)

  return entries.filter(entry => !folders.some(folder => keyOf(folder.path) !== keyOf(entry.path) && isUnder(folder.path, entry.path)))
}

/** Merges new entries into the collected ones by path key; the first record of a path keeps its source and time. */
export function mergeCreated(all: Record<string, Created>, added: Created[]): Record<string, Created> {
  const next = { ...all }
  for (const entry of added) {
    const key = keyOf(entry.path)
    const known = next[key]
    next[key] = known === undefined ? entry : { ...known, isFolder: known.isFolder || entry.isFolder }
  }

  return next
}

/** The facts that judge one entry. */
export type Facts = { path: string; temps: string[]; repo: string | null; repoName?: string }

/** The tags of an entry and whether it is pre-selected (the temp folder, temp name and outside-repo signals). */
export function judge(facts: Facts): { tags: string[]; isLikelyTemp: boolean } {
  const tags: string[] = []
  const isInTemp = facts.temps.some(temp => isUnder(temp, facts.path))
  const hasTempName = isTempName(facts.path)
  const isOutside = facts.repo === null
  if (isInTemp) tags.push('temp folder')
  if (hasTempName) tags.push('temp name')
  if (isOutside && !isInTemp) tags.push('outside repos')
  if (!isOutside) tags.push(`untracked in ${facts.repoName ?? baseName(facts.repo ?? '')}`)

  return { tags, isLikelyTemp: isInTemp || hasTempName || isOutside }
}
