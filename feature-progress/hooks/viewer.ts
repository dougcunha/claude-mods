import type { Host } from './host'
import { absolute } from './paths'
import type { Platform } from './platform'
import { platformOf } from './platform'
import type { Editor } from './settings'

/** Characters `cmd` reads as syntax; a link that holds one never reaches `cmd /c code` (the link comes from the model). */
const CMD_SYNTAX = /[&|<>^%!"]/

/** The argv that succeeds when the program is on the PATH: `where` on Windows; `command -v` elsewhere (as in session-info). */
export const lookupArgv = (platform: Platform, program: string): string[] =>
  platform === 'windows' ? ['where', program] : ['sh', '-c', 'command -v "$1"', 'sh', program]

/**
 * The argv that opens a file: VS Code (`code` is a .cmd script on Windows, which only `cmd` runs), or the system's
 * default program (DEC-08, the editor part of session-info's viewer).
 */
export function openArgv(platform: Platform, program: Exclude<Editor, 'auto'>, path: string): string[] {
  if (program === 'vscode') return platform === 'windows' ? ['cmd', '/c', 'code', path] : ['code', path]
  if (platform === 'windows') return ['explorer.exe', path.replace(/\//g, '\\')]

  return [platform === 'mac' ? 'open' : 'xdg-open', path]
}

/** The program the setting names; `auto` is VS Code when `code` is on the PATH, else the system's default program. */
async function programOf(host: Host, editor: Editor, platform: Platform): Promise<Exclude<Editor, 'auto'>> {
  if (editor !== 'auto') return editor
  const lookup = await host.run(lookupArgv(platform, 'code')).catch(() => ({ exitCode: 1 }))

  return lookup.exitCode === 0 ? 'vscode' : 'system'
}

/** Opens a task's link with the `editor` setting; a missing file or a link `cmd` would misread gets a toast (FR-15). */
export async function openLink(host: Host, editor: Editor, link: string): Promise<void> {
  const path = absolute(await host.cwd(), link)
  if (!(await host.exists(path))) {
    host.toast(`feature-progress: ${path} does not exist.`)
    return
  }
  const platform = await platformOf(host)
  const program = await programOf(host, editor, platform)
  if (program === 'vscode' && platform === 'windows' && CMD_SYNTAX.test(path)) {
    host.toast('feature-progress: the task link has a character cmd would read as a command; open the file by hand.')
    return
  }
  // explorer.exe ends with exit code 1 even when it opened the file, so only a program that did not start is reported.
  await host.run(openArgv(platform, program, path)).catch(() => host.toast(`feature-progress: could not start ${program === 'vscode' ? 'VS Code' : 'the default program'}.`))
}
