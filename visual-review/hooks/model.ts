import type { Host } from './host'
import { norm } from './paths'

/** The extensions of the changed files that the design model must cover; each other changed file goes to "Other files". */
export const SOURCE_EXTENSIONS = ['.cs', '.ts', '.tsx', '.js', '.mjs', '.cjs', '.py', '.sql', '.prisma'] as const

/** How many lines from the start of a unit's range may hold its name, for a declaration led by attributes or decorators. */
export const RANGE_NAME_LINES = 5

const UNIT_KINDS = ['class', 'interface', 'record', 'struct', 'enum', 'module'] as const
const UNIT_STATES = ['added', 'modified', 'deleted', 'context'] as const
const MEMBER_KINDS = ['method', 'property', 'field', 'constructor'] as const
const MEMBER_STATES = ['added', 'modified', 'deleted'] as const
const RELATION_KINDS = ['inheritance', 'implementation', 'composition', 'dependency'] as const
const RELATION_STATES = ['added', 'removed', 'unchanged'] as const
const TABLE_STATES = ['added', 'modified', 'dropped'] as const
const COLUMN_STATES = ['added', 'modified', 'dropped', 'unchanged'] as const

export type UnitKind = (typeof UNIT_KINDS)[number]
export type UnitState = (typeof UNIT_STATES)[number]
export type MemberKind = (typeof MEMBER_KINDS)[number]
export type MemberState = (typeof MEMBER_STATES)[number]
export type RelationKind = (typeof RELATION_KINDS)[number]
export type RelationState = (typeof RELATION_STATES)[number]
export type TableState = (typeof TABLE_STATES)[number]
export type ColumnState = (typeof COLUMN_STATES)[number]

/** Lines of a file, from 1, both ends included. */
export type Range = { start: number; end: number }
export type Member = { id: string; name: string; kind: MemberKind; state: MemberState }
export type Cohesion = { score: number; reason: string }

/** A class, interface, record, struct, enum or module; a context unit carries only its identity and place. */
export type Unit = {
  id: string
  name: string
  kind: UnitKind
  state: UnitState
  file: string
  container: string
  range?: Range
  baseRange?: Range
  methods?: number
  members: Member[]
  summary?: string
  cohesion?: Cohesion
}

export type Relation = { from: string; to: string; kind: RelationKind; state: RelationState }
export type Column = { name: string; type: string; baseType?: string; state: ColumnState; isPrimaryKey?: boolean; references?: string }
export type Table = { id: string; state: TableState; source: string; entity?: string; columns: Column[] }
export type SkippedFile = { file: string; reason: string }

/** What the analysis subagent sends to `submit_model`, narrowed from the tool input. */
export type DesignModel = { runId: string; units: Unit[]; relations: Relation[]; tables: Table[]; skippedFiles: SkippedFile[] }

/**
 * What a range check needs of a run: the repository root, the base commit whose files a deleted or modified unit names,
 * and the base path of each renamed file, by its current path.
 */
export type RangeSource = { root: string; base: string; oldPaths?: ReadonlyMap<string, string> }

const RANGE_SCHEMA = {
  type: 'object',
  properties: { start: { type: 'integer', minimum: 1 }, end: { type: 'integer', minimum: 1 } },
  required: ['start', 'end'],
}

