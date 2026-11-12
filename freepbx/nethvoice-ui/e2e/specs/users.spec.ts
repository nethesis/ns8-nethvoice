//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { expect, test } from '../fixtures/mockApi'
import {
  csvImportMock,
  FREE_PHONE_MAC,
  mockUserPhonesApi,
  mockUsersApi,
  mockWrites,
  RAW_USERS,
  REST,
} from './users-data'

const IMPORT_TIMEOUT = { timeout: 15_000 }

test.describe('users', () => {
  test.beforeEach(({ signedIn, mockApi }) => {
    void signedIn
    mockUsersApi(mockApi)
    mockUserPhonesApi(mockApi)
  })

  test('lists the users with groups, profile, devices and phones', async ({ page }) => {
    await page.goto('./users/users')

    await expect(page.getByTestId('users-counter')).toHaveText(
      '2 out of 3 users configured with an extension',
    )
    const anna = page.getByTestId('user-a.miller')
    await expect(anna).toContainText('Anna Miller')
    await expect(anna).toContainText('300')
    await expect(anna).toContainText('Sales')
    await expect(anna).toContainText('Standard')
    await expect(anna.getByText('Voicemail enabled')).toBeAttached()
    await expect(anna.getByTestId('device-webrtc')).toBeVisible()

    const christopher = page.getByTestId('user-c.davis')
    await expect(christopher).toContainText('Backoffice, Sales')
    await expect(christopher).toContainText('+ 1 more')
    await expect(christopher.getByTestId('device-nethlink')).toBeVisible()

    const daniel = page.getByTestId('user-d.jones')
    await expect(daniel.locator('td').nth(1)).toHaveText(/-$/)
  })

  test('filters by text, voicemail, groups and devices', async ({ page }) => {
    await page.goto('./users/users')
    const rows = page.locator('[data-testid^="user-"]')
    await expect(rows).toHaveCount(3)

    await page.getByPlaceholder('Filter users').fill('davis')
    await expect(rows).toHaveCount(1)
    await page.getByPlaceholder('Filter users').fill('')

    await page.getByRole('button', { name: 'Voicemail', exact: true }).click()
    await page.getByRole('radio', { name: 'Voicemail enabled' }).click()
    await expect(rows).toHaveCount(1)
    await expect(rows.first()).toContainText('a.miller')

    await page.getByRole('button', { name: 'Reset filters' }).click()
    await expect(rows).toHaveCount(3)

    await page.getByRole('button', { name: 'Devices', exact: true }).click()
    await page.getByRole('checkbox', { name: 'Desktop app' }).click()
    await expect(rows).toHaveCount(1)
    await expect(rows.first()).toContainText('c.davis')

    await page.keyboard.press('Escape')
    await page.getByPlaceholder('Filter users').fill('nobody')
    await expect(page.getByText('No users found')).toBeVisible()
  })

  test('sorts by extension', async ({ page }) => {
    await page.goto('./users/users')
    await page.getByRole('columnheader', { name: 'Extension' }).click()
    await page.getByRole('columnheader', { name: 'Extension' }).click()

    await expect(page.locator('[data-testid^="user-"]').first()).toContainText('c.davis')
  })

  test('shows the empty state', async ({ page, mockApi }) => {
    mockUsersApi(mockApi, { users: [] })
    await page.goto('./users/users')

    await expect(page.getByText('No users', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Create user' })).toHaveCount(1)
    await expect(page.getByRole('button', { name: 'Import users from CSV' })).toBeVisible()
    await expect(page.getByTestId('users-counter')).toHaveCount(0)
    await expect(page.getByPlaceholder('Filter users')).toHaveCount(0)
  })

  test('shows the users when only some details cannot be loaded', async ({ page, mockApi }) => {
    mockApi.on('GET', `${REST}/cti/profiles`, { status: 500, json: { error: 'boom' } })
    await page.goto('./users/users')

    await expect(page.getByTestId('user-a.miller')).toBeVisible()
    await expect(page.getByTestId('users-directory-warning')).toContainText('Cannot load: Profiles')
    await page.getByRole('button', { name: 'Edit a.miller' }).click()
    const drawer = page.getByRole('dialog', { name: 'Edit user a.miller' })
    await expect(drawer.getByRole('combobox', { name: 'Profile' })).toBeDisabled()
  })

  test('reports a load error and retries', async ({ page, mockApi }) => {
    let calls = 0
    mockApi.on('GET', `${REST}/users/:all`, () => {
      calls += 1
      return calls === 1 ? { status: 500, json: { error: 'boom' } } : { json: RAW_USERS }
    })
    await page.goto('./users/users')

    await expect(page.getByText('Cannot load users')).toBeVisible()
    await page.getByRole('button', { name: 'Retry' }).click()
    await expect(page.getByTestId('user-a.miller')).toBeVisible()
  })

  test('edits a user: mobile, voicemail, profile, groups, devices and phones', async ({
    page,
    mockApi,
  }) => {
    mockWrites(mockApi)
      .on('DELETE', `${REST}/physicalextensions/:ext`, { status: 200 })
      .on('POST', `${REST}/physicalextensions`, { json: { extension: '92300' } })
      .on('POST', `${REST}/extensions/:ext/srtp/:value`, { status: 200 })
      .on('POST', `${REST}/phones/rps/:mac`, { status: 200 })
      .on('GET', '/tancredi/api/v1/phones/:mac', { json: { mac: FREE_PHONE_MAC } })
    await page.goto('./users/users')
    await page.getByRole('button', { name: 'Edit a.miller' }).click()

    const drawer = page.getByRole('dialog', { name: 'Edit user a.miller' })
    await expect(drawer.getByRole('textbox', { name: 'Extension' })).toHaveValue('300')
    await drawer.getByRole('textbox', { name: 'Mobile number' }).fill('+39 333 7654321')
    await drawer.getByText('Enabled', { exact: true }).click()
    await drawer.getByRole('combobox', { name: 'Profile' }).click()
    await drawer.getByRole('option', { name: 'Advanced' }).click()
    await drawer.getByRole('combobox', { name: 'Groups' }).click()
    await drawer.getByRole('option', { name: 'Support' }).click()
    await page.keyboard.press('Escape')
    await drawer.getByRole('combobox', { name: 'Devices' }).click()
    await drawer.getByRole('option', { name: 'Mobile app' }).click()
    await page.keyboard.press('Escape')
    await drawer.getByRole('button', { name: 'Remove physical phone 1' }).click()
    await drawer.getByRole('button', { name: 'Add phone' }).click()
    await drawer.getByPlaceholder('Choose phone').click()
    await drawer.getByRole('option', { name: /0C:38:3E:00:00:02/ }).click()
    await drawer.getByRole('button', { name: 'Save' }).click()

    await expect(page.getByText('User updated')).toBeVisible()
    expect(mockApi.callsTo('POST', `${REST}/mainextensions`)).toHaveLength(0)
    expect(mockApi.callsTo('POST', `${REST}/mobiles`)[0].body).toEqual({
      username: 'a.miller',
      mobile: '+39 333 7654321',
    })
    expect(mockApi.callsTo('POST', `${REST}/cti/profiles/users/11`)[0].body).toEqual({
      profile_id: 3,
    })
    expect(mockApi.callsTo('POST', `${REST}/cti/groups/users/11`)[0].body).toEqual({
      groups: [1, 2],
    })
    expect(mockApi.callsTo('POST', `${REST}/voicemails`)[0].body).toEqual({
      extension: '300',
      state: 'no',
    })
    expect(mockApi.callsTo('POST', `${REST}/mobileapp`)[0].body).toEqual({ mainextension: '300' })
    expect(mockApi.callsTo('DELETE', `${REST}/physicalextensions/91300`)).toHaveLength(1)
    expect(mockApi.callsTo('POST', `${REST}/physicalextensions`)[0].body).toMatchObject({
      mainextension: '300',
      mac: FREE_PHONE_MAC,
      model: 'fanvil-X4U',
    })
  })

  test('validates the extension of an edited user', async ({ page, mockApi }) => {
    mockWrites(mockApi)
    await page.goto('./users/users')
    await page.getByRole('button', { name: 'Edit d.jones' }).click()
    const drawer = page.getByRole('dialog', { name: 'Edit user d.jones' })

    await drawer.getByRole('textbox', { name: 'Extension' }).fill('30a')
    await drawer.getByRole('button', { name: 'Save' }).click()
    await expect(drawer.getByText('Use only digits')).toBeVisible()

    await drawer.getByRole('textbox', { name: 'Extension' }).fill('301')
    await drawer.getByRole('button', { name: 'Save' }).click()
    await expect(
      drawer.getByText('This extension is already assigned to another user'),
    ).toBeVisible()
    await drawer.getByRole('textbox', { name: 'Extension' }).fill('3')
    await expect(
      drawer.getByText('This extension is already assigned to another user'),
    ).toBeHidden()
    expect(mockApi.callsTo('POST', `${REST}/mainextensions`)).toHaveLength(0)
  })

  test('shows the physical phones without MAC address of a user', async ({ page, mockApi }) => {
    const [miller, ...others] = RAW_USERS
    mockUsersApi(mockApi, {
      users: [
        {
          ...miller,
          devices: [
            ...miller.devices,
            { ...miller.devices[0], id: 9, type: 'physical', extension: '93300' },
          ],
        },
        ...others,
      ],
    })
    await page.goto('./users/users')
    await page.getByRole('button', { name: 'Edit a.miller' }).click()
    const drawer = page.getByRole('dialog', { name: 'Edit user a.miller' })

    await expect(drawer.getByTestId('user-phone-without-mac')).toHaveText(
      'Phone on extension 93300, without MAC address',
    )
    await expect(drawer.getByTestId('user-phone-row')).toHaveCount(1)
  })

  test('does not remove the extension when the field is emptied', async ({ page, mockApi }) => {
    mockWrites(mockApi)
    await page.goto('./users/users')
    await page.getByRole('button', { name: 'Edit c.davis' }).click()
    const drawer = page.getByRole('dialog', { name: 'Edit user c.davis' })

    await drawer.getByRole('textbox', { name: 'Extension' }).fill('')
    await expect(drawer.getByText('The devices will be recreated')).toBeHidden()
    await drawer.getByRole('button', { name: 'Save' }).click()

    await expect(
      drawer.getByText('Enter an extension. To remove it, use Remove extension'),
    ).toBeVisible()
    await expect(drawer.getByRole('textbox', { name: 'Extension' })).toBeFocused()
    expect(mockApi.callsTo('POST', `${REST}/mainextensions`)).toHaveLength(0)
    expect(mockApi.callsTo('POST', `${REST}/cti/groups/users/12`)).toHaveLength(0)
  })

  test('resumes a partially applied edit from the updated user', async ({ page, mockApi }) => {
    let davisExtension = '301'
    let voicemailFails = true
    mockWrites(mockApi)
      .on('GET', `${REST}/users/:all`, () => ({
        json: RAW_USERS.map((user) =>
          user.username === 'c.davis' && davisExtension !== '301'
            ? { ...user, default_extension: davisExtension, devices: [] }
            : user,
        ),
      }))
      .on('POST', `${REST}/mainextensions`, (request) => {
        davisExtension = (request.body as { extension: string }).extension
        return { status: 201 }
      })
      .on('POST', `${REST}/voicemails`, () =>
        voicemailFails ? { status: 500, json: { error: 'boom' } } : { json: { status: true } },
      )
    await page.goto('./users/users')
    await page.getByRole('button', { name: 'Edit c.davis' }).click()
    const drawer = page.getByRole('dialog', { name: 'Edit user c.davis' })

    await drawer.getByRole('textbox', { name: 'Extension' }).fill('299')
    await drawer.getByText('Disabled', { exact: true }).click()
    await drawer.getByRole('button', { name: 'Save' }).click()

    const failure = drawer.getByTestId('user-save-error')
    await expect(failure).toContainText('Cannot change the voicemail')
    await expect(failure).toContainText('These changes are already applied: extension, groups.')
    await expect(failure).toBeFocused()

    voicemailFails = false
    await drawer.getByRole('button', { name: 'Save' }).click()

    await expect(page.getByText('User updated')).toBeVisible()
    expect(mockApi.callsTo('POST', `${REST}/mainextensions`)).toHaveLength(1)
    expect(mockApi.callsTo('POST', `${REST}/voicemails`).at(-1)?.body).toEqual({
      extension: '299',
      state: 'yes',
    })
    expect(mockApi.callsTo('POST', `${REST}/webrtc`).at(-1)?.body).toEqual({ extension: '299' })
  })

  test('asks before closing a drawer with unsaved changes', async ({ page, mockApi }) => {
    let release = () => {}
    const pending = new Promise<void>((resolve) => (release = resolve))
    mockWrites(mockApi).on('POST', `${REST}/mobiles`, async () => {
      await pending
      return { status: 200 }
    })
    await page.goto('./users/users')
    await page.getByRole('button', { name: 'Edit a.miller' }).click()
    const drawer = page.getByRole('dialog', { name: 'Edit user a.miller' })

    await drawer.getByRole('textbox', { name: 'Mobile number' }).fill('3330000000')
    await drawer.getByRole('button', { name: 'Cancel' }).click()
    const modal = page.getByRole('dialog', { name: 'Unsaved changes' })
    await modal.getByRole('button', { name: 'Keep editing' }).click()
    await expect(drawer.getByRole('textbox', { name: 'Mobile number' })).toHaveValue('3330000000')

    await drawer.getByRole('button', { name: 'Save' }).click()
    await page.keyboard.press('Escape')
    await expect(drawer.getByRole('textbox', { name: 'Mobile number' })).toBeVisible()
    await expect(page.getByRole('dialog', { name: 'Unsaved changes' })).toHaveCount(0)
    release()
    await expect(page.getByText('User updated')).toBeVisible()

    await page.getByRole('button', { name: 'Edit c.davis' }).click()
    const other = page.getByRole('dialog', { name: 'Edit user c.davis' })
    await other.getByRole('textbox', { name: 'Mobile number' }).fill('3331111111')
    await other.getByRole('button', { name: 'Close' }).click()
    await page
      .getByRole('dialog', { name: 'Unsaved changes' })
      .getByRole('button', {
        name: 'Discard changes',
      })
      .click()
    await expect(other.getByRole('textbox', { name: 'Mobile number' })).toBeHidden()
    expect(mockApi.callsTo('POST', `${REST}/mobiles`)).toHaveLength(1)
  })

  test('shows the backend error when the extension is in use', async ({ page, mockApi }) => {
    mockWrites(mockApi).on('POST', `${REST}/mainextensions`, {
      status: 422,
      json: { message: 'Extension 302 is used by a queue' },
    })
    await page.goto('./users/users')
    await page.getByRole('button', { name: 'Edit d.jones' }).click()
    const drawer = page.getByRole('dialog', { name: 'Edit user d.jones' })

    await drawer.getByRole('textbox', { name: 'Extension' }).fill('302')
    await drawer.getByRole('combobox', { name: 'Profile' }).click()
    await drawer.getByRole('option', { name: 'Base' }).click()
    await drawer.getByRole('button', { name: 'Save' }).click()

    await expect(drawer.getByText('Cannot assign the extension')).toBeVisible()
    await expect(drawer.getByText('This extension is already in use')).toBeVisible()
    expect(mockApi.callsTo('POST', `${REST}/mainextensions`)[0].body).toEqual({
      username: 'd.jones',
      extension: '302',
    })
  })

  test('creates a user through the CSV import and applies the settings', async ({
    page,
    mockApi,
  }) => {
    const created = {
      ...RAW_USERS[2],
      id: '14',
      username: 'e.johnson',
      displayname: 'Emma Johnson',
      default_extension: '305',
      devices: [],
    }
    let imported = false
    mockWrites(mockApi)
    csvImportMock(mockApi, { status: 200, json: { result: 100 } })
    mockApi.on('GET', `${REST}/users/:all`, () => ({
      json: imported ? [...RAW_USERS, created] : RAW_USERS,
    }))
    mockApi.on('POST', `${REST}/csv/csvimport`, () => {
      imported = true
      return { status: 200 }
    })

    await page.goto('./users/users')
    await page.getByRole('button', { name: 'Create user' }).first().click()
    const drawer = page.getByRole('dialog', { name: 'Create user' })

    await drawer.getByRole('button', { name: 'Create' }).click()
    await expect(drawer.getByText('Enter the username')).toBeVisible()
    await expect(drawer.getByText('Enter the password')).toBeVisible()

    await drawer.getByRole('textbox', { name: 'Username' }).fill('a.miller')
    await drawer.getByRole('textbox', { name: 'Name', exact: true }).fill('Emma')
    await drawer.getByRole('textbox', { name: 'Surname' }).fill('Johnson')
    await drawer.getByLabel('Password', { exact: true }).fill('Secret,123')
    await drawer.getByLabel('Confirm password').fill('Secret,124')
    await drawer.getByRole('textbox', { name: 'Extension' }).fill('300')
    await drawer.getByRole('button', { name: 'Create' }).click()
    await expect(drawer.getByText('This username already exists')).toBeVisible()
    await expect(drawer.getByText('The passwords do not match')).toBeVisible()
    await expect(
      drawer.getByText('This extension is already assigned to another user'),
    ).toBeVisible()

    await drawer.getByRole('textbox', { name: 'Username' }).fill('e.johnson')
    await drawer.getByLabel('Confirm password').fill('Secret,123')
    await drawer.getByRole('textbox', { name: 'Extension' }).fill('305')
    await drawer.getByRole('button', { name: 'Create' }).click()

    await expect(page.getByText('User created')).toBeVisible(IMPORT_TIMEOUT)
    const file = mockApi.callsTo('POST', `${REST}/csv/csvimport`)[0].body as { file: string }
    expect(Buffer.from(file.file, 'base64').toString()).toBe(
      '"e.johnson","Emma Johnson","305","Secret,123"\r\n',
    )
    expect(mockApi.callsTo('POST', `${REST}/cti/profiles/users/14`)[0].body).toEqual({
      profile_id: 1,
    })
    expect(mockApi.callsTo('POST', `${REST}/webrtc`)[0].body).toEqual({ extension: '305' })
  })

  test('reports a failed creation inside the drawer', async ({ page, mockApi }) => {
    csvImportMock(mockApi, {
      status: 500,
      json: { status: 'Error creating user e.johnson: users-admin is unavailable\n' },
    })
    await page.goto('./users/users')
    await page.getByRole('button', { name: 'Create user' }).first().click()
    const drawer = page.getByRole('dialog', { name: 'Create user' })
    await drawer.getByRole('textbox', { name: 'Username' }).fill('e.johnson')
    await drawer.getByRole('textbox', { name: 'Name', exact: true }).fill('Emma')
    await drawer.getByRole('textbox', { name: 'Surname' }).fill('Johnson')
    await drawer.getByLabel('Password', { exact: true }).fill('Secret,123')
    await drawer.getByLabel('Confirm password').fill('Secret,123')
    await drawer.getByRole('button', { name: 'Create' }).click()

    await expect(drawer.getByText('users-admin is unavailable')).toBeVisible(IMPORT_TIMEOUT)
    await expect(drawer.getByText('Cannot create the user')).toBeVisible()
  })

  test('removes the extension of a user', async ({ page, mockApi }) => {
    mockWrites(mockApi)
    await page.goto('./users/users')
    await page.getByRole('button', { name: 'Actions for c.davis' }).click()
    await page.getByRole('menuitem', { name: 'Remove extension' }).click()

    const modal = page.getByRole('dialog', { name: 'Remove extension' })
    await expect(modal).toContainText('The extension 301 of Christopher Davis will be removed')
    await modal.getByRole('button', { name: 'Remove extension' }).click()

    await expect(page.getByText('Extension removed')).toBeVisible()
    expect(mockApi.callsTo('POST', `${REST}/mainextensions`)[0].body).toEqual({
      username: 'c.davis',
      extension: '',
    })
  })

  test('assigns a profile to several users', async ({ page, mockApi }) => {
    mockWrites(mockApi)
    await page.goto('./users/users')
    await page.getByRole('button', { name: 'Actions', exact: true }).click()
    await page.getByRole('menuitem', { name: 'Assign profile' }).click()
    const drawer = page.getByRole('dialog', { name: 'Assign profile' })

    await drawer.getByRole('button', { name: 'Assign' }).click()
    await expect(drawer.getByText('Choose at least one user')).toBeVisible()

    await drawer.getByRole('combobox', { name: 'Users' }).click()
    await drawer.getByRole('option', { name: /a\.miller/ }).click()
    await drawer.getByRole('option', { name: /d\.jones/ }).click()
    await page.keyboard.press('Escape')
    await drawer.getByRole('combobox', { name: 'Profile' }).click()
    await drawer.getByRole('option', { name: 'Advanced' }).click()
    await drawer.getByRole('button', { name: 'Assign' }).click()

    await expect(page.getByText('Profile assigned')).toBeVisible()
    expect(mockApi.callsTo('POST', `${REST}/bulk/300`)[0].body).toEqual({ profile: 3 })
    expect(mockApi.callsTo('POST', `${REST}/cti/profiles/users/13`)[0].body).toEqual({
      profile_id: 3,
    })
  })

  test('sets the voicemail of several users', async ({ page, mockApi }) => {
    mockWrites(mockApi)
    await page.goto('./users/users')
    await page.getByRole('button', { name: 'Actions', exact: true }).click()
    await page.getByRole('menuitem', { name: 'Set voicemail' }).click()
    const drawer = page.getByRole('dialog', { name: 'Set voicemail' })

    await drawer.getByRole('combobox', { name: 'Users' }).click()
    await expect(drawer.getByRole('option', { name: /d\.jones/ })).toHaveCount(0)
    await drawer.getByRole('option', { name: /c\.davis/ }).click()
    await page.keyboard.press('Escape')
    await drawer.getByRole('button', { name: 'Save' }).click()

    await expect(page.getByText('Voicemail updated')).toBeVisible()
    expect(mockApi.callsTo('POST', `${REST}/voicemails`)[0].body).toEqual({
      extension: '301',
      state: 'yes',
    })
  })

  test('groups the bulk actions with separators', async ({ page }) => {
    await page.goto('./users/users')
    await page.getByRole('button', { name: 'Actions', exact: true }).click()

    await expect(page.getByRole('menuitem')).toHaveText([
      'Import users from CSV',
      'Export users to CSV',
      'Set voicemail',
      'Assign profile',
      'Set devices',
      'Advanced bulk actions',
    ])
    await expect(page.getByRole('menu').locator('hr')).toHaveCount(2)
  })

  test('sets the devices of several users', async ({ page, mockApi }) => {
    mockWrites(mockApi)
    await page.goto('./users/users')
    await page.getByRole('button', { name: 'Actions', exact: true }).click()
    await page.getByRole('menuitem', { name: 'Set devices' }).click()
    const drawer = page.getByRole('dialog', { name: 'Set devices' })

    await drawer.getByRole('combobox', { name: 'Users' }).click()
    await expect(drawer.getByRole('option', { name: /d\.jones/ })).toHaveCount(0)
    await drawer.getByRole('option', { name: /a\.miller/ }).click()
    await drawer.getByRole('option', { name: /c\.davis/ }).click()
    await page.keyboard.press('Escape')
    await drawer.getByRole('combobox', { name: 'Devices' }).click()
    await drawer.getByRole('option', { name: 'Web phone' }).click()
    await drawer.getByRole('option', { name: 'Mobile app' }).click()
    await page.keyboard.press('Escape')
    await drawer.getByRole('button', { name: 'Save' }).click()

    const modal = page.getByRole('dialog', { name: 'Disable devices' })
    await expect(modal.getByTestId('disabling-devices')).toHaveText(
      'Christopher Davis (c.davis): Desktop app',
    )
    await modal.getByRole('button', { name: 'Disable devices' }).click()

    await expect(page.getByText('Devices updated')).toBeVisible()
    expect(mockApi.callsTo('POST', `${REST}/mobileapp`).map((call) => call.body)).toEqual([
      { mainextension: '300' },
      { mainextension: '301' },
    ])
    expect(mockApi.callsTo('DELETE', `${REST}/nethlink/301`)).toHaveLength(1)
    expect(mockApi.callsTo('POST', `${REST}/webrtc`)).toHaveLength(0)
  })

  test('confirms before disabling all the devices of the chosen users', async ({
    page,
    mockApi,
  }) => {
    mockWrites(mockApi).on('DELETE', `${REST}/webrtc/:ext`, (request) =>
      request.path.endsWith('/301') ? { status: 500, json: { error: 'boom' } } : { status: 200 },
    )
    await page.goto('./users/users')
    await page.getByRole('button', { name: 'Actions', exact: true }).click()
    await page.getByRole('menuitem', { name: 'Set devices' }).click()
    const drawer = page.getByRole('dialog', { name: 'Set devices' })

    await drawer.getByRole('combobox', { name: 'Users' }).click()
    await drawer.getByRole('option', { name: /a\.miller/ }).click()
    await drawer.getByRole('option', { name: /c\.davis/ }).click()
    await page.keyboard.press('Escape')
    await drawer.getByRole('button', { name: 'Save' }).click()

    const modal = page.getByRole('dialog', { name: 'Disable devices' })
    await expect(modal).toContainText('The devices of 2 users will be disabled')
    await expect(modal.getByTestId('disabling-devices').getByRole('listitem')).toHaveText([
      'Anna Miller (a.miller): Web phone',
      'Christopher Davis (c.davis): Web phone, Desktop app',
    ])
    await modal.getByRole('button', { name: 'Cancel' }).click()
    await expect(modal).toHaveCount(0)
    expect(mockApi.calls.filter((call) => call.method === 'DELETE')).toHaveLength(0)

    await drawer.getByRole('button', { name: 'Save' }).click()
    await modal.getByRole('button', { name: 'Disable devices' }).click()

    await expect(drawer.getByText('Cannot set the devices')).toBeVisible()
    await expect(drawer).toContainText('1 user was updated before the error: a.miller.')
    await expect(drawer).not.toContainText('DELETE /')
    expect(mockApi.callsTo('DELETE', `${REST}/webrtc/300`)).toHaveLength(1)
  })

  test('applies the advanced settings to several users', async ({ page, mockApi }) => {
    mockWrites(mockApi)
      .on('GET', `${REST}/bulk/:exts`, {
        json: {
          displayname: null,
          profile: 2,
          callwaiting: false,
          ringtime: '0',
          callgroup: '1',
          pickupgroup: '1',
          noanswerdest: '',
          busydest: '',
          notreachabledest: '',
          outboundcid: '',
        },
      })
      .on('GET', `${REST}/destinations`, {
        json: {
          Queues: {
            0: { destination: 'ext-queues,401,1', description: '401 Support' },
            99999: { destination: 'popover', description: 'Add new Queues &#133' },
          },
        },
      })
    await page.goto('./users/users')
    await page.getByRole('button', { name: 'Actions', exact: true }).click()
    await page.getByRole('menuitem', { name: 'Advanced bulk actions' }).click()
    const drawer = page.getByRole('dialog', { name: 'Advanced bulk actions' })

    await drawer.getByRole('button', { name: 'Save' }).click()
    await expect(drawer.getByText('Choose at least one user')).toBeVisible()

    await drawer.getByRole('combobox', { name: 'Users' }).click()
    await expect(drawer.getByRole('option', { name: /d\.jones/ })).toHaveCount(0)
    await drawer.getByRole('option', { name: /a\.miller/ }).click()
    await drawer.getByRole('option', { name: /c\.davis/ }).click()
    await page.keyboard.press('Escape')

    await expect(drawer.getByLabel('Ring time (seconds)')).toHaveValue('0')
    await expect(drawer.getByLabel('Display name')).toHaveValue('')
    await drawer.getByRole('button', { name: 'Save' }).click()
    await expect(drawer.getByText('Change at least one setting')).toBeVisible()

    await drawer.getByLabel('Ring time (seconds)').fill('200')
    await drawer.getByRole('combobox', { name: 'Call waiting' }).click()
    await drawer.getByRole('option', { name: 'Enabled' }).click()
    await drawer.getByRole('combobox', { name: 'Busy' }).click()
    await drawer.getByRole('option', { name: /401 Support/ }).click()
    await drawer.getByRole('button', { name: 'Save' }).click()
    await expect(drawer.getByText('Enter a number from 0 to 120')).toBeVisible()

    await drawer.getByLabel('Ring time (seconds)').fill('30')
    await drawer.getByRole('button', { name: 'Save' }).click()

    await expect(page.getByText('Settings updated')).toBeVisible()
    expect(mockApi.callsTo('GET', `${REST}/bulk/300%2C301`).length).toBeGreaterThan(0)
    expect(mockApi.callsTo('POST', `${REST}/bulk/300%2C301`)[0].body).toEqual({
      callwaiting: true,
      ringtime: '30',
      busydest: 'ext-queues,401,1',
    })
  })

  test('imports users from a CSV with a preview of the errors', async ({ page, mockApi }) => {
    csvImportMock(mockApi, { status: 200, json: { result: 100 } })
    await page.goto('./users/users')
    await page.getByRole('button', { name: 'Actions', exact: true }).click()
    await page.getByRole('menuitem', { name: 'Import users from CSV' }).click()

    const drawer = page.getByRole('dialog', { name: 'Import users' })
    await drawer.getByRole('button', { name: 'Import' }).click()
    await expect(drawer.getByText('Choose a CSV file')).toBeVisible()

    await drawer.locator('input[type=file]').setInputFiles({
      name: 'users.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(
        [
          'username,name,surname,extension,group,profile',
          'a.miller,Anna,Miller,300,Sales,Standard',
          'k.lee,Kevin,Lee,310,Sales|Marketing,Base',
          'b.boone,Bob,Boone,xxx,,',
        ].join('\n'),
      ),
    })
    await drawer.getByRole('button', { name: 'Import' }).click()

    const modal = page
      .getByRole('dialog', { name: 'Import users' })
      .filter({ hasText: 'File preview' })
    await expect(modal.getByTestId('import-summary')).toContainText(
      '3 users detected in the selected file:',
    )
    await expect(modal).toContainText('Row 4 (b.boone): invalid extension')
    await expect(modal.getByRole('radio', { name: 'Overwrite existing users' })).toBeChecked()
    await expect(modal.getByRole('button', { name: 'Import 2 users' })).toBeVisible()
    const summaryBox = await modal.getByTestId('import-summary').boundingBox()
    const previewBox = await modal.getByRole('grid', { name: 'File preview' }).boundingBox()
    expect(summaryBox?.y ?? 0).toBeLessThan(previewBox?.y ?? 0)

    await modal.getByRole('radio', { name: 'Skip existing users' }).check()
    await expect(modal).toContainText('Row 2 (a.miller)')
    await modal.getByRole('button', { name: 'Import 1 user' }).click()

    await expect(page.getByText('Users imported')).toBeVisible(IMPORT_TIMEOUT)
    const file = mockApi.callsTo('POST', `${REST}/csv/csvimport`)[0].body as { file: string }
    expect(Buffer.from(file.file, 'base64').toString()).toBe(
      '"k.lee","Kevin Lee","310","","","","","Sales|Marketing","Base"\r\n',
    )
  })

  test('imports the Italian header and applies voicemail and devices to existing users', async ({
    page,
    mockApi,
  }) => {
    const warnings: string[] = []
    page.on('console', (message) => {
      if (['warning', 'error'].includes(message.type())) {
        warnings.push(message.text())
      }
    })
    mockWrites(mockApi)
    csvImportMock(mockApi, { status: 200, json: { result: 100 } })
    await page.goto('./users/users')
    await page.getByRole('button', { name: 'Actions', exact: true }).click()
    await page.getByRole('menuitem', { name: 'Import users from CSV' }).click()

    const drawer = page.getByRole('dialog', { name: 'Import users' })
    await drawer.locator('input[type=file]').setInputFiles({
      name: 'utenti.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(
        [
          'Nome utente;Nome;Cognome;Interno;Gruppo;Casella vocale;Telefono web;App desktop',
          'a.miller;Anna;Miller;300;Sales|Marketing;no;no;sì',
        ].join('\n'),
      ),
    })
    await drawer.getByRole('button', { name: 'Import' }).click()

    const modal = page
      .getByRole('dialog', { name: 'Import users' })
      .filter({ hasText: 'File preview' })
    await expect(modal.getByTestId('import-summary')).toContainText('1 user and 2 groups detected')
    await expect(modal.getByTestId('import-new-groups')).toHaveText(
      '1 new group will be created: Marketing',
    )
    await expect(modal).not.toContainText('Only the first')
    await expect(modal.getByRole('grid', { name: 'File preview' })).toContainText('Desktop app')
    await modal.getByRole('button', { name: 'Import 1 user' }).click()

    await expect(page.getByText('Users imported')).toBeVisible(IMPORT_TIMEOUT)
    const file = mockApi.callsTo('POST', `${REST}/csv/csvimport`)[0].body as { file: string }
    expect(Buffer.from(file.file, 'base64').toString()).toBe(
      '"a.miller","Anna Miller","","","3331234567","","","Sales|Marketing","Standard",""\r\n',
    )
    expect(mockApi.callsTo('POST', `${REST}/voicemails`)[0].body).toEqual({
      extension: '300',
      state: 'no',
    })
    expect(mockApi.callsTo('DELETE', `${REST}/webrtc/300`)).toHaveLength(1)
    expect(mockApi.callsTo('POST', `${REST}/nethlink`)[0].body).toEqual({ extension: '300' })
    expect(warnings.filter((text) => /FocusTrap|intlify/.test(text))).toEqual([])
  })

  test('rejects a header without usernames and a file too large', async ({ page }) => {
    await page.goto('./users/users')
    await page.getByRole('button', { name: 'Actions', exact: true }).click()
    await page.getByRole('menuitem', { name: 'Import users from CSV' }).click()

    const drawer = page.getByRole('dialog', { name: 'Import users' })
    await drawer.locator('input[type=file]').setInputFiles({
      name: 'utenti.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('Nome;Cognome;Interno\nMario;Rossi;201'),
    })
    await drawer.getByRole('button', { name: 'Import' }).click()
    await expect(drawer.getByText('no username column')).toBeVisible()

    const rows = Array.from(
      { length: 5000 },
      (_, index) => `u${index},Name ${index},${1000 + index}`,
    )
    await drawer.locator('input[type=file]').setInputFiles({
      name: 'users.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(['username,fullname,extension', ...rows].join('\n')),
    })
    await drawer.getByRole('button', { name: 'Import' }).click()

    const modal = page
      .getByRole('dialog', { name: 'Import users' })
      .filter({ hasText: 'File preview' })
    await expect(modal.getByText('File too large')).toBeVisible()
    await expect(modal.getByRole('button', { name: 'Import 5000 users' })).toBeDisabled()
  })

  test('exports the users without passwords', async ({ page, mockApi }) => {
    mockApi.on('GET', `${REST}/csv/csvexport`, {
      json: Buffer.from(
        '"a.miller","Anna Miller","300","secret","","TRUE","TRUE","Sales","Standard"\r\n',
      ).toString('base64'),
    })
    await page.goto('./users/users')
    await page.getByRole('button', { name: 'Actions', exact: true }).click()
    const download = page.waitForEvent('download')
    await page.getByRole('menuitem', { name: 'Export users to CSV' }).click()

    const file = await download
    expect(file.suggestedFilename()).toMatch(/^users-\d{4}-\d{2}-\d{2}\.csv$/)
    const content = await (await file.createReadStream()).toArray()
    const text = Buffer.concat(content).toString()
    expect(text.startsWith('\ufeff')).toBe(true)
    expect(text).toContain('"username","fullname","extension"')
    expect(text).toContain('"desktop_app","mobile_app"')
    expect(text).not.toContain('secret')
  })
})
