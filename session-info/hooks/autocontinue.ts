import type { AutoContinue, ContinueRun, Todo } from '../types'

/** The `$.store` key of the auto-continue switch; the store outlives the session, so the switch stays as the person left it. */
export const CONTINUE_STORE = 'autoContinueOn'

export const NO_CONTINUE: AutoContinue = { count: 0, total: 0, last: null }

/** Continues in a row after one prompt of the person's; past them the turn ends, so a loop that makes no progress stops. */
export const MAX_CONTINUES = 5

/** The last lines of a reply that may hold its question: a status line or a note can follow it. */
const QUESTION_LINES = 3

/** Markdown that can close a line after its question mark: emphasis, code and a closing bracket. */
const TRAILING_MARKUP = /[\s*_`)\]]+$/

/** What the Stop event and the state say at the end of a main-loop turn. */
export type StopFacts = {
  isOn: boolean
  todos: readonly Todo[]
  lastMessage: string
  hasPendingWork: boolean
  state: AutoContinue
}

const isOpen = (todo: Todo): boolean => todo.status === 'pending' || todo.status === 'in_progress'

/** The open tasks as one text, so a stop with the same open tasks as the last continue shows that nothing moved. */
export const openTasksKey = (todos: readonly Todo[]): string =>
  todos.filter(isOpen).map(todo => `${todo.status}:${todo.content}`).join('\n')

/** Whether one of the last lines of the reply asks something: the turn then waits for the person's answer. */
export function endsWithQuestion(text: string): boolean {
  const lines = text
    .split('\n')
    .map(line => line.replace(TRAILING_MARKUP, ''))
    .filter(line => line !== '' && !line.startsWith('```'))

  return lines.slice(-QUESTION_LINES).some(line => line.endsWith('?'))
}

/**
 * The text that sends Claude on with the next task, or undefined when the turn should end: the switch is off, no task
 * is open, background work or a scheduled wake-up will start the next turn, the reply asks the person something, the
 * limit of continues in a row is reached, or the open tasks are the same as at the last continue.
 */
export function continueReason(facts: StopFacts): string | undefined {
  const open = facts.todos.filter(isOpen)
  if (!facts.isOn || open.length === 0 || facts.hasPendingWork) return undefined
  if (endsWithQuestion(facts.lastMessage)) return undefined
  if (facts.state.count >= MAX_CONTINUES || facts.state.last === openTasksKey(facts.todos)) return undefined

  return [
    `session-info auto-continue: the task list still has ${open.length} open ${open.length === 1 ? 'task' : 'tasks'}. Next: ${nextTask(facts.todos)}.`,
    'Continue with it now, and keep the task list current.',
    'If the next step needs the person: a decision, an approval, a push, a deploy, a message to other people or a change that cannot be undone, stop and ask instead.',
    'If a task is no longer needed, mark it cancelled.',
  ].join('\n')
}

/** The task a continue sends Claude on: the one in progress, else the first pending one. */
export function nextTask(todos: readonly Todo[]): string {
  const open = todos.filter(isOpen)

  return (open.find(todo => todo.status === 'in_progress') ?? open[0])?.content ?? ''
}

/** The state after a continue at `at`: one more in a row and in all, the open tasks it was sent on, and its record. */
export function withContinue(state: AutoContinue, todos: readonly Todo[], at: number, reason: string): AutoContinue {
  const count = state.count + 1

  return {
    count,
    total: state.total + 1,
    last: openTasksKey(todos),
    lastRun: { at, count, next: nextTask(todos), reason },
  }
}

/** The state after a prompt of the person's: the count in a row starts over; the last continue's row stays. */
export const withPrompt = (state: AutoContinue): AutoContinue => ({ ...state, count: 0, last: null })

/** The switch row's right side: `3 continues`; empty before the first one. */
export const continueText = (state: AutoContinue): string =>
  state.total === 0 ? '' : `${state.total} ${state.total === 1 ? 'continue' : 'continues'}`

/** The last continue's row: `Continued 2/5 · next: Write the hook`. */
export const lastContinueText = (run: ContinueRun): string => `Continued ${run.count}/${MAX_CONTINUES} · next: ${run.next}`

/** The transcript line of a continue, as the person reads it: `session-info: auto-continue 2/5, next: Write the hook`. */
export const continueLog = (run: ContinueRun): string => `session-info: auto-continue ${run.count}/${MAX_CONTINUES}, next: ${run.next}`
