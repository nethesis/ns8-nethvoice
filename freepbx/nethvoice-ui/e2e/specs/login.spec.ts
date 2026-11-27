//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import {
  E2E_SIGN_IN_KEY,
  expect,
  mockPermissions,
  mockSignIn,
  mockWizardState,
  SIGN_IN_PATH,
  test,
} from '../fixtures/mockApi'
import type { Page } from '@playwright/test'
import { mockPhonesApi, TANCREDI } from './phones-data'

const DEFAULT_CONFIG = {
  BRAND_NAME: 'NethVoice',
  BRAND_DOCS: 'https://docs.nethvoice.com/it/',
}

const openLogin = async (page: Page, config: Record<string, string> = DEFAULT_CONFIG) => {
  await page.route('**/nethvoice/config.json', (route) => route.fulfill({ json: config }))
  await page.goto('./login')
  await expect(page.getByRole('img', { name: 'NethVoice logo' })).toBeVisible()
}

const box = async (page: Page, testId: string) => {
  const rect = await page.getByTestId(testId).boundingBox()
  expect(rect).not.toBeNull()
  return rect ?? { x: 0, y: 0, width: 0, height: 0 }
}

const top = async (page: Page, selector: Parameters<Page['locator']>[0]) =>
  (await page.locator(selector).first().boundingBox())?.y ?? Number.NaN

