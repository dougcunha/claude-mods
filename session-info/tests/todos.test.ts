import { expect, mock, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

import { latestTodos, minSteps, parseTodos, TODO_TOOL, todoPrompt, todoReply, todoSummary } from '../hooks/todos'

const PANE = {
  plugin: 'session-info',
  component: 'Pane',
  requestId: 'session-info',
  props: { title: 'Session info', isFocused: true, bodyColumns: 80 },
} as const

const TODOS = [
  { content: 'Read the types', status: 'completed' },
  { content: 'Write the section', status: 'in_progress', activeForm: 'Writing the section' },
  { content: 'Add tests', status: 'pending' },
  { content: 'Draw a band', status: 'cancelled' },
]

const COMPOSE = { model: 'm', promptModel: 'm', surfaces: [], outputStyle: null, traits: [] } as const

const pane = (on: Parameters<TestBody>[1]) => {
  on('session.cwd', async () => ({ value: '/repo' }))
  on('agent.list', async () => ({ value: [] }))
  on('session.usage', async () => ({ value: { startedAt: 0, rateLimits: [], context: { window: 200_000 } } }) as never)
}

for (const surface of ['terminal', 'desktop'] as const) {
  test(`the todos section draws the list the model writes (${surface})`, async ($, on) => {
    pane(on)

    const empty = await $.ui.mount({ ...PANE, surface })
    expect(await empty.find({ type: 'Text', text: /^No task list yet/ })).toBeDefined()
    await empty.unmount()

    const answered = await $.tool.call({ tool: TODO_TOOL, todos: TODOS } as never)
    expect(answered.result).toBe('Task list updated: 1/3 done. In progress: Write the section.')

    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ type: 'Text', text: '1/3 done' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: 'Writing the section' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: 'Add tests' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: 'Draw a band' })).toBeDefined()
    await ui.press({ key: 'section:#todos' })
    expect(await ui.find({ type: 'Text', text: 'Add tests' })).toBeUndefined()
    await ui.unmount()
  })
}

test('a bad list is refused and a subagent call changes nothing', async ($, on) => {
  pane(on)
  const bad = await $.tool.call({ tool: TODO_TOOL, todos: [{ content: 'x', status: 'done' }] } as never)
  expect(bad.deny).toBe('todos[0].status must be one of pending, in_progress, completed, cancelled.')

  const sub = await $.tool.call({ tool: TODO_TOOL, todos: TODOS, agentId: 'a1' } as never)
  expect(String(sub.result)).toMatch(/^Ignored/)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /^No task list yet/ })).toBeDefined()
  await ui.unmount()
})

test('the prompt gets the task list section only when the request offers the tool', async ($, on) => {
  on('prompt.compose', async () => ({ sections: [{ id: 'intro', text: 'Hi', scope: 'shared' }] }) as never)

  const offered = await $.prompt.compose({ ...COMPOSE, tools: [TODO_TOOL] })
  expect(offered.sections.map(s => s.id)).toEqual(['intro', 'session-info:todos'])
  expect(offered.sections.at(-1)?.scope).toBe('session')

  const plain = await $.prompt.compose({ ...COMPOSE, tools: ['Read'] })
  expect(plain.sections.map(s => s.id)).toEqual(['intro'])
  expect(offered.sections.at(-1)?.text).toContain('work that has 3 or more distinct steps')
})

test('todoMinSteps sets the step count the prompt section names', { options: { todoMinSteps: 2 } }, async ($, on) => {
  on('prompt.compose', async () => ({ sections: [] }) as never)
  const composed = await $.prompt.compose({ ...COMPOSE, tools: [TODO_TOOL] })
  expect(composed.sections.at(-1)?.text).toContain('work that has 2 or more distinct steps')
})

test('todoInstruction replaces the body of the prompt section', { options: { todoInstruction: '  Always plan first.  ' } }, async ($, on) => {
  on('prompt.compose', async () => ({ sections: [] }) as never)
  const composed = await $.prompt.compose({ ...COMPOSE, tools: [TODO_TOOL] })
  expect(composed.sections.at(-1)?.text).toBe('# Task list\nAlways plan first.')
})

