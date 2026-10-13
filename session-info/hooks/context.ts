import type { ContextReading, ContextSlice } from '../types'

import { tokens } from './session'

/** /context gives several rows the same grey, so each used row takes its own color, in order. */
const PALETTE = ['#7aa2f7', '#7dcfff', '#bb9af7', '#9ece6a', '#e0af68', '#f7768e', '#73daca', '#ff9e64', '#c0caf5']
/** The row that grows takes the accent color. */
const MESSAGES = 'claude'
const EMPTY = 'subtle'

export const GLYPH = { used: '█', free: '─', buffer: '░' } as const

/** Cells between two legend entries; the row Box draws them as its gap. */
export const LEGEND_GAP = 3

export const SWATCH = { used: '■', free: '─', buffer: '░' } as const

type Category = { name: string; tokens: number; kind: string }

/**
 * The breakdown `$.session.usage({ breakdown: 'summary' })` answers, as the bar draws it: the used rows in
 * /context's order, then the free space and the compaction buffer. Deferred tool schemas sit outside the window.
 */
export function toReading(breakdown: {
  categories: readonly Category[]
  totalTokens: number
  rawMaxTokens: number
  autoCompactThreshold?: number
  isAutoCompactEnabled: boolean
}): ContextReading | null {
  if (!(breakdown.rawMaxTokens > 0)) return null
  const rank = { used: 0, free: 1, buffer: 2 } as const
  const slices = breakdown.categories
    .filter((c): c is Category & { kind: ContextSlice['kind'] } => c.tokens > 0 && c.kind in rank)
    .map(c => ({ name: c.name.toLowerCase(), tokens: c.tokens, kind: c.kind, color: EMPTY }))
    .sort((a, b) => rank[a.kind] - rank[b.kind])
  let next = 0
  for (const slice of slices)
    if (slice.kind === 'used') slice.color = slice.name === 'messages' ? MESSAGES : (PALETTE[next++ % PALETTE.length] ?? EMPTY)

  return {
    slices,
    total: breakdown.totalTokens,
    window: breakdown.rawMaxTokens,
    compactsAt: breakdown.isAutoCompactEnabled ? breakdown.autoCompactThreshold : undefined,
  }
}

/** Each slice's share of `width` cells; a used slice keeps at least one, and free space absorbs the rounding. */
export function cellWidths(reading: ContextReading, width: number): number[] {
  const { slices, window } = reading
  const sizes = slices.map(s => Math.max(s.kind === 'used' ? 1 : 0, Math.round((s.tokens / window) * width)))
  let diff = width - sizes.reduce((sum, n) => sum + n, 0)
  const isUsed = (i: number) => slices[i]?.kind === 'used'
  const order = slices.map((_, i) => i).sort((a, b) => Number(isUsed(a)) - Number(isUsed(b)) || (sizes[b] ?? 0) - (sizes[a] ?? 0))
  for (const i of order) {
    if (diff === 0) break
    const size = Math.max(isUsed(i) ? 1 : 0, (sizes[i] ?? 0) + diff)
    diff -= size - (sizes[i] ?? 0)
    sizes[i] = size
  }

  return sizes
}

/** `2.1%`, `23%`, `<0.1%`. */
export function share(count: number, window: number): string {
  const percent = (count / window) * 100
  if (percent > 0 && percent < 0.1) return '<0.1%'

  return `${percent >= 10 ? Math.round(percent) : +percent.toFixed(1)}%`
}

/** One legend entry's text after its swatch: `skills 9.9k 1%`; free space and the buffer carry no share. */
export const legendText = (slice: ContextSlice, window: number): string =>
  `${slice.name} ${tokens(slice.tokens)}${slice.kind === 'used' ? ` ${share(slice.tokens, window)}` : ''}`

/** The legend packed into lines no wider than `width`, each entry its swatch and text. */
export function legendLines(reading: ContextReading, width: number): ContextSlice[][] {
  const lines: ContextSlice[][] = []
  let used = 0
  for (const slice of reading.slices) {
    const size = 2 + legendText(slice, reading.window).length
    const line = lines.at(-1)
    if (line === undefined || (line.length > 0 && used + LEGEND_GAP + size > width)) {
      lines.push([slice])
      used = size
    } else {
      line.push(slice)
      used += LEGEND_GAP + size
    }
  }

  return lines
}

/** `273k / 1.0M · compacts at 967k`: the live count, and where auto-compaction runs when it is on. */
export const contextText = (used: number, window: number, compactsAt: number | undefined, counts: string): string =>
  `${tokens(used)} / ${tokens(window)}${compactsAt ? ` · compacts at ${tokens(compactsAt)}` : ''}${counts}`
