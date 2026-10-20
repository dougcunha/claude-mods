import { expect, test } from 'claude-code/testing'

import type { Host, Message } from '../hooks/host'
import { judge, parseDecision, shouldJudge, skipReason, transcriptText } from '../hooks/judge'
import type { Submission } from '../hooks/judge'

const MODEL = 'haiku'
const TYPED: Submission = { text: 'Add a dark theme to the docs site.', origin: { kind: 'composer' } }

const SKIPS: readonly (readonly [string, Submission, string | null])[] = [
  ['a plain prompt the person typed', TYPED, null],
  ['a prompt from a plugin', { ...TYPED, origin: { kind: 'plugin' } }, 'not typed by the person'],
  ['a slash command', { ...TYPED, command: { name: 'review', args: '' } }, 'a command'],
  ['a meta prompt', { ...TYPED, isMeta: true }, 'a command'],
  ['a prompt typed during a turn', { ...TYPED, turnId: 't1' }, 'typed during a turn'],
  ['a blank prompt', { ...TYPED, text: '  ' }, 'empty'],
]

for (const [name, submission, expected] of SKIPS) {
  test(`skipReason: ${name} gives ${expected ?? 'no reason, so it is judged'}`, async () => {
    expect(skipReason(submission)).toBe(expected)
  })
}

const GATES = [
  ['an empty context with no minimum', { percent: 0, minPercent: 0, keptAt: null, recheckStep: 10 }, true],
  ['context below the minimum', { percent: 19, minPercent: 20, keptAt: null, recheckStep: 10 }, false],
  ['context at the minimum', { percent: 20, minPercent: 20, keptAt: null, recheckStep: 10 }, true],
  ['kept, grown less than the step', { percent: 49, minPercent: 20, keptAt: 40, recheckStep: 10 }, false],
  ['kept, grown by the step', { percent: 50, minPercent: 20, keptAt: 40, recheckStep: 10 }, true],
  ['kept, then compacted below that point', { percent: 35, minPercent: 20, keptAt: 70, recheckStep: 10 }, true],
] as const

for (const [name, gate, expected] of GATES) {
  test(`shouldJudge: ${name} gives ${expected}`, async () => {
    expect(shouldJudge(gate)).toBe(expected)
  })
}

test('braces in the text before and after the JSON object do not hide its decision', async () => {
  const reply = 'Seen {x}.\n{"decision": "new-topic", "reason": " Another feature. "}\nThe shape was {decision}.'

  expect(parseDecision(reply)).toEqual({ decision: 'new-topic', reason: 'Another feature.' })
})

for (const [name, reply] of [['no JSON', 'new-topic'], ['broken JSON', '{"decision": "related",'], ['an unknown decision', '{"decision": "handoff"}']] as const) {
  test(`a reply with ${name} gives no decision`, async () => {
    expect(parseDecision(reply)).toBeNull()
  })
}

test('the transcript keeps the end of the conversation within the limit and names tool calls', async () => {
  const messages: Message[] = [
    { role: 'user', content: 'old request '.repeat(20) },
    { role: 'assistant', content: [{ type: 'text', text: 'Reading.' }, { type: 'tool_use', name: 'Read', input: {} }] },
    { role: 'user', content: [{ type: 'tool_result', content: 'file text' }] },
    { role: 'assistant', content: [{ type: 'text', text: 'T03 is done.' }] },
  ]

  expect(transcriptText(messages, 100)).toBe('Assistant: Reading.\n[tool call: Read]\n\nUser: [tool result]\n\nAssistant: T03 is done.')
})

const EXCHANGE: Message[] = [
  { role: 'user', content: 'Commit T03.' },
  { role: 'assistant', content: [{ type: 'text', text: 'T03 is committed.' }] },
]

/** What a session holds after /clear and /reload-plugins: local commands and their output, with no answer of the model. */
const LOCAL_COMMANDS: Message[] = [
  { role: 'user', content: '<command-name>/clear</command-name>' },
  { role: 'user', content: '<local-command-stdout>Reloaded: 14 plugins</local-command-stdout>' },
]

function fakeHost(reply: string | null, messages: Message[] = EXCHANGE): { host: Host; prompts: string[]; systems: string[] } {
  const prompts: string[] = []
  const systems: string[] = []
  const host = {
    messages: async () => messages,
    complete: async (request: { prompt: string; system: string }) => (prompts.push(request.prompt), systems.push(request.system), reply),
  } as unknown as Host

  return { host, prompts, systems }
}