test('the step setting falls back to 3 and a single step drops the single-step exception', async () => {
  expect(minSteps(undefined)).toBe(3)
  expect(minSteps(0)).toBe(3)
  expect(minSteps(2.5)).toBe(3)
  expect(minSteps('4')).toBe(4)
  const one = todoPrompt(1)
  expect(one).toContain('any work, even of a single step')
  expect(one).not.toContain('single, simple step')
  expect(todoPrompt(3, '   ')).toContain('3 or more distinct steps')
})

test('session start registers the tool and a resumed session gets its list back', async ($, on) => {
  const registered: string[] = []
  mock.clock(on)
  pane(on)
  on('session.start', async (_, e) => ({ cwd: e.cwd }))
  on('command.register', async (_, e) => ({ value: { command: e.name } }))
  on('tool.register', async (_, e) => (registered.push(e.name), { value: { tool: `mcp__session-info__${e.name}` } }) as never)
  on('process.run', async () => ({ value: { exitCode: 128, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }))
  on('session.messages', async () =>
    ({ value: [{ role: 'assistant', text: '', toolUses: [{ tool_use_id: 'u1', tool: TODO_TOOL, input: { todos: TODOS } }] }] }) as never)

  await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })
  expect(registered).toEqual(['todo_write'])

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: '1/3 done' })).toBeDefined()
  await ui.unmount()
})

test('showTodos false leaves out the tool, the prompt section and the section', { options: { showTodos: false } }, async ($, on) => {
  pane(on)
  on('prompt.compose', async () => ({ sections: [{ id: 'intro', text: 'Hi', scope: 'shared' }] }) as never)
  const composed = await $.prompt.compose({ ...COMPOSE, tools: [TODO_TOOL] })
  expect(composed.sections.map(s => s.id)).toEqual(['intro'])

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /Todos/ })).toBeUndefined()
  await ui.unmount()
})

test('lists parse, count and come back from the transcript', async () => {
  expect(parseTodos({ todos: 'x' })).toBe('`todos` must be an array of { content, status }.')
  expect(parseTodos({ todos: [{ content: ' ', status: 'pending' }] })).toBe('todos[0].content must be a non-empty string.')
  expect(parseTodos({ todos: [{ content: ' a ', status: 'pending', activeForm: '' }] })).toEqual([{ content: 'a', status: 'pending' }])
  expect(todoSummary([])).toBe('')
  expect(todoReply([])).toBe('Task list cleared.')
  const list = parseTodos({ todos: TODOS })
  expect(typeof list === 'string' ? list : todoSummary(list)).toBe('1/3 done')
  const older = { toolUses: [{ tool: TODO_TOOL, input: { todos: [{ content: 'old', status: 'pending' }] } }] }
  const failed = { toolUses: [{ tool: TODO_TOOL, input: { todos: 'bad' }, isError: true as const }] }
  expect(latestTodos([older, failed])).toEqual([{ content: 'old', status: 'pending' }])
  expect(latestTodos([{ toolUses: [] }])).toBeUndefined()
})

test('/clear empties the task list and the last turn; a resume keeps them', async ($, on) => {
  pane(on)
  on('classic.SessionStart', async () => ({}))
  on('turn.start', async (_, e) => ({ turnId: e.turnId }))
  on('turn.complete', async (_, e) => ({ text: e.answer }))
  await $.tool.call({ tool: TODO_TOOL, todos: TODOS } as never)
  await $.turn.start({ text: 'go', turnId: 't1' })
  await $.turn.complete({ answer: '', durationMs: 1_000, isAborted: false, turnId: 't1', reason: 'answer' })

  await $.classic.SessionStart({ source: 'resume' })
  const kept = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await kept.find({ type: 'Text', text: '1/3 done' })).toBeDefined()
  expect(await kept.find({ type: 'Text', text: /^No turn finished yet/ })).toBeUndefined()
  await kept.unmount()

  await $.classic.SessionStart({ source: 'clear' })
  const cleared = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await cleared.find({ type: 'Text', text: /^No task list yet/ })).toBeDefined()
  expect(await cleared.find({ type: 'Text', text: 'No turn finished yet.' })).toBeDefined()
  await cleared.unmount()
})
