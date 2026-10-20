import { expect, test } from 'claude-code/testing'

import { JEV_ITEM_LIMIT, jevArguments, readJev, serverNames, serverOf } from '../hooks/jev'

/** The result of `jev_classify` as the MCP sends it: the tool's JSON in one text block. */
const jevResult = (classification: string, probabilities: Record<string, number>, decision: string, isError = false) => ({
  isError,
  content: [{ type: 'text', text: JSON.stringify({ tool: 'jev_classify', results: [{ id: 'message', classification, probabilities, decision }] }) }],
})

const READINGS = [
  ['a sure new topic', jevResult('new-topic', { related: 0.04, 'new-topic': 0.96 }, 'auto'), { kind: 'answer', decision: 'new-topic', newTopic: 0.96, isConfident: true }],
  ['a sure related message', jevResult('related', { related: 0.99, 'new-topic': 0.01 }, 'auto'), { kind: 'answer', decision: 'related', newTopic: 0.01, isConfident: true }],
  ['an answer left to review', jevResult('new-topic', { related: 0.25, 'new-topic': 0.75 }, 'review'), { kind: 'answer', decision: 'new-topic', newTopic: 0.75, isConfident: false }],
  ['a result the server flags as an error', jevResult('new-topic', { 'new-topic': 1 }, 'auto', true), { kind: 'error' }],
  ['a text that is not JSON', { isError: false, content: [{ type: 'text', text: 'Rate limited' }] }, { kind: 'unreadable' }],
  ['a class the mod did not ask for', jevResult('handoff', { 'new-topic': 1 }, 'auto'), { kind: 'unreadable' }],
  ['no probability for new-topic', jevResult('related', { related: 1 }, 'auto'), { kind: 'unreadable' }],
  ['no text block', { isError: false, content: [] }, { kind: 'unreadable' }],
] as const

for (const [name, result, expected] of READINGS) {
  test(`readJev: ${name} reads as ${expected.kind}`, async () => {
    expect(readJev(result)).toEqual(expected)
  })
}

test('the new message is cut at the size Jev reads, and the conversation goes in as context', async () => {
  const args = jevArguments(62, 'User: Commit T03.', ` ${'x'.repeat(JEV_ITEM_LIMIT + 50)} `)

  expect(args.items).toEqual([{ id: 'message', text: 'x'.repeat(JEV_ITEM_LIMIT) }])
  expect(args.context).toContain('Context window used: 62%.')
  expect(args.context).toContain('User: Commit T03.')
  expect((args.classes as { id: string }[]).map(one => one.id)).toEqual(['related', 'new-topic'])
})

test('the server is found by the Jev tool in its name, and a plugin server goes by its /mcp name first', async () => {
  expect(serverOf('mcp__jev__jev_classify')).toBe('jev')
  expect(serverOf('mcp__plugin_jev_jev__jev_classify')).toBe('plugin_jev_jev')
  expect(serverOf('mcp__jev__jev_verify')).toBeUndefined()
  expect(serverNames('jev')).toEqual(['jev'])
  expect(serverNames('plugin_jev_jev')).toEqual(['plugin:jev:jev', 'plugin_jev_jev'])
})
