import type { CiJob, CiRun, CiTriggerKind, CiWatch } from '../types'

import { segments } from './checks'
import { duration } from './session'

/** Runs a command and resolves its exit code and output; rejects when the command cannot start. */
export type Runner = (argv: string[]) => Promise<{ exitCode: number; stdout: string; stderr: string }>

/** How often the section asks GitHub while a run is open. */
export const CI_POLL_MS = 15_000

/** How long after a push the section looks for the runs it started: GitHub lists a run some seconds after the push. */
export const CI_DISCOVER_MS = 120_000

/** Runs the section draws. */
export const CI_ROOM = 3

const RUN_FIELDS = 'databaseId,workflowName,displayTitle,headBranch,headSha,status,conclusion,url,createdAt,updatedAt'

export type CiTrigger = { kind: CiTriggerKind; runId?: number }

const runIdIn = (text: string): number | undefined => {
  const id = /\/actions\/runs\/(\d+)/.exec(text)?.[1]

  return id === undefined ? undefined : Number(id)
}

/** What a shell command did that starts GitHub Actions runs; undefined for any other command. */
export function ciTrigger(command: string, output: string): CiTrigger | undefined {
  for (const segment of segments(command)) {
    if (/^git\s+push(?=\s|$)/.test(segment) && !/\s(?:--dry-run|-n)(?=\s|$)/.test(segment)) return { kind: 'push' }
    if (/^gh\s+pr\s+create(?=\s|$)/.test(segment)) return { kind: 'pr' }
    if (/^gh\s+workflow\s+run(?=\s|$)/.test(segment)) {
      const runId = runIdIn(output)

      return runId === undefined ? { kind: 'workflow' } : { kind: 'workflow', runId }
    }
    const rerun = /^gh\s+run\s+rerun\s+(\d+)/.exec(segment)?.[1]
    if (rerun !== undefined) return { kind: 'rerun', runId: Number(rerun) }
  }

  return undefined
}

/** A new watch: a push or a pull request follows the runs of the HEAD commit; a dispatch or a rerun follows its run. */
export function startWatch(trigger: CiTrigger, head: { sha?: string; branch?: string }, now: number): CiWatch {
  return {
    trigger: trigger.kind,
    since: now,
    ...(head.sha === undefined ? {} : { sha: head.sha }),
    ...(head.branch === undefined ? {} : { branch: head.branch }),
    runIds: trigger.runId === undefined ? [] : [trigger.runId],
    runs: [],
  }
}

const text = (value: unknown): string => (typeof value === 'string' ? value : '')

const time = (value: unknown): number => {
  const at = Date.parse(text(value))

  return Number.isNaN(at) ? 0 : at
}

const toJob = (raw: Record<string, unknown>): CiJob => ({ name: text(raw.name), status: text(raw.status), conclusion: text(raw.conclusion) })

/** One run from `gh run list` or `gh run view` JSON; `jobs` kept from `prev` when the reading has none. */
export function toRun(raw: Record<string, unknown>, prev?: CiRun): CiRun {
  const jobs = Array.isArray(raw.jobs) ? raw.jobs.map(job => toJob(job as Record<string, unknown>)) : (prev?.jobs ?? [])

  return {
    id: Number(raw.databaseId),
    workflow: text(raw.workflowName) || text(raw.name),
    title: text(raw.displayTitle),
    branch: text(raw.headBranch),
    sha: text(raw.headSha),
    status: text(raw.status),
    conclusion: text(raw.conclusion),
    url: text(raw.url),
    createdAt: time(raw.createdAt),
    updatedAt: time(raw.updatedAt),
    jobs,
  }
}

export const isDone = (run: CiRun): boolean => run.status === 'completed'

const isDiscovering = (watch: CiWatch, now: number): boolean => watch.runIds.length === 0 && now - watch.since < CI_DISCOVER_MS

/** Whether the next tick has anything to ask GitHub. */
export const isWatching = (watch: CiWatch | null, now: number): watch is CiWatch =>
  watch !== null && watch.error === undefined && (isDiscovering(watch, now) || watch.runs.some(run => !isDone(run)) || watch.runs.length < watch.runIds.length)

