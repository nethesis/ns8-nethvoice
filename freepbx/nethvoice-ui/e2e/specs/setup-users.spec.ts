//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import type { Page } from '@playwright/test'
import { expect, mockWizardState, test, type MockApi } from '../fixtures/mockApi'
import { mockTrunksApi } from './trunks-data'
import { csvImportMock, mockUsersApi, mockWrites, RAW_USERS, REST } from './users-data'

const extensionInput = (page: Page, name: string) =>
  page.getByRole('textbox', { name: `Extension of ${name}` })

const mockStep = (mockApi: MockApi, users: unknown = RAW_USERS, accounts?: unknown) => {
  mockUsersApi(mockApi, { users, accounts })
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

    await expect(page.getByText('Step 2/7')).toBeVisible()
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

    const header = page.getByRole('main').locator('div', {
      has: page.getByRole('heading', { name: 'Users and extensions', level: 1 }),
    })
    await expect(header.last().getByRole('button', { name: 'Create user' })).toBeVisible()
    await expect(header.last().getByRole('button', { name: 'Actions', exact: true })).toBeVisible()
    await expect(page.getByTestId('setup-user-a.miller')).toContainText('AM')
    await expect(
      page.getByTestId('setup-user-a.miller').locator('svg[data-icon="check"]'),
    ).toBeVisible()
    await expect(
      page.getByTestId('setup-user-d.jones').locator('svg[data-icon="check"]'),
    ).toHaveCount(0)

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

    await expect(page.getByText('No users configured')).toBeVisible()
    await expect(page.getByText('Create users or import them from a CSV file.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Create user' })).toHaveCount(1)
    await expect(page.getByRole('button', { name: 'Import users from CSV' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Actions', exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Next' })).toBeDisabled()
  })

  test('reports a load error', async ({ page, mockApi }) => {
    mockStep(mockApi)
    mockApi.on('GET', `${REST}/users/:all`, { status: 500, json: { error: 'boom' } })
    await page.goto('./setup/users')

    await expect(page.getByText('Cannot retrieve users')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible()
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
  })

  test('asks for at least one extension on Next', async ({ page, mockApi }) => {
    mockStep(mockApi, [
      { ...RAW_USERS[0], default_extension: 'none' },
      { ...RAW_USERS[1], default_extension: 'none' },
      RAW_USERS[2],
    ])
    await page.goto('./setup/users')

    await expect(page.getByTestId('users-counter')).toHaveText(
      '0 out of 3 users configured with an extension',
    )
    await page.getByPlaceholder('Filter users').fill('nothing matches')
    const next = page.getByRole('button', { name: 'Next' })
    await expect(next).toBeEnabled()
    await next.click()

    await expect(page.getByPlaceholder('Filter users')).toHaveValue('')
    await expect(page.getByText('Assign at least one extension to continue')).toHaveCount(1)
    await expect(
      page
        .getByTestId('setup-user-a.miller')
        .getByText('Assign at least one extension to continue'),
    ).toBeVisible()
    await expect(extensionInput(page, 'Anna Miller')).toBeFocused()
    expect(mockApi.callsTo('POST', `${REST}/mainextensions`)).toHaveLength(0)
    expect(mockApi.callsTo('POST', `${REST}/configuration/wizard`)).toHaveLength(0)

    await extensionInput(page, 'Daniel Jones').fill('302')
    await expect(page.getByText('Assign at least one extension to continue')).toHaveCount(0)
  })

  test('points to the users limit on Next instead of disabling it', async ({ page, mockApi }) => {
    mockStep(mockApi)
    mockApi.on('GET', `${REST}/mainextensions/userlimits`, {
      json: { configured: 2, limit: 2, configurable: 0 },
    })
    await page.goto('./setup/users')

    await extensionInput(page, 'Daniel Jones').fill('302')
    await expect(page.getByText('Too many users with an extension')).toBeVisible()
    const next = page.getByRole('button', { name: 'Next' })
    await expect(next).toBeEnabled()
    await next.click()

    await expect(page.locator(':focus')).toContainText('Too many users with an extension')
    expect(mockApi.callsTo('POST', `${REST}/mainextensions`)).toHaveLength(0)
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

    const toasts = page.getByTestId('toast-notifications')
    await expect(toasts.getByText('Cannot configure users')).toBeVisible()
    await expect(
      toasts.getByText(
        'Configuration stopped at Daniel Jones: The Base profile could not be found',
      ),
    ).toBeVisible()
    await expect(extensionInput(page, 'Daniel Jones')).toBeFocused()
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

  test('changes the extension of a configured user without asking', async ({ page, mockApi }) => {
    mockStep(mockApi)
    mockWrites(mockApi)
    await page.goto('./setup/users')

    await extensionInput(page, 'Anna Miller').fill('310')
    await page.getByRole('button', { name: 'Next' }).click()

    await expect(page).toHaveURL(/\/nethvoice\/setup\/physical-trunks$/)
    expect(mockApi.callsTo('POST', `${REST}/mainextensions`).map((call) => call.body)).toEqual([
      { username: 'a.miller', extension: '310' },
    ])
  })

  test('deletes a user from the card menu', async ({ page, mockApi }) => {
    let users = RAW_USERS
    mockStep(mockApi)
    mockApi
      .on('GET', `${REST}/users/:all`, () => ({ json: users }))
      .on('DELETE', `${REST}/users/:username/account`, () => {
        users = users.filter((user) => user.username !== 'd.jones')
        return { json: { synchronized: true, cleaned: true } }
      })
    await page.goto('./setup/users')

    await page.getByRole('button', { name: 'Actions for d.jones' }).click()
    await expect(page.getByRole('menuitem')).toHaveText(['Remove extension', 'Delete'])
    await page.getByRole('menuitem', { name: 'Delete' }).click()

    const modal = page.getByRole('dialog', { name: 'Delete user' })
    await expect(modal.getByTestId('delete-user-confirmation')).toContainText(
      'User Daniel Jones (d.jones) will be permanently deleted.',
    )
    await modal.getByRole('button', { name: 'Delete', exact: true }).click()

    await expect(page.getByTestId('toast-notifications').getByText('User deleted')).toBeVisible()
    await expect(page.getByTestId('setup-user-d.jones')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Actions for d.jones' })).toHaveCount(0)
    expect(mockApi.callsTo('DELETE', `${REST}/users/d.jones/account`)).toHaveLength(1)
    expect(mockApi.callsTo('POST', `${REST}/mainextensions`)).toHaveLength(0)
  })

  test('follows the account restrictions of the users page for Delete', async ({
    page,
    mockApi,
  }) => {
    mockStep(mockApi, RAW_USERS, [
      {
        username: 'c.davis',
        display_name: 'Christopher Davis',
        mail: '',
        locked: false,
        domain_admin: true,
      },
    ])
    await page.goto('./setup/users')

    await page.getByRole('button', { name: 'Actions for c.davis' }).click()
    await expect(page.getByRole('menuitem', { name: 'Delete' })).toBeDisabled()
    await expect(page.getByTestId('account-restriction-c.davis')).toBeVisible()
    await page.keyboard.press('Escape')

    mockApi.on('GET', `${REST}/users/domain`, { json: { manageable: false, reason: 'external' } })
    await page.reload()
    await page.getByRole('button', { name: 'Actions for c.davis' }).click()
    await expect(page.getByRole('menuitem')).toHaveText(['Remove extension'])
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

    const toasts = page.getByTestId('toast-notifications')
    await expect(toasts.getByText('Cannot configure users')).toBeVisible()
    await expect(toasts.getByText('Configuration stopped at Daniel Jones:')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Users and extensions' })).toBeVisible()
    await expect(page.getByText('Request failed')).toHaveCount(0)
    await expect(page.getByText('This extension is already in use')).toBeVisible()
    await expect(extensionInput(page, 'Daniel Jones')).toHaveValue('302')
    await expect(extensionInput(page, 'Daniel Jones')).toBeFocused()
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
    await expect(page.getByText('Cannot configure users')).toHaveCount(0)
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
    await drawer.getByRole('textbox', { name: 'First name', exact: true }).fill('Emma')
    await drawer.getByRole('textbox', { name: 'Last name' }).fill('Johnson')
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
    await drawer.getByRole('textbox', { name: 'First name', exact: true }).fill('Emma')
    await drawer.getByRole('textbox', { name: 'Last name' }).fill('Johnson')
    await drawer.getByLabel('Password', { exact: true }).fill('Secret,123')
    await drawer.getByLabel('Confirm password').fill('Secret,123')
    await drawer.getByRole('textbox', { name: 'Extension' }).fill('305')
    await drawer.getByRole('button', { name: 'Create' }).click()

    await expect(drawer.getByText('The Base profile could not be found')).toBeVisible()
    await expect(drawer.getByRole('textbox', { name: 'Extension' })).toBeFocused()
    expect(mockApi.callsTo('POST', `${REST}/csv/csvimport`)).toHaveLength(0)
  })
})

test.describe('setup: Previous moves the saved progress back', () => {
  const WIZARD = `${REST}/configuration/wizard`

  test.beforeEach(({ signedIn, mockApi }) => {
    void signedIn
    mockWizardState(mockApi, 2)
    mockStep(mockApi)
  })

  test('saves the previous step and resumes there after a reload', async ({ page, mockApi }) => {
    await page.goto('./setup/physical-trunks')
    await expect(page.getByText('Step 3/7')).toBeVisible()

    await page.getByRole('button', { name: 'Previous' }).click()

    await expect(page).toHaveURL(/\/nethvoice\/setup\/users$/)
    await expect(page.getByText('Step 2/7')).toBeVisible()
    expect(mockApi.callsTo('POST', WIZARD).map((call) => call.body)).toEqual([
      { step: 1, status: 'true' },
    ])

    await page.goto('./setup/physical-trunks')
    await expect(page).toHaveURL(/\/nethvoice\/setup\/users$/)

    await page.goto('./setup')
    await page.getByRole('button', { name: 'Start setup' }).click()

    await expect(page).toHaveURL(/\/nethvoice\/setup\/users$/)
    await expect(
      page.getByRole('heading', { name: 'Users and extensions', level: 1 }),
    ).toBeFocused()
    expect(mockApi.callsTo('POST', WIZARD)).toHaveLength(1)
  })

  test('does not go back once the setup was completed in another session', async ({
    page,
    mockApi,
  }) => {
    mockApi.allowUnmockedCalls()
    await page.goto('./setup/physical-trunks')
    await expect(page.getByText('Step 3/7')).toBeVisible()
    mockWizardState(mockApi, 13, false)

    await page.getByRole('button', { name: 'Previous' }).click()

    await expect(page).toHaveURL(/\/nethvoice\/dashboard$/)
    await expect(page.getByText('Setup already completed')).toBeVisible()
    expect(mockApi.callsTo('POST', WIZARD)).toHaveLength(0)
  })

  test('stays on the step and shows the error when the progress cannot be saved', async ({
    page,
    mockApi,
  }) => {
    let release: () => void = () => undefined
    const saved = new Promise<void>((resolve) => {
      release = resolve
    })
    mockApi.on('POST', WIZARD, async () => {
      await saved
      return { status: 500, json: { message: 'boom' } }
    })
    await page.goto('./setup/physical-trunks')
    await expect(page.getByText('Step 3/7')).toBeVisible()

    await page.getByRole('button', { name: 'Previous' }).click()

    await expect(page.getByRole('button', { name: 'Previous' })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Next' })).toBeDisabled()
    release()

    await expect(page.getByRole('main').getByText('Cannot save the setup progress')).toBeVisible()
    await expect(page.getByTestId('toast-notifications')).not.toContainText('Cannot save')
    await expect(page).toHaveURL(/\/nethvoice\/setup\/physical-trunks$/)
    await expect(page.getByRole('button', { name: 'Previous' })).toBeEnabled()
    await expect(page.getByRole('button', { name: 'Next' })).toBeEnabled()
    expect(mockApi.callsTo('POST', WIZARD)[0].body).toEqual({ step: 1, status: 'true' })
  })
})
