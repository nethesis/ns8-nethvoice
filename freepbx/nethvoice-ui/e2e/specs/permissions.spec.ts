//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { expect, mockPermissions, mockWizardState, test } from '../fixtures/mockApi'
import { mockPhonesApi, TANCREDI } from './phones-data'
import { mockUsersApi, REST } from './users-data'

const MENU_SECTIONS = [
  'Dashboard',
  'Users and groups',
  'Trunks',
  'Routes',
  'Physical phones',
  'Integrations',
  'Settings',
]

test.describe('section permissions', () => {
  test.beforeEach(({ signedIn, mockApi }) => {
    void signedIn
    mockApi.allowUnmockedCalls()
  })

  test('shows every section and the legacy links to superadmin', async ({ page }) => {
    await page.goto('./dashboard')
    const menu = page.getByRole('navigation')

    for (const section of MENU_SECTIONS) {
      await expect(menu.getByRole('link', { name: section, exact: true }).first()).toBeVisible()
    }
    await page.getByRole('button', { name: 'Open account menu' }).click()
    await expect(page.getByRole('menuitem', { name: 'Go to the previous interface' })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: 'Settings' })).toBeVisible()
  })

  test.describe('dashboard only', () => {
    test.beforeEach(({ mockApi }) => {
      mockPermissions(mockApi, ['dashboard'], 'viewer')
      mockApi
        .on('GET', '/freepbx/rest/dashboard/live/extensions', { json: {} })
        .on('GET', '/freepbx/rest/dashboard/live/users', { json: {} })
        .on('GET', '/freepbx/rest/trunks', { json: [] })
        .on('GET', '/freepbx/rest/inboundroutes', { json: { destinations: {}, routes: [] } })
        .on('GET', '/freepbx/rest/users/count', { json: 0 })
        .on('GET', '/freepbx/rest/cti/groups', { json: [] })
        .on('GET', '/freepbx/rest/trunks/count', { json: 0 })
        .on('GET', '/freepbx/rest/inboundroutes/count', { json: 0 })
        .on('GET', '/freepbx/rest/outboundroutes/count', { json: 0 })
    })

    test('shows only the dashboard in the side menu', async ({ page }) => {
      await page.goto('./dashboard')
      const menu = page.getByRole('navigation')

      await expect(menu.getByRole('link', { name: 'Dashboard', exact: true }).first()).toBeVisible()
      for (const section of MENU_SECTIONS.slice(1)) {
        await expect(menu.getByRole('link', { name: section, exact: true })).toHaveCount(0)
      }
    })

    test('redirects a forbidden section to the dashboard and says why', async ({ page }) => {
      for (const path of ['./trunks', './settings', './users/groups', './setup']) {
        await page.goto(path)
        await expect(page).toHaveURL(/\/nethvoice\/dashboard$/)
        await expect(
          page.getByTestId('toast-notifications').getByText('Section not available'),
        ).toBeVisible()
      }
    })

    test('opens the dashboard without a notice', async ({ page }) => {
      await page.goto('./dashboard')

      await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible()
      await expect(
        page.getByTestId('toast-notifications').getByText('Section not available'),
      ).toHaveCount(0)
    })

    test('shows the live data cards', async ({ page, mockApi }) => {
      mockApi
        .on('GET', '/freepbx/rest/dashboard/live/extensions', {
          json: {
            '300': { exten: '300', name: 'Anna Miller', status: 'online', conversations: {} },
          },
        })
        .on('GET', '/freepbx/rest/dashboard/live/users', {
          json: {
            'a.miller': {
              name: 'Anna Miller',
              username: 'a.miller',
              mainPresence: 'online',
              endpoints: {
                mainextension: [{ id: '300' }],
                extension: [{ id: '300', type: 'webrtc' }],
              },
            },
          },
        })
        .on('GET', '/freepbx/rest/trunks', { json: [] })
        .on('GET', '/freepbx/rest/inboundroutes', { json: { destinations: {}, routes: [] } })
      await page.goto('./dashboard')

      await expect(page.getByTestId('presence-card').getByTestId('breakdown-online')).toHaveText(
        '1',
      )
      await expect(page.getByTestId('devices-card').getByTestId('breakdown-webPhone')).toHaveText(
        '1',
      )
      await expect(
        page.getByTestId('counter-callsInProgress').getByTestId('counter-value'),
      ).toHaveText('0')
      await expect(page.getByTestId('trunks-card')).toBeVisible()
      await expect(page.getByTestId('inbound-routes-card')).toBeVisible()
      await expect(page.getByText('Live data not available')).toHaveCount(0)
    })

    test('counts the physical phones without the phones section', async ({ page, mockApi }) => {
      mockApi
        .on('GET', `${TANCREDI}/phones`, {
          status: 403,
          json: { type: 'https://nethesis.github.io/tancredi/problems#forbidden' },
        })
        .on('GET', '/freepbx/rest/dashboard/phones', {
          json: { provisioned: 2, pending: 0, unassigned: 1, failed: 0, unknown: 0, total: 3 },
        })
      await page.goto('./dashboard')

      await expect(
        page.getByTestId('counter-physicalPhones').getByTestId('counter-value'),
      ).toHaveText('3')
      expect(mockApi.callsTo('GET', `${TANCREDI}/phones`)).toHaveLength(0)
    })

    test('hides the legacy wizard and the settings from the account menu', async ({ page }) => {
      await page.goto('./dashboard')
      await page.getByRole('button', { name: 'Open account menu' }).click()

      await expect(page.getByRole('menuitem', { name: 'Sign out' })).toBeVisible()
      await expect(
        page.getByRole('menuitem', { name: 'Go to the previous interface' }),
      ).toHaveCount(0)
      await expect(page.getByRole('menuitem', { name: 'Settings' })).toHaveCount(0)
    })

    test('blocks the app while the setup is not completed', async ({ page, mockApi }) => {
      mockWizardState(mockApi, 3)

      for (const path of ['./dashboard', './setup', './setup/system']) {
        await page.goto(path)
        await expect(page).toHaveURL(/\/nethvoice\/setup-pending$/)
      }
      await expect(page.getByText('Setup not completed')).toBeVisible()
      expect(mockApi.callsTo('POST', '/freepbx/rest/configuration/wizard')).toHaveLength(0)

      await page.getByRole('button', { name: 'Sign out' }).click()
      await expect(page).toHaveURL(/\/nethvoice\/login/)
    })
  })

  test.describe('permissions changed while signed in', () => {
    let permissions: string[] = []

    test.beforeEach(({ mockApi }) => {
      permissions = ['dashboard', 'users', 'trunks']
      mockUsersApi(mockApi).on('GET', '/freepbx/rest/me', () => ({
        json: { username: 'operator', permissions },
      }))
    })

    test('leaves a section that the server refuses and updates the menu', async ({
      page,
      mockApi,
    }) => {
      await page.goto('./users/users')
      await expect(page.getByTestId('user-a.miller')).toBeVisible()

      permissions = ['dashboard', 'trunks']
      mockApi.on('POST', `${REST}/users/sync`, {
        status: 403,
        json: { message: 'Forbidden: missing permission' },
      })
      await page.getByRole('button', { name: 'Actions', exact: true }).click()
      await page.getByRole('menuitem', { name: 'Synchronize users' }).click()

      await expect(page).toHaveURL(/\/nethvoice\/dashboard$/)
      await expect(page.getByRole('link', { name: 'Users and groups', exact: true })).toHaveCount(0)
      await expect(page.getByRole('link', { name: 'Trunks', exact: true })).toBeVisible()
      await expect(
        page.getByTestId('toast-notifications').getByText('Section not available'),
      ).toBeVisible()
    })

    test('reads the permissions again when the window is shown again', async ({ page }) => {
      await page.clock.install()
      await page.goto('./users/users')
      await expect(page.getByTestId('user-a.miller')).toBeVisible()
      await expect(page.getByRole('link', { name: 'Trunks', exact: true })).toBeVisible()

      permissions = ['dashboard', 'users']
      await page.clock.fastForward(61_000)
      await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))

      await expect(page.getByRole('link', { name: 'Trunks', exact: true })).toHaveCount(0)
      await expect(page).toHaveURL(/\/nethvoice\/users\/users$/)
    })
  })

  test('opens the first allowed section after sign in', async ({ page, mockApi }) => {
    mockPermissions(mockApi, ['routes', 'trunks'], 'operator')
    await page.goto('./')

    await expect(page).toHaveURL(/\/nethvoice\/trunks/)
    await expect(page.getByRole('navigation').getByRole('link', { name: 'Routes' })).toHaveCount(1)
    await expect(
      page.getByTestId('toast-notifications').getByText('Section not available'),
    ).toHaveCount(0)
  })

  test('hides the Visual Plan and FreePBX links from a routes administrator', async ({
    page,
    mockApi,
  }) => {
    mockPermissions(mockApi, ['routes'], 'operator')
    mockApi.on('GET', '/freepbx/rest/inboundroutes', {
      json: {
        destinations: {},
        routes: [{ extension: '0211111', cidnum: '', description: 'Main', destination: '' }],
      },
    })
    await page.goto('./routes/inbound')

    const rows = page.getByRole('grid', { name: 'Inbound routes' }).getByRole('row')
    await expect(rows.nth(1)).toContainText('0211111')
    await expect(page.getByRole('button', { name: /Create route/ })).toHaveCount(0)
    await expect(rows.nth(1).getByRole('button', { name: /Edit/ })).toHaveCount(0)
    await expect(rows.nth(1).getByRole('button', { name: /Open the menu of route/ })).toBeVisible()

    await page.goto('./routes/outbound')
    await expect(page.getByRole('button', { name: 'Advanced settings' })).toHaveCount(0)
    expect(mockApi.callsTo('GET', '/freepbx/rest/login')).toHaveLength(0)
  })

  test('keeps a phones administrator signed in when Tancredi denies a call', async ({
    page,
    mockApi,
  }) => {
    await page.addInitScript(() => {
      localStorage.setItem('secretkey', JSON.stringify({ user: 'operator', hash: 'e2e-secret' }))
    })
    mockPermissions(mockApi, ['phones'], 'operator')
    mockPhonesApi(mockApi)
    mockApi.on('GET', `${TANCREDI}/models`, {
      status: 403,
      json: {
        type: 'https://nethesis.github.io/tancredi/problems#forbidden',
        title: 'Access to resource is forbidden with current client privileges',
      },
    })
    await page.goto('./phones/models')

    await expect(page.getByText('Cannot load models')).toBeVisible()
    await expect(page).toHaveURL(/\/nethvoice\/phones\/models$/)
  })

  test.describe('no sections', () => {
    test.beforeEach(({ mockApi }) => {
      mockPermissions(mockApi, [], 'nobody')
    })

    test('shows the no access page', async ({ page }) => {
      for (const path of ['./dashboard', './trunks', './']) {
        await page.goto(path)
        await expect(page).toHaveURL(/\/nethvoice\/no-access$/)
      }
      await expect(page.getByText('No sections available')).toBeVisible()
      await expect(page.getByRole('navigation').getByRole('link')).toHaveCount(0)
    })
  })

  test('fails closed when the permissions cannot be loaded', async ({ page, mockApi }) => {
    let available = false
    mockApi.on('GET', '/freepbx/rest/me', () =>
      available
        ? { json: { username: 'admin', permissions: ['superadmin'] } }
        : { status: 500, json: { error: 'Internal server error' } },
    )
    await page.goto('./trunks')

    await expect(page).toHaveURL(/\/nethvoice\/no-access$/)
    await expect(page.getByText('Cannot retrieve your permissions')).toBeVisible()
    await expect(page.getByRole('navigation').getByRole('link')).toHaveCount(0)

    available = true
    await page.getByRole('button', { name: 'Retry' }).click()
    await expect(page).toHaveURL(/\/nethvoice\/dashboard$/)
  })
})
