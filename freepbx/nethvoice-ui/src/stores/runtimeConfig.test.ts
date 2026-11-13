//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest'
import {
  DEFAULT_DOCS_URL,
  DEFAULT_RUNTIME_CONFIG,
  localizeDocsUrl,
  parseRuntimeConfig,
} from './runtimeConfig'

describe('parseRuntimeConfig', () => {
  it('should fall back to defaults on a malformed payload', () => {
    expect(parseRuntimeConfig(null)).toEqual(DEFAULT_RUNTIME_CONFIG)
    expect(parseRuntimeConfig('nope')).toEqual(DEFAULT_RUNTIME_CONFIG)
  })

  it('should keep the product name when the brand name is blank', () => {
    expect(parseRuntimeConfig({ BRAND_NAME: '  ' }).brandName).toBe('NethVoice')
  })

  it('should read a custom brand', () => {
    const config = parseRuntimeConfig({
      BRAND_NAME: 'Acme Voice',
      BRAND_DOCS: 'https://docs.acme.example/',
      LOGIN_LOGO_URL: 'https://cdn.acme.example/logo.svg',
    })

    expect(config.brandName).toBe('Acme Voice')
    expect(config.docsUrl).toBe('https://docs.acme.example/')
    expect(config.loginLogoUrl).toBe('https://cdn.acme.example/logo.svg')
  })

  it('should read the configured host name', () => {
    expect(parseRuntimeConfig({ HOSTNAME: ' pbx.example.org ' }).hostname).toBe('pbx.example.org')
    expect(parseRuntimeConfig({}).hostname).toBe('')
  })

  it('should drop URLs with a scheme other than http and https', () => {
    const config = parseRuntimeConfig({
      NAVBAR_LOGO_URL: 'javascript:alert(1)',
      BRAND_DOCS: 'data:text/html,x',
    })

    expect(config.navbarLogoUrl).toBe('')
    expect(config.docsUrl).toBe(DEFAULT_DOCS_URL)
  })

  it('should ignore fields of the wrong type', () => {
    expect(parseRuntimeConfig({ BRAND_NAME: 42, FAVICON_URL: {} })).toEqual(DEFAULT_RUNTIME_CONFIG)
  })
})

describe('localizeDocsUrl', () => {
  it('should open the default documentation in the language of the interface', () => {
    expect(localizeDocsUrl('https://docs.nethvoice.com/it/', 'en')).toBe(
      'https://docs.nethvoice.com/',
    )
    expect(localizeDocsUrl('https://docs.nethvoice.com/it/', 'it')).toBe(
      'https://docs.nethvoice.com/it/',
    )
    expect(localizeDocsUrl('https://docs.nethvoice.com/', 'it-IT')).toBe(
      'https://docs.nethvoice.com/it/',
    )
    expect(localizeDocsUrl('https://docs.nethvoice.com/it/docs/admin', 'en')).toBe(
      'https://docs.nethvoice.com/docs/admin/',
    )
  })

  it('should keep a rebranded documentation as it is', () => {
    expect(localizeDocsUrl('https://docs.acme.example/it/', 'en')).toBe(
      'https://docs.acme.example/it/',
    )
  })
})