/** The JSON schema of the `submit_model` input; the rules it cannot state are in the analysis prompt and in `checkModel`. */
export const SUBMIT_SCHEMA = {
  type: 'object',
  properties: {
    runId: { type: 'string', description: 'The run id from the /visual-review prompt.' },
    units: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Fully qualified name, unique in the model.' },
          name: { type: 'string' },
          kind: { type: 'string', enum: [...UNIT_KINDS] },
          state: { type: 'string', enum: [...UNIT_STATES] },
          file: { type: 'string', description: 'Repository-relative path with forward slashes.' },
          container: { type: 'string', description: 'The namespace for C#, the folder for TypeScript, JavaScript and Python.' },
          range: { ...RANGE_SCHEMA, description: 'Lines of the unit in the current file; in the base file for a deleted unit. Not for a context unit.' },
          baseRange: { ...RANGE_SCHEMA, description: 'Lines of the unit in the base file, for a modified unit only.' },
          methods: { type: 'integer', minimum: 0 },
          members: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', description: 'The signature.' },
                name: { type: 'string' },
                kind: { type: 'string', enum: [...MEMBER_KINDS] },
                state: { type: 'string', enum: [...MEMBER_STATES] },
              },
              required: ['id', 'name', 'kind', 'state'],
            },
          },
          summary: { type: 'string', description: '1 to 3 sentences.' },
          cohesion: {
            type: 'object',
            properties: { score: { type: 'integer', minimum: 1, maximum: 5 }, reason: { type: 'string' } },
            required: ['score', 'reason'],
          },
        },
        required: ['id', 'name', 'kind', 'state', 'file', 'container'],
      },
    },
    relations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          from: { type: 'string' },
          to: { type: 'string' },
          kind: { type: 'string', enum: [...RELATION_KINDS] },
          state: { type: 'string', enum: [...RELATION_STATES] },
        },
        required: ['from', 'to', 'kind', 'state'],
      },
    },
    tables: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'schema.table or table.' },
          state: { type: 'string', enum: [...TABLE_STATES] },
          source: { type: 'string', description: 'The changed file that defines the change.' },
          entity: { type: 'string', description: 'The unit id of the entity class, when there is one.' },
          columns: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                type: { type: 'string' },
                baseType: { type: 'string' },
                state: { type: 'string', enum: [...COLUMN_STATES] },
                isPrimaryKey: { type: 'boolean' },
                references: { type: 'string', description: 'table.column of a foreign key.' },
              },
              required: ['name', 'type', 'state'],
            },
          },
        },
        required: ['id', 'state', 'source', 'columns'],
      },
    },
    skippedFiles: {
      type: 'array',
      items: { type: 'object', properties: { file: { type: 'string' }, reason: { type: 'string' } }, required: ['file', 'reason'] },
    },
  },
  required: ['runId', 'units', 'relations', 'tables'],
} as const

type Narrowed<T> = { value: T; problems: string[] }

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

const isOneOf = <T extends string>(options: readonly T[], value: unknown): value is T => typeof value === 'string' && (options as readonly string[]).includes(value)

const isText = (value: unknown): value is string => typeof value === 'string' && value.trim() !== ''

const isCount = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0

