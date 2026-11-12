//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest'
import { parseCount } from './counters'

describe('parseCount', () => {
  it('should accept a non-negative integer', () => {
    expect(parseCount(4)).toBe(4)
    expect(parseCount(0)).toBe(0)
  })

  it('should reject anything else', () => {
    expect(() => parseCount('4')).toThrow()
    expect(() => parseCount(-1)).toThrow()
    expect(() => parseCount(undefined)).toThrow()
  })
})
