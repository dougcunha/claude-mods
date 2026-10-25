import type { Color, Elements } from 'claude-code'

import { METER_EMPTY, METER_FILLED } from './progress'

type TextElement = Elements['terminal']['Text']

/** A meter of `cells` characters: the filled ones in `color`, the rest dim; a run with no cell draws nothing. */
export function meter(Text: TextElement, filled: number, cells: number, color: Color = 'success') {
  const empty = Math.max(0, cells - filled)

  return [
    filled > 0 ? <Text color={color}>{METER_FILLED.repeat(filled)}</Text> : null,
    empty > 0 ? <Text dimColor>{METER_EMPTY.repeat(empty)}</Text> : null,
  ]
}
