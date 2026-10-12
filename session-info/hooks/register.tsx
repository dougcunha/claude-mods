import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, RenderChildren } from 'claude-code'

import type { Checks, ContextReading, FileChange, InlineDiff, Repo, Todo, TurnRecord } from '../types'

import { AGENT_STATUS, agentLabel, agentRows, agentSummary } from './agents'
import { crossings } from './alerts'
import type { AgentRow } from './agents'
import { FRAME_COLUMNS, FRAME_ROWS, isFramed, tileLayout, widgets } from './cards'
import type { Tile } from './cards'
import { openClient } from './client'
import { cellWidths, contextText, GLYPH, LEGEND_GAP, legendLines, legendText, SWATCH, toReading } from './context'
import { CHECK_STATUS, checkRowCount, checkRuns, checkSummary, checkViews, checkWhen, classify, NO_CHECKS, toPattern } from './checks'
import type { CheckView, Patterns } from './checks'
import { gitStatus } from './git'
import type { Host } from './host'
import { fileIcon, folderIcon, STATUS } from './icons'
import type { IconSet } from './icons'
import { age, branchText, countParts, ISSUE_COLOR, issueText, operationText, readRepo, repoRowCount, SUBMODULE_ROWS } from './repo'
import { SHELLS, track } from './track'
import { compactionText, cost, duration, NO_TURNS, tokens, turnLine } from './session'
import { latestTodos, parseTodos, TODO_PROMPT, TODO_ROOM, TODO_SPEC, TODO_STATUS, TODO_TOOL, todoReply, todoSummary, todoText } from './todos'
import { buildTree, flatten } from './tree'
import { modelText, RESULT, resultText, startDraft, toolsText, tokensText, toRecord, turnLines, withSpawn, withStep, withSubagentUsage, withTool } from './turn'
import type { TurnDraft } from './turn'
import type { Row } from './tree'
import { bar, colorOf, labelOf, ordered, percentText, resetIn } from './usage'
import type { Limit } from './usage'
import { openChange } from './viewer'
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

const PANE = 'session-info'
const TITLE = 'Session info'
const MINUTE = 60_000

type SectionKey = '#session' | '#turn' | '#todos' | '#usage' | '#agents' | '#checks' | '#git' | '#changes'

/** Tools whose calls can change the working tree, so the Git section reads the repository again after them. */
const FILE_TOOLS: readonly string[] = [...SHELLS, 'Write', 'Edit', 'NotebookEdit']

let reading: Promise<void> | undefined
let isStale = false
/** The main-thread turn that runs now; a reload during a turn starts without it. */
let draft: TurnDraft | undefined

const toggle = (list: readonly string[], key: string): string[] =>
  list.includes(key) ? list.filter(one => one !== key) : [...list, key]

const isSection = (key: string): boolean => key.startsWith('#')

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

/** Reads /context's breakdown, estimated locally (no token-count calls), for the stacked bar. */
async function refreshContext($: EngineInterface): Promise<void> {
  const usage = await $.session.usage({ breakdown: 'summary' })
  const reading = usage.context.breakdown ? toReading(usage.context.breakdown) : null
  if (reading !== null) await update($, contextState, () => reading)
}

