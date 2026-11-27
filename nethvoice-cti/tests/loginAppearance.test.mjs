// Copyright (C) 2026 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  CUSTOM_LOGIN_BACKGROUND,
  DEFAULT_LOGIN_BACKGROUNDS,
  STOCK_LOGIN_LOGOS,
  getLoginBackgrounds,
  getLoginLogos,
  isRebranded,
} from '../lib/loginAppearance.ts'

const stockConfig = {
  BRAND_NAME: 'NethVoice',
  PRODUCT_NAME: 'NethVoice CTI',
  COMPANY_SUBNAME: 'CTI',
  FAVICON_URL: '',
  NAVBAR_LOGO_URL: '',
  NAVBAR_LOGO_DARK_URL: '',
  LOGIN_LOGO_URL: '',
  LOGIN_LOGO_DARK_URL: '',
  LOGIN_BACKGROUND_URL: '',
}

test('stock configuration is not rebranded', () => {
  assert.equal(isRebranded(stockConfig), false)
  assert.equal(isRebranded({}), false)
})

test('a missing configuration counts as rebranded', () => {
  assert.equal(isRebranded(undefined), true)
})

test('a custom brand, product or asset counts as rebranded', () => {
  assert.equal(isRebranded({ ...stockConfig, BRAND_NAME: 'Acme' }), true)
  assert.equal(isRebranded({ ...stockConfig, PRODUCT_NAME: 'Acme Phone' }), true)
  assert.equal(isRebranded({ ...stockConfig, FAVICON_URL: 'https://example.com/f.ico' }), true)
})

test('stock configuration shows the stock logos per theme', () => {
  assert.deepEqual(getLoginLogos(stockConfig), STOCK_LOGIN_LOGOS)
  assert.deepEqual(getLoginLogos({}), {
    light: '/login_logo.svg',
    dark: '/login_logo_dark.svg',
  })
})

test('both custom login logos are used per theme', () => {
  assert.deepEqual(
    getLoginLogos({
      ...stockConfig,
      LOGIN_LOGO_URL: 'https://example.com/light.svg',
      LOGIN_LOGO_DARK_URL: 'https://example.com/dark.svg',
    }),
    { light: '/login_logo.svg', dark: '/login_logo_dark.svg' },
  )
})

test('only a light custom logo is used in both themes', () => {
  assert.deepEqual(
    getLoginLogos({ ...stockConfig, LOGIN_LOGO_URL: 'https://example.com/light.svg' }),
    { light: '/login_logo.svg', dark: '/login_logo.svg' },
  )
})

test('only a dark custom logo is used in both themes', () => {
  assert.deepEqual(
    getLoginLogos({ ...stockConfig, LOGIN_LOGO_DARK_URL: 'https://example.com/dark.svg' }),
    { light: '/login_logo_dark.svg', dark: '/login_logo_dark.svg' },
  )
})

test('blank logo values do not count as custom logos', () => {
  assert.deepEqual(getLoginLogos({ ...stockConfig, LOGIN_LOGO_URL: '   ' }), STOCK_LOGIN_LOGOS)
})

test('a rebranding without login logos falls back to the custom navbar logos', () => {
  assert.deepEqual(
    getLoginLogos({ ...stockConfig, NAVBAR_LOGO_URL: 'https://example.com/navbar.svg' }),
    { light: '/navbar_logo.svg', dark: '/navbar_logo.svg' },
  )
  assert.deepEqual(
    getLoginLogos({
      ...stockConfig,
      NAVBAR_LOGO_URL: 'https://example.com/navbar.svg',
      NAVBAR_LOGO_DARK_URL: 'https://example.com/navbar-dark.svg',
    }),
    { light: '/navbar_logo.svg', dark: '/navbar_logo_dark.svg' },
  )
})

test('another brand or product without custom logos never shows the stock logo', () => {
  assert.equal(getLoginLogos({ ...stockConfig, BRAND_NAME: 'Acme' }), null)
  assert.equal(getLoginLogos({ ...stockConfig, PRODUCT_NAME: 'Acme Phone' }), null)
  assert.equal(getLoginLogos(undefined), null)
})

test('custom logos win over another brand name', () => {
  assert.deepEqual(
    getLoginLogos({
      ...stockConfig,
      BRAND_NAME: 'Acme',
      LOGIN_LOGO_URL: 'https://example.com/light.svg',
    }),
    { light: '/login_logo.svg', dark: '/login_logo.svg' },
  )
})

test('custom background or favicon alone keep the stock logos', () => {
  assert.deepEqual(
    getLoginLogos({ ...stockConfig, LOGIN_BACKGROUND_URL: 'https://example.com/bg.png' }),
    STOCK_LOGIN_LOGOS,
  )
  assert.deepEqual(
    getLoginLogos({ ...stockConfig, FAVICON_URL: 'https://example.com/favicon.ico' }),
    STOCK_LOGIN_LOGOS,
  )
})

test('default backgrounds follow the theme', () => {
  assert.deepEqual(getLoginBackgrounds(stockConfig), {
    light: '/nethvoice-login-bg-light.webp',
    dark: '/nethvoice-login-bg-dark.webp',
  })
  assert.deepEqual(getLoginBackgrounds(undefined), DEFAULT_LOGIN_BACKGROUNDS)
})

test('a custom background is used in both themes', () => {
  assert.deepEqual(
    getLoginBackgrounds({ ...stockConfig, LOGIN_BACKGROUND_URL: 'https://example.com/bg.png' }),
    { light: CUSTOM_LOGIN_BACKGROUND, dark: CUSTOM_LOGIN_BACKGROUND },
  )
  assert.equal(CUSTOM_LOGIN_BACKGROUND, '/login_background.svg')
})

test('returned images are copies of the defaults', () => {
  const logos = getLoginLogos(stockConfig)
  logos.light = '/changed.svg'
  assert.equal(STOCK_LOGIN_LOGOS.light, '/login_logo.svg')
  const backgrounds = getLoginBackgrounds(stockConfig)
  backgrounds.dark = '/changed.webp'
  assert.equal(DEFAULT_LOGIN_BACKGROUNDS.dark, '/nethvoice-login-bg-dark.webp')
})
