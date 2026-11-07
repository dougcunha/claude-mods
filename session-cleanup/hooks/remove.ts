import { baseName, isUnder, keyOf, nativeOf, norm } from './paths'

/** The operating systems the mod tells apart for the commands it starts. */
export type Platform = 'windows' | 'mac' | 'linux'

/** How the mod removes what the person chose. */
export type RemoveMode = 'trash' | 'quarantine' | 'delete'

/** One day in milliseconds. */
const DAY_MS = 86_400_000

/** A PowerShell string literal: single quotes, with each quote doubled. */
const psQuote = (text: string): string => `'${text.replace(/'/g, "''")}'`

/** A text inside an AppleScript string literal. */
const appleQuote = (text: string): string => `"${text.replace(/["\\]/g, '\\$&')}"`

const powershell = (script: string): string[] => ['powershell', '-NoProfile', '-NonInteractive', '-Command', script]

/** The argv that sends a path to the system trash (the Recycle Bin on Windows). */
export function trashArgv(platform: Platform, path: string, isFolder: boolean): string[] {
  if (platform === 'windows') {
    const call = isFolder ? 'DeleteDirectory' : 'DeleteFile'
    return powershell(
      `Add-Type -AssemblyName Microsoft.VisualBasic; [Microsoft.VisualBasic.FileIO.FileSystem]::${call}(${psQuote(nativeOf(path, true))}, 'OnlyErrorDialogs', 'SendToRecycleBin')`,
    )
  }
  if (platform === 'mac') return ['osascript', '-e', `tell application "Finder" to delete POSIX file ${appleQuote(norm(path))}`]

  return ['gio', 'trash', '--', norm(path)]
}

/** The argv that moves a path to `dest`. */
export function moveArgv(platform: Platform, path: string, dest: string): string[] {
  if (platform === 'windows') return powershell(`Move-Item -LiteralPath ${psQuote(nativeOf(path, true))} -Destination ${psQuote(nativeOf(dest, true))} -Force`)

  return ['mv', '--', norm(path), norm(dest)]
}

/** The argv that deletes a path for good, a folder with all it holds. */
export function deleteArgv(platform: Platform, path: string): string[] {
  if (platform === 'windows') return powershell(`Remove-Item -LiteralPath ${psQuote(nativeOf(path, true))} -Recurse -Force`)

  return ['rm', '-rf', '--', norm(path)]
}

/** The quarantine folder under the home folder. */
export const quarantineRoot = (home: string): string => `${norm(home)}/.claude/cleanup-quarantine`

/** The folder of one run: its name is the time of the run, so its age is read from the name. */
export const runFolder = (root: string, now: number): string => `${norm(root)}/${now}`

/** Where entry `index` of a run goes: a number in front keeps two equal base names apart. */
export const quarantinedPath = (run: string, index: number, path: string): string => `${run}/${index + 1}-${baseName(path)}`

/** The manifest of a run: where each entry came from. */
export const manifestOf = (now: number, moves: { from: string; to: string }[]): string => `${JSON.stringify({ at: new Date(now).toISOString(), moves }, null, 2)}\n`

/** The run folders older than `days`, as paths under `root`; a name that is not a time stays. */
export function expiredRuns(root: string, names: string[], now: number, days: number): string[] {
  return names.filter(name => /^\d{13}$/.test(name) && now - Number(name) > days * DAY_MS).map(name => `${norm(root)}/${name}`)
}

/** Whether the mod may delete `path` while it purges: strictly under the quarantine root. */
export const isPurgeable = (root: string, path: string): boolean => isUnder(root, path) && keyOf(root) !== keyOf(path)
