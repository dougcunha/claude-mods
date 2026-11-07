import { atom, read, update } from 'claude-code'
import type { CommandPresentation, EngineInterface, Register } from 'claude-code'

import type { Created } from '../types'

import { outcomeLines, purgeQuarantine, removeItems } from './apply'
import { mergeCreated } from './candidates'
import { fixPrompt } from './git'
import type { Env, Host } from './host'
import { paneBody } from './pane'
import { baseName, keyOf, norm } from './paths'
import type { Platform, RemoveMode } from './remove'
import { entriesOf, preselected, scan } from './scan'
import { shellTargets } from './shell'
import type { ShellKind } from './shell'

const PLUGIN = 'session-cleanup'

const PANE_ID = 'session-cleanup'
const PANE_TITLE = 'Session cleanup'

const COMMAND = {
  name: 'cleanup',
  description: 'List the temporary files and the Git items this session left, and choose what to remove or fix.',
} as const

/** A shell command is checked for at most this many target paths. */
const TARGET_LIMIT = 50

/** Below this width the fullscreen layout does not dock a pane beside the chat. */
const DOCK_COLUMNS = 110

const created = atom({ plugin: 'session-cleanup', key: 'created' } as const, {} as Record<string, Created>, { shape: 'created-1' })
const since = atom({ plugin: 'session-cleanup', key: 'since' } as const, 0)
const sessionIds = atom({ plugin: 'session-cleanup', key: 'sessionIds' } as const, [] as string[])
const scanned = atom({ plugin: 'session-cleanup', key: 'scan' } as const, null, { shape: 'scan-3' })
const selected = atom({ plugin: 'session-cleanup', key: 'selected' } as const, [] as string[])
const isBusy = atom({ plugin: 'session-cleanup', key: 'isBusy' } as const, false)
const message = atom({ plugin: 'session-cleanup', key: 'message' } as const, '')

const sessionInfoFiles = { plugin: 'session-info', key: 'files' } as const

type Settings = { mode: RemoveMode; quarantineDays: number }

function settingsOf(options: Record<string, unknown>): Settings {
  const mode = options.removeMode === 'quarantine' || options.removeMode === 'delete' ? options.removeMode : 'trash'
  const days = typeof options.quarantineDays === 'number' && options.quarantineDays > 0 ? options.quarantineDays : 7

  return { mode, quarantineDays: days }
}

function hostOf($: EngineInterface): Host {
  return {
    run: (argv, cwd) => $.process.run(argv, cwd === undefined ? undefined : { cwd }),
    cwd: () => $.session.root(),
    exists: path => $.fs.exists(path),
    stat: path => $.fs.stat(path),
    list: path => $.fs.list(path),
    writeFile: (path, text) => $.fs.write(path, text),
  }
}

/** The environment, read once per load of the module. */
let envRead: Promise<Env> | undefined

function envOf($: EngineInterface): Promise<Env> {
  envRead ??= readEnv($).catch(error => {
    envRead = undefined
    throw error
  })

  return envRead
}

/** The environment the mod reads, each name spelled as a literal as `$.env.get` requires. */
async function readEnv($: EngineInterface): Promise<Env> {
  const values: Record<string, string | undefined> = {
    HOME: await $.env.get('HOME'),
    USERPROFILE: await $.env.get('USERPROFILE'),
    TEMP: await $.env.get('TEMP'),
    TMP: await $.env.get('TMP'),
    TMPDIR: await $.env.get('TMPDIR'),
    LOCALAPPDATA: await $.env.get('LOCALAPPDATA'),
    APPDATA: await $.env.get('APPDATA'),
  }
  const isWindows = (await $.env.get('OS')) === 'Windows_NT'
  const platform: Platform = isWindows ? 'windows' : (await platformOf($))
  const vars = Object.fromEntries(Object.entries(values).filter((pair): pair is [string, string] => pair[1] !== undefined && pair[1] !== ''))
  const home = values.USERPROFILE ?? values.HOME
  const listed = [values.TEMP, values.TMP, values.TMPDIR].filter((one): one is string => one !== undefined && one !== '').map(norm)
  const temps = [...new Map((listed.length > 0 ? listed : isWindows ? [] : ['/tmp']).map(one => [keyOf(one), one])).values()]

  return { ...(home === undefined ? {} : { home: norm(home) }), temps, vars, platform }
}

/** macOS answers `uname -s` with Darwin; any other answer is Linux. */
async function platformOf($: EngineInterface): Promise<Platform> {
  const ran = await $.process.run(['uname', '-s']).catch(() => ({ stdout: '' }))

  return ran.stdout.trim() === 'Darwin' ? 'mac' : 'linux'
}

