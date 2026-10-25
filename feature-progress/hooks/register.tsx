import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, ToolCallResult } from 'claude-code'

import type { Feature } from '../types'

import { bandLine } from './band'
import type { Host } from './host'
import { flip, paneBody } from './pane'
import { isStale, latestOpen, orderFeatures, replyText } from './progress'
import { applyReport, parseReport } from './report'
import { settingsOf } from './settings'
import type { Settings } from './settings'
import { IGNORED_RESULT, REPORT_SPEC, REPORT_TOOL } from './spec'
import { platformOf } from './platform'
import { cleanArgv, fileName, fileOf, folderOf, loadAll, readOne, serialize } from './store'
import { openLink } from './viewer'

const PLUGIN = 'feature-progress'

/** The pane's id and title. */
const PANE_ID = 'feature-progress'
const PANE_TITLE = 'Feature progress'

/** The slash command: it opens or closes the pane; `band` shows or hides the band; `clean` deletes the files of done features. */
const COMMAND = {
  name: 'feature-progress',
  description: 'Open or close the feature-progress pane; band shows or hides the band; clean deletes the files of done features.',
  argumentHint: '[band|clean]',
} as const

const USAGE_TEXT =
  'Usage: /feature-progress opens or closes the pane; /feature-progress band shows or hides the band; /feature-progress clean deletes the files of done features.'

/** The `/config` key of the `showBand` option (DEC-13). */
const SHOW_BAND_KEY = `${PLUGIN}.showBand`

/** How often a reload after /clear or /resume checks whether the session id switched, and for how long. */
const SWITCH_POLL_MS = 200
const SWITCH_LIMIT_MS = 10_000

/** How often the relative times and the stale marker redraw; the tick reads no file (DEC-10). */
const REDRAW_MS = 60_000

const features = atom({ plugin: 'feature-progress', key: 'features' } as const, {} as Record<string, Feature>)
const warnings = atom({ plugin: 'feature-progress', key: 'warnings' } as const, [] as string[])
const toggled = atom({ plugin: 'feature-progress', key: 'toggled' } as const, [] as string[])

function hostOf($: EngineInterface): Host {
  return {
    run: (argv, cwd) => $.process.run(argv, cwd === undefined ? undefined : { cwd }),
    cwd: () => $.session.cwd(),
    readFile: path => $.fs.read(path),
    writeFile: (path, text) => $.fs.write(path, text),
    list: path => $.fs.list(path),
    exists: path => $.fs.exists(path),
    env: async () => ({ os: await $.env.get('OS') }),
    toast: text => $.ui.toast(text),
  }
}

/** Reads the storage folder into the state and redraws (FR-16). */
async function load($: EngineInterface, settings: Settings): Promise<void> {
  const host = hostOf($)
  const loaded = await loadAll(host, folderOf(await host.cwd(), settings.folder))
  await update($, features, () => loaded.features)
  await update($, warnings, () => loaded.warnings)
  $.ui.invalidate('ui.render')
}

/** After /clear or /resume the state starts empty and the session id switches later: reload once it did (DEC-09). */
function afterSwitch($: EngineInterface, endedId: string, reload: () => Promise<void>): void {
  let waited = 0
  const poll = async (): Promise<void> => {
    if ((await $.session.id().catch(() => endedId)) !== endedId) return reload()
    waited += SWITCH_POLL_MS
    if (waited < SWITCH_LIMIT_MS) $.clock.after(SWITCH_POLL_MS, () => void poll().catch(() => undefined))
  }
  $.clock.after(SWITCH_POLL_MS, () => void poll().catch(() => undefined))
}

/** Validates a report, merges it with the file on disk, writes it and updates the state (DEC-02, DEC-03). */
async function report($: EngineInterface, settings: Settings, input: unknown): Promise<ToolCallResult> {
  const parsed = parseReport(input)
  if (typeof parsed === 'string') return { deny: parsed }
  const host = hostOf($)
  const path = fileOf(folderOf(await host.cwd(), settings.folder), parsed.feature.id)
  const stored = await readOne(host, path)
  if (stored.kind === 'unreadable') return { deny: `feature-progress: ${path} is not a readable feature file; fix or delete it, then report again` }
  const next = applyReport(stored.kind === 'feature' ? stored.feature : undefined, parsed, await $.clock.now())
  if (typeof next === 'string') return { deny: next }
  const file = serialize(next)
  if ('error' in file) return { deny: file.error }
  await host.writeFile(path, file.text)
  await update($, features, all => ({ ...(all ?? {}), [next.id]: next }))
  await update($, warnings, list => (list ?? []).filter(warning => warning !== path))
  $.ui.invalidate('ui.render')

  return { result: replyText(next) }
}

/** Opens the pane with focus, or focuses it when it is open; a pane the terminal is too narrow for is reported (FR-10). */
async function openPane($: EngineInterface): Promise<{ text: string }> {
  const opened = await $.ui.open({ id: PANE_ID, title: PANE_TITLE, focus: true })
  if (!opened.isPlaced) {
    $.ui.toast(`${PLUGIN}: widen the terminal to open the pane.`)
    return { text: 'Feature progress pane waits for a wider terminal.' }
  }

  return { text: 'Feature progress pane opened.' }
}

/** Opens the pane, or closes it when it is open; the slash command's toggle (FR-10). */
async function togglePane($: EngineInterface): Promise<{ text: string }> {
  const isOpen = (await $.ui.panes()).some(pane => pane.id === PANE_ID)
  if (!isOpen) return openPane($)
  await $.ui.close({ id: PANE_ID })

  return { text: 'Feature progress pane closed.' }
}

