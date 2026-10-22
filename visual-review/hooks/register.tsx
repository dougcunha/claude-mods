import { atom, read, update } from 'claude-code'
import type { CommandSpec, EngineInterface, HookFailure, Register, ToolSpec } from 'claude-code'

import type { PendingRun } from '../types'

import type { Host } from './host'
import { changedFiles, collect, commandText } from './git'
import type { Collection } from './git'
import { checkModel, checkRanges, narrowModel, pathKey, SUBMIT_SCHEMA } from './model'
import { browserArgv, pageModeOf, parseServerLine, platformOf, serverArgv, splitLines, writeStaticPage } from './server'
import { fileUrl } from './paths'
import { isViewModel, VIEW_FILE, withComments, writeView } from './view'
import type { ViewNotice } from './view'
import { isPageBehind, loadRecord, mergeComments, reviewOf, saveRecord, storeKey, submitRecord } from './comments'
import type { ReviewRecord } from './comments'
import {
  ACCEPTED_RESULT,
  ANALYZING_STATUS,
  BROWSER_FAILED_TOAST,
  NOTHING_TO_SEND_NOTICE,
  NOTHING_TO_SEND_TOAST,
  reviewDroppedNotice,
  reviewDroppedToast,
  reviewPrompt,
  readyToast,
  serverFailedToast,
  NODE_MISSING_CAUSE,
  STATIC_RESULT,
  staticToast,
  TOOL_MISSING_TEXT,
  analysisModelOf,
  analysisPrompt,
  droppedToast,
  gapsResult,
  NO_RUN_RESULT,
  noModelToast,
  REPLACED_RESULT,
  SUBMIT_DESCRIPTION,
  SUBMIT_NAME,
  SUBMIT_TOOL,
} from './prompts'
import type { AnalysisModel } from './prompts'

/** The longest a Git command may run; a larger repository still answers well within it. */
const GIT_TIMEOUT_MS = 30_000

/** The wait between the command's answer and the analysis prompt; any later event is enough, so it is the shortest. */
const SUBMIT_DELAY_MS = 0

/** The longest the page server may take to print its URL; Node.js starts in well under a second. */
const READY_TIMEOUT_MS = 10_000

/** The most characters of the server's first error line that a toast shows. */
const SERVER_ERROR_CHARS = 300

/** The slash command: it waits for the current turn to end, because a review of work in progress makes no sense (DEC-10). */
export const COMMAND: CommandSpec = {
  name: 'visual-review',
  description: 'Open a visual design review of the changes against a base branch or reference',
  argumentHint: '[base]',
}

/** The tool the analysis subagent sends the design model to; behind ToolSearch, so it costs nothing until a run asks for it. */
export const SUBMIT_SPEC: ToolSpec = { name: SUBMIT_NAME, description: SUBMIT_DESCRIPTION, inputSchema: SUBMIT_SCHEMA, isDeferred: true }

const pendingRun = atom({ plugin: 'visual-review', key: 'pendingRun' } as const, null)

const causeOf = (failure: HookFailure): string => failure.message ?? (failure.kind === 'timeout' ? 'it took too long' : 'unknown error')

function hostOf($: EngineInterface): Host {
  return {
    run: (argv, cwd) => $.process.run(argv, cwd === undefined ? { timeoutMs: GIT_TIMEOUT_MS } : { cwd, timeoutMs: GIT_TIMEOUT_MS }),
    cwd: () => $.session.cwd(),
    readFile: path => $.fs.read(path),
    writeFile: (path, text) => $.fs.write(path, text),
    env: async () => ({ temp: await $.env.get('TEMP'), tmpdir: await $.env.get('TMPDIR'), os: await $.env.get('OS') }),
    sessionId: () => $.session.id(),
    storeGet: key => $.store.get(key),
    storeSet: (key, value) => $.store.set(key, value),
    storeKeys: () => $.store.keys(),
    storeDelete: key => $.store.delete(key),
  }
}

/** The page server of this module life. A module value by design: the child dies with the module, so neither can outlive the other. */
type PageServer = { folder: string; url: string | null; clients: number; isStopped: boolean; review: ReviewTarget; queue: Promise<void> }

/** The project and branch whose comments the page edits, and the base the review prompt names. */
type ReviewTarget = { root: string; branch: string; baseLabel: string }

let pageServer: PageServer | null = null

/** Asks the running page server to stop; its read loop breaks at the next line, a tick at most a second later. */
function stopServer(): void {
  if (pageServer !== null) pageServer.isStopped = true
  pageServer = null
}

