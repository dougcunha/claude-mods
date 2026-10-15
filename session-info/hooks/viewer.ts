import type { FileChange, RepoFile } from '../types'

import { emptyFile, headText, snapshot } from './git'
import type { Host } from './host'
import { absolute } from './paths'
import { fileStatus } from './repo'

export type Viewer = 'auto' | 'git' | 'vscode' | 'inline'

export type Editor = 'auto' | 'vscode' | 'system'

export type Prefs = { viewer: Viewer; editor: Editor }

export type Platform = 'windows' | 'mac' | 'linux'

let picked: Exclude<Viewer, 'auto'> | undefined
let platform: Platform | undefined
let hasCode: boolean | undefined

export const succeeds = async (host: Host, argv: string[]): Promise<boolean> =>
  (await host.run(argv).catch(() => ({ exitCode: 1 }))).exitCode === 0

export async function platformOf(host: Host): Promise<Platform> {
  if (platform !== undefined) return platform
  if ((await host.env()).os === 'Windows_NT') platform = 'windows'
  else {
    const uname = await host.run(['uname', '-s']).catch(() => ({ exitCode: 1, stdout: '' }))
    platform = uname.stdout.trim() === 'Darwin' ? 'mac' : 'linux'
  }

  return platform
}

/** The argv that succeeds when the program is on the PATH: `where` on Windows; `command -v` elsewhere, as minimal Linux images lack `which`. */
export const lookupArgv = (platform: Platform, program: string): string[] =>
  platform === 'windows' ? ['where', program] : ['sh', '-c', 'command -v "$1"', 'sh', program]

export const onPath = async (host: Host, program: string): Promise<boolean> =>
  succeeds(host, lookupArgv(await platformOf(host), program))

async function codeOnPath(host: Host): Promise<boolean> {
  hasCode ??= await onPath(host, 'code')

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
export function launch(host: Host, argv: string[], cwd?: string): void {
  void (async () => {
    let errors = ''
    try {
      for await (const { stream, text } of host.spawn(argv, cwd)) if (stream === 'stderr') errors += text
    } catch (error) {
      errors = String(error)
    }
    if (/fatal|error|not found/i.test(errors)) host.toast(`session-info: ${errors.trim().slice(0, 300)}`)
  })()
}

/** Opens a web page in the default browser. */
export async function openUrl(host: Host, url: string): Promise<void> {
  const os = await platformOf(host)
  if (os === 'windows') return launch(host, ['explorer.exe', url])
  launch(host, [os === 'mac' ? 'open' : 'xdg-open', url])
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

/** Opens a file of the Git section: a new one in the editor, any other as a diff of HEAD (its old path for a rename) against the disk. */
export async function openRepoFile(host: Host, root: string, file: RepoFile, at: number, prefs: Prefs): Promise<void> {
  const path = absolute(root, file.path)
  const status = fileStatus(file)
  const head = file.from === undefined || status === 'created' ? undefined : await headText(host, absolute(root, file.from))
  const base = head === undefined ? null : await snapshot(host, path, head)

  await openChange(host, { path, status, base, at }, prefs)
}