/** The paths a shell command may create that do not exist yet, read before it runs. */
async function shellBefore($: EngineInterface, command: string, kind: ShellKind): Promise<string[]> {
  const env = await envOf($)
  const targets = shellTargets(command, {
    kind,
    cwd: await $.session.cwd(),
    ...(env.home === undefined ? {} : { home: env.home }),
    isWindows: env.platform === 'windows',
    env: name => env.vars[name.toUpperCase()],
  }).slice(0, TARGET_LIMIT)
  const pending: string[] = []
  for (const target of targets) {
    const stat = await $.fs.stat(target.path).catch(() => undefined)
    if (stat === undefined) pending.push(target.path)
    else if (stat.kind === 'directory' && target.sources !== undefined) {
      for (const source of target.sources) {
        const inside = `${target.path}/${baseName(source)}`
        if (!(await $.fs.exists(inside))) pending.push(inside)
      }
    }
  }

  return pending
}

/** Records the pending paths that exist after the command ran. */
async function shellAfter($: EngineInterface, pending: string[]): Promise<void> {
  if (pending.length === 0) return
  const now = await $.clock.now()
  const made: Created[] = []
  for (const path of pending) {
    const stat = await $.fs.stat(path).catch(() => undefined)
    if (stat !== undefined) made.push({ path: norm(path), isFolder: stat.kind === 'directory', source: 'shell', at: now })
  }
  if (made.length > 0) await update($, created, all => mergeCreated(all ?? {}, made))
}

/** Copies the files session-info records as created into the mod's own list, which a /clear does not empty. */
async function collect($: EngineInterface): Promise<void> {
  const { value = {} } = await $.state.get(sessionInfoFiles)
  const now = await $.clock.now()
  const made: Created[] = Object.values(value)
    .filter(change => change.status === 'created')
    .map(change => ({ path: norm(change.path), isFolder: false, source: 'session-info', at: change.at ?? now }))
  if (made.length > 0) await update($, created, all => mergeCreated(all ?? {}, made))
  const id = await $.session.id().catch(() => undefined)
  if (id !== undefined) await update($, sessionIds, list => ((list ?? []).includes(id) ? (list ?? []) : [...(list ?? []), id]))
}

/** Every path session-info or the shell hook saw: each one's repository is checked. */
async function touched($: EngineInterface): Promise<string[]> {
  const { value = {} } = await $.state.get(sessionInfoFiles)

  return [...Object.values(value).map(change => change.path), ...Object.values((await read($, created)) ?? {}).map(entry => entry.path)]
}

/** Scans again, pre-selects the likely temporary files and redraws. */
async function rescan($: EngineInterface): Promise<void> {
  await collect($).catch(() => undefined)
  const result = await scan(hostOf($), {
    created: Object.values((await read($, created)) ?? {}),
    touched: await touched($),
    since: (await read($, since)) || (await $.clock.now()),
    sessionIds: (await read($, sessionIds)) ?? [],
    env: await envOf($),
    now: await $.clock.now(),
  })
  await update($, scanned, () => result)
  await update($, selected, () => preselected(result))
}

/** Runs `work` with the busy mark on, and writes its result line, or the error, to the pane. */
async function busy($: EngineInterface, work: () => Promise<string>): Promise<void> {
  if (await read($, isBusy)) return
  await update($, isBusy, () => true)
  await update($, message, () => '')
  try {
    const text = await work()
    await update($, message, () => text)
  } catch (error) {
    await update($, message, () => `✗ ${PLUGIN}: ${error instanceof Error ? error.message : String(error)}`)
  } finally {
    await update($, isBusy, () => false)
  }
}

/** Removes the chosen files, sends the chosen Git items to Claude as one prompt, then scans again. */
async function apply($: EngineInterface, settings: Settings): Promise<string> {
  const last = await read($, scanned)
  const chosen = (await read($, selected)) ?? []
  if (last === null) return 'Nothing is scanned yet.'
  const files = last.files.filter(item => chosen.includes(item.id))
  const git = last.git.filter(item => chosen.includes(item.id))
  if (files.length === 0 && git.length === 0) return 'Nothing is selected.'
  const parts: string[] = []
  if (files.length > 0) {
    const env = await envOf($)
    const outcome = await removeItems(hostOf($), files.flatMap(entriesOf), {
      platform: env.platform,
      mode: settings.mode,
      ...(env.home === undefined ? {} : { home: env.home }),
      now: await $.clock.now(),
    })
    parts.push(...outcomeLines(outcome, settings.mode))
  }
  if (git.length > 0) {
    void $.prompt.submit({ text: fixPrompt(git, norm(await $.session.root())) }).catch(() => $.ui.toast(`${PLUGIN}: could not send the Git items to Claude.`))
    parts.push(`Sent ${git.length} Git ${git.length === 1 ? 'item' : 'items'} to Claude.`)
  }
  await rescan($)

  // Successes first, then one line per failure.
  return [...parts.filter(line => !line.startsWith('✗')), ...parts.filter(line => line.startsWith('✗'))].join('\n')
}

