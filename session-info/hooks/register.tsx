import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, RenderChildren, RenderSurface, ToolCallResult } from 'claude-code'

import type { AgentModel, AutopickPick, AutopickSettings, AutopickWait, ChangeStatus, Checks, CiRun, CiWatch, ContextReading, FileChange, InlineDiff, JiraIssue, Repo, RepoFile, SkillUse, Todo, TurnRecord } from '../types'

import { AGENT_STATUS, agentLabel, agentModelText, agentRows, agentSummary, withAgentModel } from './agents'
import { crossings } from './alerts'
import { AUTOPICK_USAGE, autopickSummary, countdown, DEFAULT_SETTINGS, hasRival, minutesOf, pickedLog, pickedNote, picksOf, picksText, settingsOf, statusText, stepMinutes, STORE_MINUTES, STORE_ON } from './autopick'
import type { Question } from './autopick'
import type { AgentRow } from './agents'
import { FRAME_COLUMNS, FRAME_ROWS, isFramed, tileLayout, widgets } from './cards'
import type { Tile } from './cards'
import { openClient } from './client'
import { cellWidths, contextText, GLYPH, LEGEND_GAP, legendLines, legendText, SWATCH, toReading } from './context'
import { CHECK_STATUS, checkRowCount, checkRuns, checkSummary, checkViews, checkWhen, classify, NO_CHECKS, toPattern } from './checks'
import { CI_POLL_MS, CI_ROOM, CI_STATUS, ciTrigger, isWatching, pollWatch, runDetail, startWatch, stateOf, waitingText, watchState } from './ci'
import type { CheckView, Patterns } from './checks'
import { gitStatus } from './git'
import type { Host } from './host'
import { fileIcon, folderIcon, STATUS } from './icons'
import type { IconSet } from './icons'
import { allowRequest, browseUrl, errorText, isAllowed, isIssueKey, isRefusal, issueDetail, issueKeys, JIRA_FIELDS, JIRA_ROOM, mention, needsRead, readIssue, readSite, serverNames, serverOf, siteSetting, statusColor, toKeyPattern } from './jira'
import { age, branchText, codeParts, countParts, fileStatus, isConflict, ISSUE_COLOR, issueText, operationText, readRepo, repoRowCount, SUBMODULE_ROWS } from './repo'
import { endSkills, isSameSkill, SKILL_ROOM, SKILL_STATUS, skillSummary, startSkill } from './skills'
import { moveCard, orderText, parseSectionOrder, parseTabGroups, showOption, TITLES } from './tabs'
import type { SectionKey, TabGroup } from './tabs'
import { clampOffset, movedTo, offsetAt, scrollbar, targetAt } from './scrollbar'
import type { ScrollTarget, ScrollView } from './scrollbar'
import { SHELLS, track } from './track'
import { cost, countText, duration, NO_TURNS, tokens, turnLine } from './session'
import { latestTodos, minSteps, parseTodos, TODO_ROOM, TODO_SPEC, TODO_STATUS, TODO_TOOL, todoPrompt, todoReply, todoSummary, todoText } from './todos'
import { buildTree, flatten } from './tree'
import { modelText, RESULT, resultText, startDraft, toolsText, tokensText, toRecord, turnLines, withSpawn, withStep, withSubagentUsage, withTool } from './turn'
import type { TurnDraft } from './turn'
import type { Row } from './tree'
import { bar, colorOf, labelOf, ordered, percentText, resetIn } from './usage'
import type { Limit } from './usage'
import { openChange, openRepoFile, openUrl } from './viewer'
import type { Editor, Prefs, Viewer } from './viewer'

const files = atom({ plugin: 'session-info', key: 'files' } as const, {} as Record<string, FileChange>)
const collapsed = atom({ plugin: 'session-info', key: 'collapsed' } as const, [] as string[])
const inline = atom({ plugin: 'session-info', key: 'inline' } as const, null as InlineDiff | null)
const now = atom({ plugin: 'session-info', key: 'now' } as const, 0)
const turns = atom({ plugin: 'session-info', key: 'turns' } as const, NO_TURNS)
const compactions = atom({ plugin: 'session-info', key: 'compactions' } as const, 0)
const breakdown = atom({ plugin: 'session-info', key: 'breakdown' } as const, false)
const contextState = atom({ plugin: 'session-info', key: 'context' } as const, null as ContextReading | null)
const alerted = atom({ plugin: 'session-info', key: 'alerted' } as const, [] as string[])
const checks = atom({ plugin: 'session-info', key: 'checks' } as const, NO_CHECKS as Checks)
const repoState = atom({ plugin: 'session-info', key: 'repo' } as const, null as Repo | 'outside' | null)
const lastTurn = atom({ plugin: 'session-info', key: 'lastTurn' } as const, null as TurnRecord | null)
const todos = atom({ plugin: 'session-info', key: 'todos' } as const, [] as Todo[])
const skills = atom({ plugin: 'session-info', key: 'skills' } as const, [] as SkillUse[])
const ciState = atom({ plugin: 'session-info', key: 'ci' } as const, null as CiWatch | null)
const jiraServer = atom({ plugin: 'session-info', key: 'jiraServer' } as const, null as string | null)
const jiraIssues = atom({ plugin: 'session-info', key: 'jiraIssues' } as const, [] as JiraIssue[])
const agentModels = atom({ plugin: 'session-info', key: 'agentModels' } as const, {} as Record<string, AgentModel>)
const tabs = atom({ plugin: 'session-info', key: 'tabs' } as const, {} as Record<string, string>)
const autopick = atom({ plugin: 'session-info', key: 'autopick' } as const, DEFAULT_SETTINGS as AutopickSettings)
const autopickWaits = atom({ plugin: 'session-info', key: 'autopickWaits' } as const, [] as AutopickWait[])
const autopickLast = atom({ plugin: 'session-info', key: 'autopickLast' } as const, null as AutopickPick | null)
const autopickConflict = atom({ plugin: 'session-info', key: 'autopickConflict' } as const, false)
const layout = atom({ plugin: 'session-info', key: 'layout' } as const, false)
const changesTop = atom({ plugin: 'session-info', key: 'changesTop' } as const, 0)
const gitTop = atom({ plugin: 'session-info', key: 'gitTop' } as const, 0)

const PANE = 'session-info'
const TITLE = 'Session info'
const MINUTE = 60_000

/** Tools whose calls can change the working tree, so the Git section reads the repository again after them. */
const FILE_TOOLS: readonly string[] = [...SHELLS, 'Write', 'Edit', 'NotebookEdit']

let reading: Promise<void> | undefined
let isStale = false
/** The main-thread turn that runs now; a reload during a turn starts without it. */
let draft: TurnDraft | undefined
/** Skill tool calls in flight: the skill.prompt each raises takes the calling loop from here. */
const pendingSkills: { name: string; agentId?: string; isSeen: boolean }[] = []
/** The GitHub poll that runs now; a tick while it runs is skipped. */
let polling: Promise<void> | undefined
/** The Jira site the reads go to, found once per load; the keys whose read runs now. */
let jiraSite: { cloudId: string; url?: string } | undefined
/** The name `$.mcp.call` took for the Jira server, found by the first call that went through. */
let jiraName: string | undefined
/** /clear commands run since this load; $.state starts over with each /clear, so the count lives here. */
let clearCount = 0
/** After a session.end the state switches at once, but the session id and its usage only some time later. */
const SWITCH_POLL_MS = 200
const SWITCH_LIMIT_MS = 10_000
const reads = new Set<string>()

/**
 * The countdowns of one load of the module: the Pick now and Cancel actions of each question whose countdown runs, by
 * tool_use_id, and the one-second tick that redraws them, stopped while none runs.
 */
type Countdowns = { controls: Map<string, { pick: () => void; cancel: () => void }>; ticker?: { cancel: () => void } }

const toggle = (list: readonly string[], key: string): string[] =>
  list.includes(key) ? list.filter(one => one !== key) : [...list, key]

const isSection = (key: string): boolean => key.startsWith('#')

/** Folded folders of the Git tree carry this prefix, so they never mix with the Changes tree's. */
const GIT_FOLD = 'git:'

const isGitFold = (key: string): boolean => key.startsWith(GIT_FOLD)

function summary(changes: readonly FileChange[]): string {
  const count = (status: FileChange['status']) => changes.filter(one => one.status === status).length

  return (['created', 'modified', 'deleted'] as const).map(s => `${STATUS[s].glyph} ${count(s)}`).join('  ')
}

function hostOf($: EngineInterface): Host {
  return {
    run: (argv, cwd) => $.process.run(argv, cwd === undefined ? undefined : { cwd }),
    spawn: (argv, cwd) => $.process.spawn(cwd === undefined ? { argv } : { argv, cwd }),
    readFile: path => $.fs.read(path),
    writeFile: (path, text) => $.fs.write(path, text),
    exists: path => $.fs.exists(path),
    env: async () => ({
      temp: await $.env.get('TEMP'),
      tmpdir: await $.env.get('TMPDIR'),
      os: await $.env.get('OS'),
      home: (await $.env.get('USERPROFILE')) ?? (await $.env.get('HOME')),
    }),
    sessionId: () => $.session.id(),
    cwd: () => $.session.cwd(),
    toast: text => $.ui.toast(text),
    files: () => read($, files),
    updateFiles: async fn => void (await update($, files, all => fn(all ?? {}))),
    showInline: async diff => void (await update($, inline, () => diff)),
  }
}

/** A folder folds or unfolds; a file opens in the editor or as a diff. */
async function press($: EngineInterface, row: Row, prefs: Prefs): Promise<void> {
  try {
    if (row.isDir) await update($, collapsed, list => toggle(list ?? [], row.key))
    else if (row.change) await openChange(hostOf($), row.change, prefs)
  } catch (error) {
    $.ui.toast(`session-info: ${String(error)}`)
  }
}

/** A folder of the Git tree folds or unfolds; a file opens in the editor or as a diff against HEAD. */
async function pressRepo($: EngineInterface, repo: Repo, row: Row<RepoFile>, prefs: Prefs): Promise<void> {
  try {
    if (row.isDir) await update($, collapsed, list => toggle(list ?? [], `${GIT_FOLD}${row.key}`))
    else if (row.change) await openRepoFile(hostOf($), repo.root, row.change, repo.at, prefs)
  } catch (error) {
    $.ui.toast(`session-info: ${String(error)}`)
  }
}

/** Notifies each usage or context threshold the measurement crosses, once; a toast stands in where notifications are off. */
async function alert($: EngineInterface, limits: readonly Limit[], context: { percent?: number; tokens?: number; window: number }): Promise<void> {
  const { alerts, standing } = crossings(limits, context, await read($, alerted), Date.now())
  await update($, alerted, () => standing)
  for (const { title, body } of alerts) {
    const sent = await $.ui.notify(body, { title }).catch(() => ({ isSent: false }))
    if (!sent.isSent) $.ui.toast(`${title}: ${body}`)
  }
}

