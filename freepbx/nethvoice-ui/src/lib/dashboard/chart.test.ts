//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest'
import {
  formatCallCount,
  formatDateTime,
  formatPointTime,
  formatPeriod,
  formatTimeTick,
  getBarRatios,
  getCenteredBarDomain,
  getIntegerTicks,
  getMaxTicks,
  getTimeTicks,
  getVisiblePoints,
  getZoomDomain,
  HOUR_MS,
  keepZoom,
  MIN_VISIBLE_BAR_RATIO,
  MIN_ZOOM_SPAN,
  panZoom,
  scaleZoom,
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
  const twoDays = hoursFrom(new Date(2026, 10, 15, 15), 48)
  const week = hoursFrom(new Date(2026, 10, 9, 15), 168)
  const fortnight = hoursFrom(new Date(2026, 10, 1, 15), 360)

  it('should mark every third hour of 24 hours when there is room', () => {
    expect(getTimeTicks(day, 8).map((time) => new Date(time).getHours())).toEqual([
      15, 18, 21, 0, 3, 6, 9, 12,
    ])
  })

  it('should use a wider hour step on a narrow chart', () => {
    expect(getTimeTicks(day, 4).map((time) => new Date(time).getHours())).toEqual([18, 0, 6, 12])
  })

  it('should keep marking hours on a zoomed span of a few hours or days', () => {
    expect(getTimeTicks(day.slice(0, 4), 8).map((time) => new Date(time).getHours())).toEqual([
      15, 16, 17, 18,
    ])
    expect(getTimeTicks(twoDays, 8).map((time) => new Date(time).getHours())).toEqual([
      18, 0, 6, 12, 18, 0, 6, 12,
    ])
  })

  it('should mark the start of each day of a week', () => {
    const ticks = getTimeTicks(week, 8)

    expect(ticks).toHaveLength(7)
    expect(ticks.every((time) => new Date(time).getHours() === 0)).toBe(true)
    expect(ticks.at(-1)).toBe(at(16, 0))
  })

  it('should skip days to fit the room and keep the most recent one', () => {
    const ticks = getTimeTicks(fortnight, 8)

    expect(ticks.length).toBeLessThanOrEqual(8)
    expect(ticks.at(-1)).toBe(at(16, 0))
    expect(ticks[1] - ticks[0]).toBe(2 * 24 * 3600 * 1000)
  })
})

describe('formatTimeTick', () => {
  it('should show the day at midnight and the hour otherwise', () => {
    expect(formatTimeTick(at(16, 9), 'en')).toBe('09:00')
    expect(formatTimeTick(at(16, 0), 'en')).toBe('Nov 16')
    expect(formatTimeTick(at(16, 0), 'it')).toBe('16 nov')
  })
})

describe('formatPeriod', () => {
  it('should show the start and the end of the period', () => {
    expect(formatPeriod([at(18, 10), at(19, 22)], 'en')).toBe(
      'Nov 18, 10:00\u2009–\u2009Nov 19, 22:00',
    )
    expect(formatPeriod([at(18, 10), at(19, 22)], 'it')).toBe(
      '18 nov, 10:00\u2009–\u200919 nov, 22:00',
    )
    expect(formatPeriod([at(18, 10), at(18, 22)], 'en')).toBe('Nov 18, 10:00\u2009–\u200922:00')
  })
})

describe('getVisiblePoints', () => {
  it('should keep the points inside the period, ends included', () => {
    const series = hoursFrom(new Date(2026, 10, 16, 0), 6).map((time) => ({ time, calls: 1 }))

    expect(getVisiblePoints(series, [at(16, 1), at(16, 3)]).map((point) => point.time)).toEqual([
      at(16, 1),
      at(16, 2),
      at(16, 3),
    ])
  })

  it('should summarize only the visible points', () => {
    const series = hoursFrom(new Date(2026, 10, 16, 0), 6).map((time, index) => ({
      time,
      calls: index,
    }))

    expect(summarizeSeries(getVisiblePoints(series, [at(16, 1), at(16, 3)]))).toEqual({
      total: 6,
      peak: { time: at(16, 3), calls: 3 },
      hasData: true,
    })
  })
})

