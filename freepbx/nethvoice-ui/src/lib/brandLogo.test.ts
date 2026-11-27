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
  const ON_LOGIN = 'https://cdn.acme.example/login.svg'

  it('should pick the logo made for the background of the theme', () => {
    const config = parseRuntimeConfig({ NAVBAR_LOGO_URL: ON_DARK, LOGO_LIGHT_URL: ON_LIGHT })

    expect(customLoginLogoUrl(config, 'light')).toBe(ON_LIGHT)
    expect(customLoginLogoUrl(config, 'dark')).toBe(ON_DARK)
  })

  it('should use the single logo in both themes', () => {
    const darkOnly = parseRuntimeConfig({ NAVBAR_LOGO_URL: ON_DARK })
    const lightOnly = parseRuntimeConfig({ LOGO_LIGHT_URL: ON_LIGHT })
    const loginOnly = parseRuntimeConfig({ LOGIN_LOGO_URL: ON_LOGIN })

    for (const background of ['light', 'dark'] as const) {
      expect(customLoginLogoUrl(darkOnly, background)).toBe(ON_DARK)
      expect(customLoginLogoUrl(lightOnly, background)).toBe(ON_LIGHT)
      expect(customLoginLogoUrl(loginOnly, background)).toBe(ON_LOGIN)
    }
  })

  it('should prefer the sign in logo in the dark theme only', () => {
    const config = parseRuntimeConfig({
      NAVBAR_LOGO_URL: ON_DARK,
      LOGO_LIGHT_URL: ON_LIGHT,
      LOGIN_LOGO_URL: ON_LOGIN,
    })

    expect(customLoginLogoUrl(config, 'dark')).toBe(ON_LOGIN)
    expect(customLoginLogoUrl(config, 'light')).toBe(ON_LIGHT)
  })

  it('should have no custom logo without rebranding', () => {
    expect(customLoginLogoUrl(DEFAULT_RUNTIME_CONFIG, 'light')).toBe('')
    expect(customLoginLogoUrl(DEFAULT_RUNTIME_CONFIG, 'dark')).toBe('')
  })
})
