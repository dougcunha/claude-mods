import type { CacheHold, CacheState, CacheTtl, KeepWarm } from '../types'

import type { Host } from './host'
import { tokens } from './session'

const MINUTE_MS = 60_000
const HOUR_MS = 60 * MINUTE_MS

/** How long each TTL keeps an entry after the last request that read or wrote it. */
export const TTL_MS = { '5m': 5 * MINUTE_MS, '1h': HOUR_MS } as const satisfies Record<CacheTtl, number>

/** The longest stretch before expiry that the cache counts as cooling; a short TTL cools over its last fifth. */
const COOLING_MS = 5 * MINUTE_MS

/** A request with less input than this tells nothing about the TTL: a small prefix can sit under the cache's minimum. */
const JUDGE_MIN_TOKENS = 30_000

/** An idle gap past the short TTL, with a margin for the time a request takes. */
const SHORT_GAP_MS = 5.5 * MINUTE_MS

/** A request that writes more than this share of its input wrote the context to the cache again. */
const WRITE_SHARE = 0.5

/** A request that reads more than this share of its input from the cache found it warm. */
const READ_SHARE = 0.8

/** A keep-warm ping that writes more than this share of what it reads missed the cache. */
const PING_MISS_SHARE = 0.1

/** The one message a keep-warm ping sends over the conversation; its reply is thrown away. */
export const KEEP_WARM_PROMPT = 'session-info keep-warm ping. Reply with only: ok'

/** The TTL setting: `auto` follows the plan and the session's requests; `5m` and `1h` fix it. */
export type TtlSetting = 'auto' | CacheTtl

/** The cache before the first request: the TTL waits for the plan, the first request sets it. */
export const NO_CACHE: CacheState = { ttl: '1h', ttlSource: 'plan', tokens: 0, restarts: 0, restartTokens: 0, isAfterCompact: false }

/** Token counts of one request, in the API's spelling. */
export type CacheUsage = { input_tokens: number; cache_read_input_tokens: number; cache_creation_input_tokens: number }

/** One main-thread request: its usage, when it started and ended, and whether the account reports plan limits. */
export type CacheRequest = { usage: CacheUsage; startedAt: number; endedAt: number; hasPlanLimits: boolean }

export type CacheKind = 'unknown' | 'warm' | 'cooling' | 'cold' | 'kept'

/** The cache now: warm, cooling or kept with `ms` left, cold for `ms`, or unknown before the first request. */
export type CacheStatus = { kind: 'unknown' } | { kind: Exclude<CacheKind, 'unknown'>; ms: number }

export const CACHE_STATUS = {
  unknown: { glyph: '·', color: undefined },
  warm: { glyph: '●', color: 'success' },
  cooling: { glyph: '◐', color: 'warning' },
  cold: { glyph: '○', color: 'error' },
  kept: { glyph: '◆', color: 'suggestion' },
} as const satisfies Record<CacheKind, { glyph: string; color: string | undefined }>

/** A prompt as `prompt.submit` receives it, as far as the guard reads it. */
export type Submission = { text: string; origin: { kind: string }; turnId?: string; command?: unknown; isMeta?: true }

/** What decides a hold: the cache now, the context the prompt would write, and the guard's minimum. */
export type HoldGate = { status: CacheStatus; tokens: number; minTokens: number }

/** What a keep-warm ping did: read the cache, missed it and wrote it, or got no answer. */
export type PingVerdict = 'hit' | 'miss' | 'none'

export const ttlSetting = (value: unknown): TtlSetting => (value === '5m' || value === '1h' ? value : 'auto')

/** The TTL in use: the setting when it fixes one, else what the session found. */
export const ttlOf = (state: CacheState, setting: TtlSetting): CacheTtl => (setting === 'auto' ? state.ttl : setting)

const totalOf = (usage: CacheUsage): number => usage.input_tokens + usage.cache_read_input_tokens + usage.cache_creation_input_tokens

