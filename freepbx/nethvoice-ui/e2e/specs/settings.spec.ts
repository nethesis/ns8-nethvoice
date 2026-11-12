//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { expect, test } from '../fixtures/mockApi'

const CURRENT_PASSWORD = 'Current,pass1'
const NEW_PASSWORD = 'Brand,new2026'

test.describe('settings', () => {
  test.beforeEach(({ signedIn, mockApi }) => {
    void signedIn
    mockApi
      .on('GET', '/freepbx/rest/settings/languages', {
        json: { it: { default: false }, en: { default: true } },
      })
      .on('POST', '/freepbx/rest/settings/defaultlanguage', { status: 200 })
  })

  test.describe('PBX language', () => {
    test('shows the current language and saves a new one', async ({ page, mockApi }) => {
      await page.goto('./settings')

      const language = page.getByRole('combobox', { name: 'Language' })
      await expect(language).toHaveValue('English')
      await language.click()
      await page.getByRole('option', { name: 'Italiano' }).click()
      await page.getByRole('button', { name: 'Save' }).click()

      await expect(page.getByText('PBX language saved')).toBeVisible()
      expect(mockApi.callsTo('POST', '/freepbx/rest/settings/defaultlanguage')[0].body).toEqual({
        lang: 'it',
      })
    })

    test('reports a save error inside the form', async ({ page, mockApi }) => {
      mockApi.on('POST', '/freepbx/rest/settings/defaultlanguage', { status: 500 })

      await page.goto('./settings')
      await page.getByRole('button', { name: 'Save' }).click()

      await expect(page.getByText('Cannot save PBX language')).toBeVisible()
    })

    test('reports a load error and retries', async ({ page, mockApi }) => {
      let fail = true

      mockApi.on('GET', '/freepbx/rest/settings/languages', () =>
        fail ? { status: 500 } : { json: { it: { default: true }, en: { default: false } } },
      )

      await page.goto('./settings')

      await expect(page.getByText('Cannot load settings')).toBeVisible()
      await expect(page.getByRole('button', { name: 'Change admin password' })).toBeVisible()

      fail = false
      await page.getByRole('button', { name: 'Retry' }).click()

      await expect(page.getByRole('combobox', { name: 'Language' })).toHaveValue('Italiano')
    })
  })

  test('opens the advanced settings in a new tab', async ({ page, context }) => {
    await context.route('**/freepbx/admin/**', (route) =>
      route.fulfill({ status: 200, contentType: 'text/html', body: '<html></html>' }),
    )
    await page.goto('./settings')

    const popupPromise = page.waitForEvent('popup')
    await page.getByRole('button', { name: 'Advanced settings' }).click()
    const popup = await popupPromise

    expect(new URL(popup.url()).pathname).toBe('/freepbx/admin/')
  })

  test.describe('change admin password', () => {
    test('validates the form before calling the API', async ({ page, mockApi }) => {
      await page.goto('./settings')
      await page.getByRole('button', { name: 'Change admin password' }).click()

      const drawer = page.getByRole('dialog')
      await drawer.getByRole('button', { name: 'Change password' }).click()

      await expect(drawer.getByText('Enter the current password')).toBeVisible()
      await expect(drawer.getByText('Enter the new password')).toBeVisible()
      await expect(drawer.getByText('Confirm the new password')).toBeVisible()
      await expect(drawer.getByLabel('Current password', { exact: true })).toBeFocused()

      await drawer.getByLabel('Current password', { exact: true }).fill(CURRENT_PASSWORD)
      await drawer.getByLabel('New password', { exact: true }).fill('weak')
      await drawer.getByLabel('Confirm password', { exact: true }).fill('weak')
      await drawer.getByRole('button', { name: 'Change password' }).click()

      await expect(drawer.getByText('The password does not meet the requirements')).toBeVisible()
      await expect(drawer.getByLabel('New password', { exact: true })).toBeFocused()

      await drawer.getByLabel('New password', { exact: true }).fill(NEW_PASSWORD)
      await drawer.getByLabel('Confirm password', { exact: true }).fill('Brand,new2027')
      await drawer.getByRole('button', { name: 'Change password' }).click()

      await expect(drawer.getByText('Passwords do not match')).toBeVisible()
      expect(mockApi.callsTo('POST', '/freepbx/rest/testauth')).toHaveLength(0)
      expect(mockApi.callsTo('POST', '/freepbx/rest/users/admin/password')).toHaveLength(0)
    })

    test('rejects a wrong current password', async ({ page, mockApi }) => {
      mockApi.on('POST', '/freepbx/rest/testauth', { status: 401 })

      await page.goto('./settings')
      await page.getByRole('button', { name: 'Change admin password' }).click()
      const drawer = page.getByRole('dialog')
      await drawer.getByLabel('Current password', { exact: true }).fill('Wrong,pass1')
      await drawer.getByLabel('New password', { exact: true }).fill(NEW_PASSWORD)
      await drawer.getByLabel('Confirm password', { exact: true }).fill(NEW_PASSWORD)
      await drawer.getByRole('button', { name: 'Change password' }).click()

      await expect(drawer.getByText('The current password is not correct')).toBeVisible()
      expect(mockApi.callsTo('POST', '/freepbx/rest/testauth')[0].body).toEqual({
        username: 'admin',
        password: 'Wrong,pass1',
      })
      expect(mockApi.callsTo('POST', '/freepbx/rest/users/admin/password')).toHaveLength(0)
      await expect(page).toHaveURL(/\/nethvoice\/settings$/)
    })

    test('changes the password and keeps the session', async ({ page, mockApi }) => {
      mockApi
        .on('POST', '/freepbx/rest/testauth', { json: { result: 'shared-secret' } })
        .on('POST', '/freepbx/rest/users/admin/password', { status: 201 })

      await page.goto('./settings')
      await page.getByRole('button', { name: 'Change admin password' }).click()
      const drawer = page.getByRole('dialog')
      await drawer.getByLabel('Current password', { exact: true }).fill(CURRENT_PASSWORD)
      await drawer.getByLabel('New password', { exact: true }).fill(NEW_PASSWORD)
      await drawer.getByLabel('Confirm password', { exact: true }).fill(NEW_PASSWORD)
      await drawer.getByRole('button', { name: 'Change password' }).click()

      await expect(page.getByText('Admin password changed')).toBeVisible()
      await expect(page.getByLabel('New password', { exact: true })).toHaveCount(0)
      await expect(page).toHaveURL(/\/nethvoice\/settings$/)

      expect(mockApi.callsTo('POST', '/freepbx/rest/users/admin/password')[0].body).toEqual({
        password: NEW_PASSWORD,
      })
      expect(mockApi.callsTo('POST', '/freepbx/rest/testauth').map((call) => call.body)).toEqual([
        { username: 'admin', password: CURRENT_PASSWORD },
        { username: 'admin', password: NEW_PASSWORD },
      ])

      const stored = await page.evaluate(() =>
        JSON.parse(localStorage.getItem('secretkey') ?? '{}'),
      )
      expect(stored.user).toBe('admin')
      expect(stored.hash).toMatch(/^[0-9a-f]{40}$/)
      expect(stored.hash).not.toBe('e2e-secret-key')
    })

    test('reports a failure inside the drawer', async ({ page, mockApi }) => {
      mockApi
        .on('POST', '/freepbx/rest/testauth', { json: { result: 'shared-secret' } })
        .on('POST', '/freepbx/rest/users/admin/password', { status: 500 })

      await page.goto('./settings')
      await page.getByRole('button', { name: 'Change admin password' }).click()
      const drawer = page.getByRole('dialog')
      await drawer.getByLabel('Current password', { exact: true }).fill(CURRENT_PASSWORD)
      await drawer.getByLabel('New password', { exact: true }).fill(NEW_PASSWORD)
      await drawer.getByLabel('Confirm password', { exact: true }).fill(NEW_PASSWORD)
      await drawer.getByRole('button', { name: 'Change password' }).click()

      await expect(drawer.getByText('Cannot change admin password')).toBeVisible()
      await expect(drawer.getByLabel('New password', { exact: true })).toHaveValue(NEW_PASSWORD)
      const stored = await page.evaluate(() =>
        JSON.parse(localStorage.getItem('secretkey') ?? '{}'),
      )
      expect(stored.hash).toBe('e2e-secret-key')
    })
  })
})
