import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, RenderChildren } from 'claude-code'

import type { Checks, FileChange, InlineDiff } from '../types'

import { AGENT_STATUS, agentLabel, agentRows, agentSummary } from './agents'
import { crossings } from './alerts'
import type { AgentRow } from './agents'
import { FRAME_COLUMNS, FRAME_ROWS, isFramed, tileLayout, widgets } from './cards'
import type { Tile } from './cards'
import { CHECK_STATUS, checkRowCount, checkRuns, checkSummary, checkViews, checkWhen, classify, NO_CHECKS, toPattern } from './checks'
import type { CheckView, Patterns } from './checks'
import { gitStatus } from './git'
import type { Host } from './host'
import { fileIcon, folderIcon, STATUS } from './icons'
import type { IconSet } from './icons'
import { SHELLS, track } from './track'
import { compactionText, cost, duration, NO_TURNS, tokens, turnLine } from './session'
import { buildTree, flatten } from './tree'
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
const alerted = atom({ plugin: 'session-info', key: 'alerted' } as const, [] as string[])
const checks = atom({ plugin: 'session-info', key: 'checks' } as const, NO_CHECKS as Checks)

const PANE = 'session-info'
const TITLE = 'Session info'
const MINUTE = 60_000

type SectionKey = '#session' | '#usage' | '#agents' | '#checks' | '#changes'

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
    spawn: argv => $.process.spawn({ argv }),
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

