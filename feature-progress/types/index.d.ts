/** The 9 states a feature or a task takes; the kind sets the glyph, the word, the color and the order. */
export type Kind = 'pending' | 'planning' | 'active' | 'review' | 'fixing' | 'qa' | 'waiting' | 'blocked' | 'done'

/** Sub-steps of a task: `done` out of `total`. */
export type Steps = { done: number; total: number }

/** One task of a feature as stored: the fields the flow sent plus the timestamps the mod sets (ISO 8601). */
export type Task = {
  id: string
  title: string
  state: Kind
  label?: string
  round?: number
  group?: string
  steps?: Steps
  note?: string
  link?: string
  startedAt?: string
  updatedAt: string
  finishedAt?: string
}

/** One feature as stored in `<folder>/<id>.json`. */
export type Feature = {
  schemaVersion: 1
  id: string
  title: string
  state: Kind
  label?: string
  round?: number
  note?: string
  startedAt?: string
  updatedAt: string
  finishedAt?: string
  tasks: Task[]
}

declare module 'claude-code' {
  interface PluginState {
    'feature-progress': {
      /** The loaded and reported features by id; a /clear or /resume empties it until the mod reads the folder again. */
      features: Record<string, Feature>
      /** Paths of stored files the mod could not read as a feature. */
      warnings: string[]
      /** Feature ids, and `done` for the Done section, whose open or closed state the person flipped in the pane. */
      toggled: string[]
    }
  }
}
