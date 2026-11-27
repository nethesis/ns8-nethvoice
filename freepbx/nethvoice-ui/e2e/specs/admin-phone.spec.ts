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

const RENEWED_CONFIG = Buffer.from(
  'cti.example.org:::770000:e2e-renewed-secret:127.0.0.1:5060',
).toString('base64')

const mockOverview = (mockApi: MockApi) =>
  mockApi
    .on('GET', '/freepbx/rest/dashboard/live/extensions', {
      json: { '300': { status: 'online', codecs: [] } },
    })
    .on('GET', '/freepbx/rest/dashboard/live/users', {
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
    .on('GET', '/tancredi/api/v1/models', {
      json: [{ name: 'fanvil-X4U', display_name: 'Fanvil X4U Pro' }],
    })
    .on('GET', '/freepbx/rest/cti/groups', { json: GROUPS })
    .on('GET', '/freepbx/rest/cti/users/groups/:id', (request) => ({
      json: GROUP_MEMBERS[request.path.split('/').pop() ?? ''] ?? [],
    }))

const island = (page: Page) => page.getByTestId('phone-island-stub')

test.describe('administrator phone', () => {
  test.beforeEach(async ({ signedIn }) => {
    void signedIn
  })

  test('registers the phone automatically and stops it on sign out', async ({ page, mockApi }) => {
    mockApi.allowUnmockedCalls()
    await page.goto('./dashboard')

    await expect(island(page)).toHaveAttribute('data-config', EXPECTED_CONFIG)
    await expect(island(page)).toHaveAttribute('data-display-name', 'Admin (test)')
    expect(mockApi.callsTo('POST', SESSION_PATH)).toHaveLength(1)
    await expect(page.getByRole('button', { name: /Enable phone|Disable phone/ })).toHaveCount(0)
    expect(
      await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage })),
    ).not.toContain('e2e-sip-secret')

    await page.getByRole('button', { name: 'Open account menu' }).click()
    await page.getByRole('menuitem', { name: 'Sign out' }).click()
    await expect(page).toHaveURL(/\/login/)
    await expect(island(page)).toHaveCount(0)
  })

  test('explains why the phone cannot connect', async ({ page, mockApi }) => {
    mockOverview(mockApi).on('POST', SESSION_PATH, {
      status: 500,
      json: { message: 'Cannot prepare the administrator phone' },
    })
    await page.goto('./users/overview')

    await page.getByRole('button', { name: 'Show details of Anna Miller' }).click()
    await page.getByRole('button', { name: 'Call', exact: true }).hover()

    await expect(
      page.getByRole('tooltip', {
        name: 'Cannot connect the phone: The server could not complete the request (error 500). Try again later. Call again to retry.',
      }),
    ).toBeVisible()
    await expect(island(page)).toHaveCount(0)
  })

  test('shows a lost connection', async ({ page, mockApi }) => {
    await page.addInitScript(() => Reflect.set(window, 'phoneIslandStubFailure', true))
    mockOverview(mockApi)
    await page.goto('./users/overview')

    await page.getByRole('button', { name: 'Show details of Anna Miller' }).click()

    await expect(page.getByTestId('call-disabled-reason')).toHaveText(
      'The phone cannot connect to the PBX and keeps trying',
    )
    await expect(page.getByRole('button', { name: 'Call', exact: true })).toBeDisabled()
  })

  test('asks for new credentials when the old ones are refused', async ({ page, mockApi }) => {
    await page.addInitScript(
      (config) => Reflect.set(window, 'phoneIslandStubRejectedConfig', config),
      EXPECTED_CONFIG,
    )
    let sessions = 0
    mockOverview(mockApi).on('POST', SESSION_PATH, () => {
      sessions += 1
      return {
        json: { ...SESSION, secret: sessions === 1 ? SESSION.secret : 'e2e-renewed-secret' },
      }
    })
    await page.goto('./users/overview')

    await expect(island(page)).toHaveAttribute('data-config', RENEWED_CONFIG)
    expect(mockApi.callsTo('POST', SESSION_PATH)).toHaveLength(2)

    await page.getByRole('button', { name: 'Show details of Anna Miller' }).click()
    const callButton = page.getByRole('button', { name: 'Call', exact: true })
    await expect(callButton).toBeEnabled()
    await callButton.click()
    await expect(island(page)).toHaveAttribute('data-calls', '300')
    expect(mockApi.callsTo('POST', SESSION_PATH)).toHaveLength(2)
  })

  test('calls the operator from the overview', async ({ page, mockApi }) => {
    mockOverview(mockApi)
    await page.goto('./users/overview')

    await page.getByRole('button', { name: 'Show details of Anna Miller' }).click()
    const callButton = page.getByRole('button', { name: 'Call', exact: true })

    await callButton.hover()
    await expect(
      page.getByRole('tooltip', { name: 'Call 300 from the administrator phone' }),
    ).toBeVisible()

    await callButton.click()

    await expect(island(page)).toHaveAttribute('data-calls', '300')
    await expect(callButton).toBeDisabled()

    await page.evaluate(() => window.dispatchEvent(new CustomEvent('phone-island-call-end')))
    await expect(callButton).toBeEnabled()
    await callButton.click()
    await expect(island(page)).toHaveAttribute('data-calls', '300,300')
    expect(mockApi.callsTo('POST', SESSION_PATH)).toHaveLength(1)
  })

  test('moves the phone to the last opened tab and back on request', async ({ page, mockApi }) => {
    mockOverview(mockApi)
    await page.goto('./users/overview')
    await expect(island(page)).toHaveCount(1)

    const second = await page.context().newPage()
    await mockApi.install(second)
    await second.goto('./users/overview')

    await expect(island(second)).toHaveCount(1)
    await expect(island(page)).toHaveCount(0)

    await page.getByRole('button', { name: 'Show details of Anna Miller' }).click()
    await page.getByRole('button', { name: 'Use the phone in this tab' }).click()

    await expect(island(page)).toHaveCount(1)
    await expect(island(second)).toHaveCount(0)

    await second.reload()

    await expect(island(second)).toHaveCount(1)
    await expect(island(page)).toHaveCount(0)
    await second.close()
  })

  test('takes the phone back and calls from a number in another tab', async ({ page, mockApi }) => {
    mockOverview(mockApi).on('POST', SESSION_PATH, { json: SESSION })
    await page.goto('./users/overview')
    await expect(island(page)).toHaveCount(1)

    const second = await page.context().newPage()
    await mockApi.install(second)
    await second.goto('./users/overview')
    await expect(island(page)).toHaveCount(0)

    await page.getByRole('button', { name: 'Call 300', exact: true }).click()

    await expect(island(page)).toHaveAttribute('data-calls', '300')
    await expect(island(second)).toHaveCount(0)
    await second.close()
  })

  test('does not take the phone from a tab in a call', async ({ page, mockApi }) => {
    mockOverview(mockApi).on('POST', SESSION_PATH, { json: SESSION })
    await page.goto('./users/overview')
    await page.getByRole('button', { name: 'Call 300', exact: true }).click()
    await expect(island(page)).toHaveAttribute('data-calls', '300')

    const second = await page.context().newPage()
    await mockApi.install(second)
    await second.goto('./users/overview')
    await second.getByRole('button', { name: 'Show details of Anna Miller' }).click()

    await expect(second.getByTestId('call-disabled-reason')).toHaveText(
      'The administrator phone is in a call in another tab',
    )
    await expect(second.getByRole('button', { name: 'Call', exact: true })).toBeDisabled()
    await expect(second.getByRole('button', { name: 'Use the phone in this tab' })).toHaveCount(0)
    await expect(island(page)).toHaveAttribute('data-calls', '300')
    await expect(island(second)).toHaveCount(0)

    await island(page).getByRole('button', { name: 'Hang up' }).click()

    await expect(island(second)).toHaveCount(1)
    await expect(island(page)).toHaveCount(0)
    await second.close()
  })

  test('explains a call in progress before the status of the devices', async ({
    page,
    mockApi,
  }) => {
    mockOverview(mockApi)
      .on('GET', '/freepbx/rest/dashboard/live/extensions', {
        json: { '300': { status: 'online', codecs: [] }, '301': { status: 'busy', codecs: [] } },
      })
      .on('GET', '/freepbx/rest/dashboard/live/users', {
        json: {
          'a.miller': {
            name: 'Anna Miller',
            username: 'a.miller',
            mainPresence: 'online',
            presence: 'online',
            endpoints: {
              mainextension: [{ id: '300' }],
              extension: [{ id: '300', type: 'webrtc' }],
            },
          },
          'b.smith': {
            name: 'Bob Smith',
            username: 'b.smith',
            mainPresence: 'busy',
            presence: 'busy',
            endpoints: {
              mainextension: [{ id: '301' }],
              extension: [{ id: '301', type: 'webrtc' }],
            },
          },
        },
      })
      .on('POST', SESSION_PATH, { json: SESSION })
    await page.goto('./users/overview')
    await page.getByRole('button', { name: 'Call 300', exact: true }).click()
    await expect(island(page)).toHaveAttribute('data-calls', '300')

    await page.getByRole('button', { name: 'Show details of Bob Smith' }).click()
    await expect(page.getByTestId('call-disabled-reason')).toHaveText(
      'A call is already in progress',
    )

    const second = await page.context().newPage()
    await mockApi.install(second)
    await second.goto('./users/overview')
    await second.getByRole('button', { name: 'Show details of Bob Smith' }).click()
    await expect(second.getByTestId('call-disabled-reason')).toHaveText(
      'The administrator phone is in a call in another tab',
    )

    await island(page).getByRole('button', { name: 'Hang up' }).click()
    await expect(page.getByTestId('call-disabled-reason')).toHaveText('No device online to call')
    await expect(page.getByRole('button', { name: 'Call', exact: true })).toBeDisabled()
    await second.close()
  })

  test('resumes the phone after a reload', async ({ page, mockApi }) => {
    mockOverview(mockApi)
    await page.goto('./users/overview')
    await expect(island(page)).toHaveCount(1)

    await page.reload()

    await expect(island(page)).toHaveCount(1)
    await expect(page.getByRole('button', { name: 'Use the phone in this tab' })).toHaveCount(0)
  })

  test('keeps the phone usable while the operator details are open', async ({ page, mockApi }) => {
    mockOverview(mockApi).on('POST', SESSION_PATH, { json: SESSION })
    await page.goto('./users/overview')

    await page.getByRole('button', { name: 'Show details of Anna Miller' }).click()
    const callButton = page.getByRole('button', { name: 'Call', exact: true })
    await callButton.click()
    await expect(callButton).toBeDisabled()

    await island(page).getByRole('button', { name: 'Hang up' }).click()

    await expect(callButton).toBeEnabled()
    await expect(page.getByRole('heading', { name: 'Operator details' })).toBeVisible()
  })

  test('calls an online device from its number in the card', async ({ page, mockApi }) => {
    mockOverview(mockApi)
      .on('GET', '/freepbx/rest/dashboard/live/extensions', {
        json: {
          '91300': { status: 'online', codecs: [] },
          '92300': { status: 'offline', codecs: [] },
          '93300': { status: 'busy', codecs: [] },
        },
      })
      .on('GET', '/freepbx/rest/dashboard/live/users', {
        json: {
          'a.miller': {
            name: 'Anna Miller',
            username: 'a.miller',
            mainPresence: 'online',
            presence: 'online',
            endpoints: {
              mainextension: [{ id: '300' }],
              extension: [
                { id: '91300', type: 'webrtc' },
                { id: '92300', type: 'mobile' },
                { id: '93300', type: 'physical' },
              ],
            },
          },
        },
      })
      .on('POST', SESSION_PATH, { json: SESSION })
    await page.goto('./users/overview')

    await expect(page.getByRole('button', { name: /92300/ })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /93300/ })).toHaveCount(0)
    await expect(page.getByTestId('call-number-text')).toHaveText(['92300', '93300'])

    await page.getByRole('button', { name: 'Call 91300', exact: true }).click()

    await expect(island(page)).toHaveAttribute('data-calls', '91300')
  })

  test('calls a single online device from the call menu', async ({ page, mockApi }) => {
    mockOverview(mockApi)
      .on('GET', '/freepbx/rest/dashboard/live/extensions', {
        json: {
          '300': { status: 'online', codecs: [] },
          '91300': { status: 'online', codecs: [] },
          '92300': { status: 'offline', codecs: [] },
        },
      })
      .on('GET', '/freepbx/rest/dashboard/live/users', {
        json: {
          'a.miller': {
            name: 'Anna Miller',
            username: 'a.miller',
            mainPresence: 'online',
            presence: 'online',
            endpoints: {
              mainextension: [{ id: '300' }],
              extension: [
                { id: '91300', type: 'webrtc' },
                { id: '92300', type: 'mobile' },
              ],
            },
          },
        },
      })
      .on('POST', SESSION_PATH, { json: SESSION })
    await page.goto('./users/overview')

    await page.getByRole('button', { name: 'Show details of Anna Miller' }).click()
    await page.getByRole('button', { name: 'Call a device' }).click()

    await expect(page.getByRole('menuitem')).toHaveText(['91300'])
    await page.getByRole('menuitem', { name: '91300' }).click()

    await expect(island(page)).toHaveAttribute('data-calls', '91300')
  })
})
