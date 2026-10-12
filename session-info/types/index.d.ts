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

export type SubmoduleIssue = 'conflict' | 'uninitialized' | 'commit' | 'modified'

/** A submodule that needs a look: its path in the repository and what is wrong with it. */
export type Submodule = { path: string; issues: SubmoduleIssue[] }

/** `none`: the branch has no upstream (local only); `gone`: the upstream was deleted on the remote. */
export type Upstream = 'none' | 'gone' | { ahead: number; behind: number }

export type Operation = { kind: 'merge' | 'rebase' | 'cherry-pick' | 'revert' | 'bisect'; step?: number; total?: number }

/**
 * The repository of the session's folder, as the Git section draws it.
 * `branch` is null on a detached HEAD; `head` is the short hash, null before the first commit.
 */
export type Repo = {
  root: string
  branch: string | null
  head: string | null
  upstream: Upstream
  counts: { staged: number; modified: number; untracked: number; conflicts: number }
  commit: { hash: string; subject: string; at: number } | null
  operation: Operation | null
  submodules: { total: number; changed: Submodule[] }
  at: number
}

/** One row of the context breakdown as the bar draws it: `used` content, the `free` window or the compaction `buffer`. */
export type ContextSlice = { name: string; tokens: number; kind: 'used' | 'free' | 'buffer'; color: string }

/** The context window by category, read after each turn; `compactsAt` is absent when auto-compaction is off. */
export type ContextReading = { slices: ContextSlice[]; total: number; window: number; compactsAt?: number }

export type TurnReason = 'answer' | 'aborted' | 'refusal' | 'error'

/** Token counts the API reported, summed over the requests of a turn. */
export type TurnTokens = { input: number; output: number; cacheRead: number; cacheWrite: number }

/**
 * The last main-thread turn, as the Last turn section draws it.
 * `requests`, `effort` and `tools` are absent when the mod loaded while the turn ran;
 * `costUsd` is absent when the session reports no cost.
 */
export type TurnRecord = {
  at: number
  durationMs: number
  reason: TurnReason
  model?: string
  effort?: string
  requests?: number
  tokens: TurnTokens | null
  tools?: Record<string, number>
  subagents: { count: number; tokens: number }
  costUsd?: number
}

export type TodoStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled'

/** One task of the list the model writes with the mod's todo_write tool; `activeForm` is the task as it runs. */
export type Todo = { content: string; status: TodoStatus; activeForm?: string }

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
      /** The context window by category, for the stacked bar and its legend; null before the first read. */
      context: ContextReading | null
      /** Alert thresholds already notified: `<window>@<resetsAt>:<threshold>` or `context:<threshold>`. */
      alerted: string[]
      /** The last build and the last test run of the session. */
      checks: Checks
      /** The repository the Git section shows; `outside` when the folder is in none, null before the first read. */
      repo: Repo | 'outside' | null
      /** The last main-thread turn; null before the first one ends. */
      lastTurn: TurnRecord | null
      /** The task list of the main conversation, as its last todo_write call sent it. */
      todos: Todo[]
    }
  }
}
