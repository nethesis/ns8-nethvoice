//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest'
import { formatLoadAndMemory, parseSystemInfo, splitUptime } from './system'

const valid = {
  release: '1.9.0',
  uptime_seconds: 1231932,
  load_average: 0.42,
  memory_used_percent: 38,
}

describe('parseSystemInfo', () => {
  it('should read the release and the host status', () => {
    expect(parseSystemInfo(valid)).toEqual({
      release: '1.9.0',
      uptimeSeconds: 1231932,
      loadAverage: 0.42,
      memoryUsedPercent: 38,
    })
  })

  it('should accept an unknown release', () => {
    expect(parseSystemInfo({ ...valid, release: null }).release).toBeNull()
  })

  it('should reject invalid figures', () => {
    expect(() => parseSystemInfo({ ...valid, release: ' ' })).toThrow()
    expect(() => parseSystemInfo({ ...valid, uptime_seconds: -1 })).toThrow()
    expect(() => parseSystemInfo({ ...valid, uptime_seconds: 1.5 })).toThrow()
    expect(() => parseSystemInfo({ ...valid, load_average: -0.1 })).toThrow()
    expect(() => parseSystemInfo({ ...valid, memory_used_percent: 101 })).toThrow()
    expect(() => parseSystemInfo({ ...valid, load_average: undefined })).toThrow()
  })
})

describe('splitUptime', () => {
  it('should split the uptime in days, hours and minutes', () => {
    expect(splitUptime(14 * 86400 + 6 * 3600 + 12 * 60 + 59)).toEqual([
      { unit: 'days', value: 14 },
      { unit: 'hours', value: 6 },
      { unit: 'minutes', value: 12 },
    ])
  })

  it('should leave out the units at zero', () => {
    expect(splitUptime(86400 + 5 * 60)).toEqual([
      { unit: 'days', value: 1 },
      { unit: 'minutes', value: 5 },
    ])
    expect(splitUptime(2 * 3600)).toEqual([{ unit: 'hours', value: 2 }])
  })

  it('should show zero minutes in the first minute', () => {
    expect(splitUptime(59)).toEqual([{ unit: 'minutes', value: 0 }])
  })
})

describe('formatLoadAndMemory', () => {
  it('should format the load average and the memory in the locale', () => {
    expect(formatLoadAndMemory({ loadAverage: 0.42, memoryUsedPercent: 38 }, 'en')).toBe(
      '0.42 · 38%',
    )
    expect(formatLoadAndMemory({ loadAverage: 1.5, memoryUsedPercent: 37.6 }, 'it')).toBe(
      '1,50 · 38%',
    )
  })
})
