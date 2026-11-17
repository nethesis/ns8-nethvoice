//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest'
import {
  DASHBOARD_CARDS,
  findCardInAdjacentRow,
  moveCardBy,
  moveCardTo,
  normalizeCardOrder,
  type CardRect,
} from './layout'

describe('normalizeCardOrder', () => {
  it('should use the default order without a saved one', () => {
    expect(normalizeCardOrder(undefined)).toEqual([...DASHBOARD_CARDS])
    expect(normalizeCardOrder('presence')).toEqual([...DASHBOARD_CARDS])
  })

  it('should keep the saved order, drop unknown cards and add the missing ones', () => {
    expect(normalizeCardOrder(['trunks', 'unknown', 'presence', 'trunks', 3])).toEqual([
      'trunks',
      'presence',
      'devices',
      'phoneStatus',
      'callsSummary',
      'calls',
      'hourlyCalls',
      'inboundRoutes',
    ])
  })
})

describe('moveCardTo', () => {
  it('should move a card to the position of another one', () => {
    const order = [...DASHBOARD_CARDS]

    expect(moveCardTo(order, 'trunks', 'presence')).toEqual([
      'trunks',
      'presence',
      'devices',
      'phoneStatus',
      'callsSummary',
      'calls',
      'hourlyCalls',
      'inboundRoutes',
    ])
    expect(moveCardTo(order, 'presence', 'calls')).toEqual([
      'devices',
      'phoneStatus',
      'callsSummary',
      'calls',
      'presence',
      'hourlyCalls',
      'trunks',
      'inboundRoutes',
    ])
  })

  it('should keep the order when the card does not move', () => {
    const order = [...DASHBOARD_CARDS]

    expect(moveCardTo(order, 'calls', 'calls')).toBe(order)
  })
})

describe('moveCardBy', () => {
  it('should move a card among the visible ones', () => {
    const order = [...DASHBOARD_CARDS]
    const visible: typeof order = ['presence', 'calls', 'trunks']

    expect(moveCardBy(order, visible, 'calls', -1)).toEqual([
      'calls',
      'presence',
      'devices',
      'phoneStatus',
      'callsSummary',
      'hourlyCalls',
      'trunks',
      'inboundRoutes',
    ])
    expect(moveCardBy(order, visible, 'trunks', 1)).toBe(order)
  })
})

describe('findCardInAdjacentRow', () => {
  const rects: CardRect[] = [
    { card: 'presence', top: 0, left: 0, width: 100 },
    { card: 'devices', top: 0, left: 120, width: 100 },
    { card: 'phoneStatus', top: 0, left: 240, width: 100 },
    { card: 'callsSummary', top: 0, left: 360, width: 100 },
    { card: 'calls', top: 300, left: 0, width: 220 },
    { card: 'hourlyCalls', top: 300, left: 240, width: 220 },
    { card: 'trunks', top: 700.5, left: 0, width: 220 },
  ]

  it('should find the closest card in the next row', () => {
    expect(findCardInAdjacentRow(rects, 'devices', 'down')).toBe('calls')
    expect(findCardInAdjacentRow(rects, 'phoneStatus', 'down')).toBe('hourlyCalls')
    expect(findCardInAdjacentRow(rects, 'hourlyCalls', 'down')).toBe('trunks')
  })

  it('should find the closest card in the previous row', () => {
    expect(findCardInAdjacentRow(rects, 'hourlyCalls', 'up')).toBe('phoneStatus')
    expect(findCardInAdjacentRow(rects, 'trunks', 'up')).toBe('calls')
  })

  it('should treat cards a pixel apart as the same row', () => {
    const shifted: CardRect[] = [
      { card: 'presence', top: 0, left: 0, width: 100 },
      { card: 'devices', top: 0.6, left: 120, width: 100 },
    ]

    expect(findCardInAdjacentRow(shifted, 'presence', 'down')).toBeNull()
  })

  it('should not move past the first or the last row', () => {
    expect(findCardInAdjacentRow(rects, 'presence', 'up')).toBeNull()
    expect(findCardInAdjacentRow(rects, 'trunks', 'down')).toBeNull()
    expect(findCardInAdjacentRow(rects, 'inboundRoutes', 'down')).toBeNull()
  })

  it('should move along a single column', () => {
    const column: CardRect[] = [
      { card: 'presence', top: 0, left: 0, width: 300 },
      { card: 'devices', top: 200, left: 0, width: 300 },
      { card: 'calls', top: 400, left: 0, width: 300 },
    ]

    expect(findCardInAdjacentRow(column, 'devices', 'down')).toBe('calls')
    expect(findCardInAdjacentRow(column, 'devices', 'up')).toBe('presence')
  })
})
