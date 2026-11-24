//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import {
  DEFAULT_DOCS_URL,
  DEFAULT_RUNTIME_CONFIG,
  localizeDocsUrl,
  parseRuntimeConfig,
  useRuntimeConfigStore,
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

  it('should read the logo for light backgrounds', () => {
    expect(
      parseRuntimeConfig({ LOGO_LIGHT_URL: 'https://cdn.acme.example/light.svg' }).logoLightUrl,
    ).toBe('https://cdn.acme.example/light.svg')
    expect(parseRuntimeConfig({ LOGO_LIGHT_URL: 'javascript:alert(1)' }).logoLightUrl).toBe('')
    expect(parseRuntimeConfig({}).logoLightUrl).toBe('')
  })

  it('should read the CTI product name', () => {
    expect(parseRuntimeConfig({ CTI_PRODUCT_NAME: " L'Azienda Voce " }).ctiProductName).toBe(
      "L'Azienda Voce",
    )
    expect(parseRuntimeConfig({ CTI_PRODUCT_NAME: ' ' }).ctiProductName).toBe('NethVoice CTI')
    expect(parseRuntimeConfig({}).ctiProductName).toBe('NethVoice CTI')
  })

  it('should read the configured host name', () => {
    expect(parseRuntimeConfig({ HOSTNAME: ' pbx.example.org ' }).hostname).toBe('pbx.example.org')
    expect(parseRuntimeConfig({}).hostname).toBe('')
    expect(parseRuntimeConfig({ INSTANCE_NAME: ' Milan office ' }).instanceName).toBe(
      'Milan office',
    )
    expect(parseRuntimeConfig({}).instanceName).toBe('')
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

describe('useRuntimeConfigStore', () => {
  const createStore = () => {
    const pinia = createPinia()
    createApp({}).use(pinia)
    setActivePinia(pinia)
    return useRuntimeConfigStore()
  }

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('should start not loaded', () => {
    const store = createStore()

    expect(store.loaded).toBe(false)
    expect(store.failed).toBe(false)
  })

  it('should load the configuration', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ BRAND_NAME: 'Acme Voice' }))),
    )
    const store = createStore()

    await store.load()

    expect(store.loaded).toBe(true)
    expect(store.failed).toBe(false)
    expect(store.config.brandName).toBe('Acme Voice')
  })

  it('should show the documentation only when the configuration is loaded and not rebranded', async () => {
    const store = createStore()
    expect(store.showDocs).toBe(false)

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ BRAND_NAME: 'NethVoice' }))),
    )
    await store.load()
    expect(store.showDocs).toBe(true)

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ BRAND_NAME: 'Acme Voice' }))),
    )
    const rebranded = createStore()
    await rebranded.load()
    expect(rebranded.showDocs).toBe(false)

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 404 })),
    )
    const failed = createStore()
    await failed.load()
    expect(failed.showDocs).toBe(false)
  })

  it('should mark the configuration as failed on an error answer', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 404 })),
    )
    const store = createStore()

    await store.load()

    expect(store.loaded).toBe(true)
    expect(store.failed).toBe(true)
    expect(store.config).toEqual(DEFAULT_RUNTIME_CONFIG)
  })

  it('should mark the configuration as failed when it cannot be read', async () => {
    for (const fetch of [
      vi.fn(async () => new Response('<html></html>')),
      vi.fn(async () => {
        throw new TypeError('network error')
      }),
    ]) {
      vi.stubGlobal('fetch', fetch)
      const store = createStore()

      await store.load()

      expect(store.loaded).toBe(true)
      expect(store.failed).toBe(true)
      expect(store.config).toEqual(DEFAULT_RUNTIME_CONFIG)
    }
  })
})
