//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest'
import {
  formatHourOfDay,
  getBarRatios,
  getCenteredBarDomain,
  getIntegerTicks,
  HOUR_TICKS,
  MIN_VISIBLE_BAR_RATIO,
} from './chart'

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

describe('HOUR_TICKS', () => {
  it('should mark every third hour of the day', () => {
    expect(HOUR_TICKS).toEqual([0, 3, 6, 9, 12, 15, 18, 21])
  })
})

describe('formatHourOfDay', () => {
  it('should format the hour on 24 hours in every language', () => {
    expect(formatHourOfDay(0, 'en')).toBe('00:00')
    expect(formatHourOfDay(15, 'en')).toBe('15:00')
    expect(formatHourOfDay(9, 'it')).toBe('09:00')
  })
})

describe('getIntegerTicks', () => {
  it('should count by one for small values', () => {
    expect(getIntegerTicks(0)).toEqual([0, 1])
    expect(getIntegerTicks(1)).toEqual([0, 1])
    expect(getIntegerTicks(3)).toEqual([0, 1, 2, 3])
    expect(getIntegerTicks(4)).toEqual([0, 1, 2, 3, 4])
  })

  it('should use a round step that covers the maximum', () => {
    expect(getIntegerTicks(7)).toEqual([0, 2, 4, 6, 8])
    expect(getIntegerTicks(37)).toEqual([0, 10, 20, 30, 40])
    expect(getIntegerTicks(120)).toEqual([0, 50, 100, 150])
  })

  it('should never return fractional ticks', () => {
    for (const max of [1, 2, 5, 9, 13, 99, 1001]) {
      expect(getIntegerTicks(max).every(Number.isInteger)).toBe(true)
    }
  })
})
