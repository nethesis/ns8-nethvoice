//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { PRODUCT_NAME } from '@/lib/config'
import type { RuntimeConfig } from '@/stores/runtimeConfig'

export const SIGN_IN_SPLASH_MS = 1000

export const isRebranded = (config: RuntimeConfig): boolean =>
  config.brandName !== PRODUCT_NAME ||
  [
    config.navbarLogoUrl,
    config.logoLightUrl,
    config.loginLogoUrl,
    config.loginBackgroundUrl,
    config.faviconUrl,
  ].some((url) => url !== '')

export type SignInSplashContext = {
  configLoaded: boolean
  rebranded: boolean
  reducedMotion: boolean
}

export const shouldShowSignInSplash = ({
  configLoaded,
  rebranded,
  reducedMotion,
}: SignInSplashContext): boolean => configLoaded && !rebranded && !reducedMotion
