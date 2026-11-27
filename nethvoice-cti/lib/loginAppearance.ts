// Copyright (C) 2026 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

export type BrandingConfig = Record<string, unknown> | undefined

export interface ThemedImages {
  light: string
  dark: string
}

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

export const STOCK_LOGIN_LOGOS: ThemedImages = {
  light: '/login_logo.svg',
  dark: '/login_logo_dark.svg',
}

const CUSTOM_NAVBAR_LOGOS: ThemedImages = {
  light: '/navbar_logo.svg',
  dark: '/navbar_logo_dark.svg',
}

export const DEFAULT_LOGIN_BACKGROUNDS: ThemedImages = {
  light: '/nethvoice-login-bg-light.svg',
  dark: '/nethvoice-login-bg-dark.svg',
}

export const CUSTOM_LOGIN_BACKGROUND = '/login_background.svg'

const hasValue = (value: unknown): boolean => typeof value === 'string' && value.trim() !== ''

const hasCustomName = (config: Record<string, unknown>): boolean => {
  const brandName = config.BRAND_NAME || DEFAULT_BRAND_NAME
  const productName = config.PRODUCT_NAME || DEFAULT_PRODUCT_NAME

  return brandName !== DEFAULT_BRAND_NAME || productName !== DEFAULT_PRODUCT_NAME
}

export const isRebranded = (config: BrandingConfig): boolean => {
  if (!config) {
    return true
  }
  return hasCustomName(config) || CUSTOM_ASSET_KEYS.some((key) => hasValue(config[key]))
}

const pickThemedImages = (
  hasLight: boolean,
  hasDark: boolean,
  files: ThemedImages,
): ThemedImages | null => {
  if (hasLight && hasDark) {
    return { ...files }
  }
  if (hasLight) {
    return { light: files.light, dark: files.light }
  }
  if (hasDark) {
    return { light: files.dark, dark: files.dark }
  }
  return null
}

export const getLoginLogos = (config: BrandingConfig): ThemedImages | null => {
  const customLoginLogos = pickThemedImages(
    hasValue(config?.LOGIN_LOGO_URL),
    hasValue(config?.LOGIN_LOGO_DARK_URL),
    STOCK_LOGIN_LOGOS,
  )
  if (customLoginLogos) {
    return customLoginLogos
  }
  const customNavbarLogos = pickThemedImages(
    hasValue(config?.NAVBAR_LOGO_URL),
    hasValue(config?.NAVBAR_LOGO_DARK_URL),
    CUSTOM_NAVBAR_LOGOS,
  )
  if (customNavbarLogos) {
    return customNavbarLogos
  }
  if (!config || hasCustomName(config)) {
    return null
  }
  return { ...STOCK_LOGIN_LOGOS }
}

export const getLoginBackgrounds = (config: BrandingConfig): ThemedImages => {
  if (hasValue(config?.LOGIN_BACKGROUND_URL)) {
    return { light: CUSTOM_LOGIN_BACKGROUND, dark: CUSTOM_LOGIN_BACKGROUND }
  }
  return { ...DEFAULT_LOGIN_BACKGROUNDS }
}

const backgroundLayers = (image: string, fallback: string): string =>
  image === fallback ? `url('${image}')` : `url('${image}'), url('${fallback}')`

export const getLoginBackgroundLayers = (config: BrandingConfig): ThemedImages => {
  const backgrounds = getLoginBackgrounds(config)
  return {
    light: backgroundLayers(backgrounds.light, DEFAULT_LOGIN_BACKGROUNDS.light),
    dark: backgroundLayers(backgrounds.dark, DEFAULT_LOGIN_BACKGROUNDS.dark),
  }
}

const configValue = (config: BrandingConfig, key: string): string =>
  hasValue(config?.[key]) ? (config?.[key] as string) : ''

export const getNavbarLogos = (config: BrandingConfig): ThemedImages | null => {
  const light = configValue(config, 'NAVBAR_LOGO_URL')
  const dark = configValue(config, 'NAVBAR_LOGO_DARK_URL')
  if (light || dark) {
    return { light: light || dark, dark: dark || light }
  }
  if (!config || hasCustomName(config)) {
    return null
  }
  return { ...CUSTOM_NAVBAR_LOGOS }
}
