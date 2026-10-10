import type { FileChange } from '../types'

import { emptyFile, headText, snapshot } from './git'
import type { Host } from './host'

export type Viewer = 'auto' | 'git' | 'vscode' | 'inline'

let picked: Exclude<Viewer, 'auto'> | undefined

const isWindows = async (host: Host): Promise<boolean> => (await host.env()).os === 'Windows_NT'

const succeeds = async (host: Host, argv: string[]): Promise<boolean> =>
  (await host.run(argv).catch(() => ({ exitCode: 1 }))).exitCode === 0

/** git's GUI diff tool when one is configured, else VS Code when on the PATH, else the pane itself. */
async function pick(host: Host): Promise<Exclude<Viewer, 'auto'>> {
  if (picked !== undefined) return picked
  const hasGuiTool =
    (await succeeds(host, ['git', 'config', '--get', 'diff.guitool'])) ||
    (await succeeds(host, ['git', 'config', '--get', 'merge.guitool']))
  const hasCode = await succeeds(host, (await isWindows(host)) ? ['where', 'code'] : ['which', 'code'])
  picked = hasGuiTool ? 'git' : hasCode ? 'vscode' : 'inline'

  return picked
}

/** Starts the viewer and lets it run on after the press: the loop is the child's life. */
function launch(host: Host, argv: string[]): void {
  void (async () => {
    let errors = ''
    try {
      for await (const { stream, text } of host.spawn(argv)) if (stream === 'stderr') errors += text
    } catch (error) {
      errors = String(error)
    }
    if (/fatal|error|not found/i.test(errors)) host.toast(`Diff viewer: ${errors.trim().slice(0, 300)}`)
  })()
}

async function showInline(host: Host, change: FileChange, left: string, right: string): Promise<void> {
  const run = await host.run(['git', 'diff', '--no-index', '--no-color', '--', left, right])
  const at = run.stdout.indexOf('@@')
  const source = at < 0 ? '' : run.stdout.slice(at)
  await host.showInline({ path: change.path, source })
}

/** Opens the change's diff: what the file was before the session against what it is now. */
export async function openDiff(host: Host, change: FileChange, viewer: Viewer): Promise<void> {
  const head = change.base === null ? await headText(host, change.path) : undefined
  const left = change.base ?? (head === undefined ? undefined : await snapshot(host, change.path, head))
  if (left === undefined) {
    host.toast('The previous content of this file is unknown (outside git and not captured).')
    return
  }

  const right = change.status === 'deleted' ? await emptyFile(host, change.path) : change.path
  const mode = viewer === 'auto' ? await pick(host) : viewer
  if (mode === 'inline') return showInline(host, change, left, right)
  if (mode === 'git') return launch(host, ['git', 'difftool', '--gui', '--no-index', '--no-prompt', left, right])

  const code = ['code', '--diff', left, right]
  launch(host, (await isWindows(host)) ? ['cmd', '/c', ...code] : code)
}
