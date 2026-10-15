import type { Detail } from '../types'

/** The most characters the detail view keeps of one text; a longer one is cut with a mark. */
export const DETAIL_LIMIT = 4_000

const CUT = '\n… (cut)'

/** The detail view of a text a row cut short: the title says what it is, the text is whole up to DETAIL_LIMIT. */
export function detailOf(title: string, text: string): Detail {
  const whole = text.trim()

  return { title, text: whole.length > DETAIL_LIMIT ? `${whole.slice(0, DETAIL_LIMIT)}${CUT}` : whole }
}

/** Joins the parts of a detail text, one per line, and leaves out an empty part. */
export const detailLines = (parts: readonly (string | undefined)[]): string =>
  parts.filter((part): part is string => part !== undefined && part.trim() !== '').join('\n')
