import { expect, mock, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

import type { Host } from '../hooks/host'
import { checkUpdate, installedVersion, isNewer, newerVersion, readRecord, UPDATE_CHECK_MS, UPDATE_COMMAND, UPDATE_RETRY_MS, UPDATE_STORE, UPDATE_URL, versionOf } from '../hooks/update'

const NOW = 1_800_000_000_000

/** Event-loop turns the test yields so the check, which the session start does not await, can end. */
const SETTLE_TURNS = 500
const MANIFEST = (version: string) => JSON.stringify({ name: 'session-info', version })

const PANE = {
  plugin: 'session-info',
  component: 'Pane',
  requestId: 'session-info',
  props: { title: 'Session info', isFocused: true, bodyColumns: 80, placement: 'dock', scroll: { offset: 0, bodyRows: 200 }, view: {} },
} as const

/** A host that answers the fetch with `answer` (or rejects) and records the URLs it was asked for. */
function hostFor(answer: { ok: boolean; text: string } | 'rejects', asked: string[] = [], manifest?: string): Host {
  return {
    fetchText: async (url: string) => {
      asked.push(url)
      if (answer === 'rejects') throw new Error('offline')

      return answer
    },
    readFile: async () => {
      if (manifest === undefined) throw new Error('missing')

      return manifest
    },
  } as unknown as Host
}

test('reads the version of a manifest and rejects any other text', async () => {
  expect(versionOf(MANIFEST('0.33.0'))).toBe('0.33.0')
  expect(versionOf(MANIFEST('0.33.0-beta'))).toBeUndefined()
  expect(versionOf('{"name":"x"}')).toBeUndefined()
  expect(versionOf('{"version":3}')).toBeUndefined()
  expect(versionOf('<html>404</html>')).toBeUndefined()
  expect(versionOf('null')).toBeUndefined()
  expect(versionOf('')).toBeUndefined()
})

test('compares versions by number, not by text', async () => {
  expect(isNewer('0.34.0', '0.33.9')).toBe(true)
  expect(isNewer('0.10.0', '0.9.0')).toBe(true)
  expect(isNewer('1.0.0', '0.99.99')).toBe(true)
  expect(isNewer('0.33.0', '0.33.0')).toBe(false)
  expect(isNewer('0.32.2', '0.33.0')).toBe(false)
  expect(isNewer('latest', '0.33.0')).toBe(false)
})

test('reads a stored record in any shape and falls back to an empty one', async () => {
  expect(readRecord({ checkedAt: NOW, latest: '0.34.0', notified: '0.34.0' })).toEqual({ checkedAt: NOW, latest: '0.34.0', notified: '0.34.0' })
  expect(readRecord(undefined)).toEqual({ checkedAt: 0, latest: '', notified: '' })
  expect(readRecord('0.34.0')).toEqual({ checkedAt: 0, latest: '', notified: '' })
  expect(readRecord({ checkedAt: 'x', latest: 7, notified: '../../etc' })).toEqual({ checkedAt: 0, latest: '', notified: '' })
})

test('the installed version comes from the mod\'s own manifest and a missing file is unknown', async () => {
  expect(await installedVersion(hostFor('rejects', [], MANIFEST('0.33.0')), 'D:\\mods\\session-info\\')).toBe('0.33.0')
  expect(await installedVersion(hostFor('rejects'), '/mods/session-info')).toBeUndefined()
})

test('a check inside the day asks nothing; a due one asks GitHub for the manifest', async () => {
  const asked: string[] = []
  const fresh = { checkedAt: NOW - UPDATE_CHECK_MS + 1, latest: '0.33.0', notified: '' }

  expect(await checkUpdate(hostFor({ ok: true, text: MANIFEST('0.40.0') }, asked), fresh, NOW)).toBe(fresh)
  expect(asked).toEqual([])

  const checked = await checkUpdate(hostFor({ ok: true, text: MANIFEST('0.34.0') }, asked), { ...fresh, checkedAt: NOW - UPDATE_CHECK_MS }, NOW)
  expect(asked).toEqual([UPDATE_URL])
  expect(checked).toEqual({ checkedAt: NOW, latest: '0.34.0', notified: '' })
})

test('a refused, failed or unreadable answer keeps the last version and retries in an hour', async () => {
  const due = { checkedAt: 0, latest: '0.33.5', notified: '0.33.5' }
  const retried = { ...due, checkedAt: NOW - UPDATE_CHECK_MS + UPDATE_RETRY_MS }

  expect(await checkUpdate(hostFor('rejects'), due, NOW)).toEqual(retried)
  expect(await checkUpdate(hostFor({ ok: false, text: MANIFEST('0.40.0') }), due, NOW)).toEqual(retried)
  expect(await checkUpdate(hostFor({ ok: true, text: '404: Not Found' }), due, NOW)).toEqual(retried)
})

test('only a version above the installed one is offered', async () => {
  const record = { checkedAt: NOW, latest: '0.34.0', notified: '' }

  expect(newerVersion(record, '0.33.0')).toBe('0.34.0')
  expect(newerVersion(record, '0.34.0')).toBeNull()
  expect(newerVersion(record, '0.35.0')).toBeNull()
  expect(newerVersion(record, undefined)).toBeNull()
  expect(newerVersion({ ...record, latest: '' }, '0.33.0')).toBeNull()
})

/** A session with the Git, Jira, CI and tool sections off, the manifest at `installed` and the store in `store`. */
function world(on: Parameters<TestBody>[1], store: Record<string, unknown>, published: string | 'rejects', calls: { fetched: string[]; toasts: string[]; filled: string[] }, box = '') {
  mock.clock(on, { now: NOW })
  on('session.cwd', async () => ({ value: '/repo' }))
  on('agent.list', async () => ({ value: [] }))
  on('session.id', async () => ({ value: 'sid' }))
  on('session.usage', async () => ({ value: { startedAt: 0, rateLimits: [], context: { window: 200_000 } } }) as never)
  on('env.get', async () => ({ value: undefined }))
  on('process.run', async () => ({ value: { exitCode: 128, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }))
  on('fs.read', async () => ({ value: MANIFEST('0.33.0') }) as never)
  on('http.fetch', async (_, e) => {
    calls.fetched.push(e.url)
    if (published === 'rejects') throw new Error('offline')

    return { value: { status: 200, ok: true, headers: {}, text: MANIFEST(published) } }
  })
  on('store.get', async (_, e) => ({ value: store[e.key] }) as never)
  on('store.set', async (_, e) => ((store[e.key] = e.value), { value: undefined }))
  on('ui.toast', async (_, e) => (calls.toasts.push(e.text), { value: undefined }) as never)
  on('prompt.read', async () => ({ value: { text: box, cursor: box.length } }) as never)
  on('prompt.fill', async (_, e) => (calls.filled.push(e.text), { isFilled: true }) as never)
  on('session.start', async (_, e) => ({ cwd: e.cwd }))
  on('command.register', async (_, e) => ({ value: { command: e.name } }))
}

/** The check runs after the session starts, so the test waits for it to end before it draws the pane. */
async function settled(): Promise<void> {
  for (let turn = 0; turn < SETTLE_TURNS; turn++) await Promise.resolve()
}

const QUIET = { showTodos: false, showAutopick: false, showJira: false, showCi: false, showChecks: false, showGit: false }

for (const surface of ['terminal', 'desktop'] as const)
  test(`a newer published version is told once, shows in the footer and its button fills the update command (${surface})`, { options: QUIET }, async ($, on) => {
    const calls = { fetched: [] as string[], toasts: [] as string[], filled: [] as string[] }
    const store: Record<string, unknown> = {}
    world(on, store, '0.34.0', calls)

    await $.session.start({ cwd: '/repo', surface, isInteractive: true })
    await settled()
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ type: 'Text', text: 'v0.33.0' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: '↑ 0.34.0' })).toBeDefined()
    expect(calls.fetched).toEqual([UPDATE_URL])
    expect(calls.toasts).toEqual(['session-info 0.34.0 is available (you have 0.33.0). Press ↑ 0.34.0 at the bottom of the pane to update.'])
    expect(readRecord(store[UPDATE_STORE])).toMatchObject({ latest: '0.34.0', notified: '0.34.0' })

    await ui.press({ key: 'update' })
    expect(calls.filled).toEqual([UPDATE_COMMAND])
    await ui.unmount()
  })

