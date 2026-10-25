import { expect, test } from 'claude-code/testing'

import type { Feature } from '../types'

import { applyReport, KINDS, parseReport } from '../hooks/report'
import type { Report } from '../hooks/report'

const FEATURE_ID = '02-feature-progress'
const T0 = Date.UTC(2026, 9, 25, 10, 0, 0)
const T1 = T0 + 60_000
const T2 = T0 + 120_000
const T3 = T0 + 180_000
const ISO = (time: number): string => new Date(time).toISOString()

/** A report the parser accepted; the test fails when it did not. */
function reportOf(input: unknown): Report {
  const report = parseReport(input)
  if (typeof report === 'string') throw new Error(report)

  return report
}

/** The feature a report produced; the test fails when it was refused. */
function featureOf(stored: Feature | undefined, input: unknown, now: number): Feature {
  const feature = applyReport(stored, reportOf(input), now)
  if (typeof feature === 'string') throw new Error(feature)

  return feature
}

const CREATE = {
  feature: { id: FEATURE_ID, title: 'feature-progress', state: 'active' },
  tasks: [
    { id: 'T01', title: 'Scaffold', state: 'done' },
    { id: 'T02', title: 'Store reports', group: 'Plan', note: 'next', link: 'tasks/task_02.md' },
  ],
}

test('TC-01 FR-01 a valid input becomes a report with the feature, the tasks and the removals', () => {
  const report = parseReport({ ...CREATE, remove: ['T09'], tool: 'mcp__feature-progress__report' })

  expect(report).toEqual({
    feature: { id: FEATURE_ID, title: 'feature-progress', state: 'active' },
    tasks: [
      { id: 'T01', title: 'Scaffold', state: 'done' },
      { id: 'T02', title: 'Store reports', group: 'Plan', note: 'next', link: 'tasks/task_02.md' },
    ],
    remove: ['T09'],
  })
})

test('TC-01 FR-04 an input without feature.id is refused with a message that names the field', () => {
  expect(parseReport({ feature: { title: 'x' } })).toBe(
    'feature-progress: feature.id must match ^[a-z0-9][a-z0-9-]{0,63}$ (lower case letters, digits and -)',
  )
})

test('TC-01 DEC-04 a feature id with upper case, a slash or more than 64 characters is refused', () => {
  for (const id of ['Feature', '../x', 'a'.repeat(65), '-x']) {
    expect(typeof parseReport({ feature: { id } })).toBe('string')
  }
})

test('TC-01 FR-05 an unknown state is refused with the list of the 9 kinds', () => {
  const message = parseReport({ feature: { id: FEATURE_ID }, tasks: [{ id: 'T01', state: 'doing' }] })

  expect(message).toBe(`feature-progress: tasks[0].state must be one of: ${KINDS.join(', ')}`)
})

test('TC-01 FR-04 steps with done above total, a round of 0 and a task id with a control character are refused', () => {
  expect(parseReport({ feature: { id: FEATURE_ID }, tasks: [{ id: 'T01', steps: { done: 3, total: 2 } }] })).toMatch(/tasks\[0\]\.steps/)
  expect(parseReport({ feature: { id: FEATURE_ID, round: 0 } })).toMatch(/feature\.round/)
  expect(parseReport({ feature: { id: FEATURE_ID }, tasks: [{ id: 'T\n1' }] })).toMatch(/tasks\[0\]\.id/)
})

test('TC-01 a task id sent twice in one call is refused', () => {
  const message = parseReport({ feature: { id: FEATURE_ID }, tasks: [{ id: 'T01' }, { id: 'T01' }] })

  expect(message).toBe('feature-progress: tasks has the id T01 more than once')
})

test('TC-01 an input that is not an object, or tasks that is not an array, is refused', () => {
  expect(parseReport('feature')).toBe('feature-progress: the input must be an object with a feature')
  expect(parseReport({ feature: { id: FEATURE_ID }, tasks: 'T01' })).toBe('feature-progress: tasks must be an array')
})

test('TC-02 FR-02 a new feature keeps its tasks in the order received, and a missing state is pending', () => {
  const feature = featureOf(undefined, CREATE, T0)

  expect(feature.tasks.map(task => [task.id, task.state])).toEqual([
    ['T01', 'done'],
    ['T02', 'pending'],
  ])
  expect(feature.schemaVersion).toBe(1)
})

