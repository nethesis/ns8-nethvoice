//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import type { Page } from '@playwright/test'
import { expect, test, type MockApi } from '../fixtures/mockApi'
import { GROUP_MEMBERS, GROUPS, PBX_USERS, USER_GROUPS } from './groups-data'

const mockGroups = (mockApi: MockApi, groups = GROUPS) =>
  mockApi
    .on('GET', '/freepbx/rest/users/:all', { json: PBX_USERS })
    .on('GET', '/freepbx/rest/cti/groups', { json: groups })
    .on('GET', '/freepbx/rest/cti/users/groups/:id', (request) => ({
      json: GROUP_MEMBERS[request.path.split('/').pop() ?? ''] ?? [],
    }))
    .on('GET', '/freepbx/rest/cti/groups/users/:id', (request) => ({
      json: USER_GROUPS[request.path.split('/').pop() ?? ''] ?? [],
    }))

const rows = (page: Page) => page.getByRole('grid', { name: 'Groups' }).getByRole('row')

const pickUser = async (page: Page, username: string) => {
  await page.getByRole('combobox', { name: 'Users' }).click()
  await page.getByRole('combobox', { name: 'Users' }).fill(username)
  await page.getByRole('option', { name: new RegExp(username) }).click()
  await page.getByRole('dialog').getByRole('heading').click()
}

