import { expect, mock, test } from 'claude-code/testing'

import { agentModelText, agentRows, agentSummary, withAgentModel } from '../hooks/agents'
import { crossings } from '../hooks/alerts'
import { tileLayout } from '../hooks/cards'
import { duration, tokens, turnLine } from '../hooks/session'
import { cellWidths, legendLines, legendText, share, toReading } from '../hooks/context'
import { bar, colorOf } from '../hooks/usage'

const PANE = {
  plugin: 'session-info',
  component: 'Pane',
  requestId: 'session-info',
  props: { title: 'Session info', isFocused: true, bodyColumns: 80, placement: 'dock', scroll: { offset: 0, bodyRows: 200 }, view: {} },
} as const

const usage = (rateLimits: { kind: string; percentUsed: number; resetsAt?: string }[]) =>
  ({ value: { startedAt: 0, context: {}, rateLimits } }) as never

const ran = (stdout = '', exitCode = 0) =>
  ({ exitCode, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false })

test('tracks created, modified and deleted files and draws them as a tree', async ($, on) => {
  const written = new Map<string, string>()
  const gone = new Set(['/repo/src/old.ts'])
  on('session.cwd', async () => ({ value: '/repo' }))
  on('agent.list', async () => ({ value: [] }))
  on('session.id', async () => ({ value: 'sid' }))
  on('session.usage', async () => usage([]))
  on('env.get', async () => ({ value: undefined }))
  on('fs.write', async (_, e) => (written.set(e.path, e.text), { value: undefined }))
  on('fs.exists', async (_, e) => ({ value: !gone.has(e.path) }))
  on('process.run', async () => ({ value: ran('', 128) }))
  on('tool.call', { tool: 'Write' }, async (_, e) =>
    ({ result: { type: 'create', filePath: e.file_path, content: '', structuredPatch: [], originalFile: null } }) as never)
  on('tool.call', { tool: 'Edit' }, async (_, e) =>
    ({ result: { filePath: e.file_path, originalFile: 'before\n', structuredPatch: [] } }) as never)
  on('tool.call', { tool: 'Bash' }, async () =>
    ({
      result: {
        stdout: '', stderr: '', interrupted: false,
        bashEditDiff: {
          files: [{ filePath: '/repo/src/old.ts', deleted: true, hunks: [{ oldStart: 1, oldLines: 2, newStart: 0, newLines: 0, lines: ['-one', '-two'] }] }],
          moreFiles: 0,
        },
      },
    }) as never)

  await $.tool.call({ tool: 'Write', file_path: '/repo/src/new.ts', content: 'x' })
  await $.tool.call({ tool: 'Edit', file_path: '/repo/src/app/main.ts', old_string: 'a', new_string: 'b' })
  await $.tool.call({ tool: 'Bash', command: 'rm src/old.ts' })

  const snapshots = [...written.entries()].map(([path, text]) => [path.replace(/\\/g, '/'), text] as const)
  expect(snapshots.find(([path]) => path.endsWith('/main.ts'))?.[1]).toBe('before\n')
  expect(snapshots.find(([path]) => path.endsWith('/old.ts'))?.[1]).toBe('one\ntwo\n')
  expect(snapshots.find(([path]) => path.endsWith('/new.ts'))?.[1]).toBe('')

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal', viewport: { columns: 80, rows: 80 } })
  expect(await ui.find({ type: 'Text', text: /3 files/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^new\.ts$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^old\.ts$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^main\.ts$/ })).toBeDefined()

  await ui.press({ key: 'd:src' })
  expect(await ui.find({ type: 'Text', text: /^new\.ts$/ })).toBeUndefined()
  await ui.unmount()
})

test('a file created then deleted in the session leaves the list', async ($, on) => {
  let exists = true
  on('session.cwd', async () => ({ value: '/repo' }))
  on('agent.list', async () => ({ value: [] }))
  on('session.id', async () => ({ value: 'sid' }))
  on('session.usage', async () => usage([]))
  on('env.get', async () => ({ value: undefined }))
  on('fs.write', async () => ({ value: undefined }))
  on('fs.exists', async () => ({ value: exists }))
  on('process.run', async () => ({ value: ran('', 128) }))
  on('tool.call', { tool: 'Write' }, async (_, e) =>
    ({ result: { type: 'create', filePath: e.file_path, content: '', structuredPatch: [], originalFile: null } }) as never)
  on('tool.call', { tool: 'PowerShell' }, async () =>
    ({ result: { stdout: '', stderr: '', interrupted: false } }) as never)

  await $.tool.call({ tool: 'Write', file_path: '/repo/tmp.txt', content: 'x' })
  exists = false
  await $.tool.call({ tool: 'PowerShell', command: 'Remove-Item tmp.txt' })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /No files changed/ })).toBeDefined()
  await ui.unmount()
})