async function openPane($: EngineInterface): Promise<{ text: string }> {
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
    usage: options.showUsage !== false,
    agents: options.showAgents !== false,
    checks: options.showChecks !== false,
    changes: options.showChanges !== false,
  }
  const patterns: Patterns = { build: toPattern(options.buildPattern), test: toPattern(options.testPattern) }
  const isAlerting = options.alerts !== false
  const isLive = shows.session || shows.usage || shows.agents || shows.checks

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'session-info',
      description: 'Show the session, plan usage and the files this session created, modified or deleted',
    })
    await $.command.register({ name: 'changes', description: 'Same as /session-info' })
    if (isLive) $.clock.every(MINUTE, () => void update($, now, () => Date.now()))

    return next(e)
  })

  on('command.run', { command: 'session-info' }, async $ => openPane($))

  on('command.run', { command: 'changes' }, async $ => openPane($))

  on('session.measure', async ($, e, next) => {
    if (isLive) await update($, now, () => Date.now())
    if (isAlerting) await alert($, e.rateLimits, e.context)

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const answered = await next(e)
    if (e.agentId !== undefined && shows.agents) await update($, now, () => Date.now())
    if (e.agentId === undefined)
      await update($, turns, stats => ({
        count: (stats ?? NO_TURNS).count + 1,
        outputTokens: (stats ?? NO_TURNS).outputTokens + (e.usage?.output_tokens ?? 0),
        lastMs: e.durationMs,
      }))

    return answered
  })

  on('agent.spawn', async ($, e, next) => {
    const spawned = await next(e)
    if (shows.agents) await update($, now, () => Date.now())

    return spawned
  })

  on('session.compact', async ($, e, next) => {
    const compacted = await next(e)
    if (e.agentId === undefined && e.trigger !== 'precompute' && 'messages' in compacted)
      await update($, compactions, count => (count ?? 0) + 1)

    return compacted
  })

  on('tool.call', async ($, e, next) => {
    const isShell = (SHELLS as readonly string[]).includes(e.tool)
    const isChecked = shows.checks && isShell
    if (!shows.changes && !isChecked) return next(e)
    const before = shows.changes && isShell ? await gitStatus(hostOf($)).catch(() => undefined) : undefined
    const ran = await next(e)
    const toast = (error: unknown) => $.ui.toast(`session-info: ${String(error)}`)
    if (shows.changes && ran.deny === undefined && !ran.isError) await track(hostOf($), e.tool, ran.result, before).catch(toast)
    if (isChecked) await inspect($, e as Record<string, unknown>, ran as Record<string, unknown>, patterns).catch(toast)

    return ran
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button, Code } = $.ui.resolve(e)
    const { card, tiles } = widgets({ Box, Text })
    const cols = Math.max(20, e.props.bodyColumns)
    const isCards = isFramed(cols)
    const inner = isCards ? cols - FRAME_COLUMNS : cols
    const chrome = isCards ? 1 + FRAME_ROWS : 2
    const shut = new Set(await read($, collapsed))
    const isOpen = (key: SectionKey): boolean => !shut.has(key)
    await read($, now)
    const isDetailed = shows.session && isOpen('#session') && (await read($, breakdown))
    const usage = isLive ? await $.session.usage(isDetailed ? { breakdown: 'summary' } : undefined) : undefined
    const limits: Limit[] = shows.usage && usage ? ordered(usage.rateLimits) : []
    const stats = shows.session ? await read($, turns) : NO_TURNS
    const compacted = shows.session ? await read($, compactions) : 0
    const categories = (usage?.context.breakdown?.categories ?? [])
      .filter(category => category.tokens > 0 && !category.isDeferred)
      .sort((a, b) => b.tokens - a.tokens)
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
            { key: 'turns', value: `${(stats ?? NO_TURNS).count}`, label: (stats ?? NO_TURNS).count === 1 ? 'turn' : 'turns' },
            { key: 'context', value: percentText(context?.percent ?? 0), label: 'context', color: colorOf(context?.percent ?? 0) },
          ]
        : []
    const tileRows = tileLayout(figures.length, cols).rows
    const usageRows = shows.usage ? chrome + (isOpen('#usage') ? Math.max(1, limits.length * 2) : 0) : 0
    const sessionRows = shows.session ? chrome + (isOpen('#session') ? 3 + (isDetailed ? categories.length : 0) : 0) : 0
    const agentLines = agentRows(agents)
    const agentRoom = Math.min(agentLines.length, 8)
    const agentsRows = shows.agents ? chrome + (isOpen('#agents') ? agentRoom + (agentLines.length > agentRoom ? 1 : 0) : 0) : 0
    const lastChecks = shows.checks ? await read($, checks) : NO_CHECKS
    const views = checkViews(lastChecks)
    const checksRows = shows.checks ? chrome + (isOpen('#checks') ? Math.max(1, checkRowCount(views)) : 0) : 0
    const changesFrame = isCards ? FRAME_ROWS : 0
    const above = tileRows + usageRows + sessionRows + agentsRows + checksRows + changesFrame
    const room = Math.max(3, (e.viewport?.rows ?? 30) - above - (diff ? 16 : 7))

    const section = (key: SectionKey, children: RenderChildren, isLast = false) =>
      isCards ? card(key, isOpen(key), children) : (
        <Box flexDirection="column" marginBottom={isLast ? 0 : 1}>
          {children}
        </Box>
      )

    const header = (key: SectionKey, title: string, right: string) => (
      <Box flexDirection="row" justifyContent="space-between">
        <Button plain key={`section:${key}`} onPress={() => void update($, collapsed, list => toggle(list ?? [], key))}>
          <Text bold color="claude">{`${isOpen(key) ? '▾' : '▸'} ${title}`}</Text>
        </Button>
        <Text dimColor>{right}</Text>
      </Box>
    )

    const limitRows = (limit: Limit) => {
      const { filled, empty } = bar(limit.percentUsed, inner - 6)
      const reset = resetIn(limit.resetsAt, Date.now())

      return (
        <Box flexDirection="column">
          <Box flexDirection="row" justifyContent="space-between">
            <Text wrap="truncate-end">{labelOf(limit.kind)}</Text>
            {reset !== undefined && <Text dimColor wrap="truncate-end">{reset}</Text>}
          </Box>
          <Box flexDirection="row">
            <Text color={colorOf(limit.percentUsed)}>{filled}</Text>
            <Text dimColor>{empty}</Text>
            <Text>{` ${percentText(limit.percentUsed)}`}</Text>
          </Box>
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
    const contextBar = bar(context?.percent ?? 0, inner - 6)

    const sessionSection = section(
      '#session',
      [
        header('#session', 'Session', figures.length > 0 ? '' : `${spent}${elapsed}`),
        isOpen('#session') && (
          <Box flexDirection="column">
            <Box flexDirection="row" justifyContent="space-between">
              <Button plain key="context" onPress={() => void update($, breakdown, open => !open)}>
                {`${isDetailed ? '▾' : '▸'} Context`}
              </Button>
              <Text dimColor wrap="truncate-end">
                {context?.tokens === undefined
                  ? 'after the first reply'
                  : `${tokens(context.tokens)} / ${tokens(context.window)}${compactionText(compacted)}`}
              </Text>
            </Box>
            <Box flexDirection="row">
              <Text color={colorOf(context?.percent ?? 0)}>{contextBar.filled}</Text>
              <Text dimColor>{contextBar.empty}</Text>
              <Text>{` ${percentText(context?.percent ?? 0)}`}</Text>
            </Box>
            {isDetailed &&
              categories.map(category => (
                <Box flexDirection="row" justifyContent="space-between">
                  <Text wrap="truncate-end">{`  ${category.name}`}</Text>
                  <Text dimColor>{tokens(category.tokens)}</Text>
                </Box>
              ))}
            <Text dimColor wrap="truncate-end">{turnLine(stats ?? NO_TURNS)}</Text>
          </Box>
        ),
      ],
    )

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

    return (
      <Box flexDirection="column">
        {figures.length > 0 && tiles(figures, cols)}
        {shows.session && sessionSection}
        {shows.usage && usageSection}
        {shows.agents && agentsSection}
        {shows.checks && checksSection}
        {shows.changes && changesSection}
        {shows.changes && diffView}
      </Box>
    )
  })
}
