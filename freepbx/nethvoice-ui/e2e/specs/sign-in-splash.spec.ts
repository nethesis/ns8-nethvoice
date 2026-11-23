//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import type { Page } from '@playwright/test'
import { expect, test } from '../fixtures/mockApi'

const SPLASH_MS = 1000

const DEFAULT_CONFIG = {
  BRAND_NAME: 'NethVoice',
  BRAND_SITE: 'https://www.nethesis.it/soluzioni/nethvoice',
  BRAND_DOCS: 'https://docs.nethvoice.com/it/',
  NAVBAR_LOGO_URL: '',
  LOGIN_LOGO_URL: '',
  LOGIN_BACKGROUND_URL: '',
  FAVICON_URL: '',
}

const recordSplash = (page: Page) =>
  page.addInitScript(() => {
    new MutationObserver(() => {
      if (document.querySelector('[data-testid="sign-in-splash"]')) {
        Reflect.set(window, 'e2eSplashSeen', true)
      }
    }).observe(document, { childList: true, subtree: true })
  })

const splashSeen = (page: Page) =>
  page.evaluate(() => Reflect.get(window, 'e2eSplashSeen') === true)

const openLogin = async (page: Page, config: Record<string, string>) => {
  await page.route('**/nethvoice/config.json', (route) => route.fulfill({ json: config }))
  const configLoaded = page.waitForResponse('**/nethvoice/config.json')
  await page.goto('./login')
  await configLoaded
}

const freezeClock = async (page: Page) => {
  await page.clock.install({ time: new Date('2026-11-20T09:00:00Z') })
  await page.clock.pauseAt(new Date('2026-11-20T09:00:01Z'))
}

const signIn = async (page: Page) => {
  await page.getByRole('textbox', { name: 'Username' }).fill('admin')
  await page.getByRole('textbox', { name: 'Password' }).fill('correct-password')
  await page.getByRole('button', { name: 'Sign in' }).click()
}

