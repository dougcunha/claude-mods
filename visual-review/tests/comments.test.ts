import { expect, test } from 'claude-code/testing'

import { emptyRecord, isPageBehind, keysToPrune, mergeComments, narrowRecord, reviewOf, saveRecord, storeKey, submitRecord, viewComments } from '../hooks/comments'
import type { Comment, ReviewRecord } from '../hooks/comments'
import type { Host } from '../hooks/host'

const NOW = 1_700_000_000_000

const draft = (id: string, extra: Partial<Comment> = {}): Comment => ({ id, anchor: { kind: 'unit', id: 'Shop.Cart' }, type: 'change', text: `Text ${id}`, status: 'draft', round: 1, ...extra })

test('FR-22 the store key holds the repository and the branch, with a Windows drive path case-folded', () => {
  expect([storeKey('C:\\Work\\Shop\\', 'feature/cart'), storeKey('/home/ana/shop', 'main')]).toEqual(['review:c:/work/shop:feature/cart', 'review:/home/ana/shop:main'])
})

test('TC-11 FR-18 a comment set from the page replaces the drafts as a whole, and a repeated set changes nothing', () => {
  const record = { ...emptyRecord(), comments: [draft('a'), draft('b')] }
  const incoming = [draft('b', { text: 'Edited' }), draft('c', { type: 'question' }), { id: 'bad', anchor: { kind: 'file', id: 'x' } }]

  const once = mergeComments(record, incoming, NOW)

  expect(once.comments.map(comment => [comment.id, comment.text, comment.type])).toEqual([
    ['b', 'Edited', 'change'],
    ['c', 'Text c', 'question'],
  ])
  expect(mergeComments(once, incoming, NOW).comments).toEqual(once.comments)
})

test('TC-11 OBJ-03 a submit opens the drafts in its round; a later status change is kept and reported once', () => {
  const submitted = submitRecord({ ...emptyRecord(), comments: [draft('a'), draft('b')] }, NOW)
  const resolved = mergeComments(submitted, [{ ...draft('a'), status: 'resolved', text: 'Changed text' }], NOW)

  expect(submitted.round).toBe(2)
  expect(submitted.comments.map(comment => [comment.id, comment.status, comment.round])).toEqual([
    ['a', 'open', 1],
    ['b', 'open', 1],
  ])
  expect(reviewOf(resolved).changed).toEqual([{ ...draft('a'), status: 'resolved', isStatusChanged: true, sentStatus: 'open' }])
  expect(reviewOf(submitRecord(resolved, NOW)).changed).toEqual([])
})

test('FR-22 a status switched and switched back before a submit is not reported; a status switched once is reported once', () => {
  const submitted = submitRecord({ ...emptyRecord(), comments: [draft('a')] }, NOW)
  const resolved = mergeComments(submitted, [{ ...draft('a'), status: 'resolved' }], NOW)

  const back = mergeComments(resolved, [{ ...draft('a'), status: 'open' }], NOW)

  expect(reviewOf(back).changed).toEqual([])
  expect(back.comments).toEqual([{ ...draft('a'), status: 'open' }])
  expect(reviewOf(resolved).changed.map(comment => [comment.id, comment.status])).toEqual([['a', 'resolved']])
  expect(submitRecord(resolved, NOW).comments).toEqual([{ ...draft('a'), status: 'resolved' }])
})

test('a stored comment without sentStatus, or with a broken one, still narrows', () => {
  const old = { ...draft('a'), status: 'resolved', isStatusChanged: true }

  expect(narrowRecord({ version: 1, round: 2, updatedAt: NOW, comments: [old, { ...old, id: 'b', sentStatus: 'draft' }] })?.comments).toEqual([
    { ...draft('a'), status: 'resolved', isStatusChanged: true },
    { ...draft('b', { text: 'Text a' }), status: 'resolved', isStatusChanged: true },
  ])
})

test('OBJ-03 a draft the page sends again after a submit opened it stays 1 open comment, and a new draft is kept', () => {
  const submitted = submitRecord({ ...emptyRecord(), comments: [draft('x')] }, NOW)

  const merged = mergeComments(submitted, [draft('x'), draft('y')], NOW)

  expect(merged.comments.map(comment => [comment.id, comment.status, comment.round])).toEqual([
    ['x', 'open', 1],
    ['y', 'draft', 2],
  ])
})

test('OBJ-03 the page is behind when it shows a draft the store opened, and not when it shows the stored statuses', () => {
  const merged = mergeComments(submitRecord({ ...emptyRecord(), comments: [draft('x')] }, NOW), [draft('x'), draft('y')], NOW)

  expect(isPageBehind([draft('x'), draft('y')], merged)).toBe(true)
  expect(isPageBehind([{ ...draft('x'), status: 'open' }, draft('y', { round: 2 })], merged)).toBe(false)
})

test('TC-11 FR-23 a comment whose anchor is not in the new view model is unanchored; a comment on the review never is', () => {
  const record: ReviewRecord = {
    ...emptyRecord(),
    comments: [draft('kept', { anchor: { kind: 'member', id: 'Shop.Cart#Add()' } }), draft('gone', { anchor: { kind: 'member', id: 'Shop.Cart#Remove()' } }), draft('all', { anchor: { kind: 'review', id: 'review' } })],
  }
  const index = { unit: new Set(['Shop.Cart']), member: new Set(['Shop.Cart#Add()']), relation: new Set<string>(), table: new Set<string>(), column: new Set<string>() }

  expect(viewComments(record, index).map(comment => [comment.id, comment.isAnchored])).toEqual([
    ['kept', true],
    ['gone', false],
    ['all', true],
  ])
})

test('a stored review of another version, or a broken one, reads as none', () => {
  expect([narrowRecord({ version: 2, comments: [] }), narrowRecord('x'), narrowRecord({ version: 1 })]).toEqual([null, null, null])
})

test('TC-12 NFR-09 above the soft limit the oldest review goes first, and the review being saved stays', () => {
  const entries = [
    { key: 'review:a', bytes: 40, updatedAt: 3 },
    { key: 'review:b', bytes: 40, updatedAt: 1 },
    { key: 'review:c', bytes: 40, updatedAt: 2 },
    { key: 'review:new', bytes: 40, updatedAt: 0 },
  ]

  expect(keysToPrune(entries, 'review:new', 100)).toEqual(['review:b', 'review:c'])
  expect(keysToPrune(entries, 'review:new', 160)).toEqual([])
})

test('TC-12 saving a review prunes only the mod review keys', async () => {
  const store = new Map<string, unknown>([
    ['review:old', { version: 1, round: 1, updatedAt: 1, comments: [draft('x', { text: 'y'.repeat(200) })] }],
    ['other-setting', 'z'.repeat(500)],
  ])
  const host = {
    storeGet: async (key: string) => store.get(key),
    storeSet: async (key: string, value: unknown) => void store.set(key, value),
    storeKeys: async () => [...store.keys()],
    storeDelete: async (key: string) => void store.delete(key),
  } as unknown as Host

  await saveRecord(host, 'review:new', { ...emptyRecord(), updatedAt: NOW })

  expect([...store.keys()].sort()).toEqual(['other-setting', 'review:new', 'review:old'])
})
