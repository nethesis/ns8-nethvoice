//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest'
import {
  formatCallCount,
  formatDateTime,
  formatPointTime,
  formatTimeTick,
  getBarRatios,
  getCenteredBarDomain,
  getIntegerTicks,
  getMaxTicks,
  getTimeTicks,
  MIN_VISIBLE_BAR_RATIO,
  splitIntoSegments,
  summarizeSeries,
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

const hoursFrom = (start: Date, count: number) =>
  Array.from({ length: count }, (_, index) => start.getTime() + index * 3600 * 1000)

const at = (day: number, hour: number) => new Date(2026, 10, day, hour).getTime()

describe('getMaxTicks', () => {
  it('should leave room for each label and keep at least two ticks', () => {
    expect(getMaxTicks(640)).toBe(10)
    expect(getMaxTicks(300)).toBe(4)
    expect(getMaxTicks(0)).toBe(2)
  })
})

describe('getTimeTicks', () => {
  const day = hoursFrom(new Date(2026, 10, 15, 15), 24)
  const week = hoursFrom(new Date(2026, 10, 9, 15), 168)
  const fortnight = hoursFrom(new Date(2026, 10, 1, 15), 360)

  it('should mark every third hour of the last 24 hours when there is room', () => {
    expect(getTimeTicks(day, '24h', 8).map((time) => new Date(time).getHours())).toEqual([
      15, 18, 21, 0, 3, 6, 9, 12,
    ])
  })

  it('should use a wider hour step on a narrow chart', () => {
    expect(getTimeTicks(day, '24h', 4).map((time) => new Date(time).getHours())).toEqual([
      18, 0, 6, 12,
    ])
  })

  it('should mark the start of each day of the last 7 days', () => {
    const ticks = getTimeTicks(week, '7d', 8)

    expect(ticks).toHaveLength(7)
    expect(ticks.every((time) => new Date(time).getHours() === 0)).toBe(true)
    expect(ticks.at(-1)).toBe(at(16, 0))
  })

  it('should skip days to fit the room and keep the most recent one', () => {
    const ticks = getTimeTicks(fortnight, '15d', 8)

    expect(ticks.length).toBeLessThanOrEqual(8)
    expect(ticks.at(-1)).toBe(at(16, 0))
    expect(ticks[1] - ticks[0]).toBe(2 * 24 * 3600 * 1000)
  })
})

describe('formatTimeTick', () => {
  it('should show the hour for the last 24 hours and the day otherwise', () => {
    expect(formatTimeTick(at(16, 9), '24h', 'en')).toBe('09:00')
    expect(formatTimeTick(at(16, 0), '7d', 'en')).toBe('Nov 16')
    expect(formatTimeTick(at(16, 0), '15d', 'it')).toBe('16 nov')
  })
})

describe('formatPointTime', () => {
  it('should show the day and the hour on 24 hours', () => {
    expect(formatPointTime(at(16, 14), 'en')).toBe('Mon, Nov 16, 14:00')
    expect(formatPointTime(at(16, 14), 'it')).toBe('lun 16 nov, 14:00')
  })
})

describe('formatDateTime', () => {
  it('should show the date with the year and the time', () => {
    expect(formatDateTime(new Date(2026, 10, 16, 14, 5).getTime(), 'en')).toBe(
      'Nov 16, 2026, 14:05',
    )
  })
})

describe('formatCallCount', () => {
  it('should round to one decimal and hide the decimals of whole numbers', () => {
    expect(formatCallCount(4, 'en')).toBe('4')
    expect(formatCallCount(2.54, 'en')).toBe('2.5')
    expect(formatCallCount(2.96, 'en')).toBe('3')
    expect(formatCallCount(1.25, 'it')).toBe('1,3')
    expect(formatCallCount(1234, 'it')).toBe('1234')
  })
})

describe('splitIntoSegments', () => {
  it('should break the series where an hour has no data', () => {
    expect(
      splitIntoSegments([
        { time: 1, calls: null },
        { time: 2, calls: 0 },
        { time: 3, calls: 2 },
        { time: 4, calls: null },
        { time: 5, calls: null },
        { time: 6, calls: 1.5 },
      ]),
    ).toEqual([
      [
        { time: 2, calls: 0 },
        { time: 3, calls: 2 },
      ],
      [{ time: 6, calls: 1.5 }],
    ])
  })

  it('should return no segment without data', () => {
    expect(splitIntoSegments([{ time: 1, calls: null }])).toEqual([])
  })
})

describe('summarizeSeries', () => {
  it('should add up the calls and find the busiest hour, ignoring the gaps', () => {
    expect(
      summarizeSeries([
        { time: 1, calls: null },
        { time: 2, calls: 2.5 },
        { time: 3, calls: 4 },
        { time: 4, calls: 1 },
      ]),
    ).toEqual({ total: 7.5, peak: { time: 3, calls: 4 }, hasData: true })
  })

  it('should tell an empty period from a period without data', () => {
    expect(summarizeSeries([{ time: 1, calls: 0 }])).toEqual({
      total: 0,
      peak: null,
      hasData: true,
    })
    expect(summarizeSeries([{ time: 1, calls: null }])).toEqual({
      total: 0,
      peak: null,
      hasData: false,
    })
  })
})