/** Records a shell call that ran a build or tests as the last one of its kind; any agent's call counts. */
async function inspect($: EngineInterface, input: Record<string, unknown>, ran: Record<string, unknown>, patterns: Patterns): Promise<void> {
  const command = typeof input.command === 'string' ? input.command : ''
  const kinds = classify(command, patterns)
  if (kinds.length === 0 || ran.deny !== undefined) return

  const isError = ran.isError === true
  const result = !isError && typeof ran.result === 'object' && ran.result !== null ? (ran.result as Record<string, unknown>) : {}
  const fallback = typeof ran.result === 'string' ? ran.result : `${result.stdout ?? ''}\n${result.stderr ?? ''}`
  const runs = await checkRuns(hostOf($), kinds, {
    command,
    text: typeof ran.text === 'string' ? ran.text : fallback,
    isError,
    isBackground: typeof result.backgroundTaskId === 'string',
    isAgent: input.agentId !== undefined,
    persistedPath: typeof result.persistedOutputPath === 'string' ? result.persistedOutputPath : undefined,
  }, Date.now())
  await update($, checks, current => runs.reduce((all, run) => ({ ...all, [run.kind]: run }), current ?? NO_CHECKS))
}

/** Reads the repository into the Git section; a call made while a read runs makes that read go once more. */
function refreshRepo($: EngineInterface): Promise<void> {
  if (reading !== undefined) {
    isStale = true

    return reading
  }
  reading = (async () => {
    do {
      isStale = false
      // A read that fails keeps the last state on screen; only git's own answer says the folder is outside a repository.
      const repo = await readRepo(hostOf($), Date.now()).catch(() => undefined)
      if (repo !== undefined) await update($, repoState, () => repo ?? 'outside')
    } while (isStale)
  })().finally(() => {
    reading = undefined
  })

  return reading
}

/** Keeps what a subagent runs on; a step that repeats the model and effort writes nothing, so the pane does not redraw. */
async function noteAgentModel($: EngineInterface, agentId: string, model: string, effort?: string | number): Promise<void> {
  const known = await read($, agentModels)
  const next = withAgentModel(known, agentId, model, effort)
  if (next !== known) await update($, agentModels, () => next)
}

/** Reads /context's breakdown, estimated locally (no token-count calls), for the stacked bar. */
async function refreshContext($: EngineInterface): Promise<void> {
  const usage = await $.session.usage({ breakdown: 'summary' })
  const reading = usage.context.breakdown ? toReading(usage.context.breakdown) : null
  if (reading === null) return
  await update($, contextState, () => reading)
  // After a /clear or a resume the pane's reads no longer redraw it on a write: it is drawn again here.
  $.ui.invalidate('ui.render')
}

/**
 * Runs `reload` once the session id is the next conversation's. A /clear or a resume raises session.end and no start
 * event; the state switches at once, but the session id and its usage only some time later, and a read made before
 * would put the ended conversation's figures in the next one's state.
 */
function afterSwitch($: EngineInterface, endedId: string, reload: () => Promise<void>): void {
  let waited = 0
  const poll = async (): Promise<void> => {
    if ((await $.session.id().catch(() => endedId)) !== endedId) return reload()
    waited += SWITCH_POLL_MS
    if (waited < SWITCH_LIMIT_MS) $.clock.after(SWITCH_POLL_MS, () => void poll())
  }
  $.clock.after(SWITCH_POLL_MS, () => void poll())
}

/** Reads the context when the session has no reading yet: after a /clear or a resume, before any turn ends. */
async function readMissingContext($: EngineInterface): Promise<void> {
  if ((await read($, contextState)) === null) await refreshContext($).catch(() => undefined)
}

/** A resumed session starts with no list in its state: the last todo_write call of the transcript gives it back. */
async function restoreTodos($: EngineInterface): Promise<void> {
  if ((await read($, todos)).length > 0) return
  const messages = await $.session.messages()
  const found = Array.isArray(messages) ? latestTodos(messages) : undefined
  if (found !== undefined) await update($, todos, () => found)
}

/** Asks GitHub about the watched runs once, and notifies each run that completed. */
function pollCi($: EngineInterface): Promise<void> {
  polling ??= (async () => {
    const watch = await read($, ciState)
    if (!isWatching(watch, Date.now())) return
    const { watch: polled, finished } = await pollWatch(argv => $.process.run(argv), watch, Date.now())
    // A push made while the poll ran started a new watch: the old poll's answer is dropped.
    await update($, ciState, current => (current?.since === watch.since ? polled : current))
    for (const run of finished) {
      const body = `${run.workflow} · ${run.conclusion} · ${runDetail(run, Date.now())}`
      const sent = await $.ui.notify(body, { title: 'GitHub Actions' }).catch(() => ({ isSent: false }))
      if (!sent.isSent) $.ui.toast(`GitHub Actions: ${body}`)
    }
  })().finally(() => {
    polling = undefined
  })

  return polling
}

/** Starts following the runs a push, a pull request, a dispatch or a rerun started. */
async function watchCi($: EngineInterface, command: string, output: string): Promise<void> {
  const trigger = ciTrigger(command, output)
  if (trigger === undefined) return
  const git = async (args: string[]) => {
    const done = await $.process.run(['git', ...args]).catch(() => undefined)

    return done?.exitCode === 0 ? done.stdout.trim() : undefined
  }
  const isCommit = trigger.kind === 'push' || trigger.kind === 'pr'
  const sha = isCommit ? await git(['rev-parse', 'HEAD']) : undefined
  const branch = await git(['rev-parse', '--abbrev-ref', 'HEAD'])
  await update($, ciState, () =>
    startWatch(trigger, { ...(sha === undefined ? {} : { sha }), ...(branch === undefined ? {} : { branch }) }, Date.now()),
  )
  await pollCi($)
}

/** The connected MCP server that serves getJiraIssue; servers connect after the session starts, so a miss asks again later. */
async function findJiraServer($: EngineInterface): Promise<string | null> {
  const known = await read($, jiraServer)
  if (known !== null) return known
  const server = (await $.tool.list()).map(tool => serverOf(tool.name)).find(name => name !== undefined) ?? null
  if (server !== null) await update($, jiraServer, () => server)

  return server
}

/** Calls a tool of the Jira server by each name it may go by until one goes through; all failing, the first error stands. */
async function callJira($: EngineInterface, server: string, tool: string, args: Record<string, unknown>) {
  let first: unknown
  for (const name of jiraName === undefined ? serverNames(server) : [jiraName]) {
    try {
      const result = await $.mcp.call(name, tool, args)
      jiraName = name

      return result
    } catch (error) {
      first ??= error
    }
  }
  throw first
}

/** The site from the jiraSite setting, else the first Jira site the server's account reaches. */
async function findJiraSite($: EngineInterface, server: string, setting: unknown): Promise<{ cloudId: string; url?: string } | undefined> {
  jiraSite ??= siteSetting(setting) ?? readSite(await callJira($, server, 'getAccessibleAtlassianResources', {}))

  return jiraSite
}

async function readJira($: EngineInterface, key: string, setting: unknown): Promise<void> {
  if (reads.has(key)) return
  reads.add(key)
  const started = Date.now()
  const store = (fn: (issue: JiraIssue) => JiraIssue) =>
    update($, jiraIssues, list => (list ?? []).map(issue => (issue.key === key ? fn(issue) : issue)))
  try {
    const server = await findJiraServer($)
    if (server === null) return void (await store(issue => ({ ...issue, readAt: Date.now(), error: 'No Atlassian MCP server is connected.' })))
    const site = await findJiraSite($, server, setting)
    if (site === undefined) return void (await store(issue => ({ ...issue, readAt: Date.now(), error: 'No Jira site found: set jiraSite.' })))
    const result = await callJira($, server, 'getJiraIssue', { cloudId: site.cloudId, issueIdOrKey: key, fields: JIRA_FIELDS })
    const url = browseUrl(site.url, key)
    await store(issue => ({ ...readIssue(issue, result, Date.now()), ...(url === undefined ? {} : { url }) }))
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    // The row has room for one line; the transcript keeps the whole message.
    $.ui.log(`session-info: Jira ${key}: ${message}`)
    const server = await read($, jiraServer)
    const blocked = server !== null && isRefusal(message) ? { blockedTool: `mcp__${server}__getJiraIssue` } : {}
    // Claude's own read may land while this one fails: a good reading newer than this read stays.
    await store(issue =>
      issue.error === undefined && issue.readAt !== undefined && issue.readAt >= started
        ? issue
        : { ...issue, readAt: Date.now(), error: errorText(error), ...blocked },
    )
  } finally {
    reads.delete(key)
  }
}

/** Puts the request for the allow rule in the prompt, after any draft: the person sends it, and Claude edits the settings. */
async function askAllow($: EngineInterface, tool: string): Promise<void> {
  const filled = await $.prompt.fill({ text: allowRequest(tool), mode: 'append' }).catch(() => ({ isFilled: false }))
  $.ui.toast(filled.isFilled ? 'session-info: send the request in the prompt to add the rule.' : 'session-info: the prompt could not take the request.')
}

async function copyRule($: EngineInterface, tool: string, surface: RenderSurface): Promise<void> {
  const copied = await $.ui.copy({ text: tool, surface }).catch(() => ({ isCopied: false as const, reason: 'refused' as const }))
  $.ui.toast(copied.isCopied ? `session-info: copied ${tool}` : `session-info: could not copy the rule (${copied.reason}).`)
}

/** The issue as the model's own getJiraIssue call answered it: no call of the mod's, so no permission to ask. */
async function takeIssue($: EngineInterface, key: string, text: string, cloudId: unknown, setting: unknown): Promise<void> {
  const at = Date.now()
  const site = siteSetting(setting)?.url ?? jiraSite?.url ?? (typeof cloudId === 'string' ? siteSetting(cloudId)?.url : undefined)
  const url = browseUrl(site, key)
  await update($, jiraIssues, list => {
    const [top, ...rest] = mention(list ?? [], key, at)
    const issue = readIssue(top ?? { key, at }, { content: [{ type: 'text', text }] }, at)

    return [{ ...issue, ...(url === undefined ? {} : { url }) }, ...rest]
  })
}

/** Puts the mentioned keys on top of the Jira section and reads the ones not read in the last minutes. */
async function noteIssues($: EngineInterface, keys: readonly string[], setting: unknown): Promise<void> {
  if (keys.length === 0) return
  const at = Date.now()
  const before = await read($, jiraIssues)
  await update($, jiraIssues, list => [...keys].reverse().reduce((all, key) => mention(all, key, at), list ?? []))
  for (const key of keys) if (needsRead(before.find(issue => issue.key === key), at)) await readJira($, key, setting)
}

