export type SectionKey = '#session' | '#turn' | '#todos' | '#autopick' | '#skills' | '#ci' | '#jira' | '#usage' | '#agents' | '#checks' | '#git' | '#changes'

/** Sections that share one card as tabs; `key` folds the group and holds its active tab, the first member opens. */
export type TabGroup = { key: string; members: SectionKey[] }

/** Sections in the order the pane draws them. */
export const ORDER: readonly SectionKey[] = ['#session', '#turn', '#todos', '#autopick', '#skills', '#ci', '#jira', '#usage', '#agents', '#checks', '#git', '#changes']

/** The title a tab shows while another tab of its group is active. */
export const TITLES: Record<SectionKey, string> = {
  '#session': 'Session',
  '#turn': 'Last turn',
  '#todos': 'Todos',
  '#autopick': 'Autopick',
  '#skills': 'Skills',
  '#ci': 'CI',
  '#jira': 'Jira',
  '#usage': 'Usage',
  '#agents': 'Agents',
  '#checks': 'Checks',
  '#git': 'Git',
  '#changes': 'Changes',
}

/** The name of each section in `tabGroups` and `sectionOrder`, as the settings spell it. */
export const NAMES: Record<SectionKey, string> = {
  '#session': 'session',
  '#turn': 'lastTurn',
  '#todos': 'todos',
  '#autopick': 'autopick',
  '#skills': 'skills',
  '#ci': 'ci',
  '#jira': 'jira',
  '#usage': 'usage',
  '#agents': 'agents',
  '#checks': 'checks',
  '#git': 'git',
  '#changes': 'changes',
}

/** The `userConfig` field that shows or hides each section: `show` and the name with its first letter upper case. */
export const showOption = (key: SectionKey): string => `show${NAMES[key].charAt(0).toUpperCase()}${NAMES[key].slice(1)}`

/** The names `tabGroups` takes, in lower case: the suffixes of the `show*` options. */
const SECTION_NAMES: Record<string, SectionKey> = {
  session: '#session',
  lastturn: '#turn',
  todos: '#todos',
  autopick: '#autopick',
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

/** The order as `sectionOrder` takes it: `session, lastTurn, todos`. */
export const orderText = (order: readonly SectionKey[]): string => order.map(key => NAMES[key]).join(', ')

/**
 * The order with the card of `key` moved one card up or down. A card is a section, or a tab group as a whole, and sits
 * where its first shown section sits, as the pane draws it; it swaps with the nearest shown card in that direction, and
 * hidden sections keep their places. The order is unchanged when no shown card is there.
 */
export function moveCard(order: readonly SectionKey[], groups: readonly TabGroup[], isShown: (key: SectionKey) => boolean, key: SectionKey, direction: 1 | -1): SectionKey[] {
  const groupOf = (one: SectionKey) => groups.find(group => group.members.includes(one))
  // Each card once, at its first shown section, or at its first section when none shows.
  const anchorOf = (one: SectionKey): SectionKey => {
    const members = groupOf(one)?.members ?? [one]

    return order.find(other => members.includes(other) && isShown(other)) ?? order.find(other => members.includes(other)) ?? one
  }
  const cards = order.filter(one => anchorOf(one) === one).map(anchor => groupOf(anchor)?.members ?? [anchor])
  const at = cards.findIndex(card => card.includes(key))
  let to = at + direction
  while (to >= 0 && to < cards.length && !cards[to]?.some(isShown)) to += direction
  const moving = cards[at]
  const other = cards[to]
  if (at < 0 || moving === undefined || other === undefined) return [...order]
  cards[at] = other
  cards[to] = moving
  // A card's sections keep their own relative order.
  const rank = (one: SectionKey) => order.indexOf(one)

  return cards.flatMap(card => [...card].sort((a, b) => rank(a) - rank(b)))
}