test.describe('groups', () => {
  test.beforeEach(async ({ signedIn }) => {
    void signedIn
  })

  test('lists the groups with their members', async ({ page, mockApi }) => {
    mockGroups(mockApi)
    await page.goto('./users/groups')

    await expect(rows(page)).toHaveCount(3)
    await expect(rows(page).nth(1)).toContainText('Sales')
    await expect(rows(page).nth(1)).toContainText('a.miller, b.smith')
    await expect(rows(page).nth(2)).toContainText('Support')
    await expect(rows(page).nth(2)).toContainText('c.rossi')
  })

  test('truncates a long group name and shows it in a tooltip', async ({ page, mockApi }) => {
    const longName = 'Customer success international team of the northern region offices'
    mockGroups(mockApi, [...GROUPS, { id: 3, name: longName }])
    await page.goto('./users/groups')

    const name = rows(page).filter({ hasText: longName }).locator('[data-group-name]')
    await expect(name).toHaveCSS('text-overflow', 'ellipsis')
    expect(await name.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true)
    await name.hover()
    await expect(page.locator('[data-tippy-root]').getByText(longName)).toBeVisible()

    await rows(page).filter({ hasText: 'Support' }).locator('[data-group-name]').hover()
    await expect(page.locator('[data-tippy-root]').getByText('Support')).toBeHidden()
  })

  test('filters the groups by name or member', async ({ page, mockApi }) => {
    mockGroups(mockApi)
    await page.goto('./users/groups')

    await page.getByRole('textbox', { name: 'Filter groups' }).fill('carla')
    await expect(rows(page)).toHaveCount(2)
    await expect(rows(page).nth(1)).toContainText('Support')

    await page.getByRole('textbox', { name: 'Filter groups' }).fill('nothing')
    await expect(page.getByText('No groups found')).toBeVisible()
    await expect(page.getByText('Try different or fewer words.')).toBeVisible()
    await page.getByRole('button', { name: 'Clear filter' }).last().click()
    await expect(page.getByRole('textbox', { name: 'Filter groups' })).toHaveValue('')
    await expect(rows(page)).toHaveCount(3)
  })

  test('shows the empty state', async ({ page, mockApi }) => {
    mockGroups(mockApi, [])
    await page.goto('./users/groups')

    await expect(page.getByText('No groups configured')).toBeVisible()
    await page.getByRole('button', { name: 'Create group' }).click()
    await expect(page.getByRole('heading', { name: 'Create group', exact: true })).toBeVisible()
  })

  test('shows a load error and retries', async ({ page, mockApi }) => {
    let fail = true

    mockGroups(mockApi).on('GET', '/freepbx/rest/cti/groups', () =>
      fail ? { status: 500 } : { json: GROUPS },
    )
    await page.goto('./users/groups')

    await expect(page.getByText('Cannot retrieve groups')).toBeVisible()
    fail = false
    await page.getByRole('button', { name: 'Retry' }).click()
    await expect(rows(page)).toHaveCount(3)
  })

  test('keeps the groups on screen when a refresh fails', async ({ page, mockApi }) => {
    let fail = false

    mockGroups(mockApi).on('GET', '/freepbx/rest/cti/groups', () =>
      fail ? { status: 500 } : { json: GROUPS },
    )
    await page.goto('./users/groups')
    await expect(rows(page)).toHaveCount(3)

    fail = true
    await page.clock.install()
    await page.clock.runFor(60_000)
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))

    await expect(page.getByText('Cannot retrieve groups')).toBeVisible()
    await expect(rows(page)).toHaveCount(3)
  })

  test('wraps a long group name in the cards of a phone screen', async ({ page, mockApi }) => {
    const name = 'Amministrazione contabilita risorse umane sede centrale di Milano'
    mockGroups(mockApi, [{ ...GROUPS[0], name }, ...GROUPS.slice(1)])
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('./users/groups')

    const groupName = page.locator('[data-group-name]').filter({ hasText: name })
    await expect(groupName).toBeVisible()
    expect(await groupName.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
      true,
    )
    expect((await groupName.boundingBox())?.height ?? 0).toBeGreaterThan(30)
  })

  test('creates a group with its members', async ({ page, mockApi }) => {
    mockGroups(mockApi)
      .on('POST', '/freepbx/rest/cti/groups', { json: '5' })
      .on('POST', '/freepbx/rest/cti/groups/users/:id', { status: 200 })
    await page.goto('./users/groups')

    await page.getByRole('button', { name: 'Create group' }).click()
    await page.getByRole('textbox', { name: 'Name' }).fill('  Marketing ')
    await pickUser(page, 'a.miller')
    await pickUser(page, 'c.rossi')
    await page.getByRole('button', { name: 'Create', exact: true }).click()

    await expect(page.getByRole('heading', { name: 'Create group', exact: true })).toBeHidden()
    expect(mockApi.callsTo('POST', '/freepbx/rest/cti/groups')[0].body).toEqual({
      name: 'Marketing',
    })
    const memberships = mockApi
      .callsTo('POST', '/freepbx/rest/cti/groups/users/:id')
      .map((call) => [call.path, call.body])
    expect(memberships).toEqual([
      ['/freepbx/rest/cti/groups/users/2', { groups: [2, 5] }],
      ['/freepbx/rest/cti/groups/users/4', { groups: [1, 5] }],
    ])
  })

  test('validates the name before creating', async ({ page, mockApi }) => {
    mockGroups(mockApi)
    await page.goto('./users/groups')
    await page.getByRole('button', { name: 'Create group' }).click()

    await page.getByRole('button', { name: 'Create', exact: true }).click()
    await expect(page.getByText('Enter a name for the group')).toBeVisible()

    await page.getByRole('textbox', { name: 'Name' }).fill('sales')
    await page.getByRole('button', { name: 'Create', exact: true }).click()
    await expect(page.getByText('A group with this name already exists')).toBeVisible()

    await page.getByRole('textbox', { name: 'Name' }).fill('Sa-les')
    await page.getByRole('button', { name: 'Create', exact: true }).click()
    await expect(page.getByText('A group with the same letters and numbers')).toBeVisible()
    expect(mockApi.callsTo('POST', '/freepbx/rest/cti/groups')).toHaveLength(0)
  })

  test('shows the error of a failed creation inside the drawer', async ({ page, mockApi }) => {
    mockGroups(mockApi).on('POST', '/freepbx/rest/cti/groups', { status: 500 })
    await page.goto('./users/groups')

    await page.getByRole('button', { name: 'Create group' }).click()
    await page.getByRole('textbox', { name: 'Name' }).fill('Marketing')
    await page.getByRole('button', { name: 'Create', exact: true }).click()

    await expect(page.getByText('Cannot create group')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Create group', exact: true })).toBeVisible()
  })

  test('closes the drawer and tells when the users of a new group cannot be added', async ({
    page,
    mockApi,
  }) => {
    mockGroups(mockApi)
      .on('POST', '/freepbx/rest/cti/groups', { json: '5' })
      .on('POST', '/freepbx/rest/cti/groups/users/:id', { status: 500, json: { error: 'boom' } })
    await page.goto('./users/groups')

    await page.getByRole('button', { name: 'Create group' }).click()
    await page.getByRole('textbox', { name: 'Name' }).fill('Marketing')
    await pickUser(page, 'a.miller')
    await page.getByRole('button', { name: 'Create', exact: true }).click()

    await expect(page.getByRole('heading', { name: 'Create group', exact: true })).toBeHidden()
    const toasts = page.getByTestId('toast-notifications')
    await expect(toasts.getByText('Cannot add the users to the group')).toBeVisible()
    await expect(toasts.getByText(/Group Marketing has been created, but not all/)).toBeVisible()
    expect(mockApi.callsTo('POST', '/freepbx/rest/cti/groups')).toHaveLength(1)
  })

  test('edits the members of a group', async ({ page, mockApi }) => {
    mockGroups(mockApi).on('POST', '/freepbx/rest/cti/groups/users/:id', { status: 200 })
    await page.goto('./users/groups')

    await rows(page).nth(1).getByRole('button', { name: 'Edit' }).click()
    await expect(page.getByRole('textbox', { name: 'Name' })).toBeFocused()
    await page.getByRole('button', { name: 'Remove b.smith' }).click()
    await pickUser(page, 'c.rossi')
    await expect(page.getByText('Renaming the group')).toBeHidden()
    await page.getByRole('button', { name: 'Save' }).click()

    await expect(page.getByRole('heading', { name: 'Edit group', exact: true })).toBeHidden()
    const memberships = mockApi
      .callsTo('POST', '/freepbx/rest/cti/groups/users/:id')
      .map((call) => [call.path, call.body])
    expect(memberships).toEqual([
      ['/freepbx/rest/cti/groups/users/4', { groups: [1, 2] }],
      ['/freepbx/rest/cti/groups/users/3', { groups: [] }],
    ])
    expect(mockApi.callsTo('PUT', '/freepbx/rest/cti/groups/:id')).toHaveLength(0)
  })

  test('renames a group and tells that the phonebook sharing follows', async ({
    page,
    mockApi,
  }) => {
    let groups = GROUPS
    mockGroups(mockApi)
      .on('GET', '/freepbx/rest/cti/groups', () => ({ json: groups }))
      .on('PUT', '/freepbx/rest/cti/groups/:id', (request) => {
        groups = groups.map((group) =>
          request.path.endsWith(`/${group.id}`) ? { ...group, name: 'Sales Team' } : group,
        )
        return { json: { id: 2, name: 'Sales Team', phonebook_sources: 1, contacts: 12 } }
      })
    await page.goto('./users/groups')

    await rows(page).nth(1).getByRole('button', { name: 'Edit' }).click()
    const name = page.getByRole('textbox', { name: 'Name' })
    await expect(name).toBeEnabled()
    await expect(page.getByText('Renaming the group')).toBeHidden()
    await name.fill('  Sales Team ')
    await expect(page.getByText('Renaming the group')).toBeVisible()
    await expect(
      page.getByText(
        'Phonebook sources and contacts shared with this group and the operator presence panel of the profiles will use the new name.',
      ),
    ).toBeVisible()
    await name.fill('Sales')
    await expect(page.getByText('Renaming the group')).toBeHidden()
    await name.fill('Sales Team')
    await page.getByRole('button', { name: 'Save' }).click()

    await expect(page.getByRole('heading', { name: 'Edit group', exact: true })).toBeHidden()
    const renames = mockApi
      .callsTo('PUT', '/freepbx/rest/cti/groups/:id')
      .map((call) => [call.path, call.body])
    expect(renames).toEqual([['/freepbx/rest/cti/groups/2', { name: 'Sales Team' }]])
    expect(mockApi.callsTo('POST', '/freepbx/rest/cti/groups/users/:id')).toHaveLength(0)
    await expect(
      page.getByTestId('toast-notifications').getByText('Group Sales Team has been updated.'),
    ).toBeVisible()
    await expect(rows(page).filter({ hasText: 'Sales Team' })).toHaveCount(1)
  })

  test('validates the new name and keeps the drawer open when the rename is refused', async ({
    page,
    mockApi,
  }) => {
    mockGroups(mockApi).on('PUT', '/freepbx/rest/cti/groups/:id', {
      status: 409,
      json: {
        message: 'The group cannot be renamed: The phonebook source custom_3 cannot be written',
        errors: ['The phonebook source custom_3 cannot be written'],
      },
    })
    await page.goto('./users/groups')
    await rows(page).nth(1).getByRole('button', { name: 'Edit' }).click()
    const name = page.getByRole('textbox', { name: 'Name' })

    for (const [value, message] of [
      ['support', 'A group with this name already exists'],
      ['Sup-port', 'A group with the same letters and numbers'],
      ['North, South', 'The name cannot contain commas'],
      ['', 'Enter a name for the group'],
    ]) {
      await name.fill(value)
      await page.getByRole('button', { name: 'Save' }).click()
      await expect(page.getByText(message)).toBeVisible()
      await expect(name).toBeFocused()
    }
    expect(mockApi.callsTo('PUT', '/freepbx/rest/cti/groups/:id')).toHaveLength(0)

    await name.fill('SALES')
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByText('Cannot save group')).toBeVisible()
    await expect(page.getByText(/The phonebook source custom_3 cannot be written/)).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Edit group', exact: true })).toBeVisible()
    expect(mockApi.callsTo('PUT', '/freepbx/rest/cti/groups/:id')[0].body).toEqual({
      name: 'SALES',
    })
    expect(mockApi.callsTo('POST', '/freepbx/rest/cti/groups/users/:id')).toHaveLength(0)
  })

  test('saves the members of a group whose name the new rules refuse', async ({
    page,
    mockApi,
  }) => {
    mockGroups(mockApi, [
      { id: 1, name: 'Support' },
      { id: 2, name: 'North, South' },
    ]).on('POST', '/freepbx/rest/cti/groups/users/:id', { status: 200 })
    await page.goto('./users/groups')

    await rows(page)
      .filter({ hasText: 'North, South' })
      .getByRole('button', { name: 'Edit' })
      .click()
    await page.getByRole('button', { name: 'Remove b.smith' }).click()
    await page.getByRole('button', { name: 'Save' }).click()

    await expect(page.getByRole('heading', { name: 'Edit group', exact: true })).toBeHidden()
    expect(mockApi.callsTo('PUT', '/freepbx/rest/cti/groups/:id')).toHaveLength(0)
    expect(mockApi.callsTo('POST', '/freepbx/rest/cti/groups/users/:id')).toHaveLength(1)
  })

  test('asks before discarding the changes and resets the filter', async ({ page, mockApi }) => {
    mockGroups(mockApi)
    await page.goto('./users/groups')

    await expect(page.getByRole('button', { name: 'Clear filter' })).toBeDisabled()
    await page.getByRole('textbox', { name: 'Filter groups' }).fill('sales')
    await page.getByRole('button', { name: 'Clear filter' }).click()
    await expect(page.getByRole('textbox', { name: 'Filter groups' })).toHaveValue('')

    await page.getByRole('button', { name: 'Create group' }).click()
    await page.getByRole('textbox', { name: 'Name' }).fill('Marketing')
    await page.keyboard.press('Escape')
    await expect(page.getByRole('heading', { name: 'Unsaved changes' })).toBeVisible()
    await page.getByRole('button', { name: 'Keep editing' }).click()
    await expect(page.getByRole('textbox', { name: 'Name' })).toHaveValue('Marketing')

    await page.getByRole('button', { name: 'Close side drawer' }).click()
    await page.getByRole('button', { name: 'Discard changes' }).click()
    await expect(page.getByRole('heading', { name: 'Create group', exact: true })).toBeHidden()
  })

  test('deletes a group', async ({ page, mockApi }) => {
    mockGroups(mockApi).on('DELETE', '/freepbx/rest/cti/groups/:id', {
      json: { status: true },
    })
    await page.goto('./users/groups')

    await rows(page).nth(1).getByRole('button', { name: 'Sales actions' }).click()
    await page.getByRole('menuitem', { name: 'Delete' }).click()
    await expect(page.getByText('Group Sales will be permanently deleted.')).toBeVisible()
    await page.getByRole('button', { name: 'Delete' }).click()

    await expect(page.getByText('Group Sales will be permanently deleted.')).toBeHidden()
    await expect(page.getByText('Group Sales has been deleted.')).toBeVisible()
    expect(mockApi.callsTo('DELETE', '/freepbx/rest/cti/groups/:id').map((c) => c.path)).toEqual([
      '/freepbx/rest/cti/groups/2',
    ])
  })
})
