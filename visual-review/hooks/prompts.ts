import type { Comment, CommentType } from './comments'
import type { ChangedFile } from './git'
import { RANGE_NAME_LINES, SOURCE_EXTENSIONS } from './model'

/** The short name of the tool the analysis subagent sends the design model to. */
export const SUBMIT_NAME = 'submit_model'

/** The tool's full name, as the model calls it. */
export const SUBMIT_TOOL = `mcp__visual-review__${SUBMIT_NAME}` as const

/** The values of the `analysisModel` option; `inherit` starts the subagent with no model, so it runs on the session's. */
export const ANALYSIS_MODELS = ['sonnet', 'opus', 'haiku', 'inherit'] as const

export type AnalysisModel = (typeof ANALYSIS_MODELS)[number]

/** The default of `analysisModel`, the same as in plugin.json. */
export const DEFAULT_ANALYSIS_MODEL: AnalysisModel = 'sonnet'

/** What the status line says while the analysis runs. */
export const ANALYZING_STATUS = 'Analyzing the design of the change…'

/** What the tool tells the model about itself. */
export const SUBMIT_DESCRIPTION =
  'Send the design model of a /visual-review run: the units, relations and database tables of the change. ' +
  'Send the whole model on each call. The result says that the model is accepted, or lists the gaps to fix before you call again.'

/** What the analysis prompt needs to know of a run. */
export type AnalysisRun = { runId: string; root: string; base: string; baseLabel: string; files: readonly ChangedFile[]; model: AnalysisModel }

/** The `analysisModel` option read from `unknown`, with the default for a missing or unknown value. */
export const analysisModelOf = (value: unknown): AnalysisModel =>
  (ANALYSIS_MODELS as readonly unknown[]).includes(value) ? (value as AnalysisModel) : DEFAULT_ANALYSIS_MODEL

function fileLine(file: ChangedFile): string {
  const counts = file.added === null || file.removed === null ? 'binary' : `+${file.added} -${file.removed}`
  const rename = file.oldPath === undefined ? '' : `, renamed from ${file.oldPath}`
  const untracked = file.isUntracked ? ', untracked' : ''

  return `- ${file.path} (${counts}${rename}${untracked})`
}

const agentLine = (model: AnalysisModel): string =>
  model === 'inherit'
    ? 'Start 1 subagent with the Agent tool (subagent_type general-purpose) and no model parameter, so it uses the model of this session.'
    : `Start 1 subagent with the Agent tool (subagent_type general-purpose, model ${model}).`