test.describe('sign-in splash', () => {
  test.beforeEach(async ({ page, mockApi }) => {
    mockApi.allowUnmockedCalls()
    mockApi.on('POST', '/freepbx/rest/testauth', { json: { result: 'shared-secret' } })
    await recordSplash(page)
  })

  test('shows the NethVoice logo after signing in, then the dashboard', async ({ page }) => {
    await freezeClock(page)
    await openLogin(page, DEFAULT_CONFIG)
    await signIn(page)

    const splash = page.getByTestId('sign-in-splash')
    await expect(splash.getByRole('img', { name: 'NethVoice logo' })).toBeVisible()
    await expect(splash).toHaveAttribute('aria-busy', 'true')
    await expect(page).toHaveURL(/\/nethvoice\/dashboard$/)
    await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible()

    await page.clock.runFor(SPLASH_MS - 1)
    await expect(splash).toBeVisible()
    await page.clock.runFor(1)
    await page.clock.resume()
    await expect(splash).toBeHidden()
    await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible()
  })

  test('covers the dashboard with an opaque logo when signing in again', async ({ page }) => {
    await page.addInitScript(() => {
      const opacities: string[] = []
      Reflect.set(window, 'e2eSplashOpacityOverDashboard', opacities)
      new MutationObserver(() => {
        const splash = document.querySelector('[data-testid="sign-in-splash"]')
        const dashboard = Array.from(document.querySelectorAll('[aria-level="1"]')).some(
          (element) => element.textContent?.trim() === 'Dashboard',
        )
        if (splash && dashboard && opacities.length === 0) {
          opacities.push(getComputedStyle(splash).opacity)
        }
      }).observe(document, { childList: true, subtree: true })
    })
    await openLogin(page, DEFAULT_CONFIG)
    await signIn(page)
    const splash = page.getByTestId('sign-in-splash')
    await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible()
    await expect(splash).toBeHidden()

    await page.getByTestId('account-menu').click()
    await page.getByRole('menuitem', { name: 'Sign out' }).click()
    await expect(page).toHaveURL(/\/nethvoice\/login$/)
    await page.evaluate(() => {
      ;(Reflect.get(window, 'e2eSplashOpacityOverDashboard') as string[]).length = 0
    })
    await signIn(page)

    await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible()
    await expect(splash).toBeHidden()
    expect(await page.evaluate(() => Reflect.get(window, 'e2eSplashOpacityOverDashboard'))).toEqual(
      ['1'],
    )
  })

  test('covers the phone island while the logo is shown', async ({ page }) => {
    await freezeClock(page)
    await openLogin(page, DEFAULT_CONFIG)
    await signIn(page)

    const splash = page.getByTestId('sign-in-splash')
    await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible()
    await expect(splash).toBeVisible()
    const zIndex = (testId: string) =>
      page.getByTestId(testId).evaluate((element) => Number(getComputedStyle(element).zIndex))
    expect(await zIndex('sign-in-splash')).toBeGreaterThan(await zIndex('phone-island-host'))
  })

  test('keeps the splash until a slower navigation to the deep link ends', async ({
    page,
    mockApi,
  }) => {
    let releaseWizard = () => {}
    const wizardGate = new Promise<void>((resolve) => {
      releaseWizard = resolve
    })
    mockApi.on('GET', '/freepbx/rest/configuration/wizard', async () => {
      await wizardGate
      return { json: [{ step: 13, status: 'false' }] }
    })
    await freezeClock(page)
    await page.route('**/nethvoice/config.json', (route) => route.fulfill({ json: DEFAULT_CONFIG }))
    const configLoaded = page.waitForResponse('**/nethvoice/config.json')
    await page.goto('./settings')
    await configLoaded
    await expect(page).toHaveURL(/\/nethvoice\/login\?redirect=\/settings$/)
    await signIn(page)

    const splash = page.getByTestId('sign-in-splash')
    await expect(splash).toBeVisible()
    await page.clock.runFor(SPLASH_MS * 2)
    await expect(splash).toBeVisible()
    await expect(page).toHaveURL(/\/nethvoice\/login\?redirect=\/settings$/)

    releaseWizard()
    await expect(page).toHaveURL(/\/nethvoice\/settings$/)
    await page.clock.resume()
    await expect(splash).toBeHidden()
  })

  test('lands directly on the dashboard on a rebranded instance', async ({ page }) => {
    await openLogin(page, { ...DEFAULT_CONFIG, BRAND_NAME: 'Acme Voice' })
    await expect(page.getByText('Sign in to Acme Voice')).toBeVisible()
    await signIn(page)

    await expect(page).toHaveURL(/\/nethvoice\/dashboard$/)
    await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible()
    expect(await splashSeen(page)).toBe(false)
  })

  test('lands directly on the dashboard when the configuration cannot be loaded', async ({
    page,
  }) => {
    await page.route('**/nethvoice/config.json', (route) => route.fulfill({ status: 500 }))
    const configLoaded = page.waitForResponse('**/nethvoice/config.json')
    await page.goto('./login')
    await configLoaded
    await signIn(page)

    await expect(page).toHaveURL(/\/nethvoice\/dashboard$/)
    await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible()
    expect(await splashSeen(page)).toBe(false)
  })

  test('lands directly on the dashboard with reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await openLogin(page, DEFAULT_CONFIG)
    await signIn(page)

    await expect(page).toHaveURL(/\/nethvoice\/dashboard$/)
    await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible()
    expect(await splashSeen(page)).toBe(false)
  })

  test('does not show the logo when a signed in session is restored', async ({
    page,
    signedIn,
  }) => {
    void signedIn
    await page.goto('./settings')
    await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible()
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible()
    await page.getByRole('navigation').getByRole('link', { name: 'Dashboard', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible()

    expect(await splashSeen(page)).toBe(false)
  })
})
