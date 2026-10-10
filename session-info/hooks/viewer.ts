import type { FileChange } from '../types'

import { emptyFile, headText, snapshot } from './git'
import type { Host } from './host'

export type Viewer = 'auto' | 'git' | 'vscode' | 'inline'

export type Editor = 'auto' | 'vscode' | 'system'

export type Prefs = { viewer: Viewer; editor: Editor }

type Platform = 'windows' | 'mac' | 'linux'

let picked: Exclude<Viewer, 'auto'> | undefined
let platform: Platform | undefined
let hasCode: boolean | undefined

const succeeds = async (host: Host, argv: string[]): Promise<boolean> =>
  (await host.run(argv).catch(() => ({ exitCode: 1 }))).exitCode === 0

async function platformOf(host: Host): Promise<Platform> {
  if (platform !== undefined) return platform
  if ((await host.env()).os === 'Windows_NT') platform = 'windows'
  else {
    const uname = await host.run(['uname', '-s']).catch(() => ({ exitCode: 1, stdout: '' }))
    platform = uname.stdout.trim() === 'Darwin' ? 'mac' : 'linux'
  }

  return platform
}

async function codeOnPath(host: Host): Promise<boolean> {
  hasCode ??= await succeeds(host, (await platformOf(host)) === 'windows' ? ['where', 'code'] : ['which', 'code'])

  return hasCode
}

/** `code` is a .cmd script on Windows, which only a shell runs. */
async function codeArgv(host: Host, args: string[]): Promise<string[]> {
  return (await platformOf(host)) === 'windows' ? ['cmd', '/c', 'code', ...args] : ['code', ...args]
}

/** git's GUI diff tool when one is configured, else VS Code when on the PATH, else the pane itself. */
async function pick(host: Host): Promise<Exclude<Viewer, 'auto'>> {
  if (picked !== undefined) return picked
  const hasGuiTool =
    (await succeeds(host, ['git', 'config', '--get', 'diff.guitool'])) ||
    (await succeeds(host, ['git', 'config', '--get', 'merge.guitool']))
  picked = hasGuiTool ? 'git' : (await codeOnPath(host)) ? 'vscode' : 'inline'

  return picked
}

/** Starts the program and lets it run on after the press: the loop is the child's life. */
function launch(host: Host, argv: string[]): void {
  void (async () => {
    let errors = ''
    try {
      for await (const { stream, text } of host.spawn(argv)) if (stream === 'stderr') errors += text
    } catch (error) {
      errors = String(error)
    }
    if (/fatal|error|not found/i.test(errors)) host.toast(`session-info: ${errors.trim().slice(0, 300)}`)
  })()
}

/** Opens a file in VS Code, or in the app the system associates with it. */
async function openInEditor(host: Host, path: string, editor: Editor): Promise<void> {
  if (editor === 'vscode' || (editor === 'auto' && (await codeOnPath(host))))
    return launch(host, await codeArgv(host, [path]))

  const os = await platformOf(host)
  if (os === 'windows') return launch(host, ['explorer.exe', path.replace(/\//g, '\\')])
  launch(host, [os === 'mac' ? 'open' : 'xdg-open', path])
}

async function showInline(host: Host, change: FileChange, left: string, right: string): Promise<void> {
  const run = await host.run(['git', 'diff', '--no-index', '--no-color', '--', left, right])
  const at = run.stdout.indexOf('@@')
  const source = at < 0 ? '' : run.stdout.slice(at)
  await host.showInline({ path: change.path, source })
}

/**
 * Opens a change: a created file in the editor; a modified or deleted one as a diff of what
 * it was before the session against what it is now. A deleted file whose content is unknown opens nothing.
 */
export async function openChange(host: Host, change: FileChange, prefs: Prefs): Promise<void> {
  if (change.status === 'created') return openInEditor(host, change.path, prefs.editor)

  const head = change.base === null ? await headText(host, change.path) : undefined
  const left = change.base ?? (head === undefined ? undefined : await snapshot(host, change.path, head))
  if (left === undefined) {
    if (change.status === 'modified')
      host.toast('The previous content of this file is unknown (outside git and not captured).')
    return
  }

  const right = change.status === 'deleted' ? await emptyFile(host, change.path) : change.path
  const mode = prefs.viewer === 'auto' ? await pick(host) : prefs.viewer
  if (mode === 'inline') return showInline(host, change, left, right)
  if (mode === 'git') return launch(host, ['git', 'difftool', '--gui', '--no-index', '--no-prompt', left, right])

  launch(host, await codeArgv(host, ['--diff', left, right]))
}
