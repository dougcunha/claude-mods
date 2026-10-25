import { expect, mock, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

import { REPORT_DESCRIPTION, REPORT_SPEC, REPORT_TOOL } from '../hooks/spec'

type On = Parameters<TestBody>[1]

const CWD = '/repo'
const FOLDER = '/repo/.claude/feature-progress'
const FILE = `${FOLDER}/checkout.json`
const NOW = Date.UTC(2026, 9, 25, 10, 0, 0)

const CREATE = {
  feature: { id: 'checkout', title: 'Checkout', state: 'active' },
  tasks: [
    { id: 'T01', title: 'Cart', state: 'done' },
    { id: 'T02', title: 'Payment', state: 'active' },
  ],
}

/** A path as the tests name it: the engine hands the fs hooks an absolute path, with a drive and back slashes on Windows. */
const keyOf = (path: string): string => path.replace(/\\/g, '/').replace(/^[a-zA-Z]:/, '')

/** Answers the fs nouns from files in memory and records each write; `reads` counts every read and listing. */
function disk(on: On, files: Record<string, string> = {}, isWriteFailing = false) {
  const written: string[] = []
  let reads = 0
  on('session.cwd', async () => ({ value: CWD }))
  on('fs.exists', async (_, e) => ({ value: keyOf(e.path) === FOLDER ? Object.keys(files).length > 0 : keyOf(e.path) in files }))
  on('fs.read', async (_, e) => {
    reads += 1
    const text = files[keyOf(e.path)]
    if (text === undefined) throw new Error('ENOENT')
    return { value: text }
  })
  on('fs.list', async () => {
    reads += 1
    return { value: Object.keys(files).map(path => ({ name: path.slice(FOLDER.length + 1), kind: 'file', size: 1, mtimeMs: 0, isLink: false })) } as never
  })
  on('fs.write', async (_, e) => {
    if (isWriteFailing) throw new Error('EACCES')
    files[keyOf(e.path)] = e.text
    written.push(keyOf(e.path))
    return { value: undefined }
  })

  return { files, written, reads: () => reads }
}

const call = (input: object, extra: object = {}) => ({ tool: REPORT_TOOL, ...input, ...extra }) as never

test('TC-05 FR-01 session start registers the report tool with the exact description', async ($, on) => {
  const registered: unknown[] = []
  disk(on)
  on('session.start', async (_, e) => ({ cwd: e.cwd }))
  on('tool.register', async (_, e) => (registered.push(e), { value: { tool: REPORT_TOOL } }) as never)

  await $.session.start({ cwd: CWD, surface: 'terminal', isInteractive: true })

  expect(registered).toEqual([REPORT_SPEC])
  expect(REPORT_DESCRIPTION).toBe(
    'Report the progress of a feature and its tasks to the feature-progress band and pane. ' +
      'Only the main session calls this tool; subagents do not. ' +
      'Each call merges into the stored feature: send `feature.id` always, `feature.title` on the first call, and only the fields and tasks that changed. ' +
      'A task is matched by `id`; a new id adds it, a known id updates only the fields sent. ' +
      '`remove` deletes tasks by id. ' +
      '`state` is one of: pending, planning, active, review, fixing, qa, waiting, blocked, done. ' +
      'Use `round` for the review, correction or QA round, `group` to group tasks such as "Review #1", `steps` for done/total sub-steps, ' +
      '`note` for a short reason, and `link` for a file path. ' +
      'The tool sets the timestamps.',
  )
})

test('TC-05 FR-07 FR-08 a valid report writes the feature file and answers the stage and the count', async ($, on) => {
  mock.clock(on, { now: NOW })
  const fake = disk(on)

  const answer = await $.tool.call(call(CREATE))

  expect(answer).toMatchObject({ result: 'feature-progress: active · 1/2' })
  expect(fake.written).toEqual([FILE])
  expect(JSON.parse(fake.files[FILE] ?? '{}')).toMatchObject({ schemaVersion: 1, id: 'checkout', updatedAt: new Date(NOW).toISOString() })
})

test('TC-05 FR-05 an invalid report is refused with the field and nothing is written', async ($, on) => {
  mock.clock(on, { now: NOW })
  const fake = disk(on)

  const answer = await $.tool.call(call({ feature: { id: 'checkout', title: 'x', state: 'doing' } }))

  expect(answer).toMatchObject({ deny: expect.stringContaining('feature.state must be one of') })
  expect(fake.written).toEqual([])
})

test('TC-05 DEC-02 a report from a subagent is ignored and nothing is written', async ($, on) => {
  mock.clock(on, { now: NOW })
  const fake = disk(on)

  const answer = await $.tool.call(call(CREATE, { agentId: 'a1' }))

  expect(answer).toMatchObject({ result: 'Ignored: only the main session reports progress.' })
  expect(fake.written).toEqual([])
})

test('TC-12 DEC-03 a report merges with the file on disk, which another session changed', async ($, on) => {
  mock.clock(on, { now: NOW })
  const fake = disk(on)
  await $.tool.call(call(CREATE))
  const other = JSON.parse(fake.files[FILE] ?? '{}')
  fake.files[FILE] = JSON.stringify({ ...other, tasks: [...other.tasks, { id: 'T03', title: 'Refund', state: 'pending', updatedAt: other.updatedAt }] })

  const answer = await $.tool.call(call({ feature: { id: 'checkout' }, tasks: [{ id: 'T02', state: 'done' }] }))

  expect(answer).toMatchObject({ result: 'feature-progress: active · 2/3' })
  expect(JSON.parse(fake.files[FILE] ?? '{}').tasks.map((task: { id: string }) => task.id)).toEqual(['T01', 'T02', 'T03'])
})

test('TC-12 FR-18 a report for an unreadable file is refused and the file stays the same', async ($, on) => {
  mock.clock(on, { now: NOW })
  const fake = disk(on, { [FILE]: '{ broken' })

  const answer = await $.tool.call(call(CREATE))

  expect(answer).toMatchObject({ deny: `feature-progress: ${FILE} is not a readable feature file; fix or delete it, then report again` })
  expect(fake.files[FILE]).toBe('{ broken')
})

test('TC-12 a failure while saving refuses the call with the reason', async ($, on) => {
  mock.clock(on, { now: NOW })
  disk(on, {}, true)

  const answer = await $.tool.call(call(CREATE))

  expect(answer).toMatchObject({ deny: expect.stringContaining('feature-progress: could not save the report') })
})

test('TC-13 FR-16 session start reads the folder once, and timer ticks read nothing more', async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  const fake = disk(on, { [FILE]: JSON.stringify({ schemaVersion: 1, id: 'checkout', title: 'Checkout', state: 'active', updatedAt: 'x', tasks: [] }) })
  on('session.start', async (_, e) => ({ cwd: e.cwd }))
  on('tool.register', async () => ({ value: { tool: REPORT_TOOL } }) as never)

  await $.session.start({ cwd: CWD, surface: 'terminal', isInteractive: true })
  const afterStart = fake.reads()
  await clock.advance(10 * 60_000)

  expect(afterStart).toBe(2)
  expect(fake.reads()).toBe(afterStart)
})

test('TC-13 DEC-09 after /clear the mod reads the folder again once the session id switched', async ($, on) => {
  let id = 's1'
  const clock = mock.clock(on, { now: NOW })
  const fake = disk(on, { [FILE]: JSON.stringify({ schemaVersion: 1, id: 'checkout', title: 'Checkout', state: 'active', updatedAt: 'x', tasks: [] }) })
  on('session.id', async () => ({ value: id }))
  on('session.end', async (_, e) => ({ sessionId: e.sessionId }))

  await $.session.end({ reason: 'clear', sessionId: 's1', resume: { id: 's1' } })
  await clock.advance(1_000)
  const before = fake.reads()
  id = 's2'
  await clock.advance(400)

  expect(before).toBe(0)
  expect(fake.reads()).toBe(2)
})
