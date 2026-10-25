import { expect, test } from 'claude-code/testing'

import type { Feature } from '../types'

import type { FolderEntry, Host } from '../hooks/host'
import { cleanArgv, fileOf, folderOf, loadAll, parseFeature, readOne, serialize, utf8Bytes } from '../hooks/store'

const FOLDER = 'C:/repo/.claude/feature-progress'
const UPDATED = '2026-10-25T10:00:00.000Z'

const FEATURE: Feature = {
  schemaVersion: 1,
  id: 'checkout',
  title: 'Checkout',
  state: 'review',
  round: 2,
  updatedAt: UPDATED,
  tasks: [{ id: 'T01', title: 'Cart', state: 'done', group: 'Plan', steps: { done: 2, total: 2 }, updatedAt: UPDATED }],
}

/** A fake Host over files in memory; `list` answers the names in `FOLDER`. */
function hostOf(files: Record<string, string>, extra: FolderEntry[] = []): Host {
  const host = {
    exists: async (path: string) => path === FOLDER || path in files,
    readFile: async (path: string) => {
      const text = files[path]
      if (text === undefined) throw new Error('missing')
      return text
    },
    list: async () => [...Object.keys(files).map(path => ({ name: path.slice(FOLDER.length + 1), kind: 'file' })), ...extra],
  }

  return host as unknown as Host
}

test('TC-09 FR-07 the folder resolves from the working directory, and the file is named by the id', () => {
  expect(folderOf('C:\\repo', '.claude/feature-progress/')).toBe(FOLDER)
  expect(fileOf(FOLDER, 'checkout')).toBe(`${FOLDER}/checkout.json`)
})

test('TC-09 a stored file round-trips through serialize and parseFeature', () => {
  const file = serialize(FEATURE)

  expect('text' in file ? parseFeature(file.text) : undefined).toEqual(FEATURE)
})

test('TC-09 FR-18 broken JSON, another schema version and a task without a state are unreadable', () => {
  expect(parseFeature('{"schemaVersion": 1,')).toBeUndefined()
  expect(parseFeature(JSON.stringify({ ...FEATURE, schemaVersion: 2 }))).toBeUndefined()
  expect(parseFeature(JSON.stringify({ ...FEATURE, tasks: [{ id: 'T01', title: 'x', updatedAt: UPDATED }] }))).toBeUndefined()
})

test('TC-09 FR-18 loadAll returns the features and a warning for each unreadable or misnamed file; folders and other files are skipped', async () => {
  const files = {
    [`${FOLDER}/checkout.json`]: JSON.stringify(FEATURE),
    [`${FOLDER}/broken.json`]: '{',
    [`${FOLDER}/other.json`]: JSON.stringify(FEATURE),
  }
  const host = hostOf(files, [{ name: 'notes.txt', kind: 'file' }, { name: 'old.json', kind: 'dir' }])

  const loaded = await loadAll(host, FOLDER)

  expect(Object.keys(loaded.features)).toEqual(['checkout'])
  expect(loaded.warnings).toEqual([`${FOLDER}/broken.json`, `${FOLDER}/other.json`])
})

test('TC-09 a missing folder has no features and no warnings', async () => {
  const host = { exists: async () => false } as unknown as Host

  expect(await loadAll(host, FOLDER)).toEqual({ features: {}, warnings: [] })
})

test('readOne tells a missing file from an unreadable one', async () => {
  const host = hostOf({ [`${FOLDER}/broken.json`]: '[]' })

  expect(await readOne(host, `${FOLDER}/none.json`)).toEqual({ kind: 'missing' })
  expect(await readOne(host, `${FOLDER}/broken.json`)).toEqual({ kind: 'unreadable' })
})

test('TC-10 NFR-03 a feature whose file passes 4 MiB is refused', () => {
  const big: Feature = { ...FEATURE, note: 'é'.repeat(2 * 1024 * 1024) }

  expect(serialize(big)).toEqual({ error: 'feature-progress: the file of checkout would pass 4 MiB; remove done tasks or shorten the notes' })
})

test('utf8Bytes counts 1 to 4 bytes per character', () => {
  expect(utf8Bytes('aé€😀')).toBe(1 + 2 + 3 + 4)
})

test('TC-11 FR-17 DEC-05 the delete argv names only the files; the folder stays out of the command line', () => {
  expect(cleanArgv('windows', ['a.json', 'b.json'])).toEqual(['cmd', '/d', '/c', 'del', '/f', '/q', 'a.json', 'b.json'])
  expect(cleanArgv('linux', ['a.json'])).toEqual(['rm', '-f', '--', 'a.json'])
  expect(cleanArgv('mac', ['a.json']).join(' ')).not.toContain('/repo')
})
