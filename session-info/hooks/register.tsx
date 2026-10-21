import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, RenderChildren, RenderSurface, ToolCallResult } from 'claude-code'

import type { AgentModel, AutoContinue, AutopickPick, AutopickSettings, AutopickWait, BackgroundTask, CacheHold, CacheState, ChangeStatus, CheckKind, Checks, CiRun, ContinueRun, CiWatch, ContextReading, Detail, FileChange, Guard, GuardRun, GuardSkip, InlineDiff, JiraIssue, KeepWarm, Repo, RepoFile, SkillUse, Todo, TurnRecord, VersionInfo } from '../types'

import { AGENT_STATUS, agentLabel, agentModelText, agentRows, agentSummary, withAgentModel } from './agents'
import { crossings } from './alerts'
import { CONTINUE_STORE, continueLog, continueReason, continueText, lastContinueText, NO_CONTINUE, withContinue, withPrompt } from './autocontinue'
import { AUTOPICK_USAGE, autopickPrompt, autopickSummary, countdown, DEFAULT_SETTINGS, hasRival, minutesOf, pickDetail, pickedLog, pickedNote, picksDetail, picksOf, picksText, settingsOf, statusText, stepMinutes, STORE_MINUTES, STORE_ON } from './autopick'
import type { Question } from './autopick'
import type { AgentRow } from './agents'
import { BACKGROUND_ROOM, BACKGROUND_STATUS, backgroundSummary, firstLine, hasCommandLine, inFlightIds, orderedTasks, startedTask, STOP_TOOL, stoppedTaskId, taskLabel, taskRowCount, taskState, withEnd, withInFlight, withStopped, withTask } from './background'
import { CACHE_STATUS, cacheParts, cacheStatus, contextOf, holdAge, holdText, holdTitle, isPingDue, isSameMessage, KEEP_WARM_PROMPT, moveToNewSession, NO_CACHE, pingVerdict, readTouches, shouldHold, span, totalOf, TOUCH_STORE, ttlOf, ttlSetting, withCompact, withCounted, withPing, withRecovered, withRequest, withResume, withSeed, withSwitch, withTouch } from './cache'
import type { TtlSetting } from './cache'
import { BANNER_ROWS, FRAME_COLUMNS, FRAME_ROWS, isFramed, tileLayout, widgets } from './cards'
import type { Tile } from './cards'
import { openClient } from './client'
import { clip, detailLines, detailOf } from './detail'
import { cellWidths, contextText, GLYPH, LEGEND_GAP, legendLines, legendText, SWATCH, toReading } from './context'
import { CHECK_STATUS, checkRowCount, checkRuns, checkSummary, checkViews, checkWhen, classify, fixSuggestion, NO_CHECKS, toPattern } from './checks'
import { CI_POLL_MS, CI_ROOM, CI_STATUS, ciTrigger, isWatching, nativeDir, pollWatch, runDetail, startWatch, stateOf, waitingText, watchState } from './ci'
import type { CheckView, Patterns } from './checks'
import { gitStatus } from './git'
import { GUARD_STORE, guardReply, isBypassed, NO_GUARD, passedResults, reusable, savedText, skipText, treeKey, withoutRun, withRun, withSkip } from './guard'
import type { Host } from './host'
import { fileIcon, folderIcon, STATUS } from './icons'
import type { IconSet } from './icons'
import { allowRequest, browseUrl, errorText, isAllowed, isIssueKey, isRefusal, issueDetail, issueKeys, JIRA_FIELDS, JIRA_ROOM, mention, needsRead, readIssue, readSite, serverNames, serverOf, siteSetting, statusColor, toKeyPattern } from './jira'
import { age, branchText, codeParts, countParts, fileStatus, isConflict, ISSUE_COLOR, issueText, operationText, readRepo, repoRowCount, SUBMODULE_ROWS } from './repo'
import { endSkills, isSameSkill, SKILL_ROOM, SKILL_STATUS, skillSummary, startSkill } from './skills'
import { moveCard, ORDER, orderText, parseSectionOrder, parseTabGroups, showOption, TITLES } from './tabs'
import type { SectionKey, TabGroup } from './tabs'
import { clampOffset, MIN_LIST_ROWS, movedTo, offsetAt, POINTER_SLACK, scrollbar, targetAt, targetNear } from './scrollbar'
import type { ScrollTarget, ScrollView } from './scrollbar'
import { blocksText, finishedRuns, isPersonOrigin, taskEnds, withFinished } from './tasks'
import { SHELLS, track } from './track'
import { cost, countText, duration, NO_TURNS, tokens, turnLine } from './session'
import { latestTodos, minSteps, parseTodos, TODO_ROOM, TODO_SPEC, TODO_STATUS, TODO_TOOL, todoPrompt, todoReply, todoSummary, todoText } from './todos'
import { buildTree, flatten } from './tree'
import { checkUpdate, installedVersion, newerVersion, NO_VERSION, readRecord, UPDATE_COMMAND, UPDATE_STORE, UPDATE_TICK_MS, updateToast } from './update'
import { modelText, refusedText, RESULT, resultText, startDraft, toolsText, tokensText, toRecord, turnLines, withRefusal, withSpawn, withStep, withSubagentUsage, withTool } from './turn'
import type { TurnDraft } from './turn'
import type { Row } from './tree'
import { customTitle, DEFAULT_TITLE, titleAlign, titleColor } from './title'
import { bar, colorOf, labelOf, ordered, percentText, resetIn } from './usage'
import type { Limit } from './usage'
import { openChange, openRepoFile, openUrl } from './viewer'
import type { Editor, Prefs, Viewer } from './viewer'

const files = atom({ plugin: 'session-info', key: 'files' } as const, {} as Record<string, FileChange>)
const collapsed = atom({ plugin: 'session-info', key: 'collapsed' } as const, [] as string[])
const inline = atom({ plugin: 'session-info', key: 'inline' } as const, null as InlineDiff | null)
const now = atom({ plugin: 'session-info', key: 'now' } as const, 0)
const version = atom({ plugin: 'session-info', key: 'version' } as const, NO_VERSION as VersionInfo)
const turns = atom({ plugin: 'session-info', key: 'turns' } as const, NO_TURNS)
const compactions = atom({ plugin: 'session-info', key: 'compactions' } as const, 0)
const breakdown = atom({ plugin: 'session-info', key: 'breakdown' } as const, false)
const contextState = atom({ plugin: 'session-info', key: 'context' } as const, null as ContextReading | null)
const alerted = atom({ plugin: 'session-info', key: 'alerted' } as const, [] as string[])
const checks = atom({ plugin: 'session-info', key: 'checks' } as const, NO_CHECKS as Checks)
const guard = atom({ plugin: 'session-info', key: 'guard' } as const, NO_GUARD as Guard)
const guardOn = atom({ plugin: 'session-info', key: 'guardOn' } as const, false)
const background = atom({ plugin: 'session-info', key: 'background' } as const, [] as BackgroundTask[])
const detail = atom({ plugin: 'session-info', key: 'detail' } as const, null as Detail | null)
const repoState = atom({ plugin: 'session-info', key: 'repo' } as const, null as Repo | 'outside' | null)
const lastTurn = atom({ plugin: 'session-info', key: 'lastTurn' } as const, null as TurnRecord | null)
const todos = atom({ plugin: 'session-info', key: 'todos' } as const, [] as Todo[])
const autoContinue = atom({ plugin: 'session-info', key: 'autoContinue' } as const, NO_CONTINUE as AutoContinue)
const autoContinueOn = atom({ plugin: 'session-info', key: 'autoContinueOn' } as const, false)
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
const cache = atom({ plugin: 'session-info', key: 'cache' } as const, NO_CACHE as CacheState)
const keepWarm = atom({ plugin: 'session-info', key: 'keepWarm' } as const, null as KeepWarm | null)
const cacheHold = atom({ plugin: 'session-info', key: 'cacheHold' } as const, null as CacheHold | null)
const cacheMove = atom({ plugin: 'session-info', key: 'cacheMove' } as const, null as 'compact' | 'clear' | null)

const PANE = 'session-info'
/** Why the Autopick switch stays off while the ask-autopick mod answers the same questions. */
const RIVAL_TEXT = 'The ask-autopick mod is loaded and answers questions too: this switch stays off until you disable it.'
const MINUTE = 60_000
/** Cells an Autopick row keeps free so its text, cut with `…`, never meets the edge. */
const ROW_SPARE_COLUMNS = 1
/** Cells a wait row spends beside its picks: the countdown, its gap, Pick now, Cancel and their gaps; and, with no countdown, the glyph and its gap. */
const WAIT_COUNTING_COLUMNS = 26
const WAIT_IDLE_COLUMNS = 2

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
/** How long layout mode waits for the draw that adds the Sections checklist before it scrolls the pane to its end. */
const LAYOUT_SCROLL_MS = 50

