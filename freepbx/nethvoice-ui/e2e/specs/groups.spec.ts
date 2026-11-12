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

  test('filters the groups by name or member', async ({ page, mockApi }) => {
    mockGroups(mockApi)
    await page.goto('./users/groups')

    await page.getByRole('textbox', { name: 'Filter groups' }).fill('carla')
    await expect(rows(page)).toHaveCount(2)
    await expect(rows(page).nth(1)).toContainText('Support')

    await page.getByRole('textbox', { name: 'Filter groups' }).fill('nothing')
    await expect(page.getByText('No groups found')).toBeVisible()
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

    await expect(page.getByText('Cannot load data')).toBeVisible()
    fail = false
    await page.getByRole('button', { name: 'Retry' }).click()
    await expect(rows(page)).toHaveCount(3)
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

  test('edits the members of a group', async ({ page, mockApi }) => {
    mockGroups(mockApi).on('POST', '/freepbx/rest/cti/groups/users/:id', { status: 200 })
    await page.goto('./users/groups')

    await rows(page).nth(1).getByRole('button', { name: 'Edit' }).click()
    await expect(page.getByRole('textbox', { name: 'Name' })).toBeDisabled()
    await page.getByRole('button', { name: 'Remove b.smith' }).click()
    await pickUser(page, 'c.rossi')
    await page.getByRole('button', { name: 'Save' }).click()

    await expect(page.getByRole('heading', { name: 'Edit group', exact: true })).toBeHidden()
    const memberships = mockApi
      .callsTo('POST', '/freepbx/rest/cti/groups/users/:id')
      .map((call) => [call.path, call.body])
    expect(memberships).toEqual([
      ['/freepbx/rest/cti/groups/users/4', { groups: [1, 2] }],
      ['/freepbx/rest/cti/groups/users/3', { groups: [] }],
    ])
  })

  test('deletes a group', async ({ page, mockApi }) => {
    mockGroups(mockApi).on('DELETE', '/freepbx/rest/cti/groups/:id', {
      json: { status: true },
    })
    await page.goto('./users/groups')

    await rows(page).nth(1).getByRole('button', { name: 'Open menu' }).click()
    await page.getByRole('menuitem', { name: 'Delete' }).click()
    await expect(page.getByText('The Sales group will be permanently removed')).toBeVisible()
    await page.getByRole('button', { name: 'Delete' }).click()

    await expect(page.getByText('The Sales group will be permanently removed')).toBeHidden()
    expect(mockApi.callsTo('DELETE', '/freepbx/rest/cti/groups/:id').map((c) => c.path)).toEqual([
      '/freepbx/rest/cti/groups/2',
    ])
  })
})
