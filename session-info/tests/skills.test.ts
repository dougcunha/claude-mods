import { expect, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

import { endSkills, isSameSkill, skillSummary, startSkill } from '../hooks/skills'

const PANE = {
  plugin: 'session-info',
  component: 'Pane',
  requestId: 'session-info',
  props: { title: 'Session info', isFocused: true, bodyColumns: 80 },
} as const

const pane = (on: Parameters<TestBody>[1]) => {
  on('session.cwd', async () => ({ value: '/repo' }))
  on('agent.list', async () => ({ value: [{ id: 'a1', type: 'Explore', description: 'find', status: 'running' }] }) as never)
  on('session.usage', async () => ({ value: { startedAt: 0, rateLimits: [], context: { window: 200_000 } } }) as never)
  on('skill.prompt', async (_, e) => ({ text: e.text }))
  on('turn.complete', async (_, e) => ({ text: e.answer }))
}

for (const surface of ['terminal', 'desktop'] as const) {
  test(`the skills section shows the skills each loop loaded until its turn ends (${surface})`, async ($, on) => {
    pane(on)
    on('tool.call', { tool: 'Skill' }, async (_, e) => {
      await $.skill.prompt({ skill: String((e as Record<string, unknown>).skill), text: 'body' })

      return { result: {} } as never
    })

    const empty = await $.ui.mount({ ...PANE, surface })
    expect(await empty.find({ type: 'Text', text: 'No skill loaded in this conversation yet.' })).toBeDefined()
    await empty.unmount()

    await $.skill.prompt({ skill: 'commit', text: 'body' })
    await $.tool.call({ tool: 'Skill', skill: 'plugin-authoring', agentId: 'a1' } as never)

    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ type: 'Text', text: '2 active' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: 'commit' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /^Explore · \d+s ago$/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /^main · \d+s ago$/ })).toBeDefined()
    await ui.unmount()

    await $.turn.complete({ answer: '', durationMs: 1, isAborted: false, turnId: 't', reason: 'answer' })
    const after = await $.ui.mount({ ...PANE, surface })
    expect(await after.find({ type: 'Text', text: '1 active' })).toBeDefined()
    await after.unmount()
  })
}

test('/clear empties the skills list', async ($, on) => {
  pane(on)
  on('classic.SessionStart', async () => ({}))
  await $.skill.prompt({ skill: 'commit', text: 'body' })
  await $.classic.SessionStart({ source: 'clear' })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: 'No skill loaded in this conversation yet.' })).toBeDefined()
  await ui.unmount()
})

test('showSkills false leaves the section out', { options: { showSkills: false } }, async ($, on) => {
  pane(on)
  await $.skill.prompt({ skill: 'commit', text: 'body' })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /^▾ Skills/ })).toBeUndefined()
  await ui.unmount()
})

test('skill uses start, end per loop and match with or without the plugin prefix', async () => {
  let list = startSkill([], 'commit', undefined, 1)
  list = startSkill(list, 'plugin-authoring', 'a1', 2)
  expect(list.map(use => use.name)).toEqual(['plugin-authoring', 'commit'])
  expect(skillSummary(list)).toBe('2 active')
  expect(skillSummary(endSkills(list, 'a1'))).toBe('1 active')
  expect(skillSummary(endSkills(endSkills(list, 'a1'), undefined))).toBe('')
  expect(isSameSkill('anthropic-skills:ste-mode', 'ste-mode')).toBe(true)
  expect(isSameSkill('ste-mode', 'anthropic-skills:ste-mode')).toBe(true)
  expect(isSameSkill('ste', 'ste-mode')).toBe(false)
})
