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
import { mockPhonesApi, TANCREDI } from './phones-data'

test.describe('login', () => {
  test('redirects an anonymous visitor to the login page', async ({ page, mockApi }) => {
    await page.goto('./dashboard')

    await expect(page).toHaveURL(/\/nethvoice\/login\?redirect=\/dashboard$/)
    await expect(page.getByRole('heading', { name: 'Welcome' })).toBeVisible()
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
