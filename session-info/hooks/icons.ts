import type { ChangeStatus } from '../types'

export type IconSet = 'unicode' | 'nerd' | 'emoji'

export const STATUS = {
  created: { glyph: '✚', letter: 'A', color: 'success' },
  modified: { glyph: '●', letter: 'M', color: 'warning' },
  deleted: { glyph: '✖', letter: 'D', color: 'error' },
} as const satisfies Record<ChangeStatus, { glyph: string; letter: string; color: string }>

const NERD: Record<string, string> = {
  cs: '', csproj: '', sln: '', ts: '', tsx: '', js: '', jsx: '',
  json: '', md: '', py: '', rs: '', go: '', html: '', css: '',
  xaml: '', xml: '', yml: '', yaml: '', toml: '', ps1: '', sh: '',
}

const EMOJI: Record<string, string> = {
  md: '📝', txt: '📝', json: '🔧', yml: '🔧', yaml: '🔧', toml: '🔧', xml: '🔧', csproj: '🔧', sln: '🔧',
  props: '🔧', css: '🎨', scss: '🎨', xaml: '🎨', html: '🎨', py: '🐍', rs: '🦀', java: '☕', ps1: '💻', sh: '💻',
}

const extension = (name: string): string => name.slice(name.lastIndexOf('.') + 1).toLowerCase()

const isTest = (name: string): boolean => /(\.|_)(test|tests|spec)\.|Tests?\.cs$/i.test(name)

export function folderIcon(set: IconSet, isOpen: boolean): string {
  if (set === 'nerd') return isOpen ? '' : ''
  if (set === 'emoji') return isOpen ? '📂' : '📁'

  return isOpen ? '▾' : '▸'
}

/** The file's type icon, or the status glyph where the set has no type icons. */
export function fileIcon(set: IconSet, name: string, status: ChangeStatus): string {
  if (set === 'nerd') return NERD[extension(name)] ?? ''
  if (set === 'emoji') return isTest(name) ? '🧪' : (EMOJI[extension(name)] ?? '📄')

  return STATUS[status].glyph
}
