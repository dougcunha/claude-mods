import { expect, test } from 'claude-code/testing'

import { cacheHit, modelText, resultText, startDraft, tokensText, toolsText, toRecord, turnLines, withSpawn, withStep, withSubagentUsage, withTool } from '../hooks/turn'

const PANE = {
  plugin: 'session-info',
  component: 'Pane',
  requestId: 'session-info',
  props: { title: 'Session info', isFocused: true, bodyColumns: 80 },
} as const

const USAGE = {
  input_tokens: 3_200,
  output_tokens: 4_100,
  cache_read_input_tokens: 182_000,
  cache_creation_input_tokens: 12_000,
  model: 'claude-opus-5-5',
}

for (const surface of ['terminal', 'desktop'] as const) {
  test(`the last turn section draws the result, model, tokens and tools of the main turn (${surface})`, async ($, on) => {
    let spent = 1
    on('session.cwd', async () => ({ value: '/repo' }))
    on('agent.list', async () => ({ value: [] }))
    on('session.usage', async () => ({ value: { startedAt: 0, cost: { usd: spent }, rateLimits: [], context: { window: 200_000 } } }) as never)
    on('turn.start', async (_, e) => ({ turnId: e.turnId }))
    on('turn.complete', async (_, e) => ({ text: e.answer }))
    on('tool.call', async () => ({ result: {} }) as never)

    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ type: 'Text', text: 'No turn finished yet.' })).toBeDefined()
    await ui.unmount()

    await $.turn.start({ text: 'fix it', turnId: 't1' })
    await $.tool.call({ tool: 'Read', file_path: '/repo/a.ts' })
    await $.tool.call({ tool: 'Read', file_path: '/repo/b.ts' })
    await $.tool.call({ tool: 'Grep', pattern: 'x' })
    await $.tool.call({ tool: 'mcp__session-info__todo_write', todos: [] } as never)
    await $.turn.complete({ answer: '', durationMs: 4_000, isAborted: false, turnId: 'sub', agentId: 'a1', reason: 'answer', usage: { ...USAGE, model: 'claude-haiku-5-5' } })
    spent = 1.42
    await $.turn.complete({ answer: 'done', durationMs: 72_000, isAborted: false, turnId: 't1', reason: 'answer', usage: USAGE })

    const drawn = await $.ui.mount({ ...PANE, surface })
    expect(await drawn.find({ type: 'Text', text: '✓ answer · 1m 12s · $0.42' })).toBeDefined()
    expect(await drawn.find({ type: 'Text', text: '▾ Last turn #1' })).toBeDefined()
    expect(await drawn.find({ type: 'Text', text: 'turns' })).toBeUndefined()
    expect(await drawn.find({ type: 'Text', text: 'claude-opus-5-5' })).toBeDefined()
    expect(await drawn.find({ type: 'Text', text: 'in 3.2k · out 4.1k · cache 182k read / 12k write · 92% hit' })).toBeDefined()
    expect(await drawn.find({ type: 'Text', text: 'Read 2 · Grep 1 · todo_write 1 · subagents (201k tok)' })).toBeDefined()

    await drawn.press({ key: 'section:#turn' })
    expect(await drawn.find({ type: 'Text', text: 'claude-opus-5-5' })).toBeUndefined()
    await drawn.unmount()
  })
}

test('showLastTurn false leaves the section out', { options: { showLastTurn: false } }, async ($, on) => {
  on('session.cwd', async () => ({ value: '/repo' }))
  on('agent.list', async () => ({ value: [] }))
  on('session.usage', async () => ({ value: { startedAt: 0, rateLimits: [], context: { window: 200_000 } } }) as never)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /^▾ Last turn/ })).toBeUndefined()
  await ui.unmount()
})

test('a draft gathers the requests, tools and subagents of its own turn', async () => {
  let draft = startDraft('t1', 2)
  draft = withStep(draft, { turnId: 't1', index: 0, model: 'claude-opus-5-5', effort: 'high' })
  draft = withStep(draft, { turnId: 't1', index: 2, model: 'claude-opus-5-5', effort: 'high' })
  draft = withStep(draft, { turnId: 'other', index: 9, model: 'claude-haiku-5-5' })
  draft = withTool(withTool(withTool(draft, 'Bash'), 'Edit'), 'Bash')
  draft = withSubagentUsage(withSpawn(draft), USAGE)

  const record = toRecord(draft, { turnId: 't1', durationMs: 5_000, reason: 'answer', usage: USAGE }, 2.5, 100)
  expect(record.requests).toBe(3)
  expect(modelText(record)).toBe('claude-opus-5-5 · high · 3 requests')
  expect(toolsText(record)).toBe('Bash 2 · Edit 1 · 1 subagent (201k tok)')
  expect(resultText(record)).toBe('✓ answer · 5s · $0.50')
  expect(turnLines(record)).toHaveLength(3)
})

test('a turn without its draft keeps what turn.complete reports and leaves out the rest', async () => {
  const record = toRecord(startDraft('old'), { turnId: 't2', durationMs: 1_000, reason: 'aborted' }, 3, 100)
  expect(record.tokens).toBeNull()
  expect(record.tools).toBeUndefined()
  expect(record.costUsd).toBeUndefined()
  expect(modelText(record)).toBe('')
  expect(tokensText(record)).toBe('No token usage reported')
  expect(toolsText(record)).toBe('')
  expect(resultText(record)).toBe('⊘ aborted · 1s')
  expect(turnLines(record)).toEqual(['No token usage reported'])
})

test('tools fold past four names, MCP tools show their own name, and the cache share needs input', async () => {
  let draft = startDraft('t')
  for (const tool of ['Read', 'Read', 'Edit', 'mcp__plugin_playwright_playwright__browser_click']) draft = withTool(draft, tool)
  expect(toolsText(toRecord(draft, { turnId: 't', durationMs: 0, reason: 'error' }, undefined, 0))).toBe('Read 2 · Edit 1 · browser_click 1')
  for (const tool of ['Bash', 'Grep']) draft = withTool(draft, tool)
  expect(toolsText(toRecord(draft, { turnId: 't', durationMs: 0, reason: 'error' }, undefined, 0))).toBe('Read 2 · Bash 1 · Edit 1 · Grep 1 · +1 more')
  expect(toolsText(toRecord(startDraft('t'), { turnId: 't', durationMs: 0, reason: 'answer' }, undefined, 0))).toBe('No tool calls')
  expect(cacheHit({ input: 0, output: 10, cacheRead: 0, cacheWrite: 0 })).toBeUndefined()
  expect(cacheHit({ input: 10, output: 0, cacheRead: 30, cacheWrite: 0 })).toBe(75)
})
