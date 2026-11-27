//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { PiniaColada } from '@pinia/colada'
import i18n from '@/i18n'
import { parseRuntimeConfig, useRuntimeConfigStore } from '@/stores/runtimeConfig'
import BrandLogo from './BrandLogo.vue'

const STOCK_LOGO = /logo_(light|dark)/

let wrapper: VueWrapper | undefined

const mountLogo = (
  rawConfig: Record<string, string>,
  variant: 'navbar' | 'login' = 'navbar',
  theme: 'light' | 'dark' = 'light',
) => {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query === '(prefers-color-scheme: dark)' && theme === 'dark',
  }))
  const pinia = createPinia()
  const runtimeConfigStore = useRuntimeConfigStore(pinia)
  runtimeConfigStore.config = parseRuntimeConfig(rawConfig)
  runtimeConfigStore.loaded = true
  wrapper = mount(BrandLogo, {
    props: { variant },
    attrs: { class: 'h-5.5 w-auto' },
    global: { plugins: [pinia, PiniaColada, i18n] },
  })
  return wrapper
}

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.unstubAllGlobals()
})

describe('BrandLogo', () => {
  it('should show the NethVoice logo without rebranding', async () => {
    const logo = mountLogo({})
    await logo.vm.$nextTick()

    expect(logo.find('img').attributes('src')).toMatch(STOCK_LOGO)
  })

  for (const variant of ['navbar', 'login'] as const) {
    for (const theme of ['light', 'dark'] as const) {
      it(`should show the brand name when the brand has no logo (${variant}, ${theme})`, async () => {
        const logo = mountLogo({ BRAND_NAME: 'Acme Voice' }, variant, theme)
        await logo.vm.$nextTick()

        expect(logo.find('img').exists()).toBe(false)
        expect(logo.text()).toBe('Acme Voice')
      })

      it(`should show the brand name when the logo does not load (${variant}, ${theme})`, async () => {
        const logo = mountLogo(
          { BRAND_NAME: 'Acme Voice', NAVBAR_LOGO_URL: 'https://cdn.acme.example/missing.svg' },
          variant,
          theme,
        )
        await logo.vm.$nextTick()
        expect(logo.find('img').attributes('src')).toBe('https://cdn.acme.example/missing.svg')

        await logo.find('img').trigger('error')

        expect(logo.find('img').exists()).toBe(false)
        expect(logo.text()).toBe('Acme Voice')
      })
    }
  }

  it('should never show the NethVoice logo when only a custom asset is set', async () => {
    const logo = mountLogo({ NAVBAR_LOGO_URL: 'https://cdn.acme.example/missing.svg' })
    await logo.vm.$nextTick()
    await logo.find('img').trigger('error')

    expect(logo.find('img').exists()).toBe(false)
    expect(logo.text()).toBe('NethVoice')
  })

  it('should keep the height of the slot for the brand name in the navigation', async () => {
    const logo = mountLogo({ BRAND_NAME: 'Acme Voice' })
    await logo.vm.$nextTick()

    expect(logo.classes()).toContain('h-5.5')
  })
})
