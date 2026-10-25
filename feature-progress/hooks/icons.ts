import type { Color } from 'claude-code'

import type { Kind } from '../types'

/** The icon sets of the `icons` option: `unicode` draws in every terminal, `nerd` needs a Nerd Font, `emoji` draws two cells wide. */
export type IconSet = 'unicode' | 'nerd' | 'emoji'

/** The glyph of each kind per icon set, and its theme color; the word is the kind itself, so color only reinforces it (NFR-04). */
export const KIND_STYLE = {
  pending: { glyph: { unicode: '○', nerd: '\u{f10c}', emoji: '⚪' }, color: 'inactive' },
  planning: { glyph: { unicode: '◇', nerd: '\u{f14e}', emoji: '📝' }, color: 'suggestion' },
  active: { glyph: { unicode: '●', nerd: '\u{f144}', emoji: '🚀' }, color: 'claude' },
  review: { glyph: { unicode: '◎', nerd: '\u{f06e}', emoji: '🔍' }, color: 'permission' },
  fixing: { glyph: { unicode: '✎', nerd: '\u{f0ad}', emoji: '🔧' }, color: 'warning' },
  qa: { glyph: { unicode: '◆', nerd: '\u{f0c3}', emoji: '🧪' }, color: 'merged' },
  waiting: { glyph: { unicode: '◷', nerd: '\u{f252}', emoji: '⏳' }, color: 'planMode' },
  blocked: { glyph: { unicode: '✕', nerd: '\u{f05e}', emoji: '⛔' }, color: 'error' },
  done: { glyph: { unicode: '✓', nerd: '\u{f058}', emoji: '✅' }, color: 'success' },
} as const satisfies Record<Kind, { glyph: Record<IconSet, string>; color: Color }>

/** The glyph and color of a kind in the chosen icon set. */
export const styleOf = (kind: Kind, set: IconSet): { glyph: string; color: Color } => ({ glyph: KIND_STYLE[kind].glyph[set], color: KIND_STYLE[kind].color })

/** Terminal cells one glyph of the set takes: an emoji draws two. */
export const glyphColumns = (set: IconSet): number => (set === 'emoji' ? 2 : 1)
