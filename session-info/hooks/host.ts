import type { FileChange, InlineDiff } from '../types'

/** What the helper modules need from the engine; register.tsx builds it from `$`, which never crosses an import. */
export type Host = {
  run: (argv: string[], cwd?: string) => Promise<{ exitCode: number; stdout: string; isStdoutTruncated?: boolean }>
  spawn: (argv: string[], cwd?: string) => AsyncIterable<{ stream: string; text: string }>
  readFile: (path: string) => Promise<string>
  writeFile: (path: string, text: string) => Promise<void>
  exists: (path: string) => Promise<boolean>
  env: () => Promise<{ temp?: string; tmpdir?: string; os?: string; home?: string }>
  sessionId: () => Promise<string>
  cwd: () => Promise<string>
  toast: (text: string) => void
  files: () => Promise<Record<string, FileChange>>
  updateFiles: (fn: (all: Record<string, FileChange>) => Record<string, FileChange>) => Promise<void>
  showInline: (diff: InlineDiff) => Promise<void>
  sleep: (ms: number) => Promise<void>
  clear: () => Promise<void>
  readBox: () => Promise<string>
  fill: (text: string) => Promise<void>
}