/** The prompt the command submits: the main loop starts 1 subagent, which analyzes the diff and sends the model to the tool. */
export function analysisPrompt(run: AnalysisRun): string {
  return [
    `visual-review run ${run.runId}: the person ran /visual-review to see the design of the change as a diagram.`,
    '',
    `${agentLine(run.model)} Give it the task below as its prompt, unchanged. Do not do the analysis yourself. When the subagent reports, answer the person in 1 line: the review page is ready, or why the analysis failed.`,
    '',
    '<task>',
    `Analyze the design of a code change and send it to the tool ${SUBMIT_TOOL}.`,
    '',
    `Repository: ${run.root}`,
    `Base: ${run.baseLabel} (commit ${run.base}). Read the change with \`git diff ${run.base}\` in the repository; untracked files are new files.`,
    'Changed files (lines added and removed):',
    ...run.files.map(fileLine),
    '',
    'Steps:',
    `1. Load the tool: call ToolSearch with the query "select:${SUBMIT_TOOL}".`,
    '2. Read the diff and the changed files. Read an unchanged file only when a changed unit uses it or it uses a changed unit.',
    `3. Call ${SUBMIT_TOOL} with the whole design model and runId "${run.runId}".`,
    '4. If the result lists gaps, fix each gap and call the tool again with the whole model. When the result says that the model is accepted, report that in 1 line.',
    '',
    'Rules that the tool schema cannot state:',
    '- A unit is a class, interface, record or struct, enum, or module. A module is 1 file with code but no class; name it after the file.',
    '- Each unit has 1 state: added, modified, deleted or context. A context unit did not change and is a direct neighbor of a changed unit; give it only id, name, kind, state, file and container.',
    '- container is the namespace for C#, and the folder for TypeScript, JavaScript and Python.',
    `- range is the first and the last line of the unit in the current file, or in the base file for a deleted unit. The first ${RANGE_NAME_LINES} lines of the range must contain the unit name. baseRange is the same for the base file, for a modified unit only.`,
    '- members lists only the members that changed. methods is the number of methods of the unit.',
    '- summary is 1 to 3 sentences on what the unit does. cohesion is a score from 1 (unrelated responsibilities) to 5 (one responsibility) with a 1-sentence reason.',
    '- A relation is inheritance, implementation, composition (the unit owns the other) or dependency (the unit uses the other), with the state added, removed or unchanged, between unit ids of the model.',
    '- tables lists each database table that the change adds, modifies or drops, from EF Core migrations and DbContext, Prisma, TypeORM, Drizzle, .sql files, SQLAlchemy, Alembic and Django migrations. source is the changed file that makes the change; entity is the unit id of the entity class, if there is one.',
    `- Each changed file with the extension ${SOURCE_EXTENSIONS.join(', ')} must be the file of a unit, the source of a table, or an entry of skippedFiles. Put generated files, such as *.Designer.cs and the EF Core model snapshot, in skippedFiles with the reason.`,
    '- Write paths relative to the repository with forward slashes, as in the list above.',
    '</task>',
  ].join('\n')
}

/** The tool result that sends the gaps back to the subagent. */
export const gapsResult = (gaps: readonly string[]): string =>
  [`The model is not accepted. Fix these ${gaps.length} gaps and call ${SUBMIT_NAME} again with the whole model:`, ...gaps.map(gap => `- ${gap}`)].join('\n')

/** The tool result of a call whose run a newer /visual-review run replaced. */
export const REPLACED_RESULT = 'This analysis was replaced by a newer /visual-review run. Stop, and report that in 1 line.'

/** The command's answer when the session start could not register `submit_model`: without it no model can come back. */
export const TOOL_MISSING_TEXT = 'visual-review: the submit_model tool is missing, so the analysis cannot send its model. Run /reload-plugins, then /visual-review again.'

/** The tool result of a call with no run waiting for a model. */
export const NO_RUN_RESULT = 'No visual review waits for a model. Stop, and tell the person to run /visual-review.'

/** The tool result of an accepted model whose page is open; the URL stays out of it, because it carries the page's token. */
export const ACCEPTED_RESULT = 'The model is accepted, and the review page is open in the browser. Report in 1 line that the review page is ready.'

/** The tool result of an accepted model shown on the static page, because Node.js is missing or the page server failed. */
export const STATIC_RESULT =
  'The model is accepted, and a static review page is open in the browser, because the page server is not available. Report in 1 line that the review page is ready as a static page, where the person copies the review with Copy review.'

/** The reason the static toast gives when `node --version` failed (FR-24). */
export const NODE_MISSING_CAUSE = 'Node.js not found'

/** The toast of a static page: why the page is static, what to do, and its link (FR-24). */
export const staticToast = ({ cause, url }: { cause: string; url: string }): string =>
  `visual-review: ${cause}. The page is static: use Copy review to send the comments. Page: ${url}`

/** The toast of a page that opened in a new tab, or updated the open one. */
export const readyToast = ({ url, isNewTab }: { url: string; isNewTab: boolean }): string =>
  isNewTab ? `visual-review: Visual review ready: ${url}` : `visual-review: Visual review updated in the open tab: ${url}`

/** The toast of a page server that did not start or stopped with an error. */
export const serverFailedToast = (cause: string): string => `visual-review: the page server failed: ${cause}`

/** The toast of a browser launcher that did not start. */
export const BROWSER_FAILED_TOAST = 'visual-review: the browser did not open. Open the page from the link in the ready message.'

