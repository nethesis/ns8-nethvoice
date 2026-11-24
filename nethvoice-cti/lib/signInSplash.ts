// Copyright (C) 2026 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { store } from '../store'

export const SIGN_IN_SPLASH_MS = 1100

const DEFAULT_BRAND_NAME = 'NethVoice'
const DEFAULT_PRODUCT_NAME = 'NethVoice CTI'

const CUSTOM_ASSET_KEYS = [
  'NAVBAR_LOGO_URL',
  'NAVBAR_LOGO_DARK_URL',
  'LOGIN_LOGO_URL',
  'LOGIN_LOGO_DARK_URL',
  'LOGIN_BACKGROUND_URL',
  'FAVICON_URL',
]

export const isRebranded = (config: Record<string, any> | undefined): boolean => {
  if (!config) {
    return true
  }
  const brandName = config.BRAND_NAME || DEFAULT_BRAND_NAME
  const productName = config.PRODUCT_NAME || DEFAULT_PRODUCT_NAME

  return (
    brandName !== DEFAULT_BRAND_NAME ||
    productName !== DEFAULT_PRODUCT_NAME ||
    CUSTOM_ASSET_KEYS.some((key) => !!config[key])
  )
}

export const shouldShowSignInSplash = (): boolean => {
  if (typeof window === 'undefined') {
    return false
  }
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  return !reducedMotion && !isRebranded((window as any).CONFIG)
}

export const navigateAfterSignIn = async <T>(navigate: () => Promise<T>): Promise<T> => {
  if (!shouldShowSignInSplash()) {
    return navigate()
  }
  store.dispatch.signInSplash.setVisible(true)

  try {
    const [result] = await Promise.all([
      navigate(),
      new Promise<void>((resolve) => setTimeout(resolve, SIGN_IN_SPLASH_MS)),
    ])
    return result
  } finally {
    store.dispatch.signInSplash.setVisible(false)
  }
}
