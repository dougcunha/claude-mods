import type { FileItem } from '../types'

import type { Host } from './host'
import { baseName } from './paths'
import { deleteArgv, expiredRuns, isPurgeable, manifestOf, moveArgv, quarantinedPath, quarantineRoot, runFolder, trashArgv } from './remove'
import type { Platform, RemoveMode } from './remove'

/** A file the mod could not remove, and why. */
export type Failure = { path: string; reason: string }

/** What became of each chosen file. */
export type Outcome = { removed: string[]; quarantined: string[]; failed: Failure[] }

/** What the removal needs besides the host. */
export type RemoveInput = { platform: Platform; mode: RemoveMode; home?: string; now: number }

/** The longest reason the pane shows for a failure. */
const REASON_LIMIT = 120

/** A short reason from a command's error output: the common causes in plain words, else its first line. */
export function reasonOf(stderr: string): string {
  if (/being used by another process|resource busy|text file busy/i.test(stderr)) return 'in use by another program'
  if (/access (to the path .* )?is denied|permission denied|operation not permitted|unauthorizedaccess/i.test(stderr)) return 'access denied'
  if (/cannot find (path|the path)|no such file|does not exist/i.test(stderr)) return 'not found'
  const line = stderr
    .split(/\r?\n/)
    .map(one => one.trim())
    .find(one => one !== '' && !/^(At line|\+|CategoryInfo|FullyQualifiedErrorId)/i.test(one))

  return line === undefined ? 'the command left it in place' : line.length > REASON_LIMIT ? `${line.slice(0, REASON_LIMIT - 1)}…` : line
}

type Ran = { exitCode: number; stderr: string }

const ran = (host: Host, argv: string[]): Promise<Ran> =>
  host.run(argv).then(
    result => ({ exitCode: result.exitCode, stderr: result.stderr ?? '' }),
    error => ({ exitCode: 1, stderr: error instanceof Error ? error.message : String(error) }),
  )

/** Moves the items to one quarantine run folder, with a manifest of where each came from; answers the ones moved. */
async function quarantine(host: Host, items: FileItem[], input: RemoveInput): Promise<{ moved: string[]; failed: Failure[] }> {
  if (input.home === undefined) return { moved: [], failed: items.map(item => ({ path: item.path, reason: 'no home folder for the quarantine' })) }
  const run = runFolder(quarantineRoot(input.home), input.now)
  const moves: { from: string; to: string }[] = []
  const failed: Failure[] = []
  await host.writeFile(`${run}/manifest.json`, manifestOf(input.now, []))
  for (const [index, item] of items.entries()) {
    const to = quarantinedPath(run, index, item.path)
    const result = await ran(host, moveArgv(input.platform, item.path, to))
    if (!(await host.exists(item.path)) && (await host.exists(to))) moves.push({ from: item.path, to })
    else failed.push({ path: item.path, reason: reasonOf(result.stderr) })
  }
  await host.writeFile(`${run}/manifest.json`, manifestOf(input.now, moves))

  return { moved: moves.map(move => move.from), failed }
}

/** Removes the chosen files by the mode; a trash that leaves a file sends it to the quarantine, unless another program holds it. */
export async function removeItems(host: Host, items: FileItem[], input: RemoveInput): Promise<Outcome> {
  const outcome: Outcome = { removed: [], quarantined: [], failed: [] }
  const toQuarantine: FileItem[] = []
  for (const item of items) {
    if (input.mode === 'quarantine') {
      toQuarantine.push(item)
      continue
    }
    const argv = input.mode === 'trash' ? trashArgv(input.platform, item.path, item.isFolder) : deleteArgv(input.platform, item.path)
    const result = await ran(host, argv)
    if (!(await host.exists(item.path))) outcome.removed.push(item.path)
    else {
      const reason = reasonOf(result.stderr)
      // A file another program holds cannot move either: the quarantine would fail the same way.
      if (input.mode === 'trash' && reason !== 'in use by another program') toQuarantine.push(item)
      else outcome.failed.push({ path: item.path, reason })
    }
  }
  if (toQuarantine.length > 0) {
    const moved = await quarantine(host, toQuarantine, input)
    outcome.quarantined.push(...moved.moved)
    outcome.failed.push(...moved.failed)
  }

  return outcome
}

/** Past this many failures with one reason, the result names the count instead of each file. */
const NAMED_FAILURES = 3

/** The result lines of a removal: one for what was removed, then the failures by reason, each line starting with ✗. */
export function outcomeLines(outcome: Outcome, mode: RemoveMode): string[] {
  const done: string[] = []
  const verb = mode === 'trash' ? 'Sent to the trash' : 'Deleted'
  if (outcome.removed.length > 0) done.push(`${verb}: ${outcome.removed.length}`)
  if (outcome.quarantined.length > 0) done.push(`moved to the quarantine: ${outcome.quarantined.length}`)
  const byReason = new Map<string, string[]>()
  for (const failure of outcome.failed) byReason.set(failure.reason, [...(byReason.get(failure.reason) ?? []), failure.path])
  const failed = [...byReason].flatMap(([reason, paths]) =>
    paths.length > NAMED_FAILURES ? [`✗ ${paths.length} entries: ${reason}`] : paths.map(path => `✗ ${baseName(path)}: ${reason}`),
  )

  return [...(done.length > 0 ? [done.join(', ')] : []), ...failed]
}

/** Deletes the quarantine runs older than `days`; a path outside the quarantine root is never deleted. */
export async function purgeQuarantine(host: Host, platform: Platform, home: string, now: number, days: number): Promise<number> {
  const root = quarantineRoot(home)
  const names = (await host.list(root).catch(() => [])).filter(entry => entry.kind === 'directory').map(entry => entry.name)
  let count = 0
  for (const path of expiredRuns(root, names, now, days)) {
    if (!isPurgeable(root, path)) continue
    await ran(host, deleteArgv(platform, path))
    if (!(await host.exists(path))) count += 1
  }

  return count
}
