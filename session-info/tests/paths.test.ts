import { expect, test } from 'claude-code/testing'

import { absolute, baseName, keyOf, relativeTo } from '../hooks/paths'

test('a drive path keys case-folded with forward slashes; a POSIX path keeps its case', async () => {
  expect(keyOf('D:\\My Repo\\Src\\A.ts')).toBe('d:/my repo/src/a.ts')
  expect(keyOf('D:/my repo/src/a.ts')).toBe(keyOf('d:\\My Repo\\src\\a.ts'))
  expect(keyOf('/home/me/My Repo/A.ts')).toBe('/home/me/My Repo/A.ts')
})

test('resolves a relative path against the folder on Windows and POSIX, and keeps an absolute one', async () => {
  expect(absolute('D:\\repo\\', '.\\src\\a.ts')).toBe('D:/repo/src/a.ts')
  expect(absolute('D:/repo', 'C:\\other\\b.ts')).toBe('C:/other/b.ts')
  expect(absolute('/home/me/my repo', './src/a.ts')).toBe('/home/me/my repo/src/a.ts')
  expect(absolute('/home/me/repo', '/etc/hosts')).toBe('/etc/hosts')
})

test('makes a path relative to a folder: case-blind on a drive, case-exact on POSIX', async () => {
  expect(relativeTo('D:/Repo', 'd:\\repo\\src\\a.ts')).toBe('src/a.ts')
  expect(relativeTo('/home/me/repo/', '/home/me/repo/src/a.ts')).toBe('src/a.ts')
  expect(relativeTo('/home/me/Repo', '/home/me/repo/src/a.ts')).toBe('/home/me/repo/src/a.ts')
  expect(relativeTo('/home/me/repo', '/home/me/repository/a.ts')).toBe('/home/me/repository/a.ts')
})

test('takes the file name from either separator', async () => {
  expect(baseName('D:\\repo\\my file.ts')).toBe('my file.ts')
  expect(baseName('/home/me/my file.ts')).toBe('my file.ts')
})
