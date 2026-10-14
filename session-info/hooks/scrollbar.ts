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

const gapTo = (target: ScrollTarget, row: number): number => Math.max(target.start - row, row - (target.start + target.rows - 1), 0)

/**
 * The tree nearest the wheel, so a list placed a row or two off its estimate still gets the wheel; a key press,
 * which has no pointer, takes the first one. Ties go to the first.
 */
export function targetAt(targets: readonly ScrollTarget[], row: number | undefined): ScrollTarget | undefined {
  if (row === undefined) return targets[0]

  return targets.reduce<ScrollTarget | undefined>((nearest, target) => (nearest === undefined || gapTo(target, row) < gapTo(nearest, row) ? target : nearest), undefined)
}

/** The offset after a move of `by` rows, held between the first row and the last window. */
export const movedTo = (from: number, by: number, target: ScrollTarget): number => Math.min(Math.max(0, from + by), target.overflow)

/** One tree's window as the pane draws it: its rows, the first one shown, the rows that fit, and how a press moves it. */
export type ScrollView = { id: string; total: number; from: number; room: number; jump: (to: number) => void; isKeyed: boolean }

/** The first row the window takes when the track is pressed at `index`: the top of the track is the top of the list, its bottom the last window. */
export const offsetAt = (index: number, total: number, room: number): number =>
  clampOffset(Math.round((index / Math.max(1, room - 1)) * (total - room)), total, room)