/** The reads run on after the hook that saw the keys returns, so a slow server never holds the prompt. */
function noteText($: EngineInterface, text: string, pattern: RegExp | undefined, setting: unknown): void {
  void noteIssues($, issueKeys(text, pattern), setting).catch(() => undefined)
}

/** Reads the autopick settings from the store, which every window shares, into the pane's mirror. */
async function loadAutopick($: EngineInterface): Promise<AutopickSettings> {
  const settings = settingsOf(await $.store.get(STORE_ON), await $.store.get(STORE_MINUTES))
  const shown = await read($, autopick)
  if (shown.isOn !== settings.isOn || shown.minutes !== settings.minutes) await update($, autopick, () => settings)

  return settings
}

/** Whether ask-autopick is loaded; it answers the same questions, so autopick here stands aside while it is. */
async function checkRival($: EngineInterface): Promise<boolean> {
  const isLoaded = hasRival(await $.command.list())
  if ((await read($, autopickConflict)) !== isLoaded) await update($, autopickConflict, () => isLoaded)

  return isLoaded
}

/** Turning autopick off stops every countdown that runs: those questions wait for the person. */
async function saveAutopick($: EngineInterface, live: Countdowns, change: Partial<AutopickSettings>): Promise<AutopickSettings> {
  const settings = { ...(await loadAutopick($)), ...change }
  await $.store.set(STORE_ON, settings.isOn)
  await $.store.set(STORE_MINUTES, settings.minutes)
  await update($, autopick, () => settings)
  if (!settings.isOn) for (const control of [...live.controls.values()]) control.cancel()

  return settings
}

async function switchAutopick($: EngineInterface, live: Countdowns): Promise<void> {
  const isOn = !(await loadAutopick($)).isOn
  if (isOn && (await checkRival($))) return void $.ui.toast('session-info: ask-autopick is loaded and answers questions too; disable it first.')
  await saveAutopick($, live, { isOn })
}

/** `/autopick`, `/autopick on | off` and `/autopick <minutes>`. */
async function runAutopick($: EngineInterface, live: Countdowns, args: string): Promise<{ text: string }> {
  const arg = args.trim().toLowerCase()
  const isBlocked = await checkRival($)
  let settings = await loadAutopick($)
  if (arg === 'on' || arg === 'off') {
    if (arg === 'off' || !isBlocked) settings = await saveAutopick($, live, { isOn: arg === 'on' })
  } else if (arg !== '') {
    const minutes = minutesOf(arg)
    if (minutes === undefined) return { text: AUTOPICK_USAGE }
    settings = await saveAutopick($, live, { minutes })
  }

  return { text: statusText(settings, isBlocked) }
}

/** Redraws the pane each second while a countdown runs. */
function syncTicker($: EngineInterface, live: Countdowns): void {
  if (live.controls.size === 0) {
    live.ticker?.cancel()
    live.ticker = undefined
  } else live.ticker ??= $.clock.every(1_000, () => $.ui.invalidate('ui.render'))
}

const dropWait = ($: EngineInterface, id: string) => update($, autopickWaits, list => (list ?? []).filter(wait => wait.id !== id))

/**
 * An AskUserQuestion call while autopick is on: the dialog opens as usual, and when the wait runs out (or the person
 * presses Pick now) the hook answers the call with the recommended options in the person's place. The engine then
 * closes the dialog and settles the abandoned `next(e)` as rejected, which the hook absorbs.
 */
async function answerOrPick($: EngineInterface, live: Countdowns, input: { tool_use_id?: string }, questions: readonly Question[], pending: Promise<ToolCallResult>): Promise<ToolCallResult> {
  const settings = await read($, autopick)
  const picks = picksOf(questions)
  const at = await $.clock.now()
  const id = input.tool_use_id ?? `ask-${at}`
  const ms = settings.minutes * MINUTE
  await update($, autopickWaits, list => [...(list ?? []), { id, picks: picks ?? null, at, ...(picks ? { deadline: at + ms } : {}) }])
  if (picks === undefined) {
    try {
      return await pending
    } finally {
      await dropWait($, id)
    }
  }
  let fire: (isByHand: boolean) => void = () => undefined
  const fired = new Promise<boolean>(resolve => {
    fire = resolve
  })
  const timer = $.clock.after(ms, () => fire(false))
  live.controls.set(id, {
    pick: () => {
      timer.cancel()
      fire(true)
    },
    cancel: () => {
      timer.cancel()
      live.controls.delete(id)
      syncTicker($, live)
      // The wait keeps its row without a deadline: the question is the person's again.
      void update($, autopickWaits, list => (list ?? []).map(wait => (wait.id === id ? { id, picks: wait.picks, at: wait.at } : wait)))
    },
  })
  syncTicker($, live)
  try {
    const first = await Promise.race([pending, fired])
    if (typeof first !== 'boolean') return first
    // Turned off in another window during the wait: the question stays for the person.
    if (!first && !(await loadAutopick($)).isOn) {
      live.controls.get(id)?.cancel()

      return await pending
    }
    pending.catch(() => undefined)
    const pick: AutopickPick = { picks, at: await $.clock.now(), minutes: settings.minutes, isByHand: first }
    await update($, autopickLast, () => pick)
    $.ui.log(pickedLog(pick))

    return { result: { questions, answers: picks, annotations: {} }, context: [pickedNote(pick)] } as never
  } finally {
    timer.cancel()
    live.controls.delete(id)
    syncTicker($, live)
    await dropWait($, id)
  }
}

async function openPane($: EngineInterface, isGitShown: boolean, isSessionShown: boolean): Promise<{ text: string }> {
  if (isGitShown) void refreshRepo($)
  if (isSessionShown) void refreshContext($).catch(() => undefined)
  await $.ui.open({ id: PANE, title: TITLE, focus: true })

  return { text: 'Session info pane opened.' }
}

