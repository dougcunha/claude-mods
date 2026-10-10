export type ChangeStatus = 'created' | 'modified' | 'deleted'

/** One file the session touched; `base` is the snapshot of its content before the first touch, null when unknown. */
export type FileChange = { path: string; status: ChangeStatus; base: string | null; at: number }

/** A diff drawn inside the pane, for the inline viewer or when no external one is found. */
export type InlineDiff = { path: string; source: string }

declare module 'claude-code' {
  interface PluginState {
    'session-changes': {
      files: Record<string, FileChange>
      collapsed: string[]
      inline: InlineDiff | null
    }
  }
}
