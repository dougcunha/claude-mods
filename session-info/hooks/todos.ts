import type { Todo, TodoStatus } from '../types'

/** The short name the mod registers; the model calls it by TODO_TOOL. */
export const TODO_NAME = 'todo_write'
export const TODO_TOOL = `mcp__session-info__${TODO_NAME}` as const

/** Rows the section draws before the rest fold into `… N more`. */
export const TODO_ROOM = 12

const STATUSES: readonly TodoStatus[] = ['pending', 'in_progress', 'completed', 'cancelled']

export const TODO_STATUS = {
  pending: { glyph: '○', color: 'inactive' },
  in_progress: { glyph: '◐', color: 'suggestion' },
  completed: { glyph: '✓', color: 'success' },
  cancelled: { glyph: '⊘', color: 'inactive' },
} as const satisfies Record<TodoStatus, { glyph: string; color: string }>

export const TODO_SPEC = {
  name: TODO_NAME,
  description:
    'Write the task list for the current work. The person sees it live in the session-info pane. ' +
    'Send the whole list on each call: it replaces the previous list. ' +
    'Keep exactly one task in_progress while you work. ' +
    'Mark a task completed as soon as it is done, not in batches at the end. ' +
    'Use cancelled for a task that is no longer needed.',
  inputSchema: {
    type: 'object',
    properties: {
      todos: {
        type: 'array',
        description: 'The full task list, in the order the tasks are done.',
        items: {
          type: 'object',
          properties: {
            content: { type: 'string', description: 'The task in the imperative, for example "Add tests for the parser".' },
            status: { type: 'string', enum: [...STATUSES] },
            activeForm: { type: 'string', description: 'The task as it runs, for example "Adding tests for the parser".' },
          },
          required: ['content', 'status'],
        },
      },
    },
    required: ['todos'],
  },
  isDeferred: false,
} as const

/** Steps a piece of work needs before the prompt asks for a list, when the setting names none. */
export const TODO_MIN_STEPS = 3

/** The setting as a step count: a whole number from 1, else the default. */
export function minSteps(value: unknown): number {
  const steps = typeof value === 'number' ? value : Number(value)

  return Number.isInteger(steps) && steps >= 1 ? steps : TODO_MIN_STEPS
}

/**
 * The system prompt section that tells the model when to keep the list: work of `steps` or more distinct steps.
 * A custom instruction from the settings replaces the body under the heading.
 */
export function todoPrompt(steps: number, custom?: unknown): string {
  const own = typeof custom === 'string' ? custom.trim() : ''
  if (own !== '') return `# Task list\n${own}`
  const work = steps === 1 ? 'any work, even of a single step' : `work that has ${steps} or more distinct steps`

  return [
    '# Task list',
    `Use the ${TODO_TOOL} tool to plan and track ${work}, or when the user gives several tasks at once.`,
    'Write the list before you start the work. Update it each time a task starts or ends, so the list always shows the current state.',
    steps === 1 ? 'Do not use it for a question that needs only an answer.' : 'Do not use it for a single, simple step or for a question that needs only an answer.',
  ].join('\n')
}

/** The list from a call's input, or why the input is not a list. */
export function parseTodos(input: Record<string, unknown>): Todo[] | string {
  const list = input.todos
  if (!Array.isArray(list)) return '`todos` must be an array of { content, status }.'
  const todos: Todo[] = []
  for (const [index, item] of list.entries()) {
    const entry = (typeof item === 'object' && item !== null ? item : {}) as Record<string, unknown>
    const content = typeof entry.content === 'string' ? entry.content.trim() : ''
    const status = entry.status as TodoStatus
    if (content === '') return `todos[${index}].content must be a non-empty string.`
    if (!STATUSES.includes(status)) return `todos[${index}].status must be one of ${STATUSES.join(', ')}.`
    const activeForm = typeof entry.activeForm === 'string' ? entry.activeForm.trim() : ''
    todos.push({ content, status, ...(activeForm === '' ? {} : { activeForm }) })
  }

  return todos
}

/** `2/5 done`, cancelled tasks left out of both counts; '' for no list. */
export function todoSummary(todos: readonly Todo[]): string {
  const live = todos.filter(todo => todo.status !== 'cancelled')
  if (live.length === 0) return ''

  return `${live.filter(todo => todo.status === 'completed').length}/${live.length} done`
}

/** What the model reads after a call. */
export function todoReply(todos: readonly Todo[]): string {
  if (todos.length === 0) return 'Task list cleared.'
  const current = todos.find(todo => todo.status === 'in_progress')

  return `Task list updated: ${todoSummary(todos) || 'no open tasks'}.${current ? ` In progress: ${current.content}.` : ''}`
}

/** The row text: the running form of the task in progress, else the task. */
export const todoText = (todo: Todo): string => (todo.status === 'in_progress' ? (todo.activeForm ?? todo.content) : todo.content)

type ToolUse = { tool: string; input: Record<string, unknown>; isError?: true }

/** The list of the last good call in the transcript, for a resumed session; undefined when there is none. */
export function latestTodos(messages: readonly { toolUses?: readonly ToolUse[] }[]): Todo[] | undefined {
  for (const message of [...messages].reverse()) {
    for (const use of [...(message.toolUses ?? [])].reverse()) {
      if (use.tool !== TODO_TOOL || use.isError) continue
      const todos = parseTodos(use.input)
      if (typeof todos !== 'string') return todos
    }
  }

  return undefined
}
