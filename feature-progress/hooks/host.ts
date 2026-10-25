/** One entry of a folder listing. */
export type FolderEntry = { name: string; kind: string }

/** What the helper modules need from the engine; register.tsx builds it from `$`, which never crosses an import. */
export type Host = {
  /** Runs a program with its arguments as separate values; `cwd` is an absolute folder. */
  run: (argv: string[], cwd?: string) => Promise<{ exitCode: number; stdout: string }>
  /** The session's working directory. */
  cwd: () => Promise<string>
  /** A file's text; rejects when the file is missing or over 4 MiB. */
  readFile: (path: string) => Promise<string>
  /** Writes a file, creating its folders. */
  writeFile: (path: string, text: string) => Promise<void>
  /** The entries of a folder; rejects when the folder is missing. */
  list: (path: string) => Promise<FolderEntry[]>
  /** Whether a path exists. */
  exists: (path: string) => Promise<boolean>
  /** `OS` as the environment names it (`Windows_NT` on Windows). */
  env: () => Promise<{ os?: string }>
  toast: (text: string) => void
}
