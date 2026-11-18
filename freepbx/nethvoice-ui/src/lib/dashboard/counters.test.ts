//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it, vi } from 'vitest'
import { api } from '@/lib/api/client'
import { getDashboardCounter, parseCount } from './counters'

vi.mock('@/lib/api/client', () => ({ api: { GET: vi.fn() } }))

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

describe('getDashboardCounter', () => {
  it('should count the physical phones from the dashboard phone summary', async () => {
    vi.mocked(api.GET).mockResolvedValue({
      data: { provisioned: 1, pending: 0, unassigned: 2, failed: 0, unknown: 1, total: 4 },
      response: new Response(),
    })

    await expect(getDashboardCounter('physicalPhones')).resolves.toBe(4)
    expect(api.GET).toHaveBeenCalledWith('/dashboard/phones', { signal: undefined })
  })
})
