//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest'
import { DASHBOARD_CARDS, moveCardBy, moveCardTo, normalizeCardOrder } from './layout'

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
      'callsSummary',
      'calls',
      'hourlyCalls',
      'inboundRoutes',
    ])
    expect(moveCardTo(order, 'presence', 'calls')).toEqual([
      'devices',
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
      'callsSummary',
      'hourlyCalls',
      'trunks',
      'inboundRoutes',
    ])
    expect(moveCardBy(order, visible, 'trunks', 1)).toBe(order)
  })
})