/** How long a fix suggestion the busy prompt box refused waits for its second try. */
const FIX_RETRY_MS = 1_500
/** The fix the prompt box proposes after a turn left a failed check, until the next prompt; the key names the run it is for. */
let fix: { key: string; text: string; isOpen: boolean } | undefined
/** After a session.end the state switches at once, but the session id and its usage only some time later. */
const SWITCH_POLL_MS = 200
const SWITCH_LIMIT_MS = 10_000
/** The engine swaps the transcript in only after session.compact resolves, so the context is read again until its total moves. */
const COMPACT_POLL_MS = 250
const COMPACT_LIMIT_MS = 5_000
const reads = new Set<string>()
/** How often keep warm looks whether the cache cools; a short TTL cools over its last minute. */
const KEEP_WARM_TICK_MS = 30_000
const HOUR = 60 * MINUTE
/** The keep-warm ping that runs now; a tick while it runs is skipped. */
let pinging: Promise<void> | undefined

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
    sleep: ms => $.clock.sleep(ms),
    clear: async () => void (await $.command.run({ command: 'clear' })),
    readBox: async () => (await $.prompt.read()).text,
    fill: async text => void (await $.prompt.fill({ text })),
    fetchText: async url => {
      const { ok, text } = await $.http.fetch(url)

      return { ok, text }
    },
  }
}

/**
 * Reads the version this copy runs and, when checks are on, asks GitHub whether a newer one is published (at most once a day).
 * A new version is told once in a toast and stays in the footer as a button.
 */
async function refreshVersion($: EngineInterface, isChecked: boolean): Promise<void> {
  const current = await installedVersion(hostOf($), $.plugin.root)
  if (current === undefined) return
  await update($, version, shown => ({ current, latest: shown?.latest ?? null }))
  if (!isChecked) return

  const stored = readRecord(await $.store.get(UPDATE_STORE))
  const checked = await checkUpdate(hostOf($), stored, await $.clock.now())
  const latest = newerVersion(checked, current)
  const record = latest !== null && checked.notified !== latest ? { ...checked, notified: latest } : checked
  if (record !== stored) await $.store.set(UPDATE_STORE, record)
  await update($, version, () => ({ current, latest }))
  if (latest !== null && record.notified !== stored.notified) $.ui.toast(updateToast(latest, current))
}

/** Puts the marketplace update command in an empty prompt for the person to send, so nothing is installed unasked; a draft is never replaced. */
async function offerUpdate($: EngineInterface): Promise<void> {
  const isDraft = (await $.prompt.read()).text.trim() !== ''
  const filled = isDraft ? { isFilled: false } : await $.prompt.fill({ text: UPDATE_COMMAND }).catch(() => ({ isFilled: false }))
  $.ui.toast(
    filled.isFilled
      ? 'session-info: send the command in the prompt to update, then reload the plugins.'
      : `session-info: to update, send ${UPDATE_COMMAND} and then reload the plugins.`,
  )
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
    taskId: typeof result.backgroundTaskId === 'string' ? result.backgroundTaskId : undefined,
    isAgent: input.agentId !== undefined,
    persistedPath: typeof result.persistedOutputPath === 'string' ? result.persistedOutputPath : undefined,
  }, Date.now())
  await update($, checks, current => runs.reduce((all, run) => ({ ...all, [run.kind]: run }), current ?? NO_CHECKS))
}

/** Reads the auto-continue switch from the store, which every window shares, into the pane's mirror. */
async function loadContinue($: EngineInterface): Promise<boolean> {
  const isOn = (await $.store.get(CONTINUE_STORE)) === true
  if ((await read($, autoContinueOn)) !== isOn) await update($, autoContinueOn, () => isOn)

  return isOn
}

async function switchContinue($: EngineInterface): Promise<void> {
  const isOn = !(await loadContinue($))
  await $.store.set(CONTINUE_STORE, isOn)
  await update($, autoContinueOn, () => isOn)
}

/**
 * The end of a main-loop turn: while the switch is on and the task list has open tasks, the stop is blocked with a
 * text that sends Claude on with the next task. A block from a hook beneath stays as it is.
 */
async function continueOnStop($: EngineInterface, stop: { last_assistant_message?: string; background_tasks?: unknown[]; session_crons?: unknown[] }, stopped: { block?: string; preventContinuation?: true }): Promise<string | undefined> {
  if (stopped.block !== undefined || stopped.preventContinuation === true) return undefined
  const list = await read($, todos)
  const state = await read($, autoContinue)
  const reason = continueReason({
    isOn: await loadContinue($),
    todos: list,
    lastMessage: stop.last_assistant_message ?? '',
    // Background work or a scheduled wake-up starts the next turn by itself; a continue now would only wait for it.
    hasPendingWork: (stop.background_tasks?.length ?? 0) > 0 || (stop.session_crons?.length ?? 0) > 0,
    state,
  })
  if (reason === undefined) return undefined
  const next = await update($, autoContinue, current => withContinue(current ?? NO_CONTINUE, list, Date.now(), reason))
  // A line in the transcript marks where the mod sent Claude on, even with the pane closed; the model does not read it.
  if (next.lastRun !== undefined) $.ui.log(continueLog(next.lastRun))

  return reason
}

/** Reads the build guard switch from the store, which every window shares, into the pane's mirror. */
async function loadGuard($: EngineInterface): Promise<boolean> {
  const isOn = (await $.store.get(GUARD_STORE)) === true
  if ((await read($, guardOn)) !== isOn) await update($, guardOn, () => isOn)

  return isOn
}

async function switchGuard($: EngineInterface): Promise<void> {
  const isOn = !(await loadGuard($))
  await $.store.set(GUARD_STORE, isOn)
  await update($, guardOn, () => isOn)
}

/**
 * A shell call that runs a build or tests, while the guard is on. When the same command passed on the same working
 * tree less than the TTL ago, the call is answered with that run's result and does not run; otherwise it runs, and a
 * pass is kept under the tree's fingerprint. The fingerprint is taken before the run: what the run itself writes
 * (a lock file, generated code) changes the next fingerprint, so the next run is never skipped by mistake.
 */
async function guardRun($: EngineInterface, command: string, kinds: CheckKind[], next: () => Promise<ToolCallResult>, onSkip: () => void): Promise<ToolCallResult> {
  const at = Date.now()
  let key: string | undefined
  let reused: GuardRun | undefined
  try {
    key = await treeKey(hostOf($), await $.session.cwd(), command)
    reused = key === undefined || isBypassed(command) ? undefined : reusable(await read($, guard), key, at)
  } catch {
    key = undefined
  }
  if (key === undefined) return next()
  if (reused !== undefined) {
    onSkip()
    const reply = guardReply(reused, at)
    const skip: GuardSkip = { kinds: reused.kinds, command: reused.command, reply, at, from: reused.at, ms: reused.ms }
    const run = reused
    await update($, guard, current => withSkip(current ?? NO_GUARD, run, skip)).catch(() => undefined)

    // Bash and PowerShell share these fields of their output schema, which core checks an answer against.
    return { result: { stdout: reply, stderr: '', interrupted: false } } as never
  }

  const ran = await next()
  // From here on nothing may throw: the hook's catch would run the command a second time.
  try {
    // The general tool.call hook beneath this one has already read the run into Checks; a background run is still running there.
    const results = ran.deny === undefined && !ran.isError ? passedResults(await read($, checks), kinds, at) : undefined
    const chars = typeof ran.text === 'string' ? ran.text.length : 0
    const ended = Date.now()
    const shown = (command.split('\n')[0] ?? '').trim()
    await update($, guard, current =>
      results === undefined
        ? withoutRun(current ?? NO_GUARD, key)
        : withRun(current ?? NO_GUARD, key, { kinds, command: shown, results, at: ended, ms: ended - at, chars }))
  } catch (error) {
    $.ui.toast(`session-info: ${String(error)}`)
  }

  return ran
}

/** A Bash or PowerShell call: a build or test run goes through the guard while it is on; any other command runs as usual. */
async function guardShell($: EngineInterface, e: { tool: string; agentId?: string }, next: () => Promise<ToolCallResult>, patterns: Patterns, isTurnShown: boolean): Promise<ToolCallResult> {
  const input = e as Record<string, unknown>
  const command = typeof input.command === 'string' ? input.command : ''
  const kinds = classify(command, patterns)
  // A background run ends after the call returns, so there is no result yet to keep or to reuse.
  if (kinds.length === 0 || input.run_in_background === true || !(await loadGuard($).catch(() => false))) return next()
  // The general hook counts the call for the Last turn section; a skipped call never reaches it.
  const noteSkip = () => {
    if (isTurnShown && e.agentId === undefined && draft !== undefined) draft = withTool(draft, e.tool)
  }

  return guardRun($, command, kinds, next, noteSkip)
}