test('a new file opens in the editor; a deleted one with unknown content opens nothing', { options: { editor: 'system' } }, async ($, on) => {
  const spawned: string[][] = []
  const toasts: string[] = []
  const gone = new Set<string>()
  on('session.cwd', async () => ({ value: '/repo' }))
  on('agent.list', async () => ({ value: [] }))
  on('session.id', async () => ({ value: 'sid' }))
  on('session.usage', async () => usage([]))
  on('env.get', async () => ({ value: undefined }))
  on('fs.write', async () => ({ value: undefined }))
  on('fs.exists', async (_, e) => ({ value: !gone.has(e.path.replace(/\\/g, '/').replace(/^[A-Za-z]:/, '')) }))
  on('process.run', async () => ({ value: ran('', 128) }))
  on('process.spawn', async function* (_, e) {
    spawned.push([...e.argv])
    return { value: { code: 0, signal: null } }
  })
  on('ui.toast', async (_, e) => (toasts.push(String(e.text)), { value: undefined }))
  on('tool.call', { tool: 'Write' }, async (_, e) =>
    ({ result: { type: 'create', filePath: e.file_path, content: '', structuredPatch: [], originalFile: null } }) as never)
  on('tool.call', { tool: 'Edit' }, async (_, e) =>
    ({ result: { filePath: e.file_path, originalFile: null, structuredPatch: [] } }) as never)
  on('tool.call', { tool: 'PowerShell' }, async () =>
    ({ result: { stdout: '', stderr: '', interrupted: false } }) as never)

  await $.tool.call({ tool: 'Write', file_path: '/repo/src/new.ts', content: 'x' })
  await $.tool.call({ tool: 'Edit', file_path: '/repo/src/lost.ts', old_string: 'a', new_string: 'b' })
  gone.add('/repo/src/lost.ts')
  await $.tool.call({ tool: 'PowerShell', command: 'Remove-Item src/lost.ts' })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'f:src/new.ts' })
  expect(spawned).toEqual([['xdg-open', '/repo/src/new.ts']])

  await ui.press({ key: 'f:src/lost.ts' })
  expect(spawned.length).toBe(1)
  expect(toasts).toEqual([])
  await ui.unmount()
})

test('the usage section draws one labelled bar per rate-limit window and folds', async ($, on) => {
  const inTwoHours = new Date(Date.now() + 2 * 3_600_000 + 30_000).toISOString()
  on('session.cwd', async () => ({ value: '/repo' }))
  on('agent.list', async () => ({ value: [] }))
  on('session.usage', async () =>
    usage([
      { kind: 'seven_day', percentUsed: 28, resetsAt: inTwoHours },
      { kind: 'seven_day_fable', percentUsed: 3 },
      { kind: 'five_hour', percentUsed: 3.4, resetsAt: inTwoHours },
    ]))

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: 'Current session' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'Current week (all models)' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'Current week (Fable)' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: ' 28%' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /resets in 2h 1m/ })).toBeDefined()

  await ui.press({ key: 'section:#usage' })
  expect(await ui.find({ type: 'Text', text: 'Current session' })).toBeUndefined()
  await ui.unmount()
})

test('with no reading yet the usage section says so', async ($, on) => {
  on('session.cwd', async () => ({ value: '/repo' }))
  on('agent.list', async () => ({ value: [] }))
  on('session.usage', async () => usage([]))

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /No usage reading yet/ })).toBeDefined()
  await ui.unmount()
})

