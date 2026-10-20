import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Held } from '../types'

import type { Host } from './host'
import { JEV_TOOL, serverNames, serverOf } from './jev'
import { isSameMessage, judge, shouldJudge, skipReason } from './judge'
import type { JudgeEngine } from './judge'
import { debugLogPath, moveToNewSession } from './session'
import { judgedText, keptText, skippedText, statusText } from './status'

/** The reply cap and the time limit of one judgment; a judgment is one short JSON object, and the person waits for it. */
const JUDGE_MAX_TOKENS = 300
const JUDGE_TIMEOUT_MS = 8_000

/** The time limit of the Jev MCP; past it the model judges, so the person waits at most this plus the model's limit. */
const JEV_TIMEOUT_MS = 4_000

/** The most lines the debug log keeps; older lines drop off its start. */
const LOG_LINES = 200

/** What the person reads where the held message would have entered; the engine puts the message back in the box. */
const HELD_TEXT = 'topic-guard: held as a new topic. Press Enter to keep it here, or choose New session.'

const DEFAULTS = { analyze: true, judge: 'model' as JudgeEngine, model: 'haiku', minContextPercent: 20, recheckStep: 10, showStatus: true, debug: false }

const held = atom({ plugin: 'topic-guard', key: 'held' } as const, null)
const keptAt = atom({ plugin: 'topic-guard', key: 'keptAt' } as const, null)
const isBusy = atom({ plugin: 'topic-guard', key: 'isBusy' } as const, false)
const isJevDown = atom({ plugin: 'topic-guard', key: 'isJevDown' } as const, false)
const lastJudgment = atom({ plugin: 'topic-guard', key: 'lastJudgment' } as const, null)

type Settings = typeof DEFAULTS

function readSettings(options: Record<string, unknown>): Settings {
  const number = (value: unknown, fallback: number): number => (typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback)
  const model = typeof options.model === 'string' && options.model.trim() !== '' ? options.model.trim() : DEFAULTS.model

  return {
    analyze: typeof options.analyze === 'boolean' ? options.analyze : DEFAULTS.analyze,
    judge: options.judge === 'jev' ? 'jev' : DEFAULTS.judge,
    model,
    minContextPercent: number(options.minContextPercent, DEFAULTS.minContextPercent),
    recheckStep: number(options.recheckStep, DEFAULTS.recheckStep),
    showStatus: typeof options.showStatus === 'boolean' ? options.showStatus : DEFAULTS.showStatus,
    debug: options.debug === true,
  }
}

/** Calls `jev_classify` by each name its server may go by until one goes through; all failing, the first error stands. */
async function callJev($: EngineInterface, spelled: string, args: Record<string, unknown>): Promise<unknown> {
  let first: unknown
  for (const name of serverNames(spelled)) {
    try {
      return await $.mcp.call(name, JEV_TOOL, args)
    } catch (error) {
      first ??= error
    }
  }
  throw first
}

function hostOf($: EngineInterface): Host {
  return {
    sleep: ms => $.clock.sleep(ms),
    messages: async () => (await $.session.messages({ as: 'api' })).map(message => ({ role: message.role, content: message.content })),
    complete: async request => {
      const reply = await $.model.complete({ ...request, maxTokens: JUDGE_MAX_TOKENS, timeoutMs: JUDGE_TIMEOUT_MS })

      return reply.isAnswered ? reply.text : null
    },
    classify: async args => {
      const spelled = (await $.tool.list()).map(tool => serverOf(tool.name)).find(name => name !== undefined)
      if (spelled === undefined) return null

      return Promise.race([
        callJev($, spelled, args),
        $.clock.sleep(JEV_TIMEOUT_MS).then(() => {
          throw new Error('the Jev MCP did not answer in time')
        }),
      ])
    },
    sessionId: () => $.session.id(),
    clear: async () => void (await $.command.run({ command: 'clear' })),
    readBox: async () => (await $.prompt.read()).text,
    fill: async text => void (await $.prompt.fill({ text })),
  }
}

/**
 * Redraws the band. After a /clear the engine no longer redraws on a state write, so every write that changes the band
 * calls this.
 */
