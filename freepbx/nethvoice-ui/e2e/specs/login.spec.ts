//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { expect, mockWizardState, test } from '../fixtures/mockApi'

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
    expect(mockApi.callsTo('POST', '/freepbx/rest/testauth')).toHaveLength(0)
  })

  test('signs in, stores the secret key and opens the dashboard', async ({ page, mockApi }) => {
    mockApi.allowUnmockedCalls()
    mockApi.on('POST', '/freepbx/rest/testauth', { json: { result: 'shared-secret' } })

    await page.goto('./login')
    await page.getByRole('textbox', { name: 'Username' }).fill('admin')
    await page.getByRole('textbox', { name: 'Password' }).fill('correct-password')
    await page.getByRole('button', { name: 'Sign in' }).click()

    await expect(page).toHaveURL(/\/nethvoice\/dashboard$/)
    expect(mockApi.callsTo('POST', '/freepbx/rest/testauth')[0].body).toEqual({
      username: 'admin',
      password: 'correct-password',
    })

    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('secretkey') ?? '{}'))
    expect(stored.user).toBe('admin')
    expect(stored.hash).toMatch(/^[0-9a-f]{40}$/)
  })

  test('sends the secret key headers on authenticated calls', async ({ page, mockApi }) => {
    mockApi.allowUnmockedCalls()
    let headers: Record<string, string> = {}

    mockApi
      .on('POST', '/freepbx/rest/testauth', { json: { result: 'shared-secret' } })
      .on('GET', '/freepbx/rest/configuration/wizard', (request) => {
        headers = request.headers
        return { json: [{ step: 13, status: 'false' }] }
      })

    await page.goto('./login')
    await page.getByRole('textbox', { name: 'Username' }).fill('admin')
    await page.getByRole('textbox', { name: 'Password' }).fill('correct-password')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page).toHaveURL(/\/nethvoice\/dashboard$/)

    expect(headers.user).toBe('admin')
    expect(headers.secretkey).toMatch(/^[0-9a-f]{40}$/)
  })

  test('shows an error on wrong credentials and stays on the page', async ({ page, mockApi }) => {
    mockApi.on('POST', '/freepbx/rest/testauth', { status: 401 })

    await page.goto('./login')
    await page.getByRole('textbox', { name: 'Username' }).fill('admin')
    await page.getByRole('textbox', { name: 'Password' }).fill('wrong')
    await page.getByRole('button', { name: 'Sign in' }).click()

    await expect(page.getByText('Username or password is not correct')).toBeVisible()
    await expect(page.getByRole('textbox', { name: 'Password' })).toBeFocused()
    await expect(page).toHaveURL(/\/nethvoice\/login$/)
    expect(await page.evaluate(() => localStorage.getItem('secretkey'))).toBeNull()
  })

  test('resumes the setup wizard when it is still in progress', async ({ page, mockApi }) => {
    mockApi.allowUnmockedCalls()
    mockApi
      .on('POST', '/freepbx/rest/testauth', { json: { result: 'shared-secret' } })
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
    mockApi
      .on('POST', '/freepbx/rest/testauth', { json: { result: 'shared-secret' } })
      .on('GET', '/freepbx/rest/configuration/wizard', { json: [] })

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

    await page.goto('./setup/system')

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
    mockApi.on('POST', '/freepbx/rest/testauth', { json: { result: 'shared-secret' } })

    await page.goto('./login?redirect=//example.com/')
    await page.getByRole('textbox', { name: 'Username' }).fill('admin')
    await page.getByRole('textbox', { name: 'Password' }).fill('correct-password')
    await page.getByRole('button', { name: 'Sign in' }).click()

    await expect(page).toHaveURL(/\/nethvoice\/dashboard$/)
  })

  test('warns when the setup status cannot be read and opens the dashboard', async ({
    page,
    mockApi,
  }) => {
    mockApi.allowUnmockedCalls()
    mockApi
      .on('POST', '/freepbx/rest/testauth', { json: { result: 'shared-secret' } })
      .on('GET', '/freepbx/rest/configuration/wizard', { status: 500 })

    await page.goto('./login')
    await page.getByRole('textbox', { name: 'Username' }).fill('admin')
    await page.getByRole('textbox', { name: 'Password' }).fill('correct-password')
    await page.getByRole('button', { name: 'Sign in' }).click()

    await expect(page).toHaveURL(/\/nethvoice\/dashboard$/)
    await expect(page.getByText('Cannot check the setup status').first()).toBeVisible()
  })
})