/**
 * The cache after a main-thread request. A plan account is on the 1-hour TTL and an API account on 5 minutes; then
 * the requests correct it: a re-cache after an idle gap between the two TTLs shows 5 minutes, and a warm read after a
 * gap past 5 minutes shows 1 hour. The first request after a compaction writes the shorter context, which is no restart.
 */
export function withRequest(state: CacheState, request: CacheRequest): CacheState {
  const total = totalOf(request.usage)
  const written = request.usage.cache_creation_input_tokens
  const gap = state.touchedAt === undefined ? undefined : request.startedAt - state.touchedAt
  const planTtl: CacheTtl = request.hasPlanLimits ? '1h' : '5m'
  // The plan limits can still be empty right after the first response; only a later one makes an empty list mean an API key.
  const isPlanKnown = state.ttlSource === 'plan' && (request.hasPlanLimits || state.touchedAt !== undefined)
  const touched: CacheState = {
    ...state,
    touchedAt: request.endedAt,
    tokens: total,
    isAfterCompact: false,
    ...(isPlanKnown ? { ttl: planTtl } : {}),
  }
  if (state.isAfterCompact || gap === undefined || total < JUDGE_MIN_TOKENS) return touched
  const canMeasure = state.ttlSource !== 'switch' && gap > SHORT_GAP_MS
  if (written / total > WRITE_SHARE) {
    const restarted = { ...touched, restarts: state.restarts + 1, restartTokens: state.restartTokens + written }

    return canMeasure && gap < HOUR_MS ? { ...restarted, ttl: '5m', ttlSource: 'measured' } : restarted
  }
  if (canMeasure && request.usage.cache_read_input_tokens / total > READ_SHARE) return { ...touched, ttl: '1h', ttlSource: 'measured' }

  return touched
}

/** A model switch names the TTL; a new model has no cache yet, while the same model restored on a resume keeps it. */
export const withSwitch = (state: CacheState, ttl: CacheTtl, isNewModel: boolean): CacheState =>
  isNewModel
    ? { ttl, ttlSource: 'switch', tokens: state.tokens, restarts: state.restarts, restartTokens: state.restartTokens, isAfterCompact: state.isAfterCompact }
    : { ...state, ttl, ttlSource: 'switch' }

export const withCompact = (state: CacheState): CacheState => ({ ...state, isAfterCompact: true })

/** What the engine says about a session resumed at start: how long ago the last response came, and the context it left. */
export type Resume = { secondsSince: number; contextTokens?: number }

/** A session resumed at start: the cache dates from the last response, and the context is what that response left. */
export const withResume = (state: CacheState, resume: Resume, at: number): CacheState => ({
  ...state,
  touchedAt: at - resume.secondsSince * 1_000,
  tokens: resume.contextTokens ?? state.tokens,
})

/** The context the next prompt would write: the live reading, which is empty until the first reply of a resumed session, else the last one the cache knew. */
export const contextOf = (reported: number | undefined, state: CacheState): number => (reported !== undefined && reported > 0 ? reported : state.tokens)

/**
 * A load that finds turns behind it, after a reload or an install, takes the end of the last turn as the last touch:
 * its last request ended then. A cache whose requests the mod saw keeps its own touch.
 */
export const withSeed = (state: CacheState, endedAt: number, context: number): CacheState =>
  state.touchedAt === undefined ? { ...state, touchedAt: endedAt, tokens: context } : state

/** A keep-warm ping read the cache, so its entry lives a full TTL again. */
export const withPing = (state: CacheState, at: number): CacheState => ({ ...state, touchedAt: at })

const coolingMs = (ttl: CacheTtl): number => Math.min(COOLING_MS, TTL_MS[ttl] / 5)

export function cacheStatus(state: CacheState, keep: KeepWarm | null, ttl: CacheTtl, at: number): CacheStatus {
  if (state.touchedAt === undefined) return { kind: 'unknown' }
  const expiry = state.touchedAt + TTL_MS[ttl]
  const left = expiry - at
  if (left <= 0) return { kind: 'cold', ms: at - expiry }
  if (keep !== null && keep.until > at) return { kind: 'kept', ms: keep.until - at }

  return { kind: left <= coolingMs(ttl) ? 'cooling' : 'warm', ms: left }
}

