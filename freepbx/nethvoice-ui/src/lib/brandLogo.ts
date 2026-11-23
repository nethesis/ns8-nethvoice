//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import type { RuntimeConfig } from '@/stores/runtimeConfig'

export type LogoBackground = 'light' | 'dark'

export const customLogoUrl = (config: RuntimeConfig, background: LogoBackground): string =>
  background === 'light'
    ? config.logoLightUrl || config.navbarLogoUrl
    : config.navbarLogoUrl || config.logoLightUrl

export const customLoginLogoUrl = (config: RuntimeConfig): string =>
  config.loginLogoUrl || config.logoLightUrl
