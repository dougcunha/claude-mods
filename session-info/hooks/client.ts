import type { Host } from './host'
import { launch, platformOf, succeeds } from './viewer'
import type { Platform } from './viewer'

/** Terminal emulators tried in order on Linux, each with the flag that runs a command in it. */
const TERMINALS: readonly (readonly [string, string])[] = [
  ['x-terminal-emulator', '-e'],
  ['gnome-terminal', '--'],
  ['konsole', '-e'],
  ['xterm', '-e'],
]

/** Splits a command line on spaces; double quotes keep a path with spaces in one piece. */
export function splitCommand(line: string): string[] {
  return [...line.matchAll(/"([^"]*)"|(\S+)/g)].map(match => match[1] ?? match[2] ?? '')
}

const shellQuote = (text: string): string => `'${text.replace(/'/g, `'\\''`)}'`

const appleString = (text: string): string => `"${text.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`

/**
 * The argv that opens the client in a new terminal window, in the repository's root.
 * Windows: `start` opens the default terminal, Windows Terminal on Windows 11; its quoted title comes first.
 * macOS: Terminal.app through AppleScript. Linux: the first terminal emulator found, given by the caller.
 */
export function clientArgv(platform: Platform, root: string, command: readonly string[], terminal?: readonly string[]): string[] | undefined {
  if (platform === 'windows') return ['cmd', '/c', 'start', 'Git client', '/D', root.replace(/\//g, '\\'), ...command]
  if (platform === 'mac') {
    const script = `cd ${shellQuote(root)} && ${command.map(shellQuote).join(' ')}`

    return ['osascript', '-e', `tell application "Terminal" to do script ${appleString(script)}`, '-e', 'tell application "Terminal" to activate']
  }

  return terminal === undefined ? undefined : [...terminal, ...command]
}

async function linuxTerminal(host: Host): Promise<readonly string[] | undefined> {
  for (const terminal of TERMINALS) if (await succeeds(host, ['which', terminal[0]])) return terminal

  return undefined
}

/** Opens the configured Git client in a new terminal window; a toast says why when it cannot. */
export async function openClient(host: Host, root: string, line: string): Promise<void> {
  const command = splitCommand(line)
  const program = command[0]
  if (program === undefined) return

  const platform = await platformOf(host)
  const isFound = /[\\/]/.test(program)
    ? await host.exists(program)
    : await succeeds(host, [platform === 'windows' ? 'where' : 'which', program])
  if (!isFound) return host.toast(`session-info: ${program} is not on the PATH. Set the Git client in /config.`)

  const terminal = platform === 'linux' ? await linuxTerminal(host) : undefined
  const argv = clientArgv(platform, root, command, terminal)
  if (argv === undefined) return host.toast('session-info: no terminal emulator found to open the Git client.')
  launch(host, argv, platform === 'linux' ? root : undefined)
}
