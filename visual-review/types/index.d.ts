/** A /visual-review run that waits for its design model: the run id, the base commit and its label, the repository, its branch and the changed paths. */
export type PendingRun = { runId: string; base: string; baseLabel: string; root: string; branch: string; files: string[]; analysisTurnId?: string }

declare module 'claude-code' {
  interface PluginState {
    'visual-review': {
      /** The run that waits for its design model, or null; a /clear resets it, which cancels the run. */
      pendingRun: PendingRun | null
    }
  }
}
