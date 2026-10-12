import type { TurnReason, TurnRecord, TurnTokens } from '../types'

import { cost, duration, tokens } from './session'

/** What a main-thread turn gathers while it runs; `turn.complete` makes it a TurnRecord. */
export type TurnDraft = {
  turnId: string
  costBefore?: number
  model?: string
  effort?: string
  requests: number
  tools: Record<string, number>
  subagents: { count: number; tokens: number }
}

/** A turn's or a response's token counts, as `turn.complete` reports them. */
export type TurnUsage = {
  input_tokens: number
  output_tokens: number
  cache_read_input_tokens: number
  cache_creation_input_tokens: number
  model: string
}

type TurnStep = { turnId: string; index: number; model: string; effort?: string | number }

type TurnEnd = { turnId: string; durationMs: number; reason: TurnReason; usage?: TurnUsage }

/** Tool names shown in the tools row before the rest fold into `+N more`. */
const TOOL_ROOM = 4

export const RESULT = {
  answer: { glyph: '✓', color: 'success' },
  aborted: { glyph: '⊘', color: 'warning' },
  refusal: { glyph: '✖', color: 'error' },
  error: { glyph: '✖', color: 'error' },
} as const satisfies Record<TurnReason, { glyph: string; color: string }>

export const startDraft = (turnId: string, costBefore?: number): TurnDraft => ({
  turnId,
  ...(costBefore === undefined ? {} : { costBefore }),
  requests: 0,
  tools: {},
  subagents: { count: 0, tokens: 0 },
})

/** A model request of the turn: the last one names the model and effort; the index counts the requests. */
export function withStep(draft: TurnDraft, step: TurnStep): TurnDraft {
  if (step.turnId !== draft.turnId) return draft

  return {
    ...draft,
    requests: Math.max(draft.requests, step.index + 1),
    model: step.model,
    ...(step.effort === undefined ? {} : { effort: String(step.effort) }),
  }
}

export const withTool = (draft: TurnDraft, tool: string): TurnDraft => ({
  ...draft,
  tools: { ...draft.tools, [tool]: (draft.tools[tool] ?? 0) + 1 },
})

export const withSpawn = (draft: TurnDraft): TurnDraft => ({
  ...draft,
  subagents: { ...draft.subagents, count: draft.subagents.count + 1 },
})

const totalOf = (usage: TurnUsage): number =>
  usage.input_tokens + usage.output_tokens + usage.cache_read_input_tokens + usage.cache_creation_input_tokens

/** A subagent's run that ended while the main turn ran adds its tokens to the turn's subagent total. */
export const withSubagentUsage = (draft: TurnDraft, usage: TurnUsage | undefined): TurnDraft =>
  usage === undefined ? draft : { ...draft, subagents: { ...draft.subagents, tokens: draft.subagents.tokens + totalOf(usage) } }

/**
 * The record of a finished main-thread turn. A draft of another turn, or none (the mod loaded while
 * the turn ran), leaves out what only the draft knows; the cost is the session's cost delta over the turn.
 */
export function toRecord(draft: TurnDraft | undefined, end: TurnEnd, costAfter: number | undefined, at: number): TurnRecord {
  const own = draft?.turnId === end.turnId ? draft : undefined
  const model = end.usage?.model ?? own?.model
  const tokens: TurnTokens | null = end.usage
    ? {
        input: end.usage.input_tokens,
        output: end.usage.output_tokens,
        cacheRead: end.usage.cache_read_input_tokens,
        cacheWrite: end.usage.cache_creation_input_tokens,
      }
    : null
  const costBefore = own?.costBefore

  return {
    at,
    durationMs: end.durationMs,
    reason: end.reason,
    ...(model === undefined ? {} : { model }),
    ...(own?.effort === undefined ? {} : { effort: own.effort }),
    ...(own === undefined || own.requests === 0 ? {} : { requests: own.requests }),
    tokens,
    ...(own === undefined ? {} : { tools: own.tools }),
    subagents: own?.subagents ?? { count: 0, tokens: 0 },
    ...(costBefore === undefined || costAfter === undefined ? {} : { costUsd: Math.max(0, costAfter - costBefore) }),
  }
}

/** The share of the input that the prompt cache served; undefined when the turn read no input. */
export function cacheHit(counts: TurnTokens): number | undefined {
  const input = counts.input + counts.cacheRead + counts.cacheWrite

  return input === 0 ? undefined : (counts.cacheRead / input) * 100
}

/** `✓ answer · 1m 12s · $0.42`. */
export function resultText(record: TurnRecord): string {
  const spent = record.costUsd === undefined ? '' : ` · ${cost(record.costUsd)}`

  return `${RESULT[record.reason].glyph} ${record.reason} · ${duration(record.durationMs)}${spent}`
}

/** `claude-opus-5-5 · high · 6 requests`, or '' when nothing of it is known. */
export function modelText(record: TurnRecord): string {
  const requests = record.requests === undefined ? undefined : `${record.requests} request${record.requests === 1 ? '' : 's'}`

  return [record.model, record.effort, requests].filter(part => part !== undefined).join(' · ')
}

/** `in 3.2k · out 4.1k · cache 182k read / 12k write · 92% hit`. */
export function tokensText(record: TurnRecord): string {
  const counts = record.tokens
  if (counts === null) return 'No token usage reported'
  const hit = cacheHit(counts)
  const share = hit === undefined ? '' : ` · ${Math.round(hit)}% hit`

  return `in ${tokens(counts.input)} · out ${tokens(counts.output)} · cache ${tokens(counts.cacheRead)} read / ${tokens(counts.cacheWrite)} write${share}`
}

/** An MCP tool shows by its own name: `mcp__server__browser_click` reads `browser_click`. */
const toolName = (name: string): string => (name.startsWith('mcp__') ? (name.split('__').at(-1) ?? name) : name)

/** `Bash 4 · Edit 3 · Read 2 · +1 more · 1 subagent (45k tok)`, most-called first; '' when the turn's calls are unknown. */
export function toolsText(record: TurnRecord): string {
  const calls = Object.entries(record.tools ?? {}).sort(([a, x], [b, y]) => y - x || a.localeCompare(b))
  const shown = calls.slice(0, TOOL_ROOM).map(([name, count]) => `${toolName(name)} ${count}`)
  const more = calls.length > TOOL_ROOM ? [`+${calls.length - TOOL_ROOM} more`] : []
  const { count, tokens: spent } = record.subagents
  // A subagent spawned before the mod loaded reports tokens with no spawn counted: the count is left out then.
  const label = count === 0 ? 'subagents' : `${count} subagent${count === 1 ? '' : 's'}`
  const agents = count === 0 && spent === 0 ? [] : [`${label}${spent === 0 ? '' : ` (${tokens(spent)} tok)`}`]
  const parts = [...shown, ...more, ...agents]
  if (parts.length > 0) return parts.join(' · ')

  return record.tools === undefined ? '' : 'No tool calls'
}

/** The rows of the section body, empty ones left out. */
export const turnLines = (record: TurnRecord): string[] =>
  [modelText(record), tokensText(record), toolsText(record)].filter(line => line !== '')