export const register: Register = (on, options) => {
  const prefs: Prefs = {
    viewer: (options.viewer as Viewer | undefined) ?? 'auto',
    editor: (options.editor as Editor | undefined) ?? 'auto',
  }
  const icons = (options.icons as IconSet | undefined) ?? 'unicode'
  const shows = {
    session: options.showSession !== false,
    turn: options.showLastTurn !== false,
    todos: options.showTodos !== false,
    skills: options.showSkills !== false,
    ci: options.showCi !== false,
    usage: options.showUsage !== false,
    agents: options.showAgents !== false,
    checks: options.showChecks !== false,
    git: options.showGit !== false,
    changes: options.showChanges !== false,
    jira: options.showJira !== false,
    autopick: options.showAutopick !== false,
  }
  const live: Countdowns = { controls: new Map() }
  const keyPattern = toKeyPattern(options.jiraKeyPattern)
  const gitClient = typeof options.gitClient === 'string' ? options.gitClient.trim() : 'lazygit'
  const paneBackground = typeof options.paneBackground === 'string' ? options.paneBackground.trim() : ''
  const patterns: Patterns = { build: toPattern(options.buildPattern), test: toPattern(options.testPattern) }
  const isAlerting = options.alerts !== false
  const order = parseSectionOrder(options.sectionOrder)
  const groups = parseTabGroups(options.tabGroups)
  const groupOf = new Map(groups.flatMap(group => group.members.map(key => [key, group] as const)))
  /** A grouped section folds with its group, whichever members show now. */
  const foldOf = (key: SectionKey): string => groupOf.get(key)?.key ?? key
  const isLive = shows.session || shows.usage || shows.agents || shows.checks
  const isOpenOnStart = options.openOnStart === true

  on('session.start', async ($, e, next) => {
    clearCount = 0
    await $.command.register({
      name: 'session-info',
      description: 'Show the session, plan usage and the files this session created, modified or deleted',
    })
    await $.command.register({ name: 'changes', description: 'Same as /session-info' })
    if (shows.todos) {
      await $.tool.register(TODO_SPEC).catch(error => $.ui.toast(`session-info: ${String(error)}`))
      await restoreTodos($).catch(() => undefined)
    }
    if (isLive || shows.git)
      $.clock.every(MINUTE, () => {
        if (isLive) void update($, now, () => Date.now())
        // The write alone redraws nothing after a /clear or a resume.
        if (isLive) $.ui.invalidate('ui.render')
        if (shows.session) void readMissingContext($)
        if (shows.git) void refreshRepo($)
      })
    if (shows.git) void refreshRepo($)
    if (shows.session) void refreshContext($).catch(() => undefined)
    if (shows.ci) {
      $.clock.every(CI_POLL_MS, () => void pollCi($).catch(() => undefined))
      // A reload during a run picks the watch up again from the state.
      void pollCi($).catch(() => undefined)
    }
    if (shows.jira) void findJiraServer($).catch(() => undefined)
    if (shows.autopick) {
      await $.command.register({
        name: 'autopick',
        description: 'Pick the recommended option of a question left unanswered: status, on, off, <minutes>',
        argumentHint: '[on | off | <minutes>]',
        immediate: true,
      })
      await loadAutopick($).catch(() => undefined)
      // The other plugins register their commands in their own session.start: the check waits for them.
      $.clock.after(5_000, () => void checkRival($).catch(() => undefined))
    }
    // The engine draws a pane that the person did not ask for only on a wide terminal; a narrow one keeps it until /session-info.
    if (isOpenOnStart && e.isInteractive) await $.ui.open({ id: PANE, title: TITLE })

    return next(e)
  })

  // /clear starts a new conversation in the same process and raises no session.start: what belonged to the old one goes here.
  on('classic.SessionStart', async ($, e, next) => {
    const started = await next(e)
    if (e.source === 'clear') {
      draft = undefined
      if (shows.todos) await update($, todos, () => [])
      if (shows.turn) await update($, lastTurn, () => null)
      if (shows.skills) await update($, skills, () => [])
      if (shows.jira) await update($, jiraIssues, () => [])
      if (shows.agents) await update($, agentModels, () => ({}))
      if (shows.autopick) await update($, autopickLast, () => null)
    }

    return started
  })

  // A /clear ends the session as session.end with reason clear; the module and its count go on.
  on('session.end', async ($, e, next) => {
    if (e.reason === 'clear') {
      clearCount += 1
      // The count is no state value: nothing else draws it.
      if (shows.session) $.ui.invalidate('ui.render')
    }
    // The next conversation's state starts empty and a draw may not write: what session.start loads is loaded here.
    if (e.reason === 'clear' || e.reason === 'resume') {
      const isResume = e.reason === 'resume'
      afterSwitch($, e.sessionId, async () => {
        if (shows.todos && isResume) await restoreTodos($).catch(() => undefined)
        if (shows.git) void refreshRepo($)
        if (shows.jira) await findJiraServer($).catch(() => undefined)
        if (shows.autopick) {
          await loadAutopick($).catch(() => undefined)
          await checkRival($).catch(() => undefined)
        }
        // A CI watch belongs to the conversation that pushed.
        if (shows.ci) await update($, ciState, () => null)
        if (shows.session) await refreshContext($).catch(() => undefined)
        $.ui.invalidate('ui.render')
      })
    }

    return next(e)
  })

  on('command.run', { command: 'session-info' }, async $ => openPane($, shows.git, shows.session))

  on('command.run', { command: 'changes' }, async $ => openPane($, shows.git, shows.session))

  if (shows.autopick) on('command.run', { command: 'autopick' }, async ($, e) => runAutopick($, live, String(e.args ?? '')))

  // A commit made outside the session, in the Git client for example, shows by the next prompt.
  on('prompt.submit', async ($, e, next) => {
    if (shows.git) void refreshRepo($)
    if (shows.jira) {
      // MCP servers connect after the session starts: each prompt looks again until one serves Jira.
      void findJiraServer($).catch(() => undefined)
      noteText($, e.text, keyPattern, options.jiraSite)
    }

    return next(e)
  })

  if (shows.todos) {
    const instruction = todoPrompt(minSteps(options.todoMinSteps), options.todoInstruction)
    // The section rides after the engine's own, on the session side of the cache boundary.
    on('prompt.compose', async ($, e, next) => {
      const composed = await next(e)
      if (!e.tools.includes(TODO_TOOL)) return composed

      return { sections: [...composed.sections, { id: 'session-info:todos', text: instruction, scope: 'session' }] }
    })

    on('tool.call', { tool: TODO_TOOL }, async ($, e) => {
      if (e.agentId !== undefined) return { result: 'Ignored: only the main conversation keeps the task list.' }
      // This hook answers the call itself, so the general tool.call hook never counts it for the Last turn section.
      if (shows.turn && draft !== undefined) draft = withTool(draft, e.tool)
      const parsed = parseTodos(e as Record<string, unknown>)
      if (typeof parsed === 'string') return { deny: parsed }
      await update($, todos, () => parsed)

      return { result: todoReply(parsed) }
    })
  }

  if (shows.skills) {
    // The Skill tool's call raises skill.prompt while it runs; a slash command raises it alone, in the main conversation.
    on('tool.call', { tool: 'Skill' }, async ($, e, next) => {
      const input = e as Record<string, unknown>
      const name = typeof input.skill === 'string' ? input.skill : ''
      const pending = { name, ...(e.agentId === undefined ? {} : { agentId: e.agentId }), isSeen: false }
      pendingSkills.push(pending)
      try {
        const ran = await next(e)
        if (!pending.isSeen && name !== '' && ran.deny === undefined && !ran.isError)
          await update($, skills, list => startSkill(list ?? [], name, e.agentId, Date.now()))

        return ran
      } finally {
        pendingSkills.splice(pendingSkills.indexOf(pending), 1)
      }
    })

    on('skill.prompt', async ($, e, next) => {
      const prompted = await next(e)
      const pending = pendingSkills.find(one => !one.isSeen && isSameSkill(one.name, e.skill))
      if (pending) pending.isSeen = true
      await update($, skills, list => startSkill(list ?? [], e.skill, pending?.agentId, Date.now()))

      return prompted
    })
  }

  if (shows.turn) {
    on('turn.start', async ($, e, next) => {
      const usage = await $.session.usage().catch(() => undefined)
      draft = startDraft(e.turnId, usage?.cost?.usd)

      return next(e)
    })
  }

  if (shows.turn || shows.agents) {
    // The step only notes the request; it leaves the stream to the hooks beneath it.
    on('turn.step', async function* ($, e, next) {
      if (shows.turn && e.agentId === undefined && draft !== undefined) draft = withStep(draft, e)
      if (shows.agents && e.agentId !== undefined) await noteAgentModel($, e.agentId, e.model, e.effort)

      return yield* next(e)
    })
  }

  on('session.measure', async ($, e, next) => {
    if (isLive) await update($, now, () => Date.now())
    if (isAlerting) await alert($, e.rateLimits, e.context)

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const answered = await next(e)
    if (e.agentId !== undefined && shows.agents) await update($, now, () => Date.now())
    if (e.agentId === undefined && shows.session) void refreshContext($).catch(() => undefined)
    if (e.agentId === undefined)
      await update($, turns, stats => ({
        count: (stats ?? NO_TURNS).count + 1,
        outputTokens: (stats ?? NO_TURNS).outputTokens + (e.usage?.output_tokens ?? 0),
        lastMs: e.durationMs,
      }))
    if (shows.turn && e.agentId !== undefined && draft !== undefined) draft = withSubagentUsage(draft, e.usage)
    if (shows.skills) await update($, skills, list => endSkills(list ?? [], e.agentId))
    if (shows.jira && e.agentId === undefined) noteText($, e.answer, keyPattern, options.jiraSite)
    if (shows.turn && e.agentId === undefined) {
      const own = draft
      draft = undefined
      const usage = await $.session.usage().catch(() => undefined)
      await update($, lastTurn, () => toRecord(own, e, usage?.cost?.usd, Date.now()))
    }

    return answered
  })

  on('agent.spawn', async ($, e, next) => {
    const spawned = await next(e)
    if (shows.turn && draft !== undefined) draft = withSpawn(draft)
    if (shows.agents && spawned.agentId !== undefined) await noteAgentModel($, spawned.agentId, spawned.model)
    if (shows.agents) await update($, now, () => Date.now())

    return spawned
  })

  on('session.compact', async ($, e, next) => {
    const compacted = await next(e)
    if (e.agentId === undefined && e.trigger !== 'precompute' && 'messages' in compacted) {
      await update($, compactions, count => (count ?? 0) + 1)
      if (shows.session) void refreshContext($).catch(() => undefined)
    }

    return compacted
  })

  on('tool.call', async ($, e, next) => {
    if (shows.turn && e.agentId === undefined && draft !== undefined) draft = withTool(draft, e.tool)
    if (e.tool === 'AskUserQuestion') return next(e)
    const isShell = (SHELLS as readonly string[]).includes(e.tool)
    const isChecked = shows.checks && isShell
    const isRepoTool = shows.git && FILE_TOOLS.includes(e.tool)
    const isCiTool = shows.ci && isShell
    // The model's own read of an issue names it as clearly as a mention, and its answer is the read the section needs.
    const input = e as Record<string, unknown>
    const asked = typeof input.issueIdOrKey === 'string' ? input.issueIdOrKey.toUpperCase() : ''
    const isJiraRead = shows.jira && serverOf(e.tool) !== undefined && isIssueKey(asked)
    if (!shows.changes && !isChecked && !isRepoTool && !isCiTool && !isJiraRead) return next(e)
    const before = shows.changes && isShell ? await gitStatus(hostOf($)).catch(() => undefined) : undefined
    const ran = await next(e)
    const toast = (error: unknown) => $.ui.toast(`session-info: ${String(error)}`)
    if (shows.changes && ran.deny === undefined && !ran.isError) await track(hostOf($), e.tool, ran.result, before).catch(toast)
    if (isChecked) await inspect($, e as Record<string, unknown>, ran as Record<string, unknown>, patterns).catch(toast)
    if (isRepoTool && ran.deny === undefined) void refreshRepo($)
    if (isCiTool && ran.deny === undefined && !ran.isError) {
      const command = typeof (e as Record<string, unknown>).command === 'string' ? String((e as Record<string, unknown>).command) : ''
      void watchCi($, command, typeof ran.text === 'string' ? ran.text : '').catch(toast)
    }
    if (isJiraRead && ran.deny === undefined && !ran.isError && typeof ran.text === 'string')
      await takeIssue($, asked, ran.text, input.cloudId, options.jiraSite).catch(toast)

    return ran
  }).catch(($, e, next) => next(e))

  if (shows.autopick) {
    // Registered after the general tool.call hook so it sits beneath it: the abandoned dialog's rejection stays here.
    on('tool.call', { tool: 'AskUserQuestion' }, async ($, e, next) => {
      const settings = await loadAutopick($)
      if (!settings.isOn || (await checkRival($))) return next(e)
      const questions = (e as { questions?: unknown }).questions

      return answerOrPick($, live, e, Array.isArray(questions) ? (questions as Question[]) : [], next(e))
    }).catch(($, e, next) => next(e))
  }

  /** The trees that leave rows out, as the last draw placed them in the body; none while every tree shows whole. */
  let scrollTargets: ScrollTarget[] = []

  on('ui.scroll', { component: 'Pane', requestId: PANE }, async ($, e, next) => {
    const target = targetAt(scrollTargets, e.pointer?.row)
    if (target === undefined) return next(e)
    if (target.key === 'git') await update($, gitTop, from => movedTo(from, e.by, target))
    else await update($, changesTop, from => movedTo(from, e.by, target))

    return {}
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button, Code } = $.ui.resolve(e)
    const isTerminal = e.surface === 'terminal'
    const { card, tiles } = widgets({ Box, Text }, isTerminal)
    const cols = Math.max(20, e.props.bodyColumns)
    const isCards = !isTerminal || isFramed(cols)
    const inner = isCards ? cols - FRAME_COLUMNS : cols
    const chrome = isCards ? 1 + FRAME_ROWS : 2
    const shut = new Set(await read($, collapsed))
    const isOpen = (key: SectionKey): boolean => !shut.has(foldOf(key))
    const issueList = shows.jira ? await read($, jiraIssues) : []
    // The section waits for an Atlassian MCP server: without one it has nothing to read.
    const isJiraShown = shows.jira && (issueList.length > 0 || (await read($, jiraServer)) !== null)
    const present: Record<SectionKey, boolean> = {
      '#session': shows.session,
      '#turn': shows.turn,
      '#todos': shows.todos,
      '#autopick': shows.autopick,
      '#skills': shows.skills,
      '#ci': shows.ci,
      '#jira': isJiraShown,
      '#usage': shows.usage,
      '#agents': shows.agents,
      '#checks': shows.checks,
      '#git': shows.git,
      '#changes': shows.changes,
    }
    const activeTabs = groups.length > 0 ? await read($, tabs) : {}
    const membersOf = (group: TabGroup): SectionKey[] => group.members.filter(key => present[key])
    /** The stored tab while it still shows, else the first member that does. */
    const activeOf = (group: TabGroup): SectionKey | undefined => {
      const members = membersOf(group)

      return members.find(key => key === activeTabs[group.key]) ?? members[0]
    }
    /** Whether the section draws now: on, and the active tab when it is in a group. */
    const counts = (key: SectionKey): boolean => {
      const group = groupOf.get(key)

      return present[key] && (group === undefined || activeOf(group) === key)
    }
    /** The sections to draw, in order; a group sits where its first shown member sits, so a tab switch does not move the card. */
    const slots = order.flatMap((key): SectionKey[] => {
      const group = groupOf.get(key)
      if (group === undefined) return present[key] ? [key] : []
      const active = activeOf(group)

      return active !== undefined && order.find(one => groupOf.get(one) === group && present[one]) === key ? [active] : []
    })
    await read($, now)
    const isDetailed = shows.session && isOpen('#session') && (await read($, breakdown))
    const usage = isLive ? await $.session.usage() : undefined
    const reading = shows.session ? await read($, contextState) : null
    const limits: Limit[] = shows.usage && usage ? ordered(usage.rateLimits) : []
    const stats = shows.session || shows.turn ? await read($, turns) : NO_TURNS
    const compacted = shows.session ? await read($, compactions) : 0
    const turnRecord = shows.turn ? await read($, lastTurn) : null
    const taskList = shows.todos ? await read($, todos) : []
    const skillList = shows.skills ? await read($, skills) : []
    const pickSettings = shows.autopick ? await read($, autopick) : DEFAULT_SETTINGS
    const waits = shows.autopick ? await read($, autopickWaits) : []
    const lastPick = shows.autopick ? await read($, autopickLast) : null
    const isPickBlocked = shows.autopick && (await read($, autopickConflict))
    // The countdowns and the last pick's age run on the engine's clock, the one their times were set by.
    const clockNow = waits.length > 0 || lastPick ? await $.clock.now() : 0
    const ciWatch = shows.ci ? await read($, ciState) : null
    const ciRuns = ciWatch?.runs.slice(0, CI_ROOM) ?? []
    const issues = issueList.slice(0, JIRA_ROOM)
    // The settings are read only while a refusal is on screen: the buttons go once the rule is in place.
    const permissions = issues.some(issue => issue.blockedTool !== undefined) ? await $.settings.read() : undefined
    const needsAllow = (issue: JiraIssue): issue is JiraIssue & { blockedTool: string } =>
      issue.blockedTool !== undefined && !isAllowed(permissions, issue.blockedTool)
    const agents = shows.agents ? await $.agent.list() : []
    const loops = shows.agents || !skillList.some(use => use.agentId !== undefined) ? agents : await $.agent.list()
    const changes = shows.changes ? Object.values(await read($, files)) : []
    const diff = shows.changes ? await read($, inline) : null
    const rows = flatten(buildTree(await $.session.cwd(), changes), shut)
    const repo = shows.git ? await read($, repoState) : null
    const isRepo = repo !== null && repo !== 'outside'
    // A repository read before the files were kept has none until the next read.
    const repoFiles = isRepo ? (repo.files ?? []) : []
    const gitShut = new Set([...shut].filter(isGitFold).map(key => key.slice(GIT_FOLD.length)))
    const gitTree = isRepo ? flatten(buildTree(repo.root, repoFiles), gitShut) : []
    // Before the first reply the usage has no context figures; the /context reading has them already.
    const context =
      usage?.context.tokens === undefined && reading
        ? { tokens: reading.total, window: reading.window, percent: (reading.total / reading.window) * 100 }
        : usage?.context
    const figures: Tile[] =
      isCards && shows.session && usage !== undefined
        ? [
            ...(usage.cost === undefined ? [] : [{ key: 'cost', value: cost(usage.cost.usd), label: 'cost' }]),
            { key: 'elapsed', value: duration(Date.now() - usage.startedAt), label: 'elapsed' },
          ]
        : []
    const tileRows = tileLayout(figures.length, cols).rows
    const turnRows = counts('#turn') ? chrome + (isOpen('#turn') ? (turnRecord ? turnLines(turnRecord).length : 1) : 0) : 0
    const skillRoom = Math.min(skillList.length, SKILL_ROOM)
    const skillsRows = counts('#skills') ? chrome + (isOpen('#skills') ? Math.max(1, skillRoom + (skillList.length > skillRoom ? 1 : 0)) : 0) : 0
    const ciBody = ciRuns.reduce((sum, run) => sum + 1 + (run.jobs.length > 0 ? 1 : 0) + (run.url === '' ? 0 : 1), 0)
    const ciRows = counts('#ci') ? chrome + (isOpen('#ci') ? Math.max(1, ciBody + (ciWatch?.error === undefined ? 0 : 1)) : 0) : 0
    const jiraRows = counts('#jira') ? chrome + (isOpen('#jira') ? Math.max(1, issues.length * 2 + issues.filter(needsAllow).length) : 0) : 0
    const todoRoom = Math.min(taskList.length, TODO_ROOM)
    const todosRows = counts('#todos') ? chrome + (isOpen('#todos') ? Math.max(1, todoRoom + (taskList.length > todoRoom ? 1 : 0)) : 0) : 0
    const autopickBody = 1 + (isPickBlocked ? 1 : 0) + waits.length + (lastPick ? 1 : 0)
    const autopickRows = counts('#autopick') ? chrome + (isOpen('#autopick') ? autopickBody : 0) : 0
    const usageRows = counts('#usage') ? chrome + (isOpen('#usage') ? Math.max(1, limits.length * 2) : 0) : 0
    const legend = isDetailed && reading ? legendLines(reading, inner) : []
    const sessionRows = counts('#session') ? chrome + (isOpen('#session') ? 3 + legend.length : 0) : 0
    const agentLines = agentRows(agents)
    const models = shows.agents ? await read($, agentModels) : {}
    const agentRoom = Math.min(agentLines.length, 8)
    const agentsRows = counts('#agents') ? chrome + (isOpen('#agents') ? agentRoom + (agentLines.length > agentRoom ? 1 : 0) : 0) : 0
    const lastChecks = shows.checks ? await read($, checks) : NO_CHECKS
    const views = checkViews(lastChecks)
    const checksRows = counts('#checks') ? chrome + (isOpen('#checks') ? Math.max(1, checkRowCount(views)) : 0) : 0
    const isChangesTree = counts('#changes') && isOpen('#changes')
    const isGitTree = counts('#git') && isOpen('#git') && gitTree.length > 0
    // The room below holds one tree's buttons, hint and overflow row; a second tree adds its own 4.
    const gitExtra = isGitTree && isChangesTree ? 4 : 0
    const gitRows = counts('#git') ? chrome + (isOpen('#git') ? repoRowCount(repo) + gitExtra : 0) : 0
    const changesFrame = counts('#changes') && isCards ? FRAME_ROWS : 0
    const isEditing = await read($, layout)
    /** The sections their show* option turned off: the footer offers them back. */
    const hidden = order.filter(key => options[showOption(key)] === false)
    const footerRows = 1
    const above = tileRows + usageRows + sessionRows + turnRows + todosRows + autopickRows + skillsRows + ciRows + jiraRows + agentsRows + checksRows + gitRows + changesFrame + footerRows
    const room = isTerminal ? Math.max(3, (e.viewport?.rows ?? 30) - above - (diff ? 16 : 7)) : Number.MAX_SAFE_INTEGER
    // Two trees on screen split the room: the Git tree takes up to half, the Changes tree the rest.
    const gitRoom = isChangesTree ? Math.min(gitTree.length, Math.max(3, Math.floor(room / 2))) : room
    const changesRoom = isGitTree ? Math.max(3, room - gitRoom) : room
    const changesFrom = clampOffset(await read($, changesTop), rows.length, changesRoom)
    const gitFrom = clampOffset(await read($, gitTop), gitTree.length, gitRoom)
    // Without the Changes tree on screen, its hotkeys are free for the Git tree.
    const gitView: ScrollView = { id: 'git', total: gitTree.length, from: gitFrom, room: gitRoom, jump: to => void update($, gitTop, () => to), isKeyed: !counts('#changes') }
    const changesView: ScrollView = { id: 'changes', total: rows.length, from: changesFrom, room: changesRoom, jump: to => void update($, changesTop, () => to), isKeyed: true }
    // Where each list starts in the body, from the rows the sections above are known to take: the frame's top border, the header and the rows before the list.
    const listTop = (isCards ? 1 : 0) + 1
    const fixedRows: Partial<Record<SectionKey, number>> = {
      '#session': sessionRows,
      '#turn': turnRows,
      '#todos': todosRows,
      '#autopick': autopickRows,
      '#skills': skillsRows,
      '#ci': ciRows,
      '#jira': jiraRows,
      '#usage': usageRows,
      '#agents': agentsRows,
      '#checks': checksRows,
    }
    const gitShown = Math.min(gitTree.length, gitRoom)
    const changesShown = Math.min(rows.length, changesRoom)
    const targets: ScrollTarget[] = []
    let sectionTop = tileRows
    for (const key of slots) {
      if (key === '#git' && isGitTree) targets.push({ key: 'git', start: sectionTop + listTop + repoRowCount(repo), rows: gitShown, overflow: gitTree.length - gitShown })
      if (key === '#changes' && isChangesTree) targets.push({ key: 'changes', start: sectionTop + listTop, rows: changesShown, overflow: rows.length - changesShown })
      sectionTop += key === '#git' ? chrome + repoRowCount(repo) + gitShown + 4 : key === '#changes' ? chrome + changesShown + 4 : (fixedRows[key] ?? 0)
    }
    scrollTargets = targets.filter(target => target.overflow > 0)

    const section = (key: SectionKey, children: RenderChildren) =>
      isCards ? card(foldOf(key), isOpen(key), children) : (
        <Box flexDirection="column" marginBottom={key === slots.at(-1) ? 0 : 1}>
          {children}
        </Box>
      )

    /** What an inactive tab adds to its title, so the hidden section still says it has something. */
    const badge = (key: SectionKey): string => {
      if (key === '#ci') {
        const state = ciWatch ? watchState(ciWatch) : undefined

        return state === undefined ? '' : ` ${CI_STATUS[state].glyph}`
      }
      const count: Partial<Record<SectionKey, number>> = {
        '#changes': changes.length,
        '#git': repoFiles.length,
        '#skills': skillList.length,
        '#jira': issueList.length,
        '#todos': taskList.length,
        '#autopick': waits.length,
        '#agents': agents.length,
      }

      return count[key] ? ` ${count[key]}` : ''
    }

    /** A tab opens its group too, so a press on a folded group shows what was picked. */
    const pick = async (group: TabGroup, key: SectionKey) => {
      await update($, tabs, all => ({ ...all, [group.key]: key }))
      await update($, collapsed, list => (list ?? []).filter(one => one !== group.key))
    }

    const toast = (error: unknown) => $.ui.toast(`session-info: ${String(error)}`)

    /**
     * Changes one of the mod's settings as /config would; the engine then loads the module again with it. A load during
     * an autopick countdown would drop its timer, so the layout waits until no countdown runs.
     */
    const setOption = async (field: string, value: boolean | string) => {
      if (live.controls.size > 0) return void $.ui.toast('session-info: the layout changes after the autopick countdown ends or you cancel it.')
      const done = await $.config.set({ key: `session-info.${field}`, value })
      if (done.deny !== undefined) $.ui.toast(`session-info: ${done.deny}`)
    }
    const moveTo = (key: SectionKey, direction: 1 | -1) =>
      void setOption('sectionOrder', orderText(moveCard(order, groups, one => present[one], key, direction))).catch(toast)

    /** Up, down and hide, in place of the header's right side while the pane is in layout mode. */
    const layoutButtons = (key: SectionKey) => {
      const fold = foldOf(key)

      return (
        <Box flexDirection="row" gap={2} flexShrink={0} paddingLeft={1}>
          <Button plain key={`move-up:${fold}`} onPress={() => moveTo(key, -1)}>
            <Text color="suggestion">↑</Text>
          </Button>
          <Button plain key={`move-down:${fold}`} onPress={() => moveTo(key, 1)}>
            <Text color="suggestion">↓</Text>
          </Button>
          <Button plain key={`hide:${key}`} onPress={() => void setOption(showOption(key), false).catch(toast)}>
            <Text color="error">✕</Text>
          </Button>
        </Box>
      )
    }

    /** The section's title, or the tabs of its group when two or more of them show; the right side is the active one's. */
    const header = (key: SectionKey, title: string, right: string, aside?: RenderChildren) => {
      const fold = foldOf(key)
      const group = groupOf.get(key)
      const members = group ? membersOf(group) : []
      const arrow = isOpen(key) ? '▾' : '▸'
      const foldButton = (label: string) => (
        <Button plain key={`section:${fold}`} onPress={() => void update($, collapsed, list => toggle(list ?? [], fold))}>
          <Text bold color="claude">{label}</Text>
        </Button>
      )

      return (
        <Box flexDirection="row" justifyContent="space-between">
          {group === undefined || members.length < 2 ? (
            foldButton(`${arrow} ${title}`)
          ) : (
            <Box flexDirection="row" gap={1}>
              {foldButton(arrow)}
              {members.map((member, index) => [
                index > 0 && <Text dimColor>│</Text>,
                <Button plain key={`tab:${member}`} onPress={() => void pick(group, member)}>
                  <Text {...(member === key ? { bold: true, color: 'claude' } : { dimColor: true })}>
                    {member === key ? title : `${TITLES[member]}${badge(member)}`}
                  </Text>
                </Button>,
              ])}
            </Box>
          )}
          {isEditing ? layoutButtons(key) : (aside ?? <Text dimColor>{right}</Text>)}
        </Box>
      )
    }

    /** Block characters are cell-wide only in a terminal; elsewhere the bar is two Boxes sized by percentage. */
    const meter = (percent: number) => {
      if (isTerminal) {
        const { filled, empty } = bar(percent, inner - 6)

        return (
          <Box flexDirection="row">
            <Text color={colorOf(percent)}>{filled}</Text>
            <Text dimColor>{empty}</Text>
            <Text color={colorOf(percent)}>{` ${percentText(percent)}`}</Text>
          </Box>
        )
      }
      const share = percent > 0 ? Math.min(100, Math.max(1, Math.round(percent))) : 0

      return (
        <Box flexDirection="row" alignItems="center" gap={1}>
          <Box flexGrow={1} flexDirection="row" height={1} backgroundColor="subtle">
            <Box width={`${share}%`} height={1} backgroundColor={colorOf(percent)} />
          </Box>
          <Text color={colorOf(percent)}>{percentText(percent)}</Text>
        </Box>
      )
    }

    /** The context window as one bar of runs, a color per category; the free space a thin line, the compaction buffer shaded. */
    const stackedBar = (reading: ContextReading, percent: number) => {
      if (isTerminal) {
        const widths = cellWidths(reading, inner - 6)

        return (
          <Box flexDirection="row">
            {/* One Text holds every run, so the layout measures the bar as one string and keeps the percentage on its row. */}
            <Text wrap="truncate-end">
              {reading.slices.map((slice, i) =>
                (widths[i] ?? 0) === 0 ? null : (
                  <Text color={slice.kind === 'used' ? slice.color : undefined} dimColor={slice.kind !== 'used'}>
                    {GLYPH[slice.kind].repeat(widths[i] ?? 0)}
                  </Text>
                ),
              )}
            </Text>
            <Box flexShrink={0}>
              <Text color={colorOf(percent)}>{` ${percentText(percent)}`}</Text>
            </Box>
          </Box>
        )
      }

      return (
        <Box flexDirection="row" alignItems="center" gap={1}>
          <Box flexGrow={1} flexDirection="row" height={1}>
            {reading.slices.map(slice => {
              const width = Math.max(slice.kind === 'used' ? 1 : 0, Math.round((slice.tokens / reading.window) * 100))

              return width === 0 ? null : (
                <Box
                  width={`${width}%`}
                  height={1}
                  backgroundColor={slice.kind === 'used' ? slice.color : slice.kind === 'free' ? 'subtle' : 'inactive'}
                />
              )
            })}
          </Box>
          <Text>{percentText(percent)}</Text>
        </Box>
      )
    }

    const legendRows = (reading: ContextReading) =>
      legend.map(line => (
        <Box flexDirection="row" gap={LEGEND_GAP}>
          {line.map(slice => (
            <Box flexDirection="row" gap={1} flexShrink={0}>
              <Text color={slice.kind === 'used' ? slice.color : undefined} dimColor={slice.kind !== 'used'}>
                {SWATCH[slice.kind]}
              </Text>
              <Text dimColor={slice.kind !== 'used'}>{legendText(slice, reading.window)}</Text>
            </Box>
          ))}
        </Box>
      ))

    const limitRows = (limit: Limit) => {
      const reset = resetIn(limit.resetsAt, Date.now())

      return (
        <Box flexDirection="column">
          <Box flexDirection="row" justifyContent="space-between">
            <Text wrap="truncate-end">{labelOf(limit.kind)}</Text>
            {reset !== undefined && <Text dimColor wrap="truncate-end">{reset}</Text>}
          </Box>
          {meter(limit.percentUsed)}
        </Box>
      )
    }

    /** One row of a tree: a folder with its file count when folded, or a file with its icon and the mark after its name. */
    const treeLine = <T,>(row: Row<T>, id: string, onPress: () => void, status: ChangeStatus | undefined, mark: RenderChildren, color?: string) => (
      <Box flexDirection="row">
        <Text dimColor>{row.guide}</Text>
        <Button plain key={`${id}${row.isDir ? 'd' : 'f'}:${row.key}`} onPress={onPress}>
          {row.isDir || status === undefined
            ? [
                <Text color="suggestion">{folderIcon(icons, row.isOpen)}</Text>,
                ` ${row.name}`,
                <Text dimColor>{row.isOpen ? '' : `  ${row.fileCount}`}</Text>,
              ]
            : [
                <Text color={color ?? STATUS[status].color}>{fileIcon(icons, row.name, status)}</Text>,
                ' ',
                <Text strikethrough={status === 'deleted'} dimColor={status === 'deleted'}>
                  {row.name}
                </Text>,
                mark,
              ]}
        </Button>
      </Box>
    )

    /** The rows of a tree from `from` on, each with its slice of the scrollbar once the tree leaves rows out. */
    const scrolled = <T,>(list: Row<T>[], view: ScrollView, draw: (row: Row<T>) => RenderChildren) => {
      const bar = scrollbar(view.total, view.room, view.from)

      return list.slice(view.from, view.from + view.room).map((row, index) =>
        bar.length === 0 ? (
          draw(row)
        ) : (
          <Box flexDirection="row" justifyContent="space-between">
            {draw(row)}
            <Button plain key={`${view.id}-bar:${index}`} onPress={() => view.jump(offsetAt(index, view.total, view.room))}>
              <Text dimColor>{bar[index]}</Text>
            </Button>
          </Box>
        ),
      )
    }

    /** The row under the list: a page up and a page down, which work where the wheel and the arrows do not reach, and where the window stands. */
    const scrollControls = (view: ScrollView) => {
      const page = Math.max(1, view.room - 1)
      const key = (letter: string) => (view.isKeyed ? { hotkey: letter } : {})

      return (
        view.total > view.room && (
          <Box flexDirection="row" gap={2}>
            <Button key={`${view.id}-up`} {...key('u')} onPress={() => view.jump(clampOffset(view.from - page, view.total, view.room))}>
              ▲
            </Button>
            <Button key={`${view.id}-down`} {...key('d')} onPress={() => view.jump(clampOffset(view.from + page, view.total, view.room))}>
              ▼
            </Button>
            <Text dimColor>{`↑ ${view.from} above · ↓ ${view.total - view.from - view.room} below`}</Text>
          </Box>
        )
      )
    }

    const line = (row: Row) => {
      const status = row.change?.status
      const mark = status && <Text color={STATUS[status].color}>{`  ${STATUS[status].letter}`}</Text>

      return treeLine(row, '', () => void press($, row, prefs), status, mark)
    }

    /** A file of the Git tree carries its porcelain code, staged letter then unstaged letter; a conflict's icon is red too. */
    const repoLine = (repo: Repo) => (row: Row<RepoFile>) =>
      treeLine(
        row,
        GIT_FOLD,
        () => void pressRepo($, repo, row, prefs),
        row.change && fileStatus(row.change),
        ['  ', ...(row.change ? codeParts(row.change) : []).map(part => <Text color={part.color}>{part.text}</Text>)],
        row.change && isConflict(row.change) ? 'error' : undefined,
      )

    const spent = usage?.cost === undefined ? '' : `${cost(usage.cost.usd)} · `
    const elapsed = usage === undefined ? '' : duration(Date.now() - usage.startedAt)

    const sessionSection = section(
      '#session',
      [
        header('#session', 'Session', figures.length > 0 ? '' : `${spent}${elapsed}`),
        isOpen('#session') && (
          <Box flexDirection="column">
            <Box flexDirection="row" justifyContent="space-between">
              <Button
                plain
                key="context"
                onPress={() => {
                  void update($, breakdown, open => !open)
                  void refreshContext($).catch(() => undefined)
                }}
              >
                {`${isDetailed ? '▾' : '▸'} Context`}
              </Button>
              <Text dimColor wrap="truncate-end">
                {context?.tokens === undefined
                  ? 'after the first reply'
                  : contextText(context.tokens, context.window, reading?.compactsAt, `${countText(compacted, 'compaction')}${countText(clearCount, 'clear')}`)}
              </Text>
            </Box>
            {reading ? stackedBar(reading, context?.percent ?? 0) : meter(context?.percent ?? 0)}
            {reading && legendRows(reading)}
            <Text dimColor wrap="truncate-end">{turnLine(stats ?? NO_TURNS)}</Text>
          </Box>
        ),
      ],
    )

    const turnModel = turnRecord ? modelText(turnRecord) : ''
    const turnTools = turnRecord ? toolsText(turnRecord) : ''
    // The turn counter and the record update in the same turn.complete, so the count numbers the turn shown.
    const turnCount = (stats ?? NO_TURNS).count
    const turnSection = section('#turn', [
      header(
        '#turn',
        turnRecord && turnCount > 0 ? `Last turn #${turnCount}` : 'Last turn',
        '',
        turnRecord ? <Text color={RESULT[turnRecord.reason].color}>{resultText(turnRecord)}</Text> : undefined,
      ),
      isOpen('#turn') && turnRecord === null && <Text dimColor>No turn finished yet.</Text>,
      isOpen('#turn') && turnRecord && turnModel !== '' && <Text wrap="truncate-end">{turnModel}</Text>,
      isOpen('#turn') && turnRecord && <Text dimColor wrap="truncate-end">{tokensText(turnRecord)}</Text>,
      isOpen('#turn') && turnRecord && turnTools !== '' && <Text dimColor wrap="truncate-end">{turnTools}</Text>,
    ])

    const todoLine = (todo: Todo) => {
      const status = TODO_STATUS[todo.status]
      const isDone = todo.status === 'completed' || todo.status === 'cancelled'

      return (
        <Box flexDirection="row">
          <Text color={status.color}>{`${status.glyph} `}</Text>
          <Text
            bold={todo.status === 'in_progress'}
            dimColor={isDone}
            strikethrough={todo.status === 'cancelled'}
            wrap="truncate-end"
          >
            {todoText(todo)}
          </Text>
        </Box>
      )
    }

    const todosSection = section('#todos', [
      header('#todos', 'Todos', todoSummary(taskList)),
      isOpen('#todos') && taskList.length === 0 && <Text dimColor>No task list yet. Claude writes one for work with several steps.</Text>,
      isOpen('#todos') && taskList.slice(0, todoRoom).map(todoLine),
      isOpen('#todos') && taskList.length > todoRoom && <Text dimColor>{`… ${taskList.length - todoRoom} more`}</Text>,
    ])

    const autopickSwitch = (
      <Box flexDirection="row" justifyContent="space-between">
        <Button plain key="autopick-switch" onPress={() => void switchAutopick($, live).catch(toast)}>
          <Text color={pickSettings.isOn ? 'success' : undefined} dimColor={!pickSettings.isOn}>
            {pickSettings.isOn ? '[x]' : '[ ]'}
          </Text>
          {' Answer unanswered questions'}
        </Button>
        <Box flexDirection="row" gap={1} flexShrink={0} paddingLeft={1}>
          <Text dimColor>after</Text>
          <Button plain key="autopick-less" onPress={() => void saveAutopick($, live, { minutes: stepMinutes(pickSettings.minutes, -1) }).catch(toast)}>
            <Text color="suggestion">−</Text>
          </Button>
          <Text>{`${pickSettings.minutes} min`}</Text>
          <Button plain key="autopick-more" onPress={() => void saveAutopick($, live, { minutes: stepMinutes(pickSettings.minutes, 1) }).catch(toast)}>
            <Text color="suggestion">+</Text>
          </Button>
        </Box>
      </Box>
    )

    const waitLine = (wait: AutopickWait) => {
      const control = live.controls.get(wait.id)
      const isCounting = wait.deadline !== undefined && control !== undefined

      return (
        <Box flexDirection="row" justifyContent="space-between">
          {/* One-cell glyphs and a gap, not trailing spaces: an emoji glyph draws two cells and eats the space after it. */}
          <Box flexDirection="row" flexShrink={1} gap={1}>
            <Box flexShrink={0}>
              <Text color={isCounting ? 'warning' : undefined} dimColor={!isCounting}>
                {isCounting ? `◷ ${countdown((wait.deadline ?? 0) - clockNow)}` : '◌'}
              </Text>
            </Box>
            <Text dimColor={!isCounting} wrap="truncate-end">
              {wait.picks === null ? 'No recommended option: the question waits for you.' : picksText(wait.picks)}
            </Text>
          </Box>
          {isCounting && (
            <Box flexDirection="row" gap={2} flexShrink={0} paddingLeft={1}>
              <Button plain key={`autopick-pick:${wait.id}`} onPress={() => control.pick()}>
                <Text color="suggestion">Pick now</Text>
              </Button>
              <Button plain key={`autopick-cancel:${wait.id}`} onPress={() => control.cancel()}>
                <Text color="suggestion">Cancel</Text>
              </Button>
            </Box>
          )}
        </Box>
      )
    }

    const autopickSection = section('#autopick', [
      header(
        '#autopick',
        'Autopick',
        '',
        <Text color={pickSettings.isOn ? 'success' : undefined} dimColor={!pickSettings.isOn}>
          {autopickSummary(pickSettings)}
        </Text>,
      ),
      isOpen('#autopick') && autopickSwitch,
      isOpen('#autopick') && isPickBlocked && (
        <Text color="warning" wrap="truncate-end">
          ⚠ The ask-autopick mod is loaded and answers questions too: this switch stays off until you disable it.
        </Text>
      ),
      isOpen('#autopick') && waits.map(waitLine),
      isOpen('#autopick') && lastPick && (
        <Text dimColor wrap="truncate-end">{`✓ Picked ${age(clockNow - lastPick.at)} ago: ${picksText(lastPick.picks)}`}</Text>
      ),
    ])

    const skillLine = (use: SkillUse) => {
      const status = SKILL_STATUS[use.isActive ? 'active' : 'done']
      const loop = use.agentId === undefined ? 'main' : (loops.find(agent => agent.id === use.agentId)?.type ?? 'subagent')

      return (
        <Box flexDirection="row" justifyContent="space-between">
          <Box flexDirection="row" flexShrink={1}>
            <Text color={status.color}>{`${status.glyph} `}</Text>
            <Text bold={use.isActive} dimColor={!use.isActive} wrap="truncate-end">
              {use.name}
            </Text>
          </Box>
          <Box flexShrink={0} paddingLeft={1}>
            <Text dimColor>{`${loop} · ${age(Date.now() - use.at)} ago`}</Text>
          </Box>
        </Box>
      )
    }

    const skillsSection = section('#skills', [
      header('#skills', 'Skills', skillSummary(skillList)),
      isOpen('#skills') && skillList.length === 0 && <Text dimColor>No skill loaded in this conversation yet.</Text>,
      isOpen('#skills') && skillList.slice(0, skillRoom).map(skillLine),
      isOpen('#skills') && skillList.length > skillRoom && <Text dimColor>{`… ${skillList.length - skillRoom} more`}</Text>,
    ])

    const ciRunRows = (run: CiRun) => {
      const state = CI_STATUS[stateOf(run)]

      return (
        <Box flexDirection="column">
          <Box flexDirection="row" justifyContent="space-between">
            <Box flexDirection="row" flexShrink={1}>
              <Text color={state.color}>{`${state.glyph} `}</Text>
              <Text bold wrap="truncate-end">
                {run.workflow || `Run ${run.id}`}
              </Text>
            </Box>
            <Box flexShrink={0} paddingLeft={1}>
              <Text dimColor>{runDetail(run, Date.now())}</Text>
            </Box>
          </Box>
          {run.jobs.length > 0 && (
            <Text wrap="truncate-end">
              {run.jobs.map(job => (
                <Text color={CI_STATUS[stateOf(job)].color}>{`  ${CI_STATUS[stateOf(job)].glyph} ${job.name}`}</Text>
              ))}
            </Text>
          )}
          {run.url !== '' && (
            <Box flexDirection="row" paddingLeft={2}>
              <Button plain key={`ci:${run.id}`} onPress={() => void openUrl(hostOf($), run.url)}>
                <Text color="suggestion">↗ Open on GitHub</Text>
              </Button>
            </Box>
          )}
        </Box>
      )
    }

    const ciHeadline = ciWatch ? watchState(ciWatch) : undefined
    const ciWaiting = ciWatch ? waitingText(ciWatch, Date.now()) : undefined
    const ciSection = section('#ci', [
      header(
        '#ci',
        'CI',
        '',
        ciHeadline === undefined ? undefined : <Text color={CI_STATUS[ciHeadline].color}>{`${CI_STATUS[ciHeadline].glyph} ${ciHeadline}`}</Text>,
      ),
      isOpen('#ci') && ciWatch === null && <Text dimColor>No GitHub Actions run started from this session yet.</Text>,
      isOpen('#ci') && ciWaiting !== undefined && <Text dimColor>{ciWaiting}</Text>,
      isOpen('#ci') && ciRuns.map(ciRunRows),
      isOpen('#ci') && ciWatch?.error !== undefined && <Text color="error" wrap="truncate-end">{ciWatch.error}</Text>,
    ])

    const issueRows = (issue: JiraIssue) => (
      <Box flexDirection="column">
        <Box flexDirection="row" justifyContent="space-between">
          <Box flexDirection="row" flexShrink={1}>
            <Box flexShrink={0}>
              {issue.url === undefined ? (
                <Text bold color="suggestion">{issue.key}</Text>
              ) : (
                <Button plain key={`jira:${issue.key}`} onPress={() => void openUrl(hostOf($), issue.url ?? '')}>
                  <Text bold color="suggestion">{issue.key}</Text>
                </Button>
              )}
            </Box>
            <Text wrap="truncate-end">{issue.summary === undefined ? '' : ` · ${issue.summary}`}</Text>
          </Box>
          {issue.status !== undefined && (
            <Box flexShrink={0} paddingLeft={1}>
              <Text color={statusColor(issue.status)}>{issue.status}</Text>
            </Box>
          )}
        </Box>
        {issue.error === undefined ? (
          <Text dimColor wrap="truncate-end">{`  ${issueDetail(issue, Date.now())}`}</Text>
        ) : (
          <Text color="error" wrap="truncate-end">{`  ${issue.error}`}</Text>
        )}
        {needsAllow(issue) && (
          <Box flexDirection="row" gap={2} paddingLeft={2}>
            <Button plain key={`jira-allow:${issue.key}`} onPress={() => void askAllow($, issue.blockedTool)}>
              <Text color="suggestion">Allow reads</Text>
            </Button>
            <Button plain key={`jira-copy:${issue.key}`} onPress={() => void copyRule($, issue.blockedTool, e.surface)}>
              <Text color="suggestion">Copy rule</Text>
            </Button>
          </Box>
        )}
      </Box>
    )

    const jiraSection = section('#jira', [
      header('#jira', 'Jira', issueList.length > JIRA_ROOM ? `${issueList.length} issues` : ''),
      isOpen('#jira') && issues.length === 0 && (
        <Text dimColor>{keyPattern ? 'No issue mentioned yet.' : 'No issue mentioned yet. Set jiraKeyPattern to find issue keys in the chat.'}</Text>
      ),
      isOpen('#jira') && issues.map(issueRows),
    ])

    const usageSection = section('#usage', [
      header('#usage', 'Usage', ''),
      isOpen('#usage') && limits.length === 0 && (
        <Text dimColor>No usage reading yet: it appears after the next reply, on subscription plans.</Text>
      ),
      isOpen('#usage') && limits.map(limitRows),
    ])

    const agentLine = ({ agent, depth }: AgentRow) => {
      const status = AGENT_STATUS[agent.status]

      return (
        <Box flexDirection="row">
          <Text color={status.color}>{`${'  '.repeat(depth)}${status.glyph} `}</Text>
          <Text bold={agent.status === 'running'}>{agentLabel(agent)}</Text>
          <Text dimColor wrap="truncate-end">{`${agentModelText(models[agent.id])}${agent.description ? ` · ${agent.description}` : ''}`}</Text>
        </Box>
      )
    }

    const agentsSection = section('#agents', [
      header('#agents', 'Agents', agentSummary(agents)),
      isOpen('#agents') && agentLines.slice(0, agentRoom).map(agentLine),
      isOpen('#agents') && agentLines.length > agentRoom && <Text dimColor>{`… ${agentLines.length - agentRoom} more`}</Text>,
    ])

    const checkRows = ({ run, label, result, details }: CheckView) => {
      const status = CHECK_STATUS[run.status]
      const tone = run.status === 'failed' ? { color: 'error' } : {}

      return (
        <Box flexDirection="column">
          <Box flexDirection="row" justifyContent="space-between">
            <Box flexDirection="row">
              <Text color={status.color}>{`${status.glyph} `}</Text>
              <Text bold>{label}</Text>
              <Text {...tone} wrap="truncate-end">{`  ${result}`}</Text>
            </Box>
            <Text dimColor>{checkWhen(run, Date.now())}</Text>
          </Box>
          <Text dimColor wrap="truncate-end">{`  ${run.command}`}</Text>
          {details.map(detail => (
            <Text {...tone} wrap="truncate-end">{`  ${detail}`}</Text>
          ))}
        </Box>
      )
    }

    const checksSection = section('#checks', [
      header('#checks', 'Checks', checkSummary(lastChecks)),
      isOpen('#checks') && views.length === 0 && <Text dimColor>No build or test run in this session yet.</Text>,
      isOpen('#checks') && views.map(checkRows),
    ])

    const openGitClient = (root: string) =>
      void openClient(hostOf($), root, gitClient).catch(error => $.ui.toast(`session-info: ${String(error)}`))

    const branchAside = (repo: Repo) =>
      gitClient === '' ? undefined : (
        <Button plain key="git-client" hotkey="g" onPress={() => openGitClient(repo.root)}>
          {`⎇ ${branchText(repo)}`}
        </Button>
      )

    const repoLines = (repo: Repo) => {
      const parts = countParts(repo.counts)
      const { total, changed } = repo.submodules

      return [
        repo.operation && <Text color="warning" wrap="truncate-end">{`⚠ ${operationText(repo.operation)}`}</Text>,
        parts.length > 0 && (
          <Box flexDirection="row" gap={2}>
            {parts.map(part => (
              <Text color={part.color}>{part.text}</Text>
            ))}
          </Box>
        ),
        repo.commit ? (
          <Box flexDirection="row" justifyContent="space-between">
            <Box flexDirection="row" flexShrink={1} gap={1}>
              <Box flexShrink={0}>
                <Text dimColor>{`◆ ${repo.commit.hash}`}</Text>
              </Box>
              <Text wrap="truncate-end">{repo.commit.subject}</Text>
            </Box>
            <Box flexShrink={0} paddingLeft={1}>
              <Text dimColor>{age(Date.now() - repo.commit.at)}</Text>
            </Box>
          </Box>
        ) : (
          <Text dimColor>No commits yet.</Text>
        ),
        total > 0 && (
          <Text dimColor wrap="truncate-end">
            {changed.length === 0
              ? `◇ ${total} submodule${total === 1 ? '' : 's'}, all clean`
              : `◇ ${total} submodule${total === 1 ? '' : 's'} · ${changed.length} changed`}
          </Text>
        ),
        ...changed.slice(0, SUBMODULE_ROWS).map(sub => (
          <Box flexDirection="row">
            <Text wrap="truncate-end">{`  ${sub.path}  `}</Text>
            {sub.issues.map((issue, index) => (
              <Text color={ISSUE_COLOR[issue]} dimColor={ISSUE_COLOR[issue] === undefined}>
                {`${index === 0 ? '' : ' · '}${issueText(issue)}`}
              </Text>
            ))}
          </Box>
        )),
        changed.length > SUBMODULE_ROWS && <Text dimColor>{`  … ${changed.length - SUBMODULE_ROWS} more`}</Text>,
      ]
    }

    const gitTreeRows = (repo: Repo) => {
      const unlisted = repo.fileCount - repoFiles.length
      // Without the Changes tree on screen, its hotkeys are free for this one.
      const hotkey = (key: string) => (counts('#changes') ? {} : { hotkey: key })

      return [
        scrolled(gitTree, gitView, repoLine(repo)),
        scrollControls(gitView),
        unlisted > 0 && <Text dimColor>{`… ${unlisted} more files not listed`}</Text>,
        <Box flexDirection="row" marginTop={1} gap={2}>
          <Button
            key="git-collapse"
            {...hotkey('c')}
            onPress={() =>
              void update($, collapsed, list => [
                ...(list ?? []).filter(key => !isGitFold(key)),
                ...gitTree.filter(r => r.isDir).map(r => `${GIT_FOLD}${r.key}`),
              ])
            }
          >
            collapse
          </Button>
          <Button key="git-expand" {...hotkey('e')} onPress={() => void update($, collapsed, list => (list ?? []).filter(key => !isGitFold(key)))}>
            expand
          </Button>
        </Box>,
        <Text dimColor>Click or Enter: new file opens in the editor, any other as a diff against HEAD · folder collapses or expands</Text>,
      ]
    }

    const gitRight = isRepo ? `⎇ ${branchText(repo)}` : ''
    const gitAside = isRepo ? branchAside(repo) : undefined
    const gitBody = isOpen('#git') && [
      repo === null && <Text dimColor>Reading the repository…</Text>,
      repo === 'outside' && <Text dimColor>Not a Git repository.</Text>,
      isRepo && repoLines(repo),
      isRepo && gitTree.length > 0 && gitTreeRows(repo),
    ]
    const gitSection = section('#git', [header('#git', 'Git', gitRight, gitAside), gitBody])

    const diffView = diff && (
      <Box flexDirection="column" marginTop={1}>
        <Box flexDirection="row" justifyContent="space-between">
          <Text bold>{diff.path}</Text>
          <Button key="close-diff" plain onPress={() => void update($, inline, () => null)}>
            ✕ close diff
          </Button>
        </Box>
        {diff.source ? <Code format="diff" path={diff.path} source={diff.source} /> : <Text dimColor>No differences.</Text>}
      </Box>
    )

    /** What the Changes buttons leave in the fold list: the sections and the Git tree's folders. */
    const isKept = (key: string): boolean => isSection(key) || isGitFold(key)

    const changesBody = isOpen('#changes') && [
      rows.length === 0 && <Text dimColor>No files changed in this session yet.</Text>,
      scrolled(rows, changesView, line),
      scrollControls(changesView),
      <Box flexDirection="row" marginTop={1} gap={2}>
        <Button
          key="collapse"
          hotkey="c"
          onPress={() => void update($, collapsed, list => [...(list ?? []).filter(isKept), ...rows.filter(r => r.isDir).map(r => r.key)])}
        >
          collapse
        </Button>
        <Button key="expand" hotkey="e" onPress={() => void update($, collapsed, list => (list ?? []).filter(isKept))}>
          expand
        </Button>
        <Button key="clear" hotkey="x" onPress={() => void update($, files, () => ({}))}>
          clear
        </Button>
      </Box>,
      <Text dimColor>Click or Enter: new file opens in the editor, changed or deleted one as a diff · folder collapses or expands</Text>,
    ]
    const changesSection = section('#changes', [
      header('#changes', 'Changes', `${changes.length} file${changes.length === 1 ? '' : 's'}  ${summary(changes)}`),
      changesBody,
    ])

    const nodes: Record<Exclude<SectionKey, '#changes'>, RenderChildren> = {
      '#session': sessionSection,
      '#turn': turnSection,
      '#todos': todosSection,
      '#autopick': autopickSection,
      '#skills': skillsSection,
      '#ci': ciSection,
      '#jira': jiraSection,
      '#usage': usageSection,
      '#agents': agentsSection,
      '#checks': checksSection,
      '#git': gitSection,
    }

    /** The inline diff sits under the last tree section on screen, whichever tree opened it. */
    const diffSlot = slots.filter(key => key === '#git' || key === '#changes').at(-1)

    // A one-cell glyph: an emoji one such as a gear draws two cells in some terminals and eats the space after it.
    const footer = (
      <Box flexDirection="row" gap={2} paddingX={isCards ? 1 : 0}>
        <Button plain key="layout" hotkey="l" onPress={() => void update($, layout, isOn => !isOn)}>
          <Text {...(isEditing ? { bold: true, color: 'claude' } : { dimColor: true })}>{isEditing ? '≡ Done' : '≡ Layout'}</Text>
        </Button>
        {hidden.length > 0 && (
          <Box flexDirection="row" gap={1} flexShrink={1}>
            <Text dimColor>Hidden:</Text>
            {hidden.map((key, index) => [
              index > 0 && <Text dimColor>·</Text>,
              <Button plain key={`show:${key}`} onPress={() => void setOption(showOption(key), true).catch(toast)}>
                <Text color="suggestion">{TITLES[key]}</Text>
              </Button>,
            ])}
          </Box>
        )}
      </Box>
    )

    // The API has no color for the frame the terminal draws around a pane; this paints the body under the tree instead.
    const paint = isTerminal && paneBackground !== '' ? { backgroundColor: paneBackground, minHeight: e.props.scroll.bodyRows } : {}

    return (
      <Box flexDirection="column" {...paint}>
        {figures.length > 0 && tiles(figures, cols)}
        {slots.map(key => [key === '#changes' ? changesSection : nodes[key], key === diffSlot && diffView])}
        {footer}
      </Box>
    )
  })
}
