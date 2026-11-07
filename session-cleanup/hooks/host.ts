import type { Platform } from './remove'

/** One entry of a folder listing. */
export type Entry = { name: string; kind: string; size: number; mtimeMs: number }

/** The environment variables the mod reads; `$.env.get` takes only literal names. */
export type Env = {
  home?: string
  /** The system temp folders: TEMP, TMP and TMPDIR, each once. */
  temps: string[]
  /** Variables a shell command may name in a path, by upper-case name. */
  vars: Record<string, string>
  platform: Platform
}

/** What the helper modules need from the engine; register.tsx builds it from `$`, which never crosses an import. */
export type Host = {
  /** Runs a program with its arguments as separate values; rejects when it cannot start. */
  run: (argv: string[], cwd?: string) => Promise<{ exitCode: number; stdout: string; stderr?: string }>
  cwd: () => Promise<string>
  exists: (path: string) => Promise<boolean>
  /** Rejects when the path is missing. */
  stat: (path: string) => Promise<{ kind: string; size: number; mtimeMs: number }>
  /** Rejects when the folder is missing. */
  list: (path: string) => Promise<Entry[]>
  /** Writes a file, creating its folders. */
  writeFile: (path: string, text: string) => Promise<void>
}
