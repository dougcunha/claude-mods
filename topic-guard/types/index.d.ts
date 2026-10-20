/** What the judging model said about a message it found off the session's topic, and how full the context was then. */
export type Verdict = { reason: string; percent: number }

/** A message the mod held back because it looks like a new topic, waiting for the person's choice. */
export type Held = Verdict & { text: string }

declare module 'claude-code' {
  interface PluginState {
    'topic-guard': {
      /** The held message the band offers to move, or null. */
      held: Held | null
      /** The context percent at which the person kept a new topic in this session, or null. */
      keptAt: number | null
      /** True while New session clears the session. */
      isBusy: boolean
      /** True after the toast that says the Jev MCP could not judge; it clears when Jev judges again, so one outage warns once. */
      isJevDown: boolean
    }
  }
}
