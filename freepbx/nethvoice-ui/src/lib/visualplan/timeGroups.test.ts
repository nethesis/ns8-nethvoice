//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest'
import { formatTimeRule, parseTimeRule, validateTimeRule } from './timeGroups'

describe('time rules', () => {
  it('round-trips Asterisk time specs', () => {
    for (const spec of [
      '09:00-18:00|mon-fri|*|*',
      '*|sat|*|*',
      '*|*|25|dec',
      '08:30-12:30|*|1-15|jan-mar',
    ]) {
      expect(formatTimeRule(parseTimeRule(spec))).toBe(spec)
    }
  })

  it('validates times and days of the month', () => {
    expect(validateTimeRule(parseTimeRule('9:00-18:00|*|32|*'))).toEqual([
      'startTime',
      'startDate',
      'endDate',
    ])
    expect(validateTimeRule(parseTimeRule('*|*|*|*'))).toEqual(['always'])
    expect(validateTimeRule(parseTimeRule('*|sat|*|*'))).toEqual([])
  })
})
