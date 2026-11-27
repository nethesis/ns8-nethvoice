//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import type { Page } from '@playwright/test'
import { expect, mockWizardState, test } from '../fixtures/mockApi'

const LOGO_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="24"><rect width="120" height="24"/></svg>'

const ON_DARK = '/brand/on-dark.svg'
const ON_LIGHT = '/brand/on-light.svg'
const ON_LOGIN = '/brand/on-login.svg'
const BACKGROUND = '/brand/background.webp'

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

const STOCK_LOGO = 'img[src*="logo_light"], img[src*="logo_dark"]'

const expectOnlyLogo = async (page: Page, source: string) => {
  await expect(brandLogo(page)).toHaveAttribute('src', new RegExp(`${source}$`))
  await expect(page.getByRole('img')).toHaveCount(1)
  await expect(page.locator(STOCK_LOGO)).toHaveCount(0)
}

test.describe('rebranding: sign in page', () => {
  test.beforeEach(({ mockApi }) => {
    mockApi.allowUnmockedCalls()
  })

  for (const { name, config, light, dark } of [
    {
      name: 'the logos for light and dark backgrounds',
      config: { NAVBAR_LOGO_URL: ON_DARK, LOGO_LIGHT_URL: ON_LIGHT },
      light: ON_LIGHT,
      dark: ON_DARK,
    },
    {
      name: 'the logo for light backgrounds only',
      config: { LOGO_LIGHT_URL: ON_LIGHT },
      light: ON_LIGHT,
      dark: ON_LIGHT,
    },
    {
      name: 'the logo for dark backgrounds only',
      config: { NAVBAR_LOGO_URL: ON_DARK },
      light: ON_DARK,
      dark: ON_DARK,
    },
    {
      name: 'the sign in logo, in the dark theme',
      config: { LOGIN_LOGO_URL: ON_LOGIN, LOGO_LIGHT_URL: ON_LIGHT },
      light: ON_LIGHT,
      dark: ON_LOGIN,
    },
  ]) {
    test(`shows one logo with ${name}`, async ({ page }) => {
      await serveConfig(page, { BRAND_NAME: 'Acme Voice', ...config })

      for (const [colorScheme, source] of [
        ['light', light],
        ['dark', dark],
      ] as const) {
        await page.emulateMedia({ colorScheme })
        await page.goto('./login')
        await expectOnlyLogo(page, source)
        await expect(page.getByRole('heading', { name: 'PBX administration' })).toBeVisible()
      }
    })
  }

  test('shows the brand name instead of a logo that does not load', async ({ page }) => {
    await serveConfig(page, { BRAND_NAME: 'Acme Voice', LOGO_LIGHT_URL: '/brand/missing.svg' })
    await page.route('**/brand/missing.svg', (route) => route.fulfill({ status: 404 }))
    await page.goto('./login')

    await expect(page.getByText('Acme Voice', { exact: true })).toBeVisible()
    await expect(page.getByRole('img')).toHaveCount(0)
    await expect(page.locator(STOCK_LOGO)).toHaveCount(0)
  })

  test('shows the brand name when the brand has no logo', async ({ page }) => {
    await serveConfig(page, { BRAND_NAME: 'Acme Voice' })
    await page.goto('./login')

    await expect(page.getByText('Acme Voice', { exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'PBX administration' })).toBeVisible()
    await expect(page.getByRole('img')).toHaveCount(0)
    await expect(page.locator(STOCK_LOGO)).toHaveCount(0)
  })

  test('shows no product logo or title until the configuration is loaded', async ({ page }) => {
    let release = () => {}
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    await page.route('**/nethvoice/config.json', async (route) => {
      await gate
      await route.fulfill({ json: { BRAND_NAME: 'Acme Voice', NAVBAR_LOGO_URL: ON_DARK } })
    })
    await page.route('**/brand/*.svg', (route) =>
      route.fulfill({ contentType: 'image/svg+xml', body: LOGO_SVG }),
    )
    await page.goto('./login')

    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()
    await expect(page).toHaveTitle('NethVoice')
    await expect(page.locator('img')).toHaveCount(0)

    release()
    await expect(page).toHaveTitle(/Acme Voice$/)
    await expectOnlyLogo(page, ON_DARK)
  })

  test('uses the custom background in both themes', async ({ page }) => {
    const backgrounds: string[] = []
    page.on('request', (request) => {
      if (
        request.resourceType() === 'image' &&
        /nethvoice-login-bg|\/brand\/background/.test(request.url())
      ) {
        backgrounds.push(new URL(request.url()).pathname)
      }
    })
    await serveConfig(page, { BRAND_NAME: 'Acme Voice', LOGIN_BACKGROUND_URL: BACKGROUND })
    await page.route('**/brand/background.webp', (route) =>
      route.fulfill({ contentType: 'image/svg+xml', body: LOGO_SVG }),
    )

    for (const colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme })
      await page.goto('./login')
      const background = page.getByTestId('login-background')
      await expect(background).toHaveAttribute('src', /\/brand\/background\.webp$/)
      await expect(background).toHaveCSS('object-fit', 'cover')
      await expect(background).toHaveCSS('object-position', '50% 50%')
    }
    expect(backgrounds.length).toBeGreaterThan(0)
    expect(backgrounds.every((path) => path === BACKGROUND)).toBe(true)
  })

  test('falls back to the default background when the custom one does not load', async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: 'dark' })
    await serveConfig(page, { BRAND_NAME: 'Acme Voice', LOGIN_BACKGROUND_URL: BACKGROUND })
    await page.route('**/brand/background.webp', (route) => route.fulfill({ status: 404 }))
    await page.goto('./login')

    await expect(page.getByTestId('login-background')).toHaveAttribute(
      'src',
      /nethvoice-login-bg-dark\.svg/,
    )
  })
})

test.describe('sign in page: default background', () => {
  for (const [colorScheme, other] of [
    ['light', 'dark'],
    ['dark', 'light'],
  ] as const) {
    test(`downloads only the ${colorScheme} background in the ${colorScheme} theme`, async ({
      page,
      mockApi,
    }) => {
      mockApi.allowUnmockedCalls()
      const backgrounds: string[] = []
      page.on('request', (request) => {
        if (request.resourceType() === 'image' && request.url().includes('nethvoice-login-bg')) {
          backgrounds.push(request.url())
        }
      })
      await page.emulateMedia({ colorScheme })
      await page.route('**/nethvoice/config.json', (route) => route.fulfill({ json: {} }))
      await page.goto('./login')

      const background = page.getByTestId('login-background')
      await expect(background).toHaveAttribute(
        'src',
        new RegExp(`nethvoice-login-bg-${colorScheme}\\.svg`),
      )
      await expect
        .poll(() => background.evaluate((image: HTMLImageElement) => image.naturalWidth))
        .toBeGreaterThan(0)
      expect(backgrounds.some((url) => url.includes(`nethvoice-login-bg-${other}`))).toBe(false)
      expect(backgrounds.length).toBeGreaterThan(0)
    })
  }
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
