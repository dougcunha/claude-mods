import { expect, test } from 'claude-code/testing'

import { settingsOf } from '../hooks/settings'

test('the manifest defaults apply to missing options', () => {
  expect(settingsOf({})).toEqual({ folder: '.claude/feature-progress/', staleMinutes: 30, editor: 'auto', showBand: true, paneBackground: '', icons: 'unicode' })
})

test('set options are kept', () => {
  expect(settingsOf({ folder: 'progress', staleMinutes: 0, editor: 'system', showBand: false, paneBackground: ' #2e3440 ', icons: 'nerd' })).toEqual({
    folder: 'progress',
    staleMinutes: 0,
    editor: 'system',
    showBand: false,
    paneBackground: '#2e3440',
    icons: 'nerd',
  })
})

test('an empty folder, a negative limit, an unknown editor or icon set, a non-boolean showBand and a non-string background fall back to the defaults', () => {
  expect(settingsOf({ folder: '  ', staleMinutes: -5, editor: 'vim', showBand: 'no', paneBackground: 7, icons: 'ascii' })).toEqual({
    folder: '.claude/feature-progress/',
    staleMinutes: 30,
    editor: 'auto',
    showBand: true,
    paneBackground: '',
    icons: 'unicode',
  })
})
