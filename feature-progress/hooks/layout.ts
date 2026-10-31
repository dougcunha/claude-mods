import type { CommandPresentation } from 'claude-code'

/** Terminal columns from which the fullscreen layout docks a pane beside the transcript. */
export const DOCK_COLUMNS = 110

/**
 * Why the pane will not dock beside the chat, as a toast for the person; undefined when it docks or the layout is unknown.
 * The main screen places every pane inline above the prompt; the fullscreen layout docks one from DOCK_COLUMNS columns.
 * A mod cannot switch the layout: Claude Code picks it as it starts.
 */
export function dockHint(plugin: string, presentation: CommandPresentation | undefined): string | undefined {
  if (presentation === undefined) return undefined
  if (!presentation.isFullscreen) {
    return `${plugin}: the pane opens above the prompt. To dock it beside the chat, start Claude Code in the fullscreen layout (CLAUDE_CODE_NO_FLICKER=1).`
  }
  if (presentation.columns < DOCK_COLUMNS) {
    return `${plugin}: the pane opens above the prompt. Widen the terminal to ${DOCK_COLUMNS} columns to dock it beside the chat.`
  }

  return undefined
}
