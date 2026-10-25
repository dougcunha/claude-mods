import { expect, test } from 'claude-code/testing'

import { absolute, isAbsolute, join } from '../hooks/paths'

test('a relative folder resolves from a Windows working directory with back slashes and spaces', () => {
  expect(absolute('C:\\Work\\My Repo', '.claude/feature-progress/')).toBe('C:/Work/My Repo/.claude/feature-progress')
})

test('a relative folder with ./ resolves from a POSIX working directory', () => {
  expect(absolute('/home/dev/repo', './progress\\')).toBe('/home/dev/repo/progress')
})

test('an absolute folder stays as given, with forward slashes and no trailing slash', () => {
  expect(absolute('/home/dev/repo', 'D:\\Data\\progress\\')).toBe('D:/Data/progress')
  expect(absolute('C:/repo', '/var/progress/')).toBe('/var/progress')
})

test('a drive letter, a POSIX root and a UNC share are absolute; a relative path is not', () => {
  expect([isAbsolute('C:\\x'), isAbsolute('/x'), isAbsolute('\\\\server\\share'), isAbsolute('x/y')]).toEqual([true, true, true, false])
})

test('join puts one slash between a folder and a file name', () => {
  expect(join('C:/repo/progress/', 'a.json')).toBe('C:/repo/progress/a.json')
})