describe('getZoomDomain', () => {
  const data: [number, number] = [at(1, 0), at(15, 0)]

  it('should zoom to the selection rounded to the hour', () => {
    expect(getZoomDomain(at(5, 10) + 20 * 60 * 1000, at(6, 4) - 10 * 60 * 1000, data)).toEqual([
      at(5, 10),
      at(6, 4),
    ])
  })

  it('should accept a selection dragged from right to left', () => {
    expect(getZoomDomain(at(6, 4), at(5, 10), data)).toEqual([at(5, 10), at(6, 4)])
  })

  it('should widen a short selection around its center to the minimum span', () => {
    expect(MIN_ZOOM_SPAN).toBe(3 * HOUR_MS)
    expect(getZoomDomain(at(5, 10), at(5, 11), data)).toEqual([at(5, 9), at(5, 12)])
    expect(getZoomDomain(at(5, 10), at(5, 10), data)).toEqual([at(5, 9), at(5, 12)])
  })

  it('should keep the selection inside the data', () => {
    expect(getZoomDomain(at(1, 0) - 5 * HOUR_MS, at(1, 6), data)).toEqual([at(1, 0), at(1, 6)])
    expect(getZoomDomain(at(14, 23), at(15, 0) + HOUR_MS, data)).toEqual([at(14, 21), at(15, 0)])
  })

  it('should not zoom to the whole data or to data shorter than the minimum span', () => {
    expect(getZoomDomain(at(1, 0) - HOUR_MS, at(15, 0) + HOUR_MS, data)).toBeNull()
    expect(getZoomDomain(at(1, 0), at(1, 1), [at(1, 0), at(1, 2)])).toBeNull()
  })
})

describe('scaleZoom', () => {
  const data: [number, number] = [at(1, 0), at(15, 0)]

  it('should zoom in and out around the center of the period', () => {
    expect(scaleZoom([at(5, 0), at(7, 0)], 0.5, data)).toEqual([at(5, 12), at(6, 12)])
    expect(scaleZoom([at(5, 0), at(7, 0)], 2, data)).toEqual([at(4, 0), at(8, 0)])
  })

  it('should stop at the minimum span and reset when it covers the whole data', () => {
    expect(scaleZoom([at(5, 10), at(5, 13)], 0.5, data)).toEqual([at(5, 10), at(5, 13)])
    expect(scaleZoom([at(2, 0), at(14, 0)], 2, data)).toBeNull()
  })
})

describe('panZoom', () => {
  const data: [number, number] = [at(1, 0), at(15, 0)]

  it('should move the period and stop at the edges of the data', () => {
    expect(panZoom([at(5, 0), at(7, 0)], 0.25, data)).toEqual([at(5, 12), at(7, 12)])
    expect(panZoom([at(5, 0), at(7, 0)], -0.25, data)).toEqual([at(4, 12), at(6, 12)])
    expect(panZoom([at(1, 6), at(3, 6)], -0.25, data)).toEqual([at(1, 0), at(3, 0)])
    expect(panZoom([at(13, 0), at(15, 0)], 0.25, data)).toEqual([at(13, 0), at(15, 0)])
  })

  it('should move by at least one hour', () => {
    expect(panZoom([at(5, 0), at(5, 3)], 0.1, data)).toEqual([at(5, 1), at(5, 4)])
  })
})

describe('keepZoom', () => {
  it('should keep a period that is still inside the refreshed data', () => {
    expect(keepZoom([at(5, 0), at(6, 0)], [at(1, 1), at(15, 1)])).toEqual([at(5, 0), at(6, 0)])
  })

  it('should drop a period that left the data or a missing zoom', () => {
    expect(keepZoom([at(1, 0), at(2, 0)], [at(1, 1), at(15, 1)])).toBeNull()
    expect(keepZoom([at(1, 0), at(15, 0)], [at(1, 0), at(15, 0)])).toBeNull()
    expect(keepZoom(null, [at(1, 0), at(15, 0)])).toBeNull()
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
