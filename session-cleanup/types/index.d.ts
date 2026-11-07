/** Where the mod learned that the session created a path. */
export type CreatedSource = 'session-info' | 'shell'

/** A path the session created, as the mod collected it. */
export type Created = { path: string; isFolder: boolean; source: CreatedSource; at: number }

/** One entry of the Files section. */
export type FileItem = {
  id: string
  path: string
  isFolder: boolean
  /** Bytes; for a folder, a sum that stops after a fixed count of entries. */
  size: number
  isSizeAtLeast: boolean
  /** Why the entry is listed and how it was judged, such as `temp folder` or `untracked in claude-mods`. */
  tags: string[]
  /** Pre-selected: it is in a temp folder, has a temporary name or lies outside every repository. */
  isLikelyTemp: boolean
  /** Only the temp folder scan found it: other programs write there too. */
  isOther: boolean
  /** For a row that stands for several entries of one folder: the entries; `path` is then the folder, never removed itself. */
  members?: { path: string; isFolder: boolean }[]
}

/** One entry of the Git section. */
export type GitItem = { id: string; repo: string; text: string }

/** What the last scan found. */
export type Scan = { files: FileItem[]; git: GitItem[]; at: number }

declare module 'claude-code' {
  interface PluginState {
    'session-cleanup': {
      /** The paths the session created, by path key; kept across /clear. */
      created: Shaped<Record<string, Created>>
      /** When the mod first loaded in this process, in milliseconds. */
      since: number
      /** Every session id of this process, to find each one's scratchpad folder. */
      sessionIds: string[]
      scan: Shaped<Scan | null>
      selected: string[]
      isBusy: boolean
      /** The result line of the last action, or the error. */
      message: string
    }
  }
}