async function gh(run: Runner, args: string[]): Promise<unknown> {
  const done = await run(['gh', ...args]).catch(() => undefined)
  if (done === undefined) throw new Error('gh not found: install the GitHub CLI and run gh auth login')
  if (done.exitCode !== 0) throw new Error((done.stderr || done.stdout).trim().split('\n')[0] || `gh exited with ${done.exitCode}`)

  return JSON.parse(done.stdout)
}

/**
 * One tick: lists the runs of the commit while the push is recent, then reads each open run with its jobs.
 * Resolves the next watch and the runs that completed in this tick; an error from gh ends the watch with its message.
 */
export async function pollWatch(run: Runner, watch: CiWatch, now: number): Promise<{ watch: CiWatch; finished: CiRun[] }> {
  try {
    const runs = new Map(watch.runs.map(one => [one.id, one]))
    if (isDiscovering(watch, now)) {
      const filter = watch.sha === undefined ? ['--event', 'workflow_dispatch', '--limit', '5'] : ['--commit', watch.sha, '--limit', '20']
      const listed = (await gh(run, ['run', 'list', ...filter, '--json', RUN_FIELDS])) as Record<string, unknown>[]
      for (const raw of listed) {
        const found = toRun(raw, runs.get(Number(raw.databaseId)))
        // A dispatch has no commit to match: only a run created after it counts.
        if (watch.sha !== undefined || found.createdAt >= watch.since - CI_POLL_MS) runs.set(found.id, found)
      }
    }
    for (const id of watch.runIds) if (!runs.has(id)) runs.set(id, { ...toRun({ databaseId: id }), status: 'queued' })

    const finished: CiRun[] = []
    for (const [id, known] of runs) {
      // A run read as completed before keeps its last reading; one first seen completed is read once, for its jobs.
      if (watch.runs.some(one => one.id === id && isDone(one))) continue
      const raw = (await gh(run, ['run', 'view', String(id), '--json', `${RUN_FIELDS},jobs`])) as Record<string, unknown>
      const read = toRun(raw, known)
      if (isDone(read) && !isDone(known)) finished.push(read)
      runs.set(id, read)
    }
    const sorted = [...runs.values()].sort((a, b) => b.createdAt - a.createdAt)

    return { watch: { ...watch, runs: sorted }, finished }
  } catch (error) {
    return { watch: { ...watch, error: error instanceof Error ? error.message : String(error) }, finished: [] }
  }
}

export const CI_STATUS = {
  success: { glyph: '✓', color: 'success' },
  failure: { glyph: '✖', color: 'error' },
  cancelled: { glyph: '⊘', color: 'warning' },
  skipped: { glyph: '○', color: 'inactive' },
  running: { glyph: '⟳', color: 'suggestion' },
  queued: { glyph: '◌', color: 'inactive' },
} as const

export type CiState = keyof typeof CI_STATUS

/** One state for a run or a job from its status and conclusion. */
export function stateOf(item: { status: string; conclusion: string }): CiState {
  if (item.status !== 'completed') return item.status === 'in_progress' ? 'running' : 'queued'
  if (item.conclusion === 'success') return 'success'
  if (item.conclusion === 'cancelled') return 'cancelled'
  if (item.conclusion === 'skipped' || item.conclusion === 'neutral') return 'skipped'

  return 'failure'
}

/** The header: `⟳ running` while a run is open, else the worst conclusion; '' with no runs. */
export function watchState(watch: CiWatch): CiState | undefined {
  if (watch.runs.length === 0) return undefined
  const states = watch.runs.map(stateOf)
  for (const state of ['running', 'queued', 'failure', 'cancelled', 'success', 'skipped'] as const) if (states.includes(state)) return state

  return undefined
}

/** `main · a1b2c3d · 2m 10s`: the time runs while the run is open. */
export function runDetail(run: CiRun, now: number): string {
  const end = isDone(run) ? run.updatedAt : now
  const spent = run.createdAt === 0 ? '' : duration(end - run.createdAt)

  return [run.branch, run.sha.slice(0, 7), spent].filter(part => part !== '').join(' · ')
}

/** The line under a run while nothing lists it yet, or the error that stopped the watch. */
export function waitingText(watch: CiWatch, now: number): string | undefined {
  if (watch.error !== undefined) return undefined
  if (watch.runs.length > 0) return undefined
  const target = watch.sha === undefined ? 'the dispatched workflow' : watch.sha.slice(0, 7)

  return isDiscovering(watch, now) ? `Waiting for the runs of ${target}…` : `No workflow run started for ${target}.`
}
