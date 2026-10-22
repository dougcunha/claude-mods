import { expect, test } from 'claude-code/testing'

import type { Hunk } from '../hooks/git'
import { coupling, restDelta, unitDelta } from '../hooks/metrics'
import type { Relation, Unit } from '../hooks/model'

const FILE = 'src/Orders/Cart.cs'

const unit = (id: string, extra: Partial<Unit>): Unit => ({
  id,
  name: id,
  kind: 'class',
  state: 'modified',
  file: FILE,
  container: 'Shop.Orders',
  members: [],
  ...extra,
})

/** A hunk from its base side `[start, count]` and its current side `[start, count]`. */
const hunk = ([oldStart, oldCount]: [number, number], [newStart, newCount]: [number, number]): Hunk => ({ oldStart, oldCount, newStart, newCount })

/** Sums the unit deltas and the rest, as the page would add them up against the file total. */
function total(units: readonly Unit[], hunks: readonly Hunk[]): { added: number; removed: number } {
  const parts = [...units.map(one => unitDelta(one, hunks)), restDelta(units, hunks)]

  return { added: parts.reduce((sum, part) => sum + (part.added ?? 0), 0), removed: parts.reduce((sum, part) => sum + (part.removed ?? 0), 0) }
}

test('TC-07 FR-10 a file with 1 unit gives the unit the whole file delta and leaves no rest', () => {
  const cart = unit('Cart', { range: { start: 1, end: 22 }, baseRange: { start: 1, end: 20 } })
  const hunks = [hunk([3, 2], [3, 4])]

  expect(unitDelta(cart, hunks)).toEqual({ added: 4, removed: 2 })
  expect(restDelta([cart], hunks)).toEqual({ added: 0, removed: 0 })
})

test('TC-07 FR-10 with 2 units and lines outside them, the unit deltas plus the rest equal the file delta', () => {
  const cart = unit('Cart', { range: { start: 5, end: 20 }, baseRange: { start: 3, end: 18 } })
  const order = unit('Order', { range: { start: 25, end: 40 }, baseRange: { start: 25, end: 45 } })
  // 2 using lines added at the top, 3 lines replace 1 in Cart, 2 lines removed from Order.
  const hunks = [hunk([0, 0], [1, 2]), hunk([10, 1], [12, 3]), hunk([30, 2], [34, 0])]

  expect([unitDelta(cart, hunks), unitDelta(order, hunks), restDelta([cart, order], hunks)]).toEqual([
    { added: 3, removed: 1 },
    { added: 0, removed: 2 },
    { added: 2, removed: 0 },
  ])
  expect(total([cart, order], hunks)).toEqual({ added: 5, removed: 3 })
})

const EDGES = [
  ['on the last line of the range', hunk([0, 0], [20, 1]), 1],
  ['just after the range', hunk([0, 0], [21, 1]), 0],
  ['on the first line of the range', hunk([0, 0], [5, 2]), 2],
  ['just before the range', hunk([0, 0], [3, 2]), 0],
] as const

for (const [name, edge, added] of EDGES) {
  test(`TC-07 a hunk ${name} counts ${added} lines for the unit`, () => {
    expect(unitDelta(unit('Cart', { state: 'added', range: { start: 5, end: 20 } }), [edge]).added).toBe(added)
  })
}

test('TC-07 an added unit counts its new lines, a deleted unit its base lines, and a context unit or unknown hunks no delta', () => {
  const added = unit('Cart', { state: 'added', range: { start: 1, end: 10 } })
  const deleted = unit('Basket', { state: 'deleted', range: { start: 1, end: 8 } })

  expect(unitDelta(added, [hunk([0, 0], [1, 10])])).toEqual({ added: 10, removed: 0 })
  expect(unitDelta(deleted, [hunk([1, 8], [0, 0])])).toEqual({ added: 0, removed: 8 })
  expect(unitDelta(unit('Item', { state: 'context' }), [hunk([1, 8], [0, 0])])).toEqual({ added: null, removed: null })
  expect(unitDelta(added, undefined)).toEqual({ added: null, removed: null })
})

test('TC-08 FR-11 Ce and Ca count distinct live relations: no removed relation, no self relation, no repeated pair', () => {
  const relations: Relation[] = [
    { from: 'Cart', to: 'Item', kind: 'dependency', state: 'unchanged' },
    { from: 'Cart', to: 'Item', kind: 'composition', state: 'added' },
    { from: 'Cart', to: 'Cart', kind: 'dependency', state: 'added' },
    { from: 'Item', to: 'Price', kind: 'dependency', state: 'removed' },
    { from: 'Price', to: 'Cart', kind: 'dependency', state: 'added' },
  ]

  expect(Object.fromEntries(coupling(['Cart', 'Item', 'Price'], relations))).toEqual({
    Cart: { ce: 1, ca: 1 },
    Item: { ce: 0, ca: 1 },
    Price: { ce: 1, ca: 0 },
  })
})
