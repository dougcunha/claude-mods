import type { VersionInfo } from '../types'

import type { Host } from './host'
import { norm } from './paths'

/** The `$.store` key of the last update check: when it ran, the version it found and the version the person was told about. */
export const UPDATE_STORE = 'updateCheck'

/** The published manifest of the mod; its `version` is the latest release. */
export const UPDATE_URL = 'https://raw.githubusercontent.com/dougcunha/claude-mods/main/session-info/.claude-plugin/plugin.json'

/** The marketplace command that delivers a new version; the pane puts it in the prompt for the person to send. */
export const UPDATE_COMMAND = '/plugin marketplace update claude-mods'

/** How long a check stays valid: the mod asks GitHub at most once in this time, across sessions. */
export const UPDATE_CHECK_MS = 24 * 3_600_000

/** After a failed check (offline, refused by policy, no version in the answer) the next one waits this long. */
export const UPDATE_RETRY_MS = 3_600_000

/** How often a running session looks at whether a check is due. */
export const UPDATE_TICK_MS = 3_600_000

export const NO_VERSION: VersionInfo = { current: null, latest: null }

/** What `$.store` keeps between sessions. */
export type UpdateRecord = { checkedAt: number; latest: string; notified: string }

const VERSION = /^\d+\.\d+\.\d+$/

const NO_RECORD: UpdateRecord = { checkedAt: 0, latest: '', notified: '' }

/** The `version` of a plugin.json text; undefined for anything that is not a manifest with a plain x.y.z version. */
export function versionOf(text: string): string | undefined {
  try {
    const manifest: unknown = JSON.parse(text)
    if (typeof manifest !== 'object' || manifest === null) return undefined
    const version = (manifest as { version?: unknown }).version

    return typeof version === 'string' && VERSION.test(version) ? version : undefined
  } catch {
    return undefined
  }
}

/** Whether `latest` is a higher x.y.z than `current`. */
export function isNewer(latest: string, current: string): boolean {
  if (!VERSION.test(latest) || !VERSION.test(current)) return false
  const higher = latest.split('.').map(Number)
  const lower = current.split('.').map(Number)
  const index = higher.findIndex((part, at) => part !== lower[at])

  return index >= 0 && (higher[index] ?? 0) > (lower[index] ?? 0)
}

/** Reads the stored record, which another version of the mod or a person may have left in any shape. */
export function readRecord(value: unknown): UpdateRecord {
  if (typeof value !== 'object' || value === null) return NO_RECORD
  const { checkedAt, latest, notified } = value as Record<string, unknown>

  return {
    checkedAt: typeof checkedAt === 'number' ? checkedAt : 0,
    latest: typeof latest === 'string' && VERSION.test(latest) ? latest : '',
    notified: typeof notified === 'string' && VERSION.test(notified) ? notified : '',
  }
}

/** The version this copy of the mod runs, from its own manifest; undefined when it cannot be read. */
export async function installedVersion(host: Host, root: string): Promise<string | undefined> {
  const text = await host.readFile(`${norm(root).replace(/\/$/, '')}/.claude-plugin/plugin.json`).catch(() => undefined)

  return text === undefined ? undefined : versionOf(text)
}

/** Asks GitHub for the published version when the record is older than a day; any failure leaves the record and tries again in an hour. */
export async function checkUpdate(host: Host, record: UpdateRecord, now: number): Promise<UpdateRecord> {
  if (now - record.checkedAt < UPDATE_CHECK_MS) return record

  const answer = await host.fetchText(UPDATE_URL).catch(() => undefined)
  const latest = answer?.ok === true ? versionOf(answer.text) : undefined

  return latest === undefined
    ? { ...record, checkedAt: now - UPDATE_CHECK_MS + UPDATE_RETRY_MS }
    : { ...record, checkedAt: now, latest }
}

/** The newer version the record knows, else null. */
export const newerVersion = (record: UpdateRecord, current: string | undefined): string | null =>
  current !== undefined && record.latest !== '' && isNewer(record.latest, current) ? record.latest : null

/** The toast that tells about a new version, once per version. */
export const updateToast = (latest: string, current: string): string =>
  `session-info ${latest} is available (you have ${current}). Press ↑ ${latest} at the bottom of the pane to update.`
