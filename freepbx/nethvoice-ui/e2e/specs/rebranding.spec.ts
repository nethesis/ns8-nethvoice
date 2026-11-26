//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import type { Page } from '@playwright/test'
import { expect, mockWizardState, test } from '../fixtures/mockApi'

const LOGO_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="24"><rect width="120" height="24"/></svg>'

const ON_DARK = '/brand/on-dark.svg'
const ON_LIGHT = '/brand/on-light.svg'

const serveConfig = async (page: Page, config: Record<string, string>) => {
  await page.route('**/nethvoice/config.json', (route) => route.fulfill({ json: config }))
  await page.route('**/brand/*.svg', (route) =>
    route.fulfill({ contentType: 'image/svg+xml', body: LOGO_SVG }),
  )
}

const brandLogo = (page: Page) => page.getByRole('img', { name: 'Acme Voice logo' }).first()

test.describe('rebranding: logos for light and dark backgrounds', () => {
  test.beforeEach(({ signedIn }) => {
    void signedIn
  })

  test('shows the logo for light backgrounds in the light theme', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' })
    await serveConfig(page, {
      BRAND_NAME: 'Acme Voice',
      NAVBAR_LOGO_URL: ON_DARK,
      LOGO_LIGHT_URL: ON_LIGHT,
    })
    await page.goto('./dashboard')

    await expect(brandLogo(page)).toHaveAttribute('src', /\/brand\/on-light\.svg$/)
  })

  test('shows the logo for dark backgrounds in the dark theme', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' })
    await serveConfig(page, {
      BRAND_NAME: 'Acme Voice',
      NAVBAR_LOGO_URL: ON_DARK,
      LOGO_LIGHT_URL: ON_LIGHT,
    })
    await page.goto('./dashboard')

    await expect(brandLogo(page)).toHaveAttribute('src', /\/brand\/on-dark\.svg$/)
  })

  test('uses the single logo in both themes', async ({ page }) => {
    await serveConfig(page, { BRAND_NAME: 'Acme Voice', NAVBAR_LOGO_URL: ON_DARK })

    for (const colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme })
      await page.goto('./dashboard')
      await expect(brandLogo(page)).toHaveAttribute('src', /\/brand\/on-dark\.svg$/)
    }
  })
})

test.describe('rebranding: sign in page', () => {
  test.beforeEach(({ mockApi }) => {
    mockApi.allowUnmockedCalls()
  })

  test('shows the logo for dark backgrounds on the sign in panel', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' })
    await serveConfig(page, {
      BRAND_NAME: 'Acme Voice',
      LOGIN_LOGO_URL: ON_DARK,
      LOGO_LIGHT_URL: ON_LIGHT,
    })
    await page.goto('./login')

    await expect(page.locator(`img[src$="${ON_DARK}"]`)).toBeVisible()
    await expect(page.locator(`img[src$="${ON_LIGHT}"]`)).toHaveCount(0)
  })

  test('uses the logo for light backgrounds when it is the only one', async ({ page }) => {
    await serveConfig(page, { BRAND_NAME: 'Acme Voice', LOGO_LIGHT_URL: ON_LIGHT })
    await page.goto('./login')

    await expect(page.locator(`img[src$="${ON_LIGHT}"]`)).toBeVisible()
  })

  test('shows no product logo or title until the configuration is loaded', async ({ page }) => {
    let release = () => {}
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    await page.route('**/nethvoice/config.json', async (route) => {
      await gate
      await route.fulfill({ json: { BRAND_NAME: 'Acme Voice' } })
    })
    await page.goto('./login')

    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()
    await expect(page).toHaveTitle('NethVoice')
    await expect(page.locator('img[src*="logo_dark"]')).toHaveCount(0)

    release()
    await expect(page).toHaveTitle(/Acme Voice$/)
    await expect(page.locator('img[src*="logo_dark"]')).toBeVisible()
  })
})

test.describe('rebranding: setup wizard', () => {
  test.beforeEach(({ signedIn, mockApi }) => {
    void signedIn
    mockWizardState(mockApi, null)
    mockApi
      .on('GET', '/freepbx/rest/settings/languages', {
        json: { it: { default: false }, en: { default: true } },
      })
      .on('GET', '/freepbx/rest/outboundroutes/supportedLocales', { json: ['it', 'en'] })
      .on('GET', '/freepbx/rest/outboundroutes', { json: [] })
  })

  test('hides the NethVoice symbol on a rebranded instance', async ({ page }) => {
    await serveConfig(page, { BRAND_NAME: 'Acme Voice' })
    await page.goto('./setup/system')

    await expect(page.getByRole('heading', { name: 'System settings' })).toBeVisible()
    await expect(page.getByRole('complementary').getByRole('img')).toHaveCount(0)
  })

  test('shows the NethVoice symbol without rebranding', async ({ page }) => {
    await page.goto('./setup/system')

    await expect(
      page.getByRole('complementary').getByRole('img', { name: 'NethVoice logo' }),
    ).toBeVisible()
  })
})

test.describe('rebranding: CTI product name', () => {
  test.beforeEach(({ signedIn, mockApi }) => {
    void signedIn
    mockApi
      .on('GET', '/freepbx/rest/cti/profiles', { json: [] })
      .on('GET', '/freepbx/rest/physicalextensions', { json: [] })
      .on('GET', '/freepbx/rest/cti/streaming', { json: [] })
      .on('GET', '/freepbx/rest/cti/streaming/doorphones', { json: [] })
  })

  test('names the configured CTI product', async ({ page }) => {
    await serveConfig(page, { BRAND_NAME: 'Acme Voice', CTI_PRODUCT_NAME: 'Acme Phone' })
    await page.goto('./integrations/video-sources')

    await expect(
      page.getByText(
        'Create a video source from a camera or a door phone to show its images in Acme Phone.',
      ),
    ).toBeVisible()
    await expect(page.getByText('NethVoice CTI')).toHaveCount(0)
  })

  test('names NethVoice CTI without rebranding', async ({ page }) => {
    await page.goto('./integrations/video-sources')

    await expect(
      page.getByText(
        'Create a video source from a camera or a door phone to show its images in NethVoice CTI.',
      ),
    ).toBeVisible()
  })
})

test.describe('rebranding: documentation links', () => {
  test('hides the help links on a rebranded instance', async ({ page, mockApi }) => {
    mockApi.allowUnmockedCalls()
    await serveConfig(page, { BRAND_NAME: 'Acme Voice' })
    await page.goto('./login')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Need help?' })).toHaveCount(0)
  })

  test('hides the help button of the top bar on a rebranded instance', async ({
    page,
    signedIn,
  }) => {
    void signedIn
    await serveConfig(page, { BRAND_NAME: 'Acme Voice' })
    await page.goto('./dashboard')
    await expect(page.getByRole('button', { name: 'Show notifications' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Documentation' })).toHaveCount(0)
  })

  test('shows the help links without rebranding', async ({ page, signedIn }) => {
    void signedIn
    await page.goto('./dashboard')
    await expect(page.getByRole('link', { name: 'Documentation' })).toBeVisible()
  })
})
