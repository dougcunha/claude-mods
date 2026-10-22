import type { Host } from './host'
import { norm } from './paths'

/** What a comment is attached to: an element of the diagram, or the whole review. */
export type AnchorKind = 'unit' | 'member' | 'relation' | 'table' | 'column' | 'review'

/** An anchor id: a unit or table id, `<unit id>#<member id>`, `<table id>.<column>`, `<from>→<to>→<kind>`, or `review`. */
export type Anchor = { kind: AnchorKind; id: string }

export type CommentType = 'change' | 'question'

/** A draft waits for the next submit; a submitted comment is open until the reviewer marks it resolved. */
export type CommentStatus = 'draft' | 'open' | 'resolved'

/**
 * One comment of the reviewer; `isStatusChanged` marks a status the next review prompt reports, and `sentStatus` keeps
 * the status of the last submit while it differs.
 */
export type Comment = {
  id: string
  anchor: Anchor
  type: CommentType
  text: string
  status: CommentStatus
  round: number
  isStatusChanged?: true
  sentStatus?: SubmittedStatus
}

/** The statuses of a submitted comment. */
type SubmittedStatus = Exclude<CommentStatus, 'draft'>

/** The comments of one project and branch, as `$.store` keeps them under `review:<root key>:<branch>`. */
export type ReviewRecord = { version: 1; round: number; updatedAt: number; comments: Comment[] }

/** A comment as the page shows it: `isAnchored` is false when its anchor is not in the current view model (FR-23). */
export type ViewComment = Comment & { isAnchored: boolean }

/** The anchors of a view model, by kind, to tell which comments still have their element. */
export type AnchorIndex = Record<Exclude<AnchorKind, 'review'>, ReadonlySet<string>>

/** The prefix of every store key the mod writes. */
export const REVIEW_KEY_PREFIX = 'review:'

/** The store size at which the oldest review goes first (NFR-09), below the engine's 4 MiB limit of `$.store`. */
export const STORE_SOFT_LIMIT_BYTES = 3 * 1024 * 1024

/** The longest comment text kept; the page form has the same limit. */
export const COMMENT_TEXT_LIMIT = 10_000

const ANCHOR_KINDS: readonly AnchorKind[] = ['unit', 'member', 'relation', 'table', 'column', 'review']
const TYPES: readonly CommentType[] = ['change', 'question']
const STATUSES: readonly CommentStatus[] = ['draft', 'open', 'resolved']
const SUBMITTED_STATUSES: readonly SubmittedStatus[] = ['open', 'resolved']

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

const isOneOf = <T extends string>(options: readonly T[], value: unknown): value is T => typeof value === 'string' && (options as readonly string[]).includes(value)

/** The store key of the reviews of a repository and branch; a Windows drive path is case-folded, as the file system is. */
export function storeKey(root: string, branch: string): string {
  const path = norm(root).replace(/\/+$/, '')

  return `${REVIEW_KEY_PREFIX}${/^[a-zA-Z]:\//.test(path) ? path.toLowerCase() : path}:${branch}`
}

/** A new, empty review: round 1, no comments. */
export const emptyRecord = (): ReviewRecord => ({ version: 1, round: 1, updatedAt: 0, comments: [] })

/** One comment read from `unknown` (the page or the store); a value that does not fit is dropped, not repaired. */
export function narrowComment(value: unknown): Comment | null {
  if (!isRecord(value) || !isRecord(value.anchor)) return null
  const { id, type, text, status, round } = value
  const { kind, id: anchorId } = value.anchor
  if (typeof id !== 'string' || id === '' || !isOneOf(ANCHOR_KINDS, kind) || typeof anchorId !== 'string') return null
  if (!isOneOf(TYPES, type) || typeof text !== 'string' || text.trim() === '' || !isOneOf(STATUSES, status)) return null
  if (typeof round !== 'number' || !Number.isInteger(round) || round < 1) return null

  const changed = value.isStatusChanged === true ? { isStatusChanged: true as const } : {}
  const sent = isOneOf(SUBMITTED_STATUSES, value.sentStatus) ? { sentStatus: value.sentStatus } : {}

  return { id, anchor: { kind, id: anchorId }, type, text: text.slice(0, COMMENT_TEXT_LIMIT), status, round, ...changed, ...sent }
}

/** A review read from the store; another version, or a broken value, reads as none. */
export function narrowRecord(value: unknown): ReviewRecord | null {
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.comments)) return null
  const round = typeof value.round === 'number' && Number.isInteger(value.round) && value.round >= 1 ? value.round : 1
  const updatedAt = typeof value.updatedAt === 'number' ? value.updatedAt : 0

  return { version: 1, round, updatedAt, comments: value.comments.flatMap((item: unknown) => narrowComment(item) ?? []) }
}

