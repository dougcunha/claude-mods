import { loadRecord, storeKey, viewComments } from './comments'
import type { AnchorIndex, ReviewRecord, ViewComment } from './comments'
import { changedFiles, diffHunks } from './git'
import type { ChangedFile, DiffHunks, Hunk } from './git'
import type { Host } from './host'
import { coupling, restDelta, unitDelta, unitLines, untrackedHunks } from './metrics'
import { sessionDir, tempRoot } from './paths'
import type { Delta } from './metrics'
import { isSourceFile, pathKey } from './model'
import type { Cohesion, DesignModel, Member, Relation, Table, TableState, UnitKind, UnitState } from './model'

/** The version of the view model the page reads; the page ignores a file with another one. */
export const VIEW_VERSION = 1

/** The container of a unit the analysis put in no namespace or folder. */
export const ROOT_CONTAINER = '(root)'

/** A unit card: identity, size from Git, the analysis notes, and the coupling from the relations. */
export type ViewUnit = {
  id: string
  name: string
  kind: UnitKind
  state: UnitState
  file: string
  container: string
  lines: number | null
  added: number | null
  removed: number | null
  methods: number | null
  members: Member[]
  summary: string | null
  cohesion: Cohesion | null
  ce: number
  ca: number
  /** False when the file was too large or missing for the range check; the card says "range not checked". */
  isRangeChecked: boolean
}

/** A namespace or folder; closed by default when it holds only context units (FR-17). */
export type ViewContainer = { id: string; units: string[]; isClosed: boolean }

/** A relation with its anchor id `<from>→<to>→<kind>`. */
export type ViewRelation = Relation & { id: string }

/** The dashed line between an entity unit and its table (FR-15). */
export type EntityLink = { id: string; unit: string; table: string }

/** A changed file with its Git totals and the lines outside every unit range; rest is null for a file with no units. */
export type ViewFile = { path: string; oldPath?: string; added: number | null; removed: number | null; rest: Delta | null }

/** A changed file outside the diagram: not source code (FR-16), or a source file the analysis skipped, with its reason. */
export type OtherFile = { path: string; oldPath?: string; added: number | null; removed: number | null; reason?: string }

/** The counts the toolbar shows. */
export type ViewCounts = { units: Record<Exclude<UnitState, 'context'>, number>; tables: Record<TableState, number> }

/** Why the last submit sent nothing, for the page; `at` makes a repeated notice a new file content, so the page hears it. */
export type ViewNotice = { text: string; at: number }

/** What the page draws: written to `view.json` (DEC-03) and read again on each update. */
export type ViewModel = {
  version: typeof VIEW_VERSION
  runId: string
  base: string
  baseLabel: string
  branch: string
  counts: ViewCounts
  containers: ViewContainer[]
  units: ViewUnit[]
  relations: ViewRelation[]
  tables: Table[]
  links: EntityLink[]
  files: ViewFile[]
  otherFiles: OtherFile[]
  /** The round the next submit sends, and every comment of this project and branch with its anchor checked (FR-22, FR-23). */
  round: number
  comments: ViewComment[]
  /** Set by a submit that sent nothing or whose prompt was dropped; any other write clears it (FR-20). */
  notice: ViewNotice | null
  /** Every anchor of the model as `<kind>:<id>`, from `anchorsOf`. */
  anchors: string[]
}

/** What the view needs of a run: the accepted model, the changed files and hunks from Git, and the units not range-checked. */
export type ViewInput = {
  run: { runId: string; base: string; baseLabel: string; branch: string }
  model: DesignModel
  files: readonly ChangedFile[]
  hunks: DiffHunks
  unchecked: readonly string[]
}

/** Orders text by code unit, the same on every machine, unlike a locale compare. */
function compareText(a: string, b: string): number {
  if (a < b) return -1

  return a > b ? 1 : 0
}

const byId = <T extends { id: string }>(a: T, b: T): number => compareText(a.id, b.id)

const byPath = <T extends { path: string }>(a: T, b: T): number => compareText(a.path, b.path)

/** The id a comment anchors a relation by. */
export const relationId = (relation: Relation): string => `${relation.from}→${relation.to}→${relation.kind}`

/** The hunks of each changed file, untracked files included; none at all when Git cut its output, so every delta is unknown. */
function hunksByFile(files: readonly ChangedFile[], hunks: DiffHunks): Map<string, Hunk[]> {
  if (hunks.isTruncated) return new Map()
  const result = new Map(hunks.files)
  for (const file of files) if (file.isUntracked && file.added !== null) result.set(pathKey(file.path), untrackedHunks(file))

  return result
}

