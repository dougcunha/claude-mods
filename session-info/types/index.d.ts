export type ChangeStatus = 'created' | 'modified' | 'deleted'

/** One file the session touched; `base` is the snapshot of its content before the first touch, null when unknown. */
export type FileChange = { path: string; status: ChangeStatus; base: string | null; at: number }

/** A diff drawn inside the pane, for the inline viewer or when no external one is found. */
export type InlineDiff = { path: string; source: string }

declare module 'claude-code' {
  interface PluginState {
    'session-info': {
      files: Record<string, FileChange>
      /** Folded folders by tree key, and folded sections as `#usage` / `#changes`. */
      collapsed: string[]
      inline: InlineDiff | null
      /** When the usage section last had reason to redraw: a new measurement or the minute tick. */
      now: number
    }
  }
}