test.describe('login', () => {
  test('redirects an anonymous visitor to the login page', async ({ page, mockApi }) => {
    await page.goto('./dashboard')

    await expect(page).toHaveURL(/\/nethvoice\/login\?redirect=\/dashboard$/)
    await expect(page.getByRole('heading', { name: 'PBX administration', level: 1 })).toBeVisible()
    expect(mockApi.calls).toEqual([])
  })

  test('validates the form before calling the API', async ({ page, mockApi }) => {
    await page.goto('./login')
    await page.getByRole('button', { name: 'Sign in' }).click()

    await expect(page.getByText('Enter your username')).toBeVisible()
    await expect(page.getByText('Enter your password')).toBeVisible()
    expect(mockApi.callsTo('POST', SIGN_IN_PATH)).toHaveLength(0)
  })

  test('signs in, stores the secret key and opens the dashboard', async ({ page, mockApi }) => {
    mockApi.allowUnmockedCalls()

    await page.goto('./login')
    await page.getByRole('textbox', { name: 'Username' }).fill('admin')
    await page.getByRole('textbox', { name: 'Password' }).fill('correct-password')
    await page.getByRole('button', { name: 'Sign in' }).click()

    await expect(page).toHaveURL(/\/nethvoice\/dashboard$/)
    expect(mockApi.callsTo('POST', SIGN_IN_PATH)[0].body).toEqual({
      username: 'admin',
      password: 'correct-password',
    })
    expect(mockApi.callsTo('POST', '/freepbx/rest/testauth')).toHaveLength(0)

    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('secretkey') ?? '{}'))
    expect(stored).toEqual({ user: 'admin', hash: E2E_SIGN_IN_KEY })
  })

  test('explains that the browser does not let the site keep the session', async ({
    page,
    mockApi,
  }) => {
    await page.addInitScript(() => {
      const setItem = Storage.prototype.setItem
      Storage.prototype.setItem = function (key: string, value: string) {
        if (key === 'secretkey') {
          throw new DOMException('blocked', 'QuotaExceededError')
        }
        setItem.call(this, key, value)
      }
    })
    await page.goto('./login')
    await page.getByRole('textbox', { name: 'Username' }).fill('admin')
    await page.getByRole('textbox', { name: 'Password' }).fill('correct-password')
    await page.getByRole('button', { name: 'Sign in' }).click()

    await expect(
      page.getByText(
        'The browser does not let this site save data. Allow cookies and site data for this site, then sign in again.',
      ),
    ).toBeVisible()
    await expect(page).toHaveURL(/\/nethvoice\/login$/)
    expect(mockApi.callsTo('GET', '/freepbx/rest/login')).toHaveLength(0)
  })

  test('opens the FreePBX session only for a superadmin', async ({ page, mockApi }) => {
    mockApi.allowUnmockedCalls()
    mockSignIn(mockApi, ['dashboard'], 'domain')
    mockPermissions(mockApi, ['dashboard'], 'operator')

    await page.goto('./login')
    await page.getByRole('textbox', { name: 'Username' }).fill('operator')
    await page.getByRole('textbox', { name: 'Password' }).fill('correct-password')
    await page.getByRole('button', { name: 'Sign in' }).click()

    await expect(page).toHaveURL(/\/nethvoice\/dashboard$/)
    expect(mockApi.callsTo('GET', '/freepbx/rest/login')).toHaveLength(0)
  })

  test('opens the FreePBX session after a superadmin signs in', async ({ page, mockApi }) => {
    mockApi.allowUnmockedCalls()

    await page.goto('./login')
    await page.getByRole('textbox', { name: 'Username' }).fill('admin')
    await page.getByRole('textbox', { name: 'Password' }).fill('correct-password')
    await page.getByRole('button', { name: 'Sign in' }).click()

    await expect(page).toHaveURL(/\/nethvoice\/dashboard$/)
    expect(mockApi.callsTo('GET', '/freepbx/rest/login')).toHaveLength(1)
  })

  test('remembers the username after sign out and a reload', async ({ page, mockApi }) => {
    mockApi.allowUnmockedCalls()

    await page.goto('./login')
    await page.getByRole('textbox', { name: 'Username' }).fill('admin')
    await page.getByRole('textbox', { name: 'Password' }).fill('correct-password')
    await page.getByText('Remember username').click()
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page).toHaveURL(/\/nethvoice\/dashboard$/)

    await page.getByRole('button', { name: 'Open account menu' }).click()
    await page.getByRole('menuitem', { name: 'Sign out' }).click()
    await expect(page.getByRole('textbox', { name: 'Username' })).toHaveValue('admin')

    await page.reload()
    await expect(page.getByRole('textbox', { name: 'Username' })).toHaveValue('admin')
    await expect(page.getByRole('checkbox', { name: 'Remember username' })).toBeChecked()
  })

  test('sends the secret key headers on authenticated calls', async ({ page, mockApi }) => {
    mockApi.allowUnmockedCalls()
    let headers: Record<string, string> = {}

    mockApi.on('GET', '/freepbx/rest/configuration/wizard', (request) => {
      headers = request.headers
      return { json: [{ step: 13, status: 'false' }] }
    })

    await page.goto('./login')
    await page.getByRole('textbox', { name: 'Username' }).fill('admin')
    await page.getByRole('textbox', { name: 'Password' }).fill('correct-password')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page).toHaveURL(/\/nethvoice\/dashboard$/)

    expect(headers.user).toBe('admin')
    expect(headers.secretkey).toBe(E2E_SIGN_IN_KEY)
  })

  test('shows an error on wrong credentials and stays on the page', async ({ page, mockApi }) => {
    mockApi.on('POST', SIGN_IN_PATH, { status: 401, json: { code: 'invalid_credentials' } })

    await page.goto('./login')
    await page.getByRole('textbox', { name: 'Username' }).fill('admin')
    await page.getByRole('textbox', { name: 'Password' }).fill('wrong')
    await page.getByRole('button', { name: 'Sign in' }).click()

    await expect(page.getByText('Username or password is not correct')).toBeVisible()
    await expect(page.getByRole('textbox', { name: 'Password' })).toBeFocused()
    await expect(page).toHaveURL(/\/nethvoice\/login$/)
    expect(await page.evaluate(() => localStorage.getItem('secretkey'))).toBeNull()
  })

  test('signs in a domain administrator with the username of the account provider', async ({
    page,
    mockApi,
  }) => {
    mockApi.allowUnmockedCalls()
    mockSignIn(mockApi, ['users', 'phones'], 'domain', 'a.miller')
    mockPermissions(mockApi, ['users', 'phones'], 'a.miller')

    await page.goto('./login')
    await page.getByRole('textbox', { name: 'Username' }).fill('A.Miller')
    await page.getByRole('textbox', { name: 'Password' }).fill('correct-password')
    await page.getByText('Remember username').click()
    await page.getByRole('button', { name: 'Sign in' }).click()

    await expect(page).toHaveURL(/\/nethvoice\/users\/overview$/)
    expect(mockApi.callsTo('POST', SIGN_IN_PATH)[0].body).toEqual({
      username: 'A.Miller',
      password: 'correct-password',
    })
    const stored = await page.evaluate(() => ({
      credentials: JSON.parse(localStorage.getItem('secretkey') ?? '{}'),
      remembered: localStorage.getItem('nethvoiceRememberedUsername'),
    }))
    expect(stored).toEqual({
      credentials: { user: 'a.miller', hash: E2E_SIGN_IN_KEY },
      remembered: 'a.miller',
    })
    expect(mockApi.callsTo('GET', '/freepbx/rest/login')).toHaveLength(0)
    await expect(page.getByRole('link', { name: 'Admin control' })).toHaveCount(0)
  })

  for (const { name, status, json, headers, title, description } of [
    {
      name: 'a domain account without access, as wrong credentials',
      status: 401,
      json: { code: 'invalid_credentials' },
      title: 'Cannot sign in',
      description: 'Username or password is not correct, or the account is not an administrator.',
    },
    {
      name: 'an expired password',
      status: 403,
      json: { code: 'password_expired' },
      title: 'Password expired',
      description: 'Change your password in the NethServer 8 user portal, then sign in again.',
    },
    {
      name: 'a username in conflict with a local administrator',
      status: 403,
      json: { code: 'account_conflict' },
      title: 'Cannot sign in',
      description:
        'Your username is reserved or used by a local administrator. Ask the administrator for help.',
    },
    {
      name: 'too many attempts, with the wait time',
      status: 429,
      json: { code: 'too_many_attempts' },
      headers: { 'Retry-After': '120' },
      title: 'Too many failed attempts',
      description: 'Try again in 2 minutes.',
    },
    {
      name: 'too many attempts, without the wait time',
      status: 429,
      json: { code: 'too_many_attempts' },
      title: 'Too many failed attempts',
      description: 'Wait a few minutes and try again.',
    },
    {
      name: 'an unreachable account provider',
      status: 503,
      json: { code: 'domain_unavailable' },
      title: 'Cannot reach the account provider',
      description: "Users of the domain can't sign in now. Try again in a few minutes.",
    },
  ]) {
    test(`explains ${name}`, async ({ page, mockApi }) => {
      mockApi.on('POST', SIGN_IN_PATH, { status, json, headers })

      await page.goto('./login')
      await page.getByRole('textbox', { name: 'Username' }).fill('a.miller')
      await page.getByRole('textbox', { name: 'Password' }).fill('some-password')
      await page.getByRole('button', { name: 'Sign in' }).click()

      const form = page.locator('form')
      await expect(form.getByText(title, { exact: true })).toBeVisible()
      await expect(form.getByText(description, { exact: true })).toBeVisible()
      await expect(page.getByRole('textbox', { name: 'Password' })).toBeFocused()
      await expect(page).toHaveURL(/\/nethvoice\/login$/)
      expect(await page.evaluate(() => localStorage.getItem('secretkey'))).toBeNull()
    })
  }

  test('resumes the setup wizard when it is still in progress', async ({ page, mockApi }) => {
    mockApi.allowUnmockedCalls()
    mockApi
      .on('GET', '/freepbx/rest/configuration/wizard', { json: [{ step: 3, status: 'true' }] })
      .on('GET', '/freepbx/rest/trunks', { json: [] })
      .on('GET', '/freepbx/rest/providers', { json: [] })

    await page.goto('./login')
    await page.getByRole('textbox', { name: 'Username' }).fill('admin')
    await page.getByRole('textbox', { name: 'Password' }).fill('correct-password')
    await page.getByRole('button', { name: 'Sign in' }).click()

    await expect(page).toHaveURL(/\/nethvoice\/setup\/voip-trunks$/)
  })

  test('opens the welcome page on a system that was never configured', async ({
    page,
    mockApi,
  }) => {
    mockApi.on('GET', '/freepbx/rest/configuration/wizard', { json: [] })

    await page.goto('./login')
    await page.getByRole('textbox', { name: 'Username' }).fill('admin')
    await page.getByRole('textbox', { name: 'Password' }).fill('correct-password')
    await page.getByRole('button', { name: 'Sign in' }).click()

    await expect(page).toHaveURL(/\/nethvoice\/setup$/)
    await expect(page.getByRole('heading', { name: /setup wizard/i, level: 1 })).toBeVisible()
  })

  test('signs out when the API rejects the stored secret key', async ({
    page,
    mockApi,
    signedIn,
  }) => {
    void signedIn
    mockWizardState(mockApi, 0)
    mockApi
      .on('GET', '/freepbx/rest/settings/languages', {
        status: 403,
        json: { error: 'Forbidden: wrong secret key' },
      })
      .on('GET', '/freepbx/rest/outboundroutes/supportedLocales', { json: ['it'] })
      .on('GET', '/freepbx/rest/outboundroutes', { json: [] })

    await page.goto('./setup/system')

    await expect(page).toHaveURL(/\/nethvoice\/login/)
    await expect(page.getByText('Session expired')).toBeVisible()
    await expect.poll(() => mockApi.callsTo('GET', '/freepbx/rest/logout').length).toBe(1)
  })

  test('signs out the admin user when Tancredi rejects the stored secret key', async ({
    page,
    mockApi,
    signedIn,
  }) => {
    void signedIn
    mockPhonesApi(mockApi)
    mockApi.on('GET', `${TANCREDI}/models`, {
      status: 403,
      json: {
        type: 'https://nethesis.github.io/tancredi/problems#forbidden',
        title: 'Access to resource is forbidden with current client privileges',
      },
    })

    await page.goto('./phones/models')

    await expect(page).toHaveURL(/\/nethvoice\/login/)
    await expect(page.getByText('Session expired')).toBeVisible()
  })

  test('follows the redirect when the session is still valid', async ({
    page,
    mockApi,
    signedIn,
  }) => {
    void signedIn
    mockApi.on('GET', '/freepbx/rest/settings/languages', {
      json: { it: { default: false }, en: { default: true } },
    })

    await page.goto('./login?redirect=/settings')

    await expect(page).toHaveURL(/\/nethvoice\/settings$/)
  })

  test('ignores a redirect outside the application', async ({ page, mockApi }) => {
    mockApi.allowUnmockedCalls()

    await page.goto('./login?redirect=//example.com/')
    await page.getByRole('textbox', { name: 'Username' }).fill('admin')
    await page.getByRole('textbox', { name: 'Password' }).fill('correct-password')
    await page.getByRole('button', { name: 'Sign in' }).click()

    await expect(page).toHaveURL(/\/nethvoice\/dashboard$/)
  })

  test('opens the setup status error when the setup status cannot be read', async ({
    page,
    mockApi,
  }) => {
    mockApi.allowUnmockedCalls()
    mockApi.on('GET', '/freepbx/rest/configuration/wizard', { status: 500 })

    await page.goto('./login')
    await page.getByRole('textbox', { name: 'Username' }).fill('admin')
    await page.getByRole('textbox', { name: 'Password' }).fill('correct-password')
    await page.getByRole('button', { name: 'Sign in' }).click()

    await expect(page).toHaveURL(/\/nethvoice\/setup$/)
    await expect(page.getByTestId('setup-state-error')).toContainText(
      'Cannot check the setup status',
    )
    await expect(page.getByRole('link', { name: 'Users' })).toHaveCount(0)
  })
})

