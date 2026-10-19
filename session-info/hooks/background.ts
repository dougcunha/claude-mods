import type { BackgroundStatus, BackgroundTask } from '../types'

import { duration } from './session'
import type { TaskEnd } from './tasks'

/** The most background commands the section keeps; the oldest finished one drops when a newer starts. */
export const BACKGROUND_LIMIT = 30
/** The most background commands the section lists; a longer list shows the first ones and a count. */
export const BACKGROUND_ROOM = 8
/** The longest command or description the state keeps; a longer one is cut. */
export const TEXT_LIMIT = 1_000
/** The tool that stops a background task; the task it stops sends no notification. */
export const STOP_TOOL = 'TaskStop'

/** Glyph, word and theme color of each status; the word is what a color-blind reader goes by. */
export const BACKGROUND_STATUS = {
  running: { glyph: '⟳', word: 'running', color: 'suggestion' },
  completed: { glyph: '✓', word: 'done', color: 'success' },
  failed: { glyph: '✖', word: 'failed', color: 'error' },
  killed: { glyph: '⊘', word: 'stopped', color: 'warning' },
  ended: { glyph: '•', word: 'ended', color: 'inactive' },
} as const satisfies Record<BackgroundStatus, { glyph: string; word: string; color: string }>

/** The first line of a text that has any, trimmed: what a row draws of a command that spans lines. */
export const firstLine = (text: string): string => (text.split(/\r?\n/).find(line => line.trim() !== '') ?? '').trim()

const kept = (text: string): string => text.trim().slice(0, TEXT_LIMIT)

/**
 * The background task a finished shell call started: its id comes from `backgroundTaskId` in the call's result, so a
 * command that ran to its end, failed or was refused gives none. The text kept is the command and the description
 * the caller wrote, never the output.
 */
export function startedTask(input: Record<string, unknown>, ran: Record<string, unknown>, at: number): BackgroundTask | undefined {
  if (ran.deny !== undefined || ran.isError === true) return undefined
  const result = typeof ran.result === 'object' && ran.result !== null ? (ran.result as Record<string, unknown>) : {}
  const id = result.backgroundTaskId
  if (typeof id !== 'string' || id === '') return undefined
  const command = typeof input.command === 'string' ? kept(input.command) : ''
  const description = typeof input.description === 'string' ? kept(firstLine(input.description)) : ''

  return { id, command, ...(description === '' ? {} : { description }), status: 'running', at }
}

/** The tasks with this one in front, the newest; a task already there under the same id is replaced, and the list is cut to BACKGROUND_LIMIT. */
export const withTask = (tasks: readonly BackgroundTask[], task: BackgroundTask): BackgroundTask[] =>
  [task, ...tasks.filter(one => one.id !== task.id)].slice(0, BACKGROUND_LIMIT)

/** A notification's status as a task status; anything but completed or killed counts as failed. */
export const statusOf = (status: string): BackgroundStatus => (status === 'completed' || status === 'killed' ? status : 'failed')

/** Whether a notification can still set the task's status: it runs, or it ended with no status known. */
const isOpen = (task: BackgroundTask): boolean => task.status === 'running' || task.status === 'ended'

/**
 * The tasks with the one the notification names marked as ended; the same array when it names none open. A task the
 * stop already took as ended gets the notification's status and keeps the time it ended.
 */
export function withEnd(tasks: BackgroundTask[], end: TaskEnd, at: number): BackgroundTask[] {
  if (!tasks.some(task => task.id === end.taskId && isOpen(task))) return tasks

  return tasks.map(task => (task.id === end.taskId && isOpen(task) ? { ...task, status: statusOf(end.status), endedAt: task.endedAt ?? at } : task))
}

/** The task a `TaskStop` call stopped: the id in its input once the call succeeded; a refused or failed call stops none. */
export function stoppedTaskId(input: Record<string, unknown>, ran: Record<string, unknown>): string | undefined {
  if (ran.deny !== undefined || ran.isError === true) return undefined
  const id = input.task_id

  return typeof id === 'string' && id !== '' ? id : undefined
}

/** The tasks with the stopped one marked killed; the same array when it names none that runs. */
export const withStopped = (tasks: BackgroundTask[], taskId: string, at: number): BackgroundTask[] => withEnd(tasks, { taskId, status: 'killed' }, at)

/**
 * The tasks with each running one that the engine no longer lists in flight marked ended with no status known: a task
 * that ends with no notification, such as one stopped from the tasks dialog, leaves the list this way. The same array
 * when every running task is still in flight.
 */
export function withInFlight(tasks: BackgroundTask[], inFlight: readonly string[], at: number): BackgroundTask[] {
  const isGone = (task: BackgroundTask) => task.status === 'running' && !inFlight.includes(task.id)
  if (!tasks.some(isGone)) return tasks

  return tasks.map(task => (isGone(task) ? { ...task, status: 'ended', endedAt: at } : task))
}

/** The ids of the tasks a stop lists in flight; undefined when the stop has no such list, so nothing is taken as ended. */
export function inFlightIds(stop: { background_tasks?: unknown }): string[] | undefined {
  if (!Array.isArray(stop.background_tasks)) return undefined

  return stop.background_tasks.flatMap(task => {
    const id = typeof task === 'object' && task !== null ? (task as { id?: unknown }).id : undefined

    return typeof id === 'string' ? [id] : []
  })
}

/** Running tasks first, then the ended ones; each group keeps its newest-first order. */
export const orderedTasks = (tasks: readonly BackgroundTask[]): BackgroundTask[] =>
  [...tasks.filter(task => task.status === 'running'), ...tasks.filter(task => task.status !== 'running')]

/** What the task is called: the description its caller wrote, else the command. */
export const taskLabel = (task: BackgroundTask): string => task.description ?? (task.command === '' ? task.id : firstLine(task.command))

/** Whether the row has a second line: the command under a description that names it. */
export const hasCommandLine = (task: BackgroundTask): boolean => task.description !== undefined && task.command !== ''

/** The rows the listed tasks take: one line each, and a second for the command under a description. */
export const taskRowCount = (tasks: readonly BackgroundTask[]): number => tasks.reduce((sum, task) => sum + 1 + (hasCommandLine(task) ? 1 : 0), 0)

/** `running · 3m 2s` while it runs, `done · 12s` once it ended: the time it has run or ran for. */
export function taskState(task: BackgroundTask, now: number): string {
  const word = BACKGROUND_STATUS[task.status].word

  return `${word} · ${duration((task.endedAt ?? now) - task.at)}`
}

/** `2 running · 1 done · 1 failed`, or `none`. */
export function backgroundSummary(tasks: readonly BackgroundTask[]): string {
  if (tasks.length === 0) return 'none'
  const count = (status: BackgroundStatus) => tasks.filter(task => task.status === status).length
  const parts = (Object.keys(BACKGROUND_STATUS) as BackgroundStatus[]).map(status => [count(status), BACKGROUND_STATUS[status].word] as const)

  return parts.filter(([total]) => total > 0).map(([total, word]) => `${total} ${word}`).join(' · ')
}
