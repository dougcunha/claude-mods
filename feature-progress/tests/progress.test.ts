import { expect, test } from 'claude-code/testing'

import type { Feature, Task } from '../types'

import { agoText, countOf, durationText, filledCells, fitTitle, groupTasks, isStale, kindText, latestOpen, orderFeatures, percentText, replyText, stageText } from '../hooks/progress'

const UPDATED = '2026-10-25T10:00:00.000Z'
const MINUTE_MS = 60_000
const NOW = Date.parse(UPDATED)

const task = (id: string, state: Task['state'], extra: Partial<Task> = {}): Task => ({ id, title: id, state, updatedAt: UPDATED, ...extra })

const feature = (tasks: Task[], extra: Partial<Feature> = {}): Feature => ({ schemaVersion: 1, id: 'checkout', title: 'Checkout', state: 'fixing', round: 1, updatedAt: UPDATED, tasks, ...extra })

/** 10 planned tasks done and 7 correction tasks, 2 of them done. */
const PLANNED_AND_CORRECTIONS = [
  ...Array.from({ length: 10 }, (_, index) => task(`T0${index}`, 'done')),
  ...Array.from({ length: 7 }, (_, index) => task(`T1${index}`, index < 2 ? 'done' : 'pending', { group: 'Review #1' })),
]

test('TC-06 FR-13 the count includes correction tasks', () => {
  expect(countOf(feature(PLANNED_AND_CORRECTIONS))).toEqual({ done: 12, total: 17 })
})

test('TC-06 FR-08 the reply names the stage with its round and the count', () => {
  expect(replyText(feature(PLANNED_AND_CORRECTIONS))).toBe('feature-progress: fixing #1 · 12/17')
})

test('FR-09 the stage shows the label instead of the kind, and no round when none is set', () => {
  expect(stageText({ state: 'review', label: 'Revisão', round: 2 })).toBe('Revisão #2')
  expect(stageText({ state: 'active' })).toBe('active')
})

test('TC-07 FR-14 an open feature past the limit is stale; waiting, done and a limit of 0 never are', () => {
  const later = NOW + 31 * MINUTE_MS

  expect(isStale(feature([], { state: 'active' }), later, 30)).toBe(true)
  expect(isStale(feature([], { state: 'active' }), NOW + 29 * MINUTE_MS, 30)).toBe(false)
  expect(isStale(feature([], { state: 'waiting' }), later, 30)).toBe(false)
  expect(isStale(feature([], { state: 'done' }), later, 30)).toBe(false)
  expect(isStale(feature([], { state: 'active' }), later, 0)).toBe(false)
})

test('TC-08 FR-09 FR-11 open features come latest first, done ones apart, and the band takes the latest open one', () => {
  const old = feature([], { id: 'old', updatedAt: '2026-10-25T09:00:00.000Z' })
  const recent = feature([], { id: 'recent', updatedAt: '2026-10-25T11:00:00.000Z' })
  const closed = feature([], { id: 'closed', state: 'done', updatedAt: '2026-10-25T12:00:00.000Z' })

  const ordered = orderFeatures({ old, recent, closed })

  expect(ordered.open.map(item => item.id)).toEqual(['recent', 'old'])
  expect(ordered.done.map(item => item.id)).toEqual(['closed'])
  expect(latestOpen({ old, recent, closed })?.id).toBe('recent')
})

test('TC-08 FR-12 tasks without a group come first, then each group in the order it first appears', () => {
  const tasks = [task('T08', 'active', { group: 'Review #1' }), task('T01', 'done'), task('T12', 'pending', { group: 'QA #1' }), task('T09', 'done', { group: 'Review #1' })]

  expect(groupTasks(tasks).map(group => [group.name, group.tasks.map(item => item.id)])).toEqual([
    [undefined, ['T01']],
    ['Review #1', ['T08', 'T09']],
    ['QA #1', ['T12']],
  ])
})

test('relative times and durations read in minutes, hours and days', () => {
  expect(agoText(UPDATED, NOW + 30_000)).toBe('just now')
  expect(agoText(UPDATED, NOW + 5 * MINUTE_MS)).toBe('5 min ago')
  expect(agoText(UPDATED, NOW + 130 * MINUTE_MS)).toBe('2 h 10 min ago')
  expect(agoText(UPDATED, NOW + 3 * 24 * 60 * MINUTE_MS)).toBe('3 d ago')
  expect(durationText(task('T01', 'pending'), NOW)).toBe('')
  expect(durationText(task('T01', 'active', { startedAt: UPDATED }), NOW + 20_000)).toBe('<1 min')
  expect(durationText(task('T01', 'done', { startedAt: UPDATED, finishedAt: '2026-10-25T11:00:00.000Z' }), NOW + 999 * MINUTE_MS)).toBe('1 h')
})

test('NFR-05 a long title is cut with an ellipsis, and a short one stays whole', () => {
  expect(fitTitle('Checkout', 20)).toBe('Checkout')
  expect(fitTitle('Checkout flow', 6)).toBe('Check…')
  expect(fitTitle('Checkout', 0)).toBe('…')
})

test('a meter fills its share of the cells, never more than all of them, and none for an empty total', () => {
  expect(filledCells(2, 5, 10)).toBe(4)
  expect(filledCells(9, 5, 8)).toBe(8)
  expect(filledCells(1, 0, 8)).toBe(0)
  expect(percentText(12, 17)).toBe('70%')
  expect(percentText(0, 0)).toBe('0%')
})

test('NFR-04 a task stage keeps the word for its kind and adds the label', () => {
  expect(kindText({ state: 'review' })).toBe('review')
  expect(kindText({ state: 'review', round: 2, label: 'Revisão' })).toBe('review #2 · Revisão')
})
