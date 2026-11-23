//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it, vi } from 'vitest'
import { api } from '@/lib/api/client'
import {
  getDashboardCallsHistory,
  isHistoryPartial,
  parseCallsHistory,
  parseCallsSummary,
} from './calls'

vi.mock('@/lib/api/client', () => ({ api: { GET: vi.fn() } }))

describe('parseCallsSummary', () => {
  it('should read the outcomes and the incoming calls by hour', () => {
    expect(
      parseCallsSummary({
        total: 4,
        answered: 2,
        missed: 1,
        invalid: 1,
        calls_by_hour: [0, 3],
      }),
    ).toEqual({ total: 4, answered: 2, missed: 1, invalid: 1, callsByHour: [0, 3] })
  })

  it('should reject negative counts and more than 24 hours', () => {
    const valid = { total: 0, answered: 0, missed: 0, invalid: 0, calls_by_hour: [] }

    expect(() => parseCallsSummary({ ...valid, missed: -1 })).toThrow()
    expect(() => parseCallsSummary({ ...valid, calls_by_hour: Array(25).fill(0) })).toThrow()
  })
})

const HISTORY = {
  total: 1,
  answered: 1,
  missed: 0,
  invalid: 0,
  calls_by_hour: [1],
  range: '24h',
  source: 'cdr',
  history_start: 1_763_290_800,
  series: [
    { time: 1_763_290_800, calls: 2.5 },
    { time: 1_763_294_400, calls: null },
    { time: 1_763_298_000, calls: 0 },
  ],
}

describe('parseCallsHistory', () => {
  it('should read the range, the start of the history and the series in milliseconds', () => {
    expect(parseCallsHistory(HISTORY)).toEqual({
      range: '24h',
      historyStart: 1_763_290_800_000,
      series: [
        { time: 1_763_290_800_000, calls: 2.5 },
        { time: 1_763_294_400_000, calls: null },
        { time: 1_763_298_000_000, calls: 0 },
      ],
    })
  })

  it('should not expose where the data come from', () => {
    expect(parseCallsHistory(HISTORY)).not.toHaveProperty('source')
  })

  it('should accept a history without data', () => {
    expect(parseCallsHistory({ ...HISTORY, history_start: null }).historyStart).toBeNull()
  })

  it('should reject an unknown range, negative calls and a missing series', () => {
    expect(() => parseCallsHistory({ ...HISTORY, range: '1h' })).toThrow()
    expect(() =>
      parseCallsHistory({ ...HISTORY, series: [{ time: 1_763_290_800, calls: -1 }] }),
    ).toThrow()
    expect(() => parseCallsHistory({ ...HISTORY, series: undefined })).toThrow()
  })
})

describe('getDashboardCallsHistory', () => {
  it('should always request the last 15 days', async () => {
    vi.mocked(api.GET).mockResolvedValue({ data: HISTORY } as never)

    await getDashboardCallsHistory()

    expect(api.GET).toHaveBeenCalledWith('/dashboard/calls', {
      params: { query: { range: '15d' } },
      signal: undefined,
    })
  })
})

describe('isHistoryPartial', () => {
  const history = parseCallsHistory(HISTORY)

  it('should be partial when the history starts after the first hour of the period', () => {
    expect(isHistoryPartial({ ...history, historyStart: history.series[1].time })).toBe(true)
  })

  it('should not be partial when the history covers the period or is empty', () => {
    expect(isHistoryPartial(history)).toBe(false)
    expect(isHistoryPartial({ ...history, historyStart: null })).toBe(false)
  })
})
