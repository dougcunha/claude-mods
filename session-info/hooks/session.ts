/** Main-thread turns of the session, summed as `turn.complete` reports them. */
export type TurnStats = { count: number; outputTokens: number; lastMs: number }

export const NO_TURNS: TurnStats = { count: 0, outputTokens: 0, lastMs: 0 }

/** 950, 12.3k, 124k, 1.2M. */
export function tokens(count: number): string {
  if (count < 1_000) return `${Math.round(count)}`
  if (count < 10_000) return `${(count / 1_000).toFixed(1)}k`
  if (count < 1_000_000) return `${Math.round(count / 1_000)}k`

  return `${(count / 1_000_000).toFixed(1)}M`
}

/** 38s, 4m 12s, 1h 12m. */
export function duration(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1_000))
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`

  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}

export const cost = (usd: number): string => `$${usd.toFixed(2)}`

export function turnLine(turns: TurnStats): string {
  if (turns.count === 0) return 'No turns yet'
  const perTurn = tokens(turns.outputTokens / turns.count)

  return `${turns.count} turn${turns.count === 1 ? '' : 's'} · ~${perTurn} output tok/turn · last ${duration(turns.lastMs)}`
}

export const compactionText = (count: number): string =>
  count === 0 ? '' : ` · ${count} compaction${count === 1 ? '' : 's'}`
