export type Hunk = {
  oldStart: number
  oldLines: number
  newStart: number
  newLines: number
  lines: readonly string[]
}

const side = (hunk: Hunk, mark: string): string[] =>
  hunk.lines.filter(line => line[0] === ' ' || line[0] === mark).map(line => line.slice(1))

/** Undoes `hunks` on the file's current text, giving back the text before the change. */
export function reverse(current: string, hunks: readonly Hunk[]): string {
  const lines = current.split('\n')
  const lastFirst = [...hunks].sort((a, b) => b.newStart - a.newStart)
  for (const hunk of lastFirst) {
    const at = hunk.newLines === 0 ? hunk.newStart : hunk.newStart - 1
    lines.splice(at, side(hunk, '+').length, ...side(hunk, '-'))
  }

  return lines.join('\n')
}

/** The whole text of a deleted file, read back from its deletion hunks. */
export function deletedText(hunks: readonly Hunk[]): string {
  const lines = hunks.flatMap(hunk => side(hunk, '-'))
  const hasNoFinalNewline = hunks.some(hunk => hunk.lines.some(line => line.startsWith('\\')))

  return lines.join('\n') + (hasNoFinalNewline || lines.length === 0 ? '' : '\n')
}