const BREAKDOWN = {
  categories: [
    { name: 'System prompt', tokens: 2_000, kind: 'used', isDeferred: false },
    { name: 'System tools', tokens: 20_000, kind: 'used', isDeferred: false },
    { name: 'MCP tools', tokens: 5_000, kind: 'deferred', isDeferred: true },
    { name: 'Messages', tokens: 102_000, kind: 'used', isDeferred: false },
    { name: 'Free space', tokens: 63_000, kind: 'free', isDeferred: false },
    { name: 'Autocompact buffer', tokens: 13_000, kind: 'buffer', isDeferred: false },
  ],
  totalTokens: 124_000,
  maxTokens: 200_000,
  rawMaxTokens: 200_000,
  percentage: 62,
  autoCompactThreshold: 187_000,
  isAutoCompactEnabled: true,
}

for (const surface of ['terminal', 'desktop'] as const) {
  test(`the session section draws the context as a stacked bar with a legend when unfolded (${surface})`, async ($, on) => {
    const startedAt = Date.now() - 72 * 60_000
    on('session.cwd', async () => ({ value: '/repo' }))
    on('agent.list', async () => ({ value: [] }))
    on('session.usage', async (_, e) =>
      ({
        value: {
          startedAt,
          cost: { usd: 1.844 },
          rateLimits: [],
          context: { tokens: 124_000, window: 200_000, percent: 62, breakdown: e.breakdown ? BREAKDOWN : undefined },
        },
      }) as never)

    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ type: 'Text', text: '$1.84' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: '1h 12m' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: 'No turns yet' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /^messages / })).toBeUndefined()

    await ui.press({ key: 'context' })
    expect(await ui.find({ type: 'Text', text: '124k / 200k · compacts at 187k' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: 'messages 102k 51%' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: 'free space 63k' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /mcp tools/ })).toBeUndefined()
    expect(Boolean(await ui.find({ type: 'Text', text: /█/ }))).toBe(surface === 'terminal')

    await ui.press({ key: 'context' })
    expect(await ui.find({ type: 'Text', text: /^messages / })).toBeUndefined()
    expect(await ui.find({ type: 'Text', text: '124k / 200k · compacts at 187k' })).toBeDefined()
    await ui.unmount()
  })
}

test('before the first reply the session section takes the context figures from the reading', async ($, on) => {
  on('session.cwd', async () => ({ value: '/repo' }))
  on('agent.list', async () => ({ value: [] }))
  on('session.usage', async (_, e) =>
    ({
      value: { startedAt: Date.now(), rateLimits: [], context: { breakdown: e.breakdown ? BREAKDOWN : undefined } },
    }) as never)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'context' })
  expect(await ui.find({ type: 'Text', text: '124k / 200k · compacts at 187k' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: / 62%$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'after the first reply' })).toBeUndefined()
  await ui.unmount()
})

test('the session section counts each /clear since the load', async ($, on) => {
  on('session.cwd', async () => ({ value: '/repo' }))
  on('agent.list', async () => ({ value: [] }))
  on('session.end', async (_, e) => ({ sessionId: e.sessionId }))
  on('session.usage', async (_, e) =>
    ({
      value: { startedAt: Date.now(), rateLimits: [], context: { breakdown: e.breakdown ? BREAKDOWN : undefined } },
    }) as never)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'context' })
  expect(await ui.find({ type: 'Text', text: '124k / 200k · compacts at 187k' })).toBeDefined()

  const end = (reason: 'clear' | 'resume') => $.session.end({ reason, sessionId: 's1', resume: { id: 's1' } })
  await end('clear')
  expect(await ui.find({ type: 'Text', text: '124k / 200k · compacts at 187k · 1 clear' })).toBeDefined()
  await end('resume')
  await end('clear')
  expect(await ui.find({ type: 'Text', text: '124k / 200k · compacts at 187k · 2 clears' })).toBeDefined()
  await ui.unmount()
})

test('a /clear or a resume reads the context once the session id is the next one', async ($, on) => {
  let isCleared = false
  const clock = mock.clock(on)
  on('session.id', async () => ({ value: isCleared ? 's2' : 's1' }))
  on('session.cwd', async () => ({ value: '/repo' }))
  on('agent.list', async () => ({ value: [] }))
  on('session.end', async (_, e) => ({ sessionId: e.sessionId }))
  on('session.usage', async (_, e) =>
    ({
      value: { startedAt: Date.now(), rateLimits: [], context: { breakdown: e.breakdown && isCleared ? BREAKDOWN : undefined } },
    }) as never)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: 'after the first reply' })).toBeDefined()

  await $.session.end({ reason: 'resume', sessionId: 's1', resume: { id: 's1' } })
  await clock.advance(1_000)
  expect(await ui.find({ type: 'Text', text: 'after the first reply' })).toBeDefined()

  isCleared = true
  await clock.advance(200)
  expect(await ui.find({ type: 'Text', text: '124k / 200k · compacts at 187k' })).toBeDefined()
  await ui.unmount()
})