test('a version already told about and a check made today make no toast and no request', { options: QUIET }, async ($, on) => {
  const calls = { fetched: [] as string[], toasts: [] as string[], filled: [] as string[] }
  const store = { [UPDATE_STORE]: { checkedAt: NOW, latest: '0.34.0', notified: '0.34.0' } }
  world(on, store, '0.35.0', calls)

  await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })
  await settled()
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  expect(await ui.find({ type: 'Text', text: '↑ 0.34.0' })).toBeDefined()
  expect(calls.fetched).toEqual([])
  expect(calls.toasts).toEqual([])
  await ui.unmount()
})

test('the update button leaves a draft in the prompt alone and names the command in a toast', { options: QUIET }, async ($, on) => {
  const calls = { fetched: [] as string[], toasts: [] as string[], filled: [] as string[] }
  world(on, {}, '0.34.0', calls, 'my unsent draft')

  await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })
  await settled()
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'update' })

  expect(calls.filled).toEqual([])
  expect(calls.toasts.at(-1)).toBe(`session-info: to update, send ${UPDATE_COMMAND} and then reload the plugins.`)
  await ui.unmount()
})

test('checkUpdates false shows the version and makes no request', { options: { ...QUIET, checkUpdates: false } }, async ($, on) => {
  const calls = { fetched: [] as string[], toasts: [] as string[], filled: [] as string[] }
  world(on, {}, '0.34.0', calls)

  await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })
  await settled()
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  expect(await ui.find({ type: 'Text', text: 'v0.33.0' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /↑/ })).toBeUndefined()
  expect(calls.fetched).toEqual([])
  await ui.unmount()
})

test('a request the host refuses leaves the pane with the version and no button', { options: QUIET }, async ($, on) => {
  const calls = { fetched: [] as string[], toasts: [] as string[], filled: [] as string[] }
  world(on, {}, 'rejects', calls)

  await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })
  await settled()
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  expect(await ui.find({ type: 'Text', text: 'v0.33.0' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /↑/ })).toBeUndefined()
  expect(calls.toasts).toEqual([])
  await ui.unmount()
})