/** Builds the view model of an accepted design model; the same input always gives the same output (NFR-04). */
export function buildView({ run, model, files, hunks, unchecked }: ViewInput): ViewModel {
  const fileHunks = hunksByFile(files, hunks)
  const links = model.tables.flatMap(table => (table.entity === undefined ? [] : [{ id: `${table.entity}⇢${table.id}`, unit: table.entity, table: table.id }]))
  const couplings = coupling(
    model.units.map(unit => unit.id),
    model.relations,
  )
  const units: ViewUnit[] = model.units
    .map(unit => {
      const delta = unitDelta(unit, fileHunks.get(unit.file))

      return {
        id: unit.id,
        name: unit.name,
        kind: unit.kind,
        state: unit.state,
        file: unit.file,
        container: unit.container.trim() === '' ? ROOT_CONTAINER : unit.container,
        lines: unitLines(unit),
        added: delta.added,
        removed: delta.removed,
        methods: unit.methods ?? null,
        members: unit.members,
        summary: unit.summary ?? null,
        cohesion: unit.cohesion ?? null,
        ce: couplings.get(unit.id)?.ce ?? 0,
        ca: couplings.get(unit.id)?.ca ?? 0,
        isRangeChecked: unit.state === 'context' || !unchecked.includes(unit.id),
      }
    })
    .sort(byId)
  const skipped = new Map(model.skippedFiles.map(entry => [entry.file, entry.reason]))
  const changed = files.map(file => ({ ...file, path: pathKey(file.path) })).sort(byPath)
  const relations = model.relations.map(relation => ({ ...relation, id: relationId(relation) })).sort(byId)
  const tables = [...model.tables].sort(byId)

  return {
    version: VIEW_VERSION,
    runId: run.runId,
    base: run.base,
    baseLabel: run.baseLabel,
    branch: run.branch,
    counts: countsOf(units, model.tables),
    containers: containersOf(units),
    units,
    relations,
    tables,
    links: links.sort(byId),
    files: changed.map(file => {
      const own = model.units.filter(unit => unit.file === file.path)

      return { path: file.path, ...(file.oldPath === undefined ? {} : { oldPath: file.oldPath }), added: file.added, removed: file.removed, rest: own.length === 0 ? null : restDelta(own, fileHunks.get(file.path)) }
    }),
    otherFiles: changed
      .filter(file => !isSourceFile(file.path) || skipped.has(file.path))
      .map(file => {
        const reason = skipped.get(file.path)

        return { path: file.path, ...(file.oldPath === undefined ? {} : { oldPath: file.oldPath }), added: file.added, removed: file.removed, ...(reason === undefined ? {} : { reason }) }
      }),
    round: 1,
    comments: [],
    notice: null,
    anchors: anchorKeys(anchorsOf({ units, relations, tables })),
  }
}

/** The anchors of a view model: units, `<unit>#<member>`, relations, tables and `<table>.<column>`. */
export function anchorsOf(view: Pick<ViewModel, 'units' | 'relations' | 'tables'>): AnchorIndex {
  return {
    unit: new Set(view.units.map(unit => unit.id)),
    member: new Set(view.units.flatMap(unit => unit.members.map(member => `${unit.id}#${member.id}`))),
    relation: new Set(view.relations.map(relation => relation.id)),
    table: new Set(view.tables.map(table => table.id)),
    column: new Set(view.tables.flatMap(table => table.columns.map(column => `${table.id}.${column.name}`))),
  }
}

/** The anchors as `<kind>:<id>` keys in text order, for the static page to check the drafts it restores (FR-23). */
export const anchorKeys = (index: AnchorIndex): string[] =>
  Object.entries(index)
    .flatMap(([kind, ids]) => [...ids].map(id => `${kind}:${id}`))
    .sort(compareText)

/** Whether a value read back from `view.json` has the shape this version writes; the mod wrote it, so the lists are enough. */
export function isViewModel(value: unknown): value is ViewModel {
  if (typeof value !== 'object' || value === null) return false
  const view = value as Record<string, unknown>

  return view.version === VIEW_VERSION && [view.units, view.relations, view.tables].every(Array.isArray)
}

/** The view model with the review's round and comments, each checked against the view's anchors, and the given notice. */
export const withComments = (view: ViewModel, record: ReviewRecord, notice: ViewNotice | null = null): ViewModel => ({
  ...view,
  round: record.round,
  comments: viewComments(record, anchorsOf(view)),
  notice,
})

function countsOf(units: readonly ViewUnit[], tables: readonly Table[]): ViewCounts {
  const count = <T extends string>(values: readonly T[], value: T): number => values.filter(one => one === value).length
  const states = units.map(unit => unit.state)
  const tableStates = tables.map(table => table.state)

  return {
    units: { added: count(states, 'added'), modified: count(states, 'modified'), deleted: count(states, 'deleted') },
    tables: { added: count(tableStates, 'added'), modified: count(tableStates, 'modified'), dropped: count(tableStates, 'dropped') },
  }
}

/** The containers in name order, each with its units in id order; a container of context units only starts closed. */
function containersOf(units: readonly ViewUnit[]): ViewContainer[] {
  const groups = new Map<string, ViewUnit[]>()
  for (const unit of units) groups.set(unit.container, [...(groups.get(unit.container) ?? []), unit])

  return [...groups.entries()]
    .map(([id, members]) => ({ id, units: members.map(unit => unit.id), isClosed: members.every(unit => unit.state === 'context') }))
    .sort(byId)
}

/** The name of the view model file in the session folder. */
export const VIEW_FILE = 'view.json'

/** What `writeView` needs of the run that waits. */
export type ViewRun = ViewInput['run'] & { root: string }

/**
 * Reads the changed files and the hunks from Git again, builds the view model of the accepted model and writes it to
 * `<temp>/claude-visual-review/<session id>/view.json`; returns the folder, the file's path and its JSON, or the cause
 * when Git failed.
 */
export async function writeView(
  host: Host,
  { run, model, unchecked }: { run: ViewRun; model: DesignModel; unchecked: readonly string[] },
): Promise<{ folder: string; path: string; json: string } | { cause: string }> {
  const files = await changedFiles(host, run.root, run.base)
  if (!Array.isArray(files)) return { cause: 'git diff failed' }
  const hunks = await diffHunks(host, run.root, run.base)
  const built = buildView({ run: { runId: run.runId, base: run.base, baseLabel: run.baseLabel, branch: run.branch }, model, files, hunks, unchecked })
  const view = withComments(built, await loadRecord(host, storeKey(run.root, run.branch)))
  const folder = sessionDir(tempRoot(await host.env()), await host.sessionId())
  const path = `${folder}/${VIEW_FILE}`
  const json = JSON.stringify(view)
  await host.writeFile(path, json)

  return { folder, path, json }
}