test('the context reading orders, colors and sizes the slices', async () => {
  const reading = toReading(BREAKDOWN)!
  expect(reading.slices.map(slice => `${slice.kind}:${slice.name}`)).toEqual([
    'used:system prompt',
    'used:system tools',
    'used:messages',
    'free:free space',
    'buffer:autocompact buffer',
  ])
  expect(reading.slices.find(slice => slice.name === 'messages')?.color).toBe('claude')
  expect(reading.compactsAt).toBe(187_000)
  expect(toReading({ ...BREAKDOWN, isAutoCompactEnabled: false })?.compactsAt).toBe(undefined)
  expect(toReading({ ...BREAKDOWN, rawMaxTokens: 0 })).toBe(null)

  const widths = cellWidths(reading, 50)
  expect(widths.reduce((sum, n) => sum + n, 0)).toBe(50)
  expect(widths[0]).toBe(1)
  expect(share(400, 1_000_000)).toBe('<0.1%')
  expect(share(21_000, 1_000_000)).toBe('2.1%')
  expect(share(233_000, 1_000_000)).toBe('23%')

  const lines = legendLines(reading, 40)
  expect(lines.flat().length).toBe(5)
  expect(lines.every(line => line.map(slice => 2 + legendText(slice, reading.window).length).reduce((a, n) => a + n, 0) + 3 * (line.length - 1) <= 40)).toBe(true)
})

test('a narrow pane draws bare sections with cost and duration in the session header', async ($, on) => {
  on('session.cwd', async () => ({ value: '/repo' }))
  on('agent.list', async () => ({ value: [] }))
  on('session.usage', async () =>
    ({ value: { startedAt: Date.now() - 72 * 60_000, cost: { usd: 1.844 }, rateLimits: [], context: {} } }) as never)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal', props: { ...PANE.props, bodyColumns: 36 } })
  expect(await ui.find({ type: 'Text', text: '$1.84 · 1h 12m' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'context' })).toBeUndefined()
  await ui.unmount()
})

test('a narrow desktop pane still draws the tiles and percentage bars, not block characters', async ($, on) => {
  on('session.cwd', async () => ({ value: '/repo' }))
  on('agent.list', async () => ({ value: [] }))
  on('session.usage', async () =>
    ({
      value: {
        startedAt: Date.now() - 72 * 60_000,
        cost: { usd: 1.844 },
        rateLimits: [{ kind: 'five_hour', percentUsed: 44 }],
        context: { tokens: 124_000, window: 200_000, percent: 62 },
      },
    }) as never)

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop', props: { ...PANE.props, bodyColumns: 36 } })
  expect(await ui.find({ type: 'Text', text: 'cost' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '62%' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '44%' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /█|░|─/ })).toBeUndefined()
  await ui.unmount()
})

test('bars fill to the eighth of a cell and show any use', async () => {
  expect(bar(50, 10)).toEqual({ filled: '█████', empty: '─────' })
  expect(bar(55, 10)).toEqual({ filled: '█████▌', empty: '────' })
  expect(bar(0.1, 10)).toEqual({ filled: '▏', empty: '─────────' })
  expect(bar(0, 4)).toEqual({ filled: '', empty: '────' })
  expect(bar(120, 4)).toEqual({ filled: '████', empty: '' })
})

test('tiles share the width and wrap when it runs out', async () => {
  expect(tileLayout(4, 80)).toEqual({ width: 20, rows: 3 })
  expect(tileLayout(4, 44)).toEqual({ width: 22, rows: 6 })
  expect(tileLayout(0, 80).rows).toBe(0)
})

