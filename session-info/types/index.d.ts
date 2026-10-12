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
 * A file `git status` lists, relative to the repository root. `xy` is the porcelain code: the index letter, then
 * the working-tree letter, `.` for no change, `??` for an untracked file; `from` is the old path of a rename.
 */
export type RepoFile = { path: string; xy: string; from?: string }

/**
 * The repository of the session's folder, as the Git section draws it.
 * `branch` is null on a detached HEAD; `head` is the short hash, null before the first commit.
 * `files` holds up to the first 500 changed files; `fileCount` is how many git listed.
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
  files: RepoFile[]
  fileCount: number
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

/** One skill the session loaded, by the Skill tool or a slash command; `agentId` is absent for the main conversation. */
export type SkillUse = { name: string; agentId?: string; at: number; isActive: boolean }

/** A GitHub Actions job as `gh run view --json jobs` reports it; `conclusion` is '' until the job completes. */
export type CiJob = { name: string; status: string; conclusion: string }

/** A GitHub Actions run as `gh` reports it; times in epoch milliseconds. */
export type CiRun = {
  id: number
  workflow: string
  title: string
  branch: string
  sha: string
  status: string
  conclusion: string
  url: string
  createdAt: number
  updatedAt: number
  jobs: CiJob[]
}

export type CiTriggerKind = 'push' | 'pr' | 'workflow' | 'rerun'

/**
 * The runs the CI section follows: those of the last push, pull request, workflow dispatch or rerun of the session.
 * `sha` finds a push's runs; `runIds` names the runs a dispatch or rerun started; `error` stops the polling.
 */
export type CiWatch = {
  trigger: CiTriggerKind
  since: number
  sha?: string
  branch?: string
  runIds: number[]
  runs: CiRun[]
  error?: string
}

/**
 * A Jira issue the conversation mentioned, as the Atlassian MCP server read it.
 * `readAt` is absent while the read runs; `error` holds why it failed; `updated` in epoch milliseconds.
 */
export type JiraIssue = {
  key: string
  at: number
  readAt?: number
  summary?: string
  status?: string
  priority?: string
  assignee?: string
  updated?: number
  url?: string
  error?: string
  /** The tool a permission check refused to the mod's read, which an allow rule would let through. */
  blockedTool?: string
}

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
      /** The skills loaded in this conversation, newest first. */
      skills: SkillUse[]
      /** The GitHub Actions runs the session started last; null before the first push or dispatch. */
      ci: CiWatch | null
      /** The MCP server that serves getJiraIssue, as its tools spell it; null while none is connected. */
      jiraServer: string | null
      /** The Jira issues the conversation mentioned, the last one first. */
      jiraIssues: JiraIssue[]
      /** The active tab of each tab group, as `{ '#repo': '#changes' }`; a group not in it opens on its default tab. */
      tabs: Record<string, string>
    }
  }
}
