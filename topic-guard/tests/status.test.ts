import { expect, test } from 'claude-code/testing'

import { judgedText, skippedText, statusText } from '../hooks/status'
import type { StatusView } from '../hooks/status'

const VIEW: StatusView = { analyze: true, judge: 'model', model: 'haiku', isJevDown: false, last: null }

const STATUSES = [
  ['the analysis off', { ...VIEW, analyze: false, last: 'related at 45%' }, 'off'],
  ['the model judging, nothing done yet', VIEW, 'haiku'],
  ['the model judging, with a last action', { ...VIEW, last: 'related at 45%' }, 'haiku · related at 45%'],
  ['Jev judging', { ...VIEW, judge: 'jev', last: 'related at 45%' }, 'Jev · related at 45%'],
  ['Jev down', { ...VIEW, judge: 'jev', isJevDown: true }, 'Jev down, haiku judging'],
  ['the model judging while a stale Jev flag is set', { ...VIEW, isJevDown: true }, 'haiku'],
] as const

for (const [name, view, expected] of STATUSES) {
  test(`statusText: ${name} reads ${expected}`, async () => {
    expect(statusText(view)).toBe(expected)
  })
}

const GATE = { percent: 62, minPercent: 70, keptAt: null, recheckStep: 10 }

test('skippedText names the percent from which the mod judges again: the minimum, or the kept point plus the step', async () => {
  expect(skippedText(GATE)).toBe('skipped at 62%, judging from 70%')
  expect(skippedText({ ...GATE, minPercent: 20, keptAt: 62 })).toBe('skipped at 62%, judging from 72%')
  expect(skippedText({ ...GATE, keptAt: 62 })).toBe('skipped at 62%, judging from 70%')
})

test('judgedText words each outcome with the context percent', async () => {
  expect(judgedText('new-topic', 62)).toBe('held a new topic at 62%')
  expect(judgedText('related', 45)).toBe('related at 45%')
  expect(judgedText('none', 0)).toBe('no judgment at 0%')
})