/** A repository-relative path as the model and Git both write it: forward slashes, no leading `./`. */
export const pathKey = (path: string): string => norm(path).replace(/^\.\//, '')

function narrowRange(value: unknown): Range | undefined {
  if (!isRecord(value)) return undefined
  const { start, end } = value
  if (!isCount(start) || !isCount(end) || start < 1 || end < start) return undefined

  return { start, end }
}

function narrowMembers(value: unknown, at: string, problems: string[]): Member[] {
  if (value === undefined) return []
  if (!Array.isArray(value)) return (problems.push(`${at}.members: expected an array`), [])
  const members: Member[] = []
  value.forEach((item: unknown, index) => {
    const where = `${at}.members[${index}]`
    if (!isRecord(item) || !isText(item.id) || !isText(item.name) || !isOneOf(MEMBER_KINDS, item.kind) || !isOneOf(MEMBER_STATES, item.state))
      return problems.push(`${where}: needs id, name, kind (${MEMBER_KINDS.join(', ')}) and state (${MEMBER_STATES.join(', ')})`)
    members.push({ id: item.id, name: item.name, kind: item.kind, state: item.state })
  })

  return members
}

function narrowUnit(item: unknown, at: string, problems: string[]): Unit | undefined {
  if (!isRecord(item) || !isText(item.id) || !isText(item.name) || !isText(item.file) || typeof item.container !== 'string')
    return (problems.push(`${at}: needs id, name, file and container`), undefined)
  if (!isOneOf(UNIT_KINDS, item.kind)) return (problems.push(`${at} (${item.id}): kind must be one of ${UNIT_KINDS.join(', ')}`), undefined)
  if (!isOneOf(UNIT_STATES, item.state)) return (problems.push(`${at} (${item.id}): state must be one of ${UNIT_STATES.join(', ')}`), undefined)
  const unit: Unit = { id: item.id, name: item.name, kind: item.kind, state: item.state, file: pathKey(item.file), container: item.container, members: [] }
  if (item.state === 'context') return unit
  const where = `${at} (${item.id})`
  const range = narrowRange(item.range)
  const baseRange = narrowRange(item.baseRange)
  const cohesion = isRecord(item.cohesion) ? item.cohesion : undefined
  const score = cohesion?.score
  if (range === undefined) problems.push(`${where}: range needs start and end lines, start 1 or more and end not before start`)
  if (item.state === 'modified' && baseRange === undefined) problems.push(`${where}: a modified unit needs baseRange, its lines in the base file`)
  if (!isCount(item.methods)) problems.push(`${where}: methods must be a whole number, 0 or more`)
  if (!isText(item.summary)) problems.push(`${where}: summary needs 1 to 3 sentences`)
  if (!isCount(score) || score < 1 || score > 5 || !isText(cohesion?.reason)) problems.push(`${where}: cohesion needs a score from 1 to 5 and a reason`)

  return {
    ...unit,
    ...(range === undefined ? {} : { range }),
    ...(item.state === 'modified' && baseRange !== undefined ? { baseRange } : {}),
    ...(isCount(item.methods) ? { methods: item.methods } : {}),
    members: narrowMembers(item.members, where, problems),
    ...(isText(item.summary) ? { summary: item.summary } : {}),
    ...(isCount(score) && isText(cohesion?.reason) ? { cohesion: { score, reason: cohesion.reason } } : {}),
  }
}

function narrowRelation(item: unknown, at: string, problems: string[]): Relation | undefined {
  if (isRecord(item) && isText(item.from) && isText(item.to) && isOneOf(RELATION_KINDS, item.kind) && isOneOf(RELATION_STATES, item.state))
    return { from: item.from, to: item.to, kind: item.kind, state: item.state }
  problems.push(`${at}: needs from, to, kind (${RELATION_KINDS.join(', ')}) and state (${RELATION_STATES.join(', ')})`)

  return undefined
}

function narrowColumn(item: unknown, at: string, problems: string[]): Column | undefined {
  if (!isRecord(item) || !isText(item.name) || typeof item.type !== 'string' || !isOneOf(COLUMN_STATES, item.state))
    return (problems.push(`${at}: needs name, type and state (${COLUMN_STATES.join(', ')})`), undefined)

  return {
    name: item.name,
    type: item.type,
    state: item.state,
    ...(typeof item.baseType === 'string' ? { baseType: item.baseType } : {}),
    ...(typeof item.isPrimaryKey === 'boolean' ? { isPrimaryKey: item.isPrimaryKey } : {}),
    ...(isText(item.references) ? { references: item.references } : {}),
  }
}

function narrowTable(item: unknown, at: string, problems: string[]): Table | undefined {
  if (!isRecord(item) || !isText(item.id) || !isText(item.source) || !isOneOf(TABLE_STATES, item.state) || !Array.isArray(item.columns))
    return (problems.push(`${at}: needs id, state (${TABLE_STATES.join(', ')}), source and columns`), undefined)
  const where = `${at} (${item.id})`
  const columns = item.columns.flatMap((column: unknown, index) => narrowColumn(column, `${where}.columns[${index}]`, problems) ?? [])

  return { id: item.id, state: item.state, source: pathKey(item.source), ...(isText(item.entity) ? { entity: item.entity } : {}), columns }
}

function narrowList<T>(input: Record<string, unknown>, key: string, problems: string[], narrow: (item: unknown, at: string, problems: string[]) => T | undefined): T[] {
  const value = input[key]
  if (value === undefined && key === 'skippedFiles') return []
  if (!Array.isArray(value)) return (problems.push(`${key}: expected an array (it may be empty)`), [])

  return value.flatMap((item: unknown, index) => narrow(item, `${key}[${index}]`, problems) ?? [])
}

function narrowSkipped(item: unknown, at: string, problems: string[]): SkippedFile | undefined {
  if (isRecord(item) && isText(item.file) && isText(item.reason)) return { file: pathKey(item.file), reason: item.reason }
  problems.push(`${at}: needs file and reason`)

  return undefined
}

/** Narrows the `submit_model` input from `unknown`: the model that parsed, and one problem per value that did not. */
export function narrowModel(input: unknown): Narrowed<DesignModel> {
  const problems: string[] = []
  const record = isRecord(input) ? input : {}
  const runId = typeof record.runId === 'string' ? record.runId : ''
  const value: DesignModel = {
    runId,
    units: narrowList(record, 'units', problems, narrowUnit),
    relations: narrowList(record, 'relations', problems, narrowRelation),
    tables: narrowList(record, 'tables', problems, narrowTable),
    skippedFiles: narrowList(record, 'skippedFiles', problems, narrowSkipped),
  }

  return { value, problems }
}

const extensionOf = (path: string): string => {
  const name = path.split('/').pop() ?? path
  const dot = name.lastIndexOf('.')

  return dot <= 0 ? '' : name.slice(dot).toLowerCase()
}

/** Whether the design model must cover a changed file, by its extension. */
export const isSourceFile = (path: string): boolean => (SOURCE_EXTENSIONS as readonly string[]).includes(extensionOf(path))

/** The gaps of a narrowed model against the changed files: an uncovered source file, a repeated id, or a reference to an unknown unit. */
export function checkModel(model: DesignModel, changedFiles: readonly string[]): string[] {
  const gaps: string[] = []
  const covered = new Set([...model.units.map(unit => unit.file), ...model.tables.map(table => table.source), ...model.skippedFiles.map(skipped => skipped.file)])
  for (const file of changedFiles.map(pathKey))
    if (isSourceFile(file) && !covered.has(file)) gaps.push(`${file}: the changed file is not covered; add its units, the table it changes, or a skippedFiles entry`)
  const unitIds = new Set<string>()
  for (const unit of model.units) {
    if (unitIds.has(unit.id)) gaps.push(`${unit.id}: the unit id is used twice`)
    unitIds.add(unit.id)
  }
  const tableIds = new Set<string>()
  for (const table of model.tables) {
    if (tableIds.has(table.id)) gaps.push(`${table.id}: the table id is used twice`)
    tableIds.add(table.id)
    if (table.entity !== undefined && !unitIds.has(table.entity)) gaps.push(`${table.id}: the entity ${table.entity} is not a unit of the model`)
  }
  for (const relation of model.relations)
    for (const end of [relation.from, relation.to])
      if (!unitIds.has(end)) gaps.push(`${relation.from} → ${relation.to}: ${end} is not a unit of the model`)

  return gaps
}

/** One range of a unit to check, with the text of the file it names and the side of the diff that file is on. */
export type RangeCheck = { range: Range; text: string; side: 'current' | 'base' }

/** The gap of one range against the file text, or null when the range fits and its first lines hold the unit name. */
export function rangeGap(unit: Unit, { range, text, side }: RangeCheck): string | null {
  const lines = text.split(/\r?\n/)
  const where = `${unit.id}: ${side === 'base' ? 'baseRange' : 'range'} ${range.start}-${range.end} in ${side === 'base' ? 'the base file' : 'the current file'} ${unit.file}`
  if (range.end > lines.length) return `${where} ends after the last line (${lines.length})`
  // A module is named after its file, so its first lines need not hold the name.
  if (unit.kind === 'module') return null
  const head = lines.slice(range.start - 1, Math.min(range.end, range.start - 1 + RANGE_NAME_LINES))
  if (head.some(line => line.includes(unit.name))) return null

  return `${where} does not show the name ${unit.name} in its first ${RANGE_NAME_LINES} lines`
}

/** A file's text for the range check; `{ isMissing }` when the base commit has no such file, null when it could not be read in full. */
type CheckText = string | { isMissing: true } | null

/**
 * The gaps of each range against the file it names, and the ids of the units whose file could not be read in full for
 * the check. A renamed file is read at its base path on the base side; a base file the base commit lacks is a gap.
 */
export async function checkRanges(host: Host, source: RangeSource, units: readonly Unit[]): Promise<{ gaps: string[]; unchecked: string[] }> {
  const gaps: string[] = []
  const unchecked: string[] = []
  const texts = new Map<string, CheckText>()
  const textOf = async (side: 'current' | 'base', file: string): Promise<CheckText> => {
    const key = `${side}:${file}`
    if (!texts.has(key)) texts.set(key, side === 'base' ? await baseText(host, source, file) : await host.readFile(`${source.root}/${file}`).catch(() => null))

    return texts.get(key) ?? null
  }
  for (const unit of units) {
    if (unit.state === 'context' || unit.range === undefined) continue
    const checks: [Range, 'current' | 'base'][] = [[unit.range, unit.state === 'deleted' ? 'base' : 'current']]
    if (unit.baseRange !== undefined) checks.push([unit.baseRange, 'base'])
    for (const [range, side] of checks) {
      const text = await textOf(side, unit.file)
      if (text === null) {
        if (!unchecked.includes(unit.id)) unchecked.push(unit.id)
        continue
      }
      const gap = typeof text === 'string' ? rangeGap(unit, { range, text, side }) : missingBaseGap(unit, source)
      if (gap !== null && !gaps.includes(gap)) gaps.push(gap)
    }
  }

  return { gaps, unchecked }
}

/** The gap of a unit whose base file is not in the base commit: a modified or deleted unit needs a file that existed. */
function missingBaseGap(unit: Unit, source: RangeSource): string {
  const path = source.oldPaths?.get(unit.file) ?? unit.file

  return `${unit.id}: the base file ${path} is not in the base commit; use the state added for a unit of a new file`
}

/** The base text of a file, read at its base path; a Git that cannot run, or output cut at its limit, reads as null. */
async function baseText(host: Host, source: RangeSource, file: string): Promise<CheckText> {
  const path = source.oldPaths?.get(file) ?? file
  const shown = await host.run(['git', 'show', `${source.base}:${path}`], source.root).catch(() => null)
  if (shown === null || shown.isStdoutTruncated === true) return null
  if (shown.exitCode !== 0) return { isMissing: true }

  return shown.stdout
}