/** Starts the page server for `folder` and resolves once it printed its URL; rejects when it cannot start or ends first. */
function startServer($: EngineInterface, folder: string, review: ReviewTarget): Promise<PageServer & { url: string }> {
  const handle: PageServer = { folder, url: null, clients: 0, isStopped: false, review, queue: Promise.resolve() }
  pageServer = handle

  return new Promise((resolve, reject) => {
    $.clock.after(READY_TIMEOUT_MS, () => {
      if (handle.url !== null) return
      handle.isStopped = true
      reject(new Error('the page server did not start in time'))
    })
    // The loop runs on after the hook returns: it is the child's life, and it ends with the module.
    void (async () => {
      let rest = ''
      let failure = 'the page server ended'
      try {
        for await (const chunk of $.process.spawn({ argv: serverArgv($.plugin.root, folder) })) {
          if (handle.isStopped) break
          if (chunk.stream === 'stderr') {
            failure = chunk.text.trim().split('\n')[0]?.slice(0, SERVER_ERROR_CHARS) ?? failure
            continue
          }
          const split = splitLines(rest, chunk.text)
          rest = split.rest
          for (const message of split.lines.map(parseServerLine)) {
            if (message?.type === 'ready') {
              handle.url = message.url
              resolve({ ...handle, url: message.url })
            }
            if (message?.type === 'clients') handle.clients = message.count
            if (message?.type === 'error') $.ui.toast(serverFailedToast(message.message))
            // One at a time and in order, so a submit sees the comments the page sent before it.
            if (message?.type === 'comments') enqueue($, handle, () => saveComments($, handle, message.comments))
            if (message?.type === 'submit') enqueue($, handle, () => submitReview($, handle))
          }
        }
      } catch (error) {
        failure = error instanceof Error ? error.message : String(error)
      }
      if (pageServer === handle) pageServer = null
      reject(new Error(failure))
    })()
  })
}

/** Starts the browser on the page; the launcher's own output is not read, and a launcher that fails says so in a toast. */
async function openBrowser($: EngineInterface, url: string): Promise<void> {
  const argv = browserArgv(await platformOf(hostOf($)), url)
  // Reading to the end lets the launcher finish; leaving the loop early would kill it.
  void (async () => {
    for await (const chunk of $.process.spawn({ argv })) void chunk
  })().catch(() => $.ui.toast(BROWSER_FAILED_TOAST))
}

/**
 * Serves the session folder and shows the page: a running server for the same folder pushes the new model to its open
 * tab, and the browser opens only when no tab is open (FR-21). A server of an older folder (after a /clear) is replaced.
 * Resolves with the cause instead when Node.js is missing or the server ends before it prints its URL (FR-24).
 */
async function openPage($: EngineInterface, folder: string, review: ReviewTarget): Promise<{ url: string; isNewTab: boolean } | { cause: string }> {
  const running = pageServer
  if (running !== null && running.folder === folder && running.url !== null && !running.isStopped) {
    running.review = review
    const isNewTab = running.clients === 0
    if (isNewTab) await openBrowser($, running.url)

    return { url: running.url, isNewTab }
  }
  stopServer()
  // A missing node is a normal case: the run fails or cannot start, and both read as static.
  const node = await hostOf($)
    .run(['node', '--version'])
    .catch(() => null)
  if (pageModeOf(node) === 'static') return { cause: NODE_MISSING_CAUSE }
  const started = await startServer($, folder, review).catch((error: unknown) => ({ cause: `the page server failed: ${error instanceof Error ? error.message : String(error)}` }))
  if ('cause' in started) return started
  await openBrowser($, started.url)

  return { url: started.url, isNewTab: true }
}

/** Writes the static page of the view model next to `view.json` and opens it; the toast says why the page is static. */
async function openStaticPage($: EngineInterface, written: { folder: string; json: string }, cause: string): Promise<string> {
  const page = await writeStaticPage(hostOf($), { pluginRoot: $.plugin.root, folder: written.folder, viewJson: written.json })
  const url = fileUrl(page)
  await openBrowser($, url)
  $.ui.toast(staticToast({ cause, url }))

  return STATIC_RESULT
}

/** Runs the work of a server line after the work of the lines before it; a failure says so in a toast and the queue goes on. */
function enqueue($: EngineInterface, handle: PageServer, work: () => Promise<void>): void {
  handle.queue = handle.queue
    .then(work)
    .catch((error: unknown) => $.ui.toast(`visual-review: the review could not be saved: ${error instanceof Error ? error.message : String(error)}`))
}

/**
 * Writes the view model of `folder` again with the stored comments and the notice, so the open page shows them; a
 * missing view is left.
 */
async function refreshView(host: Host, { folder, record, notice = null }: { folder: string; record: ReviewRecord; notice?: ViewNotice | null }): Promise<void> {
  const path = `${folder}/${VIEW_FILE}`
  const view = await host.readFile(path).then(text => JSON.parse(text) as unknown, () => null)
  if (isViewModel(view)) await host.writeFile(path, JSON.stringify(withComments(view, record, notice)))
}