/** Why the pane will not dock beside the chat, or undefined when it docks or the layout is unknown. */
function dockHint(presentation: CommandPresentation | undefined): string | undefined {
  if (presentation === undefined) return undefined
  if (!presentation.isFullscreen) return `${PLUGIN}: the pane opens above the prompt. To dock it beside the chat, start Claude Code in the fullscreen layout (CLAUDE_CODE_NO_FLICKER=1).`
  if (presentation.columns < DOCK_COLUMNS) return `${PLUGIN}: the pane opens above the prompt. Widen the terminal to ${DOCK_COLUMNS} columns to dock it beside the chat.`

  return undefined
}

/** Opens the pane with the keys and starts a scan. */
async function openPane($: EngineInterface, presentation: CommandPresentation | undefined): Promise<{ text: string }> {
  await update($, scanned, () => null)
  await update($, message, () => '')
  const opened = await $.ui.open({ id: PANE_ID, title: PANE_TITLE, focus: true, closeOnEscape: true, backgroundColor: 'transparent' })
  if (!opened.isPlaced) {
    $.ui.toast(`${PLUGIN}: widen the terminal to open the pane.`)
    return { text: 'Session cleanup pane waits for a wider terminal.' }
  }
  const hint = dockHint(presentation)
  if (hint !== undefined) $.ui.toast(hint)
  void busy($, async () => (await rescan($), ''))

  return { text: 'Session cleanup pane opened.' }
}

export const register: Register = (on, options) => {
  const settings = settingsOf(options)

  on('session.start', async ($, e, next) => {
    await $.command.register(COMMAND).catch(error => $.ui.toast(`${PLUGIN}: could not register /${COMMAND.name}: ${String(error)}`))
    const now = await $.clock.now()
    await update($, since, value => value || now)
    await collect($).catch(() => undefined)
    void envOf($)
      .then(env => (env.home === undefined ? 0 : purgeQuarantine(hostOf($), env.platform, env.home, now, settings.quarantineDays)))
      .catch(() => undefined)

    return next(e)
  }).catch(($, e, next) => next(e))

  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const pending = await shellBefore($, e.command, 'bash').catch(() => [])
    const result = await next(e)
    await shellAfter($, pending).catch(() => undefined)

    return result
  }).catch(($, e, next) => next(e))

  on('tool.call', { tool: 'PowerShell' }, async ($, e, next) => {
    const pending = await shellBefore($, e.command, 'powershell').catch(() => [])
    const result = await next(e)
    await shellAfter($, pending).catch(() => undefined)

    return result
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    await collect($).catch(() => undefined)

    return result
  }).catch(($, e, next) => next(e))

  on('session.end', async ($, e, next) => {
    if (e.reason === 'clear') await collect($).catch(() => undefined)

    return next(e)
  }).catch(($, e, next) => next(e))

  on('command.run', { command: COMMAND.name }, async ($, e) => openPane($, e.presentation)).catch((_$, _e, next) => ({
    text: `${PLUGIN}: ${next.error.message ?? next.error.kind}`,
  }))

  on('ui.render', { component: 'Pane', requestId: PANE_ID }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const env = await envOf($)

    return paneBody(
      { Box, Text, Button },
      {
        scan: await read($, scanned),
        selected: (await read($, selected)) ?? [],
        isBusy: (await read($, isBusy)) ?? false,
        message: (await read($, message)) ?? '',
        cwd: norm(await $.session.root()),
        ...(env.home === undefined ? {} : { home: env.home }),
        mode: settings.mode,
        columns: e.props.bodyColumns,
        isTerminal: e.surface === 'terminal',
        onToggle: id => void update($, selected, list => ((list ?? []).includes(id) ? (list ?? []).filter(one => one !== id) : [...(list ?? []), id])),
        onSelect: ids => void update($, selected, () => ids),
        onApply: () => void busy($, () => apply($, settings)),
        onRescan: () => void busy($, async () => (await rescan($), 'Scanned again.')),
        onClose: () => void $.ui.close({ id: PANE_ID }),
      },
    )
  })
}