/** A resumed session starts with no list in its state: the last todo_write call of the transcript gives it back. */
async function restoreTodos($: EngineInterface): Promise<void> {
  if ((await read($, todos)).length > 0) return
  const messages = await $.session.messages()
  const found = Array.isArray(messages) ? latestTodos(messages) : undefined
  if (found !== undefined) await update($, todos, () => found)
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
    usage: options.showUsage !== false,
    agents: options.showAgents !== false,
    checks: options.showChecks !== false,
    git: options.showGit !== false,
    changes: options.showChanges !== false,
  }
  const gitClient = typeof options.gitClient === 'string' ? options.gitClient.trim() : 'lazygit'
  const paneBackground = typeof options.paneBackground === 'string' ? options.paneBackground.trim() : ''
  const patterns: Patterns = { build: toPattern(options.buildPattern), test: toPattern(options.testPattern) }
  const isAlerting = options.alerts !== false
  const isLive = shows.session || shows.usage || shows.agents || shows.checks
  const isOpenOnStart = options.openOnStart === true

  on('session.start', async ($, e, next) => {
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
        if (shows.git) void refreshRepo($)
      })
    if (shows.git) void refreshRepo($)
    if (shows.session) void refreshContext($).catch(() => undefined)
    // The engine draws a pane that the person did not ask for only on a wide terminal; a narrow one keeps it until /session-info.
    if (isOpenOnStart && e.isInteractive) await $.ui.open({ id: PANE, title: TITLE })

    return next(e)
  })

  on('command.run', { command: 'session-info' }, async $ => openPane($, shows.git, shows.session))

  on('command.run', { command: 'changes' }, async $ => openPane($, shows.git, shows.session))

  // A commit made outside the session, in the Git client for example, shows by the next prompt.
  on('prompt.submit', async ($, e, next) => {
    if (shows.git) void refreshRepo($)

    return next(e)
  })

  if (shows.todos) {
    // The section rides after the engine's own, on the session side of the cache boundary.
    on('prompt.compose', async ($, e, next) => {
      const composed = await next(e)
      if (!e.tools.includes(TODO_TOOL)) return composed

      return { sections: [...composed.sections, { id: 'session-info:todos', text: TODO_PROMPT, scope: 'session' }] }
    })

    on('tool.call', { tool: TODO_TOOL }, async ($, e) => {
      if (e.agentId !== undefined) return { result: 'Ignored: only the main conversation keeps the task list.' }
      const parsed = parseTodos(e as Record<string, unknown>)
      if (typeof parsed === 'string') return { deny: parsed }
      await update($, todos, () => parsed)

      return { result: todoReply(parsed) }
    })
  }

  if (shows.turn) {
    on('turn.start', async ($, e, next) => {
      const usage = await $.session.usage().catch(() => undefined)
      draft = startDraft(e.turnId, usage?.cost?.usd)

      return next(e)
    })

    // The step only notes the request; it leaves the stream to the hooks beneath it.
    on('turn.step', async function* ($, e, next) {
      if (e.agentId === undefined && draft !== undefined) draft = withStep(draft, e)

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
    const isShell = (SHELLS as readonly string[]).includes(e.tool)
    const isChecked = shows.checks && isShell
    const isRepoTool = shows.git && FILE_TOOLS.includes(e.tool)
    if (!shows.changes && !isChecked && !isRepoTool) return next(e)
    const before = shows.changes && isShell ? await gitStatus(hostOf($)).catch(() => undefined) : undefined
    const ran = await next(e)
    const toast = (error: unknown) => $.ui.toast(`session-info: ${String(error)}`)
    if (shows.changes && ran.deny === undefined && !ran.isError) await track(hostOf($), e.tool, ran.result, before).catch(toast)
    if (isChecked) await inspect($, e as Record<string, unknown>, ran as Record<string, unknown>, patterns).catch(toast)
    if (isRepoTool && ran.deny === undefined) void refreshRepo($)

    return ran
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
    const isOpen = (key: SectionKey): boolean => !shut.has(key)
    await read($, now)
    const isDetailed = shows.session && isOpen('#session') && (await read($, breakdown))
    const usage = isLive ? await $.session.usage() : undefined
    const reading = shows.session ? await read($, contextState) : null
    const limits: Limit[] = shows.usage && usage ? ordered(usage.rateLimits) : []
    const stats = shows.session || shows.turn ? await read($, turns) : NO_TURNS
    const compacted = shows.session ? await read($, compactions) : 0
    const turnRecord = shows.turn ? await read($, lastTurn) : null
    const taskList = shows.todos ? await read($, todos) : []
    const agents = shows.agents ? await $.agent.list() : []
    const changes = shows.changes ? Object.values(await read($, files)) : []
    const diff = shows.changes ? await read($, inline) : null
    const rows = flatten(buildTree(await $.session.cwd(), changes), shut)
    const context = usage?.context
    const figures: Tile[] =
      isCards && shows.session && usage !== undefined
        ? [
            ...(usage.cost === undefined ? [] : [{ key: 'cost', value: cost(usage.cost.usd), label: 'cost' }]),
            { key: 'elapsed', value: duration(Date.now() - usage.startedAt), label: 'elapsed' },
          ]
        : []
    const tileRows = tileLayout(figures.length, cols).rows
    const turnRows = shows.turn ? chrome + (isOpen('#turn') ? (turnRecord ? turnLines(turnRecord).length : 1) : 0) : 0
    const todoRoom = Math.min(taskList.length, TODO_ROOM)
    const todosRows = shows.todos ? chrome + (isOpen('#todos') ? Math.max(1, todoRoom + (taskList.length > todoRoom ? 1 : 0)) : 0) : 0
    const usageRows = shows.usage ? chrome + (isOpen('#usage') ? Math.max(1, limits.length * 2) : 0) : 0
    const legend = isDetailed && reading ? legendLines(reading, inner) : []
    const sessionRows = shows.session ? chrome + (isOpen('#session') ? 3 + legend.length : 0) : 0
    const agentLines = agentRows(agents)
    const agentRoom = Math.min(agentLines.length, 8)
    const agentsRows = shows.agents ? chrome + (isOpen('#agents') ? agentRoom + (agentLines.length > agentRoom ? 1 : 0) : 0) : 0
    const lastChecks = shows.checks ? await read($, checks) : NO_CHECKS
    const views = checkViews(lastChecks)
    const checksRows = shows.checks ? chrome + (isOpen('#checks') ? Math.max(1, checkRowCount(views)) : 0) : 0
    const repo = shows.git ? await read($, repoState) : null
    const gitRows = shows.git ? chrome + (isOpen('#git') ? repoRowCount(repo) : 0) : 0
    const changesFrame = isCards ? FRAME_ROWS : 0
    const above = tileRows + usageRows + sessionRows + turnRows + todosRows + agentsRows + checksRows + gitRows + changesFrame
    const room = isTerminal ? Math.max(3, (e.viewport?.rows ?? 30) - above - (diff ? 16 : 7)) : Number.MAX_SAFE_INTEGER

    const section = (key: SectionKey, children: RenderChildren, isLast = false) =>
      isCards ? card(key, isOpen(key), children) : (
        <Box flexDirection="column" marginBottom={isLast ? 0 : 1}>
          {children}
        </Box>
      )

    const header = (key: SectionKey, title: string, right: string, aside?: RenderChildren) => (
      <Box flexDirection="row" justifyContent="space-between">
        <Button plain key={`section:${key}`} onPress={() => void update($, collapsed, list => toggle(list ?? [], key))}>
          <Text bold color="claude">{`${isOpen(key) ? '▾' : '▸'} ${title}`}</Text>
        </Button>
        {aside ?? <Text dimColor>{right}</Text>}
      </Box>
    )

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

    const line = (row: Row) => {
      const status = row.change ? STATUS[row.change.status] : undefined

      return (
        <Box flexDirection="row">
          <Text dimColor>{row.guide}</Text>
          <Button plain key={`${row.isDir ? 'd' : 'f'}:${row.key}`} onPress={() => void press($, row, prefs)}>
            {row.isDir || !status || !row.change
              ? [
                  <Text color="suggestion">{folderIcon(icons, row.isOpen)}</Text>,
                  ` ${row.name}`,
                  <Text dimColor>{row.isOpen ? '' : `  ${row.fileCount}`}</Text>,
                ]
              : [
                  <Text color={status.color}>{fileIcon(icons, row.name, row.change.status)}</Text>,
                  ' ',
                  <Text strikethrough={row.change.status === 'deleted'} dimColor={row.change.status === 'deleted'}>
                    {row.name}
                  </Text>,
                  <Text color={status.color}>{`  ${status.letter}`}</Text>,
                ]}
          </Button>
        </Box>
      )
    }

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
                  : contextText(context.tokens, context.window, reading?.compactsAt, compactionText(compacted))}
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
          <Text dimColor wrap="truncate-end">{agent.description ? ` · ${agent.description}` : ''}</Text>
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

    const isRepo = repo !== null && repo !== 'outside'
    const gitSection = section('#git', [
      header('#git', 'Git', isRepo ? `⎇ ${branchText(repo)}` : '', isRepo ? branchAside(repo) : undefined),
      isOpen('#git') && repo === null && <Text dimColor>Reading the repository…</Text>,
      isOpen('#git') && repo === 'outside' && <Text dimColor>Not a Git repository.</Text>,
      isOpen('#git') && isRepo && repoLines(repo),
    ])

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

    const changesSection = section(
      '#changes',
      [
        header('#changes', 'Changes', `${changes.length} file${changes.length === 1 ? '' : 's'}  ${summary(changes)}`),
        isOpen('#changes') && rows.length === 0 && <Text dimColor>No files changed in this session yet.</Text>,
        isOpen('#changes') && rows.slice(0, room).map(line),
        isOpen('#changes') && rows.length > room && <Text dimColor>{`… ${rows.length - room} more rows`}</Text>,
        isOpen('#changes') && (
          <Box flexDirection="row" marginTop={1} gap={2}>
            <Button
              key="collapse"
              hotkey="c"
              onPress={() => void update($, collapsed, list => [...(list ?? []).filter(isSection), ...rows.filter(r => r.isDir).map(r => r.key)])}
            >
              collapse
            </Button>
            <Button key="expand" hotkey="e" onPress={() => void update($, collapsed, list => (list ?? []).filter(isSection))}>
              expand
            </Button>
            <Button key="clear" hotkey="x" onPress={() => void update($, files, () => ({}))}>
              clear
            </Button>
          </Box>
        ),
        isOpen('#changes') && (
          <Text dimColor>Click or Enter: new file opens in the editor, changed or deleted one as a diff · folder collapses or expands</Text>
        ),
      ],
      true,
    )

    // The API has no color for the frame the terminal draws around a pane; this paints the body under the tree instead.
    const paint = isTerminal && paneBackground !== '' ? { backgroundColor: paneBackground, minHeight: e.props.scroll.bodyRows } : {}

    return (
      <Box flexDirection="column" {...paint}>
        {figures.length > 0 && tiles(figures, cols)}
        {shows.session && sessionSection}
        {shows.turn && turnSection}
        {shows.todos && todosSection}
        {shows.usage && usageSection}
        {shows.agents && agentsSection}
        {shows.checks && checksSection}
        {shows.git && gitSection}
        {shows.changes && changesSection}
        {shows.changes && diffView}
      </Box>
    )
  })
}
