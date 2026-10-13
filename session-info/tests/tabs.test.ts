import { expect, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

import { ORDER, parseSectionOrder, parseTabGroups } from '../hooks/tabs'

const PANE = {
  plugin: 'session-info',
  component: 'Pane',
  requestId: 'session-info',
  props: { title: 'Session info', isFocused: true, bodyColumns: 80 },
} as const

const NO_SKILLS = 'No skill loaded in this conversation yet.'
const NO_TODOS = 'No task list yet. Claude writes one for work with several steps.'

const pane = (on: Parameters<TestBody>[1]) => {
  on('session.cwd', async () => ({ value: '/repo' }))
  on('agent.list', async () => ({ value: [] }))
  on('session.usage', async () => ({ value: { startedAt: 0, rateLimits: [], context: { window: 200_000 } } }) as never)
  on('skill.prompt', async (_, e) => ({ text: e.text }))
}

test('tab groups parse names in any case and drop unknown names, repeats and groups of one', async () => {
  expect(parseTabGroups(undefined)).toEqual([{ key: '#changes+git', members: ['#changes', '#git'] }])
  expect(parseTabGroups('')).toEqual([])
  expect(parseTabGroups(' CI + jira + Skills ; lastTurn+todos')).toEqual([
    { key: '#ci+jira+skills', members: ['#ci', '#jira', '#skills'] },
    { key: '#turn+todos', members: ['#turn', '#todos'] },
  ])
  expect(parseTabGroups('git+nope, git+changes, usage, agents+agents')).toEqual([{ key: '#git+changes', members: ['#git', '#changes'] }])
})

test('the section order puts the named sections first and the others after them in the default order', async () => {
  expect(parseSectionOrder(undefined)).toEqual(ORDER)
  expect(parseSectionOrder('')).toEqual(ORDER)
  // The value /config starts with names every section in the default order.
  expect(parseSectionOrder('session, lastTurn, todos, skills, ci, jira, usage, agents, checks, git, changes')).toEqual(ORDER)
  expect(parseSectionOrder(' Agents ; nope, git+changes, agents, LastTurn')).toEqual([
    '#agents', '#git', '#changes', '#turn', '#session', '#todos', '#skills', '#ci', '#jira', '#usage', '#checks',
  ])
})

test('a tab group card sits where its first shown section sits in the section order', { options: { sectionOrder: 'agents, git, session' } }, async ($, on) => {
  pane(on)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const keys = (await ui.findAll({ type: 'Button' })).flatMap(button => (button.key?.startsWith('section:') ? [button.key.slice(8)] : []))
  expect(keys.slice(0, 3)).toEqual(['#agents', '#changes+git', '#session'])
  // The card opens on the first tab Tab groups lists, not on the section the order named first.
  expect(await ui.find({ type: 'Text', text: 'No files changed in this session yet.' })).toBeDefined()
  await ui.unmount()
})

for (const surface of ['terminal', 'desktop'] as const) {
  test(`a tab group draws one section at a time and a tab opens its folded group (${surface})`, { options: { tabGroups: 'skills+todos' } }, async ($, on) => {
    pane(on)
    await $.skill.prompt({ skill: 'commit', text: 'body' })

    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ type: 'Text', text: 'commit' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: 'Todos' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: NO_TODOS })).toBeUndefined()
    // The option replaces the default group, so Git and Changes draw as their own sections.
    expect(await ui.find({ type: 'Button', key: 'section:#git' })).toBeDefined()
    expect(await ui.find({ type: 'Button', key: 'section:#changes' })).toBeDefined()

    await ui.press({ key: 'tab:#todos' })
    expect(await ui.find({ type: 'Text', text: NO_TODOS })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: 'commit' })).toBeUndefined()
    expect(await ui.find({ type: 'Text', text: 'Skills 1' })).toBeDefined()

    await ui.press({ key: 'section:#skills+todos' })
    expect(await ui.find({ type: 'Text', text: NO_TODOS })).toBeUndefined()
    await ui.press({ key: 'tab:#skills' })
    expect(await ui.find({ type: 'Text', text: 'commit' })).toBeDefined()
    await ui.unmount()
  })
}

test('a group with one shown section draws its plain header and still folds as the group', { options: { tabGroups: 'jira+skills' } }, async ($, on) => {
  pane(on)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.findAll({ type: 'Button', key: 'tab:#skills' })).toEqual([])
  expect(await ui.find({ type: 'Text', text: '▾ Skills' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: NO_SKILLS })).toBeDefined()

  await ui.press({ key: 'section:#jira+skills' })
  expect(await ui.find({ type: 'Text', text: '▸ Skills' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: NO_SKILLS })).toBeUndefined()
  await ui.unmount()
})
