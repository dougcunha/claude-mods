import { expect, test } from 'claude-code/testing'

const PANE = {
  plugin: 'session-changes',
  component: 'Pane',
  requestId: 'session-changes',
  props: { title: 'Session changes', isFocused: true, bodyColumns: 80 },
} as const

const ran = (stdout = '', exitCode = 0) =>
  ({ exitCode, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false })

test('tracks created, modified and deleted files and draws them as a tree', async ($, on) => {
  const written = new Map<string, string>()
  const gone = new Set(['/repo/src/old.ts'])
  on('session.cwd', async () => ({ value: '/repo' }))
  on('session.id', async () => ({ value: 'sid' }))
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
