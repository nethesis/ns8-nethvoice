//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest'
import {
  getBarRatios,
  horizontalBarPath,
  layoutVerticalBars,
  MIN_VISIBLE_BAR_RATIO,
  verticalBarPath,
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

describe('verticalBarPath', () => {
  it('should draw a bar anchored to the baseline with rounded top corners', () => {
    expect(verticalBarPath(10, 20, 50, 100)).toBe(
      'M10,100 V54 Q10,50 14,50 H26 Q30,50 30,54 V100 Z',
    )
  })

  it('should draw nothing for an empty bar', () => {
    expect(verticalBarPath(10, 20, 0, 100)).toBe('')
  })
})

describe('horizontalBarPath', () => {
  it('should draw a bar from the axis with rounded end corners', () => {
    expect(horizontalBarPath(10, 100, 16)).toBe('M0,10 H96 Q100,10 100,14 V22 Q100,26 96,26 H0 Z')
  })

  it('should draw nothing for an empty bar', () => {
    expect(horizontalBarPath(10, 0, 16)).toBe('')
  })
})

describe('layoutVerticalBars', () => {
  it('should center bars of the maximum width', () => {
    expect(layoutVerticalBars(2, 200, 50, 10)).toEqual({ barWidth: 50, offset: 45, step: 60 })
  })

  it('should shrink bars that do not fit', () => {
    expect(layoutVerticalBars(4, 100, 50, 12).barWidth).toBe(16)
  })

  it('should handle an empty chart', () => {
    expect(layoutVerticalBars(0, 100, 50, 12)).toEqual({ barWidth: 0, offset: 0, step: 0 })
  })
})
