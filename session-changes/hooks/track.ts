import type { ChangeStatus, FileChange } from '../types'

import { gitStatus, headText, pathIn, snapshot } from './git'
import type { GitStatus } from './git'
import type { Host } from './host'
import { deletedText, reverse } from './patch'
import type { Hunk } from './patch'
import { absolute, keyOf, norm } from './paths'

type Base = () => Promise<string | undefined>

type BashEditDiff = {
  files: { filePath: string; hunks: Hunk[]; created?: true; deleted?: true }[]
  changedFiles?: string[]
  unavailable?: true
  skipped?: true
}

export const SHELLS = ['Bash', 'PowerShell'] as const

const nothing: Base = async () => undefined
const empty: Base = async () => ''

/** A second touch keeps the first status's meaning: a file made this session stays created. */
function merge(prev: FileChange | undefined, status: ChangeStatus): ChangeStatus | undefined {
  if (prev === undefined) return status
  if (prev.status === 'created') return status === 'deleted' ? undefined : 'created'
  if (prev.status === 'deleted') return status === 'deleted' ? 'deleted' : 'modified'

  return status
}

export async function record(host: Host, path: string, status: ChangeStatus, base: Base): Promise<void> {
  const key = keyOf(path)
  const known = (await host.files())[key]
  const text = known ? undefined : await base().catch(() => undefined)
  const snap = text === undefined ? null : await snapshot(host, path, text).catch(() => null)

  await host.updateFiles(all => {
    const prev = all[key]
    const next = merge(prev, status)
    const { [key]: _, ...rest } = all
    if (next === undefined) return rest

    return { ...rest, [key]: { path: norm(path), status: next, base: prev ? prev.base : snap, at: Date.now() } }
  })
}

async function fromBashDiff(host: Host, cwd: string, diff: BashEditDiff): Promise<void> {
  const seen = new Set<string>()
  for (const file of diff.files) {
    const path = absolute(cwd, file.filePath)
    seen.add(keyOf(path))
    if (file.created) await record(host, path, 'created', empty)
    else if (file.deleted) await record(host, path, 'deleted', async () => deletedText(file.hunks))
    else await record(host, path, 'modified', async () => reverse(await host.readFile(path), file.hunks))
  }
  for (const changed of diff.changedFiles ?? []) {
    const path = absolute(cwd, changed)
    if (seen.has(keyOf(path))) continue
    const isGone = !(await host.exists(path))
    await record(host, path, isGone ? 'deleted' : 'modified', () => headText(host, path))
  }
}

/** What a shell command changed, read off `git status` before and after it. */
async function fromGit(host: Host, before: GitStatus | undefined): Promise<void> {
  const after = before && (await gitStatus(host))
  if (!before || !after) return

  for (const [relative, code] of after.entries) {
    if (before.entries.get(relative) === code) continue
    const path = pathIn(after, relative)
    if (code.includes('D')) await record(host, path, 'deleted', () => headText(host, path))
    else if (code === '??' || code[0] === 'A') await record(host, path, 'created', empty)
    else await record(host, path, 'modified', () => headText(host, path))
  }
  for (const [relative, code] of before.entries) {
    const path = pathIn(after, relative)
    if (code === '??' && !after.entries.has(relative) && !(await host.exists(path)))
      await record(host, path, 'deleted', nothing)
  }
}

/** A tracked file a command removed shows as deleted, whatever removed it. */
async function recheck(host: Host): Promise<void> {
  for (const change of Object.values(await host.files())) {
    if (change.status !== 'deleted' && !(await host.exists(change.path)))
      await record(host, change.path, 'deleted', nothing)
  }
}

export async function track(host: Host, tool: string, result: unknown, before: GitStatus | undefined): Promise<void> {
  const r = result as Record<string, any>
  if (tool === 'Write' && !r.staged)
    return record(host, r.filePath, r.type === 'create' ? 'created' : 'modified', async () =>
      r.type === 'create' ? '' : (r.originalFile ?? (await headText(host, r.filePath))))
  if (tool === 'Edit')
    return record(host, r.filePath, 'modified', async () => r.originalFile ?? (await headText(host, r.filePath)))
  if (tool === 'NotebookEdit') return record(host, r.notebook_path, 'modified', async () => r.original_file)
  if (!(SHELLS as readonly string[]).includes(tool)) return

  const diff = r.bashEditDiff as BashEditDiff | undefined
  if (diff && !diff.unavailable && !diff.skipped) await fromBashDiff(host, await host.cwd(), diff)
  else await fromGit(host, before)
  await recheck(host)
}
