//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import type { Page } from '@playwright/test'
import { expect, test, type MockApi } from '../fixtures/mockApi'
import { GROUP_MEMBERS, GROUPS, PBX_USERS } from './groups-data'

const extension = (status: string, extra: Record<string, unknown> = {}) => ({
  status,
  dnd: false,
  cf: '',
  codecs: ['opus', 'alaw'],
  ...extra,
})

const EXTENSIONS = {
  '300': extension('online'),
  '92300': extension('ringing', { cf: '0612345678' }),
  '93300': extension('offline'),
  '301': extension('online', { dnd: true }),
  '302': extension('busy'),
}

const endpointUser = (
  username: string,
  name: string,
  mainPresence: string,
  main: string,
  extensions: { id: string; type: string }[],
) => ({
  name,
  username,
  mainPresence,
  presence: 'online',
  endpoints: { mainextension: main ? [{ id: main }] : [], extension: extensions },
})

const ENDPOINTS = {
  'a.miller': endpointUser('a.miller', 'Anna Miller', 'online', '300', [
    { id: '300', type: 'webrtc' },
    { id: '92300', type: 'mobile' },
    { id: '93300', type: 'physical' },
  ]),
  'b.smith': endpointUser('b.smith', 'Bob Smith', 'dnd', '301', [{ id: '301', type: 'webrtc' }]),
  'c.rossi': endpointUser('c.rossi', 'Carla Rossi', 'busy', '302', [{ id: '302', type: 'webrtc' }]),
  'd.bianchi': endpointUser('d.bianchi', 'Dario Bianchi', 'offline', '', []),
}

const mockOverview = (mockApi: MockApi, endpoints: object = ENDPOINTS) =>
  mockApi
    .on('GET', '/api/astproxy/extensions', { json: EXTENSIONS })
    .on('GET', '/api/user/endpoints/all', { json: endpoints })
    .on('GET', '/freepbx/rest/users/:all', { json: PBX_USERS })
    .on('GET', '/freepbx/rest/cti/groups', { json: GROUPS })
    .on('GET', '/freepbx/rest/cti/users/groups/:id', (request) => ({
      json: GROUP_MEMBERS[request.path.split('/').pop() ?? ''] ?? [],
    }))

const userCard = (page: Page, username: string) => page.locator(`[data-user="${username}"]`)

test.describe('user overview', () => {
  test.beforeEach(async ({ signedIn }) => {
    void signedIn
  })

  test('shows the users with the live status of their devices', async ({ page, mockApi }) => {
    mockOverview(mockApi)
    await page.goto('./users/overview')

    await expect(page.locator('[data-user]')).toHaveCount(3)
    const anna = userCard(page, 'a.miller')
    await expect(anna).toContainText('Anna Miller')
    await expect(anna).toContainText('Sales')
    await expect(anna.getByRole('listitem')).toHaveText([
      /300\s*Online/,
      /92300\s*Ringing/,
      /93300\s*Offline/,
    ])
    await expect(userCard(page, 'b.smith')).toContainText(/301\s*DND/)
    expect(mockApi.calls.every((call) => call.method === 'GET')).toBe(true)
  })

  test('filters by text, status and group', async ({ page, mockApi }) => {
    mockOverview(mockApi)
    await page.goto('./users/overview')

    await page.getByRole('textbox', { name: 'Filter users' }).fill('92300')
    await expect(page.locator('[data-user]')).toHaveCount(1)
    await page.getByRole('button', { name: 'Reset filters' }).click()
    await expect(page.locator('[data-user]')).toHaveCount(3)

    await page.getByRole('button', { name: 'Open filter Status' }).click()
    await page.getByRole('checkbox', { name: 'Busy' }).check()
    await expect(page.locator('[data-user]')).toHaveCount(1)
    await expect(userCard(page, 'c.rossi')).toBeVisible()
    await page.keyboard.press('Escape')

    await page.getByRole('button', { name: 'Reset filters' }).click()
    await page.getByRole('button', { name: 'Open filter Groups' }).click()
    await page.getByRole('checkbox', { name: 'Sales' }).check()
    await page.keyboard.press('Escape')
    await expect(page.locator('[data-user]')).toHaveCount(2)
    await expect(userCard(page, 'c.rossi')).toBeHidden()
  })

  test('shows the empty state', async ({ page, mockApi }) => {
    mockOverview(mockApi, {})
    await page.goto('./users/overview')

    await expect(page.getByText('No users with an extension')).toBeVisible()
  })

  test('shows a load error and retries', async ({ page, mockApi }) => {
    let fail = true

    mockOverview(mockApi).on('GET', '/api/astproxy/extensions', () =>
      fail
        ? { status: 500, json: { code: 500, message: 'astproxy unavailable' } }
        : { json: EXTENSIONS },
    )
    await page.goto('./users/overview')

    await expect(page.getByText('Cannot load the status of users')).toBeVisible()
    fail = false
    await page.getByRole('button', { name: 'Retry' }).click()
    await expect(page.locator('[data-user]')).toHaveCount(3)
  })

  test('opens the operator details', async ({ page, mockApi }) => {
    mockOverview(mockApi)
    await page.goto('./users/overview')

    await page.getByRole('button', { name: 'Show details of Anna Miller' }).click()
    await expect(page.getByRole('heading', { name: 'Operator details' })).toBeVisible()
    await expect(page.getByText('Fanvil X4U').first()).toBeVisible()
    await expect(page.getByRole('button', { name: 'Call' })).toBeDisabled()
    await expect(page.getByText('opus, alaw')).toBeVisible()

    await page.getByRole('navigation', { name: 'Tabs' }).last().getByText('Mobile app').click()
    await expect(page.getByText('0612345678')).toBeVisible()
  })

  test('switches to the list view', async ({ page, mockApi }) => {
    mockOverview(mockApi)
    await page.goto('./users/overview')

    await page.getByRole('button', { name: 'List view' }).click()
    await expect(page.getByRole('grid', { name: 'User overview' }).getByRole('row')).toHaveCount(4)
    await page.getByRole('button', { name: 'Compact view' }).click()
    await expect(page.locator('li[data-user]')).toHaveCount(3)
  })
})
