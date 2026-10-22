/** What the helper modules need from the engine; register.tsx builds it from `$`, which never crosses an import. */
export type Host = {
  run: (argv: string[], cwd?: string) => Promise<{ exitCode: number; stdout: string; isStdoutTruncated?: boolean }>
  cwd: () => Promise<string>
  /** A file's text; rejects when the file is missing or over 4 MiB. */
  readFile: (path: string) => Promise<string>
  /** Writes a file, creating its folders. */
  writeFile: (path: string, text: string) => Promise<void>
  /** The temporary directories the environment names, and `OS` (`Windows_NT` on Windows). */
  env: () => Promise<{ temp?: string; tmpdir?: string; os?: string }>
  sessionId: () => Promise<string>
  storeGet: (key: string) => Promise<unknown>
  storeSet: (key: string, value: unknown) => Promise<void>
  storeKeys: () => Promise<string[]>
  storeDelete: (key: string) => Promise<void>
}