/** Flips `showBand` as a change in /config does; the engine then loads the module again with the new value (DEC-13). */
async function flipBand($: EngineInterface, settings: Settings): Promise<{ text: string }> {
  const done = await $.config.set({ key: SHOW_BAND_KEY, value: !settings.showBand })
  if (done.deny !== undefined) return { text: `${PLUGIN}: ${done.deny}` }

  return { text: settings.showBand ? 'Feature progress band hidden.' : 'Feature progress band shown.' }
}

/** Deletes the files of the features that are done on disk now, then reads the folder again (FR-17, DEC-05). */
async function clean($: EngineInterface, settings: Settings): Promise<{ text: string }> {
  await load($, settings)
  const done = Object.values((await read($, features)) ?? {}).filter(feature => feature.state === 'done')
  if (done.length === 0) return { text: 'No done feature to delete.' }
  const host = hostOf($)
  const folder = folderOf(await host.cwd(), settings.folder)
  const argv = cleanArgv(await platformOf(host), done.map(feature => fileName(feature.id)))
  await host.run(argv, folder).catch(() => ({ exitCode: 1, stdout: '' }))
  await load($, settings)
  const left = (await read($, features)) ?? {}
  const deleted = done.filter(feature => left[feature.id] === undefined).length
  const text = deleted === done.length ? `Deleted ${deleted} done features.` : `Deleted ${deleted} of ${done.length} done features; the others are still in ${folder}.`
  $.ui.toast(`${PLUGIN}: ${text}`)

  return { text }
}

export const register: Register = (on, options) => {
  const settings = settingsOf(options)

  on('session.start', async ($, e, next) => {
    await $.tool.register(REPORT_SPEC).catch(error => $.ui.toast(`${PLUGIN}: could not register the report tool: ${String(error)}`))
    await $.command.register(COMMAND).catch(error => $.ui.toast(`${PLUGIN}: could not register /${COMMAND.name}: ${String(error)}`))
    await load($, settings).catch(() => undefined)
    $.clock.every(REDRAW_MS, async () => {
      const open = latestOpen((await read($, features)) ?? {})
      if (open !== undefined) $.ui.invalidate('ui.render')
    })

    return next(e)
  }).catch(($, e, next) => next(e))

  /** Draws the band above what the hooks beneath draw, and yields to a survey (DEC-06) or to `showBand` off (DEC-13). */
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (!settings.showBand || e.props.hasSurvey) return next(e)
    const feature = latestOpen((await read($, features)) ?? {})
    if (feature === undefined) return next(e)
    const below = await next(e)
    const { Box, Text, Button } = $.ui.resolve(e)
    const band = bandLine(
      { Box, Text, Button },
      {
        feature,
        isStale: isStale(feature, await $.clock.now(), settings.staleMinutes),
        columns: e.props.bodyColumns,
        icons: settings.icons,
        onOpen: () => void openPane($).catch(() => $.ui.toast(`${PLUGIN}: could not open the pane.`)),
      },
    )

    return (
      <Box flexDirection="column">
        {band}
        {below}
      </Box>
    )
  })

  on('session.end', async ($, e, next) => {
    if (e.reason === 'clear' || e.reason === 'resume') afterSwitch($, e.sessionId, () => load($, settings).catch(() => undefined))

    return next(e)
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'Pane', requestId: PANE_ID }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const flipped = (await read($, toggled)) ?? []
    // The API has no color for the frame the terminal draws around a pane; this paints the body under the tree instead.
    const isTerminal = e.surface === 'terminal'
    const paint = isTerminal && settings.paneBackground !== '' ? { backgroundColor: settings.paneBackground, minHeight: e.props.scroll.bodyRows } : {}

    return paneBody(
      { Box, Text, Button },
      {
        ordered: orderFeatures((await read($, features)) ?? {}),
        warnings: (await read($, warnings)) ?? [],
        now: await $.clock.now(),
        staleMinutes: settings.staleMinutes,
        columns: e.props.bodyColumns,
        icons: settings.icons,
        paint,
        toggled: flipped,
        onToggle: id => void update($, toggled, list => flip(list ?? [], id)).catch(() => undefined),
        onRefresh: () => void load($, settings).catch(() => $.ui.toast(`${PLUGIN}: could not read the feature files.`)),
        onOpenLink: link => void openLink(hostOf($), settings.editor, link).catch(() => $.ui.toast(`${PLUGIN}: could not open the task link.`)),
      },
    )
  })

  /** Gating: answers the command itself; a failure prints the reason instead of the command's output. */
  on('command.run', { command: COMMAND.name }, async ($, e) => {
    const argument = e.args.trim()
    if (argument === '') return togglePane($)
    if (argument === 'band') return flipBand($, settings)
    if (argument === 'clean') return clean($, settings)

    return { text: USAGE_TEXT }
  }).catch((_$, _e, next) => ({ text: `${PLUGIN}: ${next.error.message ?? next.error.kind}` }))

  /** Gating: the hook answers the call itself; a failure refuses it, so the model learns the report was not saved. */
  on('tool.call', { tool: REPORT_TOOL }, async ($, e) => {
    if (e.agentId !== undefined) return { result: IGNORED_RESULT }

    return report($, settings, e)
  }).catch((_$, _e, next) => ({ deny: `${PLUGIN}: could not save the report: ${next.error.message ?? next.error.kind}` }))
}
