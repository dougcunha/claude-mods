import type { Host } from './host'
import { absolute, baseName, hash, keyOf, norm, relativeTo } from './paths'

/** `git status` of the repository, path (relative to `root`) to its two-letter code. */
export type GitStatus = { root: string; entries: Map<string, string> }

let repoRoot: string | null | undefined
let snapshotDir: string | undefined

async function rootOf(host: Host): Promise<string | null> {
  if (repoRoot !== undefined) return repoRoot
  const run = await host.run(['git', 'rev-parse', '--show-toplevel'])
  repoRoot = run.exitCode === 0 ? norm(run.stdout.trim()) : null

  return repoRoot
}

export async function gitStatus(host: Host): Promise<GitStatus | undefined> {
  const root = await rootOf(host)
  if (root === null) return undefined
  const run = await host.run(['git', 'status', '--porcelain=v1', '-z', '--untracked-files=all'], root)
  if (run.exitCode !== 0) return undefined

  const entries = new Map<string, string>()
  const fields = run.stdout.split('\0')
  for (let i = 0; i < fields.length; i++) {
    const field = fields[i] ?? ''
    if (field.length < 4) continue
    entries.set(field.slice(3), field.slice(0, 2))
    if (field[0] === 'R' || field[0] === 'C') i++
  }

  return { root, entries }
}

export const pathIn = (status: GitStatus, relative: string): string => absolute(status.root, relative)

/** The file's text at HEAD, or undefined outside a repository or for a file HEAD lacks. */
export async function headText(host: Host, path: string): Promise<string | undefined> {
  const root = await rootOf(host)
  if (root === null) return undefined
  const run = await host.run(['git', 'show', `HEAD:${relativeTo(root, path)}`], root)

  return run.exitCode === 0 ? run.stdout : undefined
}

async function dir(host: Host): Promise<string> {
  if (snapshotDir !== undefined) return snapshotDir
  const env = await host.env()
  const temp = env.temp ?? env.tmpdir ?? '/tmp'
  snapshotDir = `${norm(temp)}/claude-session-info/${await host.sessionId()}`

  return snapshotDir
}

/** Writes the text a file had before the session touched it; the file keeps its name, so a viewer highlights it. */
export async function snapshot(host: Host, path: string, text: string): Promise<string> {
  const file = `${await dir(host)}/${hash(keyOf(path))}/${baseName(path)}`
  await host.writeFile(file, text)

  return file
}

export async function emptyFile(host: Host, path: string): Promise<string> {
  const file = `${await dir(host)}/empty/${baseName(path)}`
  if (!(await host.exists(file))) await host.writeFile(file, '')

  return file
}
