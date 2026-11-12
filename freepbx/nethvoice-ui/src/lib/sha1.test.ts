//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest'
import { buildSecretKey, sha1 } from './sha1'

describe('sha1', () => {
  it('should hash a known value', async () => {
    expect(await sha1('abc')).toBe('a9993e364706816aba3e25717850c26c9cd0d89d')
  })

  it('should hash non ASCII text as UTF-8', async () => {
    expect(await sha1('è')).toBe('151666e2e2873be7fc40e7ae214f38b00bc50183')
  })
})

describe('buildSecretKey', () => {
  it('should match the hash computed by the REST API', async () => {
    const passwordHash = await sha1('secret-password')
    const expected = await sha1(`admin${passwordHash}shared`)

    expect(await buildSecretKey('admin', 'secret-password', 'shared')).toBe(expected)
  })

  it('should change when any input changes', async () => {
    const base = await buildSecretKey('admin', 'password', 'shared')

    expect(await buildSecretKey('admin2', 'password', 'shared')).not.toBe(base)
    expect(await buildSecretKey('admin', 'password2', 'shared')).not.toBe(base)
    expect(await buildSecretKey('admin', 'password', 'shared2')).not.toBe(base)
  })
})
