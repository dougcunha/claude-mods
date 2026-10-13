export type SectionKey = '#session' | '#turn' | '#todos' | '#skills' | '#ci' | '#jira' | '#usage' | '#agents' | '#checks' | '#git' | '#changes'

/** Sections that share one card as tabs; `key` folds the group and holds its active tab, the first member opens. */
export type TabGroup = { key: string; members: SectionKey[] }

/** Sections in the order the pane draws them. */
export const ORDER: readonly SectionKey[] = ['#session', '#turn', '#todos', '#skills', '#ci', '#jira', '#usage', '#agents', '#checks', '#git', '#changes']

/** The title a tab shows while another tab of its group is active. */
export const TITLES: Record<SectionKey, string> = {
  '#session': 'Session',
  '#turn': 'Last turn',
  '#todos': 'Todos',
  '#skills': 'Skills',
  '#ci': 'CI',
  '#jira': 'Jira',
  '#usage': 'Usage',
  '#agents': 'Agents',
  '#checks': 'Checks',
  '#git': 'Git',
  '#changes': 'Changes',
}

/** The names `tabGroups` takes, in lower case: the suffixes of the `show*` options. */
const SECTION_NAMES: Record<string, SectionKey> = {
  session: '#session',
  lastturn: '#turn',
  todos: '#todos',
  skills: '#skills',
  ci: '#ci',
  jira: '#jira',
  usage: '#usage',
  agents: '#agents',
  checks: '#checks',
  git: '#git',
  changes: '#changes',
}

const DEFAULT_TAB_GROUPS = 'changes+git'

/**
 * `changes+git, ci+jira+skills`: groups split by commas or semicolons, members by `+`. An unknown name, a section
 * already in a group and a group left with one member drop out.
 */
export function parseTabGroups(value: unknown): TabGroup[] {
  const text = typeof value === 'string' ? value : DEFAULT_TAB_GROUPS
  const taken = new Set<SectionKey>()
  const groups: TabGroup[] = []
  for (const part of text.split(/[,;]/)) {
    const members: SectionKey[] = []
    for (const name of part.split('+')) {
      const key = SECTION_NAMES[name.trim().toLowerCase()]
      if (key !== undefined && !taken.has(key) && !members.includes(key)) members.push(key)
    }
    if (members.length < 2) continue
    for (const key of members) taken.add(key)
    groups.push({ key: `#${members.map(key => key.slice(1)).join('+')}`, members })
  }

  return groups
}

/**
 * `changes, git, session`: the sections named first, in that order, then the others in the default order. Names split
 * by commas, semicolons or `+`, so a tab group pasted whole counts too; an unknown name and a repeat drop out.
 */
export function parseSectionOrder(value: unknown): SectionKey[] {
  const text = typeof value === 'string' ? value : ''
  const named = text.split(/[,;+]/).flatMap(name => SECTION_NAMES[name.trim().toLowerCase()] ?? [])

  return [...new Set([...named, ...ORDER])]
}
