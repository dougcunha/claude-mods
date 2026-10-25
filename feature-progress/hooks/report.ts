import type { Feature, Kind, Steps, Task } from '../types'

/** The 9 kinds, in the order the pane sorts them. */
export const KINDS = ['pending', 'planning', 'active', 'review', 'fixing', 'qa', 'waiting', 'blocked', 'done'] as const satisfies readonly Kind[]

/** A feature id: lower case letters, digits and `-`, so it is a safe file name on every file system (DEC-04). */
export const FEATURE_ID = /^[a-z0-9][a-z0-9-]{0,63}$/

/** The longest task id. */
export const TASK_ID_MAX = 64

/** The version of the stored file this mod writes. */
export const SCHEMA_VERSION = 1

const CONTROL_CHARACTER = /[\u0000-\u001f\u007f]/

/** A change to the fields a feature and a task share; `null` clears an optional field. */
export type ItemPatch = {
  id: string
  title?: string
  state?: Kind
  label?: string | null
  round?: number | null
  note?: string | null
}

/** A change to one task. */
export type TaskPatch = ItemPatch & {
  group?: string | null
  steps?: Steps | null
  link?: string | null
}

/** A validated tool input. */
export type Report = { feature: ItemPatch; tasks: TaskPatch[]; remove: string[] }

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

const isKind = (value: unknown): value is Kind => typeof value === 'string' && (KINDS as readonly string[]).includes(value)

const isWhole = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value)

/** Readers for the fields of one input object; each failure is pushed to `errors` with the field's path. */
function readerOf(source: Record<string, unknown>, path: string, errors: string[]) {
  const fail = (key: string, message: string): undefined => {
    errors.push(`${path}.${key} ${message}`)
    return undefined
  }

  /** A string field; an empty string clears it (`null`). */
  const text = (key: string): string | null | undefined => {
    const value = source[key]
    if (value === undefined) return undefined
    if (typeof value !== 'string') return fail(key, 'must be a string')

    return value.trim() === '' ? null : value
  }

  const title = (): string | undefined => {
    const value = source.title
    if (value === undefined) return undefined
    if (typeof value !== 'string' || value.trim() === '') return fail('title', 'must be a non-empty string')

    return value
  }

  const state = (): Kind | undefined => {
    const value = source.state
    if (value === undefined) return undefined
    if (!isKind(value)) return fail('state', `must be one of: ${KINDS.join(', ')}`)

    return value
  }

  const round = (): number | null | undefined => {
    const value = source.round
    if (value === undefined || value === null) return value
    if (!isWhole(value) || value < 1) return fail('round', 'must be a whole number of 1 or more, or null')

    return value
  }

  const steps = (): Steps | null | undefined => {
    const value = source.steps
    if (value === undefined || value === null) return value
    const isValid = isRecord(value) && isWhole(value.done) && isWhole(value.total) && value.total >= 1 && value.done >= 0 && value.done <= value.total
    if (!isValid) return fail('steps', 'must be { done, total } with whole numbers, total of 1 or more and done between 0 and total, or null')

    return { done: Number(value.done), total: Number(value.total) }
  }

  return { text, title, state, round, steps }
}

function itemOf(source: Record<string, unknown>, path: string, errors: string[]): ItemPatch {
  const read = readerOf(source, path, errors)
  const id = typeof source.id === 'string' ? source.id : ''

  return { id, title: read.title(), state: read.state(), label: read.text('label'), round: read.round(), note: read.text('note') }
}

function featureOf(value: unknown, errors: string[]): ItemPatch | undefined {
  if (!isRecord(value)) {
    errors.push('feature must be an object with an id')
    return undefined
  }
  const item = itemOf(value, 'feature', errors)
  if (!FEATURE_ID.test(item.id)) errors.push('feature.id must match ^[a-z0-9][a-z0-9-]{0,63}$ (lower case letters, digits and -)')

  return item
}

function taskOf(value: unknown, path: string, errors: string[]): TaskPatch | undefined {
  if (!isRecord(value)) {
    errors.push(`${path} must be an object with an id`)
    return undefined
  }
  const read = readerOf(value, path, errors)
  const item = itemOf(value, path, errors)
  const isValidId = item.id !== '' && item.id.length <= TASK_ID_MAX && !CONTROL_CHARACTER.test(item.id)
  if (!isValidId) errors.push(`${path}.id must be a string of 1 to ${TASK_ID_MAX} characters with no control character`)

  return { ...item, group: read.text('group'), steps: read.steps(), link: read.text('link') }
}

