import type { Feature, Kind, Task } from '../types'

/** The fields that name a stage: the kind, the flow's own label, and the round. */
export type Staged = { state: Kind; label?: string; round?: number }

/** The tasks of one group in the pane; `name` is undefined for the tasks without a group. */
export type TaskGroup = { name: string | undefined; tasks: Task[] }

/** The open features, latest first, and the done ones, latest first. */
export type Ordered = { open: Feature[]; done: Feature[] }

const MINUTE_MS = 60_000
const HOUR_MINUTES = 60
const DAY_MINUTES = 24 * HOUR_MINUTES

/** The marker the band and the pane add to a stale feature (FR-14). */
export const STALE_MARKER = '⚠ stale'

/** The character a shortened title ends with. */
const ELLIPSIS = '…'

/** The stage as the band and the pane show it: the label, else the kind, then `#round` (FR-09). */
export function stageText(item: Staged): string {
  const name = item.label ?? item.state

  return item.round === undefined ? name : `${name} #${item.round}`
}

/** The stage of a task row: the kind and `#round`, then the flow's label, so the word for the kind always shows (FR-12, NFR-04). */
export function kindText(item: Staged): string {
  const kind = item.round === undefined ? item.state : `${item.state} #${item.round}`

  return item.label === undefined ? kind : `${kind} · ${item.label}`
}

/** Tasks done out of all tasks, correction tasks included (FR-13). */
export function countOf(feature: Feature): { done: number; total: number } {
  return { done: feature.tasks.filter(task => task.state === 'done').length, total: feature.tasks.length }
}

/** The tool's answer to a stored report (FR-08). */
export function replyText(feature: Feature): string {
  const { done, total } = countOf(feature)

  return `feature-progress: ${stageText(feature)} · ${done}/${total}`
}

const timeOf = (iso: string | undefined): number => {
  const time = iso === undefined ? Number.NaN : Date.parse(iso)

  return Number.isNaN(time) ? 0 : time
}

const byLatest = (a: Feature, b: Feature): number => timeOf(b.updatedAt) - timeOf(a.updatedAt)

/** Open features latest first, and done features latest first (FR-11). */
export function orderFeatures(features: Record<string, Feature>): Ordered {
  const all = Object.values(features)

  return { open: all.filter(feature => feature.state !== 'done').sort(byLatest), done: all.filter(feature => feature.state === 'done').sort(byLatest) }
}

/** The open feature updated last, which the band shows (FR-09). */
export const latestOpen = (features: Record<string, Feature>): Feature | undefined => orderFeatures(features).open[0]

/** Whether an open feature, not waiting on a person, went longer than `minutes` without a report; 0 turns it off (FR-14). */
export function isStale(feature: Feature, now: number, minutes: number): boolean {
  if (minutes <= 0 || feature.state === 'done' || feature.state === 'waiting') return false

  return now - timeOf(feature.updatedAt) > minutes * MINUTE_MS
}

/** The tasks without a group first, then one block per group in the order each first appears (FR-12). */
export function groupTasks(tasks: Task[]): TaskGroup[] {
  const names: string[] = []
  for (const task of tasks) if (task.group !== undefined && !names.includes(task.group)) names.push(task.group)
  const loose = tasks.filter(task => task.group === undefined)
  const groups = names.map(name => ({ name, tasks: tasks.filter(task => task.group === name) }))

  return loose.length === 0 ? groups : [{ name: undefined, tasks: loose }, ...groups]
}

/** A span of whole minutes as `5 min`, `2 h 10 min` or `3 d`. */
function spanText(minutes: number): string {
  if (minutes < HOUR_MINUTES) return `${minutes} min`
  if (minutes < DAY_MINUTES) {
    const rest = minutes % HOUR_MINUTES
    return rest === 0 ? `${Math.floor(minutes / HOUR_MINUTES)} h` : `${Math.floor(minutes / HOUR_MINUTES)} h ${rest} min`
  }

  return `${Math.floor(minutes / DAY_MINUTES)} d`
}

/** How long ago a time was: `just now` under a minute, else `5 min ago`. */
export function agoText(iso: string, now: number): string {
  const minutes = Math.floor((now - timeOf(iso)) / MINUTE_MS)

  return minutes < 1 ? 'just now' : `${spanText(minutes)} ago`
}

/** How long a task ran: from `startedAt` to `finishedAt`, or to now while it runs; empty before it started. */
export function durationText(task: Task, now: number): string {
  if (task.startedAt === undefined) return ''
  const end = task.finishedAt === undefined ? now : timeOf(task.finishedAt)
  const minutes = Math.floor((end - timeOf(task.startedAt)) / MINUTE_MS)

  return minutes < 1 ? '<1 min' : spanText(minutes)
}

/** A title cut to `width` characters with an ellipsis; at least the ellipsis stays (NFR-05). */
export function fitTitle(title: string, width: number): string {
  const characters = [...title]
  if (characters.length <= width) return title

  return `${characters.slice(0, Math.max(0, width - 1)).join('')}${ELLIPSIS}`
}

/** The characters of a meter: the done share, and the rest. */
export const METER_FILLED = '━'
export const METER_EMPTY = '─'

/** Cells of the meter in the band and in a task row; the pane's feature meter takes the width it has. */
export const METER_CELLS = 8

/** How many of `cells` a meter fills for `done` out of `total`; an empty total fills none (FR-12, FR-13). */
export function filledCells(done: number, total: number, cells: number): number {
  if (total <= 0 || cells <= 0) return 0

  return Math.round((Math.min(Math.max(done, 0), total) / total) * cells)
}

/** The done share as a whole percent, such as `71%`; an empty total is `0%`. */
export function percentText(done: number, total: number): string {
  return `${total <= 0 ? 0 : Math.floor((Math.min(done, total) / total) * 100)}%`
}
