//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import type { Page } from '@playwright/test'
import { expect, test, type MockApi } from '../fixtures/mockApi'
import { GROUP_MEMBERS, GROUPS, PBX_USERS } from './groups-data'

const SESSION_PATH = '/freepbx/rest/adminphone/session'

const SESSION = {
  extension: '770000',
  secret: 'e2e-sip-secret',
  display_name: 'Admin (test)',
  sip_host: '127.0.0.1',
  sip_port: 5060,
  cti_host: 'cti.example.org',
  reloading: false,
}

const EXPECTED_CONFIG = Buffer.from(
  'cti.example.org:::770000:e2e-sip-secret:127.0.0.1:5060',
).toString('base64')

const mockOverview = (mockApi: MockApi) =>
  mockApi
    .on('GET', '/api/astproxy/extensions', { json: { '300': { status: 'online', codecs: [] } } })
    .on('GET', '/api/user/endpoints/all', {
      json: {
        'a.miller': {
          name: 'Anna Miller',
          username: 'a.miller',
          mainPresence: 'online',
          presence: 'online',
          endpoints: { mainextension: [{ id: '300' }], extension: [{ id: '300', type: 'webrtc' }] },
        },
      },
    })
    .on('GET', '/freepbx/rest/users/:all', { json: PBX_USERS })
    .on('GET', '/freepbx/rest/cti/groups', { json: GROUPS })
    .on('GET', '/freepbx/rest/cti/users/groups/:id', (request) => ({
      json: GROUP_MEMBERS[request.path.split('/').pop() ?? ''] ?? [],
    }))

const phoneStatus = (page: Page) => page.getByTestId('admin-phone-status')

const island = (page: Page) => page.getByTestId('phone-island-stub')

test.describe('administrator phone', () => {
  test.beforeEach(async ({ signedIn }) => {
    void signedIn
  })

  test('enables and disables the phone from the top bar', async ({ page, mockApi }) => {
    mockApi.allowUnmockedCalls().on('POST', SESSION_PATH, { json: SESSION })
    await page.goto('./dashboard')

    await expect(phoneStatus(page)).toHaveText(/Phone disabled/)
    await expect(island(page)).toHaveCount(0)

    await page.getByRole('button', { name: 'Enable phone' }).click()

    await expect(phoneStatus(page)).toHaveText('Phone ready, extension 770000')
    await expect(island(page)).toHaveAttribute('data-config', EXPECTED_CONFIG)
    await expect(island(page)).toHaveAttribute('data-display-name', 'Admin (test)')
    await expect(page.getByText('Calls to external numbers').first()).toBeVisible()
    expect(mockApi.callsTo('POST', SESSION_PATH)).toHaveLength(1)
    expect(
      await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage })),
    ).not.toContain('e2e-sip-secret')

    await page.mouse.move(0, 400)
    await page.getByRole('button', { name: 'Disable phone' }).hover()
    await expect(page.getByRole('tooltip', { name: 'Phone ready, extension 770000' })).toBeVisible()

    await page.getByRole('button', { name: 'Disable phone' }).click()
    await expect(island(page)).toHaveCount(0)
    await expect(phoneStatus(page)).toHaveText(/Phone disabled/)
  })

  test('shows why the phone cannot be enabled', async ({ page, mockApi }) => {
    mockApi.allowUnmockedCalls().on('POST', SESSION_PATH, {
      status: 500,
      json: { message: 'Cannot prepare the administrator phone' },
    })
    await page.goto('./dashboard')

    await page.getByRole('button', { name: 'Enable phone' }).click()

    await expect(phoneStatus(page)).toHaveText(
      'Cannot enable the phone: Cannot prepare the administrator phone',
    )
    await expect(island(page)).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Enable phone' })).toBeVisible()
  })

  test('shows a lost connection', async ({ page, mockApi }) => {
    await page.addInitScript(() => Reflect.set(window, 'phoneIslandStubFailure', true))
    mockApi.allowUnmockedCalls().on('POST', SESSION_PATH, { json: SESSION })
    await page.goto('./dashboard')

    await page.getByRole('button', { name: 'Enable phone' }).click()

    await expect(phoneStatus(page)).toHaveText(
      'The phone cannot connect to the PBX and keeps trying',
    )
    await expect(page.getByRole('button', { name: 'Disable phone' })).toBeVisible()
  })

  test('calls the operator from the overview', async ({ page, mockApi }) => {
    mockOverview(mockApi).on('POST', SESSION_PATH, { json: SESSION })
    await page.goto('./users/overview')

    await page.getByRole('button', { name: 'Show details of Anna Miller' }).click()
    const callButton = page.getByRole('button', { name: 'Call' })

    await callButton.hover()
    await expect(page.getByRole('tooltip', { name: 'Enable the phone and call 300' })).toBeVisible()

    await callButton.click()

    await expect(island(page)).toHaveAttribute('data-calls', '300')
    await expect(phoneStatus(page)).toHaveText('Call in progress, extension 770000')
    await expect(callButton).toBeDisabled()
    expect(mockApi.callsTo('POST', SESSION_PATH)).toHaveLength(1)

    await page.evaluate(() => window.dispatchEvent(new CustomEvent('phone-island-call-end')))
    await expect(callButton).toBeEnabled()
    await callButton.click()
    await expect(island(page)).toHaveAttribute('data-calls', '300,300')
    expect(mockApi.callsTo('POST', SESSION_PATH)).toHaveLength(1)
  })

  test('regenerates the credentials from the account menu', async ({ page, mockApi }) => {
    mockApi
      .allowUnmockedCalls()
      .on('GET', '/freepbx/rest/adminphone', { json: { enabled: true, extension: '770000' } })
      .on('POST', '/freepbx/rest/adminphone/rotate', { status: 204 })
    await page.goto('./dashboard')

    await page.getByRole('button', { name: 'Open account menu' }).click()
    await page.getByRole('menuitem', { name: 'Regenerate phone credentials' }).click()

    await expect(page.getByText('Phone credentials regenerated').first()).toBeVisible()
    expect(mockApi.callsTo('POST', '/freepbx/rest/adminphone/rotate')).toHaveLength(1)
    expect(mockApi.callsTo('POST', SESSION_PATH)).toHaveLength(0)
  })

  test('hides the credentials action without an administrator phone', async ({ page, mockApi }) => {
    mockApi.allowUnmockedCalls()
    await page.goto('./dashboard')

    await page.getByRole('button', { name: 'Open account menu' }).click()
    await expect(page.getByRole('menuitem', { name: 'Sign out' })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: 'Regenerate phone credentials' })).toHaveCount(
      0,
    )
  })
})