test('turn and size formatting', async () => {
  expect(tokens(950)).toBe('950')
  expect(tokens(12_340)).toBe('12k')
  expect(tokens(1_234)).toBe('1.2k')
  expect(tokens(1_500_000)).toBe('1.5M')
  expect(duration(38_000)).toBe('38s')
  expect(duration(4 * 60_000 + 12_000)).toBe('4m 12s')
  expect(turnLine({ count: 4, outputTokens: 1_000, lastMs: 38_000 })).toBe('4 turns · ~250 output tok/turn · last 38s')
})

test('the agents section lists agents by status, children under their parent', async ($, on) => {
  on('session.cwd', async () => ({ value: '/repo' }))
  on('session.usage', async () => usage([]))
  on('agent.list', async () =>
    ({
      value: [
        { id: 'a1', type: 'Explore', description: 'find auth code', status: 'completed' },
        { id: 'a2', type: 'general-purpose', name: 'reviewer', description: 'review diff', status: 'running' },
        { id: 'a3', type: 'Explore', description: 'nested search', status: 'running', parentId: 'a2' },
      ],
    }) as never)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: '2 running · 1 done' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'reviewer' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '  ⟳ ' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: ' · find auth code' })).toBeDefined()

  await ui.press({ key: 'section:#agents' })
  expect(await ui.find({ type: 'Text', text: 'reviewer' })).toBeUndefined()
  await ui.unmount()
})

test('the agents section shows the model and effort of each subagent, from its spawn and its last request', async ($, on) => {
  on('session.cwd', async () => ({ value: '/repo' }))
  on('session.usage', async () => usage([]))
  on('agent.list', async () =>
    ({
      value: [
        { id: 'a1', type: 'Explore', description: 'find auth code', status: 'running' },
        { id: 'a2', type: 'Plan', description: 'plan it', status: 'running' },
      ],
    }) as never)
  on('agent.spawn', async () => ({ model: 'claude-haiku-5-5', agentId: 'a1' }) as never)
  on('classic.SessionStart', async () => ({}))
  on('turn.step', async function* (_, e) {
    return { turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: 'end_turn', usage: null } as never
  })
  const step = async (input: { agentId?: string; model: string; effort?: 'low' | 'high' }): Promise<void> => {
    for await (const _ of $.turn.step({ turnId: 't1', index: 0, messageCount: 1, ...input })) void _
  }

  await $.agent.spawn({ prompt: 'find it', description: 'find auth code', subagentType: 'Explore' } as never)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: ' · claude-haiku-5-5 · find auth code' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: ' · plan it' })).toBeDefined()

  await step({ agentId: 'a1', model: 'claude-haiku-5-5', effort: 'low' })
  await step({ agentId: 'a2', model: 'claude-opus-5-5', effort: 'high' })
  await step({ model: 'claude-sonnet-5-5', effort: 'high' })
  expect(await ui.find({ type: 'Text', text: ' · claude-haiku-5-5 · low · find auth code' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: ' · claude-opus-5-5 · high · plan it' })).toBeDefined()

  await $.classic.SessionStart({ source: 'clear' })
  expect(await ui.find({ type: 'Text', text: ' · plan it' })).toBeDefined()
  await ui.unmount()
})

test('agent models keep the effort a request reported when the spawn names the same model', () => {
  const spawned = withAgentModel({}, 'a1', 'claude-haiku-5-5')
  const stepped = withAgentModel(spawned, 'a1', 'claude-haiku-5-5', 'low')
  expect(stepped).toEqual({ a1: { model: 'claude-haiku-5-5', effort: 'low' } })
  expect(withAgentModel(stepped, 'a1', 'claude-haiku-5-5', 'low')).toBe(stepped)
  expect(withAgentModel(stepped, 'a1', 'claude-haiku-5-5')).toBe(stepped)
  expect(withAgentModel(stepped, 'a1', 'claude-sonnet-5-5')).toEqual({ a1: { model: 'claude-sonnet-5-5' } })
  expect(withAgentModel(stepped, 'a1', 'claude-haiku-5-5', 2_048)).toEqual({ a1: { model: 'claude-haiku-5-5', effort: '2048' } })
  expect(agentModelText(undefined)).toBe('')
  expect(agentModelText({ model: 'claude-opus-5-5', effort: 'high' })).toBe(' · claude-opus-5-5 · high')
})

