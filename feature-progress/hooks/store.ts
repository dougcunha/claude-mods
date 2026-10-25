import type { Feature, Kind, Steps, Task } from '../types'

import type { Host } from './host'
import { absolute, join } from './paths'
import type { Platform } from './platform'
import { FEATURE_ID, KINDS, SCHEMA_VERSION } from './report'

/** The largest feature file the mod writes: the limit of `$.fs.read` and `$.fs.write` (NFR-03). */
export const FILE_LIMIT_BYTES = 4 * 1024 * 1024

const FILE_EXTENSION = '.json'

/** The features and the unreadable files of one folder. */
export type Loaded = { features: Record<string, Feature>; warnings: string[] }

/** What a read of one feature file found. */
export type ReadResult = { kind: 'missing' } | { kind: 'unreadable' } | { kind: 'feature'; feature: Feature }

/** The file name of a feature: its id, which `FEATURE_ID` keeps safe, and `.json`. */
export const fileName = (id: string): string => `${id}${FILE_EXTENSION}`

/** The absolute storage folder from the session's working directory and the `folder` setting. */
export const folderOf = (cwd: string, folder: string): string => absolute(cwd, folder)

/** The path of a feature's file in the storage folder. */
export const fileOf = (folder: string, id: string): string => join(folder, fileName(id))

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

const isKind = (value: unknown): value is Kind => typeof value === 'string' && (KINDS as readonly string[]).includes(value)

const textOf = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined)

const roundOf = (value: unknown): number | undefined => (typeof value === 'number' && Number.isInteger(value) && value >= 1 ? value : undefined)

function stepsOf(value: unknown): Steps | undefined {
  if (!isRecord(value)) return undefined
  const { done, total } = value
  if (typeof done !== 'number' || typeof total !== 'number' || done < 0 || done > total || total < 1) return undefined

  return { done, total }
}

function taskOf(value: unknown): Task | undefined {
  if (!isRecord(value)) return undefined
  const { id, title, state, updatedAt } = value
  if (typeof id !== 'string' || typeof title !== 'string' || !isKind(state) || typeof updatedAt !== 'string') return undefined

  return {
    id,
    title,
    state,
    label: textOf(value.label),
    round: roundOf(value.round),
    group: textOf(value.group),
    steps: stepsOf(value.steps),
    note: textOf(value.note),
    link: textOf(value.link),
    startedAt: textOf(value.startedAt),
    updatedAt,
    finishedAt: textOf(value.finishedAt),
  }
}

/** A stored file's text as a feature, or undefined for broken JSON, another schema version or a missing field (FR-18). */
export function parseFeature(text: string): Feature | undefined {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    return undefined
  }
  if (!isRecord(value) || value.schemaVersion !== SCHEMA_VERSION || !Array.isArray(value.tasks)) return undefined
  const { id, title, state, updatedAt } = value
  if (typeof id !== 'string' || !FEATURE_ID.test(id) || typeof title !== 'string' || !isKind(state) || typeof updatedAt !== 'string') return undefined
  const tasks = value.tasks.map(taskOf)
  if (tasks.some(task => task === undefined)) return undefined

  return {
    schemaVersion: SCHEMA_VERSION,
    id,
    title,
    state,
    label: textOf(value.label),
    round: roundOf(value.round),
    note: textOf(value.note),
    startedAt: textOf(value.startedAt),
    updatedAt,
    finishedAt: textOf(value.finishedAt),
    tasks: tasks.filter(task => task !== undefined),
  }
}

/** The UTF-8 size of a text in bytes, without an encoder the runtime may lack. */
export function utf8Bytes(text: string): number {
  let bytes = 0
  for (const character of text) {
    const code = character.codePointAt(0) ?? 0
    if (code < 0x80) bytes += 1
    else if (code < 0x800) bytes += 2
    else if (code < 0x10000) bytes += 3
    else bytes += 4
  }

  return bytes
}

/** The file text of a feature, or a message when it would pass `FILE_LIMIT_BYTES` (NFR-03). */
export function serialize(feature: Feature): { text: string } | { error: string } {
  const text = `${JSON.stringify(feature, null, 2)}\n`
  if (utf8Bytes(text) > FILE_LIMIT_BYTES) return { error: `feature-progress: the file of ${feature.id} would pass 4 MiB; remove done tasks or shorten the notes` }

  return { text }
}

/** Reads one feature file: missing, unreadable, or the feature. */
export async function readOne(host: Host, path: string): Promise<ReadResult> {
  if (!(await host.exists(path))) return { kind: 'missing' }
  const text = await host.readFile(path).catch(() => undefined)
  const feature = text === undefined ? undefined : parseFeature(text)

  return feature === undefined ? { kind: 'unreadable' } : { kind: 'feature', feature }
}

/** Every feature file of the folder; a missing folder has none, and a file that is not a feature named by its id is a warning. */
export async function loadAll(host: Host, folder: string): Promise<Loaded> {
  if (!(await host.exists(folder))) return { features: {}, warnings: [] }
  const entries = await host.list(folder)
  const names = entries.filter(entry => entry.kind === 'file' && entry.name.endsWith(FILE_EXTENSION)).map(entry => entry.name)
  const results = await Promise.all(names.map(async name => ({ name, result: await readOne(host, join(folder, name)) })))
  const features: Record<string, Feature> = {}
  const warnings: string[] = []
  for (const { name, result } of results) {
    if (result.kind === 'feature' && fileName(result.feature.id) === name) features[result.feature.id] = result.feature
    else warnings.push(join(folder, name))
  }

  return { features, warnings }
}

/**
 * The argv that deletes feature files, run with the storage folder as its working directory, so the folder never
 * reaches the command line; the names are `<id>.json`, which `FEATURE_ID` keeps free of any shell syntax (DEC-05).
 */
export function cleanArgv(platform: Platform, names: string[]): string[] {
  return platform === 'windows' ? ['cmd', '/d', '/c', 'del', '/f', '/q', ...names] : ['rm', '-f', '--', ...names]
}
