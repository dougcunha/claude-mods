import { expect, mock, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

import { REPORT_TOOL } from '../hooks/spec'

type On = Parameters<TestBody>[1]

const NOW = Date.UTC(2026, 9, 25, 10, 0, 0)
const MINUTE_MS = 60_000

const band = (bodyColumns = 100, hasSurvey = false) =>
  ({
    plugin: 'feature-progress',
    component: 'AbovePrompt',
    props: { hasSurvey, isWorking: false, maxRows: 20, bodyColumns, scroll: { offset: 0, bodyRows: 20 }, view: {} },
  }) as const

/** An empty storage folder whose writes succeed, so reports land in the state; beneath the plugins, the engine draws `beneath`. */
function disk(on: On, beneath = ''): void {
  on('session.cwd', async () => ({ value: '/repo' }))
  on('fs.exists', async () => ({ value: false }))
  on('fs.write', async () => ({ value: undefined }))
  on('ui.render', { component: 'AbovePrompt' }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    return (beneath === '' ? h(Box, { key: 'engine' }) : h(Text, { key: 'beneath' }, beneath)) as never
  })
}

const report = (id: string, title: string, state: string, extra: object = {}) =>
  ({ tool: REPORT_TOOL, feature: { id, title, state, ...extra }, tasks: [{ id: 'T01', title: 'a', state: 'done' }, { id: 'T02', title: 'b' }] }) as never

for (const surface of ['terminal', 'desktop'] as const) {
  test(`TC-14 FR-09 the band shows the open feature updated last, with its stage and count (${surface})`, async ($, on) => {
    const clock = mock.clock(on, { now: NOW })
    disk(on)
    await $.tool.call(report('checkout', 'Checkout', 'active'))
    await clock.advance(MINUTE_MS)
    await $.tool.call(report('refunds', 'Refunds', 'review', { round: 2 }))

    const ui = await $.ui.mount({ ...band(), surface })

    expect(await ui.find({ type: 'Text', text: 'Refunds' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: ' review #2 ' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: ' 1/2' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: '◎ ' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: '━━━━' })).toBeDefined()
    await ui.unmount()
  })
}

test('TC-14 FR-09 a done feature leaves the band to the next open one, and with none the band draws nothing', async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  disk(on)
  await $.tool.call(report('checkout', 'Checkout', 'active'))
  await clock.advance(MINUTE_MS)
  await $.tool.call(report('refunds', 'Refunds', 'done'))

  const one = await $.ui.mount({ ...band(), surface: 'terminal' })
  expect(await one.find({ type: 'Text', text: 'Checkout' })).toBeDefined()
  await one.unmount()

  await $.tool.call(report('checkout', 'Checkout', 'done'))
  const none = await $.ui.mount({ ...band(), surface: 'terminal' })
  expect(await none.find({ key: 'feature-progress-band' })).toBeUndefined()
  await none.unmount()
})

test('TC-14 DEC-06 the band draws above what the hooks beneath draw, and yields to a survey', async ($, on) => {
  mock.clock(on, { now: NOW })
  disk(on, 'beneath')
  await $.tool.call(report('checkout', 'Checkout', 'active'))

  const both = await $.ui.mount({ ...band(), surface: 'terminal' })
  expect(await both.find({ key: 'feature-progress-band' })).toBeDefined()
  expect(await both.find({ type: 'Text', text: 'beneath' })).toBeDefined()
  await both.unmount()

  const survey = await $.ui.mount({ ...band(100, true), surface: 'terminal' })
  expect(await survey.find({ key: 'feature-progress-band' })).toBeUndefined()
  expect(await survey.find({ type: 'Text', text: 'beneath' })).toBeDefined()
  await survey.unmount()
})

test('TC-14 NFR-05 on a narrow band the meter goes, the title shortens and the stage and the count stay whole', async ($, on) => {
  mock.clock(on, { now: NOW })
  disk(on)
  await $.tool.call(report('checkout', 'A checkout with a very long feature title', 'fixing', { round: 1 }))

  const ui = await $.ui.mount({ ...band(30), surface: 'terminal' })

  expect(await ui.find({ type: 'Text', text: 'A checko…' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: ' fixing #1 ' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: ' 1/2' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '━━━━' })).toBeUndefined()
  await ui.unmount()
})

test('TC-17 FR-14 the stale marker shows after the limit and a new report removes it', { options: { staleMinutes: 30 } }, async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  disk(on)
  await $.tool.call(report('checkout', 'Checkout', 'active'))
  await clock.advance(31 * MINUTE_MS)

  const stale = await $.ui.mount({ ...band(), surface: 'terminal' })
  expect(await stale.find({ type: 'Text', text: '  ⚠ stale' })).toBeDefined()
  await stale.unmount()

  await $.tool.call(report('checkout', 'Checkout', 'active'))
  const fresh = await $.ui.mount({ ...band(), surface: 'terminal' })
  expect(await fresh.find({ type: 'Text', text: ' active ' })).toBeDefined()
  expect(await fresh.find({ type: 'Text', text: '  ⚠ stale' })).toBeUndefined()
  await fresh.unmount()
})

test('the icons option draws the glyph of its set', { options: { icons: 'emoji' } }, async ($, on) => {
  mock.clock(on, { now: NOW })
  disk(on)
  await $.tool.call(report('checkout', 'Checkout', 'qa'))

  const ui = await $.ui.mount({ ...band(), surface: 'terminal' })

  expect(await ui.find({ type: 'Text', text: '🧪 ' })).toBeDefined()
  await ui.unmount()
})

test('TC-26 FR-22 with showBand off the band draws nothing and leaves the hooks beneath', { options: { showBand: false } }, async ($, on) => {
  mock.clock(on, { now: NOW })
  disk(on, 'beneath')
  await $.tool.call(report('checkout', 'Checkout', 'active'))

  const ui = await $.ui.mount({ ...band(), surface: 'terminal' })

  expect(await ui.find({ key: 'feature-progress-band' })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: 'beneath' })).toBeDefined()
  await ui.unmount()
})

for (const showBand of [true, false]) {
  test(`TC-26 DEC-13 /feature-progress band flips showBand through /config (from ${showBand})`, { options: { showBand } }, async ($, on) => {
    const sets: [string, unknown][] = []
    on('config.set', async (_, e) => (sets.push([e.key, e.value]), { value: e.value }))

    const answer = await $.command.run({ command: 'feature-progress', args: 'band' } as never)

    expect(sets).toEqual([['feature-progress.showBand', !showBand]])
    expect(answer).toMatchObject({ text: showBand ? 'Feature progress band hidden.' : 'Feature progress band shown.' })
  })
}

test('TC-26 DEC-13 a refused change answers the reason', async ($, on) => {
  on('config.set', async () => ({ deny: 'a managed setting owns this row' }))

  const answer = await $.command.run({ command: 'feature-progress', args: 'band' } as never)

  expect(answer).toMatchObject({ text: 'feature-progress: a managed setting owns this row' })
})
