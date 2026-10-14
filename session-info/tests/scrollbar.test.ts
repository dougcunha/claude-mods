import { expect, test } from 'claude-code/testing'

import { clampOffset, movedTo, offsetAt, scrollbar, targetAt } from '../hooks/scrollbar'
import type { ScrollTarget } from '../hooks/scrollbar'

const git: ScrollTarget = { key: 'git', start: 4, rows: 6, overflow: 10 }
const changes: ScrollTarget = { key: 'changes', start: 14, rows: 6, overflow: 3 }

test('the scrollbar is empty while the rows fit and holds one glyph per visible row otherwise', async () => {
  expect(scrollbar(5, 5, 0)).toEqual([])
  expect(scrollbar(30, 0, 0)).toEqual([])
  expect(scrollbar(20, 10, 0)).toHaveLength(10)
})

test('the thumb sits at the top, middle and bottom of the track with the window', async () => {
  expect(scrollbar(20, 10, 0).join('')).toBe('┃┃┃┃┃│││││')
  expect(scrollbar(20, 10, 10).join('')).toBe('│││││┃┃┃┃┃')
  expect(scrollbar(100, 10, 0)[0]).toBe('┃')
  expect(scrollbar(100, 10, 90)[9]).toBe('┃')
})

test('the offset stays between the first row and the last window', async () => {
  expect(clampOffset(-3, 20, 10)).toBe(0)
  expect(clampOffset(99, 20, 10)).toBe(10)
  expect(clampOffset(4, 8, 10)).toBe(0)
})

test('the wheel picks the tree nearest the pointer and a key press the first tree', async () => {
  const targets = [git, changes]
  expect(targetAt(targets, 4)).toBe(git)
  expect(targetAt(targets, 9)).toBe(git)
  expect(targetAt(targets, 11)).toBe(git)
  expect(targetAt(targets, 12)).toBe(changes)
  expect(targetAt(targets, 14)).toBe(changes)
  expect(targetAt(targets, 40)).toBe(changes)
  expect(targetAt(targets, 0)).toBe(git)
  expect(targetAt([changes], 0)).toBe(changes)
  expect(targetAt(targets, undefined)).toBe(git)
  expect(targetAt([], 3)).toBeUndefined()
  expect(targetAt([], undefined)).toBeUndefined()
})

test('a move stays between the first row and the last window of the tree', async () => {
  expect(movedTo(0, -1, git)).toBe(0)
  expect(movedTo(2, 3, git)).toBe(5)
  expect(movedTo(8, 5, git)).toBe(10)
  expect(movedTo(0, 1, changes)).toBe(1)
})

test('pressing the track jumps from the top of the list to the last window', async () => {
  expect(offsetAt(0, 20, 10)).toBe(0)
  expect(offsetAt(9, 20, 10)).toBe(10)
  expect(offsetAt(4, 20, 10)).toBe(4)
  expect(offsetAt(3, 8, 10)).toBe(0)
})
