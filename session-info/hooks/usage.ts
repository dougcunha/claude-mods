/** One rate-limit window as `$.session.usage()` reports it. */
export type Limit = { kind: string; percentUsed: number; resetsAt?: string }

const ORDER = ['five_hour', 'seven_day']

const titleCase = (word: string): string => word.charAt(0).toUpperCase() + word.slice(1)

/** The label `/usage` gives a window; a per-model weekly window reads `Current week (<Model>)`. */
export function labelOf(kind: string): string {
  if (kind === 'five_hour') return 'Current session'
  if (kind === 'seven_day') return 'Current week (all models)'
  if (kind === 'spend_limit') return 'Spend limit'
  const model = /^seven_day_(.+)$/.exec(kind)?.[1]
  if (model !== undefined) return `Current week (${model.split('_').map(titleCase).join(' ')})`

  return titleCase(kind.replace(/_/g, ' '))
}

/** Session first, then the week, then any other window in the order reported. */
export function ordered(limits: readonly Limit[]): Limit[] {
  const rank = (kind: string): number => (ORDER.includes(kind) ? ORDER.indexOf(kind) : ORDER.length)

  return [...limits].sort((a, b) => rank(a.kind) - rank(b.kind))
}

export function resetIn(resetsAt: string | undefined, now: number): string | undefined {
  if (resetsAt === undefined) return undefined
  const left = Date.parse(resetsAt) - now
  if (Number.isNaN(left)) return undefined
  if (left <= 0) return 'reset; updates on next reply'

  const minutes = Math.ceil(left / 60_000)
  const days = Math.floor(minutes / 1440)
  const hours = Math.floor((minutes % 1440) / 60)
  if (days > 0) return `resets in ${days}d ${hours}h`
  if (hours > 0) return `resets in ${hours}h ${minutes % 60}m`

  return `resets in ${minutes}m`
}

const EIGHTHS = ['', '▏', '▎', '▍', '▌', '▋', '▊', '▉']

/** The filled and empty runs of a bar `width` cells wide, filled to the eighth of a cell; any use shows at least one eighth. */
export function bar(percent: number, width: number): { filled: string; empty: string } {
  const cells = Math.max(1, width)
  const share = Math.min(100, Math.max(0, percent)) / 100
  const eighths = percent > 0 ? Math.max(1, Math.round(share * cells * 8)) : 0
  const full = Math.floor(eighths / 8)
  const partial = EIGHTHS[eighths % 8]

  return { filled: '█'.repeat(full) + partial, empty: '░'.repeat(cells - full - (partial === '' ? 0 : 1)) }
}

export const colorOf = (percent: number): 'suggestion' | 'warning' | 'error' =>
  percent >= 90 ? 'error' : percent >= 70 ? 'warning' : 'suggestion'

export const percentText = (percent: number): string => `${Math.round(percent)}%`