const redraw = ($: EngineInterface): void => $.ui.invalidate('ui.render')

// The mod API has no append, so a line is a read and a write of the whole log; this chain runs one line at a time,
// or two lines written together would drop one. It holds no session data.
let logging: Promise<void> = Promise.resolve()

/**
 * Appends one line of metadata to `<temp>/claude-topic-guard/<session id>/debug.log` when the debug option is on; never
 * prompt or reply text. It never rejects: the log is best effort.
 */
function log($: EngineInterface, settings: Settings, line: string): Promise<void> {
  if (!settings.debug) return Promise.resolve()
  logging = logging.then(() => appendLog($, line)).catch(() => undefined)

  return logging
}

async function appendLog($: EngineInterface, line: string): Promise<void> {
  const sessionId = await $.session.id()
  const tempDir = (await $.env.get('TEMP')) ?? (await $.env.get('TMPDIR')) ?? '/tmp'
  const path = debugLogPath(tempDir, sessionId)
  const old = await $.fs.read(path).then(text => (typeof text === 'string' ? text : ''), () => '')
  const at = new Date(await $.clock.now()).toISOString()
  const lines = [...old.split('\n').filter(one => one !== ''), `${at} ${sessionId} ${line}`]
  await $.fs.write(path, lines.slice(-LOG_LINES).join('\n') + '\n')
}

/** Sets isBusy and returns true, or returns false when a move already runs; `update` retries on a concurrent write. */
async function claimMove($: EngineInterface): Promise<boolean> {
  let isClaimed = false
  await update($, isBusy, busy => {
    isClaimed = !busy

    return true
  })

  return isClaimed
}

/** Clears the session and leaves the held message in the new session's prompt box; a failure keeps this session. */
async function newSession($: EngineInterface, settings: Settings): Promise<void> {
  if (!(await claimMove($))) return log($, settings, 'new session: skipped, one is running')
  redraw($)
  try {
    const message = await read($, held)
    if (message === null) return
    await moveToNewSession(hostOf($), message.text)
    await log($, settings, 'new session: done')
  } catch {
    await log($, settings, 'new session: failed')
    $.ui.toast('topic-guard: the session was not cleared. The message is still in the prompt box.')
  } finally {
    await update($, isBusy, () => false).catch(() => undefined)
    redraw($)
  }
}

/**
 * Says once, in a toast, that the Jev MCP could not judge and the model did, and clears that when Jev judges again, so a
 * new outage warns again. `fallback` is the reason the judgment carries, if any.
 */
async function reportJev($: EngineInterface, settings: Settings, fallback: string | undefined): Promise<void> {
  if (settings.judge !== 'jev') return
  const wasDown = await read($, isJevDown)
  if (fallback === undefined) {
    if (wasDown) await update($, isJevDown, () => false)

    return
  }
  if (wasDown) return
  await update($, isJevDown, () => true)
  $.ui.toast(`topic-guard: the Jev MCP ${fallback}. Judging with ${settings.model} instead.`)
}

/**
 * Draws the status line: who judges and the last thing the mod did. It is best effort and never rejects, and it clears
 * the line when the showStatus option is off, so a reload that turned it off does not leave the old line behind.
 */
async function refreshStatus($: EngineInterface, settings: Settings): Promise<void> {
  try {
    if (!settings.showStatus) return $.ui.status(undefined)
    $.ui.status(
      statusText({ analyze: settings.analyze, judge: settings.judge, model: settings.model, isJevDown: await read($, isJevDown), last: await read($, lastJudgment) }),
    )
  } catch {
    // The line is a convenience: a failed draw changes nothing the person asked for.
  }
}

/** Records the last thing the mod did for the status line and redraws it; it never rejects. */
async function note($: EngineInterface, settings: Settings, text: string): Promise<void> {
  await update($, lastJudgment, () => text).catch(() => undefined)
  await refreshStatus($, settings)
}

