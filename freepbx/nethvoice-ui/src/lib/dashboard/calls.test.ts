//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest'
import { parseCallsSummary } from './calls'

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
