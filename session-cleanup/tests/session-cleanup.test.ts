import { expect, mock, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

import { hash, keyOf, norm } from '../hooks/paths'

type On = Parameters<TestBody>[1]

const NOW = Date.UTC(2026, 10, 2, 12, 0, 0)
const CWD = 'D:/work/app'
const HOME = 'C:/Users/me'
const TEMP = 'C:/Users/me/AppData/Local/Temp'
const PROBE = `${TEMP}/probe.txt`
const NOTES = `${CWD}/notes.md`
const OTHER = `${TEMP}/other.dat`
const PAD = `${TEMP}/claude/D--work-app/s1/scratchpad/pad.txt`

const PANE = {
  plugin: 'session-cleanup',
  component: 'Pane',
  requestId: 'session-cleanup',
  props: { title: 'Session cleanup', isFocused: true, bodyColumns: 100, placement: 'dock', scroll: { offset: 0, bodyRows: 200 }, view: {} },
} as const

const STATUS = ['# branch.oid 1', '# branch.head main', '# branch.upstream origin/main', '# branch.ab +1 -0', '1 .M N... 1 1 1 a a src/a.ts', ''].join('\0')

const fileId = (path: string): string => `f${hash(keyOf(path))}`
const gitId = (repo: string, kind: string): string => `g${hash(`${repo}\n${kind}`)}`

type Node = { kind: 'file' | 'directory'; size: number; mtimeMs: number }

/** A disk, Git and the engine's pane, prompt and session nouns in memory. */
function world(on: On, isTrashFailing = false, isLocked = false) {
  const disk = new Map<string, Node & { path: string }>()
  const put = (path: string, kind: Node['kind'] = 'file', mtimeMs = NOW + 1000): void => void disk.set(keyOf(path), { path: norm(path), kind, size: 10, mtimeMs })
  const children = (dir: string) =>
    [...disk.values()].filter(node => keyOf(node.path).startsWith(`${keyOf(dir)}/`) && !keyOf(node.path).slice(keyOf(dir).length + 1).includes('/'))
  const state = { prompts: [] as string[], argv: [] as string[][], toasts: [] as string[] }

  for (const dir of [HOME, TEMP, `${TEMP}/claude`, `${TEMP}/claude/D--work-app`, `${TEMP}/claude/D--work-app/s1`, `${TEMP}/claude/D--work-app/s1/scratchpad`, CWD, `${CWD}/src`]) put(dir, 'directory', 0)
  put(`${CWD}/src/a.ts`, 'file', 0)
  put(NOTES)
  put(OTHER)
  put(PAD)

  mock.clock(on, { now: NOW })
  mock.env(on, { OS: 'Windows_NT', USERPROFILE: HOME, TEMP })
  on('session.cwd', async () => ({ value: CWD }))
  on('session.root', async () => ({ value: CWD }))
  on('session.id', async () => ({ value: 's1' }))
  on('session.start', async (_, e) => ({ cwd: e.cwd }))
  on('command.register', async () => ({ value: { command: 'cleanup' } }) as never)
  on('state.get', async (_, e, next) => {
    const ref = e as unknown as { plugin: string; key: string }
    if (ref.plugin !== 'session-info') return next(e)
    const files = {
      [keyOf(NOTES)]: { path: NOTES, status: 'created', base: '', at: NOW },
      [keyOf(`${CWD}/src/a.ts`)]: { path: `${CWD}/src/a.ts`, status: 'modified', base: null, at: NOW },
    }
    return { value: { value: files, version: 1 } } as never
  })
  on('fs.exists', async (_, e) => ({ value: disk.has(keyOf(e.path)) }))
  on('fs.stat', async (_, e) => {
    const node = disk.get(keyOf(e.path))
    if (node === undefined) throw new Error('ENOENT')
    return { value: { kind: node.kind, size: node.size, mtimeMs: node.mtimeMs, isLink: false } } as never
  })
  on('fs.list', async (_, e) => {
    if (!disk.has(keyOf(e.path ?? CWD))) throw new Error('ENOENT')
    return { value: children(e.path ?? CWD).map(node => ({ name: node.path.split('/').pop(), kind: node.kind, size: node.size, mtimeMs: node.kind === 'file' ? node.mtimeMs : 0, isLink: false })) } as never
  })
  on('fs.write', async (_, e) => (put(e.path), { value: undefined }) as never)
  on('process.run', async (_, e) => {
    const argv = [...e.argv]
    state.argv.push(argv)
    const ok = (stdout: string) => ({ value: { exitCode: 0, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }) as never
    if (argv[0] === 'git' && argv[3] === 'rev-parse') return keyOf(argv[2] ?? '').startsWith(keyOf(CWD)) ? ok(`${CWD}\n`) : ({ value: { exitCode: 128, stdout: '', stderr: '' } } as never)
    if (argv[0] === 'git' && argv[1] === 'ls-files') return ok('')
    if (argv[0] === 'git' && argv[1] === 'status') return ok(STATUS)
    if (argv[0] === 'powershell') {
      const script = argv[4] ?? ''
      const [from, to] = [...script.matchAll(/'([^']+)'/g)].map(match => match[1] ?? '')
      if (script.includes('SendToRecycleBin') && isTrashFailing) return { value: { exitCode: 1, stdout: '', stderr: 'refused' } } as never
      if (isLocked) {
        const stderr = "Exception calling \"DeleteFile\": \"The process cannot access the file because it is being used by another process.\"\nAt line:1 char:44"
        return { value: { exitCode: 1, stdout: '', stderr } } as never
      }
      if (from !== undefined && !script.startsWith('Add-Type') && !script.startsWith('Move-Item') && !script.startsWith('Remove-Item')) return ok('')
      if (from !== undefined) disk.delete(keyOf(from))
      if (script.startsWith('Move-Item') && to !== undefined) put(to)
      return ok('')
    }
    return ok('')
  })
  on('tool.call', async (_, e) => {
    if (String(e.tool) === 'PowerShell') put(PROBE)
    return { result: { stdout: '', stderr: '', interrupted: false } } as never
  })
  on('ui.open', async () => ({ value: { isPlaced: true } }) as never)
  on('ui.close', async () => ({ value: undefined }) as never)
  on('ui.toast', async (_, e) => (state.toasts.push(String(e.text)), { value: undefined }))
  on('prompt.submit', async (_, e) => (state.prompts.push(e.text), { text: e.text }) as never)

  return { disk, state }
}

test('a PowerShell command that creates a temp file is recorded, and /cleanup lists it pre-selected with the other findings', async ($, on) => {
  const { state } = world(on)
  await $.session.start({ cwd: CWD, surface: 'terminal', isInteractive: true })
  await $.tool.call({ tool: 'PowerShell', command: 'Set-Content -Path "$env:TEMP\\probe.txt" -Value x' } as never)

  const opened = await $.command.run({ command: 'cleanup', args: '' } as never)
  expect(opened).toMatchObject({ text: 'Session cleanup pane opened.' })

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    await ui.press({ key: 'rescan' })

    expect((await ui.find({ key: fileId(PROBE) }))?.text).toBe('◉ probe.txt')
    expect((await ui.find({ key: fileId(PAD) }))?.text).toBe('◉ pad.txt')
    expect((await ui.find({ key: fileId(NOTES) }))?.text).toBe('○ notes.md')
    for (const tag of ['temp folder', 'scratchpad', 'untracked in app', '~/AppData/Local/Temp/', './']) {
      expect(await ui.find({ type: 'Text', text: tag })).toBeDefined()
    }
    expect((await ui.find({ key: gitId(CWD, 'changes') }))?.text).toBe('○ .')
    expect(await ui.find({ type: 'Text', text: '1 tracked file with uncommitted changes' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: '1 commit not pushed to origin/main' })).toBeDefined()
    expect((await ui.find({ key: 'apply' }))?.text).toBe('Remove 2')
    await ui.unmount()
  }
  expect(state.prompts).toEqual([])

  // The entries only the temp folder scan found are one row per folder, not pre-selected.
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ key: fileId(OTHER) })).toBeUndefined()
  expect((await ui.find({ key: `d${hash(`${keyOf(TEMP)}\nother`)}` }))?.text).toBe('○ 1 entry in Temp/')
  expect(await ui.find({ type: 'Text', text: 'other programs write here too' })).toBeDefined()
  await ui.unmount()
})

