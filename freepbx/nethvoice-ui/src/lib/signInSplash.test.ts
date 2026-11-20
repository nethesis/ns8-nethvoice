//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest'
import { DEFAULT_RUNTIME_CONFIG, parseRuntimeConfig } from '@/stores/runtimeConfig'
import { isRebranded, shouldShowSignInSplash } from './signInSplash'

describe('isRebranded', () => {
  it('should not consider the default configuration rebranded', () => {
    expect(isRebranded(DEFAULT_RUNTIME_CONFIG)).toBe(false)
  })

  it('should not consider the values written by default on an instance rebranded', () => {
    const config = parseRuntimeConfig({
      BRAND_NAME: 'NethVoice',
      BRAND_SITE: 'https://www.nethesis.it/soluzioni/nethvoice',
      BRAND_DOCS: 'https://docs.nethvoice.com/it/',
      NAVBAR_LOGO_URL: '',
      LOGIN_LOGO_URL: '',
      LOGIN_BACKGROUND_URL: '',
      FAVICON_URL: '',
      HOSTNAME: 'pbx.example.org',
      INSTANCE_NAME: 'Milan office',
    })

    expect(isRebranded(config)).toBe(false)
  })

  it('should consider a custom brand name rebranded', () => {
    expect(isRebranded(parseRuntimeConfig({ BRAND_NAME: 'Acme Voice' }))).toBe(true)
  })

  it.each(['NAVBAR_LOGO_URL', 'LOGIN_LOGO_URL', 'LOGIN_BACKGROUND_URL', 'FAVICON_URL'])(
    'should consider a custom %s rebranded',
    (key) => {
      expect(isRebranded(parseRuntimeConfig({ [key]: 'https://cdn.acme.example/brand.svg' }))).toBe(
        true,
      )
    },
  )

  it('should not consider a custom documentation or site link rebranded', () => {
    const config = parseRuntimeConfig({
      BRAND_SITE: 'https://www.acme.example/',
      BRAND_DOCS: 'https://docs.acme.example/',
    })

    expect(isRebranded(config)).toBe(false)
  })
})

describe('shouldShowSignInSplash', () => {
  const context = { configLoaded: true, rebranded: false, reducedMotion: false }

  it('should show the splash on an instance that is not rebranded', () => {
    expect(shouldShowSignInSplash(context)).toBe(true)
  })

  it('should not show the splash on a rebranded instance', () => {
    expect(shouldShowSignInSplash({ ...context, rebranded: true })).toBe(false)
  })

  it('should not show the splash when the user prefers reduced motion', () => {
    expect(shouldShowSignInSplash({ ...context, reducedMotion: true })).toBe(false)
  })

  it('should not show the splash before the branding is known', () => {
    expect(shouldShowSignInSplash({ ...context, configLoaded: false })).toBe(false)
  })
})
