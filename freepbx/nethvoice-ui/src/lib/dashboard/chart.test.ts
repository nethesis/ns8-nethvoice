//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest'
import { getBarRatios, getCenteredBarDomain, MIN_VISIBLE_BAR_RATIO } from './chart'

describe('getBarRatios', () => {
  it('should scale values to the largest one', () => {
    expect(getBarRatios([50, 100, 25])).toEqual([0.5, 1, 0.25])
  })

  it('should keep small non-zero values visible', () => {
    expect(getBarRatios([1, 1000])[0]).toBe(MIN_VISIBLE_BAR_RATIO)
  })

  it('should return zeros when every value is zero', () => {
    expect(getBarRatios([0, 0])).toEqual([0, 0])
  })
})

describe('getCenteredBarDomain', () => {
  it('should center the bars and keep the gap between them', () => {
    const [start, end] = getCenteredBarDomain(4, 610, 49, 12)

    expect((start + end) / 2).toBe(1.5)
    expect(610 / (end - start)).toBe(61)
  })

  it('should return a default domain for an empty chart', () => {
    expect(getCenteredBarDomain(0, 300, 49, 12)).toEqual([0, 1])
    expect(getCenteredBarDomain(3, 0, 49, 12)).toEqual([0, 1])
  })
})