function tasksOf(value: unknown, errors: string[]): TaskPatch[] {
  if (value === undefined) return []
  if (!Array.isArray(value)) {
    errors.push('tasks must be an array')
    return []
  }
  const tasks = value.map((task, index) => taskOf(task, `tasks[${index}]`, errors)).filter(task => task !== undefined)
  const seen = new Set<string>()
  for (const task of tasks) {
    if (seen.has(task.id)) errors.push(`tasks has the id ${task.id} more than once`)
    seen.add(task.id)
  }

  return tasks
}

function removeOf(value: unknown, errors: string[]): string[] {
  if (value === undefined) return []
  if (!Array.isArray(value) || !value.every(id => typeof id === 'string')) {
    errors.push('remove must be an array of task ids')
    return []
  }

  return value.map(String)
}

/** The tool input as a validated report, or a message that names the first wrong field. */
export function parseReport(input: unknown): Report | string {
  if (!isRecord(input)) return 'feature-progress: the input must be an object with a feature'
  const errors: string[] = []
  const feature = featureOf(input.feature, errors)
  const tasks = tasksOf(input.tasks, errors)
  const remove = removeOf(input.remove, errors)
  if (feature === undefined || errors.length > 0) return `feature-progress: ${errors[0] ?? 'feature is required'}`

  return { feature, tasks, remove }
}

/** `patch` when the call sent it, nothing when it sent `null`, else the stored value. */
const pick = <T>(patch: T | null | undefined, stored: T | undefined): T | undefined => (patch === undefined ? stored : (patch ?? undefined))

type Stamps = { startedAt?: string; updatedAt: string; finishedAt?: string }

/** The stored item a change starts from, its new state, and the time of the change. */
type Change = { stored: (Stamps & { state: Kind }) | undefined; state: Kind; iso: string }

/** Finished when it enters `done`, kept while it stays there, cleared when it leaves. */
function finishedOf({ stored, state, iso }: Change): string | undefined {
  if (state !== 'done') return undefined

  return stored?.state === 'done' ? stored.finishedAt : iso
}

/** Timestamps after a change (FR-06): started the first time it leaves `pending`, updated on every change. */
function stampsOf(change: Change): Stamps {
  const startedAt = change.stored?.startedAt ?? (change.state === 'pending' ? undefined : change.iso)

  return { startedAt, updatedAt: change.iso, finishedAt: finishedOf(change) }
}

function mergeTask(stored: Task | undefined, patch: TaskPatch, iso: string): Task {
  const state = patch.state ?? stored?.state ?? 'pending'

  return {
    id: patch.id,
    title: patch.title ?? stored?.title ?? '',
    state,
    label: pick(patch.label, stored?.label),
    round: pick(patch.round, stored?.round),
    group: pick(patch.group, stored?.group),
    steps: pick(patch.steps, stored?.steps),
    note: pick(patch.note, stored?.note),
    link: pick(patch.link, stored?.link),
    ...stampsOf({ stored, state, iso }),
  }
}

/**
 * The stored feature after a report at `now` (epoch milliseconds), or a message when a new feature or task has no title.
 * Every report moves the feature's `updatedAt`, so a task change also marks the feature as active (DEC-07).
 */
export function applyReport(stored: Feature | undefined, report: Report, now: number): Feature | string {
  const iso = new Date(now).toISOString()
  if (stored === undefined && report.feature.title === undefined) return 'feature-progress: feature.title is required for a new feature'
  const known = new Map((stored?.tasks ?? []).map(task => [task.id, task]))
  const missing = report.tasks.find(task => !known.has(task.id) && task.title === undefined)
  if (missing !== undefined) return `feature-progress: tasks ${missing.id} needs a title, because it is a new task`

  const patches = new Map(report.tasks.map(task => [task.id, task]))
  const updated = (stored?.tasks ?? []).map(task => {
    const patch = patches.get(task.id)
    return patch === undefined ? task : mergeTask(task, patch, iso)
  })
  const added = report.tasks.filter(task => !known.has(task.id)).map(task => mergeTask(undefined, task, iso))
  const removed = new Set(report.remove)
  const patch = report.feature
  const state = patch.state ?? stored?.state ?? 'pending'

  return {
    schemaVersion: SCHEMA_VERSION,
    id: patch.id,
    title: patch.title ?? stored?.title ?? '',
    state,
    label: pick(patch.label, stored?.label),
    round: pick(patch.round, stored?.round),
    note: pick(patch.note, stored?.note),
    ...stampsOf({ stored, state, iso }),
    tasks: [...updated, ...added].filter(task => !removed.has(task.id)),
  }
}
