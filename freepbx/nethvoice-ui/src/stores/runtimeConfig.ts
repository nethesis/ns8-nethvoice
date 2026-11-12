//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import * as v from 'valibot'
import { PRODUCT_NAME, RUNTIME_CONFIG_URL } from '@/lib/config'

const OptionalText = v.optional(v.fallback(v.string(), ''), '')

export const RuntimeConfigSchema = v.object({
  BRAND_NAME: OptionalText,
  BRAND_SITE: OptionalText,
  BRAND_DOCS: OptionalText,
  NAVBAR_LOGO_URL: OptionalText,
  LOGIN_LOGO_URL: OptionalText,
  LOGIN_BACKGROUND_URL: OptionalText,
  FAVICON_URL: OptionalText,
  HOSTNAME: OptionalText,
})

export type RuntimeConfig = {
  brandName: string
  brandSite: string
  docsUrl: string
  navbarLogoUrl: string
  loginLogoUrl: string
  loginBackgroundUrl: string
  faviconUrl: string
  hostname: string
}

export const DEFAULT_DOCS_URL = 'https://docs.nethvoice.com/'

export const DEFAULT_RUNTIME_CONFIG: RuntimeConfig = {
  brandName: PRODUCT_NAME,
  brandSite: '',
  docsUrl: DEFAULT_DOCS_URL,
  navbarLogoUrl: '',
  loginLogoUrl: '',
  loginBackgroundUrl: '',
  faviconUrl: '',
  hostname: '',
}

const safeUrl = (value: string): string => {
  if (!value) {
    return ''
  }

  try {
    const url = new URL(value, window.location.origin)
    return ['http:', 'https:'].includes(url.protocol) ? url.href : ''
  } catch {
    return ''
  }
}

export const parseRuntimeConfig = (raw: unknown): RuntimeConfig => {
  const result = v.safeParse(RuntimeConfigSchema, raw)

  if (!result.success) {
    return { ...DEFAULT_RUNTIME_CONFIG }
  }
  const config = result.output

  return {
    brandName: config.BRAND_NAME.trim() || DEFAULT_RUNTIME_CONFIG.brandName,
    brandSite: safeUrl(config.BRAND_SITE),
    docsUrl: safeUrl(config.BRAND_DOCS) || DEFAULT_DOCS_URL,
    navbarLogoUrl: safeUrl(config.NAVBAR_LOGO_URL),
    loginLogoUrl: safeUrl(config.LOGIN_LOGO_URL),
    loginBackgroundUrl: safeUrl(config.LOGIN_BACKGROUND_URL),
    faviconUrl: safeUrl(config.FAVICON_URL),
    hostname: config.HOSTNAME.trim(),
  }
}

export const useRuntimeConfigStore = defineStore('runtimeConfig', () => {
  const config = ref<RuntimeConfig>({ ...DEFAULT_RUNTIME_CONFIG })
  const loaded = ref(false)

  const applyFavicon = (faviconUrl: string) => {
    if (!faviconUrl) {
      return
    }
    const favicon = document.querySelector<HTMLLinkElement>("link[rel='icon']")

    if (favicon) {
      favicon.href = faviconUrl
    }
  }

  const load = async () => {
    try {
      const response = await fetch(RUNTIME_CONFIG_URL, {
        cache: 'no-store',
        credentials: 'omit',
        signal: AbortSignal.timeout(5000),
      })

      if (response.ok) {
        config.value = parseRuntimeConfig(await response.json())
      }
    } catch {
      config.value = { ...DEFAULT_RUNTIME_CONFIG }
    } finally {
      loaded.value = true
      applyFavicon(config.value.faviconUrl)
    }
  }

  const hostname = computed(() => config.value.hostname || window.location.hostname)

  return { config, loaded, hostname, load }
})