test('TC-02 FR-02 a report with only one task state keeps the other fields and the order', () => {
  const stored = featureOf(undefined, CREATE, T0)

  const feature = featureOf(stored, { feature: { id: FEATURE_ID }, tasks: [{ id: 'T02', state: 'active' }] }, T1)

  expect(feature.tasks[1]).toMatchObject({ id: 'T02', title: 'Store reports', state: 'active', group: 'Plan', note: 'next', link: 'tasks/task_02.md' })
  expect(feature.tasks.map(task => task.id)).toEqual(['T01', 'T02'])
  expect(feature.title).toBe('feature-progress')
})

test('TC-02 an empty string clears a text field and null clears steps and round', () => {
  const stored = featureOf(undefined, { feature: { id: FEATURE_ID, title: 'x', round: 2 }, tasks: [{ id: 'T01', title: 'a', note: 'n', steps: { done: 1, total: 2 } }] }, T0)

  const feature = featureOf(stored, { feature: { id: FEATURE_ID, round: null }, tasks: [{ id: 'T01', note: '', steps: null }] }, T1)

  expect(feature.round).toBeUndefined()
  expect(feature.tasks[0]?.note).toBeUndefined()
  expect(feature.tasks[0]?.steps).toBeUndefined()
})

test('TC-02 FR-04 a new feature without a title, or a new task without a title, is refused', () => {
  expect(applyReport(undefined, reportOf({ feature: { id: FEATURE_ID } }), T0)).toBe('feature-progress: feature.title is required for a new feature')
  const stored = featureOf(undefined, CREATE, T0)
  expect(applyReport(stored, reportOf({ feature: { id: FEATURE_ID }, tasks: [{ id: 'T03', state: 'active' }] }), T1)).toBe(
    'feature-progress: tasks T03 needs a title, because it is a new task',
  )
})

test('TC-03 FR-03 remove drops a known task and ignores an unknown id', () => {
  const stored = featureOf(undefined, CREATE, T0)

  const feature = featureOf(stored, { feature: { id: FEATURE_ID }, remove: ['T01', 'T99'] }, T1)

  expect(feature.tasks.map(task => task.id)).toEqual(['T02'])
})

test('TC-04 FR-06 pending, active, done, fixing sets startedAt once and sets then clears finishedAt', () => {
  const created = featureOf(undefined, { feature: { id: FEATURE_ID, title: 'x' }, tasks: [{ id: 'T01', title: 'a' }] }, T0)
  const active = featureOf(created, { feature: { id: FEATURE_ID }, tasks: [{ id: 'T01', state: 'active' }] }, T1)
  const done = featureOf(active, { feature: { id: FEATURE_ID }, tasks: [{ id: 'T01', state: 'done' }] }, T2)
  const fixing = featureOf(done, { feature: { id: FEATURE_ID }, tasks: [{ id: 'T01', state: 'fixing' }] }, T3)

  expect(created.tasks[0]?.startedAt).toBeUndefined()
  expect(active.tasks[0]?.startedAt).toBe(ISO(T1))
  expect(done.tasks[0]).toMatchObject({ startedAt: ISO(T1), finishedAt: ISO(T2), updatedAt: ISO(T2) })
  expect(fixing.tasks[0]?.startedAt).toBe(ISO(T1))
  expect(fixing.tasks[0]?.finishedAt).toBeUndefined()
})

test('TC-04 a task that stays done keeps its first finishedAt', () => {
  const done = featureOf(undefined, { feature: { id: FEATURE_ID, title: 'x' }, tasks: [{ id: 'T01', title: 'a', state: 'done' }] }, T0)

  const again = featureOf(done, { feature: { id: FEATURE_ID }, tasks: [{ id: 'T01', state: 'done' }] }, T1)

  expect(again.tasks[0]?.finishedAt).toBe(ISO(T0))
})

test('TC-04 DEC-07 a task change moves the feature updatedAt, and an untouched task keeps its own', () => {
  const stored = featureOf(undefined, CREATE, T0)

  const feature = featureOf(stored, { feature: { id: FEATURE_ID }, tasks: [{ id: 'T02', state: 'active' }] }, T1)

  expect(feature.updatedAt).toBe(ISO(T1))
  expect(feature.tasks[0]?.updatedAt).toBe(ISO(T0))
  expect(feature.tasks[1]?.updatedAt).toBe(ISO(T1))
})