test('agent rows order active agents first and nest children', async () => {
  const rows = agentRows([
    { id: 'done', type: 'Explore', description: '', status: 'completed' },
    { id: 'child', type: 'Explore', description: '', status: 'running', parentId: 'parent' },
    { id: 'parent', type: 'Plan', description: '', status: 'waiting' },
  ])
  expect(rows.map(row => `${row.agent.id}:${row.depth}`)).toEqual(['parent:0', 'child:1', 'done:0'])
  expect(agentSummary([])).toBe('none')
})

test('alerts fire once per threshold and window, and again after a reset', async () => {
  const now = Date.parse('2026-10-10T12:00:00Z')
  const window = { kind: 'five_hour', percentUsed: 82, resetsAt: '2026-10-10T14:00:00Z' }
  const calm = { percent: 40, tokens: 80_000, window: 200_000 }

  const first = crossings([window], calm, [], now)
  expect(first.alerts.map(a => a.body)).toEqual(['Current session at 82% · resets in 2h 0m'])

  const again = crossings([window], calm, first.standing, now)
  expect(again.alerts).toEqual([])

  const higher = crossings([{ ...window, percentUsed: 91 }], calm, first.standing, now)
  expect(higher.alerts.map(a => a.body)).toEqual(['Current session at 91% · resets in 2h 0m'])

  const jumped = crossings([{ ...window, percentUsed: 95 }], calm, [], now)
  expect(jumped.alerts.length).toBe(1)

  const reset = crossings([{ ...window, percentUsed: 85, resetsAt: '2026-10-10T19:00:00Z' }], calm, higher.standing, now)
  expect(reset.alerts.length).toBe(1)
})

test('the context alert fires at 85% and re-arms after it drops', async () => {
  const high = { percent: 86, tokens: 172_000, window: 200_000 }
  const first = crossings([], high, [], 0)
  expect(first.alerts.map(a => a.body)).toEqual(['Context at 86% (172k / 200k): compaction is near'])
  expect(crossings([], high, first.standing, 0).alerts).toEqual([])

  const dropped = crossings([], { ...high, percent: 30 }, first.standing, 0)
  expect(dropped.standing).toEqual([])
  expect(crossings([], high, dropped.standing, 0).alerts.length).toBe(1)
})

for (const openOnStart of [true, false]) {
  test(`opens the pane at session start only with openOnStart (${openOnStart})`, { options: { openOnStart } }, async ($, on) => {
    const opened: string[] = []
    mock.clock(on)
    on('session.start', async (_, e) => ({ cwd: e.cwd }))
    on('command.register', async (_, e) => ({ value: { command: e.name } }))
    on('ui.open', async (_, e) => (opened.push(e.id), { value: { isPlaced: true } }))
    on('process.run', async () => ({ value: ran('', 128) }))

    await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })
    expect(opened).toEqual(openOnStart ? ['session-info'] : [])

    await $.session.start({ cwd: '/repo', surface: null, isInteractive: false })
    expect(opened).toEqual(openOnStart ? ['session-info'] : [])
  })
}

for (const surface of ['terminal', 'desktop'] as const) {
  test(`paneBackground paints the pane body in the terminal only (${surface})`, { options: { paneBackground: '#2e3440' } }, async ($, on) => {
    on('session.cwd', async () => ({ value: '/repo' }))
    on('agent.list', async () => ({ value: [] }))
    on('session.usage', async () => usage([]))

    const ui = await $.ui.mount({ ...PANE, surface, props: { ...PANE.props, scroll: { offset: 0, bodyRows: 40 } } } as never)
    const [root] = await ui.findAll({ type: 'Box' })
    const props = (root as unknown as { props: Record<string, unknown> }).props
    expect(props.backgroundColor).toBe(surface === 'terminal' ? '#2e3440' : undefined)
    expect(props.minHeight).toBe(surface === 'terminal' ? 40 : undefined)
    await ui.unmount()
  })
}

