import { tokens } from './session'
import { labelOf, resetIn } from './usage'
import type { Limit } from './usage'

export const USAGE_THRESHOLDS = [80, 90] as const

export const CONTEXT_THRESHOLD = 85

export type Alert = { key: string; title: string; body: string }

type Context = { percent?: number; tokens?: number; window: number }

/** A usage alert's key names its window instance, so a window that resets can alert again. */
const usageKey = (limit: Limit, threshold: number): string => `${limit.kind}@${limit.resetsAt ?? ''}:${threshold}`

const CONTEXT_KEY = `context:${CONTEXT_THRESHOLD}`

/**
 * The thresholds this measurement crosses that have not alerted yet, and the alert keys still standing:
 * a reset window drops its keys, a context back under the threshold drops its key.
 */
export function crossings(
  limits: readonly Limit[],
  context: Context,
  alerted: readonly string[],
  now: number,
): { alerts: Alert[]; standing: string[] } {
  const live = new Set(limits.flatMap(limit => USAGE_THRESHOLDS.map(threshold => usageKey(limit, threshold))))
  const isContextHigh = (context.percent ?? 0) >= CONTEXT_THRESHOLD
  const standing = alerted.filter(key => live.has(key) || (key === CONTEXT_KEY && isContextHigh))
  const alerts: Alert[] = []

  for (const limit of limits) {
    const crossed = USAGE_THRESHOLDS.filter(threshold => limit.percentUsed >= threshold)
    const top = crossed[crossed.length - 1]
    if (top === undefined || crossed.every(threshold => standing.includes(usageKey(limit, threshold)))) continue
    const reset = resetIn(limit.resetsAt, now)
    alerts.push({
      key: usageKey(limit, top),
      title: 'Claude usage',
      body: `${labelOf(limit.kind)} at ${Math.round(limit.percentUsed)}%${reset === undefined ? '' : ` · ${reset}`}`,
    })
    standing.push(...crossed.map(threshold => usageKey(limit, threshold)))
  }

  if (isContextHigh && !standing.includes(CONTEXT_KEY)) {
    const size = context.tokens === undefined ? '' : ` (${tokens(context.tokens)} / ${tokens(context.window)})`
    alerts.push({ key: CONTEXT_KEY, title: 'Claude context', body: `Context at ${Math.round(context.percent ?? 0)}%${size}: compaction is near` })
    standing.push(CONTEXT_KEY)
  }

  return { alerts, standing }
}