test.describe('login: layout', () => {
  test('centers the sign in card on the background', async ({ page, mockApi }) => {
    void mockApi
    await page.setViewportSize({ width: 1440, height: 900 })
    await openLogin(page)

    const card = await box(page, 'login-card')
    expect(card.width).toBe(500)
    expect(Math.abs(card.x + card.width / 2 - 720)).toBeLessThanOrEqual(1)
    expect(Math.abs(card.y + card.height / 2 - 450)).toBeLessThanOrEqual(1)
    await expect(page.getByRole('heading', { name: 'Welcome' })).toHaveCount(0)
    await expect(page.getByRole('img', { name: 'NethVoice logo' })).toHaveCount(1)
    await expect(page.getByRole('link', { name: 'Need help?' })).toBeVisible()
  })

  for (const width of [390, 320]) {
    test(`fits a phone ${width} pixels wide without horizontal scrolling`, async ({
      page,
      mockApi,
    }) => {
      void mockApi
      await page.setViewportSize({ width, height: 640 })
      await openLogin(page)

      const card = await box(page, 'login-card')
      expect(card.x).toBe(16)
      expect(card.width).toBe(width - 32)
      const logo = await page.getByRole('img', { name: 'NethVoice logo' }).boundingBox()
      expect((logo?.x ?? 0) + (logo?.width ?? Infinity)).toBeLessThanOrEqual(card.x + card.width)
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
        ),
      ).toBe(true)
      await page.getByRole('button', { name: 'Sign in' }).scrollIntoViewIfNeeded()
      await expect(page.getByRole('button', { name: 'Sign in' })).toBeInViewport()
    })
  }

  test('moves the focus through the form in reading order', async ({ page, mockApi }) => {
    void mockApi
    await openLogin(page)

    await page.getByRole('textbox', { name: 'Username' }).focus()
    for (const control of [
      page.getByRole('textbox', { name: 'Password' }),
      page.getByRole('button', { name: 'Show password' }),
      page.getByRole('checkbox', { name: 'Remember username' }),
      page.getByRole('link', { name: 'Need help?' }),
      page.getByRole('button', { name: 'Sign in' }),
    ]) {
      await page.keyboard.press('Tab')
      await expect(control).toBeFocused()
    }
  })

  test('does not remember the username until asked', async ({ page, mockApi }) => {
    void mockApi
    await openLogin(page)

    await expect(page.getByRole('checkbox', { name: 'Remember username' })).not.toBeChecked()
    await expect(page.getByRole('textbox', { name: 'Username' })).toHaveValue('')
  })

  test('shows the missing values under their fields', async ({ page, mockApi }) => {
    void mockApi
    await openLogin(page)
    await page.getByRole('button', { name: 'Sign in' }).click()

    const usernameMessage = await top(page, 'text=Enter your username')
    const passwordMessage = await top(page, 'text=Enter your password')
    expect(usernameMessage).toBeGreaterThan(await top(page, '#username'))
    expect(usernameMessage).toBeLessThan(await top(page, '#password'))
    expect(passwordMessage).toBeGreaterThan(await top(page, '#password'))
    expect(passwordMessage).toBeLessThan(await top(page, '#remember-username'))
  })

  test('shows wrong credentials at the top of the form', async ({ page, mockApi }) => {
    mockApi.on('POST', SIGN_IN_PATH, { status: 401, json: { code: 'invalid_credentials' } })
    await openLogin(page)
    await page.getByRole('textbox', { name: 'Username' }).fill('admin')
    await page.getByRole('textbox', { name: 'Password' }).fill('wrong')
    await page.getByRole('button', { name: 'Sign in' }).click()

    const notification = page.locator('form').getByText('Cannot sign in', { exact: true })
    await expect(notification).toBeVisible()
    const notificationTop = (await notification.boundingBox())?.y ?? Number.NaN
    expect(notificationTop).toBeGreaterThan(
      (await page.getByRole('heading', { name: 'PBX administration' }).boundingBox())?.y ??
        Number.NaN,
    )
    expect(notificationTop).toBeLessThan(await top(page, '#username'))
  })
})
