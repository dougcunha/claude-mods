import type { AutopickPick, AutopickSettings } from '../types'

// The pick rules follow ask-autopick by Kerem Gok (MIT): https://github.com/KilimcininKorOglu/claude-code-mods/tree/main/plugins/ask-autopick

/** One question of an AskUserQuestion call, as far as autopick reads it. */
export type Question = { question: string; multiSelect?: boolean; options?: { label: string }[] }

/** The `$.store` keys of the two settings. */
export const STORE_ON = 'autopickOn'
export const STORE_MINUTES = 'autopickMinutes'

export const DEFAULT_MINUTES = 10

/** The waits the − and + buttons step through; `/autopick <minutes>` takes any whole number from the first to the last. */
export const MINUTE_STEPS: readonly number[] = [1, 2, 3, 5, 10, 15, 20, 30, 45, 60, 90, 120]

const MIN_MINUTES = MINUTE_STEPS[0] ?? 1
const MAX_MINUTES = MINUTE_STEPS.at(-1) ?? 120

export const DEFAULT_SETTINGS: AutopickSettings = { isOn: false, minutes: DEFAULT_MINUTES }

/** The command that ask-autopick registers; a session that lists it has that mod loaded. */
const RIVAL_COMMAND = 'ask-autopick'

/**
 * The words a model writes in parentheses after the option it recommends. The tool tells it to write `(Recommended)`,
 * and in a question written in another language it writes that word in the language.
 */
const RECOMMENDED_WORDS = [
  'recommended', 'önerilen', 'empfohlen', 'recomendado', 'recomendada', 'recommandé', 'recommandée',
  'consigliato', 'consigliata', 'aanbevolen', 'zalecane', 'рекомендуется', '推荐', '推薦', '推奨', 'おすすめ', '권장', '추천',
]

/** A label that ends with one of those words in parentheses, ASCII or full-width. */
const RECOMMENDED_END = new RegExp(`[(（]\\s*(?:${RECOMMENDED_WORDS.join('|')})\\s*[)）]\\s*$`, 'iu')

export const isRecommended = (label: string): boolean => RECOMMENDED_END.test(label)

/**
 * The recommended label of one question: the first option, marked at the end of its label, with no other option
 * marked. Undefined for a question that takes several answers or has no such option.
 */
function pickOf(question: Question): string | undefined {
  const [first, ...rest] = question.options ?? []
  if (question.multiSelect === true || first === undefined || !isRecommended(first.label)) return undefined

  return rest.some(option => isRecommended(option.label)) ? undefined : first.label
}

/** One recommended label per question, or undefined when a question has none: such a call waits for the person. */
export function picksOf(questions: readonly Question[]): Record<string, string> | undefined {
  if (questions.length === 0) return undefined
  const picks: Record<string, string> = {}
  for (const question of questions) {
    const label = pickOf(question)
    if (label === undefined) return undefined
    picks[question.question] = label
  }

  return picks
}

/** The settings as `$.store` holds them; a missing or broken value reads as its default. */
export function settingsOf(isOn: unknown, minutes: unknown): AutopickSettings {
  return {
    isOn: isOn === true,
    minutes: typeof minutes === 'number' && minutesOf(String(minutes)) !== undefined ? minutes : DEFAULT_MINUTES,
  }
}

/** The minutes a `/autopick <word>` argument names, or undefined when it names none in range. */
export function minutesOf(arg: string): number | undefined {
  if (!/^\d{1,3}$/.test(arg)) return undefined
  const n = Number(arg)

  return n >= MIN_MINUTES && n <= MAX_MINUTES ? n : undefined
}

/** The next wait up or down the steps; a wait between two steps moves to the nearer one in that direction. */
export function stepMinutes(minutes: number, direction: 1 | -1): number {
  if (direction > 0) return MINUTE_STEPS.find(step => step > minutes) ?? MAX_MINUTES

  return [...MINUTE_STEPS].reverse().find(step => step < minutes) ?? MIN_MINUTES
}

/** Whether a command list names ask-autopick's command, which means that mod is loaded. */
export const hasRival = (commands: readonly { name: string; plugin?: string }[]): boolean =>
  commands.some(command => command.name === RIVAL_COMMAND || command.plugin === RIVAL_COMMAND)

/** `7:05` for the time left; never below `0:00`. */
export function countdown(ms: number): string {
  const seconds = Math.max(0, Math.ceil(ms / 1_000))

  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

/** `Color? → Blue (Recommended)`, the questions of one call joined. */
export const picksText = (picks: Readonly<Record<string, string>>): string =>
  Object.entries(picks)
    .map(([question, label]) => `${question} → ${label}`)
    .join('; ')

/** The picks one per line, `question → label`, for the detail view. */
export const picksDetail = (picks: Readonly<Record<string, string>>): string =>
  Object.entries(picks)
    .map(([question, label]) => `${question} → ${label}`)
    .join('\n')

/** What a pick was and why it happened, then its picks one per line: the detail view of the Picked line. */
export const pickDetail = (pick: AutopickPick): string =>
  `${pick.isByHand ? 'Pick now pressed' : `No answer in ${pick.minutes} min`}\n${picksDetail(pick.picks)}`

/** The header's right side: `on · 10 min` or `off`. */
export const autopickSummary = (settings: AutopickSettings): string => (settings.isOn ? `on · ${settings.minutes} min` : 'off')

/** The line the transcript keeps for a pick. */
export function pickedLog(pick: AutopickPick): string {
  const why = pick.isByHand ? 'Pick now pressed' : `no answer in ${pick.minutes} min`

  return `session-info: ${why}, picked the recommended option: ${picksText(pick.picks)}`
}

/** What the model reads after the picked answer, so it does not take the pick for the person's choice. */
export function pickedNote(pick: AutopickPick): string {
  return pick.isByHand
    ? 'session-info autopick: the person pressed Pick now, so the recommended option was picked without reading the options. Treat it as a default they accepted, not as a choice they weighed.'
    : `session-info autopick: the person did not answer within ${pick.minutes} minutes, so the recommended option was picked for them. Treat it as a default, not as their decision, and name the pick in your next reply.`
}

/** The `/autopick` answer. */
export function statusText(settings: AutopickSettings, isBlocked: boolean): string {
  if (isBlocked) return 'off · the ask-autopick mod is loaded and answers questions too; disable it to use this one'

  return settings.isOn
    ? `on · a question unanswered for ${settings.minutes} min gets its recommended option`
    : `off · questions wait for you; /autopick on picks the recommended option after ${settings.minutes} min`
}

export const AUTOPICK_USAGE = 'Usage: /autopick [on | off | <minutes from 1 to 120>]'
