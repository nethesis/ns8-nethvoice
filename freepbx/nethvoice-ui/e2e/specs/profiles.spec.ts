//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import type { Page } from '@playwright/test'
import { expect, test, type MockApi } from '../fixtures/mockApi'
import { PBX_USERS } from './groups-data'
import { PROFILES, rawProfile } from './profiles-data'

const USERS = PBX_USERS.map((user) => ({
  ...user,
  profile: { '2': 3, '3': 4, '4': 1 }[user.id] ?? null,
}))

const mockProfiles = (
  mockApi: MockApi,
  profiles: unknown[] = PROFILES,
  limit: number | false = false,
) =>
  mockApi
    .on('GET', '/freepbx/rest/users/:all', { json: USERS })
    .on('GET', '/freepbx/rest/cti/profiles', { json: profiles })
    .on('GET', '/freepbx/rest/mainextensions/userlimits', {
      json: { configured: 3, limit, configurable: limit === false ? false : 5 },
    })

const card = (page: Page, id: number) => page.locator(`[data-profile="${id}"]`)

const toggle = (page: Page, feature: string) =>
  page.locator(`[data-feature="${feature}"] > div > div label`).first()

const drawerHeading = (page: Page, name: string) => page.getByRole('heading', { name, exact: true })

test.describe('profiles', () => {
  test.beforeEach(async ({ signedIn }) => {
    void signedIn
  })

  test('lists the profiles with their users', async ({ page, mockApi }) => {
    mockProfiles(mockApi)
    await page.goto('./users/profiles')

    await expect(card(page, 1)).toContainText('Base profile')
    await expect(card(page, 1)).toContainText('1 user assigned')
    await expect(card(page, 2)).toContainText('No users assigned')
    await expect(card(page, 3)).toContainText('1 user assigned')
    await expect(card(page, 4)).toContainText('Sales team')
    await expect(card(page, 1).getByRole('button', { name: 'Duplicate Base' })).toBeVisible()
    await expect(card(page, 4).getByRole('button', { name: 'Sales team actions' })).toBeVisible()
  })

  test('filters the profiles', async ({ page, mockApi }) => {
    mockProfiles(mockApi)
    await page.goto('./users/profiles')

    await page.getByRole('textbox', { name: 'Filter profiles' }).fill('sales')
    await expect(page.locator('[data-profile]')).toHaveCount(1)
    await page.getByRole('textbox', { name: 'Filter profiles' }).fill('none')
    await expect(page.getByText('No profiles found')).toBeVisible()
  })

  test('shows the empty state', async ({ page, mockApi }) => {
    mockProfiles(mockApi, [])
    await page.goto('./users/profiles')

    await expect(page.getByText('No profiles configured')).toBeVisible()
  })

  test('shows a load error and retries', async ({ page, mockApi }) => {
    let fail = true

    mockProfiles(mockApi).on('GET', '/freepbx/rest/cti/profiles', () =>
      fail ? { status: 500 } : { json: PROFILES },
    )
    await page.goto('./users/profiles')

    await expect(page.getByText('Cannot load data')).toBeVisible()
    fail = false
    await page.getByRole('button', { name: 'Retry' }).click()
    await expect(page.locator('[data-profile]')).toHaveCount(4)
  })

  test('creates a profile from an existing one', async ({ page, mockApi }) => {
    mockProfiles(mockApi)
      .on('POST', '/freepbx/rest/cti/profiles', { json: { id: '5' } })
      .on('POST', '/freepbx/rest/cti/profiles/users/:id', { json: { status: true } })
    await page.goto('./users/profiles')

    await page.getByRole('button', { name: 'Create profile' }).click()
    await page.getByRole('menuitem', { name: 'Standard' }).click()
    await expect(page.getByRole('textbox', { name: 'Name' })).toHaveValue('Standard (copy)')
    await page.getByRole('textbox', { name: 'Name' }).fill('Marketing')
    await page.getByRole('combobox', { name: 'Assign users' }).click()
    await page.getByRole('option', { name: /b\.smith.*Now in Sales team/ }).click()
    await drawerHeading(page, 'Create profile').click()
    await toggle(page, 'settings.call_forward').click()
    await page.getByRole('button', { name: 'Create', exact: true }).click()

    await expect(drawerHeading(page, 'Create profile')).toBeHidden()
    const [created] = mockApi.callsTo('POST', '/freepbx/rest/cti/profiles')
    const expected = rawProfile(2, 'Standard')
    expected.macro_permissions.settings.permissions[1].value = true

    expect(created.body).toEqual({
      name: 'Marketing',
      macro_permissions: Object.fromEntries(
        Object.entries(expected.macro_permissions).map(([name, macro]) => [
          name,
          { value: macro.value, permissions: macro.permissions },
        ]),
      ),
      outbound_routes_permissions: expected.outbound_routes_permissions,
    })
    expect(
      mockApi.callsTo('POST', '/freepbx/rest/cti/profiles/users/:id').map((c) => [c.path, c.body]),
    ).toEqual([['/freepbx/rest/cti/profiles/users/3', { profile_id: 5 }]])
  })

  test('validates the name of a new profile', async ({ page, mockApi }) => {
    mockProfiles(mockApi)
    await page.goto('./users/profiles')

    await card(page, 1).getByRole('button', { name: 'Duplicate Base' }).click()
    await page.getByRole('textbox', { name: 'Name' }).fill('standard')
    await page.getByRole('button', { name: 'Create', exact: true }).click()
    await expect(page.getByText('A profile with this name already exists')).toBeVisible()

    await page.getByRole('textbox', { name: 'Name' }).fill(' ')
    await page.getByRole('button', { name: 'Create', exact: true }).click()
    await expect(page.getByText('Enter a name for the profile')).toBeVisible()
    expect(mockApi.callsTo('POST', '/freepbx/rest/cti/profiles')).toHaveLength(0)
  })

  test('edits permissions and moves removed users to Base', async ({ page, mockApi }) => {
    mockProfiles(mockApi)
      .on('POST', '/freepbx/rest/cti/profiles/:id', { json: { status: true } })
      .on('POST', '/freepbx/rest/cti/profiles/users/:id', { json: { status: true } })
    await page.goto('./users/profiles')

    await card(page, 3).getByRole('button', { name: 'Edit Advanced' }).click()
    await expect(drawerHeading(page, 'Edit Advanced profile')).toBeVisible()
    await page.getByRole('button', { name: 'Remove a.miller' }).click()
    await expect(page.getByText('Users will be moved to Base profile')).toBeVisible()

    await toggle(page, 'settings.call_forward').click()
    await page.getByRole('button', { name: 'Outbound calling' }).click()
    await toggle(page, 'route.2').click()
    await page.getByRole('button', { name: 'Save' }).click()

    await expect(drawerHeading(page, 'Edit Advanced profile')).toBeHidden()
    const [update] = mockApi.callsTo('POST', '/freepbx/rest/cti/profiles/:id')
    expect(update.path).toBe('/freepbx/rest/cti/profiles/3')
    expect(update.body).toMatchObject({
      id: 3,
      macro_permissions: {
        settings: {
          value: true,
          permissions: [
            { name: 'dnd', value: true },
            { name: 'call_forward', value: true },
            { name: 'recording', value: false },
          ],
        },
      },
      outbound_routes_permissions: [
        { route_id: 1, name: 'national_it', permission: true },
        { route_id: 2, name: 'cellphone_it', permission: false },
      ],
    })
    expect(
      mockApi.callsTo('POST', '/freepbx/rest/cti/profiles/users/:id').map((c) => [c.path, c.body]),
    ).toEqual([['/freepbx/rest/cti/profiles/users/2', { profile_id: 1 }]])
  })

  test('warns about privacy when enabling call recording', async ({ page, mockApi }) => {
    mockProfiles(mockApi)
    await page.goto('./users/profiles')

    await card(page, 2).getByRole('button', { name: 'Edit Standard' }).click()
    await expect(page.getByText('Check privacy regulations')).toBeHidden()
    await toggle(page, 'settings.recording').click()
    await expect(page.getByText('Check privacy regulations')).toBeVisible()
  })

  test('disables the queue manager without a subscription', async ({ page, mockApi }) => {
    mockProfiles(mockApi, PROFILES, 8)
    await page.goto('./users/profiles')

    await card(page, 2).getByRole('button', { name: 'Edit Standard' }).click()
    await page.getByRole('button', { name: 'CTI features' }).click()
    await expect(page.locator('[data-feature="qmanager"] input').first()).toBeDisabled()
    await expect(page.locator('[data-feature="presence_panel"] input').first()).toBeEnabled()
  })

  test('keeps every user of the Base profile', async ({ page, mockApi }) => {
    mockProfiles(mockApi)
    await page.goto('./users/profiles')

    await card(page, 1).getByRole('button', { name: 'Edit Base' }).click()
    await page.getByRole('button', { name: 'Remove c.rossi' }).click()
    await page.getByRole('button', { name: 'Save' }).click()

    await expect(page.getByText('Every user needs a profile')).toBeVisible()
    expect(mockApi.callsTo('POST', '/freepbx/rest/cti/profiles/:id')).toHaveLength(0)
  })

  test('shows the error of a failed save inside the drawer', async ({ page, mockApi }) => {
    mockProfiles(mockApi).on('POST', '/freepbx/rest/cti/profiles/:id', { status: 500 })
    await page.goto('./users/profiles')

    await card(page, 2).getByRole('button', { name: 'Edit Standard' }).click()
    await page.getByRole('button', { name: 'Save' }).click()

    await expect(page.getByText('Cannot save profile')).toBeVisible()
    await expect(drawerHeading(page, 'Edit Standard profile')).toBeVisible()
  })

  test('deletes a profile and moves its users to Base', async ({ page, mockApi }) => {
    mockProfiles(mockApi)
      .on('POST', '/freepbx/rest/cti/profiles/users/:id', { json: { status: true } })
      .on('DELETE', '/freepbx/rest/cti/profiles/:id', { json: { status: true } })
    await page.goto('./users/profiles')

    await card(page, 4).getByRole('button', { name: 'Sales team actions' }).click()
    await page.getByRole('menuitem', { name: 'Delete' }).click()
    await expect(
      page.getByText('The Sales team profile will be permanently removed.'),
    ).toBeVisible()
    await expect(
      page.getByText('The assigned user will be moved to the Base profile.'),
    ).toBeVisible()
    await page.getByRole('button', { name: 'Delete' }).click()

    await expect(page.getByText('The Sales team profile will be permanently removed.')).toBeHidden()
    expect(
      mockApi.calls.filter((call) => call.method !== 'GET').map((c) => [c.method, c.path, c.body]),
    ).toEqual([
      ['POST', '/freepbx/rest/cti/profiles/users/3', { profile_id: 1 }],
      ['DELETE', '/freepbx/rest/cti/profiles/4', null],
    ])
  })
})