for (const surface of ['terminal', 'desktop'] as const) {
  test(`paneTitle draws a line at the top of the pane in paneTitleColor (${surface})`, { options: { paneTitle: 'Work', paneTitleColor: '#ff8700' } }, async ($, on) => {
    on('session.cwd', async () => ({ value: '/repo' }))
    on('agent.list', async () => ({ value: [] }))
    on('session.usage', async () => usage([]))

    const ui = await $.ui.mount({ ...PANE, surface } as never)
    const line = await ui.find({ type: 'Text', text: /Work/ })
    expect((line as unknown as { props: Record<string, unknown> }).props.color).toBe('#ff8700')
    await ui.unmount()
  })

  for (const [paneTitleAlign, grows] of [['center', [true, true]], ['right', [true, false]], [undefined, [false, true]]] as const) {
    test(`paneTitleAlign ${paneTitleAlign ?? 'left by default'} makes ${grows[0] ? 'the left' : 'the right'}${grows[0] && grows[1] ? ' and right' : ''} side of the title rule grow (${surface})`, { options: { paneTitle: 'Work', paneTitleAlign } }, async ($, on) => {
      on('session.cwd', async () => ({ value: '/repo' }))
      on('agent.list', async () => ({ value: [] }))
      on('session.usage', async () => usage([]))

      const ui = await $.ui.mount({ ...PANE, surface } as never)
      const sides = await Promise.all(['pane-title:left', 'pane-title:right'].map(key => ui.find({ key })))
      expect(sides.map(side => (side as unknown as { props: Record<string, unknown> }).props.flexGrow === 1)).toEqual(grows)
      await ui.unmount()
    })
  }

  test(`the pane has no title line without paneTitle (${surface})`, async ($, on) => {
    on('session.cwd', async () => ({ value: '/repo' }))
    on('agent.list', async () => ({ value: [] }))
    on('session.usage', async () => usage([]))

    const ui = await $.ui.mount({ ...PANE, surface } as never)
    expect(await ui.findAll({ key: 'pane-title' })).toEqual([])
    await ui.unmount()
  })
}

for (const [paneTitle, title] of [['Work', 'Work'], ['', 'Session info']] as const) {
  test(`opens the pane titled ${title} (paneTitle ${paneTitle === '' ? 'empty' : paneTitle})`, { options: { openOnStart: true, paneTitle } }, async ($, on) => {
    const titles: (string | undefined)[] = []
    mock.clock(on)
    on('session.start', async (_, e) => ({ cwd: e.cwd }))
    on('command.register', async (_, e) => ({ value: { command: e.name } }))
    on('ui.open', async (_, e) => (titles.push(e.title), { value: { isPlaced: true } }))
    on('process.run', async () => ({ value: ran('', 128) }))

    await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })
    expect(titles).toEqual([title])
  })
}

test('usage colors go from green to red as a window nears its limit', async () => {
  expect([0, 49, 50, 69, 70, 89, 90, 100].map(colorOf)).toEqual(['success', 'success', 'warning', 'warning', '#ff8700', '#ff8700', 'error', 'error'])
})

test('the Changes tree scrolls in a window with a scrollbar when it leaves rows out', async ($, on) => {
  on('session.cwd', async () => ({ value: '/repo' }))
  on('agent.list', async () => ({ value: [] }))
  on('session.id', async () => ({ value: 'sid' }))
  on('session.usage', async () => usage([]))
  on('env.get', async () => ({ value: undefined }))
  on('fs.write', async () => ({ value: undefined }))
  on('fs.exists', async () => ({ value: true }))
  on('process.run', async () => ({ value: ran('', 128) }))
  on('ui.scroll', async () => ({}))
  on('tool.call', { tool: 'Write' }, async (_, e) =>
    ({ result: { type: 'create', filePath: e.file_path, content: '', structuredPatch: [], originalFile: null } }) as never)
  for (let index = 0; index < 30; index++) await $.tool.call({ tool: 'Write', file_path: `/repo/src/file-${String(index).padStart(2, '0')}.ts`, content: 'x' })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal', viewport: { columns: 80, rows: 24 } })
  expect(await ui.find({ type: 'Text', text: /↑ 0 above/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^file-00\.ts$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^file-29\.ts$/ })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /^┃$/ })).toBeDefined()

  const wheel = { component: 'Pane', requestId: 'session-info', offset: 0, by: 4, bodyRows: 40, contentRows: 40, origin: { kind: 'person' } } as const
  await $.ui.scroll({ ...wheel, pointer: { column: 0, row: 999 } } as never)
  expect(await ui.find({ type: 'Text', text: /↑ 4 above/ })).toBeDefined()
  await $.ui.scroll({ ...wheel, by: -4 } as never)
  expect(await ui.find({ type: 'Text', text: /↑ 0 above/ })).toBeDefined()
  await $.ui.scroll({ ...wheel, pointer: { column: 0, row: 0 } } as never)
  expect(await ui.find({ type: 'Text', text: /↑ 4 above/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^file-00\.ts$/ })).toBeUndefined()

  await ui.press({ key: 'changes-up' })
  expect(await ui.find({ type: 'Text', text: /↑ 0 above/ })).toBeDefined()
  await ui.press({ key: 'changes-down' })
  expect(await ui.find({ type: 'Text', text: /↑ 5 above/ })).toBeDefined()
  await ui.press({ key: 'changes-bar:0' })
  expect(await ui.find({ type: 'Text', text: /↑ 0 above/ })).toBeDefined()
  const last = (await ui.findAll({ type: 'Button' })).filter(button => button.key?.startsWith('changes-bar:')).length - 1
  await ui.press({ key: `changes-bar:${last}` })
  expect(await ui.find({ type: 'Text', text: /↓ 0 below/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^file-29\.ts$/ })).toBeDefined()
  await ui.unmount()
})

