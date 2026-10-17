import type { CheckRun, Checks } from '../types'

import { checkRuns, MAX_READ } from './checks'
import type { Host } from './host'

/** A background task's end, as its notification reports it; `status` is `completed`, `failed` or `killed`. */
export type TaskEnd = { taskId: string; status: string; outputFile?: string }

const NOTIFICATION = /<task-notification>([\s\S]*?)<\/task-notification>/g

const tag = (block: string, name: string): string | undefined =>
  block.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`))?.[1]?.trim() || undefined

/** The task ends a notification prompt reports; the engine can deliver several in one prompt. */
export function taskEnds(text: string): TaskEnd[] {
  return [...text.matchAll(NOTIFICATION)].flatMap(([, block = '']) => {
    const taskId = tag(block, 'task-id')
    const status = tag(block, 'status')
    const outputFile = tag(block, 'output-file')
    if (taskId === undefined || status === undefined) return []

    return [{ taskId, status, ...(outputFile === undefined ? {} : { outputFile }) }]
  })
}

/** The text blocks of a row, joined: where a queued notification carries its `<task-notification>` blocks. */
export const blocksText = (content: readonly unknown[]): string =>
  content
    .flatMap(block => {
      const text = typeof block === 'object' && block !== null ? (block as { type?: unknown; text?: unknown }) : {}

      return text.type === 'text' && typeof text.text === 'string' ? [text.text] : []
    })
    .join('\n')

/** Whether a person sent the row: their prompt can quote a notification, which ends no task. */
export const isPersonOrigin = (kind: string): boolean => kind === 'composer' || kind === 'bridge'

const isWaiting =(run: CheckRun | null, taskId: string): run is CheckRun => run?.status === 'running' && run.taskId === taskId

/** The checks a background command ran, read from its output file now that its task ended; empty when no check waits on it. */
export async function finishedRuns(host: Host, checks: Checks, end: TaskEnd, at: number): Promise<CheckRun[]> {
  const waiting = [checks.build, checks.test].filter((run): run is CheckRun => isWaiting(run, end.taskId))
  const [first] = waiting
  if (first === undefined) return []
  const text = end.outputFile === undefined ? '' : await host.readFile(end.outputFile).catch(() => '')

  return checkRuns(host, waiting.map(run => run.kind), {
    command: first.command,
    text: text.slice(-MAX_READ),
    isError: end.status !== 'completed',
    isAgent: first.isAgent,
  }, at)
}

/** Puts each finished run in place of the record that still waits on its task; a newer run of that kind stays. */
export const withFinished = (checks: Checks, end: TaskEnd, runs: readonly CheckRun[]): Checks =>
  runs.reduce((all, run) => (isWaiting(all[run.kind], end.taskId) ? { ...all, [run.kind]: run } : all), checks)
