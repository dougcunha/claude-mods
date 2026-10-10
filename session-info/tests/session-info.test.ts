import { expect, test } from 'claude-code/testing'

import { duration, tokens, turnLine } from '../hooks/session'

const PANE = {
  plugin: 'session-info',
  component: 'Pane',
  requestId: 'session-info',
  props: { title: 'Session info', isFocused: true, bodyColumns: 80 },
} as const

const usage = (rateLimits: { kind: string; percentUsed: number; resetsAt?: string }[]) =>
  ({ value: { startedAt: 0, context: {}, rateLimits } }) as never

const ran = (stdout = '', exitCode = 0) =>
  ({ exitCode, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false })

test('tracks created, modified and deleted files and draws them as a tree', async ($, on) => {
  const written = new Map<string, string>()
  const gone = new Set(['/repo/src/old.ts'])
  on('session.cwd', async () => ({ value: '/repo' }))
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

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
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
  on('session.usage', async () => usage([]))

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /No usage reading yet/ })).toBeDefined()
  await ui.unmount()
})

test('the session section shows context, cost, duration and the context breakdown', async ($, on) => {
  const startedAt = Date.now() - 72 * 60_000
  on('session.cwd', async () => ({ value: '/repo' }))
  on('session.usage', async (_, e) =>
    ({
      value: {
        startedAt,
        cost: { usd: 1.844 },
        rateLimits: [],
        context: {
          tokens: 124_000,
          window: 200_000,
          percent: 62,
          breakdown: e.breakdown
            ? { categories: [{ name: 'Messages', tokens: 90_000, isDeferred: false }, { name: 'System tools', tokens: 20_000, isDeferred: false }] }
            : undefined,
        },
      },
    }) as never)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: '$1.84 · 1h 12m' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '124k / 200k' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: ' 62%' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'No turns yet' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '  Messages' })).toBeUndefined()

  await ui.press({ key: 'context' })
  expect(await ui.find({ type: 'Text', text: '  Messages' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '90k' })).toBeDefined()
  await ui.unmount()
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