test('the trees fit the window the pane body gets, and a body taller than its window scrolls as a whole', async ($, on) => {
  on('session.cwd', async () => ({ value: '/repo' }))
  on('agent.list', async () => ({ value: [] }))
  on('session.id', async () => ({ value: 'sid' }))
  on('session.usage', async () => usage([]))
  on('env.get', async () => ({ value: undefined }))
  on('fs.write', async () => ({ value: undefined }))
  on('fs.exists', async () => ({ value: true }))
  on('process.run', async () => ({ value: ran('', 128) }))
  let handedToPane = 0
  on('ui.scroll', async () => {
    handedToPane++

    return {}
  })
  on('tool.call', { tool: 'Write' }, async (_, e) =>
    ({ result: { type: 'create', filePath: e.file_path, content: '', structuredPatch: [], originalFile: null } }) as never)
  for (let index = 0; index < 30; index++) await $.tool.call({ tool: 'Write', file_path: `/repo/src/file-${String(index).padStart(2, '0')}.ts`, content: 'x' })

  const props = { ...PANE.props, scroll: { offset: 0, bodyRows: 16 } }
  const ui = await $.ui.mount({ ...PANE, props, surface: 'terminal', viewport: { columns: 80, rows: 80 } } as never)
  const shown = (await ui.findAll({ type: 'Text', text: /^file-\d+\.ts$/ })).length
  expect(shown).toBeGreaterThan(0)
  expect(shown).toBeLessThanOrEqual(6)

  const wheel = { component: 'Pane', requestId: 'session-info', offset: 0, by: 4, bodyRows: 16, contentRows: 40, origin: { kind: 'person' } } as const
  const overList = { column: 0, row: 44 }
  await $.ui.scroll(wheel as never)
  await $.ui.scroll({ ...wheel, pointer: { column: 0, row: 999 } } as never)
  expect(handedToPane).toBe(2)
  expect(await ui.find({ type: 'Text', text: /↑ 0 above/ })).toBeDefined()
  await $.ui.scroll({ ...wheel, pointer: overList } as never)
  expect(handedToPane).toBe(2)
  expect(await ui.find({ type: 'Text', text: /↑ 4 above/ })).toBeDefined()
  await $.ui.scroll({ ...wheel, by: -4, pointer: overList } as never)
  expect(await ui.find({ type: 'Text', text: /↑ 0 above/ })).toBeDefined()
  await $.ui.scroll({ ...wheel, by: -4, pointer: overList } as never)
  expect(handedToPane).toBe(3)
  for (let press = 0; press < 7; press++) await $.ui.scroll({ ...wheel, pointer: overList } as never)
  expect(await ui.find({ type: 'Text', text: /↓ 0 below/ })).toBeDefined()
  expect(handedToPane).toBe(3)
  await $.ui.scroll({ ...wheel, pointer: overList } as never)
  expect(handedToPane).toBe(4)
  await $.ui.scroll({ ...wheel, contentRows: 16 } as never)
  expect(handedToPane).toBe(4)
  expect(await ui.find({ type: 'Text', text: /↓ 0 below/ })).toBeDefined()
  await ui.unmount()
})
