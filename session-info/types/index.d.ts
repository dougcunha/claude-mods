export type ChangeStatus = 'created' | 'modified' | 'deleted'

/** One file the session touched; `base` is the snapshot of its content before the first touch, null when unknown. */
export type FileChange = { path: string; status: ChangeStatus; base: string | null; at: number }

/** A diff drawn inside the pane, for the inline viewer or when no external one is found. */
export type InlineDiff = { path: string; source: string }

export type CheckKind = 'build' | 'test'

export type CheckStatus = 'passed' | 'failed' | 'running'

/**
 * A build or test command the session ran: its status, and what its output said.
 * `errors` holds the first error lines of a failed run; `failures` the names of the failed tests.
 */
export type CheckRun = {
  kind: CheckKind
  status: CheckStatus
  command: string
  at: number
  isAgent: boolean
  errors: string[]
  errorCount?: number
  passed?: number
  failed?: number
  skipped?: number
  total?: number
  failures: string[]
}

export type Checks = { build: CheckRun | null; test: CheckRun | null }

declare module 'claude-code' {
  interface PluginState {
    'session-info': {
      files: Record<string, FileChange>
      /** Folded folders by tree key, and folded sections as `#usage` / `#changes`. */
      collapsed: string[]
      inline: InlineDiff | null
      /** When the usage section last had reason to redraw: a new measurement or the minute tick. */
      now: number
      /** Main-thread turns: how many, their summed output tokens, and the last one's duration. */
      turns: { count: number; outputTokens: number; lastMs: number }
      /** Compactions that went through this session. */
      compactions: number
      /** Whether the context breakdown by category is unfolded. */
      breakdown: boolean
      /** Alert thresholds already notified: `<window>@<resetsAt>:<threshold>` or `context:<threshold>`. */
      alerted: string[]
      /** The last build and the last test run of the session. */
      checks: Checks
    }
  }
}