/** <1m, 42m, 3h 5m. */
export function span(ms: number): string {
  const minutes = Math.floor(ms / MINUTE_MS)
  if (minutes < 1) return '<1m'
  if (minutes < 60) return `${minutes}m`

  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}

/** The cache row of the Session section: the state in its color (`warm · 42m left`) and the quiet details (`1h TTL`). */
export type CacheParts = { state: string; detail: string }

export function cacheParts(status: CacheStatus, state: CacheState, keep: KeepWarm | null, ttl: CacheTtl): CacheParts {
  const restarts = state.restarts === 0 ? '' : ` · ${state.restarts} re-cache${state.restarts === 1 ? '' : 's'} (${tokens(state.restartTokens)})`
  if (status.kind === 'unknown') return { state: '', detail: `${ttl} TTL · after the next reply${restarts}` }
  if (status.kind === 'cold') return { state: `cold for ${span(status.ms)}`, detail: `next prompt re-caches ${tokens(state.tokens)}${restarts}` }
  if (status.kind === 'kept') return { state: `kept warm · ${span(status.ms)} left`, detail: `${keep?.pings ?? 0} ping${keep?.pings === 1 ? '' : 's'}${restarts}` }
  const left = status.kind === 'cooling' ? `cools in ${span(status.ms)}` : `warm · ${span(status.ms)} left`

  return { state: left, detail: `${ttl} TTL${restarts}` }
}

/** Whether the guard holds the prompt: typed at an idle session, not a command, over a cold cache and a big context. */
export function shouldHold(submission: Submission, gate: HoldGate): boolean {
  if (submission.origin.kind !== 'composer' || submission.turnId !== undefined) return false
  if (submission.command !== undefined || submission.isMeta === true || submission.text.trim() === '') return false

  return gate.status.kind === 'cold' && gate.tokens >= gate.minTokens
}

/** True when the person sent the held prompt again: the engine puts a held prompt back in the box. */
export const isSameMessage = (text: string, held: string): boolean => text.trim() === held.trim()

/** What the transcript shows where the held prompt would have entered; the engine puts the prompt back in the box. */
export const holdText = (hold: CacheHold): string =>
  `session-info: held. The prompt cache expired ${span(hold.coldMs)} ago, and this prompt would write ${tokens(hold.tokens)} tokens to it again. Press Enter to send it, or choose Compact or New session.`

/** Whether keep warm pings now: it runs, the cache is known and cooling, and it is not cold yet. */
export function isPingDue(state: CacheState, keep: KeepWarm | null, ttl: CacheTtl, at: number): boolean {
  if (keep === null || keep.until <= at || state.touchedAt === undefined) return false
  const left = state.touchedAt + TTL_MS[ttl] - at

  return left > 0 && left <= coolingMs(ttl)
}

/** A ping that wrote more than a tenth of what it read did not find the cache: pinging on would only pay for writes. */
export function pingVerdict(usage: CacheUsage | undefined): PingVerdict {
  if (usage === undefined) return 'none'

  return usage.cache_creation_input_tokens > PING_MISS_SHARE * Math.max(1, usage.cache_read_input_tokens) ? 'miss' : 'hit'
}

/** How often, and for how long at most, the move reads the session id after a /clear. */
export const SWITCH_POLL_MS = 100
export const SWITCH_LIMIT_MS = 3_000

/**
 * Clears the session and leaves the held prompt in the new session's box. The box keeps its draft through a /clear;
 * the prompt goes back in only when the box is empty after the switch.
 */
export async function moveToNewSession(host: Host, text: string): Promise<void> {
  const before = await host.sessionId()
  await host.clear()
  for (let waited = 0; waited < SWITCH_LIMIT_MS; waited += SWITCH_POLL_MS) {
    if ((await host.sessionId()) !== before) break
    await host.sleep(SWITCH_POLL_MS)
  }
  if ((await host.readBox()).trim() === '') await host.fill(text)
}