/** The toast of an analysis turn that ended with no accepted model, by the reason the turn ended. */
export function noModelToast(reason: 'answer' | 'aborted' | 'refusal' | 'error'): string {
  const why = { answer: 'the turn ended', aborted: 'the turn was interrupted', refusal: 'the model refused', error: 'an API error ended the turn' }[reason]

  return `visual-review: the design analysis failed: ${why} with no design model. Run /visual-review again.`
}

/** The toast of an analysis prompt that never entered the session. */
export const droppedToast = (reason: string): string => `visual-review: the design analysis failed: the prompt did not enter the session (${reason}).`

const TYPE_LABELS = { change: 'Change request', question: 'Question' } as const satisfies Record<CommentType, string>

const ANCHOR_ORDER = ['review', 'unit', 'member', 'relation', 'table', 'column'] as const

/** Orders text by code unit, the same on every machine. */
function compareText(a: string, b: string): number {
  if (a < b) return -1

  return a > b ? 1 : 0
}

/** A comment's text as list content: each further line indented, so a line of the text cannot start a new item. */
const indented = (text: string): string => text.trim().split(/\r?\n/).join('\n    ')

/** The comments by anchor, in anchor kind order, then anchor id, then the order the reviewer wrote them. */
function byAnchor(comments: readonly Comment[]): Comment[][] {
  const groups = new Map<string, Comment[]>()
  const sorted = [...comments].sort((a, b) => ANCHOR_ORDER.indexOf(a.anchor.kind) - ANCHOR_ORDER.indexOf(b.anchor.kind) || compareText(a.anchor.id, b.anchor.id))
  for (const comment of sorted) {
    const key = `${comment.anchor.kind} ${comment.anchor.id}`
    groups.set(key, [...(groups.get(key) ?? []), comment])
  }

  return [...groups.values()]
}

const anchorLine = (comment: Comment): string => (comment.anchor.kind === 'review' ? 'The whole review' : `${comment.anchor.kind} ${comment.anchor.id}`)

/** What the review prompt needs: the base, the comments of this round, and the older comments whose status changed. */
export type ReviewInput = { baseLabel: string; drafts: readonly Comment[]; changed: readonly Comment[] }

/**
 * The prompt "Submit review" sends (FR-19): each comment under its anchor with its type, then the status changes; it
 * asks Claude to answer the questions, to plan the change requests, and to change no file before the person confirms.
 */
export function reviewPrompt({ baseLabel, drafts, changed }: ReviewInput): string {
  const lines = [
    `visual-review: the person reviewed the design of the change against ${baseLabel} and sent ${drafts.length} ${drafts.length === 1 ? 'comment' : 'comments'}.`,
    '',
    'Answer each question. For the change requests, propose a plan. Do not change any file until the person confirms the plan.',
  ]
  for (const group of byAnchor(drafts)) {
    const [first] = group
    if (first === undefined) continue
    lines.push('', `## ${anchorLine(first)}`, ...group.map(comment => `- ${TYPE_LABELS[comment.type]}: ${indented(comment.text)}`))
  }
  if (changed.length > 0)
    lines.push('', '## Status changes of earlier comments', ...changed.map(comment => `- ${comment.status === 'resolved' ? 'Resolved' : 'Open again'}: ${TYPE_LABELS[comment.type]} on ${anchorLine(comment)}: ${indented(comment.text)}`))

  return lines.join('\n')
}

/** The toast of a submit with nothing new to send. */
export const NOTHING_TO_SEND_TOAST = 'visual-review: the review has no new comment and no status change to send.'

/** What the page says when a submit sent nothing: the toast without the mod's name. */
export const NOTHING_TO_SEND_NOTICE = 'The review has no new comment and no status change to send.'

/** What the page says when the review prompt did not enter the session. */
export const reviewDroppedNotice = (reason: string): string => `The review was not sent: ${reason}. Your comments are kept; submit again.`

/** The toast of a review prompt that did not enter the session. */
export const reviewDroppedToast = (reason: string): string => `visual-review: the review was not sent: ${reason}. Your comments are kept; submit again.`
