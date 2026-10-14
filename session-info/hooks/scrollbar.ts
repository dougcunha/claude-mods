/** The first row a window of `room` rows may start at over `total` rows: 0 at the top, `total - room` at the end. */
export const clampOffset = (offset: number, total: number, room: number): number => Math.min(Math.max(0, offset), Math.max(0, total - room))

const THUMB = '┃'
const TRACK = '│'

/** One glyph per visible row: the thumb where the window sits over the rows, the track elsewhere; none when the rows fit. */
export function scrollbar(total: number, room: number, offset: number): string[] {
  if (room <= 0 || total <= room) return []
  const thumb = Math.min(room, Math.max(1, Math.round((room * room) / total)))
  const top = Math.round((clampOffset(offset, total, room) / (total - room)) * (room - thumb))

  return Array.from({ length: room }, (_, row) => (row >= top && row < top + thumb ? THUMB : TRACK))
}

/** A tree whose rows scroll: where its list starts in the pane body, how many rows show and how many it leaves out. */
export type ScrollTarget = { key: 'changes' | 'git'; start: number; rows: number; overflow: number }

/** The tree under the wheel; a key press, which has no pointer, takes the first one. */
export function targetAt(targets: readonly ScrollTarget[], row: number | undefined): ScrollTarget | undefined {
  if (row === undefined) return targets[0]

  return targets.find(target => row >= target.start && row < target.start + target.rows)
}

/** The offset after a move of `by` rows, held between the first row and the last window. */
export const movedTo = (from: number, by: number, target: ScrollTarget): number => Math.min(Math.max(0, from + by), target.overflow)