/** Proposes a fix of the failed check in the empty prompt box, once per failed run; a box still busy gets one more try. */
async function suggestFix($: EngineInterface): Promise<void> {
  const suggestion = fixSuggestion(await read($, checks))
  if (suggestion === undefined || suggestion.key === fix?.key) return
  const open = { ...suggestion, isOpen: true }
  fix = open
  const shown = await $.prompt.suggest({ text: open.text }).catch(() => ({ isShown: false }))
  if (!shown.isShown)
    $.clock.after(FIX_RETRY_MS, () => {
      if (fix === open && open.isOpen) void $.prompt.suggest({ text: open.text }).catch(() => undefined)
    })
}

/** A conversation the mod joins with turns behind it, by a resume or an install, counts them from the prompts in its transcript. */
/** A load with a last turn on record and no request seen yet dates the cache from that turn's end. */
async function seedCache($: EngineInterface): Promise<void> {
  const last = await read($, lastTurn)
  if (last === null || (await read($, cache)).touchedAt !== undefined) return
  const context = (await $.session.usage()).context.tokens ?? 0
  await update($, cache, state => withSeed(state ?? NO_CACHE, last.at, context))
}

/**
 * A resume dates its cache from the touch the store kept for the session, since the engine's own SessionStart reaches
 * a plugin only where nothing above it ends the event, and not under an organization's security plugin. A session with
 * turns behind it, no finished turn to date it from and no request seen here is a resume.
 */
async function recoverCache($: EngineInterface): Promise<void> {
  if ((await $.session.turns()) === 0) return
  if ((await read($, lastTurn)) !== null || (await read($, cache)).touchedAt !== undefined) return
  const touches = readTouches(await $.store.get(TOUCH_STORE))
  const found = touches[await $.session.id()]
  const now = await $.clock.now()
  const context = (await $.session.usage()).context.tokens ?? 0
  await update($, cache, state => withRecovered(state ?? NO_CACHE, found, now, context))
  $.ui.invalidate('ui.render')
}

/** Keeps when this session touched the cache, so a resume in another process can date it. */
async function rememberTouch($: EngineInterface, at: number, context: number): Promise<void> {
  const touches = readTouches(await $.store.get(TOUCH_STORE))
  await $.store.set(TOUCH_STORE, withTouch(touches, await $.session.id(), { at, tokens: context }))
}

async function seedTurns($: EngineInterface): Promise<void> {
  const sent = await $.session.turns()
  await update($, turns, stats => ((stats ?? NO_TURNS).count > 0 ? (stats ?? NO_TURNS) : { ...(stats ?? NO_TURNS), count: sent }))
}

/** Which sections a task notification can change: the Background list marks the task ended, Checks reads the run it ran. */
type TaskSections = { isBackground: boolean; isChecks: boolean }

