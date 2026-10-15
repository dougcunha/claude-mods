import { expect, test } from 'claude-code/testing'

import { customTitle, titleAlign, titleColor, TITLE_LIMIT } from '../hooks/title'

test('a custom title is trimmed, and a missing or blank one is empty', async () => {
  expect(customTitle('  Work account  ')).toBe('Work account')
  expect(customTitle('   ')).toBe('')
  expect(customTitle(undefined)).toBe('')
  expect(customTitle(42)).toBe('')
})

test('a custom title loses control characters and is cut at the limit', async () => {
  expect(customTitle('Work\n\u0007account')).toBe('Work  account')
  expect(customTitle('x'.repeat(TITLE_LIMIT + 10))).toBe('x'.repeat(TITLE_LIMIT))
  expect(customTitle(`${'x'.repeat(TITLE_LIMIT - 1)} tail`)).toBe('x'.repeat(TITLE_LIMIT - 1))
})

test('the title alignment is left unless the setting says center or right', async () => {
  expect(['center', 'right', 'left'].map(titleAlign)).toEqual(['center', 'right', 'left'])
  expect([undefined, '', 'middle', 'RIGHT', 3].map(titleAlign)).toEqual(['left', 'left', 'left', 'left', 'left'])
})

test('the title color is trimmed and a non-string is empty', async () => {
  expect(titleColor(' #ff8700 ')).toBe('#ff8700')
  expect(titleColor('warning')).toBe('warning')
  expect(titleColor(undefined)).toBe('')
})
