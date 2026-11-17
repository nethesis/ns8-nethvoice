//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { expect, test } from '../fixtures/mockApi'

test.describe('shell', () => {
  test.beforeEach(({ signedIn, mockApi }) => {
    void signedIn
    mockApi.allowUnmockedCalls()
  })

  test('sets the language of the page', async ({ page }) => {
    await page.goto('./dashboard')

    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  })

  test('marks the current page in the side menu', async ({ page }) => {
    await page.goto('./settings')

    const navigation = page.getByRole('navigation')
    await expect(navigation.getByRole('link', { name: 'Settings', exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    )
    await expect(
      navigation.getByRole('link', { name: 'Dashboard', exact: true }),
    ).not.toHaveAttribute('aria-current')
  })

  test('shows the instance name in the top bar on Enterprise', async ({ page, mockApi }) => {
    await page.route('**/nethvoice/config.json', (route) =>
      route.fulfill({ json: { HOSTNAME: 'pbx.example.org', INSTANCE_NAME: 'Milan office' } }),
    )
    mockApi.on('GET', '/freepbx/rest/mainextensions/userlimits', {
      json: { configured: 5, limit: false, configurable: false },
    })
    await page.goto('./dashboard')

    const subscription = page.getByTestId('topbar-subscription')
    await expect(subscription).toHaveText(/^Enterprise subscription:\s*Milan office$/)
    await subscription.hover()
    await expect(page.getByRole('tooltip', { name: 'Enterprise subscription' })).toBeVisible()
  })

  test('shows the host name in the top bar without an instance name', async ({ page, mockApi }) => {
    await page.route('**/nethvoice/config.json', (route) =>
      route.fulfill({ json: { HOSTNAME: 'pbx.example.org' } }),
    )
    mockApi.on('GET', '/freepbx/rest/mainextensions/userlimits', {
      json: { configured: 5, limit: false, configurable: false },
    })
    await page.goto('./dashboard')

    await expect(page.getByTestId('topbar-subscription')).toHaveText(
      /^Enterprise subscription:\s*pbx\.example\.org$/,
    )
  })

  test('hides the subscription in the top bar on Community', async ({ page, mockApi }) => {
    mockApi.on('GET', '/freepbx/rest/mainextensions/userlimits', {
      json: { configured: 5, limit: 8, configurable: 3 },
    })
    await page.goto('./dashboard')

    await expect(page.getByTestId('extensions-usage')).toBeVisible()
    await expect(page.getByTestId('topbar-subscription')).toHaveCount(0)
  })

  test('opens the account menu from a single button', async ({ page }) => {
    await page.goto('./dashboard')

    const accountButtons = page.getByRole('button', { name: 'Open account menu' })
    await expect(accountButtons).toHaveCount(1)
    await expect(page.locator('button button')).toHaveCount(0)

    await accountButtons.click()
    await expect(page.getByRole('menuitem', { name: 'Sign out' })).toBeVisible()
  })

  test('switches the theme from the account menu', async ({ page }) => {
    await page.goto('./dashboard')
    const html = page.locator('html')
    const accountMenu = page.getByRole('button', { name: 'Open account menu' })

    await expect(page.getByRole('button', { name: /Switch to (light|dark) theme/ })).toHaveCount(0)
    await expect(html).toHaveClass(/\bdark\b/)

    await accountMenu.click()
    await page.getByRole('menuitem', { name: 'Switch to light theme' }).click()
    await expect(html).not.toHaveClass(/\bdark\b/)

    await page.reload()
    await expect(html).not.toHaveClass(/\bdark\b/)
    await accountMenu.click()
    await page.getByRole('menuitem', { name: 'Switch to dark theme' }).click()
    await expect(html).toHaveClass(/\bdark\b/)
  })

  test('switches to the compact view and keeps it after a reload', async ({ page }) => {
    await page.goto('./dashboard')
    const html = page.locator('html')
    const accountMenu = page.getByRole('button', { name: 'Open account menu' })
    const spacing = () =>
      html.evaluate((element) => getComputedStyle(element).getPropertyValue('--spacing').trim())

    await expect(html).not.toHaveClass(/\bcompact\b/)
    expect(await spacing()).toBe('0.25rem')

    await accountMenu.click()
    await page.getByRole('menuitem', { name: 'Switch to compact view' }).click()
    await expect(html).toHaveClass(/\bcompact\b/)
    expect(await spacing()).toBe('0.2rem')

    await page.reload()
    await expect(html).toHaveClass(/\bcompact\b/)
    await accountMenu.click()
    await page.getByRole('menuitem', { name: 'Switch to standard view' }).click()
    await expect(html).not.toHaveClass(/\bcompact\b/)
    expect(await spacing()).toBe('0.25rem')
  })

  test('falls back to the default logo when the custom one cannot be loaded', async ({ page }) => {
    await page.route('**/nethvoice/config.json*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ NAVBAR_LOGO_URL: '/missing-logo.svg' }),
      }),
    )
    await page.route('**/missing-logo.svg', (route) => route.fulfill({ status: 404 }))
    await page.goto('./dashboard')

    const logo = page.getByRole('img', { name: 'NethVoice logo' }).first()
    await expect(logo).toBeVisible()
    await expect(logo).not.toHaveAttribute('src', /missing-logo/)
    expect(await logo.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0)
  })
})
