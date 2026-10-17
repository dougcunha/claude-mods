import { expect, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

import { CONTINUE_STORE, continueLog, continueReason, continueText, endsWithQuestion, lastContinueText, MAX_CONTINUES, NO_CONTINUE, openTasksKey, withContinue, withPrompt } from '../hooks/autocontinue'
import type { StopFacts } from '../hooks/autocontinue'
import { TODO_TOOL } from '../hooks/todos'
import type { Todo } from '../types'

const PANE = {
  plugin: 'session-info',
  component: 'Pane',
  requestId: 'session-info',
  props: { title: 'Session info', isFocused: true, bodyColumns: 100, placement: 'dock', scroll: { offset: 0, bodyRows: 200 }, view: {} },
} as const

const TODOS: Todo[] = [
  { content: 'Read the types', status: 'completed' },
  { content: 'Write the hook', status: 'in_progress' },
  { content: 'Add tests', status: 'pending' },
]

const DONE: Todo[] = TODOS.map(todo => ({ ...todo, status: 'completed' }))

const FACTS: StopFacts = { isOn: true, todos: TODOS, lastMessage: 'The hook is written.', hasPendingWork: false, state: NO_CONTINUE }

const STATUS_LINE = '📊 ContextBrake: 26% · 269537/1000000 (harness) · measured · GREEN'

test('a reply asks the person when one of its last lines ends in a question mark', () => {
  expect(endsWithQuestion('Posso enviar?')).toBe(true)
  expect(endsWithQuestion(`Do you want me to push?\n\n${STATUS_LINE}`)).toBe(true)
  expect(endsWithQuestion('**Pode seguir?**')).toBe(true)
  expect(endsWithQuestion('Is it right?\n```\ncode\n```')).toBe(true)
  expect(endsWithQuestion('The build passed.')).toBe(false)
  expect(endsWithQuestion('Why?\none\ntwo\nthree')).toBe(false)
  expect(endsWithQuestion('')).toBe(false)
})

test('the stop goes on with the next open task while the switch is on', () => {
  expect(continueReason(FACTS)).toBe([
    'session-info auto-continue: the task list still has 2 open tasks. Next: Write the hook.',
    'Continue with it now, and keep the task list current.',
    'If the next step needs the person: a decision, an approval, a push, a deploy, a message to other people or a change that cannot be undone, stop and ask instead.',
    'If a task is no longer needed, mark it cancelled.',
  ].join('\n'))
})

test('the turn ends when the switch is off, nothing is open, work is pending or the reply asks', () => {
  expect(continueReason({ ...FACTS, isOn: false })).toBeUndefined()
  expect(continueReason({ ...FACTS, todos: DONE })).toBeUndefined()
  expect(continueReason({ ...FACTS, todos: [] })).toBeUndefined()
  expect(continueReason({ ...FACTS, hasPendingWork: true })).toBeUndefined()
  expect(continueReason({ ...FACTS, lastMessage: 'Should I push now?' })).toBeUndefined()
})

test('the turn ends at the limit in a row and when the open tasks did not move since the last continue', () => {
  const below = { ...NO_CONTINUE, count: MAX_CONTINUES - 1 }
  expect(continueReason({ ...FACTS, state: below })).toBeDefined()
  expect(continueReason({ ...FACTS, state: { ...below, count: MAX_CONTINUES } })).toBeUndefined()

  const once = withContinue(NO_CONTINUE, TODOS, 7, 'reason')
  expect(once).toEqual({ count: 1, total: 1, last: openTasksKey(TODOS), lastRun: { at: 7, count: 1, next: 'Write the hook', reason: 'reason' } })
  expect(continueReason({ ...FACTS, state: once })).toBeUndefined()
  const moved: Todo[] = [TODOS[0] as Todo, { ...(TODOS[1] as Todo), status: 'completed' }, { ...(TODOS[2] as Todo), status: 'in_progress' }]
  expect(continueReason({ ...FACTS, todos: moved, state: once })).toContain('1 open task. Next: Add tests.')

  expect(withPrompt(once)).toEqual({ ...once, count: 0, last: null })
  expect(lastContinueText(once.lastRun as never)).toBe('Continued 1/5 · next: Write the hook')
  expect(continueLog(once.lastRun as never)).toBe('session-info: auto-continue 1/5, next: Write the hook')
  expect(continueText(once)).toBe('1 continue')
  expect(continueText(NO_CONTINUE)).toBe('')
})

/** A session whose switch reads and writes `store`; the lines it logs to the transcript go to `logged`. */
function world(on: Parameters<TestBody>[1], store: Record<string, unknown>, logged: string[] = []) {
  on('ui.log', async (_, e) => (logged.push(String(e.text)), { value: undefined }) as never)
  on('session.cwd', async () => ({ value: '/repo' }))
  on('agent.list', async () => ({ value: [] }))
  on('session.usage', async () => ({ value: { startedAt: 0, rateLimits: [], context: { window: 200_000 } } }) as never)
  on('env.get', async () => ({ value: undefined }))
  on('process.run', async () => ({ value: { exitCode: 128, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }))
  on('store.get', async (_, e) => ({ value: store[e.key] }) as never)
  on('store.set', async (_, e) => ((store[e.key] = e.value), { value: undefined }))
  on('prompt.submit', async (_, e) => ({ text: e.text }) as never)
  // The settings hooks beneath the mod: none blocks.
  on('classic.Stop', async () => ({}))
}

const stop = (message: string) => ({ stop_hook_active: false, last_assistant_message: message }) as never

test('with the switch on, a stop with open tasks is blocked once per step and the person\'s prompt starts the count over', async ($, on) => {
  const logged: string[] = []
  world(on, { [CONTINUE_STORE]: true }, logged)
  await $.tool.call({ tool: TODO_TOOL, todos: TODOS } as never)

  expect((await $.classic.Stop(stop('Step done.'))).block).toContain('Next: Write the hook.')
  expect(logged).toEqual(['session-info: auto-continue 1/5, next: Write the hook'])
  expect((await $.classic.Stop(stop('Step done.'))).block).toBeUndefined()

  await $.prompt.submit({ text: 'go on', origin: { kind: 'composer' }, wait: false } as never)
  expect((await $.classic.Stop(stop('Step done.'))).block).toContain('Next: Write the hook.')
  expect((await $.classic.Stop(stop('Want me to push?'))).block).toBeUndefined()

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: '2 continues' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'Continued 1/5 · next: Write the hook' })).toBeDefined()
  await ui.unmount()
  expect(logged).toHaveLength(2)
})

test('the switch starts off and its row in the Todos section turns it on in the store', async ($, on) => {
  const store: Record<string, unknown> = {}
  world(on, store)
  await $.tool.call({ tool: TODO_TOOL, todos: TODOS } as never)
  expect((await $.classic.Stop(stop('Step done.'))).block).toBeUndefined()

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'continue-switch' })
  expect(store[CONTINUE_STORE]).toBe(true)
  await ui.unmount()

  expect((await $.classic.Stop(stop('Step done.'))).block).toContain('auto-continue')
})

test('showTodos false leaves the stop alone', { options: { showTodos: false } }, async ($, on) => {
  world(on, { [CONTINUE_STORE]: true })
  expect((await $.classic.Stop(stop('Step done.'))).block).toBeUndefined()
})