/** Marks each background task the notification says ended, and reads the checks of its command. */
async function finishTasks($: EngineInterface, text: string, { isBackground, isChecks }: TaskSections): Promise<void> {
  for (const end of taskEnds(text)) {
    if (isBackground) await update($, background, tasks => withEnd(tasks ?? [], end, Date.now()))
    if (!isChecks) continue
    const runs = await finishedRuns(hostOf($), await read($, checks), end, Date.now())
    if (runs.length > 0) await update($, checks, current => withFinished(current ?? NO_CHECKS, end, runs))
  }
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

/** Reads the context again after a compaction until its total differs from `before`, or the limit passes. */
function refreshAfterCompact($: EngineInterface, before: number | undefined): void {
  let waited = 0
  const poll = async (): Promise<void> => {
    await refreshContext($)
    const total = (await read($, contextState))?.total
    waited += COMPACT_POLL_MS
    if (total !== before || waited >= COMPACT_LIMIT_MS) return
    $.clock.after(COMPACT_POLL_MS, () => void poll().catch(() => undefined))
  }
  $.clock.after(COMPACT_POLL_MS, () => void poll().catch(() => undefined))
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

/** The sections a /clear empties; the same keys as the `show*` options that turn them on. */
type ClearedSections = { todos: boolean; turn: boolean; skills: boolean; jira: boolean; agents: boolean; background: boolean; autopick: boolean }

/** Empties what belonged to the conversation a /clear ended; it is safe to run twice. */
async function clearConversation($: EngineInterface, shows: ClearedSections): Promise<void> {
  if (shows.todos) await update($, todos, () => [])
  if (shows.todos) await update($, autoContinue, () => NO_CONTINUE)
  if (shows.turn) await update($, lastTurn, () => null)
  if (shows.skills) await update($, skills, () => [])
  if (shows.jira) await update($, jiraIssues, () => [])
  if (shows.agents) await update($, agentModels, () => ({}))
  if (shows.background) await update($, background, () => [])
  await update($, detail, () => null)
  if (shows.autopick) await update($, autopickLast, () => null)
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
    const cwd = watch.dir
    const { watch: polled, finished } = await pollWatch(argv => $.process.run(argv, cwd === undefined ? undefined : { cwd }), watch, Date.now())
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
  const found = ciTrigger(command, output)
  if (found === undefined) return
  // A command run in another folder (`cd <dir> &&`, `git -C <dir>`) pushed that folder's repository.
  const trigger = found.dir === undefined ? found : { ...found, dir: nativeDir(await $.session.cwd(), found.dir) }
  const cwd = trigger.dir
  const git = async (args: string[]) => {
    const done = await $.process.run(['git', ...args], cwd === undefined ? undefined : { cwd }).catch(() => undefined)

    return done?.exitCode === 0 ? done.stdout.trim() : undefined
  }
  const isCommit = trigger.kind === 'push' || trigger.kind === 'pr'
  const sha = isCommit ? await git(['rev-parse', 'HEAD']) : undefined
  const branch = await git(['rev-parse', '--abbrev-ref', 'HEAD'])
  // A folder that is no repository the mod can read gives no commit to follow: no watch beats a wrong one.
  if (cwd !== undefined && branch === undefined) return
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

/** The cache guard's and keep warm's settings, read once per load. */
type CacheOptions = { ttl: TtlSetting; isGuarded: boolean; minTokens: number; keepWarmHours: number }

/** A main-thread request reached the cache: the cache's state takes its usage, and the plan limits decide the default TTL. */
async function noteRequest($: EngineInterface, usage: { input_tokens: number; cache_read_input_tokens: number; cache_creation_input_tokens: number }, startedAt: number): Promise<void> {
  const limits = await $.session.usage().then(read => read.rateLimits, () => [])
  const endedAt = await $.clock.now()
  await update($, cache, state => withRequest(state ?? NO_CACHE, { usage, startedAt, endedAt, hasPlanLimits: limits.length > 0 }))
  await rememberTouch($, endedAt, totalOf(usage)).catch(() => undefined)
}

/** Starts keep warm for the configured hours, or stops it. */
async function switchKeepWarm($: EngineInterface, hours: number): Promise<void> {
  const at = await $.clock.now()
  const isOn = (await read($, keepWarm)) === null
  await update($, keepWarm, () => (isOn ? { until: at + hours * HOUR, pings: 0 } : null))
  $.ui.toast(isOn ? `session-info: keep warm runs for ${span(hours * HOUR)}. A ping reads the cache shortly before it expires.` : 'session-info: keep warm is off.')
  $.ui.invalidate('ui.render')
}

const stopKeepWarm = async ($: EngineInterface, why: string): Promise<void> => {
  await update($, keepWarm, () => null)
  $.ui.toast(`session-info: keep warm stopped: ${why}.`)
  $.ui.invalidate('ui.render')
}

/**
 * While keep warm runs and the cache cools, one fork of the conversation reads the cache, so its entry lives a full
 * TTL again. A ping that misses the cache, or gets no answer, stops keep warm: pinging on would pay for writes.
 */
function keepWarmTick($: EngineInterface, setting: TtlSetting): Promise<void> {
  pinging ??= (async () => {
    const keep = await read($, keepWarm)
    if (keep === null) return
    const at = await $.clock.now()
    if (keep.until <= at) return stopKeepWarm($, 'its time ran out')
    const state = await read($, cache)
    const ttl = ttlOf(state, setting)
    // A ping now would write the whole context, the cost keep warm is there to avoid.
    if (cacheStatus(state, keep, ttl, at).kind === 'cold') return stopKeepWarm($, 'the cache had already expired')
    if (!isPingDue(state, keep, ttl, at)) return
    const reply = await $.model.fork({ prompt: KEEP_WARM_PROMPT }).catch(() => undefined)
    const verdict = pingVerdict(reply !== undefined && 'usage' in reply ? reply.usage : undefined)
    if (verdict === 'none') return stopKeepWarm($, 'the ping got no answer')
    if (verdict === 'miss') return stopKeepWarm($, 'the ping wrote the cache instead of reading it')
    const pinged = await $.clock.now()
    await update($, cache, current => withPing(current ?? NO_CACHE, pinged))
    await rememberTouch($, pinged, state.tokens).catch(() => undefined)
    await update($, keepWarm, current => (current === null ? null : { ...current, pings: current.pings + 1 }))
    $.ui.invalidate('ui.render')
  })().finally(() => {
    pinging = undefined
  })

  return pinging
}

/** Claims the band for one move and returns true, or returns false when a move already runs. */
async function claimMove($: EngineInterface, move: 'compact' | 'clear'): Promise<boolean> {
  let isClaimed = false
  await update($, cacheMove, current => {
    isClaimed = current === null

    return current ?? move
  })
  $.ui.invalidate('ui.render')

  return isClaimed
}

/** Compacts the conversation and leaves the held prompt in the box, where Enter sends it over the shorter context. */
async function compactHeld($: EngineInterface): Promise<void> {
  if (!(await claimMove($, 'compact'))) return
  try {
    await $.command.run({ command: 'compact' })
    await update($, cacheHold, () => null)
  } catch {
    $.ui.toast('session-info: the conversation was not compacted. The prompt is still in the box.')
  } finally {
    await update($, cacheMove, () => null).catch(() => undefined)
    $.ui.invalidate('ui.render')
  }
}

/** Clears the session and leaves the held prompt in the new session's box; a failure keeps this session. */
async function newSessionHeld($: EngineInterface): Promise<void> {
  if (!(await claimMove($, 'clear'))) return
  try {
    const hold = await read($, cacheHold)
    if (hold !== null) await moveToNewSession(hostOf($), hold.text)
  } catch {
    $.ui.toast('session-info: the session was not cleared. The prompt is still in the box.')
  } finally {
    await update($, cacheMove, () => null).catch(() => undefined)
    $.ui.invalidate('ui.render')
  }
}

/**
 * The cache guard: a prompt typed at an idle session over a cold cache and a big context is held, and the engine
 * puts it back in the box. Sending it again lets it through; another prompt replaces it and is checked.
 */
async function guardPrompt($: EngineInterface, e: { text: string; origin: { kind: string }; turnId?: string; command?: unknown; isMeta?: true }, minTokens: number, setting: TtlSetting): Promise<{ drop: string } | undefined> {
  const standing = e.origin.kind === 'composer' ? await read($, cacheHold) : null
  if (standing !== null) {
    await update($, cacheHold, () => null)
    $.ui.invalidate('ui.render')
    if (isSameMessage(e.text, standing.text)) return undefined
  }
  const state = await read($, cache)
  if (state.touchedAt === undefined) return undefined
  const status = cacheStatus(state, await read($, keepWarm), ttlOf(state, setting), await $.clock.now())
  const context = contextOf((await $.session.usage()).context.tokens, state)
  if (!shouldHold(e, { status, tokens: context, minTokens, isAfterCompact: state.isAfterCompact })) return undefined
  const hold: CacheHold = { text: e.text, tokens: context, coldMs: status.kind === 'cold' ? status.ms : 0, isAgeUnknown: state.isAgeUnknown === true }
  await update($, cacheHold, () => hold)
  $.ui.invalidate('ui.render')

  return { drop: holdText(hold) }
}

type OpenPaneArgs = { title: string; isGitShown: boolean; isSessionShown: boolean }

async function openPane($: EngineInterface, { title, isGitShown, isSessionShown }: OpenPaneArgs): Promise<{ text: string }> {
  if (isGitShown) void refreshRepo($)
  if (isSessionShown) void refreshContext($).catch(() => undefined)
  await $.ui.open({ id: PANE, title, focus: true })

  return { text: 'Session info pane opened.' }
}

export const register: Register = (on, options) => {
  const prefs: Prefs = {
    viewer: (options.viewer as Viewer | undefined) ?? 'auto',
    editor: (options.editor as Editor | undefined) ?? 'auto',
    markdownEditor: typeof options.markdownEditor === 'string' ? options.markdownEditor.trim() : '',
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
    background: options.showBackground !== false,
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
  const paneTitle = customTitle(options.paneTitle)
  const paneTitleColor = titleColor(options.paneTitleColor)
  const paneTitleAlign = titleAlign(options.paneTitleAlign)
  const openArgs: OpenPaneArgs = { title: paneTitle || DEFAULT_TITLE, isGitShown: shows.git, isSessionShown: shows.session }
  const patterns: Patterns = { build: toPattern(options.buildPattern), test: toPattern(options.testPattern) }
  const isAlerting = options.alerts !== false
  const isSuggestingFix = shows.checks && options.suggestFix !== false
  const order = parseSectionOrder(options.sectionOrder)
  const groups = parseTabGroups(options.tabGroups)
  const groupOf = new Map(groups.flatMap(group => group.members.map(key => [key, group] as const)))
  /** A grouped section folds with its group, whichever members show now. */
  const foldOf = (key: SectionKey): string => groupOf.get(key)?.key ?? key
  const isLive = shows.session || shows.usage || shows.agents || shows.checks || shows.background
  const isOpenOnStart = options.openOnStart === true
  const isUpdateChecked = options.checkUpdates !== false
  const positive = (value: unknown, fallback: number): number => (typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback)
  const cacheOptions: CacheOptions = {
    ttl: ttlSetting(options.cacheTtl),
    isGuarded: options.cacheGuard !== false,
    minTokens: positive(options.cacheGuardMinTokens, 150_000),
    keepWarmHours: positive(options.keepWarmHours, 4),
  }
  /** The Session section draws the cache, and the guard reads it: either one needs the requests followed. */
  const isCacheTracked = shows.session || cacheOptions.isGuarded

  /** The pane's layout mode toggles the sections, so /config leaves out their thirteen show* rows. */
  on('config.describe', { key: ORDER.map(key => `session-info.${showOption(key)}`) }, async ($, e, next) => ({ ...(await next(e)), isHidden: true }))

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
    if (isCacheTracked) $.clock.every(KEEP_WARM_TICK_MS, () => void keepWarmTick($, cacheOptions.ttl).catch(() => undefined))
    void seedTurns($).catch(() => undefined)
    if (isCacheTracked && shows.turn) void seedCache($).catch(() => undefined)
    if (isCacheTracked) void recoverCache($).catch(() => undefined)
    if (shows.ci) {
      $.clock.every(CI_POLL_MS, () => void pollCi($).catch(() => undefined))
      // A reload during a run picks the watch up again from the state.
      void pollCi($).catch(() => undefined)
    }
    if (shows.jira) void findJiraServer($).catch(() => undefined)
    void refreshVersion($, isUpdateChecked).catch(() => undefined)
    if (isUpdateChecked) $.clock.every(UPDATE_TICK_MS, () => void refreshVersion($, true).catch(() => undefined))
    if (shows.checks) await loadGuard($).catch(() => undefined)
    if (shows.todos) await loadContinue($).catch(() => undefined)
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
    if (isOpenOnStart && e.isInteractive) await $.ui.open({ id: PANE, title: openArgs.title })

    return next(e)
  })

  // /clear starts a new conversation in the same process and raises no session.start: what belonged to the old one goes here.
  // Where an organization manages Claude Code this event never reaches the mod; session.end below does the same reset.
  on('classic.SessionStart', async ($, e, next) => {
    const started = await next(e)
    if (e.source === 'clear') {
      draft = undefined
      await clearConversation($, shows)
    }
    // A resume at launch says how long ago the last response came, so the cache's age is known before the first request.
    const secondsSince = e.seconds_since_last_response
    if (isCacheTracked && (e.source === 'resume' || e.source === 'fork') && secondsSince !== undefined) {
      const at = await $.clock.now()
      await update($, cache, state => withResume(state ?? NO_CACHE, { secondsSince, contextTokens: e.context_tokens }, at))
    }

    return started
  })

  if (isCacheTracked) {
    // The engine reports the TTL only here; a new model starts with no cache, and a resume restores the same one.
    on('classic.PostModelSwitch', async ($, e, next) => {
      const switched = await next(e)
      await update($, cache, state => withSwitch(state ?? NO_CACHE, e.cache_ttl, e.from_model !== e.to_model))

      return switched
    }).catch(($, e, next) => next(e))
  }

  if (cacheOptions.isGuarded) {
    on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
      if (e.props.hasSurvey) return next(e)
      const move = await read($, cacheMove)
      const hold = await read($, cacheHold)
      if (move === null && hold === null) return next(e)
      const below = await next(e)
      const { Box, Button, Text } = $.ui.resolve(e)
      const isTerminal = e.surface === 'terminal'

      // The same quiet frame as topic-guard's band: dim at rest, full under the pointer.
      const band = (
        <Box
          key="session-info-cache"
          flexDirection="column"
          borderStyle="round"
          borderColor="suggestion"
          borderDimColor
          paddingX={1}
          {...(isTerminal ? {} : { paddingY: 1, rowGap: 1 })}
          hover={{ borderDimColor: false }}
        >
          {move !== null || hold === null ? (
            <Text dimColor>
              <Text color="suggestion">◌ session-info</Text>
              {move === 'compact' ? ' · compacting the conversation…' : ' · clearing the session…'}
            </Text>
          ) : (
            <>
              <Box flexDirection="row" justifyContent="space-between">
                <Text>
                  <Text color="suggestion" bold>
                    ◇ session-info
                  </Text>
                  <Text dimColor>{` · ${holdTitle(hold)}`}</Text>
                </Text>
                <Text dimColor>{holdAge(hold)}</Text>
              </Box>
              <Text>{`Sending this prompt writes ${tokens(hold.tokens)} tokens of context to the cache again.`}</Text>
              <Box flexDirection="row">
                <Button key="cache-compact" label="Compact" variant="primary" onPress={() => void compactHeld($).catch(() => undefined)} />
                <Text>  </Text>
                <Button key="cache-new" label="New session" onPress={() => void newSessionHeld($).catch(() => undefined)} />
                <Text dimColor>  or press Enter to send it here</Text>
              </Box>
            </>
          )}
        </Box>
      )

      return below ? (
        <Box flexDirection="column">
          {band}
          {below}
        </Box>
      ) : band
    })
  }

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
        // The classic.SessionStart reset may never arrive; the new conversation is clean until its first prompt is sent,
        // so this reset cannot wipe anything it wrote.
        if (!isResume && (await $.session.turns().catch(() => 1)) === 0) {
          draft = undefined
          await clearConversation($, shows).catch(() => undefined)
        }
        if (shows.todos && isResume) await restoreTodos($).catch(() => undefined)
        if (isResume) await seedTurns($).catch(() => undefined)
        if (isResume && isCacheTracked) await recoverCache($).catch(() => undefined)
        if (shows.git) void refreshRepo($)
        // The footer's version was read in session.start; the next conversation's state starts without it.
        void refreshVersion($, isUpdateChecked).catch(() => undefined)
        if (shows.jira) await findJiraServer($).catch(() => undefined)
        if (shows.checks) await loadGuard($).catch(() => undefined)
        if (shows.todos) await loadContinue($).catch(() => undefined)
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

  on('command.run', { command: 'session-info' }, async $ => openPane($, openArgs))

  on('command.run', { command: 'changes' }, async $ => openPane($, openArgs))

  if (shows.autopick) on('command.run', { command: 'autopick' }, async ($, e) => runAutopick($, live, String(e.args ?? '')))

  // A commit made outside the session, in the Git client for example, shows by the next prompt.
  on('prompt.submit', async ($, e, next) => {
    // A held prompt goes no further, so the rest of the hook never counts it. A guard that fails lets the prompt in.
    const held = cacheOptions.isGuarded ? await guardPrompt($, e, cacheOptions.minTokens, cacheOptions.ttl).catch(() => undefined) : undefined
    if (held !== undefined) return held
    if (shows.git) void refreshRepo($)
    if (fix) fix.isOpen = false
    // The continues in a row count from the person's last prompt; a notification or a plugin's prompt is not one.
    if (shows.todos && (e.origin?.kind === 'composer' || e.origin?.kind === 'bridge'))
      await update($, autoContinue, state => withPrompt(state ?? NO_CONTINUE)).catch(() => undefined)
    // A background command's end reaches the session as a notification prompt, the one place its exit status shows.
    if ((shows.checks || shows.background) && e.origin?.kind === 'task-notification')
      void finishTasks($, e.text, { isBackground: shows.background, isChecks: shows.checks }).catch(error => $.ui.toast(`session-info: ${String(error)}`))
    if (shows.jira) {
      // MCP servers connect after the session starts: each prompt looks again until one serves Jira.
      void findJiraServer($).catch(() => undefined)
      noteText($, e.text, keyPattern, options.jiraSite)
    }

    return next(e)
  })

  if (shows.checks || shows.background)
    // A notification that lands in a running turn is absorbed into it, or delivered to an agent, and never reaches
    // prompt.submit; its queue record passes here either way. A task already ended stays as it is.
    on('session.append', { door: 'queue' }, async ($, e, next) => {
      const kept = await next(e)
      if (!isPersonOrigin(e.origin.kind))
        void finishTasks($, blocksText(e.message.content), { isBackground: shows.background, isChecks: shows.checks }).catch(error => $.ui.toast(`session-info: ${String(error)}`))

      return kept
    }).catch(($, e, next) => next(e))

  if (shows.todos || shows.autopick) {
    const instruction = todoPrompt(minSteps(options.todoMinSteps), options.todoInstruction)
    // The sections ride after the engine's own, on the session side of the cache boundary.
    on('prompt.compose', async ($, e, next) => {
      const composed = await next(e)
      const sections = [...composed.sections]
      if (shows.todos && e.tools.includes(TODO_TOOL)) sections.push({ id: 'session-info:todos', text: instruction, scope: 'session' })
      // Only while the switch is on and no rival answers the questions: off, the model reads nothing about Autopick.
      const pick = shows.autopick && e.tools.includes('AskUserQuestion') ? await loadAutopick($).catch(() => DEFAULT_SETTINGS) : DEFAULT_SETTINGS
      if (pick.isOn && !(await read($, autopickConflict))) sections.push({ id: 'session-info:autopick', text: autopickPrompt(pick.minutes), scope: 'session' })

      return sections.length === composed.sections.length ? composed : { sections }
    })
  }

  if (shows.todos) {
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

  if (shows.todos || shows.background)
    // A hook that fails here is skipped without a .catch: the turn then ends as it would without the mod, which is safe.
    on('classic.Stop', async ($, e, next) => {
      const stopped = await next(e)
      // A task that ended with no notification, such as one stopped from the tasks dialog, leaves the engine's list.
      const inFlight = shows.background ? inFlightIds(e) : undefined
      if (inFlight !== undefined)
        await update($, background, tasks => withInFlight(tasks ?? [], inFlight, Date.now())).catch(error => $.ui.toast(`session-info: ${String(error)}`))
      const reason = shows.todos ? await continueOnStop($, e, stopped) : undefined

      return reason === undefined ? stopped : { ...stopped, block: reason }
    })

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

    // Only reads the verdict: a query (no tool_use_id) and a subagent's call leave the main turn's record alone.
    on('tool.check', async ($, e, next) => {
      const verdict = await next(e)
      if (verdict.decision === 'deny' && e.agentId === undefined && e.tool_use_id !== undefined && draft !== undefined)
        draft = withRefusal(draft, e.tool, verdict)

      return verdict
    }).catch(($, e, next) => next(e))
  }

  if (shows.turn || shows.agents || isCacheTracked) {
    // The step only notes the request; it leaves the stream to the hooks beneath it.
    on('turn.step', async function* ($, e, next) {
      if (shows.turn && e.agentId === undefined && draft !== undefined) draft = withStep(draft, e)
      if (shows.agents && e.agentId !== undefined) await noteAgentModel($, e.agentId, e.model, e.effort)
      // Only the main thread's requests read the conversation's cache; a subagent's have their own.
      if (!isCacheTracked || e.agentId !== undefined) return yield* next(e)
      // A clock that fails leaves the request unnoted, never the step.
      const startedAt = await $.clock.now().catch(() => undefined)
      const result = yield* next(e)
      if (result.usage !== null && startedAt !== undefined) await noteRequest($, result.usage, startedAt).catch(() => undefined)

      return result
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
    if (isSuggestingFix && e.agentId === undefined) await suggestFix($).catch(() => undefined)

    return answered
  })

  if (isSuggestingFix)
    // The engine's own guess can come after the fix: the fix stays the suggestion until the next prompt.
    on('prompt.suggest', async ($, e, next) => (fix?.isOpen && e.origin.kind === 'suggestion' ? next({ ...e, text: fix.text }) : next(e)))

  on('agent.spawn', async ($, e, next) => {
    const spawned = await next(e)
    if (shows.turn && draft !== undefined) draft = withSpawn(draft)
    if (shows.agents && spawned.agentId !== undefined) await noteAgentModel($, spawned.agentId, spawned.model)
    if (shows.agents) await update($, now, () => Date.now())

    return spawned
  })

  on('session.compact', async ($, e, next) => {
    const before = shows.session ? (await read($, contextState))?.total : undefined
    const compacted = await next(e)
    if (e.agentId === undefined && e.trigger !== 'precompute' && 'messages' in compacted) {
      await update($, compactions, count => (count ?? 0) + 1)
      if (isCacheTracked) await update($, cache, state => withCompact(state ?? NO_CACHE))
      if (shows.session) refreshAfterCompact($, before)
    }

    return compacted
  })

  if (shows.checks) {
    // Registered before the general tool.call hook so they sit above it: a skipped run never reaches Checks, Changes or Background.
    // No .catch fallback here: one that calls next(e) after the command already ran would run it a second time;
    // guardShell catches its own errors and runs the command once.
    on('tool.call', { tool: 'Bash' }, async ($, e, next) => guardShell($, e, () => next(e), patterns, shows.turn))
    on('tool.call', { tool: 'PowerShell' }, async ($, e, next) => guardShell($, e, () => next(e), patterns, shows.turn))
  }

  on('tool.call', async ($, e, next) => {
    if (shows.turn && e.agentId === undefined && draft !== undefined) draft = withTool(draft, e.tool)
    if (e.tool === 'AskUserQuestion') return next(e)
    const isShell = (SHELLS as readonly string[]).includes(e.tool)
    const isChecked = shows.checks && isShell
    const isBackgrounded = shows.background && isShell
    const isStopCall = shows.background && e.tool === STOP_TOOL
    const isRepoTool = shows.git && FILE_TOOLS.includes(e.tool)
    const isCiTool = shows.ci && isShell
    // The model's own read of an issue names it as clearly as a mention, and its answer is the read the section needs.
    const input = e as Record<string, unknown>
    const asked = typeof input.issueIdOrKey === 'string' ? input.issueIdOrKey.toUpperCase() : ''
    const isJiraRead = shows.jira && serverOf(e.tool) !== undefined && isIssueKey(asked)
    if (!shows.changes && !isChecked && !isBackgrounded && !isStopCall && !isRepoTool && !isCiTool && !isJiraRead) return next(e)
    const before = shows.changes && isShell ? await gitStatus(hostOf($)).catch(() => undefined) : undefined
    const ran = await next(e)
    const toast = (error: unknown) => $.ui.toast(`session-info: ${String(error)}`)
    if (shows.changes && ran.deny === undefined && !ran.isError) await track(hostOf($), e.tool, ran.result, before).catch(toast)
    if (isChecked) await inspect($, e as Record<string, unknown>, ran as Record<string, unknown>, patterns).catch(toast)
    if (isBackgrounded) {
      const started = startedTask(input, ran as Record<string, unknown>, Date.now())
      if (started !== undefined) await update($, background, tasks => withTask(tasks ?? [], started)).catch(toast)
    }
    // A task that TaskStop ends sends no notification: its call is the one sign that it ended.
    const stopped = isStopCall ? stoppedTaskId(input, ran as Record<string, unknown>) : undefined
    if (stopped !== undefined) await update($, background, tasks => withStopped(tasks ?? [], stopped, Date.now())).catch(toast)
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
    // The event carries the offset the engine scrolled the body to: a row of the body is that many rows further down the tree.
    const treeRow = e.pointer === undefined ? undefined : e.pointer.row + e.offset
    // A body taller than its window scrolls as a whole under the engine; the wheel goes to a list only over it, and the keys then stay with the engine.
    const isClipped = e.contentRows > e.bodyRows
    const target = isClipped ? (treeRow === undefined ? undefined : targetNear(scrollTargets, treeRow, POINTER_SLACK)) : targetAt(scrollTargets, treeRow)
    if (target === undefined) return next(e)
    const from = target.key === 'git' ? await read($, gitTop) : await read($, changesTop)
    const to = movedTo(from, e.by, target)
    // A list at its end hands the wheel to the pane, so the sections past it stay reachable.
    if (isClipped && to === from) return next(e)
    if (target.key === 'git') await update($, gitTop, () => to)
    else await update($, changesTop, () => to)

    return {}
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button, Code } = $.ui.resolve(e)
    const isTerminal = e.surface === 'terminal'
    const { card, tiles, banner } = widgets({ Box, Text }, isTerminal)
    const cols = Math.max(20, e.props.bodyColumns)
    const isCards = !isTerminal || isFramed(cols)
    const shownDetail = await read($, detail)
    if (shownDetail !== null) {
      // No list is on screen: the wheel and the keys belong to the pane.
      scrollTargets = []
      const body = (
        <Box flexDirection="column" gap={1}>
          <Text bold wrap="wrap">{shownDetail.title}</Text>
          <Text wrap="wrap">{shownDetail.text}</Text>
        </Box>
      )

      return (
        <Box flexDirection="column" gap={1}>
          <Box flexDirection="row" gap={2}>
            <Button plain key="detail-back" hotkey="b" onPress={() => void update($, detail, () => null)}>
              <Text bold color="claude">← Back</Text>
            </Button>
            <Button
              plain
              key="detail-copy"
              hotkey="y"
              onPress={() =>
                void $.ui.copy({ text: shownDetail.text, surface: e.surface })
                  .then(copied => $.ui.toast(copied.isCopied ? 'session-info: copied the text' : `session-info: could not copy the text (${copied.reason}).`))
                  .catch(() => $.ui.toast('session-info: could not copy the text.'))
              }
            >
              <Text color="suggestion">Copy</Text>
            </Button>
          </Box>
          {isCards ? card('detail', true, body) : body}
        </Box>
      )
    }
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
      '#background': shows.background,
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
    // The rows above the first section: the title line and the figure tiles.
    const tileRows = (paneTitle !== '' ? BANNER_ROWS : 0) + tileLayout(figures.length, cols).rows
    const turnRows = counts('#turn') ? chrome + (isOpen('#turn') ? (turnRecord ? turnLines(turnRecord).length : 1) : 0) : 0
    const skillRoom = Math.min(skillList.length, SKILL_ROOM)
    const skillsRows = counts('#skills') ? chrome + (isOpen('#skills') ? Math.max(1, skillRoom + (skillList.length > skillRoom ? 1 : 0)) : 0) : 0
    const ciBody = ciRuns.reduce((sum, run) => sum + 1 + (run.jobs.length > 0 ? 1 : 0) + (run.url === '' ? 0 : 1), 0)
    const ciRows = counts('#ci') ? chrome + (isOpen('#ci') ? Math.max(1, ciBody + (ciWatch?.error === undefined ? 0 : 1)) : 0) : 0
    const jiraRows = counts('#jira') ? chrome + (isOpen('#jira') ? Math.max(1, issues.length * 2 + issues.filter(needsAllow).length) : 0) : 0
    const todoRoom = Math.min(taskList.length, TODO_ROOM)
    const continueState = shows.todos ? await read($, autoContinue) : NO_CONTINUE
    const isContinuing = shows.todos && (await read($, autoContinueOn))
    // Auto-continue adds its switch row under the list, and the last continue's row once there is one.
    const continueRows = 1 + (continueState.lastRun === undefined ? 0 : 1)
    const todosRows = counts('#todos') ? chrome + (isOpen('#todos') ? Math.max(1, todoRoom + (taskList.length > todoRoom ? 1 : 0)) + continueRows : 0) : 0
    const autopickBody = 1 + (isPickBlocked ? 1 : 0) + waits.length + (lastPick ? 1 : 0)
    const autopickRows = counts('#autopick') ? chrome + (isOpen('#autopick') ? autopickBody : 0) : 0
    const usageRows = counts('#usage') ? chrome + (isOpen('#usage') ? Math.max(1, limits.length * 2) : 0) : 0
    const legend = isDetailed && reading ? legendLines(reading, inner) : []
    const cacheState = shows.session ? await read($, cache) : NO_CACHE
    const keep = shows.session ? await read($, keepWarm) : null
    const cacheTtl = ttlOf(cacheState, cacheOptions.ttl)
    // Before the first request there is no age to read the clock for.
    const cacheNow = shows.session && cacheState.touchedAt !== undefined ? cacheStatus(cacheState, keep, cacheTtl, await $.clock.now()) : { kind: 'unknown' as const }
    const cacheRow = cacheParts(cacheNow, withCounted(cacheState, reading?.total), keep, cacheTtl)
    const sessionRows = counts('#session') ? chrome + (isOpen('#session') ? 4 + legend.length : 0) : 0
    const agentLines = agentRows(agents)
    const models = shows.agents ? await read($, agentModels) : {}
    const agentRoom = Math.min(agentLines.length, 8)
    const agentsRows = counts('#agents') ? chrome + (isOpen('#agents') ? agentRoom + (agentLines.length > agentRoom ? 1 : 0) : 0) : 0
    const backgroundList = shows.background ? orderedTasks(await read($, background)) : []
    const backgroundShown = backgroundList.slice(0, BACKGROUND_ROOM)
    const backgroundRows = counts('#background')
      ? chrome + (isOpen('#background') ? Math.max(1, taskRowCount(backgroundShown) + (backgroundList.length > backgroundShown.length ? 1 : 0)) : 0)
      : 0
    const lastChecks = shows.checks ? await read($, checks) : NO_CHECKS
    const views = checkViews(lastChecks)
    const guardState = shows.checks ? await read($, guard) : NO_GUARD
    const isGuarding = shows.checks && (await read($, guardOn))
    // The guard adds its switch row and one row per skip it lists.
    const guardRows = 1 + guardState.skips.length
    const checksRows = counts('#checks') ? chrome + (isOpen('#checks') ? Math.max(1, checkRowCount(views)) + guardRows : 0) : 0
    const isChangesTree = counts('#changes') && isOpen('#changes')
    const isGitTree = counts('#git') && isOpen('#git') && gitTree.length > 0
    // The room below holds one tree's buttons, hint and overflow row; a second tree adds its own 4.
    const gitExtra = isGitTree && isChangesTree ? 4 : 0
    const gitRows = counts('#git') ? chrome + (isOpen('#git') ? repoRowCount(repo) + gitExtra : 0) : 0
    const changesFrame = counts('#changes') && isCards ? FRAME_ROWS : 0
    const isEditing = await read($, layout)
    /** The sections their show* option turned off: the footer offers them back. */
    const hidden = order.filter(key => options[showOption(key)] === false)
    // Layout mode adds the Sections checklist above the footer: its title and the toggles, wrapped on about two lines.
    const footerRows = isEditing ? 4 : 1
    const above = tileRows + usageRows + sessionRows + turnRows + todosRows + autopickRows + skillsRows + ciRows + jiraRows + agentsRows + backgroundRows + checksRows + gitRows + changesFrame + footerRows
    // The terminal's height is a guess at what the pane may take; the window Claude Code gives the body is the limit, and a tree taller than it is clipped.
    const bodyRows = e.props.scroll?.bodyRows ?? Number.MAX_SAFE_INTEGER
    const room = isTerminal ? Math.max(MIN_LIST_ROWS, Math.min((e.viewport?.rows ?? 30) - above - (diff ? 16 : 7), bodyRows - above - (diff ? 16 : 7))) : Number.MAX_SAFE_INTEGER
    // Two trees on screen split the room: the Git tree takes up to half, the Changes tree the rest.
    const gitRoom = isChangesTree ? Math.min(gitTree.length, Math.max(MIN_LIST_ROWS, Math.floor(room / 2))) : room
    const changesRoom = isGitTree ? Math.max(MIN_LIST_ROWS, room - gitRoom) : room
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
      '#background': backgroundRows,
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
        '#background': backgroundList.filter(task => task.status === 'running').length,
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
     * A line the row cuts short, pressed to read the whole text in the detail view; the key names the line. A Button
     * draws its text with the wrap of its own, not the inner Text's, so the box keeps the line to one row and clips the rest.
     */
    /** The text cut with `…` to what is left of the row once `taken` cells beside it are spent, for a line that `expandable` clips. */
    const fit = (text: string, taken = 0) => clip(text, inner - ROW_SPARE_COLUMNS - taken)

    const expandable = (key: string, title: string, text: string, line: RenderChildren) =>
      text.trim() === '' ? line : (
        <Box key={`detail-row:${key}`} height={1} flexShrink={1} overflow="hidden">
          <Button plain key={`detail:${key}`} onPress={() => void update($, detail, () => detailOf(title, text))}>
            {line}
          </Button>
        </Box>
      )

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
            {/* Laid out as the Context row: the label and the state on the left, the quiet figures on the right. */}
            <Box flexDirection="row" justifyContent="space-between">
              <Text wrap="truncate-end">
                <Text color={CACHE_STATUS[cacheNow.kind].color}>{`${CACHE_STATUS[cacheNow.kind].glyph} `}</Text>
                Cache
                {cacheRow.state !== '' && (
                  <Text color={CACHE_STATUS[cacheNow.kind].color} bold={cacheNow.kind === 'cooling' || cacheNow.kind === 'cold'}>{` ${cacheRow.state}`}</Text>
                )}
              </Text>
              <Box flexDirection="row">
                <Text dimColor wrap="truncate-end">{cacheRow.detail}</Text>
                {cacheNow.kind !== 'unknown' && cacheNow.kind !== 'cold' && (
                  <Button plain key="keep-warm" onPress={() => void switchKeepWarm($, cacheOptions.keepWarmHours).catch(() => undefined)}>
                    <Text color="suggestion">{keep === null ? '  Keep warm' : '  Stop'}</Text>
                  </Button>
                )}
              </Box>
            </Box>
            <Text dimColor wrap="truncate-end">{turnLine(stats ?? NO_TURNS)}</Text>
          </Box>
        ),
      ],
    )

    const turnModel = turnRecord ? modelText(turnRecord) : ''
    const turnTools = turnRecord ? toolsText(turnRecord) : ''
    const turnRefused = turnRecord ? refusedText(turnRecord) : ''
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
      isOpen('#turn') && turnRecord && turnTools !== '' && expandable('turn:tools', 'Tools of the last turn', turnTools, <Text dimColor wrap="truncate-end">{fit(turnTools)}</Text>),
      isOpen('#turn') && turnRecord && turnRefused !== '' && expandable('turn:refused', 'Refused calls of the last turn', turnRefused, <Text color="warning" wrap="truncate-end">{fit(turnRefused)}</Text>),
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

    const continued = continueText(continueState)
    const continueSwitch = (
      <Box flexDirection="row" justifyContent="space-between">
        <Button plain key="continue-switch" onPress={() => void switchContinue($).catch(toast)}>
          <Text color={isContinuing ? 'success' : undefined} dimColor={!isContinuing}>
            {isContinuing ? '[x]' : '[ ]'}
          </Text>
          {' Continue while tasks remain'}
        </Button>
        {continued !== '' && (
          <Box flexShrink={0} paddingLeft={1}>
            <Text dimColor>{continued}</Text>
          </Box>
        )}
      </Box>
    )

    const lastContinue = continueState.lastRun
    const lastContinueRow = (run: ContinueRun) => {
      const text = lastContinueText(run)
      const when = `${duration(Date.now() - run.at)} ago`

      return (
        <Box flexDirection="row" justifyContent="space-between">
          <Box flexDirection="row" flexShrink={1}>
            <Text color="suggestion">⏩ </Text>
            {expandable('continue:last', text, run.reason, <Text wrap="truncate-end">{fit(text, 2 + when.length + 1)}</Text>)}
          </Box>
          <Text dimColor>{when}</Text>
        </Box>
      )
    }

    const todosSection = section('#todos', [
      header('#todos', 'Todos', todoSummary(taskList)),
      isOpen('#todos') && taskList.length === 0 && <Text dimColor>No task list yet. Claude writes one for work with several steps.</Text>,
      isOpen('#todos') && taskList.slice(0, todoRoom).map(todoLine),
      isOpen('#todos') && taskList.length > todoRoom && <Text dimColor>{`… ${taskList.length - todoRoom} more`}</Text>,
      isOpen('#todos') && lastContinue !== undefined && lastContinueRow(lastContinue),
      isOpen('#todos') && continueSwitch,
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
            {wait.picks === null ? (
              <Text dimColor={!isCounting} wrap="truncate-end">No recommended option: the question waits for you.</Text>
            ) : (
              expandable(
                `autopick:wait:${wait.id}`,
                'Recommended options',
                picksDetail(wait.picks),
                <Text dimColor={!isCounting} wrap="truncate-end">
                  {fit(picksText(wait.picks), isCounting ? WAIT_COUNTING_COLUMNS : WAIT_IDLE_COLUMNS)}
                </Text>,
              )
            )}
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
      isOpen('#autopick') && isPickBlocked && expandable('autopick:rival', 'Autopick is off', RIVAL_TEXT, <Text color="warning" wrap="truncate-end">{fit(`⚠ ${RIVAL_TEXT}`)}</Text>),
      isOpen('#autopick') && waits.map(waitLine),
      isOpen('#autopick') && lastPick && expandable(
        'autopick:last',
        `Picked ${age(clockNow - lastPick.at)} ago`,
        pickDetail(lastPick),
        <Text dimColor wrap="truncate-end">
          {fit(`✓ Picked ${age(clockNow - lastPick.at)} ago: ${picksText(lastPick.picks)}`)}
        </Text>,
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
      isOpen('#ci') && ciWatch?.error !== undefined && expandable('ci:error', 'GitHub Actions error', ciWatch.error, <Text color="error" wrap="truncate-end">{fit(ciWatch.error)}</Text>),
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
            {expandable(
              `jira:${issue.key}:summary`,
              issue.key,
              issue.summary ?? '',
              <Text wrap="truncate-end">
                {issue.summary === undefined ? '' : fit(` · ${issue.summary}`, issue.key.length + (issue.status === undefined ? 0 : issue.status.length + 1))}
              </Text>,
            )}
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
          expandable(`jira:${issue.key}:error`, `${issue.key} could not be read`, issue.error, <Text color="error" wrap="truncate-end">{fit(`  ${issue.error}`)}</Text>)
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
          {expandable(
            `agent:${agent.id}`,
            agentLabel(agent),
            detailLines([agentModelText(models[agent.id]).replace(/^ · /, ''), agent.description]),
            <Text dimColor wrap="truncate-end">
              {fit(`${agentModelText(models[agent.id])}${agent.description ? ` · ${agent.description}` : ''}`, depth * 2 + 2 + agentLabel(agent).length)}
            </Text>,
          )}
        </Box>
      )
    }

    const agentsSection = section('#agents', [
      header('#agents', 'Agents', agentSummary(agents)),
      isOpen('#agents') && agentLines.slice(0, agentRoom).map(agentLine),
      isOpen('#agents') && agentLines.length > agentRoom && <Text dimColor>{`… ${agentLines.length - agentRoom} more`}</Text>,
    ])

    const backgroundLine = (task: BackgroundTask) => {
      const status = BACKGROUND_STATUS[task.status]
      const state = taskState(task, Date.now())

      return (
        <Box flexDirection="column">
          <Box flexDirection="row" justifyContent="space-between">
            <Box flexDirection="row" flexShrink={1}>
              <Text color={status.color}>{`${status.glyph} `}</Text>
              {expandable(
                `background:${task.id}:name`,
                'Background command',
                detailLines([task.description, task.command]),
                <Text bold={task.status === 'running'} wrap="truncate-end">
                  {fit(taskLabel(task), 2 + state.length + 1)}
                </Text>,
              )}
            </Box>
            <Box flexShrink={0} paddingLeft={1}>
              <Text {...(task.status === 'failed' ? { color: 'error' } : { dimColor: true })}>{state}</Text>
            </Box>
          </Box>
          {hasCommandLine(task) && expandable(`background:${task.id}:command`, 'Background command', detailLines([task.description, task.command]), <Text dimColor wrap="truncate-end">{fit(`  ${firstLine(task.command)}`)}</Text>)}
        </Box>
      )
    }

    const backgroundSection = section('#background', [
      header('#background', 'Background', backgroundSummary(backgroundList)),
      isOpen('#background') && backgroundList.length === 0 && <Text dimColor>No command started in the background in this conversation yet.</Text>,
      isOpen('#background') && backgroundShown.map(backgroundLine),
      isOpen('#background') && backgroundList.length > backgroundShown.length && <Text dimColor>{`… ${backgroundList.length - backgroundShown.length} more`}</Text>,
    ])

    const checkRows = ({ run, label, result, details }: CheckView) => {
      const status = CHECK_STATUS[run.status]
      const tone = run.status === 'failed' ? { color: 'error' } : {}
      const key = `check:${run.kind}`
      const title = `${label}: ${result}`
      const whole = detailLines([run.command, ...details])
      const when = checkWhen(run, Date.now())

      return (
        <Box flexDirection="column">
          <Box flexDirection="row" justifyContent="space-between">
            <Box flexDirection="row">
              <Text color={status.color}>{`${status.glyph} `}</Text>
              <Text bold>{label}</Text>
              {expandable(`${key}:result`, title, whole, <Text {...tone} wrap="truncate-end">{fit(`  ${result}`, 2 + label.length + when.length + 1)}</Text>)}
            </Box>
            <Text dimColor>{when}</Text>
          </Box>
          {expandable(`${key}:command`, title, whole, <Text dimColor wrap="truncate-end">{fit(`  ${run.command}`)}</Text>)}
          {details.map((line, index) => expandable(`${key}:detail:${index}`, title, whole, <Text {...tone} wrap="truncate-end">{fit(`  ${line}`)}</Text>))}
        </Box>
      )
    }

    const saved = savedText(guardState)
    const guardSwitch = (
      <Box flexDirection="row" justifyContent="space-between">
        <Button plain key="guard-switch" onPress={() => void switchGuard($).catch(toast)}>
          <Text color={isGuarding ? 'success' : undefined} dimColor={!isGuarding}>
            {isGuarding ? '[x]' : '[ ]'}
          </Text>
          {' Skip unchanged builds and tests'}
        </Button>
        {saved !== '' && (
          <Box flexShrink={0} paddingLeft={1}>
            <Text dimColor>{saved}</Text>
          </Box>
        )}
      </Box>
    )

    const skipRow = (skip: GuardSkip) => {
      const text = skipText(skip)
      const when = `${duration(Date.now() - skip.at)} ago`

      return (
        <Box flexDirection="row" justifyContent="space-between">
          <Box flexDirection="row" flexShrink={1}>
            <Text color="suggestion">↺ </Text>
            {expandable(`guard:${skip.at}`, text, detailLines([skip.command, skip.reply]), <Text wrap="truncate-end">{fit(text, 2 + when.length + 1)}</Text>)}
          </Box>
          <Text dimColor>{when}</Text>
        </Box>
      )
    }

    const checksSection = section('#checks', [
      header('#checks', 'Checks', checkSummary(lastChecks)),
      isOpen('#checks') && views.length === 0 && <Text dimColor>No build or test run in this session yet.</Text>,
      isOpen('#checks') && views.map(checkRows),
      // The skips read as part of the runs above them; the switch closes the card as its control.
      isOpen('#checks') && guardState.skips.map(skipRow),
      isOpen('#checks') && guardSwitch,
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
        repo.operation && expandable('git:operation', 'Git operation in progress', operationText(repo.operation), <Text color="warning" wrap="truncate-end">{fit(`⚠ ${operationText(repo.operation)}`)}</Text>),
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
              {expandable('git:commit', `Commit ${repo.commit.hash}`, repo.commit.subject, <Text wrap="truncate-end">{fit(repo.commit.subject, 2 + repo.commit.hash.length + 1 + age(Date.now() - repo.commit.at).length + 1)}</Text>)}
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
      '#background': backgroundSection,
      '#checks': checksSection,
      '#git': gitSection,
    }

    /** The inline diff sits under the last tree section on screen, whichever tree opened it. */
    const diffSlot = slots.filter(key => key === '#git' || key === '#changes').at(-1)

    /** Turns layout mode on or off; on, the pane scrolls to its end so the Sections checklist shows. */
    const toggleLayout = async () => {
      await update($, layout, isOn => !isOn)
      if (!isEditing) $.clock.after(LAYOUT_SCROLL_MS, () => void $.ui.scroll({ in: PANE, to: 'end' }).catch(() => undefined))
    }

    /** In layout mode, one toggle per section in pane order: the settings /config no longer lists. */
    const checklist = isEditing && (
      <Box flexDirection="column" paddingX={isCards ? 1 : 0}>
        <Text bold>Sections</Text>
        <Box flexDirection="row" flexWrap="wrap" columnGap={2}>
          {order.map(key => {
            const isOn = options[showOption(key)] !== false

            return (
              <Button plain key={`toggle:${key}`} onPress={() => void setOption(showOption(key), !isOn).catch(toast)}>
                <Text {...(isOn ? { color: 'success' } : { dimColor: true })}>{`${isOn ? '[x]' : '[ ]'} ${TITLES[key]}`}</Text>
              </Button>
            )
          })}
        </Box>
      </Box>
    )

    // A one-cell glyph: an emoji one such as a gear draws two cells in some terminals and eats the space after it.
    const versions = await read($, version)
    const footer = (
      <Box flexDirection="row" gap={2} paddingX={isCards ? 1 : 0}>
        <Button plain key="layout" hotkey="l" onPress={() => void toggleLayout()}>
          <Text {...(isEditing ? { bold: true, color: 'claude' } : { dimColor: true })}>{isEditing ? '≡ Done' : '≡ Layout'}</Text>
        </Button>
        {versions.current !== null && <Text dimColor>{`v${versions.current}`}</Text>}
        {versions.latest !== null && (
          <Button plain key="update" onPress={() => void offerUpdate($).catch(toast)}>
            <Text color="suggestion">{`↑ ${versions.latest}`}</Text>
          </Button>
        )}
        {!isEditing && hidden.length > 0 && (
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
        {paneTitle !== '' && banner(paneTitle, paneTitleColor, paneTitleAlign)}
        {figures.length > 0 && tiles(figures, cols)}
        {slots.map(key => [key === '#changes' ? changesSection : nodes[key], key === diffSlot && diffView])}
        {checklist}
        {footer}
      </Box>
    )
  })
}
