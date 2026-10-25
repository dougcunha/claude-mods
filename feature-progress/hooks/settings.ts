import type { IconSet } from './icons'

/** The program that opens a task link. */
export type Editor = 'auto' | 'vscode' | 'system'

/** The settings the mod reads once per load; a change in the config menu reloads the module. */
export type Settings = { folder: string; staleMinutes: number; editor: Editor; showBand: boolean; paneBackground: string; icons: IconSet }

/** The folder of the feature files when the setting is empty; the same default as `plugin.json`. */
export const DEFAULT_FOLDER = '.claude/feature-progress/'

/** Minutes without a report before an open feature is stale; the same default as `plugin.json`. */
export const DEFAULT_STALE_MINUTES = 30

/** The program that opens a task link; the same default as `plugin.json`. */
export const DEFAULT_EDITOR: Editor = 'auto'

/** Whether the band shows above the prompt; the same default as `plugin.json`. */
export const DEFAULT_SHOW_BAND = true

/** The icon set of the states; the same default as `plugin.json`. */
export const DEFAULT_ICONS: IconSet = 'unicode'

/** The settings from `options`, with the manifest defaults for a missing or broken value. */
export function settingsOf(options: Record<string, unknown>): Settings {
  const folder = typeof options.folder === 'string' && options.folder.trim() !== '' ? options.folder : DEFAULT_FOLDER
  const minutes = options.staleMinutes
  const staleMinutes = typeof minutes === 'number' && Number.isFinite(minutes) && minutes >= 0 ? minutes : DEFAULT_STALE_MINUTES
  const editor = options.editor === 'vscode' || options.editor === 'system' ? options.editor : DEFAULT_EDITOR
  const showBand = typeof options.showBand === 'boolean' ? options.showBand : DEFAULT_SHOW_BAND
  const paneBackground = typeof options.paneBackground === 'string' ? options.paneBackground.trim() : ''
  const icons = options.icons === 'nerd' || options.icons === 'emoji' ? options.icons : DEFAULT_ICONS

  return { folder, staleMinutes, editor, showBand, paneBackground, icons }
}