test('a new-topic decision becomes a verdict, judged over the conversation and the new message', async () => {
  const { host, prompts, systems } = fakeHost('{"decision": "new-topic", "reason": "Another feature."}')

  const judgment = await judge(host, { model: MODEL, percent: 62, message: 'Add a dark theme.' })

  expect(judgment).toEqual({ outcome: 'new-topic', verdict: { reason: 'Another feature.', percent: 62 } })
  expect(prompts[0]).toContain('User: Commit T03.\n\nAssistant: T03 is committed.\n</conversation>\n<new-message>\nAdd a dark theme.\n</new-message>')
  expect(systems[0]).toContain('When you are not sure, answer related.')
})

test('a related decision lets the message enter, and no reply is no judgment', async () => {
  expect(await judge(fakeHost('{"decision": "related", "reason": "Same task."}').host, { model: MODEL, percent: 62, message: 'Yes.' })).toEqual({ outcome: 'related' })
  expect(await judge(fakeHost(null).host, { model: MODEL, percent: 62, message: 'Yes.' })).toEqual({ outcome: 'none' })
})

test('a conversation with no answer of the model, as after /clear and /reload-plugins, has no topic and asks no model', async () => {
  const { host, prompts } = fakeHost('{"decision": "new-topic", "reason": "Nothing yet."}', LOCAL_COMMANDS)

  expect(await judge(host, { model: MODEL, percent: 0, message: 'Create calc.py.' })).toEqual({ outcome: 'none' })
  expect(prompts).toEqual([])
})

const jevAnswer = (classification: string, newTopic: number, decision: string) => ({
  isError: false,
  content: [{ type: 'text', text: JSON.stringify({ results: [{ classification, probabilities: { related: 1 - newTopic, 'new-topic': newTopic }, decision }] }) }],
})

/** A host whose Jev MCP answers `jev` (a function throws, null is no server) and whose model answers `reply`. */
function jevHost(jev: unknown, reply: string | null = '{"decision": "related", "reason": "Same task."}') {
  const asked: Record<string, unknown>[] = []
  const { host, prompts } = fakeHost(reply)
  const classify = async (args: Record<string, unknown>) => (asked.push(args), typeof jev === 'function' ? jev() : jev)

  return { host: { ...host, classify } as unknown as Host, asked, prompts }
}

const JEV = { model: MODEL, percent: 62, message: 'Add a dark theme.', judge: 'jev' } as const

test('a sure Jev decision judges alone, with its probability as the reason, and the model is not asked', async () => {
  const { host, asked, prompts } = jevHost(jevAnswer('new-topic', 0.96, 'auto'))

  expect(await judge(host, JEV)).toEqual({ outcome: 'new-topic', verdict: { reason: 'Jev is 96% sure it needs nothing from this conversation.', percent: 62 } })
  expect(asked).toHaveLength(1)
  expect(prompts).toEqual([])
  expect(await judge(jevHost(jevAnswer('related', 0.02, 'auto')).host, JEV)).toEqual({ outcome: 'related' })
})

test('a Jev answer left to review asks the model and warns of nothing', async () => {
  const { host, prompts } = jevHost(jevAnswer('new-topic', 0.75, 'review'), '{"decision": "new-topic", "reason": "Another feature."}')

  expect(await judge(host, JEV)).toEqual({ outcome: 'new-topic', verdict: { reason: 'Another feature.', percent: 62 } })
  expect(prompts).toHaveLength(1)
})

const JEV_FAILURES = [
  ['is not connected', null],
  ['failed or did not answer in time', () => { throw new Error('the Jev MCP did not answer in time') }],
  ['reported an error', { isError: true, content: [{ type: 'text', text: 'Missing key' }] }],
  ['sent an answer the mod cannot read', { isError: false, content: [{ type: 'text', text: 'oops' }] }],
] as const

for (const [reason, jev] of JEV_FAILURES) {
  test(`a Jev MCP that ${reason} leaves the judgment to the model and says why`, async () => {
    const { host, prompts } = jevHost(jev)

    expect(await judge(host, JEV)).toEqual({ outcome: 'related', fallback: reason })
    expect(prompts).toHaveLength(1)
  })
}

test('a model that does not answer after a Jev failure is no judgment, and the failure is still named', async () => {
  expect(await judge(jevHost(null, null).host, JEV)).toEqual({ outcome: 'none', fallback: 'is not connected' })
})

test('the model judge, the default, never calls the Jev MCP', async () => {
  const { host, asked } = jevHost(jevAnswer('new-topic', 0.96, 'auto'))

  await judge(host, { model: MODEL, percent: 62, message: 'Yes.' })

  expect(asked).toEqual([])
})
