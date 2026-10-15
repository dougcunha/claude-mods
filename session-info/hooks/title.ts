/** The title of the pane when the paneTitle setting is empty. */
export const DEFAULT_TITLE = 'Session info'

/** The longest custom title the pane keeps; a longer one is cut. */
export const TITLE_LIMIT = 40

/** The custom pane title of the paneTitle setting: control characters dropped, trimmed and cut to TITLE_LIMIT; empty when none. */
export function customTitle(value: unknown): string {
  if (typeof value !== 'string') return ''

  return value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, TITLE_LIMIT).trim()
}

/** Where the title sits in its banner. */
export type TitleAlign = 'left' | 'center' | 'right'

/** Which side of the title rule grows, left then right, for each alignment; the other side stays a short stub. */
export const ALIGN_GROW = {
  left: [false, true],
  center: [true, true],
  right: [true, false],
} as const satisfies Record<TitleAlign, readonly [boolean, boolean]>

/** The alignment of the paneTitleAlign setting; left when it is missing or not one of the three. */
export function titleAlign(value: unknown): TitleAlign {
  return value === 'center' || value === 'right' ? value : 'left'
}

/** The color of the paneTitleColor setting, a theme key, a color name or hex; empty when none. */
export function titleColor(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}