test('Apply sends the chosen files to the trash and the chosen Git items to Claude as one prompt', async ($, on) => {
  const { disk, state } = world(on)
  await $.session.start({ cwd: CWD, surface: 'terminal', isInteractive: true })
  await $.command.run({ command: 'cleanup', args: '' } as never)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'rescan' })

  await ui.press({ key: 'files:none' })
  await ui.press({ key: fileId(NOTES) })
  await ui.press({ key: gitId(CWD, 'ahead') })
  await ui.press({ key: 'apply' })

  expect(disk.has(keyOf(NOTES))).toBe(false)
  expect(disk.has(keyOf(PAD))).toBe(true)
  expect(state.argv.some(argv => argv[0] === 'powershell' && (argv[4] ?? '').includes("DeleteFile('D:\\work\\app\\notes.md'"))).toBe(true)
  expect(state.prompts).toEqual([
    'session-cleanup: fix these Git items that this session left. Check each one first, and ask me before you commit, push, discard changes or move a HEAD.\n- .: 1 commit not pushed to origin/main',
  ])
  expect(await ui.find({ type: 'Text', text: '✓ Sent to the trash: 1' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '✓ Sent 1 Git item to Claude.' })).toBeDefined()
  expect(await ui.find({ key: fileId(NOTES) })).toBeUndefined()
  await ui.unmount()
})

test('a file another program holds stays, with the reason on a line of its own, and is not moved to the quarantine', async ($, on) => {
  const { disk, state } = world(on, false, true)
  await $.command.run({ command: 'cleanup', args: '' } as never)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'rescan' })
  await ui.press({ key: 'files:none' })
  await ui.press({ key: fileId(NOTES) })

  await ui.press({ key: 'apply' })

  expect(disk.has(keyOf(NOTES))).toBe(true)
  expect(state.argv.some(argv => argv[0] === 'powershell' && (argv[4] ?? '').startsWith('Move-Item'))).toBe(false)
  expect(await ui.find({ type: 'Text', text: '✗ notes.md: in use by another program' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^✓/ })).toBeUndefined()
  await ui.unmount()
})

test('a file the trash leaves goes to the quarantine with a manifest', async ($, on) => {
  const { disk, state } = world(on, true)
  await $.command.run({ command: 'cleanup', args: '' } as never)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'rescan' })
  await ui.press({ key: 'files:none' })
  await ui.press({ key: fileId(NOTES) })

  await ui.press({ key: 'apply' })

  expect(state.argv.some(argv => argv[0] === 'powershell' && (argv[4] ?? '').startsWith('Move-Item'))).toBe(true)
  expect(disk.has(keyOf(`${HOME}/.claude/cleanup-quarantine/${NOW}/manifest.json`))).toBe(true)
  await ui.unmount()
})