/** Judges a prompt the person typed; returns it as held when it starts a new topic, else null. */
async function guard($: EngineInterface, settings: Settings, text: string): Promise<Held | null> {
  // The engine reports no percent until the first response of a fresh or just compacted window, which holds little.
  const percent = (await $.session.usage()).context.percent ?? 0
  const kept = await read($, keptAt)
  if (!shouldJudge({ percent, minPercent: settings.minContextPercent, keptAt: kept, recheckStep: settings.recheckStep })) {
    await log($, settings, `judge: skipped at ${percent}% (minimum ${settings.minContextPercent}%, kept at ${kept ?? '-'}%)`)
    await note($, settings, skippedText({ percent, minPercent: settings.minContextPercent, keptAt: kept, recheckStep: settings.recheckStep }))

    return null
  }
  const judgment = await judge(hostOf($), { model: settings.model, percent, message: text, judge: settings.judge })
  await reportJev($, settings, judgment.fallback)
  await note($, settings, judgedText(judgment.outcome, percent))
  const via = judgment.fallback === undefined ? '' : ` (Jev MCP ${judgment.fallback})`
  if (judgment.outcome !== 'new-topic') {
    await log($, settings, `judge: ${judgment.outcome} at ${percent}%${via}`)

    return null
  }
  await log($, settings, `judge: new topic at ${percent}%${via}`)

  return { ...judgment.verdict, text }
}

export const register: Register = (on, options) => {
  const settings = readSettings(options as Record<string, unknown>)

  // An observer: the line is drawn at the session's start, and a failure costs the person nothing.
  on('session.start', async ($, e, next) => {
    await refreshStatus($, settings)

    return next(e)
  }).catch(($, e, next) => next(e))

  // A failure lets the prompt enter as typed: the mod only holds a message back when the judgment says so.
  on('prompt.submit', async ($, e, next) => {
    const standing = e.origin.kind === 'composer' ? await read($, held) : null
    if (standing !== null) {
      await update($, held, () => null)
      redraw($)
      // Sending the held message again keeps it here; another message replaces it and is judged.
      if (isSameMessage(e.text, standing.text)) {
        await update($, keptAt, () => standing.percent)
        await log($, settings, `keep here at ${standing.percent}%`)
        await note($, settings, keptText(standing.percent))

        return next(e)
      }
    }
    if (!settings.analyze) return next(e)
    const skip = skipReason(e)
    if (skip !== null) {
      if (e.origin.kind === 'composer') await log($, settings, `judge: skipped, ${skip}`)

      return next(e)
    }
    const found = await guard($, settings, e.text)
    if (found === null) return next(e)
    await update($, held, () => found)
    redraw($)

    return { drop: HELD_TEXT }
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const isBusyNow = await read($, isBusy)
    const message = await read($, held)
    if (!isBusyNow && message === null) return next(e)
    const { Box, Button, Text } = $.ui.resolve(e)
    const isTerminal = e.surface === 'terminal'

    // A quiet frame in the suggestion color, dim at rest and full under the pointer, as session-info draws its cards.
    return (
      <Box
        key="topic-guard"
        flexDirection="column"
        borderStyle="round"
        borderColor="suggestion"
        borderDimColor
        paddingX={1}
        {...(isTerminal ? {} : { paddingY: 1, rowGap: 1 })}
        hover={{ borderDimColor: false }}
      >
        {isBusyNow || message === null ? (
          <Text dimColor>
            <Text color="suggestion">◌ topic-guard</Text> · clearing the session…
          </Text>
        ) : (
          <>
            <Box flexDirection="row" justifyContent="space-between">
              <Text>
                <Text color="suggestion" bold>
                  ◇ topic-guard
                </Text>
                <Text dimColor> · this looks like a new topic</Text>
              </Text>
              <Text dimColor>{message.percent}% context</Text>
            </Box>
            <Text>{message.reason === '' ? 'It needs nothing from this conversation.' : message.reason}</Text>
            <Box flexDirection="row">
              <Button key="new" label="New session" variant="primary" onPress={() => void newSession($, settings).catch(() => undefined)} />
              <Text dimColor>  or press Enter to keep it here</Text>
            </Box>
          </>
        )}
      </Box>
    )
  })
}