/**
 * Saves the comment set the page sent (DEC-04). The page already shows it, so the view model is written again only when
 * the page is behind the store: a submit made its drafts open while the set was on its way.
 */
async function saveComments($: EngineInterface, handle: PageServer, comments: readonly unknown[]): Promise<void> {
  const host = hostOf($)
  const key = storeKey(handle.review.root, handle.review.branch)
  const saved = mergeComments(await loadRecord(host, key), comments, await $.clock.now())
  await saveRecord(host, key, saved)
  if (isPageBehind(comments, saved)) await refreshView(host, { folder: handle.folder, record: saved })
}

/**
 * Sends the review (FR-19, FR-20): 1 prompt with the drafts and the status changes, which waits for the idle session;
 * once it entered, the drafts become open comments of a new round and the page gets them through view.json.
 */
async function submitReview($: EngineInterface, handle: PageServer): Promise<void> {
  const host = hostOf($)
  const key = storeKey(handle.review.root, handle.review.branch)
  const record = await loadRecord(host, key)
  const { drafts, changed } = reviewOf(record)
  // The page waits for the outcome: a new round means sent, a notice says why nothing went to the session.
  if (drafts.length === 0 && changed.length === 0) {
    $.ui.toast(NOTHING_TO_SEND_TOAST)

    return refreshView(host, { folder: handle.folder, record, notice: { text: NOTHING_TO_SEND_NOTICE, at: await $.clock.now() } })
  }
  const sent = await $.prompt.submit({ text: reviewPrompt({ baseLabel: handle.review.baseLabel, drafts, changed }) })
  if (sent.drop !== undefined) {
    $.ui.toast(reviewDroppedToast(sent.drop))

    return refreshView(host, { folder: handle.folder, record, notice: { text: reviewDroppedNotice(sent.drop), at: await $.clock.now() } })
  }
  const submitted = submitRecord(record, await $.clock.now())
  await saveRecord(host, key, submitted)
  await refreshView(host, { folder: handle.folder, record: submitted })
}

/** Ends the run that waits, if it is still `runId`: clears the state and the status, and says why in a toast when given. */
async function endRun($: EngineInterface, runId: string, toast?: string): Promise<void> {
  let isEnded = false
  await update($, pendingRun, run => {
    isEnded = run?.runId === runId

    return isEnded ? null : run
  })
  if (!isEnded) return
  $.ui.status(undefined)
  if (toast !== undefined) $.ui.toast(toast)
}

/** Saves the run, shows the status and submits the analysis prompt; the prompt enters once the session is idle. */
async function startRun($: EngineInterface, collection: Collection, model: AnalysisModel): Promise<void> {
  const runId = `vr-${(await $.clock.now()).toString(36)}`
  const run: PendingRun = { runId, base: collection.base, baseLabel: collection.baseLabel, root: collection.root, branch: collection.branch, files: collection.files.map(file => file.path) }
  // The prompt is built before the run is saved, so the state write is the last step that can fail.
  const prompt = analysisPrompt({ runId, root: collection.root, base: collection.base, baseLabel: collection.baseLabel, files: collection.files, model })
  await update($, pendingRun, () => run)
  $.ui.status(ANALYZING_STATUS)
  // The engine refuses a prompt.submit from a command.run hook, which would wait on the turn the hook holds, so a timer
  // submits it once the hook has answered; the prompt then waits for the idle session.
  $.clock.after(SUBMIT_DELAY_MS, () =>
    void $.prompt
      .submit({ text: prompt })
      .then(result => (result.drop === undefined ? undefined : endRun($, runId, droppedToast(result.drop))))
      .catch((error: unknown) => endRun($, runId, droppedToast(error instanceof Error ? error.message : String(error))))
      .catch(() => undefined),
  )
}

/** Checks a `submit_model` call against the run that waits, and answers the subagent with the gaps or the acceptance. */
async function submitModel($: EngineInterface, input: unknown): Promise<string> {
  const run = await read($, pendingRun)
  if (run === null) return NO_RUN_RESULT
  const narrowed = narrowModel(input)
  if (narrowed.value.runId !== run.runId) return REPLACED_RESULT
  const gaps = [...narrowed.problems, ...checkModel(narrowed.value, run.files)]
  if (gaps.length > 0) return gapsResult(gaps)
  const host = hostOf($)
  // The run keeps only the paths, so the renames come from Git again: a renamed file's base side is at its old path.
  const changed = await changedFiles(host, run.root, run.base)
  const oldPaths = new Map(Array.isArray(changed) ? changed.flatMap(file => (file.oldPath === undefined ? [] : [[pathKey(file.path), pathKey(file.oldPath)] as const])) : [])
  const ranges = await checkRanges(host, { root: run.root, base: run.base, oldPaths }, narrowed.value.units)
  if (ranges.gaps.length > 0) return gapsResult(ranges.gaps)
  const written = await writeView(host, { run, model: narrowed.value, unchecked: ranges.unchecked })
  if ('cause' in written) return `visual-review failed: ${written.cause}`
  await endRun($, run.runId)
  const page = await openPage($, written.folder, { root: run.root, branch: run.branch, baseLabel: run.baseLabel })
  if ('cause' in page) return openStaticPage($, written, page.cause)
  // The URL carries the page's token, so it goes to the person in a toast, not to the model in the result.
  $.ui.toast(readyToast(page))

  return ACCEPTED_RESULT
}

