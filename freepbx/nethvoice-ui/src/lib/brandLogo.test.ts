//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest'
import { DEFAULT_RUNTIME_CONFIG, parseRuntimeConfig } from '@/stores/runtimeConfig'
import { customLoginLogoUrl, customLogoUrl } from './brandLogo'

const ON_DARK = 'https://cdn.acme.example/on-dark.svg'
const ON_LIGHT = 'https://cdn.acme.example/on-light.svg'

describe('customLogoUrl', () => {
  it('should pick the logo made for the background', () => {
    const config = parseRuntimeConfig({ NAVBAR_LOGO_URL: ON_DARK, LOGO_LIGHT_URL: ON_LIGHT })

    expect(customLogoUrl(config, 'light')).toBe(ON_LIGHT)
    expect(customLogoUrl(config, 'dark')).toBe(ON_DARK)
  })

  it('should use the single logo on both backgrounds', () => {
    const single = parseRuntimeConfig({ NAVBAR_LOGO_URL: ON_DARK })
    const lightOnly = parseRuntimeConfig({ LOGO_LIGHT_URL: ON_LIGHT })

    expect(customLogoUrl(single, 'light')).toBe(ON_DARK)
    expect(customLogoUrl(single, 'dark')).toBe(ON_DARK)
    expect(customLogoUrl(lightOnly, 'light')).toBe(ON_LIGHT)
    expect(customLogoUrl(lightOnly, 'dark')).toBe(ON_LIGHT)
  })

  it('should have no custom logo without rebranding', () => {
    expect(customLogoUrl(DEFAULT_RUNTIME_CONFIG, 'light')).toBe('')
    expect(customLogoUrl(DEFAULT_RUNTIME_CONFIG, 'dark')).toBe('')
  })
})

describe('customLoginLogoUrl', () => {
  it('should prefer the logo for dark backgrounds on the sign in panel', () => {
    expect(
      customLoginLogoUrl(parseRuntimeConfig({ LOGIN_LOGO_URL: ON_DARK, LOGO_LIGHT_URL: ON_LIGHT })),
    ).toBe(ON_DARK)
  })

  it('should fall back to the logo for light backgrounds', () => {
    expect(customLoginLogoUrl(parseRuntimeConfig({ LOGO_LIGHT_URL: ON_LIGHT }))).toBe(ON_LIGHT)
    expect(customLoginLogoUrl(DEFAULT_RUNTIME_CONFIG)).toBe('')
  })
})
