import type { Host } from './host'
import { launch, lookupArgv, onPath, platformOf, splitCommand, succeeds } from './viewer'
import type { Platform } from './viewer'

export { splitCommand }

/** Terminal emulators tried in order on Linux, each with the arguments that come before the command it runs. */
const TERMINALS: readonly (readonly string[])[] = [
  ['x-terminal-emulator', '-e'],
  ['gnome-terminal', '--'],
  ['konsole', '-e'],
  ['xfce4-terminal', '-x'],
  ['kitty'],
  ['alacritty', '-e'],
  ['wezterm', 'start', '--'],
  ['foot'],
  ['xterm', '-e'],
]

/** Runs the command from the folder in its first argument, as not every terminal starts in its own working directory. */
const IN_FOLDER = ['sh', '-c', 'cd "$1" && shift && exec "$@"', 'sh']

const shellQuote = (text: string): string => `'${text.replace(/'/g, `'\\''`)}'`

const appleString = (text: string): string => `"${text.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`

/**
 * The argv that opens the client in a new terminal window, in the repository's root.
 * Windows: `start` opens the default terminal, Windows Terminal on Windows 11; its quoted title comes first.
 * macOS: Terminal.app through AppleScript. Linux: the first terminal emulator found, given by the caller, with `sh` changing to the root.
 */
export function clientArgv(platform: Platform, root: string, command: readonly string[], terminal?: readonly string[]): string[] | undefined {
  if (platform === 'windows') return ['cmd', '/c', 'start', 'Git client', '/D', root.replace(/\//g, '\\'), ...command]
  if (platform === 'mac') {
    const script = `cd ${shellQuote(root)} && ${command.map(shellQuote).join(' ')}`

    return ['osascript', '-e', `tell application "Terminal" to do script ${appleString(script)}`, '-e', 'tell application "Terminal" to activate']
  }

  return terminal === undefined ? undefined : [...terminal, ...IN_FOLDER, root, ...command]
}

/** The first terminal emulator of `TERMINALS` on the PATH, with its arguments; undefined when there is none. */
export async function linuxTerminal(host: Host): Promise<readonly string[] | undefined> {
  for (const terminal of TERMINALS) if (await succeeds(host, lookupArgv('linux', terminal[0] ?? ''))) return terminal

  return undefined
}

/** Opens the configured Git client in a new terminal window; a toast says why when it cannot. */
export async function openClient(host: Host, root: string, line: string): Promise<void> {
  const command = splitCommand(line)
  const program = command[0]
  if (program === undefined) return

  const isFound = /[\\/]/.test(program) ? await host.exists(program) : await onPath(host, program)
  if (!isFound) return host.toast(`session-info: ${program} is not on the PATH. Set the Git client in /config.`)

  const platform = await platformOf(host)
  const terminal = platform === 'linux' ? await linuxTerminal(host) : undefined
  const argv = clientArgv(platform, root, command, terminal)
  if (argv === undefined) return host.toast('session-info: no terminal emulator found to open the Git client.')
  launch(host, argv, platform === 'linux' ? root : undefined)
}