export const register: Register = (on, options) => {
  const model = analysisModelOf((options as Record<string, unknown>).analysisModel)
  // Whether the last session start failed to register the tool; a reload registers again and sets it again.
  let isToolMissing = false

  // An observer: the command and the tool register at the start of each session, and a reload registers them again.
  on('session.start', async ($, e, next) => {
    await $.command.register(COMMAND)
    isToolMissing = await $.tool.register(SUBMIT_SPEC).then(
      () => false,
      (error: unknown) => ($.ui.toast(`visual-review: the submit_model tool did not register: ${String(error)}`), true),
    )

    return next(e)
  }).catch(($, e, next) => next(e))

  // The person waits for the answer, so a failure answers with its cause instead of skipping. A run that failed after it
  // was saved is cleared here, because the `.catch` handler answers from `next.error` alone and cannot call `$`.
  on('command.run', { command: COMMAND.name }, async ($, e) => {
    if (isToolMissing) return { text: TOOL_MISSING_TEXT }
    const result = await collect(hostOf($), e.args.trim())
    if (!result.isOk) return { text: commandText(result) }
    try {
      await startRun($, result.value, model)
    } catch (error: unknown) {
      await update($, pendingRun, () => null).catch(() => undefined)
      $.ui.status(undefined)

      return { text: `visual-review: ${error instanceof Error ? error.message : String(error)}` }
    }

    return { text: commandText(result) }
  }).catch(($, e, next) => ({ text: `visual-review: ${causeOf(next.error)}` }))

  // The subagent waits for a result, so a failure answers with its cause and the subagent stops; the call is never denied.
  on('tool.call', { tool: SUBMIT_TOOL }, async ($, e) => ({ result: await submitModel($, e) })).catch(($, e, next) => ({
    result: `visual-review failed: ${causeOf(next.error)}`,
  }))

  // An observer: the main-loop turn whose prompt carries the run id is the analysis turn.
  on('turn.start', async ($, e, next) => {
    if (e.agentId !== undefined) return next(e)
    const run = await read($, pendingRun)
    if (run !== null && run.analysisTurnId === undefined && e.text.includes(run.runId))
      await update($, pendingRun, current => (current?.runId === run.runId ? { ...current, analysisTurnId: e.turnId } : current))

    return next(e)
  }).catch(($, e, next) => next(e))

  // An observer that never denies: the main-loop spawn whose prompt carries the run id is the analysis subagent. The
  // Agent tool runs it in the background, so the analysis turn can end before the subagent sends its model. A failure
  // after the spawn is kept inside, so the `.catch` handler never spawns a second subagent.
  on('agent.spawn', async ($, e, next) => {
    const run = e.parentAgentId === undefined ? await read($, pendingRun) : null
    const result = await next(e)
    const agentId = result.agentId
    if (run === null || run.analysisAgentId !== undefined || agentId === undefined || !e.prompt.includes(run.runId)) return result
    await update($, pendingRun, current => (current?.runId === run.runId ? { ...current, analysisAgentId: agentId } : current)).catch(() => undefined)

    return result
  }).catch(($, e, next) => next(e))

  // An observer: the run ends with no accepted model (FR-25) when its subagent ends while the run still waits, or when
  // the analysis turn ends with no subagent started. An interrupted analysis turn leaves a background subagent running,
  // so the run waits for that subagent.
  on('turn.complete', async ($, e, next) => {
    const run = await read($, pendingRun)
    const isAnalysisTurn = e.agentId === undefined && run?.analysisTurnId === e.turnId && run.analysisAgentId === undefined
    const isAnalysisAgent = e.agentId !== undefined && run?.analysisAgentId === e.agentId
    if (run !== null && (isAnalysisTurn || isAnalysisAgent)) await endRun($, run.runId, noModelToast(e.reason))

    return next(e)
  }).catch(($, e, next) => next(e))

  // An observer: a /clear resets the state, so the status of a run it cancels goes too. The server stops as well: the
  // next session has another id and folder, and a server left running would watch the old one (NFR-06).
  on('session.end', async ($, e, next) => {
    stopServer()
    $.ui.status(undefined)

    return next(e)
  }).catch(($, e, next) => next(e))
}