/**
 * Applies the comment set the page sent: its drafts replace the stored drafts as a whole, so a repeated line changes
 * nothing; a submitted comment takes only its new status, and its text stays as it was sent.
 */
export function mergeComments(record: ReviewRecord, incoming: readonly unknown[], now: number): ReviewRecord {
  const sent = incoming.flatMap(item => narrowComment(item) ?? [])
  const statusOf = new Map(sent.filter(comment => comment.status !== 'draft').map(comment => [comment.id, comment.status]))
  const submittedIds = new Set(record.comments.filter(comment => comment.status !== 'draft').map(comment => comment.id))
  const submitted = record.comments
    .filter(comment => comment.status !== 'draft')
    .map(comment => {
      const status = statusOf.get(comment.id)
      if (status === undefined || status === 'draft' || status === comment.status) return comment
      // A change is measured from the status at the last submit, so a status switched back reports nothing.
      const sentStatus: SubmittedStatus = comment.sentStatus ?? (comment.status === 'resolved' ? 'resolved' : 'open')
      const { isStatusChanged, sentStatus: previous, ...rest } = comment
      void isStatusChanged
      void previous

      return status === sentStatus ? { ...rest, status } : { ...rest, status, isStatusChanged: true as const, sentStatus }
    })
  // A draft the page still shows after a submit made it open is that open comment, not a new draft.
  const drafts = sent.filter(comment => comment.status === 'draft' && !submittedIds.has(comment.id)).map(comment => ({ ...comment, round: record.round }))

  return { ...record, updatedAt: now, comments: [...submitted, ...drafts] }
}

/** Whether the page that sent `incoming` shows another status than the stored set has, or a draft the store dropped. */
export function isPageBehind(incoming: readonly unknown[], record: ReviewRecord): boolean {
  const stored = new Map(record.comments.map(comment => [comment.id, comment.status]))

  return incoming.flatMap(item => narrowComment(item) ?? []).some(comment => stored.get(comment.id) !== comment.status)
}

/** What a submit sends: the drafts of this round and the comments whose status changed since the last submit. */
export function reviewOf(record: ReviewRecord): { drafts: Comment[]; changed: Comment[] } {
  return { drafts: record.comments.filter(comment => comment.status === 'draft'), changed: record.comments.filter(comment => comment.isStatusChanged === true) }
}

/** The record after a submit: the drafts become open comments of this round, status changes are reported, and a new round starts. */
export function submitRecord(record: ReviewRecord, now: number): ReviewRecord {
  const comments = record.comments.map(comment => {
    const { isStatusChanged, sentStatus, ...rest } = comment
    void isStatusChanged
    void sentStatus

    return comment.status === 'draft' ? { ...rest, status: 'open' as const } : rest
  })

  return { ...record, round: record.round + 1, updatedAt: now, comments }
}

/** Whether a comment's anchor is still in the view model; a comment on the whole review always is. */
export const isAnchored = (anchor: Anchor, index: AnchorIndex): boolean => anchor.kind === 'review' || index[anchor.kind].has(anchor.id)

/** The comments as the page shows them, each marked anchored or not against the current view model. */
export const viewComments = (record: ReviewRecord, index: AnchorIndex): ViewComment[] => record.comments.map(comment => ({ ...comment, isAnchored: isAnchored(comment.anchor, index) }))

/** The review of a store key, or a new one when the key is unset or holds another version. */
export async function loadRecord(host: Host, key: string): Promise<ReviewRecord> {
  return narrowRecord(await host.storeGet(key)) ?? emptyRecord()
}

/** The keys to delete so the reviews fit the soft limit: the oldest `updatedAt` first, never the key being saved. */
export function keysToPrune(entries: readonly { key: string; bytes: number; updatedAt: number }[], keep: string, limit = STORE_SOFT_LIMIT_BYTES): string[] {
  let total = entries.reduce((sum, entry) => sum + entry.bytes, 0)
  const pruned: string[] = []
  for (const entry of [...entries].sort((a, b) => a.updatedAt - b.updatedAt)) {
    if (total <= limit) break
    if (entry.key === keep) continue
    pruned.push(entry.key)
    total -= entry.bytes
  }

  return pruned
}

/** Saves a review, then deletes the oldest other reviews while the mod's keys are above the soft limit (NFR-09). */
export async function saveRecord(host: Host, key: string, record: ReviewRecord): Promise<void> {
  await host.storeSet(key, record)
  const entries = []
  for (const other of (await host.storeKeys()).filter(name => name.startsWith(REVIEW_KEY_PREFIX))) {
    const value = other === key ? record : await host.storeGet(other)
    entries.push({ key: other, bytes: JSON.stringify(value ?? null).length, updatedAt: narrowRecord(value)?.updatedAt ?? 0 })
  }
  for (const stale of keysToPrune(entries, key)) await host.storeDelete(stale)
}
