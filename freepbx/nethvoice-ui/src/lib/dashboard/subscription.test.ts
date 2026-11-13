//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest'
import {
  getExtensionsUsagePercent,
  isExtensionsLimitReached,
  parseSubscription,
} from './subscription'

describe('parseSubscription', () => {
  it('should read an enterprise system from a false limit', () => {
    expect(parseSubscription({ configured: 4, limit: false, configurable: false })).toEqual({
      plan: 'enterprise',
      configuredExtensions: 4,
      extensionsLimit: null,
    })
  })

  it('should read a community system from a numeric limit', () => {
    expect(parseSubscription({ configured: 4, limit: 8, configurable: 4 })).toEqual({
      plan: 'community',
      configuredExtensions: 4,
      extensionsLimit: 8,
    })
  })

  it('should reject an unexpected shape', () => {
    expect(() => parseSubscription({ configured: '4', limit: 8 })).toThrow()
  })
})

describe('getExtensionsUsagePercent', () => {
  it('should compute the share of the community limit in use', () => {
    expect(
      getExtensionsUsagePercent({ plan: 'community', configuredExtensions: 4, extensionsLimit: 8 }),
    ).toBe(50)
  })

  it('should cap the share at 100', () => {
    expect(
      getExtensionsUsagePercent({ plan: 'community', configuredExtensions: 9, extensionsLimit: 8 }),
    ).toBe(100)
  })

  it('should be zero without a limit', () => {
    expect(
      getExtensionsUsagePercent({
        plan: 'enterprise',
        configuredExtensions: 9,
        extensionsLimit: null,
      }),
    ).toBe(0)
  })
})

describe('isExtensionsLimitReached', () => {
  it('should be reached when the configured extensions meet or exceed the limit', () => {
    expect(
      isExtensionsLimitReached({ plan: 'community', configuredExtensions: 8, extensionsLimit: 8 }),
    ).toBe(true)
    expect(
      isExtensionsLimitReached({ plan: 'community', configuredExtensions: 10, extensionsLimit: 8 }),
    ).toBe(true)
  })

  it('should not be reached below the limit or without a limit', () => {
    expect(
      isExtensionsLimitReached({ plan: 'community', configuredExtensions: 7, extensionsLimit: 8 }),
    ).toBe(false)
    expect(
      isExtensionsLimitReached({
        plan: 'enterprise',
        configuredExtensions: 90,
        extensionsLimit: null,
      }),
    ).toBe(false)
  })
})
