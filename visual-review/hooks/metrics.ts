import type { ChangedFile, Hunk } from './git'
import type { Range, Relation, Unit } from './model'

/** Lines added and removed; null when Git gives no count (a binary file, a cut diff). */
export type Delta = { added: number | null; removed: number | null }

/** The coupling of a unit: Ce, the distinct units it depends on, and Ca, the distinct units that depend on it. */
export type Coupling = { ce: number; ca: number }

const UNKNOWN: Delta = { added: null, removed: null }

/** The lines both ranges share, both ends included. */
const overlap = (start: number, count: number, range: Range): number => Math.max(0, Math.min(start + count - 1, range.end) - Math.max(start, range.start) + 1)

/** The added lines of the hunks inside `range` of the current file. */
export const addedIn = (hunks: readonly Hunk[], range: Range): number => hunks.reduce((sum, hunk) => sum + overlap(hunk.newStart, hunk.newCount, range), 0)

/** The removed lines of the hunks inside `range` of the base file. */
export const removedIn = (hunks: readonly Hunk[], range: Range): number => hunks.reduce((sum, hunk) => sum + overlap(hunk.oldStart, hunk.oldCount, range), 0)

/**
 * The hunks of a file Git does not track, which `git diff` leaves out: the whole file is added, so it is 1 hunk of its
 * line count, or none for a binary file.
 */
export const untrackedHunks = (file: ChangedFile): Hunk[] =>
  file.added === null || file.added === 0 ? [] : [{ oldStart: 0, oldCount: 0, newStart: 1, newCount: file.added }]

/**
 * The lines a unit added and removed (FR-10): the hunks inside its range in the current file, and inside its base range
 * (its range for a deleted unit) in the base file. A context unit, or a file with unknown hunks, has no delta.
 */
export function unitDelta(unit: Unit, hunks: readonly Hunk[] | undefined): Delta {
  if (unit.state === 'context' || unit.range === undefined || hunks === undefined) return UNKNOWN
  if (unit.state === 'deleted') return { added: 0, removed: removedIn(hunks, unit.range) }

  return { added: addedIn(hunks, unit.range), removed: unit.baseRange === undefined ? 0 : removedIn(hunks, unit.baseRange) }
}

/** The lines of a file's hunks that no unit range covers, so the units plus the rest give the file's own delta. */
export function restDelta(units: readonly Unit[], hunks: readonly Hunk[] | undefined): Delta {
  if (hunks === undefined) return UNKNOWN
  const live = units.filter(unit => unit.state !== 'context' && unit.range !== undefined)
  const isNewCovered = (line: number): boolean => live.some(unit => unit.state !== 'deleted' && unit.range !== undefined && line >= unit.range.start && line <= unit.range.end)
  const baseRanges = live.flatMap(baseRangeOf)
  let added = 0
  let removed = 0
  for (const hunk of hunks) {
    for (let line = hunk.newStart; line < hunk.newStart + hunk.newCount; line++) if (!isNewCovered(line)) added++
    for (let line = hunk.oldStart; line < hunk.oldStart + hunk.oldCount; line++) if (!baseRanges.some(range => line >= range.start && line <= range.end)) removed++
  }

  return { added, removed }
}

/** The lines a unit holds in the base file: its range when deleted, its base range when modified, none when added. */
function baseRangeOf(unit: Unit): Range[] {
  if (unit.state === 'deleted') return unit.range === undefined ? [] : [unit.range]

  return unit.baseRange === undefined ? [] : [unit.baseRange]
}

/** Ce and Ca of each unit (FR-11): live relations only (not removed), no self relation, each pair of units counted once. */
export function coupling(unitIds: readonly string[], relations: readonly Relation[]): Map<string, Coupling> {
  const pairs = new Set(relations.filter(relation => relation.state !== 'removed' && relation.from !== relation.to).map(relation => `${relation.from}\n${relation.to}`))
  const result = new Map<string, Coupling>(unitIds.map(id => [id, { ce: 0, ca: 0 }]))
  for (const pair of pairs) {
    const [from = '', to = ''] = pair.split('\n')
    const source = result.get(from)
    const target = result.get(to)
    if (source !== undefined) result.set(from, { ...source, ce: source.ce + 1 })
    if (target !== undefined) result.set(to, { ...target, ca: target.ca + 1 })
  }

  return result
}

/** The total lines of a unit: its range, or its base range for a deleted unit; null for a context unit. */
export const unitLines = (unit: Unit): number | null => (unit.range === undefined ? null : unit.range.end - unit.range.start + 1)
