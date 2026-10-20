import type { JudgeEngine } from './judge'

/** What the status line shows: the settings that decide who judges, whether Jev is down, and the last thing the mod did. */
export type StatusView = { analyze: boolean; judge: JudgeEngine; model: string; isJevDown: boolean; last: string | null }

/** The status line: who judges, then the last thing the mod did. The engine adds the plugin's name in front. It never holds prompt or reply text. */
export function statusText(view: StatusView): string {
  if (!view.analyze) return 'off'
  const who = view.judge === 'model' ? view.model : view.isJevDown ? `Jev down, ${view.model} judging` : 'Jev'

  return view.last === null ? who : `${who} · ${view.last}`
}

/** The last thing the mod did when it judged: the outcome and how full the context was. */
export function judgedText(outcome: 'related' | 'new-topic' | 'none', percent: number): string {
  if (outcome === 'new-topic') return `held a new topic at ${percent}%`
  if (outcome === 'related') return `related at ${percent}%`

  return `no judgment at ${percent}%`
}

/**
 * The last thing the mod did when it did not judge: the context percent, and the percent from which it judges again,
 * which is the minimum below it and the kept point plus the step after the person kept a message.
 */
export function skippedText(gate: { percent: number; minPercent: number; keptAt: number | null; recheckStep: number }): string {
  const from = gate.percent < gate.minPercent || gate.keptAt === null ? gate.minPercent : gate.keptAt + gate.recheckStep

  return `skipped at ${gate.percent}%, judging from ${from}%`
}

/** The last thing the mod did when the person sent a held message again. */
export const keptText = (percent: number): string => `kept here at ${percent}%`
