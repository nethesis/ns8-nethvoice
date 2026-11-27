//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { expect, mockPermissions, test, type MockApi } from '../fixtures/mockApi'
import {
  ACCOUNTS,
  CSV_IMPORT_ID,
  csvImportMock,
  GROUP_MEMBERS,
  GROUPS,
  FREE_PHONE_MAC,
  mockUserPhonesApi,
  mockUsersApi,
  mockWrites,
  RAW_USERS,
  REST,
  TANCREDI,
  TANCREDI_PHONES,
} from './users-data'

const ORPHANS = [
  {
    username: 'e.brown',
    displayname: 'Emma Brown',
    extension: '310',
    devices: [
      { extension: '92310', type: 'webrtc', mac: null },
      { extension: '91310', type: 'physical', mac: '00:15:65:AB:CD:09' },
      { extension: '93310', type: 'mobile', mac: null },
    ],
    removed_at: '2026-11-12T08:30:00Z',
  },
  { username: 'f.green', displayname: '', extension: '305', devices: [], removed_at: null },
]

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
    await expect(anna.getByRole('button', { name: 'Physical phones of a.miller: 1' })).toHaveText(
      '1',
    )
    await anna.getByTestId('phones-count-a.miller').hover()
    const phonesTooltip = page.getByTestId('phones-tooltip-a.miller')
    await expect(phonesTooltip).toContainText('Yealink T46 (00:15:65:AB:CD:01)')
    await expect(
      phonesTooltip.getByRole('link', { name: 'Go to Physical phones' }),
    ).toHaveAttribute('href', /\/phones$/)

    const christopher = page.getByTestId('user-c.davis')
    await expect(christopher).toContainText('Backoffice, Sales')
    await expect(christopher).toContainText('+ 1 more')
    await expect(christopher.getByTestId('device-nethlink')).toBeVisible()

    const daniel = page.getByTestId('user-d.jones')
    await expect(daniel.locator('td').nth(1)).toHaveText(/-$/)
  })

  test('shows a focus ring on the voicemail icon and on the other groups', async ({ page }) => {
    await page.goto('./users/users')
    const ring = (element: Element) => getComputedStyle(element).boxShadow

    const voicemail = page
      .getByTestId('user-a.miller')
      .getByText('Voicemail enabled')
      .locator('xpath=..')
    await voicemail.focus()
    await expect(voicemail).toBeFocused()
    await expect.poll(() => voicemail.evaluate(ring)).not.toBe('none')

    const more = page.getByTestId('user-c.davis').getByRole('button', { name: '+ 1 more' })
    await more.focus()
    await expect(more).toBeFocused()
    await expect.poll(() => more.evaluate(ring)).not.toBe('none')
  })

  test('filters by text, voicemail, groups and devices', async ({ page }) => {
    await page.goto('./users/users')
    const rows = page.locator('[data-testid^="user-"]')
    await expect(rows).toHaveCount(3)

    await expect(page.getByTestId('users-filtered-counter')).toHaveCount(0)
    await page.getByPlaceholder('Filter users').fill('davis')
    await expect(rows).toHaveCount(1)
    await expect(page.getByTestId('users-filtered-counter')).toHaveText('Showing 1 of 3 users')
    await expect(page.getByTestId('users-counter')).toContainText(
      '2 out of 3 users configured with an extension',
    )
    await page.getByPlaceholder('Filter users').fill('')
    await expect(page.getByTestId('users-filtered-counter')).toHaveCount(0)

    await page.getByRole('button', { name: 'Voicemail', exact: true }).click()
    await page.getByRole('radio', { name: 'Voicemail enabled' }).click()
    await expect(rows).toHaveCount(1)
    await expect(rows.first()).toContainText('a.miller')

    await page.getByRole('button', { name: 'Reset filters' }).click()
    await expect(rows).toHaveCount(3)

    await page.getByRole('button', { name: 'Physical phones', exact: true }).click()
    await page.getByRole('radio', { name: 'Has physical phone' }).click()
    await expect(rows).toHaveCount(1)
    await expect(rows.first()).toContainText('a.miller')
    await page.keyboard.press('Escape')
    await page.mouse.move(0, 0)
    await page.getByRole('button', { name: 'Physical phones', exact: true }).click()
    await page.getByRole('radio', { name: 'No physical phone' }).click()
    await expect(rows).toHaveCount(2)
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Reset filters' }).click()

    await page.getByRole('button', { name: 'Devices', exact: true }).click()
    await expect(page.getByPlaceholder('Filter options')).toBeVisible()
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

    await expect(page.getByText('No users configured', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Create user' })).toHaveCount(1)
    await expect(page.getByRole('button', { name: 'Import users from CSV' })).toBeVisible()
    await expect(page.getByTestId('users-counter')).toHaveCount(0)
    await expect(page.getByPlaceholder('Filter users')).toHaveCount(0)
  })

  test('shows the users when only some details cannot be loaded', async ({ page, mockApi }) => {
    mockApi.on('GET', `${REST}/cti/profiles`, { status: 500, json: { error: 'boom' } })
    await page.goto('./users/users')

    await expect(page.getByTestId('user-a.miller')).toBeVisible()
    await expect(page.getByTestId('users-directory-warning')).toContainText(
      'Cannot retrieve: Profiles',
    )
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

    await expect(page.getByText('Cannot retrieve users')).toBeVisible()
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
    await drawer.getByText('Enabled', { exact: true }).last().click()
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
    expect(mockApi.callsTo('PATCH', `${REST}/users/:username/account`)).toHaveLength(0)
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

  test('warns that a new extension recreates the devices and keeps the groups', async ({
    page,
  }) => {
    await page.goto('./users/users')
    await page.getByRole('button', { name: 'Edit c.davis' }).click()
    const drawer = page.getByRole('dialog', { name: 'Edit user c.davis' })

    await drawer.getByRole('textbox', { name: 'Extension' }).fill('309')

    await expect(drawer.getByText('The devices will be recreated')).toBeVisible()
    await expect(drawer).toContainText('apps and physical phones get new credentials')
    await expect(drawer).toContainText(
      'Group memberships and the other settings of the user are kept',
    )
    await expect(drawer).not.toContainText('loses the group memberships')
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
    const warnings: string[] = []
    page.on('console', (message) => {
      if (message.type() === 'warning') {
        warnings.push(message.text())
      }
    })
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
    expect(warnings.filter((text) => text.includes('FocusTrap'))).toEqual([])
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

  test('tells the users limit of the Community version from the server', async ({
    page,
    mockApi,
  }) => {
    mockWrites(mockApi)
      .on('POST', `${REST}/mainextensions`, {
        status: 403,
        json: { status: 'ERROR: community version is limited to 8 users' },
      })
      .on('GET', `${REST}/mainextensions/userlimits`, {
        json: { configured: 5, limit: 5, configurable: 0 },
      })
    await page.goto('./users/users')
    await page.getByRole('button', { name: 'Edit d.jones' }).click()
    const drawer = page.getByRole('dialog', { name: 'Edit user d.jones' })

    await drawer.getByRole('textbox', { name: 'Extension' }).fill('302')
    await drawer.getByRole('combobox', { name: 'Profile' }).click()
    await drawer.getByRole('option', { name: 'Base' }).click()
    await drawer.getByRole('button', { name: 'Save' }).click()

    await expect(
      drawer.getByText('The Community version allows up to 5 users with an extension.'),
    ).toBeVisible()
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
    await drawer.getByRole('textbox', { name: 'First name', exact: true }).fill('Emma')
    await drawer.getByRole('textbox', { name: 'Last name' }).fill('Johnson')
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
    const file = mockApi.callsTo('POST', `${REST}/csv/csvimport`)[0].body as {
      file: string
      rfc4180: boolean
    }
    expect(Buffer.from(file.file, 'base64').toString()).toBe(
      '"e.johnson","Emma Johnson","305","Secret,123"\r\n',
    )
    expect(file.rfc4180).toBe(true)
    expect(mockApi.callsTo('POST', `${REST}/cti/profiles/users/14`)[0].body).toEqual({
      profile_id: 1,
    })
    expect(mockApi.callsTo('POST', `${REST}/webrtc`)[0].body).toEqual({ extension: '305' })
  })

  test('returns the focus to Create user after discarding the changes', async ({ page }) => {
    await page.goto('./users/users')
    const create = page.getByRole('button', { name: 'Create user' }).first()
    await create.click()
    const drawer = page.getByRole('dialog', { name: 'Create user' })
    await expect(drawer.getByRole('textbox', { name: 'Username' })).toBeFocused()
    await drawer.getByRole('textbox', { name: 'Username' }).fill('e.johnson')
    await drawer.getByRole('button', { name: 'Cancel' }).click()
    await page
      .getByRole('dialog', { name: 'Unsaved changes' })
      .getByRole('button', { name: 'Discard changes' })
      .click()

    await expect(drawer.getByRole('textbox', { name: 'Username' })).toBeHidden()
    await expect(create).toBeFocused()
  })

  test('refuses control characters in the name of a new user', async ({ page, mockApi }) => {
    csvImportMock(mockApi, { status: 200, json: { result: 100 } })
    await page.goto('./users/users')
    await page.getByRole('button', { name: 'Create user' }).first().click()
    const drawer = page.getByRole('dialog', { name: 'Create user' })
    const name = drawer.getByRole('textbox', { name: 'First name', exact: true })
    await drawer.getByRole('textbox', { name: 'Username' }).fill('e.johnson')
    await name.fill('Emma\tJane')
    await drawer.getByRole('textbox', { name: 'Last name' }).fill('Johnson')
    await drawer.getByLabel('Password', { exact: true }).fill('Secret,123')
    await drawer.getByLabel('Confirm password').fill('Secret,123')
    await drawer.getByRole('button', { name: 'Create' }).click()

    await expect(
      drawer.getByText('Remove tabs, line breaks and other invisible characters'),
    ).toBeVisible()
    await expect(name).toBeFocused()
    expect(mockApi.callsTo('POST', `${REST}/csv/csvimport`)).toHaveLength(0)
  })

  test('refuses a password with spaces at the start or the end', async ({ page, mockApi }) => {
    csvImportMock(mockApi, { status: 200, json: { result: 100 } })
    await page.goto('./users/users')
    await page.getByRole('button', { name: 'Create user' }).first().click()
    const drawer = page.getByRole('dialog', { name: 'Create user' })
    await drawer.getByRole('textbox', { name: 'Username' }).fill('e.johnson')
    await drawer.getByRole('textbox', { name: 'First name', exact: true }).fill('Emma')
    await drawer.getByRole('textbox', { name: 'Last name' }).fill('Johnson')
    await drawer.getByLabel('Password', { exact: true }).fill('Secret,123 ')
    await drawer.getByLabel('Confirm password').fill('Secret,123 ')
    await drawer.getByRole('button', { name: 'Create' }).click()

    await expect(
      drawer.getByText('Remove the spaces at the start and end of the password'),
    ).toBeVisible()
    expect(mockApi.callsTo('POST', `${REST}/csv/csvimport`)).toHaveLength(0)
  })

  test('reports a failed creation inside the drawer', async ({ page, mockApi }) => {
    const polledIds: (string | null)[] = []
    csvImportMock(mockApi, { status: 200, json: { result: 0 } }).on(
      'GET',
      `${REST}/csv/csvimport`,
      (request) => {
        polledIds.push(request.query.get('id'))
        return polledIds.length === 1
          ? { json: { result: 50 } }
          : {
              status: 500,
              json: {
                status: 'Error creating user e.johnson: users-admin is unavailable\n',
                problems: [{ code: 'provider_unavailable', line: 1, username: 'e.johnson' }],
              },
            }
      },
    )
    await page.goto('./users/users')
    await page.getByRole('button', { name: 'Create user' }).first().click()
    const drawer = page.getByRole('dialog', { name: 'Create user' })
    await expect(drawer.getByRole('textbox', { name: 'Username' })).toBeFocused()
    await drawer.getByRole('textbox', { name: 'Username' }).fill('e.johnson')
    await drawer.getByRole('textbox', { name: 'First name', exact: true }).fill('Emma')
    await drawer.getByRole('textbox', { name: 'Last name' }).fill('Johnson')
    await drawer.getByLabel('Password', { exact: true }).fill('Secret,123')
    await drawer.getByLabel('Confirm password').fill('Secret,123')
    await drawer.getByRole('button', { name: 'Create' }).click()

    await expect(drawer.getByText("e.johnson: the account provider can't be reached.")).toBeVisible(
      IMPORT_TIMEOUT,
    )
    await expect(drawer.getByText('Cannot create the user')).toBeVisible()
    await expect(drawer.getByText('users-admin is unavailable')).toHaveCount(0)
    expect(polledIds.length).toBeGreaterThan(1)
    expect(polledIds.every((id) => id === CSV_IMPORT_ID)).toBe(true)
  })

  test('tells that another import is running when a user is created', async ({ page, mockApi }) => {
    mockWrites(mockApi)
    mockApi.on('POST', `${REST}/csv/csvimport`, {
      status: 409,
      json: { code: 'import_running', message: 'Another CSV import is running' },
    })
    await page.goto('./users/users')
    await page.getByRole('button', { name: 'Create user' }).first().click()
    const drawer = page.getByRole('dialog', { name: 'Create user' })
    await drawer.getByRole('textbox', { name: 'Username' }).fill('e.johnson')
    await drawer.getByRole('textbox', { name: 'First name', exact: true }).fill('Emma')
    await drawer.getByRole('textbox', { name: 'Last name' }).fill('Johnson')
    await drawer.getByLabel('Password', { exact: true }).fill('Secret,123')
    await drawer.getByLabel('Confirm password').fill('Secret,123')
    await drawer.getByRole('button', { name: 'Create' }).click()

    await expect(
      drawer.getByText(
        'Another import or user creation is running. Wait for it to end, then try again.',
      ),
    ).toBeVisible()
    await expect(drawer.getByText('Another CSV import is running')).toHaveCount(0)
    expect(mockApi.callsTo('GET', `${REST}/csv/csvimport`)).toHaveLength(0)
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

  test('reassigns the extension of a user to a user without extension', async ({
    page,
    mockApi,
  }) => {
    mockApi.on('POST', `${REST}/mainextensions/:ext/reassign`, {
      json: { key_labels_updated: 0, key_labels_incomplete: false },
    })
    await page.goto('./users/users')
    await page.getByRole('button', { name: 'Actions for c.davis' }).click()
    await page.getByRole('menuitem', { name: 'Reassign extension' }).click()

    const modal = page.getByRole('dialog', { name: 'Reassign extension' })
    await expect(modal).toContainText('The extension 301 of Christopher Davis moves')
    await modal.getByRole('button', { name: 'Reassign' }).click()
    await expect(modal.getByText('Choose the user')).toBeVisible()

    await modal.getByRole('combobox', { name: 'Assign to' }).click()
    await expect(modal.getByRole('option')).toHaveText([/Daniel Jones \(d\.jones\)/])
    await modal.getByRole('option', { name: /d\.jones/ }).click()
    await modal.getByRole('button', { name: 'Reassign' }).click()

    await expect(page.getByText('Extension reassigned')).toBeVisible()
    expect(mockApi.callsTo('POST', `${REST}/mainextensions/301/reassign`)[0].body).toEqual({
      username: 'd.jones',
    })
  })

  test('tells how many phone key labels the reassignment updated', async ({ page, mockApi }) => {
    mockApi.on('POST', `${REST}/mainextensions/:ext/reassign`, {
      json: { key_labels_updated: 3, key_labels_incomplete: false },
    })
    await page.goto('./users/users')
    await page.getByRole('button', { name: 'Actions for c.davis' }).click()
    await page.getByRole('menuitem', { name: 'Reassign extension' }).click()

    const modal = page.getByRole('dialog', { name: 'Reassign extension' })
    await modal.getByRole('combobox', { name: 'Assign to' }).click()
    await modal.getByRole('option', { name: /d\.jones/ }).click()
    await modal.getByRole('button', { name: 'Reassign' }).click()

    await expect(page.getByText('Extension reassigned')).toBeVisible()
    await expect(
      page.getByText(
        'The extension 301 has been assigned to Daniel Jones and 3 phone key labels now show the new name',
      ),
    ).toBeVisible()
    await expect(page.getByText('Cannot update the phone key labels')).toHaveCount(0)
  })

  test('warns when the phone key labels could not be updated', async ({ page, mockApi }) => {
    mockApi.on('POST', `${REST}/mainextensions/:ext/reassign`, {
      json: { key_labels_updated: 0, key_labels_incomplete: true },
    })
    await page.goto('./users/users')
    await page.getByRole('button', { name: 'Actions for c.davis' }).click()
    await page.getByRole('menuitem', { name: 'Reassign extension' }).click()

    const modal = page.getByRole('dialog', { name: 'Reassign extension' })
    await modal.getByRole('combobox', { name: 'Assign to' }).click()
    await modal.getByRole('option', { name: /d\.jones/ }).click()
    await modal.getByRole('button', { name: 'Reassign' }).click()

    await expect(page.getByText('Extension reassigned')).toBeVisible()
    await expect(
      page.getByText('The extension 301 has been assigned to Daniel Jones'),
    ).toBeVisible()
    await expect(page.getByText('Cannot update the phone key labels')).toBeVisible()
    await expect(
      page.getByText(
        'Some phone keys of the extension 301 may still show Christopher Davis. Change their labels in the phone settings.',
      ),
    ).toBeVisible()
  })

  test('shows the error of a failed reassignment in the modal', async ({ page, mockApi }) => {
    mockApi.on('POST', `${REST}/mainextensions/:ext/reassign`, {
      status: 422,
      json: { message: 'The user already has a main extension' },
    })
    await page.goto('./users/users')
    await page.getByRole('button', { name: 'Actions for a.miller' }).click()
    await page.getByRole('menuitem', { name: 'Reassign extension' }).click()

    const modal = page.getByRole('dialog', { name: 'Reassign extension' })
    await modal.getByRole('combobox', { name: 'Assign to' }).click()
    await modal.getByRole('option', { name: /d\.jones/ }).click()
    await modal.getByRole('button', { name: 'Reassign' }).click()

    await expect(modal.getByText('Cannot reassign the extension')).toBeVisible()
    await expect(page.getByText('Extension reassigned')).toHaveCount(0)
  })

  test('synchronizes the users with the account provider', async ({ page, mockApi }) => {
    await page.goto('./users/users')
    await page.getByRole('button', { name: 'Actions', exact: true }).click()
    await page.getByRole('menuitem', { name: 'Synchronize users' }).click()

    await expect(page.getByText('Users synchronized')).toBeVisible()
    expect(mockApi.callsTo('POST', `${REST}/users/sync`)).toHaveLength(1)
  })

  test('says when the synchronization has not ended in time', async ({ page, mockApi }) => {
    mockApi.on('GET', `${REST}/users/sync`, { json: true })
    await page.clock.install()
    await page.goto('./users/users')
    await expect(page.getByTestId('user-a.miller')).toBeVisible()
    await page.getByRole('button', { name: 'Actions', exact: true }).click()
    await page.getByRole('menuitem', { name: 'Synchronize users' }).click()

    for (let poll = 1; poll <= 60; poll += 1) {
      await expect.poll(() => mockApi.callsTo('GET', `${REST}/users/sync`).length).toBe(poll)
      await page.clock.runFor(2000)
    }

    await expect(page.getByText('Synchronization not completed')).toBeVisible()
    await expect(page.getByText('Users synchronized')).toHaveCount(0)
  })

  test('does not warn when no extension belongs to removed users', async ({ page }) => {
    await page.goto('./users/users')
    await expect(page.getByTestId('users-counter')).toBeVisible()
    await expect(page.getByTestId('orphan-extensions-warning')).toHaveCount(0)
  })

  test('deletes the chosen extensions of removed users', async ({ page, mockApi }) => {
    let orphans = ORPHANS
    mockApi
      .on('GET', `${REST}/mainextensions/orphans`, () => ({ json: orphans }))
      .on('POST', `${REST}/mainextensions/orphans/release`, (request) => {
        const { extensions } = request.body as { extensions: string[] }
        orphans = orphans.filter((orphan) => !extensions.includes(orphan.extension))
        return { status: 204 }
      })
    await page.goto('./users/users')

    const warning = page.getByTestId('orphan-extensions-warning')
    await expect(warning).toContainText('2 extensions belong to removed users')
    await warning.getByRole('button', { name: 'Show extensions' }).click()

    const drawer = page.getByRole('dialog', { name: 'Extensions of removed users' })
    await expect(drawer.getByTestId('orphan-310')).toContainText('Emma Brown (e.brown)')
    await expect(drawer.getByTestId('orphan-310')).toContainText(
      /Extension 310 · Web phone, Mobile app · 1 physical phone · Removed on .+/,
    )
    await expect(drawer.getByTestId('orphan-305')).toContainText('f.green')
    const deleteButton = drawer.getByRole('button', { name: 'Delete extensions' })
    await expect(deleteButton).toBeDisabled()

    await drawer.getByRole('checkbox', { name: 'Emma Brown (e.brown)' }).check()
    await deleteButton.click()
    const modal = page.getByRole('dialog', { name: 'Delete extensions' })
    await expect(modal).toContainText('Extension 310 will be permanently deleted')
    await expect(modal).toContainText('This cannot be undone.')
    await modal.getByRole('button', { name: 'Delete', exact: true }).click()

    await expect(page.getByText('Extensions deleted')).toBeVisible()
    expect(mockApi.callsTo('POST', `${REST}/mainextensions/orphans/release`)[0].body).toEqual({
      extensions: ['310'],
    })
    await expect(warning).toContainText('1 extension belongs to a removed user')
  })

  test('selects every extension of removed users at once', async ({ page, mockApi }) => {
    mockApi
      .on('GET', `${REST}/mainextensions/orphans`, { json: ORPHANS })
      .on('POST', `${REST}/mainextensions/orphans/release`, { status: 204 })
    await page.goto('./users/users')
    await page.getByRole('button', { name: 'Show extensions' }).click()

    const drawer = page.getByRole('dialog', { name: 'Extensions of removed users' })
    await drawer.getByRole('checkbox', { name: 'Select all' }).check()
    await drawer.getByRole('button', { name: 'Delete extensions' }).click()
    const modal = page.getByRole('dialog', { name: 'Delete extensions' })
    await expect(modal).toContainText('Extensions 305, 310 will be permanently deleted')
    await modal.getByRole('button', { name: 'Delete', exact: true }).click()

    await expect(page.getByText('Extensions deleted')).toBeVisible()
    expect(mockApi.callsTo('POST', `${REST}/mainextensions/orphans/release`)[0].body).toEqual({
      extensions: ['305', '310'],
    })
  })

  test('shows the error of a failed deletion of extensions', async ({ page, mockApi }) => {
    mockApi
      .on('GET', `${REST}/mainextensions/orphans`, { json: ORPHANS })
      .on('POST', `${REST}/mainextensions/orphans/release`, {
        status: 404,
        json: { message: 'Extension 305 does not belong to a removed user' },
      })
    await page.goto('./users/users')
    await page.getByRole('button', { name: 'Show extensions' }).click()

    const drawer = page.getByRole('dialog', { name: 'Extensions of removed users' })
    await drawer.getByRole('checkbox', { name: 'f.green' }).check()
    await drawer.getByRole('button', { name: 'Delete extensions' }).click()
    const modal = page.getByRole('dialog', { name: 'Delete extensions' })
    await modal.getByRole('button', { name: 'Delete', exact: true }).click()

    await expect(modal.getByText('Cannot delete the extensions')).toBeVisible()
    await expect(page.getByText('Extensions deleted')).toHaveCount(0)
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
      'Synchronize users',
      'Set voicemail',
      'Assign profile',
      'Set devices',
      'Advanced bulk actions',
    ])
    await expect(page.getByRole('menu').locator('hr')).toHaveCount(2)
    await expect(
      page.getByRole('menuitem', { name: 'Export users to CSV' }).locator('svg'),
    ).toHaveAttribute('data-icon', 'file-csv')
    await expect(
      page.getByRole('menuitem', { name: 'Synchronize users' }).locator('svg'),
    ).toHaveAttribute('data-icon', 'arrows-rotate')
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
    await expect(drawer.getByLabel('Display name')).toHaveCount(0)
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
    await drawer.getByRole('button', { name: 'Next' }).click()
    await expect(drawer.getByText('Choose a CSV file')).toBeVisible()

    await drawer.locator('input[type=file]').setInputFiles({
      name: 'users.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(
        [
          'username,name,surname,extension,group,profile,voicemail',
          'a.miller,Anna,Miller,300,Sales,Standard',
          'k.lee,Kevin,Lee,310,Sales|Marketing,Base',
          'b.boone,Bob,Boone,xxx,,',
          'c.wolf,Carl,Wolf,311,,,maybe',
        ].join('\n'),
      ),
    })
    await drawer.getByRole('button', { name: 'Next' }).click()

    const modal = page
      .getByRole('dialog', { name: 'Import users' })
      .filter({ hasText: 'File preview' })
    await expect(modal.getByTestId('import-summary')).toContainText(
      '4 users detected in the selected file:',
    )
    await expect(modal).toContainText('Row 4 (b.boone): invalid extension')
    await expect(modal).toContainText('Row 5 (c.wolf): unrecognized value "maybe" in Voicemail')
    await expect(modal.getByRole('radio', { name: 'Skip existing users' })).toBeChecked()
    await expect(
      modal.getByRole('group', { name: /^Existing users/ }).getByRole('radio'),
    ).toHaveCount(2)
    await expect(modal.getByTestId('import-summary')).toContainText(
      '1 existing user (will be skipped)',
    )
    await expect(modal.getByTestId('import-summary')).toContainText('1 valid')
    await expect(modal.getByTestId('import-summary')).toContainText(
      '2 with errors (will be skipped)',
    )
    await expect(modal).toContainText('This user already exists:')
    await expect(modal).not.toContainText('1 existing user will be skipped')
    await expect(modal).toContainText('Row 2 (a.miller)')
    await expect(modal.getByRole('button', { name: 'Import 1 user' })).toBeVisible()
    await expect(modal.getByTestId('import-summary')).toContainText('Import summary')
    const summaryBox = await modal.getByTestId('import-summary').boundingBox()
    const previewBox = await modal.getByRole('grid', { name: 'File preview' }).boundingBox()
    const radiosBox = await modal.getByRole('radio', { name: 'Skip existing users' }).boundingBox()
    const overwriteBox = await modal
      .getByRole('radio', { name: 'Overwrite existing users' })
      .boundingBox()
    expect(previewBox?.y ?? 0).toBeLessThan(radiosBox?.y ?? 0)
    expect(radiosBox?.y ?? 0).toBeLessThan(overwriteBox?.y ?? 0)
    expect(overwriteBox?.y ?? 0).toBeLessThan(summaryBox?.y ?? 0)

    await modal.getByRole('radio', { name: 'Overwrite existing users' }).check()
    await expect(modal).toContainText(
      'Mobile number, groups and profile of the existing users are updated, together with the voicemail and the devices set in the file. Their names are kept. A different extension recreates all their devices.',
    )
    await expect(modal.getByRole('button', { name: 'Import 2 users' })).toBeVisible()
    await expect(modal).not.toContainText('This user already exists:')

    await modal.getByRole('radio', { name: 'Skip existing users' }).check()
    await expect(modal).toContainText('Row 2 (a.miller)')
    await modal.getByRole('button', { name: 'Import 1 user' }).click()

    await expect(page.getByText('Users imported')).toBeVisible(IMPORT_TIMEOUT)
    const file = mockApi.callsTo('POST', `${REST}/csv/csvimport`)[0].body as { file: string }
    expect(Buffer.from(file.file, 'base64').toString()).toBe(
      '"k.lee","Kevin Lee","310","","","","","Sales|Marketing","Base"\r\n',
    )
  })

  test('reports the import failures with the rows of the chosen file', async ({
    page,
    mockApi,
  }) => {
    csvImportMock(mockApi, {
      status: 500,
      json: {
        status:
          'Something went wrong: \nError adding main extension 311 to user n.ray: busy at CSV line 2\n',
        problems: [
          { code: 'extension_failed', line: 2, username: 'n.ray', extension: '311' },
          { code: 'group_name_invalid', line: 1, username: 'k.lee', group: 'Sales, North' },
        ],
      },
    })
    await page.goto('./users/users')
    await page.getByRole('button', { name: 'Actions', exact: true }).click()
    await page.getByRole('menuitem', { name: 'Import users from CSV' }).click()

    const drawer = page.getByRole('dialog', { name: 'Import users' })
    await drawer.locator('input[type=file]').setInputFiles({
      name: 'users.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(
        [
          'username,name,surname,extension',
          'b.boone,Bob,Boone,xxx',
          'k.lee,Kevin,Lee,310',
          'n.ray,Nora,Ray,311',
        ].join('\n'),
      ),
    })
    await drawer.getByRole('button', { name: 'Next' }).click()
    const modal = page
      .getByRole('dialog', { name: 'Import users' })
      .filter({ hasText: 'File preview' })
    await modal.getByRole('button', { name: 'Import 2 users' }).click()

    await expect(modal).toContainText(
      'Row 4 (n.ray): extension 311 could not be assigned.',
      IMPORT_TIMEOUT,
    )
    await expect(modal).toContainText(
      'Row 3 (k.lee): group "Sales, North" has a name that is not valid or too similar to an existing group.',
    )
    await expect(modal).not.toContainText('CSV line')
    await expect(modal).not.toContainText('Something went wrong')
  })

  test('reports the CSV rows with control characters and does not import them', async ({
    page,
    mockApi,
  }) => {
    csvImportMock(mockApi, { status: 200, json: { result: 100 } })
    await page.goto('./users/users')
    await page.getByRole('button', { name: 'Actions', exact: true }).click()
    await page.getByRole('menuitem', { name: 'Import users from CSV' }).click()

    const drawer = page.getByRole('dialog', { name: 'Import users' })
    await drawer.locator('input[type=file]').setInputFiles({
      name: 'users.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(
        [
          'username,name,surname,extension',
          'k.lee,Kevin,Lee,310',
          'n.ray,"Nora\tJane",Ray,311',
          'o.dean,Omar,"De\nan",312',
          'p.hill,"Zoë ""Q"" O\'Brien",R&D #2,313',
        ].join('\n'),
      ),
    })
    await drawer.getByRole('button', { name: 'Next' }).click()

    const modal = page
      .getByRole('dialog', { name: 'Import users' })
      .filter({ hasText: 'File preview' })
    await expect(modal).toContainText(
      'Row 3 (n.ray): tabs, line breaks or other invisible characters in a field',
    )
    await expect(modal).toContainText(
      'Row 4 (o.dean): tabs, line breaks or other invisible characters in a field',
    )
    await expect(modal.getByTestId('import-summary')).toContainText('2 valid')
    await expect(modal.getByTestId('import-summary')).toContainText(
      '2 with errors (will be skipped)',
    )
    await modal.getByRole('button', { name: 'Import 2 users' }).click()

    await expect(page.getByText('Users imported')).toBeVisible(IMPORT_TIMEOUT)
    const file = mockApi.callsTo('POST', `${REST}/csv/csvimport`)[0].body as { file: string }
    expect(Buffer.from(file.file, 'base64').toString()).toBe(
      '"k.lee","Kevin Lee","310"\r\n"p.hill","Zoë ""Q"" O\'Brien R&D #2","313"\r\n',
    )
  })

  test('shows the imported users with their groups and the import result', async ({
    page,
    mockApi,
  }) => {
    let imported = false
    const kevin = { ...RAW_USERS[2], id: '14', username: 'k.lee', displayname: 'Kevin Lee' }
    csvImportMock(mockApi, { status: 200, json: { result: 100 } })
    mockApi
      .on('POST', `${REST}/csv/csvimport`, () => {
        imported = true
        return { status: 200 }
      })
      .on('GET', `${REST}/users/:all`, () => ({
        json: imported ? [...RAW_USERS, kevin] : RAW_USERS,
      }))
      .on('GET', `${REST}/cti/groups`, () => ({
        json: imported ? [...GROUPS, { id: 4, name: 'Marketing' }] : GROUPS,
      }))
      .on('GET', `${REST}/cti/users/groups/:id`, (request) => {
        const id = request.path.split('/').pop() ?? ''
        const members = imported
          ? { ...GROUP_MEMBERS, '1': [...GROUP_MEMBERS['1'], 14], '4': [14] }
          : GROUP_MEMBERS
        return {
          json: (members[id] ?? []).map((userId) => ({ user_id: userId, name: 'group' })),
        }
      })
    await page.goto('./users/users')
    await expect(page.getByTestId('user-a.miller')).toContainText('Sales')
    await page.getByRole('button', { name: 'Actions', exact: true }).click()
    await page.getByRole('menuitem', { name: 'Import users from CSV' }).click()

    const drawer = page.getByRole('dialog', { name: 'Import users' })
    await drawer.locator('input[type=file]').setInputFiles({
      name: 'users.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(
        [
          'username,name,surname,extension,group',
          'a.miller,Anna,Miller,300,Sales',
          'k.lee,Kevin,Lee,310,Sales|Marketing',
          'b.boone,Bob,Boone,xxx,',
        ].join('\n'),
      ),
    })
    await drawer.getByRole('button', { name: 'Next' }).click()
    await page
      .getByRole('dialog', { name: 'Import users' })
      .filter({ hasText: 'File preview' })
      .getByRole('button', { name: 'Import 1 user' })
      .click()

    await expect(page.getByText('Users imported')).toBeVisible(IMPORT_TIMEOUT)
    await expect(page.getByText('Created: 1 · Updated: 0 · Skipped: 2')).toBeVisible()
    await expect(page.getByText('Users imported')).toHaveCount(1)
    await expect(page.getByTestId('user-k.lee')).toContainText('Marketing, Sales')
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
    await drawer.getByRole('button', { name: 'Next' }).click()

    const modal = page
      .getByRole('dialog', { name: 'Import users' })
      .filter({ hasText: 'File preview' })
    await modal.getByRole('radio', { name: 'Overwrite existing users' }).check()
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
    await drawer.getByRole('button', { name: 'Next' }).click()
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
    await drawer.getByRole('button', { name: 'Next' }).click()

    const modal = page
      .getByRole('dialog', { name: 'Import users' })
      .filter({ hasText: 'File preview' })
    await expect(modal.getByText('File too large')).toBeVisible()
    await expect(modal.getByRole('button', { name: 'Import 5000 users' })).toBeDisabled()
  })

  test('keeps backslashes and refuses spaces around the passwords of the CSV', async ({
    page,
    mockApi,
  }) => {
    csvImportMock(mockApi, { status: 200, json: { result: 100 } })
    await page.goto('./users/users')
    await page.getByRole('button', { name: 'Actions', exact: true }).click()
    await page.getByRole('menuitem', { name: 'Import users from CSV' }).click()

    const drawer = page.getByRole('dialog', { name: 'Import users' })
    await drawer.locator('input[type=file]').setInputFiles({
      name: 'users.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(
        [
          'username,name,surname,extension,password',
          'k.lee,Kevin,Lee\\,310,Secret\\1!\\',
          'm.cole,Mia,Cole,311," Secret,123"',
          'n.ray,Nora,Ray,312,"Secret,123 "',
        ].join('\n'),
      ),
    })
    await drawer.getByRole('button', { name: 'Next' }).click()
    const modal = page
      .getByRole('dialog', { name: 'Import users' })
      .filter({ hasText: 'File preview' })
    await expect(
      modal.getByText('Row 3 (m.cole): spaces at the start or end of the password'),
    ).toBeVisible()
    await expect(
      modal.getByText('Row 4 (n.ray): spaces at the start or end of the password'),
    ).toBeVisible()
    await modal.getByRole('button', { name: 'Import 1 user' }).click()

    await expect(page.getByText('Users imported')).toBeVisible(IMPORT_TIMEOUT)
    const file = mockApi.callsTo('POST', `${REST}/csv/csvimport`)[0].body as {
      file: string
      rfc4180: boolean
    }
    expect(Buffer.from(file.file, 'base64').toString()).toBe(
      '"k.lee","Kevin Lee\\","310","Secret\\1!\\"\r\n',
    )
    expect(file.rfc4180).toBe(true)
  })

  test('blocks the import until every detail of the users is loaded', async ({ page, mockApi }) => {
    let mobilesLoaded = false
    mockApi.on('GET', `${REST}/mobiles`, () =>
      mobilesLoaded ? { json: [] } : { status: 500, json: { error: 'boom' } },
    )
    await page.goto('./users/users')
    await expect(page.getByTestId('users-directory-warning')).toBeVisible()
    await page.getByRole('button', { name: 'Actions', exact: true }).click()
    await page.getByRole('menuitem', { name: 'Import users from CSV' }).click()

    const drawer = page.getByRole('dialog', { name: 'Import users' })
    await drawer.locator('input[type=file]').setInputFiles({
      name: 'users.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(
        ['username,name,surname,extension', 'a.miller,Anna,Miller,300', 'k.lee,Kevin,Lee,310'].join(
          '\n',
        ),
      ),
    })
    await drawer.getByRole('button', { name: 'Next' }).click()
    const modal = page
      .getByRole('dialog', { name: 'Import users' })
      .filter({ hasText: 'File preview' })
    const warning = modal.getByTestId('import-directory-warning')
    await expect(warning).toContainText('Cannot retrieve: Mobile number')
    await expect(modal.getByRole('button', { name: 'Import 1 user' })).toBeDisabled()
    await modal.getByText('Overwrite existing users').click()
    await expect(modal.getByRole('button', { name: 'Import 2 users' })).toBeDisabled()

    mobilesLoaded = true
    await warning.getByRole('button', { name: 'Retry' }).click()

    await expect(warning).toBeHidden()
    await expect(modal.getByRole('button', { name: 'Import 2 users' })).toBeEnabled()
    expect(mockApi.callsTo('POST', `${REST}/csv/csvimport`)).toHaveLength(0)
  })

  test('recognizes existing users whatever the case of their username', async ({
    page,
    mockApi,
  }) => {
    csvImportMock(mockApi, { status: 200, json: { result: 100 } })
    mockApi.on('GET', `${REST}/users/:all`, {
      json: RAW_USERS.map((user) =>
        user.username === 'a.miller' ? { ...user, username: 'A.Miller' } : user,
      ),
    })
    await page.goto('./users/users')
    await page.getByRole('button', { name: 'Actions', exact: true }).click()
    await page.getByRole('menuitem', { name: 'Import users from CSV' }).click()

    const drawer = page.getByRole('dialog', { name: 'Import users' })
    await drawer.locator('input[type=file]').setInputFiles({
      name: 'users.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(['username,name,surname', 'a.miller,Anna,Miller'].join('\n')),
    })
    await drawer.getByRole('button', { name: 'Next' }).click()
    const modal = page
      .getByRole('dialog', { name: 'Import users' })
      .filter({ hasText: 'File preview' })
    await modal.getByText('Overwrite existing users').click()
    await modal.getByRole('button', { name: 'Import 1 user' }).click()

    await expect(page.getByText('Created: 0 · Updated: 1 · Skipped: 0')).toBeVisible(IMPORT_TIMEOUT)
  })

  test('shows the users of a group created in the groups tab', async ({ page, mockApi }) => {
    let created = false
    mockApi
      .on('POST', `${REST}/cti/groups`, () => {
        created = true
        return { json: '4' }
      })
      .on('POST', `${REST}/cti/groups/users/:id`, { status: 200 })
      .on('GET', `${REST}/cti/groups/users/:id`, { json: [1] })
      .on('GET', `${REST}/cti/groups`, () => ({
        json: created ? [...GROUPS, { id: 4, name: 'Marketing' }] : GROUPS,
      }))
      .on('GET', `${REST}/cti/users/groups/:id`, (request) => {
        const id = request.path.split('/').pop() ?? ''
        const members = created ? { ...GROUP_MEMBERS, '4': [11] } : GROUP_MEMBERS
        return {
          json: (members[id] ?? []).map((userId) => ({ user_id: userId, name: 'group' })),
        }
      })
    await page.goto('./users/users')
    await expect(page.getByTestId('user-a.miller')).toContainText('Sales')
    await page
      .getByRole('navigation', { name: 'Tabs' })
      .getByRole('link', { name: 'Groups' })
      .click()
    await page.getByRole('button', { name: 'Create group' }).click()
    await page.getByRole('textbox', { name: 'Name' }).fill('Marketing')
    await page.getByRole('combobox', { name: 'Users' }).fill('a.miller')
    await page.getByRole('option', { name: /a\.miller/ }).click()
    await page.getByRole('dialog').getByRole('heading').click()
    await page.getByRole('button', { name: 'Create', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Create group', exact: true })).toBeHidden()

    await page
      .getByRole('navigation', { name: 'Tabs' })
      .getByRole('link', { name: 'Users' })
      .click()
    await expect(page.getByTestId('user-a.miller')).toContainText('Marketing')
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

const signInAs = async (page: import('@playwright/test').Page, user: string) => {
  await page.addInitScript((name) => {
    localStorage.setItem('secretkey', JSON.stringify({ user: name, hash: 'e2e-secret-key' }))
  }, user)
}

const mockAccountWrites = (mockApi: MockApi) => {
  let accounts = ACCOUNTS.map((account) => ({ ...account }))
  let users = [...RAW_USERS]
  let orphans: unknown[] = []

  mockApi
    .on('GET', `${REST}/users/domain/accounts`, () => ({ json: accounts }))
    .on('GET', `${REST}/users/:all`, () => ({ json: users }))
    .on('GET', `${REST}/mainextensions/orphans`, () => ({ json: orphans }))
    .on('PUT', `${REST}/users/:username/account/password`, { status: 204 })
    .on('PATCH', `${REST}/users/:username/account`, (request) => {
      const username = request.path.split('/').at(-2)
      const changes = request.body as Record<string, unknown>
      accounts = accounts.map((account) =>
        account.username === username ? { ...account, ...changes } : account,
      )
      return {
        json: { synchronized: 'display_name' in changes || 'mail' in changes ? true : null },
      }
    })
    .on('DELETE', `${REST}/users/:username/account`, (request) => {
      const username = request.path.split('/').at(-2)
      accounts = accounts.filter((account) => account.username !== username)
      users = users.filter((user) => user.username !== username)
      orphans = orphans.filter((orphan) => (orphan as { username: string }).username !== username)
      return { json: { synchronized: true, cleaned: true } }
    })
  return mockApi
}

const openRowMenu = async (page: import('@playwright/test').Page, username: string) => {
  await page.getByRole('button', { name: `Actions for ${username}` }).click()
}

test.describe('user accounts', () => {
  test.beforeEach(({ signedIn, mockApi }) => {
    void signedIn
    mockUsersApi(mockApi)
    mockUserPhonesApi(mockApi)
    mockAccountWrites(mockApi)
  })

  test('changes the password of a user', async ({ page, mockApi }) => {
    await page.goto('./users/users')
    await openRowMenu(page, 'a.miller')
    await page.getByRole('menuitem', { name: 'Change password' }).click()

    const drawer = page.getByRole('dialog', { name: 'Change password of a.miller' })
    const password = drawer.getByLabel('New password')
    await expect(password).toBeFocused()
    for (const rule of [
      'Minimum 8 characters',
      'At least one uppercase letter (A-Z)',
      'At least one lowercase letter (a-z)',
      'At least one number (0-9)',
      'At least one special character (!@#^&_?-)',
    ]) {
      await expect(drawer.getByText(rule)).toBeVisible()
    }
    await drawer.getByRole('button', { name: 'Change', exact: true }).click()
    await expect(drawer.getByText('Enter the password')).toBeVisible()
    await expect(drawer.getByText('Confirm the password')).toBeVisible()
    await expect(password).toBeFocused()

    await password.fill('weak')
    await drawer.getByLabel('Confirm password').fill('weak')
    await drawer.getByRole('button', { name: 'Change', exact: true }).click()
    await expect(drawer.getByText('The password does not meet the requirements')).toBeVisible()

    await password.fill('Invented-Pass1!')
    await drawer.getByLabel('Confirm password').fill('Invented-Pass2!')
    await drawer.getByRole('button', { name: 'Change', exact: true }).click()
    await expect(drawer.getByText('The passwords do not match')).toBeVisible()
    expect(mockApi.callsTo('PUT', `${REST}/users/:username/account/password`)).toHaveLength(0)

    await drawer.getByLabel('Confirm password').fill('Invented-Pass1!')
    await drawer.getByRole('button', { name: 'Change', exact: true }).click()

    const toasts = page.getByTestId('toast-notifications')
    await expect(toasts.getByText('Password updated')).toBeVisible()
    await expect(toasts.getByText('The password of user a.miller has been updated.')).toBeVisible()
    expect(mockApi.callsTo('PUT', `${REST}/users/a.miller/account/password`)[0].body).toEqual({
      password: 'Invented-Pass1!',
    })
  })

  test('shows why the account provider refused a password', async ({ page, mockApi }) => {
    const replies = [
      {
        status: 422,
        json: { code: 'password_history', message: 'The password was used recently' },
      },
      { status: 422, json: { code: 'password_rejected', message: 'rejected' } },
      { status: 500, json: { message: 'samba-tool failed: invented internal detail' } },
    ]
    mockApi.on('PUT', `${REST}/users/:username/account/password`, () => replies.shift()!)
    await page.goto('./users/users')
    await openRowMenu(page, 'c.davis')
    await page.getByRole('menuitem', { name: 'Change password' }).click()

    const drawer = page.getByRole('dialog', { name: 'Change password of c.davis' })
    await drawer.getByLabel('New password').fill('Invented-Pass1!')
    await drawer.getByLabel('Confirm password').fill('Invented-Pass1!')
    await drawer.getByRole('button', { name: 'Change', exact: true }).click()
    await expect(
      drawer.getByText('This password was used recently. Choose a different one.'),
    ).toBeVisible()
    await expect(drawer.getByLabel('New password')).toBeFocused()

    await drawer.getByRole('button', { name: 'Change', exact: true }).click()
    await expect(
      drawer.getByText('The password does not meet the rules of the account provider.'),
    ).toBeVisible()

    await drawer.getByRole('button', { name: 'Change', exact: true }).click()
    const failure = drawer.getByTestId('change-password-error')
    await expect(failure).toContainText('Cannot change the password')
    await expect(failure).toContainText(
      'The server could not complete the request (error 500). Try again later.',
    )
    await expect(failure).not.toContainText('invented internal detail')
    await expect(failure).toBeFocused()
  })

  test('disables a user from the edit drawer and shows it in the table', async ({
    page,
    mockApi,
  }) => {
    await page.goto('./users/users')
    await page.getByRole('button', { name: 'Edit c.davis' }).click()

    const drawer = page.getByRole('dialog', { name: 'Edit user c.davis' })
    await expect(drawer.getByRole('textbox', { name: 'First name', exact: true })).toBeFocused()
    const status = drawer.getByTestId('user-status-toggle')
    await expect(status).toContainText('Enabled')
    await expect(drawer.getByTestId('user-status-helper')).toHaveText(
      'A disabled user cannot sign in to NethVoice CTI and the apps. Phones and apps already connected keep working. The account is disabled in every application that uses the account provider.',
    )
    await status.getByText('Enabled').click()
    await expect(status).toContainText('Disabled')
    await drawer.getByRole('button', { name: 'Save' }).click()

    const toasts = page.getByTestId('toast-notifications')
    await expect(toasts.getByText('User updated')).toBeVisible()
    await expect(toasts.getByText('User Christopher Davis has been updated.')).toBeVisible()
    expect(mockApi.callsTo('PATCH', `${REST}/users/c.davis/account`).map((c) => c.body)).toEqual([
      { locked: true },
    ])
    for (const write of ['/mainextensions', '/voicemails', '/mobiles', '/webrtc', '/nethlink']) {
      expect(mockApi.callsTo('POST', `${REST}${write}`)).toHaveLength(0)
    }

    const row = page.getByTestId('user-c.davis')
    await expect(row.getByTestId('disabled-badge-c.davis')).toHaveText('Disabled')
    await expect(row).toHaveClass(/text-tertiary-neutral/)
    await expect(row).toContainText('301')

    await page.getByRole('button', { name: 'Edit c.davis' }).click()
    await expect(drawer.getByTestId('user-status-toggle')).toContainText('Disabled')
    await drawer.getByTestId('user-status-toggle').getByText('Disabled').click()
    await drawer.getByRole('button', { name: 'Save' }).click()
    await expect(row.getByTestId('disabled-badge-c.davis')).toHaveCount(0)
    expect(mockApi.callsTo('PATCH', `${REST}/users/c.davis/account`).at(-1)?.body).toEqual({
      locked: false,
    })
  })

  test('filters the users by status as the first filter', async ({ page, mockApi }) => {
    mockApi.on('GET', `${REST}/users/domain/accounts`, {
      json: ACCOUNTS.map((account) =>
        account.username === 'c.davis' ? { ...account, locked: true } : account,
      ),
    })
    await page.goto('./users/users')
    const rows = page.locator('[data-testid^="user-"]')
    await expect(page.getByTestId('disabled-badge-c.davis')).toBeVisible()
    await expect(page.getByTestId('disabled-badge-a.miller')).toHaveCount(0)
    await expect(
      page.getByRole('button', { name: /^(Status|Voicemail|Groups|Profiles|Devices)$/ }).first(),
    ).toHaveText('Status')

    await page.getByRole('button', { name: 'Status', exact: true }).click()
    for (const option of ['Any', 'Enabled', 'Disabled']) {
      await expect(page.getByRole('radio', { name: option, exact: true })).toBeVisible()
    }
    await page.getByRole('radio', { name: 'Disabled', exact: true }).click()
    await expect(rows).toHaveCount(1)
    await expect(page.getByTestId('user-c.davis')).toBeVisible()
    await page.keyboard.press('Escape')
    await page.mouse.move(0, 0)
    await page.getByRole('button', { name: 'Status', exact: true }).click()
    await page.getByRole('radio', { name: 'Enabled', exact: true }).click()
    await expect(rows).toHaveCount(2)
    await expect(page.getByTestId('user-c.davis')).toHaveCount(0)
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Reset filters' }).click()
    await expect(rows).toHaveCount(3)
  })

  test('edits name, surname and email of a user', async ({ page, mockApi }) => {
    await page.goto('./users/users')
    await page.getByRole('button', { name: 'Edit a.miller' }).click()

    const drawer = page.getByRole('dialog', { name: 'Edit user a.miller' })
    const name = drawer.getByRole('textbox', { name: 'First name', exact: true })
    const surname = drawer.getByRole('textbox', { name: 'Last name' })
    const email = drawer.getByRole('textbox', { name: 'Email' })
    await expect(name).toHaveValue('Anna')
    await expect(surname).toHaveValue('Miller')
    await expect(email).toHaveValue('anna.miller@example.org')
    await expect(email).toHaveAttribute('placeholder', 'e.g. jane.doe@example.com')

    const labels = await drawer.locator('label').allTextContents()
    const order = ['Status', 'First name', 'Last name', 'Email', 'Extension'].map((label) =>
      labels.findIndex((text) => text.trim().startsWith(label)),
    )
    expect(order).toEqual([...order].sort((a, b) => a - b))

    await name.fill('')
    await email.fill('anna.white')
    await drawer.getByRole('button', { name: 'Save' }).click()
    await expect(drawer.getByText('Enter the first name')).toBeVisible()
    await expect(drawer.getByText('Enter a valid email address')).toBeVisible()
    await expect(name).toBeFocused()
    expect(mockApi.callsTo('PATCH', `${REST}/users/:username/account`)).toHaveLength(0)

    await name.fill('Anna Maria')
    await surname.fill('White')
    await email.fill('anna.white@example.org')
    await drawer.getByRole('button', { name: 'Save' }).click()

    await expect(page.getByTestId('toast-notifications').getByText('User updated')).toBeVisible()
    expect(mockApi.callsTo('PATCH', `${REST}/users/a.miller/account`)[0].body).toEqual({
      display_name: 'Anna Maria White',
      mail: 'anna.white@example.org',
    })
  })

  test('refuses control characters in name and surname before saving', async ({
    page,
    mockApi,
  }) => {
    await page.goto('./users/users')
    await page.getByRole('button', { name: 'Edit a.miller' }).click()
    const drawer = page.getByRole('dialog', { name: 'Edit user a.miller' })
    const name = drawer.getByRole('textbox', { name: 'First name', exact: true })
    const surname = drawer.getByRole('textbox', { name: 'Last name' })
    const message = 'Remove tabs, line breaks and other invisible characters'

    await name.fill('Anna\tMaria')
    await drawer.getByRole('button', { name: 'Save' }).click()
    await expect(drawer.getByText(message)).toHaveCount(1)
    await expect(name).toBeFocused()

    await name.fill('Anna Maria')
    await surname.fill('Mil\u007fler')
    await drawer.getByRole('button', { name: 'Save' }).click()
    await expect(drawer.getByText(message)).toHaveCount(1)
    await expect(surname).toBeFocused()
    expect(mockApi.callsTo('PATCH', `${REST}/users/:username/account`)).toHaveLength(0)

    await surname.fill('Müller-Ça')
    await drawer.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByTestId('toast-notifications').getByText('User updated')).toBeVisible()
    expect(mockApi.callsTo('PATCH', `${REST}/users/a.miller/account`)[0].body).toEqual({
      display_name: 'Anna Maria Müller-Ça',
    })
  })

  test('limits the full name of an edited user and names the user with the new name', async ({
    page,
    mockApi,
  }) => {
    await page.goto('./users/users')
    await page.getByRole('button', { name: 'Edit a.miller' }).click()
    const drawer = page.getByRole('dialog', { name: 'Edit user a.miller' })
    const name = drawer.getByRole('textbox', { name: 'First name', exact: true })
    const surname = drawer.getByRole('textbox', { name: 'Last name' })

    await name.fill('Anna Josephine Alexandra Margaret')
    await surname.fill('Johnson-Whitfield')
    await drawer.getByRole('button', { name: 'Save' }).click()
    await expect(
      drawer.getByText('First and last name can be at most 50 characters long in total'),
    ).toBeVisible()
    await expect(name).toBeFocused()
    expect(mockApi.callsTo('PATCH', `${REST}/users/:username/account`)).toHaveLength(0)

    await name.fill('Anna Maria')
    await drawer.getByRole('button', { name: 'Save' }).click()
    const toasts = page.getByTestId('toast-notifications')
    await expect(toasts.getByText('User updated')).toBeVisible()
    await expect(toasts.getByText('Anna Maria Johnson-Whitfield')).toBeVisible()
    expect(mockApi.callsTo('PATCH', `${REST}/users/a.miller/account`)[0].body).toEqual({
      display_name: 'Anna Maria Johnson-Whitfield',
    })
  })

  test('shows a display name refused by the server on the name field', async ({
    page,
    mockApi,
  }) => {
    mockApi.on('PATCH', `${REST}/users/:username/account`, {
      status: 422,
      json: {
        code: 'invalid_display_name',
        message: 'The display name contains control characters',
      },
    })
    await page.goto('./users/users')
    await page.getByRole('button', { name: 'Edit a.miller' }).click()
    const drawer = page.getByRole('dialog', { name: 'Edit user a.miller' })
    const name = drawer.getByRole('textbox', { name: 'First name', exact: true })
    await name.fill('Anna Maria')
    await drawer.getByRole('button', { name: 'Save' }).click()

    await expect(
      drawer.getByText('Remove tabs, line breaks and other invisible characters'),
    ).toBeVisible()
    await expect(name).toBeFocused()
    await expect(drawer.getByTestId('user-save-error')).toContainText(
      'The name contains tabs, line breaks or other invisible characters.',
    )
  })

  test('reports a refused email and keeps the drawer open', async ({ page, mockApi }) => {
    mockApi.on('PATCH', `${REST}/users/:username/account`, {
      status: 422,
      json: { code: 'invalid_mail', message: 'Invalid email address' },
    })
    await page.goto('./users/users')
    await page.getByRole('button', { name: 'Edit a.miller' }).click()
    const drawer = page.getByRole('dialog', { name: 'Edit user a.miller' })
    await drawer.getByRole('textbox', { name: 'Email' }).fill('anna@example.invalid')
    await drawer.getByRole('button', { name: 'Save' }).click()

    await expect(drawer.getByText('Enter a valid email address', { exact: true })).toBeVisible()
    await expect(drawer.getByRole('textbox', { name: 'Email' })).toBeFocused()
    await expect(drawer.getByTestId('user-save-error')).toContainText(
      'Cannot save name, email and status',
    )
    expect(mockApi.callsTo('GET', `${REST}/users/domain/accounts`).length).toBeGreaterThan(1)
  })

  test('creates a user with an email address', async ({ page, mockApi }) => {
    const created = {
      ...RAW_USERS[2],
      id: '14',
      username: 'e.johnson',
      displayname: 'Emma Johnson',
      default_extension: 'none',
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
    await drawer.getByRole('textbox', { name: 'Username' }).fill('e.johnson')
    await drawer.getByRole('textbox', { name: 'First name', exact: true }).fill('Emma')
    await drawer.getByRole('textbox', { name: 'Last name' }).fill('Johnson')
    await drawer.getByLabel('Password', { exact: true }).fill('Secret,123')
    await drawer.getByLabel('Confirm password').fill('Secret,123')
    await drawer.getByRole('textbox', { name: 'Email' }).fill('emma.johnson@example.org')
    await drawer.getByRole('button', { name: 'Create' }).click()

    await expect(page.getByText('User created')).toBeVisible(IMPORT_TIMEOUT)
    const file = mockApi.callsTo('POST', `${REST}/csv/csvimport`)[0].body as { file: string }
    expect(Buffer.from(file.file, 'base64').toString()).toBe(
      '"e.johnson","Emma Johnson","","Secret,123"\r\n',
    )
    expect(mockApi.callsTo('PATCH', `${REST}/users/e.johnson/account`)[0].body).toEqual({
      mail: 'emma.johnson@example.org',
    })
  })

  test('deletes a user with its extension, voicemail and devices', async ({ page, mockApi }) => {
    await page.goto('./users/users')
    await expect(page.getByTestId('orphan-extensions-warning')).toHaveCount(0)
    await openRowMenu(page, 'a.miller')
    const items = page.getByRole('menuitem')
    await expect(items).toHaveText([
      'Change password',
      'Reassign extension',
      'Remove extension',
      'Delete',
    ])
    await page.getByRole('menuitem', { name: 'Delete' }).click()

    const modal = page.getByRole('dialog', { name: 'Delete user' })
    await expect(modal.getByTestId('delete-user-confirmation')).toHaveText(
      [
        'User Anna Miller (a.miller) will be permanently deleted.',
        'The account is deleted from the account provider: the user can no longer sign in to any application that uses it, such as Mail, Nextcloud or WebTop.',
        'Extension 300, its voicemail and its devices are deleted too. The physical phones are freed and can be assigned to other users.',
        "Creating the user again won't restore anything. This cannot be undone.",
      ].join(''),
      { useInnerText: false },
    )
    await modal.getByRole('button', { name: 'Delete', exact: true }).click()

    const toasts = page.getByTestId('toast-notifications')
    await expect(toasts.getByText('User deleted')).toBeVisible()
    await expect(toasts.getByText('User Anna Miller has been deleted.')).toBeVisible()
    expect(mockApi.callsTo('DELETE', `${REST}/users/a.miller/account`)).toHaveLength(1)
    await expect(page.getByTestId('user-a.miller')).toHaveCount(0)
    await expect(toasts.getByText('Cannot delete all the user data')).toHaveCount(0)
    await expect(page.getByTestId('orphan-extensions-warning')).toHaveCount(0)
    for (const [method, path] of [
      ['POST', '/mainextensions'],
      ['POST', '/mainextensions/orphans/release'],
      ['DELETE', '/webrtc/:ext'],
      ['DELETE', '/physicalextensions/:ext'],
    ]) {
      expect(mockApi.callsTo(method, `${REST}${path}`)).toHaveLength(0)
    }
  })

  test('deletes a user without extension and reports a failure in the modal', async ({
    page,
    mockApi,
  }) => {
    let failing = true
    mockApi.on('DELETE', `${REST}/users/:username/account`, () =>
      failing
        ? { status: 502, json: { code: 'provider_error', message: 'internal' } }
        : { json: { synchronized: false, cleaned: true } },
    )
    await page.goto('./users/users')
    await openRowMenu(page, 'd.jones')
    await page.getByRole('menuitem', { name: 'Delete' }).click()

    const modal = page.getByRole('dialog', { name: 'Delete user' })
    await expect(modal.getByTestId('delete-user-confirmation')).not.toContainText('Extension')
    await expect(modal.getByTestId('delete-user-confirmation')).toContainText(
      'such as Mail, Nextcloud or WebTop',
    )
    await modal.getByRole('button', { name: 'Delete', exact: true }).click()
    await expect(modal.getByText('Cannot delete the user')).toBeVisible()
    await expect(modal.getByText('internal')).toHaveCount(0)

    failing = false
    await modal.getByRole('button', { name: 'Delete', exact: true }).click()
    const toasts = page.getByTestId('toast-notifications')
    await expect(toasts.getByText('User deleted')).toBeVisible()
    await expect(
      toasts.getByText(
        'The list of users could not be updated. To update it, choose Synchronize users.',
      ),
    ).toBeVisible()
  })

  test('warns when the data of a deleted user could not be deleted', async ({ page, mockApi }) => {
    mockApi.on('DELETE', `${REST}/users/:username/account`, {
      json: { synchronized: false, cleaned: false },
    })
    await page.goto('./users/users')
    await openRowMenu(page, 'a.miller')
    await page.getByRole('menuitem', { name: 'Delete' }).click()
    await page
      .getByRole('dialog', { name: 'Delete user' })
      .getByRole('button', { name: 'Delete', exact: true })
      .click()

    const toasts = page.getByTestId('toast-notifications')
    await expect(toasts.getByText('User deleted')).toBeVisible()
    await expect(toasts.getByText('Cannot delete all the user data')).toBeVisible()
    await expect(
      toasts.getByText(
        'User Anna Miller has been deleted from the account provider, but some of its NethVoice data could not be deleted. Choose Synchronize users, then delete what remains in Extensions of removed users.',
      ),
    ).toBeVisible()
    await expect(
      toasts.getByText(
        'The list of users could not be updated. To update it, choose Synchronize users.',
      ),
    ).toHaveCount(0)
  })

  test('warns when the users could not be synchronized after a change of name', async ({
    page,
    mockApi,
  }) => {
    mockApi.on('PATCH', `${REST}/users/:username/account`, (request) => ({
      json: { synchronized: 'locked' in (request.body as object) ? null : false },
    }))
    await page.goto('./users/users')
    const toasts = page.getByTestId('toast-notifications')
    const warning = toasts.getByText(
      'The list of users could not be updated. To update it, choose Synchronize users.',
    )

    await page.getByRole('button', { name: 'Edit c.davis' }).click()
    const lockDrawer = page.getByRole('dialog', { name: 'Edit user c.davis' })
    await lockDrawer.getByTestId('user-status-toggle').getByText('Enabled').click()
    await lockDrawer.getByRole('button', { name: 'Save' }).click()
    await expect(toasts.getByText('User Christopher Davis has been updated.')).toBeVisible()
    await expect(warning).toHaveCount(0)

    await page.getByRole('button', { name: 'Edit a.miller' }).click()
    const drawer = page.getByRole('dialog', { name: 'Edit user a.miller' })
    await drawer.getByRole('textbox', { name: 'Last name' }).fill('White')
    await drawer.getByRole('button', { name: 'Save' }).click()
    await expect(toasts.getByText('User updated').first()).toBeVisible()
    await expect(toasts.getByText('Cannot synchronize the users')).toBeVisible()
    await expect(warning).toBeVisible()
  })

  test.describe('account removed from the account provider', () => {
    const missing = { status: 404, json: { code: 'user_not_found', message: 'internal' } }
    const description =
      'User a.miller no longer exists in the account provider. To update the list of users, choose Synchronize users.'

    const expectRefreshed = async (mockApi: MockApi, before: number) => {
      await expect
        .poll(() => mockApi.callsTo('GET', `${REST}/users/:all`).length)
        .toBeGreaterThan(before)
    }

    test('closes the password drawer and refreshes the users', async ({ page, mockApi }) => {
      mockApi.on('PUT', `${REST}/users/:username/account/password`, missing)
      await page.goto('./users/users')
      await openRowMenu(page, 'a.miller')
      await page.getByRole('menuitem', { name: 'Change password' }).click()
      const drawer = page.getByRole('dialog', { name: 'Change password of a.miller' })
      await drawer.getByLabel('New password').fill('Invented-Pass1!')
      await drawer.getByLabel('Confirm password').fill('Invented-Pass1!')
      const before = mockApi.callsTo('GET', `${REST}/users/:all`).length
      await drawer.getByRole('button', { name: 'Change', exact: true }).click()

      await expect(drawer).toBeHidden()
      const toasts = page.getByTestId('toast-notifications')
      await expect(toasts.getByText('Cannot change the password')).toBeVisible()
      await expect(toasts.getByText(description)).toBeVisible()
      await expect(toasts.getByText('internal')).toHaveCount(0)
      await expectRefreshed(mockApi, before)
    })

    test('closes the edit drawer and refreshes the users', async ({ page, mockApi }) => {
      mockApi.on('PATCH', `${REST}/users/:username/account`, missing)
      await page.goto('./users/users')
      await page.getByRole('button', { name: 'Edit a.miller' }).click()
      const drawer = page.getByRole('dialog', { name: 'Edit user a.miller' })
      await drawer.getByRole('textbox', { name: 'Last name' }).fill('White')
      const before = mockApi.callsTo('GET', `${REST}/users/:all`).length
      await drawer.getByRole('button', { name: 'Save' }).click()

      await expect(drawer).toBeHidden()
      const toasts = page.getByTestId('toast-notifications')
      await expect(toasts.getByText('Cannot save name, email and status')).toBeVisible()
      await expect(toasts.getByText(description)).toBeVisible()
      await expectRefreshed(mockApi, before)
      for (const write of ['/mainextensions', '/voicemails', '/mobiles', '/webrtc', '/nethlink']) {
        expect(mockApi.callsTo('POST', `${REST}${write}`)).toHaveLength(0)
      }
    })

    test('closes the delete modal and refreshes the users', async ({ page, mockApi }) => {
      mockApi.on('DELETE', `${REST}/users/:username/account`, missing)
      await page.goto('./users/users')
      await openRowMenu(page, 'a.miller')
      await page.getByRole('menuitem', { name: 'Delete' }).click()
      const modal = page.getByRole('dialog', { name: 'Delete user' })
      const before = mockApi.callsTo('GET', `${REST}/users/:all`).length
      await modal.getByRole('button', { name: 'Delete', exact: true }).click()

      await expect(modal).toBeHidden()
      const toasts = page.getByTestId('toast-notifications')
      await expect(toasts.getByText('Cannot delete the user')).toBeVisible()
      await expect(toasts.getByText(description)).toBeVisible()
      await expectRefreshed(mockApi, before)
    })
  })

  test('opens the drawer and the modal with the keyboard and returns the focus', async ({
    page,
  }) => {
    await page.goto('./users/users')
    const menuButton = page.getByRole('button', { name: 'Actions for a.miller' })
    await menuButton.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('menuitem', { name: 'Change password' })).toBeVisible()
    await page.keyboard.press('Enter')

    const drawer = page.getByRole('dialog', { name: 'Change password of a.miller' })
    await expect(drawer.getByLabel('New password')).toBeFocused()
    await page.keyboard.type('Invented-Pass1!')
    await page.keyboard.press('Tab')
    await expect(drawer.getByRole('button', { name: 'Show password' }).first()).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(drawer.getByLabel('New password')).toBeHidden()
    await expect(menuButton).toBeFocused()

    await page.keyboard.press('Enter')
    await expect(page.getByRole('menuitem', { name: 'Delete' })).toBeVisible()
    await page.keyboard.press('End')
    await page.keyboard.press('Enter')
    const modal = page.getByRole('dialog', { name: 'Delete user' })
    await expect(modal.getByRole('button', { name: 'Cancel' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(modal.getByRole('button', { name: 'Cancel' })).toBeHidden()
    await expect(menuButton).toBeFocused()
  })

  test('fits a phone screen', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('./users/users')
    await page.getByRole('button', { name: 'Actions for a.miller' }).click()
    await page.getByRole('menuitem', { name: 'Change password' }).click()
    const drawer = page.getByRole('dialog', { name: 'Change password of a.miller' })
    await expect(drawer.getByRole('button', { name: 'Change', exact: true })).toBeInViewport()
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(0)
    await drawer.getByRole('button', { name: 'Cancel' }).click()

    await page.getByRole('button', { name: 'Actions for a.miller' }).click()
    await page.getByRole('menuitem', { name: 'Delete' }).click()
    const modal = page.getByRole('dialog', { name: 'Delete user' })
    await expect(modal.getByRole('button', { name: 'Delete', exact: true })).toBeInViewport()
  })

  test('opens the actions menu inside a phone screen', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('./users/users')
    await page.getByRole('button', { name: 'Actions', exact: true }).click()

    const menu = page.getByRole('menu')
    await expect(menu.getByRole('menuitem', { name: 'Import users from CSV' })).toBeVisible()
    const box = await menu.boundingBox()
    expect(box?.x).toBeGreaterThanOrEqual(0)
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(390)
  })

  test('limits the username and the full name of a new user', async ({ page, mockApi }) => {
    csvImportMock(mockApi, { status: 200, json: { result: 100 } })
    await page.goto('./users/users')
    await page.getByRole('button', { name: 'Create user' }).first().click()
    const drawer = page.getByRole('dialog', { name: 'Create user' })
    const username = drawer.getByRole('textbox', { name: 'Username' })
    const name = drawer.getByRole('textbox', { name: 'First name', exact: true })

    await username.fill('emma.josephine.alexandra.johnson.w')
    await drawer.getByRole('button', { name: 'Create' }).click()
    await expect(drawer.getByText('The username can be at most 32 characters long')).toBeVisible()
    await expect(username).toHaveValue('emma.josephine.alexandra.johnson.w')
    await expect(username).toBeFocused()

    await username.fill('e.johnson')
    await name.fill('Emma Josephine Alexandra Margaret')
    await drawer.getByRole('textbox', { name: 'Last name' }).fill('Johnson-Whitfield')
    await drawer.getByLabel('Password', { exact: true }).fill('Secret,123')
    await drawer.getByLabel('Confirm password').fill('Secret,123')
    await drawer.getByRole('button', { name: 'Create' }).click()

    await expect(
      drawer.getByText('First and last name can be at most 50 characters long in total'),
    ).toBeVisible()
    await expect(name).toBeFocused()
    expect(mockApi.callsTo('POST', `${REST}/csv/csvimport`)).toHaveLength(0)
  })

  test('explains a value too long for the PBX instead of the database error', async ({
    page,
    mockApi,
  }) => {
    csvImportMock(mockApi, {
      status: 500,
      json: {
        status:
          "Error adding main extension 305 to user e.johnson: Unable to insert into users: SQLSTATE[22001]: String data, right truncated: 1406 Data too long for column 'name' at row 1\n",
      },
    })
    await page.goto('./users/users')
    await page.getByRole('button', { name: 'Create user' }).first().click()
    const drawer = page.getByRole('dialog', { name: 'Create user' })
    await drawer.getByRole('textbox', { name: 'Username' }).fill('e.johnson')
    await drawer.getByRole('textbox', { name: 'First name', exact: true }).fill('Emma')
    await drawer.getByRole('textbox', { name: 'Last name' }).fill('Johnson')
    await drawer.getByLabel('Password', { exact: true }).fill('Secret,123')
    await drawer.getByLabel('Confirm password').fill('Secret,123')
    await drawer.getByRole('textbox', { name: 'Extension' }).fill('305')
    await drawer.getByRole('button', { name: 'Create' }).click()

    await expect(
      drawer.getByText(
        'Some values are longer than the PBX allows, so the extension has not been created. Shorten the first and last name, then add the extension with Edit.',
      ),
    ).toBeVisible(IMPORT_TIMEOUT)
    await expect(drawer.getByText('SQLSTATE')).toHaveCount(0)
  })

  test('keeps the users on screen when a refresh fails', async ({ page, mockApi }) => {
    let failing = false
    mockApi.on('GET', `${REST}/users/:all`, () =>
      failing ? { status: 500, json: { error: 'boom' } } : { json: RAW_USERS },
    )
    await page.goto('./users/users')
    await expect(page.getByTestId('user-a.miller')).toBeVisible()

    failing = true
    await page.clock.install()
    await page.clock.runFor(60_000)
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))

    await expect(page.getByText('Cannot retrieve users')).toBeVisible()
    await expect(page.getByTestId('user-a.miller')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Create user' })).toBeVisible()
  })

  test('waits for the accounts before showing the identity of an edited user', async ({
    page,
    mockApi,
  }) => {
    let releaseAccounts: () => void = () => undefined
    const accountsReleased = new Promise<void>((resolve) => {
      releaseAccounts = resolve
    })
    mockApi.on('GET', `${REST}/users/domain/accounts`, async () => {
      await accountsReleased
      return { json: ACCOUNTS }
    })
    await page.goto('./users/users')
    await page.getByRole('button', { name: 'Edit a.miller' }).click()
    const drawer = page.getByRole('dialog', { name: 'Edit user a.miller' })

    await expect(drawer.getByTestId('user-account-skeleton')).toBeVisible()
    await expect(
      drawer.getByText('The user accounts are not loaded', { exact: false }),
    ).toHaveCount(0)
    releaseAccounts()

    await expect(drawer.getByTestId('user-account-skeleton')).toBeHidden()
    await expect(drawer.getByTestId('user-status-toggle').getByRole('checkbox')).toBeEnabled()
    await expect(drawer.getByRole('textbox', { name: 'First name', exact: true })).toBeEnabled()
    await expect(drawer.getByRole('textbox', { name: 'First name', exact: true })).toHaveValue(
      'Anna',
    )
    await expect(drawer.getByRole('textbox', { name: 'Email' })).toHaveValue(
      'anna.miller@example.org',
    )
    await drawer.getByRole('button', { name: 'Cancel' }).click()
    await expect(drawer).toBeHidden()
  })

  test('reserves the place of the status of a new user until the domain is known', async ({
    page,
    mockApi,
  }) => {
    let releaseDomain: () => void = () => undefined
    const domainReleased = new Promise<void>((resolve) => {
      releaseDomain = resolve
    })
    mockApi
      .on('GET', `${REST}/users/domain`, async () => {
        await domainReleased
        return { json: { manageable: true, reason: null } }
      })
      .on('GET', `${REST}/users/domain/accounts`, () => new Promise(() => undefined))
    await page.goto('./users/users')
    await page.getByRole('button', { name: 'Create user' }).first().click()
    const drawer = page.getByRole('dialog', { name: 'Create user' })

    await expect(drawer.getByTestId('user-account-skeleton')).toBeVisible()
    releaseDomain()

    await expect(drawer.getByTestId('user-account-skeleton')).toBeHidden()
    await expect(drawer.getByTestId('user-status-toggle')).toBeVisible()
    await expect(drawer.getByRole('textbox', { name: 'Email' })).toBeVisible()
  })

  test('reloads the physical phones after removing an extension', async ({ page, mockApi }) => {
    mockWrites(mockApi)
    await page.goto('./users/users')
    await page.getByRole('button', { name: 'Edit a.miller' }).click()
    const drawer = page.getByRole('dialog', { name: 'Edit user a.miller' })
    await expect(drawer.getByRole('button', { name: 'Add phone' })).toBeVisible()
    await drawer.getByRole('button', { name: 'Cancel' }).click()
    await expect(drawer).toBeHidden()
    const phoneReads = mockApi.callsTo('GET', `${TANCREDI}/phones`).length

    await page.getByRole('button', { name: 'Actions for c.davis' }).click()
    await page.getByRole('menuitem', { name: 'Remove extension' }).click()
    await page
      .getByRole('dialog', { name: 'Remove extension' })
      .getByRole('button', { name: 'Remove extension' })
      .click()
    await expect(page.getByText('Extension removed')).toBeVisible()

    await page.getByRole('button', { name: 'Edit a.miller' }).click()
    await expect(drawer.getByRole('button', { name: 'Add phone' })).toBeVisible()
    await expect
      .poll(() => mockApi.callsTo('GET', `${TANCREDI}/phones`).length)
      .toBeGreaterThan(phoneReads)
  })

  test('reloads the physical phones after reassigning an extension', async ({ page, mockApi }) => {
    mockApi.on('POST', `${REST}/mainextensions/:ext/reassign`, {
      json: { key_labels_updated: 0, key_labels_incomplete: false },
    })
    await page.goto('./users/users')
    await page.getByRole('button', { name: 'Edit a.miller' }).click()
    const drawer = page.getByRole('dialog', { name: 'Edit user a.miller' })
    await expect(drawer.getByRole('button', { name: 'Add phone' })).toBeVisible()
    await drawer.getByRole('button', { name: 'Cancel' }).click()
    await expect(drawer).toBeHidden()
    const phoneReads = mockApi.callsTo('GET', `${TANCREDI}/phones`).length

    await page.getByRole('button', { name: 'Actions for c.davis' }).click()
    await page.getByRole('menuitem', { name: 'Reassign extension' }).click()
    const modal = page.getByRole('dialog', { name: 'Reassign extension' })
    await modal.getByRole('combobox', { name: 'Assign to' }).click()
    await modal.getByRole('option', { name: /d\.jones/ }).click()
    await modal.getByRole('button', { name: 'Reassign' }).click()
    await expect(page.getByText('Extension reassigned')).toBeVisible()

    await page.getByRole('button', { name: 'Edit a.miller' }).click()
    await expect(drawer.getByRole('button', { name: 'Add phone' })).toBeVisible()
    await expect
      .poll(() => mockApi.callsTo('GET', `${TANCREDI}/phones`).length)
      .toBeGreaterThan(phoneReads)
  })

  test('moves the focus to the missing user of a reassignment', async ({ page }) => {
    await page.goto('./users/users')
    await page.getByRole('button', { name: 'Actions for a.miller' }).click()
    await page.getByRole('menuitem', { name: 'Reassign extension' }).click()
    const modal = page.getByRole('dialog', { name: 'Reassign extension' })
    await modal.getByRole('button', { name: 'Reassign' }).click()

    await expect(modal.getByText('Choose the user')).toBeVisible()
    await expect(modal.getByRole('combobox', { name: 'Assign to' })).toBeFocused()
  })

  test('moves the focus to the file of an import without file', async ({ page }) => {
    await page.goto('./users/users')
    await page.getByRole('button', { name: 'Actions', exact: true }).click()
    await page.getByRole('menuitem', { name: 'Import users from CSV' }).click()
    const drawer = page.getByRole('dialog', { name: 'Import users' })
    await drawer.getByRole('button', { name: 'Next' }).click()

    await expect(drawer.getByText('Choose a CSV file')).toBeVisible()
    await expect(drawer.locator('input[type=file]')).toBeFocused()
  })

  test('locks the account actions until the accounts are loaded', async ({ page, mockApi }) => {
    let accountsLoaded = false
    mockApi.on('GET', `${REST}/users/domain/accounts`, () =>
      accountsLoaded ? { json: ACCOUNTS } : { status: 500, json: { error: 'boom' } },
    )
    await page.goto('./users/users')

    const warning = page.getByTestId('users-accounts-warning')
    await expect(warning).toContainText('Cannot retrieve the user accounts')
    await openRowMenu(page, 'a.miller')
    await expect(page.getByTestId('account-restriction-a.miller')).toHaveText(
      "The user accounts are not loaded: passwords, status, names and email addresses can't be changed now.",
    )
    await expect(page.getByRole('menuitem', { name: 'Change password' })).toBeDisabled()
    await expect(page.getByRole('menuitem', { name: 'Delete' })).toBeDisabled()
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Edit a.miller' }).click()
    const drawer = page.getByRole('dialog', { name: 'Edit user a.miller' })
    await expect(drawer.getByTestId('user-status-toggle').getByRole('checkbox')).toBeDisabled()
    for (const field of [/^First name$/, /^Last name$/, /^Email/]) {
      await expect(drawer.getByRole('textbox', { name: field })).toBeDisabled()
    }
    await drawer.getByRole('button', { name: 'Cancel' }).click()
    await expect(drawer.getByRole('button', { name: 'Cancel' })).toBeHidden()

    accountsLoaded = true
    await warning.getByRole('button', { name: 'Retry' }).click()

    await expect(warning).toBeHidden()
    await openRowMenu(page, 'a.miller')
    await expect(page.getByRole('menuitem', { name: 'Change password' })).toBeEnabled()
  })

  test.describe('limited administrator with the Users section', () => {
    test.beforeEach(async ({ page, mockApi }) => {
      await signInAs(page, 'helpdesk')
      mockPermissions(mockApi, ['users'], 'helpdesk')
    })

    test('changes passwords, status, names and deletes users', async ({ page, mockApi }) => {
      await page.goto('./users/users')
      await openRowMenu(page, 'a.miller')
      await page.getByRole('menuitem', { name: 'Change password' }).click()
      const password = page.getByRole('dialog', { name: 'Change password of a.miller' })
      await password.getByLabel('New password').fill('Invented-Pass1!')
      await password.getByLabel('Confirm password').fill('Invented-Pass1!')
      await password.getByRole('button', { name: 'Change', exact: true }).click()
      await expect(
        page.getByTestId('toast-notifications').getByText('Password updated'),
      ).toBeVisible()

      await page.getByRole('button', { name: 'Edit c.davis' }).click()
      const drawer = page.getByRole('dialog', { name: 'Edit user c.davis' })
      await drawer.getByTestId('user-status-toggle').getByText('Enabled').click()
      await drawer.getByRole('textbox', { name: 'Last name' }).fill('Brown')
      await drawer.getByRole('button', { name: 'Save' }).click()
      await expect(page.getByTestId('disabled-badge-c.davis')).toBeVisible()

      await openRowMenu(page, 'a.miller')
      await page.getByRole('menuitem', { name: 'Delete' }).click()
      await page
        .getByRole('dialog', { name: 'Delete user' })
        .getByRole('button', { name: 'Delete', exact: true })
        .click()
      await expect(page.getByTestId('user-a.miller')).toHaveCount(0)

      expect(mockApi.callsTo('PUT', `${REST}/users/a.miller/account/password`)).toHaveLength(1)
      expect(mockApi.callsTo('PATCH', `${REST}/users/c.davis/account`)[0].body).toEqual({
        display_name: 'Christopher Brown',
        locked: true,
      })
      expect(mockApi.callsTo('DELETE', `${REST}/users/a.miller/account`)).toHaveLength(1)
    })

    test('assigns a phone without reading the admin password of the phones', async ({
      page,
      mockApi,
    }) => {
      mockWrites(mockApi)
        .on('GET', '/tancredi/api/v1/defaults', { json: { language: 'it' } })
        .on('POST', `${REST}/physicalextensions`, { json: { extension: '301' } })
        .on('POST', `${REST}/extensions/:ext/srtp/:value`, { status: 200 })
      await page.goto('./users/users')
      await page.getByRole('button', { name: 'Edit c.davis' }).click()

      const drawer = page.getByRole('dialog', { name: 'Edit user c.davis' })
      await drawer.getByRole('button', { name: 'Add phone' }).click()
      await drawer.getByPlaceholder('Choose phone').click()
      await drawer.getByRole('option', { name: /0C:38:3E:00:00:02/ }).click()
      await drawer.getByRole('button', { name: 'Save' }).click()

      await expect(page.getByText('User updated')).toBeVisible()
      const assignments = mockApi.callsTo('POST', `${REST}/physicalextensions`)
      expect(assignments).toHaveLength(1)
      expect(assignments[0].body).toMatchObject({
        mainextension: '301',
        mac: FREE_PHONE_MAC,
        model: 'fanvil-X4U',
        web_user: 'admin',
      })
      expect(assignments[0].body).not.toHaveProperty('web_password')
    })

    test('cannot act on domain administrators nor on the own account', async ({
      page,
      mockApi,
    }) => {
      mockApi.on('GET', `${REST}/users/domain/accounts`, {
        json: [
          ...ACCOUNTS.map((account) =>
            account.username === 'd.jones' ? { ...account, domain_admin: true } : account,
          ),
        ],
      })
      mockApi.on('GET', `${REST}/users/:all`, {
        json: [
          ...RAW_USERS,
          { ...RAW_USERS[2], id: '15', username: 'helpdesk', displayname: 'Help Desk' },
        ],
      })
      await page.goto('./users/users')

      for (const [username, reason] of [
        [
          'd.jones',
          "You can't change the password of, disable or delete a domain administrator here. Use the Domains and users page of NethServer 8.",
        ],
        [
          'helpdesk',
          "You can't change the password of, disable or delete the account you are signed in with.",
        ],
      ]) {
        await openRowMenu(page, username)
        await expect(page.getByTestId(`account-restriction-${username}`)).toHaveText(reason)
        await expect(page.getByRole('menuitem', { name: 'Change password' })).toBeDisabled()
        await expect(page.getByRole('menuitem', { name: 'Delete' })).toBeDisabled()
        await page.keyboard.press('Escape')

        await page.getByRole('button', { name: `Edit ${username}` }).click()
        const drawer = page.getByRole('dialog', { name: `Edit user ${username}` })
        await expect(drawer.getByTestId('user-status-toggle').getByRole('checkbox')).toBeDisabled()
        await expect(drawer.getByTestId('user-status-helper')).toHaveText(reason)
        for (const field of [/^First name$/, /^Last name$/, /^Email/]) {
          const textbox = drawer.getByRole('textbox', { name: field })
          if (username === 'helpdesk') {
            await expect(textbox).toBeEnabled()
          } else {
            await expect(textbox).toBeDisabled()
          }
        }
        await drawer.getByRole('button', { name: 'Cancel' }).click()
        await expect(drawer.getByRole('button', { name: 'Cancel' })).toBeHidden()
      }

      await openRowMenu(page, 'a.miller')
      await expect(page.getByRole('menuitem', { name: 'Change password' })).toBeEnabled()
      await expect(page.getByTestId('account-restriction-a.miller')).toHaveCount(0)
    })

    test('cannot act on any administrator of the PBX', async ({ page, mockApi }) => {
      mockApi.on('GET', `${REST}/users/domain/accounts`, {
        json: ACCOUNTS.map((account) => ({
          ...account,
          admin_access: ({ 'a.miller': 'sections', 'c.davis': 'superadmin' } as const)[
            account.username as 'a.miller' | 'c.davis'
          ],
        })),
      })
      await page.goto('./users/users')

      for (const [username, reason] of [
        [
          'a.miller',
          'Only the superadmin can change the password of an administrator, disable it or delete it.',
        ],
        [
          'c.davis',
          "You can't change the password of, disable or delete a superadmin or an administrator of another PBX.",
        ],
      ]) {
        await openRowMenu(page, username)
        await expect(page.getByTestId(`account-restriction-${username}`)).toHaveText(reason)
        await expect(page.getByRole('menuitem', { name: 'Change password' })).toBeDisabled()
        await expect(page.getByRole('menuitem', { name: 'Delete' })).toBeDisabled()
        await page.keyboard.press('Escape')

        await page.getByRole('button', { name: `Edit ${username}` }).click()
        const drawer = page.getByRole('dialog', { name: `Edit user ${username}` })
        await expect(drawer.getByTestId('user-status-helper')).toHaveText(reason)
        for (const field of [/^First name$/, /^Last name$/, /^Email/]) {
          await expect(drawer.getByRole('textbox', { name: field })).toBeDisabled()
        }
        await expect(drawer.getByRole('textbox', { name: /^Extension/ })).toBeFocused()
        await drawer.getByRole('button', { name: 'Cancel' }).click()
        await expect(drawer).toBeHidden()
      }

      await openRowMenu(page, 'd.jones')
      await expect(page.getByTestId('account-restriction-d.jones')).toHaveText(
        'Only the superadmin can change the password, the name or the status of a user who is not part of this PBX, or delete it.',
      )
      await expect(page.getByRole('menuitem', { name: 'Delete' })).toBeDisabled()
      await page.keyboard.press('Escape')
      await page.getByRole('button', { name: 'Edit d.jones' }).click()
      const drawer = page.getByRole('dialog', { name: 'Edit user d.jones' })
      for (const field of [/^First name$/, /^Last name$/, /^Email/]) {
        await expect(drawer.getByRole('textbox', { name: field })).toBeDisabled()
      }
      await expect(drawer.getByRole('textbox', { name: /^Extension/ })).toBeEnabled()
    })

    test('leaves the users who are not part of this PBX to the superadmin', async ({
      page,
      mockApi,
    }) => {
      mockApi.on('GET', `${REST}/users/domain/accounts`, {
        json: ACCOUNTS.map((account) => ({ ...account, member: account.username !== 'a.miller' })),
      })
      await page.goto('./users/users')
      await openRowMenu(page, 'a.miller')
      await expect(page.getByTestId('account-restriction-a.miller')).toHaveText(
        'Only the superadmin can change the password, the name or the status of a user who is not part of this PBX, or delete it.',
      )
      await expect(page.getByRole('menuitem', { name: 'Delete' })).toBeDisabled()
      await page.keyboard.press('Escape')
      await openRowMenu(page, 'd.jones')
      await expect(page.getByTestId('account-restriction-d.jones')).toHaveCount(0)
      await expect(page.getByRole('menuitem', { name: 'Delete' })).toBeEnabled()
    })

    test('shows why the server refused to change an administrator', async ({ page, mockApi }) => {
      mockApi.on('PUT', `${REST}/users/:username/account/password`, {
        status: 403,
        json: { code: 'nethvoice_admin', message: 'Only a superadmin can change this account' },
      })
      await page.goto('./users/users')
      await openRowMenu(page, 'a.miller')
      await page.getByRole('menuitem', { name: 'Change password' }).click()

      const drawer = page.getByRole('dialog', { name: 'Change password of a.miller' })
      await drawer.getByLabel('New password').fill('Invented-Pass1!')
      await drawer.getByLabel('Confirm password').fill('Invented-Pass1!')
      await drawer.getByRole('button', { name: 'Change', exact: true }).click()
      await expect(drawer.getByTestId('change-password-error')).toContainText(
        'Only the superadmin can change the password of an administrator, disable it or delete it.',
      )
    })
  })

  test('shows the administrators of the PBX with a badge', async ({ page, mockApi }) => {
    mockApi.on('GET', `${REST}/users/domain/accounts`, {
      json: ACCOUNTS.map((account) => ({
        ...account,
        admin_access: (
          { 'a.miller': 'sections', 'c.davis': 'superadmin', 'd.jones': 'other_instance' } as const
        )[account.username as 'a.miller' | 'c.davis' | 'd.jones'],
      })),
    })
    await page.goto('./users/users')

    await expect(page.getByTestId('admin-badge-a.miller')).toHaveText('Administrator')
    await expect(page.getByTestId('admin-badge-c.davis')).toHaveText('Superadmin')
    await expect(page.getByTestId('admin-badge-d.jones')).toHaveText('Administrator of another PBX')
  })

  test('a superadmin cannot act on domain administrators', async ({ page, mockApi }) => {
    mockApi.on('GET', `${REST}/users/domain/accounts`, {
      json: ACCOUNTS.map((account) => ({ ...account, domain_admin: true })),
    })
    await page.goto('./users/users')
    await openRowMenu(page, 'd.jones')
    await expect(page.getByRole('menuitem', { name: 'Delete' })).toBeDisabled()
    await expect(page.getByTestId('account-restriction-d.jones')).toHaveText(
      "You can't change the password of, disable or delete a domain administrator here. Use the Domains and users page of NethServer 8.",
    )
  })

  test('a superadmin cannot act on superadmins and administrators of another PBX', async ({
    page,
    mockApi,
  }) => {
    mockApi.on('GET', `${REST}/users/domain/accounts`, {
      json: ACCOUNTS.map((account) => ({
        ...account,
        admin_access: ({ 'c.davis': 'superadmin', 'd.jones': 'other_instance' } as const)[
          account.username as 'c.davis' | 'd.jones'
        ],
      })),
    })
    await page.goto('./users/users')

    for (const username of ['c.davis', 'd.jones']) {
      await openRowMenu(page, username)
      await expect(page.getByTestId(`account-restriction-${username}`)).toHaveText(
        "You can't change the password of, disable or delete a superadmin or an administrator of another PBX.",
      )
      await expect(page.getByRole('menuitem', { name: 'Change password' })).toBeDisabled()
      await page.keyboard.press('Escape')

      await page.getByRole('button', { name: `Edit ${username}` }).click()
      const drawer = page.getByRole('dialog', { name: `Edit user ${username}` })
      await expect(drawer.getByTestId('user-status-toggle').getByRole('checkbox')).toBeDisabled()
      await drawer.getByRole('button', { name: 'Cancel' }).click()
      await expect(drawer.getByRole('button', { name: 'Cancel' })).toBeHidden()
    }
  })

  test('a superadmin can act on section administrators', async ({ page, mockApi }) => {
    mockApi.on('GET', `${REST}/users/domain/accounts`, {
      json: ACCOUNTS.map((account) => ({ ...account, admin_access: 'sections' })),
    })
    await page.goto('./users/users')
    await openRowMenu(page, 'a.miller')
    await expect(page.getByRole('menuitem', { name: 'Delete' })).toBeEnabled()
    await expect(page.getByTestId('account-restriction-a.miller')).toHaveCount(0)
  })

  test('an administrator without the Users section gets no access', async ({ page, mockApi }) => {
    await signInAs(page, 'operator')
    mockPermissions(mockApi, ['phones'], 'operator')
    mockApi.allowUnmockedCalls()
    await page.goto('./users/users')

    await expect(page).not.toHaveURL(/\/users\/users$/)
    expect(mockApi.callsTo('GET', `${REST}/users/domain`)).toHaveLength(0)
    expect(mockApi.callsTo('GET', `${REST}/users/domain/accounts`)).toHaveLength(0)
  })

  test.describe('external account provider', () => {
    test.beforeEach(({ mockApi }) => {
      mockUsersApi(mockApi, { domain: { manageable: false, reason: 'external' } })
    })

    test('hides the account controls and explains why', async ({ page, mockApi }) => {
      await page.goto('./users/users')
      const notice = page.getByTestId('users-domain-notice')
      await expect(notice).toContainText('Users are managed in an external account provider')
      await expect(notice).toContainText(
        'Passwords, status, names and email addresses can be changed only there.',
      )
      await expect(page.getByRole('button', { name: 'Status', exact: true })).toHaveCount(0)

      await openRowMenu(page, 'a.miller')
      await expect(page.getByRole('menuitem')).toHaveText([
        'Reassign extension',
        'Remove extension',
      ])
      await page.keyboard.press('Escape')

      await page.getByRole('button', { name: 'Edit a.miller' }).click()
      const drawer = page.getByRole('dialog', { name: 'Edit user a.miller' })
      await expect(drawer.getByRole('textbox', { name: 'Extension' })).toBeFocused()
      await expect(drawer.getByTestId('user-status-toggle')).toHaveCount(0)
      for (const field of ['First name', 'Last name', 'Email']) {
        await expect(
          drawer.getByRole('textbox', { name: field, exact: field === 'First name' }),
        ).toBeDisabled()
      }
      await expect(drawer.getByRole('textbox', { name: 'First name', exact: true })).toHaveValue(
        'Anna',
      )
      await drawer.getByRole('button', { name: 'Cancel' }).click()
      expect(mockApi.callsTo('GET', `${REST}/users/domain/accounts`)).toHaveLength(0)
    })

    test('says up front that users are created in the account provider', async ({
      page,
      mockApi,
    }) => {
      await page.goto('./users/users')
      await page.getByRole('button', { name: 'Create user' }).first().click()
      const drawer = page.getByRole('dialog', { name: 'Create user' })
      const blocked = drawer.getByTestId('user-creation-blocked')
      await expect(blocked).toContainText('Users are managed in an external account provider')
      await expect(blocked).toContainText(
        'Create new users in the account provider, then choose Synchronize users.',
      )
      await expect(drawer.getByRole('button', { name: 'Create', exact: true })).toBeDisabled()
      await expect(drawer.getByRole('textbox', { name: 'Username' })).toBeDisabled()
      expect(mockApi.callsTo('POST', `${REST}/csv/csvimport`)).toHaveLength(0)
    })
  })

  test('warns when the account provider cannot be reached and retries', async ({
    page,
    mockApi,
  }) => {
    let domain: { manageable: boolean; reason: string | null } = {
      manageable: false,
      reason: 'unavailable',
    }
    mockApi.on('GET', `${REST}/users/domain`, () => ({ json: domain }))
    await page.goto('./users/users')
    const notice = page.getByTestId('users-domain-notice')
    await expect(notice).toContainText('Cannot reach the account provider')
    await expect(notice).toContainText(
      "Passwords, status, names and email addresses can't be changed now.",
    )
    domain = { manageable: true, reason: null }
    await notice.getByRole('button', { name: 'Retry' }).click()
    await expect(notice).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Status', exact: true })).toBeVisible()
  })
})

test.describe('assigning physical phones', () => {
  const SECOND_FREE_MAC = '0C-38-3E-00-00-03'
  const created = {
    ...RAW_USERS[2],
    id: '14',
    username: 'e.johnson',
    displayname: 'Emma Johnson',
    default_extension: '305',
    devices: [],
  }

  test.beforeEach(({ signedIn, mockApi }) => {
    void signedIn
    mockUsersApi(mockApi)
    mockUserPhonesApi(mockApi)
    mockWrites(mockApi)
    csvImportMock(mockApi, { status: 200, json: { result: 100 } })
    let imported = false
    mockApi
      .on('GET', `${REST}/users/:all`, () => ({
        json: imported ? [...RAW_USERS, created] : RAW_USERS,
      }))
      .on('POST', `${REST}/csv/csvimport`, () => {
        imported = true
        return { status: 200 }
      })
      .on('GET', `${TANCREDI}/phones`, {
        json: [
          ...TANCREDI_PHONES,
          { mac: SECOND_FREE_MAC, model: 'fanvil-X4U', display_name: 'Fanvil' },
        ],
      })
      .on('POST', `${REST}/physicalextensions`, (request) =>
        (request.body as { mac: string }).mac === SECOND_FREE_MAC
          ? { status: 500, json: { error: 'boom' } }
          : { json: { extension: '91305' } },
      )
      .on('POST', `${REST}/extensions/:ext/srtp/:value`, { status: 200 })
  })

  const fillNewUser = async (page: import('@playwright/test').Page, macs: RegExp[]) => {
    await page.goto('./users/users')
    await page.getByRole('button', { name: 'Create user' }).first().click()
    const drawer = page.getByRole('dialog', { name: 'Create user' })
    await drawer.getByRole('textbox', { name: 'Username' }).fill('e.johnson')
    await drawer.getByRole('textbox', { name: 'First name', exact: true }).fill('Emma')
    await drawer.getByRole('textbox', { name: 'Last name' }).fill('Johnson')
    await drawer.getByLabel('Password', { exact: true }).fill('Secret,123')
    await drawer.getByLabel('Confirm password').fill('Secret,123')
    await expect(drawer.getByText('Assign an extension to add physical phones')).toBeVisible()
    await expect(drawer.getByRole('button', { name: 'Add phone' })).toBeDisabled()
    await drawer.getByRole('textbox', { name: 'Extension' }).fill('305')

    for (const [index, mac] of macs.entries()) {
      await drawer.getByRole('button', { name: 'Add phone' }).click()
      await drawer.getByTestId('user-phone-row').nth(index).getByRole('combobox').click()
      await expect(drawer.getByRole('option', { name: /00:15:65:AB:CD:01/ })).toHaveCount(0)
      await drawer.getByRole('option', { name: mac }).click()
    }
    await drawer.getByRole('button', { name: 'Create' }).click()
    return drawer
  }

  test('assigns the chosen phones after creating the user', async ({ page, mockApi }) => {
    const drawer = await fillNewUser(page, [/0C:38:3E:00:00:02/])

    await expect(page.getByText('User created')).toBeVisible(IMPORT_TIMEOUT)
    await expect(drawer).toBeHidden()
    const assignments = mockApi.callsTo('POST', `${REST}/physicalextensions`)
    expect(assignments).toHaveLength(1)
    expect(assignments[0].body).toMatchObject({
      mainextension: '305',
      mac: FREE_PHONE_MAC,
      model: 'fanvil-X4U',
      web_user: 'admin',
      web_password: 'invented-admin-pw',
    })
    expect(mockApi.callsTo('POST', `${REST}/extensions/91305/srtp/:value`)).toHaveLength(1)
    const order = mockApi.calls.map((call) => call.path)
    expect(order.indexOf(`${REST}/webrtc`)).toBeLessThan(
      order.indexOf(`${REST}/physicalextensions`),
    )
  })

  test('keeps the user and names the phone that could not be assigned', async ({
    page,
    mockApi,
  }) => {
    const drawer = await fillNewUser(page, [/0C:38:3E:00:00:02/, /0C:38:3E:00:00:03/])

    const toasts = page.getByTestId('toast-notifications')
    await expect(toasts.getByText('User created')).toBeVisible(IMPORT_TIMEOUT)
    await expect(drawer).toBeHidden()
    await expect(
      toasts.getByText('Cannot assign phone Fanvil X4U (0C:38:3E:00:00:03)'),
    ).toBeVisible()
    await expect(
      toasts.getByText(
        /These phones are already updated: Fanvil X4U \(0C:38:3E:00:00:02\)\. Assign the missing phones with Edit\.$/,
      ),
    ).toBeVisible()
    expect(
      mockApi
        .callsTo('POST', `${REST}/physicalextensions`)
        .map((call) => (call.body as { mac: string }).mac),
    ).toEqual([FREE_PHONE_MAC, SECOND_FREE_MAC])
    expect(mockApi.callsTo('POST', `${REST}/csv/csvimport`)).toHaveLength(1)
    await expect(page.getByTestId('user-e.johnson')).toBeVisible()
  })

  test('names the phone that could not be assigned while editing a user', async ({
    page,
    mockApi,
  }) => {
    await page.goto('./users/users')
    await page.getByRole('button', { name: 'Edit c.davis' }).click()
    const drawer = page.getByRole('dialog', { name: 'Edit user c.davis' })
    await drawer.getByRole('button', { name: 'Add phone' }).click()
    await drawer.getByTestId('user-phone-row').first().getByRole('combobox').click()
    await drawer.getByRole('option', { name: /0C:38:3E:00:00:03/ }).click()
    await drawer.getByRole('button', { name: 'Save' }).click()

    const failure = drawer.getByTestId('user-save-error')
    await expect(failure).toContainText('Cannot assign phone Fanvil X4U (0C:38:3E:00:00:03)')
    await expect(failure).toBeFocused()
    expect(mockApi.callsTo('POST', `${REST}/physicalextensions`)).toHaveLength(1)
  })

  test('assigns a phone as administrator of the Users section only', async ({ page, mockApi }) => {
    await signInAs(page, 'helpdesk')
    mockPermissions(mockApi, ['users'], 'helpdesk')
    mockApi.on('GET', `${TANCREDI}/defaults`, { json: { language: 'it' } })
    await fillNewUser(page, [/0C:38:3E:00:00:02/])

    await expect(page.getByText('User created')).toBeVisible(IMPORT_TIMEOUT)
    const assignments = mockApi.callsTo('POST', `${REST}/physicalextensions`)
    expect(assignments).toHaveLength(1)
    expect(assignments[0].body).toMatchObject({ mainextension: '305', mac: FREE_PHONE_MAC })
    expect(assignments[0].body).not.toHaveProperty('web_password')
  })
})
