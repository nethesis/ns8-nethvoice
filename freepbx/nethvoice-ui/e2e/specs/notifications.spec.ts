//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import type { Page } from '@playwright/test'
import { expect, mockPermissions, test, type MockApi, type MockResponse } from '../fixtures/mockApi'

const LIVE_TRUNKS_PATH = '/api/astproxy/trunks'

const POLL_INTERVAL = 60_000

const trunk = (name: string, status: string, registration = 'registered') => ({
  name,
  status,
  registration,
  conversations: {},
})

const ONLINE = { backup: trunk('backup', 'online') }

const OFFLINE = { backup: trunk('backup', 'offline') }

const toasts = (page: Page) => page.getByTestId('toast-notifications')

const mockLiveTrunks = (mockApi: MockApi, initial: MockResponse) => {
  let response = initial

  mockApi.on('GET', LIVE_TRUNKS_PATH, () => response)
  return (next: MockResponse) => {
    response = next
  }
}

const checksDone = (mockApi: MockApi) => mockApi.callsTo('GET', LIVE_TRUNKS_PATH).length

const nextCheck = async (page: Page, mockApi: MockApi) => {
  const done = checksDone(mockApi)
  await page.clock.runFor(POLL_INTERVAL)
  await expect.poll(() => checksDone(mockApi)).toBeGreaterThan(done)
}

const openDrawer = async (page: Page) => {
  await page.getByRole('button', { name: 'Show notifications' }).click()
  return page.getByRole('dialog').filter({ hasText: 'Notifications' })
}

test.describe('system alerts', () => {
  test.beforeEach(async ({ page, signedIn, mockApi }) => {
    void signedIn
    await page.addInitScript(() => Reflect.set(window, 'e2eSystemAlerts', true))
    await page.clock.install()
    mockApi.allowUnmockedCalls().on('GET', '/freepbx/rest/settings/languages', {
      json: { it: { default: false }, en: { default: true } },
    })
  })

  test('alerts when a trunk goes down and when it recovers', async ({ page, mockApi }) => {
    const respond = mockLiveTrunks(mockApi, { json: ONLINE })
    await page.goto('./settings')
    await expect.poll(() => checksDone(mockApi)).toBeGreaterThanOrEqual(1)
    await expect(toasts(page).getByText('Trunk unreachable')).toHaveCount(0)

    respond({ json: OFFLINE })
    await nextCheck(page, mockApi)

    await expect(toasts(page).getByText('Trunk unreachable')).toBeVisible()
    await expect(
      toasts(page).getByText('Calls through trunk backup cannot be placed or received.'),
    ).toBeVisible()

    await nextCheck(page, mockApi)
    await expect(toasts(page).getByText('Trunk unreachable')).toHaveCount(0)

    respond({ json: ONLINE })
    await nextCheck(page, mockApi)

    await expect(toasts(page).getByText('Trunk reconnected')).toBeVisible()
    await expect(
      toasts(page).getByText('Calls through trunk backup can be placed and received again.'),
    ).toBeVisible()
  })

  test('alerts once about a trunk already down and keeps the history', async ({
    page,
    mockApi,
  }) => {
    mockLiveTrunks(mockApi, { json: OFFLINE })
    await page.goto('./settings')

    await expect(toasts(page).getByText('Trunk unreachable')).toBeVisible()

    await page.reload()
    await expect.poll(() => checksDone(mockApi)).toBeGreaterThanOrEqual(2)
    await expect(toasts(page).getByText('Trunk unreachable')).toHaveCount(0)

    const drawer = await openDrawer(page)
    await expect(drawer.getByText('Trunk unreachable')).toHaveCount(1)
  })

  test('clears all the notifications', async ({ page, mockApi }) => {
    mockLiveTrunks(mockApi, { json: OFFLINE })
    await page.goto('./settings')
    await expect(toasts(page).getByText('Trunk unreachable')).toBeVisible()

    let drawer = await openDrawer(page)
    await drawer.getByRole('button', { name: 'Clear all' }).click()
    await expect(drawer.getByText('No notifications yet')).toBeVisible()

    await page.reload()
    await expect.poll(() => checksDone(mockApi)).toBeGreaterThanOrEqual(2)
    drawer = await openDrawer(page)
    await expect(drawer.getByText('No notifications yet')).toBeVisible()
  })

  test('alerts when the live data cannot be loaded twice in a row', async ({ page, mockApi }) => {
    const respond = mockLiveTrunks(mockApi, { status: 503 })
    await page.goto('./settings')
    await expect.poll(() => checksDone(mockApi)).toBeGreaterThanOrEqual(1)
    await expect(toasts(page).getByText('Cannot load live data')).toHaveCount(0)

    await nextCheck(page, mockApi)
    await expect(toasts(page).getByText('Cannot load live data')).toBeVisible()
    await expect(
      toasts(page).getByText('The service is not reachable at the moment. Try again shortly.'),
    ).toBeVisible()

    respond({ json: ONLINE })
    await nextCheck(page, mockApi)
    await expect(toasts(page).getByText('Live data restored')).toBeVisible()
  })

  test('stays silent when the account cannot read the live data', async ({ page, mockApi }) => {
    mockLiveTrunks(mockApi, { status: 403, json: { message: 'Forbidden' } })
    await page.goto('./settings')
    await expect.poll(() => checksDone(mockApi)).toBeGreaterThanOrEqual(1)
    const done = checksDone(mockApi)

    await page.clock.runFor(POLL_INTERVAL * 3)

    expect(checksDone(mockApi)).toBe(done)
    await expect(toasts(page).getByText('Cannot load live data')).toHaveCount(0)
  })

  test('does not check the live data for an account other than admin', async ({
    page,
    mockApi,
  }) => {
    await page.addInitScript(() => {
      localStorage.setItem('secretkey', JSON.stringify({ user: 'operator', hash: 'e2e-secret' }))
    })
    mockPermissions(mockApi, ['trunks', 'settings'], 'operator')
    mockLiveTrunks(mockApi, { json: ONLINE })
    await page.goto('./settings')
    await expect(page).toHaveURL(/\/nethvoice\/settings$/)

    await page.clock.runFor(POLL_INTERVAL * 2)

    expect(checksDone(mockApi)).toBe(0)
  })

  test('warns once when the extension limit is reached', async ({ page, mockApi }) => {
    mockLiveTrunks(mockApi, { json: ONLINE })
    mockApi.on('GET', '/freepbx/rest/mainextensions/userlimits', {
      json: { configured: 8, limit: 8, configurable: 0 },
    })
    await page.goto('./settings')

    await expect(toasts(page).getByText('Extension limit reached')).toBeVisible()

    await page.reload()
    await expect.poll(() => checksDone(mockApi)).toBeGreaterThanOrEqual(2)
    await expect(toasts(page).getByText('Extension limit reached')).toHaveCount(0)
  })
})
