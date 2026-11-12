//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import type { Page } from '@playwright/test'
import { expect, test, type MockApi } from '../fixtures/mockApi'
import { mockTrunksApi } from './trunks-data'
import { csvImportMock, mockUsersApi, mockWrites, RAW_USERS, REST } from './users-data'

const extensionInput = (page: Page, name: string) =>
  page.getByRole('textbox', { name: `Extension of ${name}` })

const mockStep = (mockApi: MockApi, users: unknown = RAW_USERS) => {
  mockUsersApi(mockApi, { users })
  mockTrunksApi(mockApi, { gateways: [] })
  mockApi.on('GET', `${REST}/users/:all`, { json: users })
}

test.describe('setup: users and extensions', () => {
  test.beforeEach(({ signedIn, mockApi }) => {
    void signedIn
    mockApi.on('GET', `${REST}/configuration/wizard`, { json: [{ step: 1, status: 'true' }] })
  })

  test('syncs the users and lists them with their extensions', async ({ page, mockApi }) => {
    mockStep(mockApi)
    await page.goto('./setup/users')

    await expect(page.getByText('Step 2 of 7')).toBeVisible()
    await expect(extensionInput(page, 'Anna Miller')).toHaveValue('300')
    await expect(extensionInput(page, 'Daniel Jones')).toHaveValue('')
    await expect(page.getByTestId('users-counter')).toHaveText(
      '2 out of 3 users configured with an extension',
    )
    expect(mockApi.callsTo('POST', `${REST}/users/sync`)).toHaveLength(1)

    await page.getByPlaceholder('Filter users').fill('jones')
    await expect(page.locator('[data-testid^="setup-user-"]')).toHaveCount(1)
  })

  test('shows the empty state and keeps Next disabled', async ({ page, mockApi }) => {
    mockStep(mockApi, [])
    await page.goto('./setup/users')

    await expect(page.getByText('No users yet')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Import users from CSV' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Next' })).toBeDisabled()
  })

  test('reports a load error', async ({ page, mockApi }) => {
    mockStep(mockApi)
    mockApi.on('GET', `${REST}/users/:all`, { status: 500, json: { error: 'boom' } })
    await page.goto('./setup/users')

    await expect(page.getByText('Cannot load users')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Next' })).toBeDisabled()
  })

  test('validates the extensions inline', async ({ page, mockApi }) => {
    mockStep(mockApi)
    await page.goto('./setup/users')

    await extensionInput(page, 'Daniel Jones').fill('300')
    await expect(page.getByText('This extension is already assigned to another user')).toBeVisible()
    await extensionInput(page, 'Daniel Jones').fill('3o2')
    await expect(page.getByText('Use only digits')).toBeVisible()
    await page.getByRole('button', { name: 'Next' }).click()

    await expect(extensionInput(page, 'Daniel Jones')).toBeFocused()
    expect(mockApi.callsTo('POST', `${REST}/mainextensions`)).toHaveLength(0)

    await extensionInput(page, 'Anna Miller').fill('')
    await extensionInput(page, 'Christopher Davis').fill('')
    await extensionInput(page, 'Daniel Jones').fill('')
    await expect(page.getByTestId('users-counter')).toHaveText(
      '0 out of 3 users configured with an extension',
    )
    await expect(page.getByRole('button', { name: 'Next' })).toBeDisabled()
  })

  test('configures the changed extensions with the defaults on Next', async ({ page, mockApi }) => {
    mockStep(mockApi)
    mockWrites(mockApi)
    await page.goto('./setup/users')

    await extensionInput(page, 'Daniel Jones').fill('302')
    await extensionInput(page, 'Christopher Davis').fill('')
    await page.getByRole('button', { name: 'Next' }).click()

    await expect(page).toHaveURL(/\/nethvoice\/setup\/physical-trunks$/)
    expect(mockApi.callsTo('POST', `${REST}/mainextensions`).map((call) => call.body)).toEqual([
      { username: 'c.davis', extension: '' },
      { username: 'd.jones', extension: '302' },
    ])
    expect(mockApi.callsTo('POST', `${REST}/cti/profiles/users/13`)[0].body).toEqual({
      profile_id: 1,
    })
    expect(mockApi.callsTo('POST', `${REST}/webrtc`).map((call) => call.body)).toEqual([
      { extension: '302' },
    ])
    expect(mockApi.callsTo('POST', `${REST}/configuration/wizard`)[0].body).toEqual({
      step: 2,
      status: 'true',
    })
  })

  test('stays on the step and marks the extension that failed', async ({ page, mockApi }) => {
    let release = () => {}
    const pending = new Promise<void>((resolve) => (release = resolve))
    mockStep(mockApi)
    mockWrites(mockApi).on('POST', `${REST}/mainextensions`, async () => {
      await pending
      return { status: 422, json: { message: 'Extension 302 is used by a ring group' } }
    })
    await page.goto('./setup/users')

    await extensionInput(page, 'Daniel Jones').fill('302')
    await page.getByRole('button', { name: 'Next' }).click()

    await expect(page.getByTestId('configuring-users')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Users and extensions' })).toHaveCount(0)
    release()

    await expect(page.getByText('Cannot configure the users')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Users and extensions' })).toBeVisible()
    await expect(page.getByText('Request failed')).toHaveCount(0)
    await expect(page.getByText('This extension is already in use')).toBeVisible()
    await expect(extensionInput(page, 'Daniel Jones')).toHaveValue('302')
    await expect(page).toHaveURL(/\/nethvoice\/setup\/users$/)
    expect(mockApi.callsTo('POST', `${REST}/configuration/wizard`)).toHaveLength(0)
  })

  test('shows a toast when the step cannot be saved after the users', async ({ page, mockApi }) => {
    mockStep(mockApi)
    mockWrites(mockApi).on('POST', `${REST}/configuration/wizard`, {
      status: 500,
      json: { message: 'boom' },
    })
    await page.goto('./setup/users')

    await page.getByRole('button', { name: 'Next' }).click()

    await expect(page.getByText('Request failed')).toBeVisible()
    await expect(page.getByText('Cannot configure the users')).toHaveCount(0)
    await expect(page).toHaveURL(/\/nethvoice\/setup\/users$/)
  })

  test('creates a user and keeps its extension as a draft until Next', async ({
    page,
    mockApi,
  }) => {
    const created = {
      ...RAW_USERS[2],
      id: '14',
      username: 'e.johnson',
      displayname: 'Emma Johnson',
    }
    let imported = false
    mockStep(mockApi)
    mockWrites(mockApi)
    csvImportMock(mockApi, { status: 200, json: { result: 100 } })
    mockApi
      .on('GET', `${REST}/users/:all`, () => ({
        json: imported ? [...RAW_USERS, created] : RAW_USERS,
      }))
      .on('POST', `${REST}/csv/csvimport`, () => {
        imported = true
        return { status: 200 }
      })
    await page.goto('./setup/users')

    await page.getByRole('button', { name: 'Create user' }).click()
    const drawer = page.getByRole('dialog', { name: 'Create user' })
    await expect(drawer.getByRole('combobox', { name: 'Profile' })).toHaveCount(0)
    await drawer.getByRole('textbox', { name: 'Username' }).fill('e.johnson')
    await drawer.getByRole('textbox', { name: 'Name', exact: true }).fill('Emma')
    await drawer.getByRole('textbox', { name: 'Surname' }).fill('Johnson')
    await drawer.getByLabel('Password', { exact: true }).fill('Secret,123')
    await drawer.getByLabel('Confirm password').fill('Secret,123')
    await drawer.getByRole('textbox', { name: 'Extension' }).fill('301')
    await drawer.getByRole('button', { name: 'Create' }).click()
    await expect(
      drawer.getByText('This extension is already assigned to another user'),
    ).toBeVisible()

    await drawer.getByRole('textbox', { name: 'Extension' }).fill('305')
    await drawer.getByRole('button', { name: 'Create' }).click()

    await expect(page.getByText('User created')).toBeVisible({ timeout: 15_000 })
    const file = mockApi.callsTo('POST', `${REST}/csv/csvimport`)[0].body as { file: string }
    expect(Buffer.from(file.file, 'base64').toString()).toBe(
      '"e.johnson","Emma Johnson","","Secret,123"\r\n',
    )
    await expect(extensionInput(page, 'Emma Johnson')).toHaveValue('305')
    expect(mockApi.callsTo('POST', `${REST}/mainextensions`)).toHaveLength(0)
  })
})
