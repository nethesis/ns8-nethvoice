//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import type { Page } from '@playwright/test'
import { expect, mockWizardState, test, type MockApi } from '../fixtures/mockApi'
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
    mockWizardState(mockApi, 1)
  })

  test('syncs the users and lists them with their extensions', async ({ page, mockApi }) => {
    mockStep(mockApi)
    await page.goto('./setup/users')

    await expect(page.getByText('Step 2 of 7')).toBeVisible()
    const progressFill = page.getByRole('progressbar', { name: 'Setup progress' }).locator('div')
    await expect(progressFill).not.toHaveAttribute('style')
    expect(
      await progressFill.evaluate(
        (fill) =>
          fill.getBoundingClientRect().width / fill.parentElement!.getBoundingClientRect().width,
      ),
    ).toBeCloseTo(2 / 7, 2)
    await expect(extensionInput(page, 'Anna Miller')).toHaveValue('300')
    await expect(extensionInput(page, 'Daniel Jones')).toHaveValue('')
    await expect(page.getByTestId('users-counter')).toHaveText(
      '2 out of 3 users configured with an extension',
    )
    expect(mockApi.callsTo('POST', `${REST}/users/sync`)).toHaveLength(1)

    await page.getByPlaceholder('Filter users').fill('jones')
    await expect(page.locator('[data-testid^="setup-user-"]')).toHaveCount(1)

    await page.getByPlaceholder('Filter users').fill('nothing matches')
    await expect(page.getByText('No users found')).toBeVisible()
    await expect(page.getByText('Try different or fewer words.')).toBeVisible()
    await page.getByRole('button', { name: 'Clear filter' }).click()
    await expect(page.getByPlaceholder('Filter users')).toHaveValue('')
    await expect(page.locator('[data-testid^="setup-user-"]')).toHaveCount(3)
  })

  test('synchronizes the users once per session', async ({ page, mockApi }) => {
    mockStep(mockApi)
    mockWrites(mockApi)
    await page.goto('./setup/users')

    await page.getByRole('button', { name: 'Next' }).click()
    await expect(page).toHaveURL(/\/nethvoice\/setup\/physical-trunks$/)
    await page.getByRole('button', { name: 'Previous' }).click()

    await expect(page).toHaveURL(/\/nethvoice\/setup\/users$/)
    await expect(extensionInput(page, 'Anna Miller')).toHaveValue('300')
    expect(mockApi.callsTo('POST', `${REST}/users/sync`)).toHaveLength(1)
  })

  test('keeps Next disabled while the users are synchronizing', async ({ page, mockApi }) => {
    let running = true
    mockStep(mockApi)
    mockApi.on('GET', `${REST}/users/sync`, () => ({ json: running }))
    await page.goto('./setup/users')

    await expect(extensionInput(page, 'Anna Miller')).toHaveValue('300')
    await expect(page.getByRole('button', { name: 'Next' })).toBeDisabled()

    running = false
    await expect(page.getByRole('button', { name: 'Next' })).toBeEnabled({ timeout: 10_000 })
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

    await expect(page.getByText('Cannot retrieve users')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Next' })).toBeDisabled()
  })

  test('keeps the users and the edited extensions when a refresh fails', async ({
    page,
    mockApi,
  }) => {
    let fail = false
    mockStep(mockApi)
    mockApi.on('GET', `${REST}/users/:all`, () =>
      fail ? { status: 500, json: { error: 'boom' } } : { json: RAW_USERS },
    )
    await page.goto('./setup/users')
    await extensionInput(page, 'Anna Miller').fill('310')

    fail = true
    await page.clock.install()
    await page.clock.runFor(60_000)
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))

    await expect(page.getByText('Cannot retrieve users')).toBeVisible()
    await expect(extensionInput(page, 'Anna Miller')).toHaveValue('310')
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
    await page.getByRole('button', { name: 'Next' }).click()

    await expect(page).toHaveURL(/\/nethvoice\/setup\/physical-trunks$/)
    expect(mockApi.callsTo('POST', `${REST}/mainextensions`).map((call) => call.body)).toEqual([
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

  test('writes nothing when the setup was completed in another session', async ({
    page,
    mockApi,
  }) => {
    mockStep(mockApi)
    mockWrites(mockApi)
    await page.goto('./setup/users')

    await expect(extensionInput(page, 'Anna Miller')).toHaveValue('300')
    await expect(page.getByRole('button', { name: 'Next' })).toBeEnabled()
    mockApi.on('GET', `${REST}/configuration/wizard`, { json: [{ step: 13, status: 'false' }] })
    mockApi.allowUnmockedCalls()
    const writesBefore = mockApi.calls.filter((call) => call.method !== 'GET').length

    await extensionInput(page, 'Daniel Jones').fill('302')
    await page.getByRole('button', { name: 'Next' }).click()

    await expect(page).toHaveURL(/\/nethvoice\/dashboard$/)
    await expect(page.getByText('Setup already completed')).toBeVisible()
    expect(mockApi.calls.filter((call) => call.method !== 'GET')).toHaveLength(writesBefore)
  })

  test('stops with an error when the Base profile is missing', async ({ page, mockApi }) => {
    mockStep(mockApi)
    mockWrites(mockApi)
    mockApi.on('GET', `${REST}/cti/profiles`, { json: [] })
    await page.goto('./setup/users')

    await extensionInput(page, 'Daniel Jones').fill('302')
    await page.getByRole('button', { name: 'Next' }).click()

    await expect(page.getByText('Cannot configure the users')).toBeVisible()
    await expect(
      page.getByText('Configuration stopped at d.jones: The Base profile could not be found'),
    ).toBeVisible()
    await expect(page).toHaveURL(/\/nethvoice\/setup\/users$/)
    expect(mockApi.callsTo('POST', `${REST}/cti/profiles/users/:id`)).toHaveLength(0)
    expect(mockApi.callsTo('POST', `${REST}/configuration/wizard`)).toHaveLength(0)
  })

  test('keeps the extension of a configured user and removes it only from the menu', async ({
    page,
    mockApi,
  }) => {
    mockStep(mockApi)
    mockWrites(mockApi)
    await page.goto('./setup/users')

    await extensionInput(page, 'Christopher Davis').fill('')
    await expect(
      page.getByText('Enter an extension. To remove it, use Remove extension in the user menu.'),
    ).toBeVisible()
    await page.getByRole('button', { name: 'Next' }).click()

    await expect(extensionInput(page, 'Christopher Davis')).toBeFocused()
    expect(mockApi.callsTo('POST', `${REST}/mainextensions`)).toHaveLength(0)
    expect(mockApi.callsTo('POST', `${REST}/configuration/wizard`)).toHaveLength(0)

    await page.getByRole('button', { name: 'Actions for d.jones' }).click()
    await expect(page.getByRole('menuitem', { name: 'Remove extension' })).toBeDisabled()
    await page.getByRole('button', { name: 'Actions for d.jones' }).click()
    await expect(page.getByRole('menuitem', { name: 'Remove extension' })).toHaveCount(0)

    await page.getByRole('button', { name: 'Actions for c.davis' }).click()
    await page.getByRole('menuitem', { name: 'Remove extension' }).click()
    const modal = page.getByRole('dialog', { name: 'Remove extension' })
    await expect(modal).toContainText('The extension 301 of Christopher Davis will be removed')
    await modal.getByRole('button', { name: 'Remove extension' }).click()

    await expect(modal).toBeHidden()
    expect(mockApi.callsTo('POST', `${REST}/mainextensions`).map((call) => call.body)).toEqual([
      { username: 'c.davis', extension: '' },
    ])
  })

  test('warns that changing an extension deletes the devices', async ({ page, mockApi }) => {
    mockStep(mockApi)
    mockWrites(mockApi)
    await page.goto('./setup/users')

    await extensionInput(page, 'Anna Miller').fill('310')
    await page.getByRole('button', { name: 'Next' }).click()

    const modal = page.getByRole('dialog', { name: 'Change extensions' })
    await expect(modal).toContainText('removes the user from all the groups')
    await expect(modal).toContainText('Only the Web phone is created again')
    await expect(modal).not.toContainText('are kept')
    await expect(modal.getByTestId('changed-extensions')).toHaveText('Anna Miller: 300 → 310')
    await modal.getByRole('button', { name: 'Cancel' }).click()

    await expect(modal).toBeHidden()
    expect(mockApi.callsTo('POST', `${REST}/mainextensions`)).toHaveLength(0)

    await page.getByRole('button', { name: 'Next' }).click()
    await modal.getByRole('button', { name: 'Change', exact: true }).click()

    await expect(page).toHaveURL(/\/nethvoice\/setup\/physical-trunks$/)
    expect(mockApi.callsTo('POST', `${REST}/mainextensions`).map((call) => call.body)).toEqual([
      { username: 'a.miller', extension: '310' },
    ])
  })

  test('returns the focus to Next when the devices dialog is closed with Esc', async ({
    page,
    mockApi,
  }) => {
    mockStep(mockApi)
    await page.goto('./setup/users')

    await extensionInput(page, 'Anna Miller').fill('310')
    const next = page.getByRole('button', { name: 'Next' })
    await next.click()

    const modal = page.getByRole('dialog', { name: 'Change extensions' })
    await expect(modal.getByRole('heading', { name: 'Change extensions' })).toBeVisible()
    await page.keyboard.press('Escape')

    await expect(modal).toHaveCount(0)
    await expect(next).toBeFocused()
  })

  test('blocks the help and sign out controls while the users are configured', async ({
    page,
    mockApi,
  }) => {
    let release: () => void = () => undefined
    const pending = new Promise<void>((resolve) => (release = resolve))
    mockStep(mockApi)
    mockWrites(mockApi)
    mockApi.on('POST', `${REST}/mainextensions`, async () => {
      await pending
      return { status: 201 }
    })
    await page.goto('./setup/users')

    const signOut = page.locator('aside button', { hasText: 'Sign out' })
    const help = page.locator('aside a', { hasText: 'Need help?' })
    await expect(help).toHaveAttribute('target', '_blank')
    await expect(help).toContainText('(opens in a new tab)')
    await help.focus()
    await page.keyboard.press('Tab')
    await expect(signOut).toBeFocused()
    expect(await signOut.evaluate((element) => getComputedStyle(element).boxShadow)).not.toBe(
      'none',
    )

    await extensionInput(page, 'Daniel Jones').fill('302')
    await page.getByRole('button', { name: 'Next' }).click()
    await expect(page.getByText('Configuring users')).toBeVisible()
    await expect
      .poll(() => signOut.evaluate((element) => element.closest('[inert]') !== null))
      .toBe(true)
    await signOut.click({ force: true })
    expect(mockApi.callsTo('GET', `${REST}/logout`)).toHaveLength(0)

    release()
    await expect(page).toHaveURL(/\/nethvoice\/setup\/physical-trunks$/)
    expect(mockApi.callsTo('GET', `${REST}/logout`)).toHaveLength(0)
  })

  test('reports a failed synchronization with the account provider', async ({ page, mockApi }) => {
    let failing = true
    mockStep(mockApi)
    mockApi.on('POST', `${REST}/users/sync`, () =>
      failing ? { status: 500, json: { message: 'boom' } } : { status: 200 },
    )
    await page.goto('./setup/users')

    const warning = page.getByText('Cannot synchronize the users')
    await expect(warning).toBeVisible()
    await expect(extensionInput(page, 'Anna Miller')).toHaveValue('300')

    failing = false
    await page.getByRole('button', { name: 'Retry' }).click()

    await expect(warning).toHaveCount(0)
    expect(mockApi.callsTo('POST', `${REST}/users/sync`)).toHaveLength(2)
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

    await expect(page.getByText('Cannot save the setup progress')).toBeVisible()
    await expect(page.getByText('Cannot configure the users')).toHaveCount(0)
    await expect(page).toHaveURL(/\/nethvoice\/setup\/users$/)
  })

  test('creates a user with its extension and keeps it after a reload', async ({
    page,
    mockApi,
  }) => {
    let created: object | undefined
    mockStep(mockApi)
    mockWrites(mockApi)
    csvImportMock(mockApi, { status: 200, json: { result: 100 } })
    mockApi
      .on('GET', `${REST}/users/:all`, () => ({
        json: created ? [...RAW_USERS, created] : RAW_USERS,
      }))
      .on('POST', `${REST}/csv/csvimport`, (request) => {
        const csv = Buffer.from((request.body as { file: string }).file, 'base64').toString()
        created = {
          ...RAW_USERS[2],
          id: '14',
          username: 'e.johnson',
          displayname: 'Emma Johnson',
          default_extension: csv.split(',')[2].replaceAll('"', '') || 'none',
          profile: null,
        }
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
      '"e.johnson","Emma Johnson","305","Secret,123"\r\n',
    )
    expect(mockApi.callsTo('POST', `${REST}/cti/profiles/users/14`)[0].body).toEqual({
      profile_id: 1,
    })
    await expect(extensionInput(page, 'Emma Johnson')).toHaveValue('305')

    await page.reload()

    await expect(extensionInput(page, 'Emma Johnson')).toHaveValue('305')
    await expect(page.getByTestId('users-counter')).toHaveText(
      '3 out of 4 users configured with an extension',
    )
    await page.getByRole('button', { name: 'Next' }).click()

    await expect(page).toHaveURL(/\/nethvoice\/setup\/physical-trunks$/)
    expect(mockApi.callsTo('POST', `${REST}/mainextensions`)).toHaveLength(0)
    expect(mockApi.callsTo('POST', `${REST}/webrtc`).map((call) => call.body)).toEqual([
      { extension: '305' },
    ])
  })

  test('does not create a user with an extension when the Base profile is missing', async ({
    page,
    mockApi,
  }) => {
    mockStep(mockApi)
    mockWrites(mockApi)
    mockApi
      .on('GET', `${REST}/cti/profiles`, { json: [] })
      .on('POST', `${REST}/csv/csvimport`, { status: 200 })
    await page.goto('./setup/users')

    await page.getByRole('button', { name: 'Create user' }).click()
    const drawer = page.getByRole('dialog', { name: 'Create user' })
    await drawer.getByRole('textbox', { name: 'Username' }).fill('e.johnson')
    await drawer.getByRole('textbox', { name: 'Name', exact: true }).fill('Emma')
    await drawer.getByRole('textbox', { name: 'Surname' }).fill('Johnson')
    await drawer.getByLabel('Password', { exact: true }).fill('Secret,123')
    await drawer.getByLabel('Confirm password').fill('Secret,123')
    await drawer.getByRole('textbox', { name: 'Extension' }).fill('305')
    await drawer.getByRole('button', { name: 'Create' }).click()

    await expect(drawer.getByText('The Base profile could not be found')).toBeVisible()
    await expect(drawer.getByRole('textbox', { name: 'Extension' })).toBeFocused()
    expect(mockApi.callsTo('POST', `${REST}/csv/csvimport`)).toHaveLength(0)
  })
})
