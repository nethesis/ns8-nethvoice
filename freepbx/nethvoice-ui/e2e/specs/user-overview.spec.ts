//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import type { Page } from '@playwright/test'
import { expect, mockPermissions, test, type MockApi } from '../fixtures/mockApi'
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
    .on('GET', '/freepbx/rest/dashboard/live/extensions', { json: EXTENSIONS })
    .on('GET', '/freepbx/rest/dashboard/live/users', { json: endpoints })
    .on('GET', '/freepbx/rest/users/:all', { json: PBX_USERS })
    .on('GET', '/tancredi/api/v1/models', {
      json: [{ name: 'fanvil-X4U', display_name: 'Fanvil X4U Pro' }],
    })
    .on('GET', '/freepbx/rest/cti/groups', { json: GROUPS })
    .on('GET', '/freepbx/rest/cti/users/groups/:id', (request) => ({
      json: GROUP_MEMBERS[request.path.split('/').pop() ?? ''] ?? [],
    }))

const userCard = (page: Page, username: string) => page.locator(`[data-user="${username}"]`)

const expectDotOnAvatarCorner = async (scope: ReturnType<Page['locator']>, status: string) => {
  const presence = scope.getByTestId('presence-dot').first()
  await expect(presence).toHaveAttribute('title', status)
  const avatar = presence.locator('xpath=..')

  await expect
    .poll(async () => {
      const [avatarBox, dotBox] = await Promise.all([avatar.boundingBox(), presence.boundingBox()])
      if (!avatarBox || !dotBox) {
        return Number.POSITIVE_INFINITY
      }
      return Math.max(
        Math.abs(dotBox.x + dotBox.width - (avatarBox.x + avatarBox.width)),
        Math.abs(dotBox.y + dotBox.height - (avatarBox.y + avatarBox.height)),
        dotBox.width >= avatarBox.width / 2 ? Number.POSITIVE_INFINITY : 0,
      )
    })
    .toBeLessThanOrEqual(3)
}

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

  for (const [account, permissions] of [
    ['operator', ['users']],
    ['boss', ['superadmin']],
  ] as const) {
    test(`shows the live status to ${account} with ${permissions[0]}`, async ({
      page,
      mockApi,
    }) => {
      await page.addInitScript((user) => {
        localStorage.setItem('secretkey', JSON.stringify({ user, hash: 'e2e-secret' }))
      }, account)
      mockPermissions(mockApi, [...permissions], account)
      mockOverview(mockApi)
      await page.goto('./users/overview')

      await expect(userCard(page, 'a.miller').getByRole('listitem')).toHaveText([
        /300\s*Online/,
        /92300\s*Ringing/,
        /93300\s*Offline/,
      ])
      await expect(page.getByText('Live data not available')).toHaveCount(0)
      await expect(page.getByText('Cannot retrieve the status of users')).toHaveCount(0)
    })
  }

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

  test('shows the forwarded users and resets only changed filters', async ({ page, mockApi }) => {
    mockOverview(mockApi, {
      ...ENDPOINTS,
      'c.rossi': endpointUser('c.rossi', 'Carla Rossi', 'callforward', '302', [
        { id: '302', type: 'webrtc' },
      ]),
    })
    await page.goto('./users/overview')

    await expect(page.getByRole('button', { name: 'Reset filters' })).toBeDisabled()
    await expect(userCard(page, 'c.rossi').getByTestId('overview-card-presence')).toHaveText(
      'Call forward',
    )
    await page.getByRole('button', { name: 'Open filter Status' }).click()
    await page.getByRole('checkbox', { name: 'Call forward' }).check()
    await expect(page.locator('[data-user]')).toHaveCount(1)
    await page.keyboard.press('Escape')
    await expect(page.getByRole('button', { name: 'Reset filters' })).toBeEnabled()
  })

  test('shows a load error and retries', async ({ page, mockApi }) => {
    let fail = true

    mockOverview(mockApi).on('GET', '/freepbx/rest/dashboard/live/extensions', () =>
      fail
        ? { status: 503, json: { message: 'The CTI server is not reachable' } }
        : { json: EXTENSIONS },
    )
    await page.goto('./users/overview')

    await expect(page.getByText('Cannot retrieve the status of users')).toBeVisible()
    fail = false
    await page.getByRole('button', { name: 'Retry' }).click()
    await expect(page.locator('[data-user]')).toHaveCount(3)
  })

  test('keeps the users on screen when a refresh fails', async ({ page, mockApi }) => {
    let fail = false

    mockOverview(mockApi).on('GET', '/freepbx/rest/dashboard/live/extensions', () =>
      fail
        ? { status: 503, json: { message: 'The CTI server is not reachable' } }
        : { json: EXTENSIONS },
    )
    await page.goto('./users/overview')
    await expect(page.locator('[data-user]')).toHaveCount(3)

    fail = true
    await page.clock.install()
    await page.clock.runFor(60_000)
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))

    await expect(page.getByText('Cannot retrieve the status of users')).toBeVisible()
    await expect(page.locator('[data-user]')).toHaveCount(3)
  })

  test('opens the operator details', async ({ page, mockApi }) => {
    mockOverview(mockApi)
    await page.goto('./users/overview')

    await page.getByRole('button', { name: 'Show details of Anna Miller' }).click()
    await expect(page.getByRole('heading', { name: 'Operator details' })).toBeVisible()
    await expect(page.getByText('Fanvil X4U Pro', { exact: true }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: 'Call', exact: true })).toBeEnabled()
    await expect(
      page.getByTestId('call-device-menu').locator('svg[data-icon="chevron-down"]'),
    ).toHaveCount(1)

    const drawer = page.getByRole('dialog')
    const rows = drawer.getByTestId('device-row')
    await expect(rows).toHaveCount(3)
    await expect(drawer.getByText('Select a device to show its settings.')).toBeVisible()
    await expect(drawer.getByRole('button', { name: 'Call 300', exact: true })).toBeEnabled()
    await expect(drawer.getByRole('button', { name: /^Call 92300/ })).toHaveCount(0)
    await expect(drawer.getByRole('button', { name: /^Call 93300/ })).toHaveCount(0)
    await expect(drawer.getByTestId('call-number-text')).toHaveText(['92300', '93300'])

    const webPhone = drawer.getByRole('button', { name: 'Web phone 300 settings' })
    const mobileApp = drawer.getByRole('button', { name: 'Mobile app 92300 settings' })
    const details = drawer.getByTestId('device-details')
    await expect(webPhone).toHaveAttribute('aria-expanded', 'false')
    await expect(details.first()).toBeHidden()

    await mobileApp.click({ position: { x: 8, y: 8 } })
    await expect(mobileApp).toHaveAttribute('aria-expanded', 'true')
    await expect(details.nth(1)).toBeVisible()
    await expect(details.nth(1)).toContainText('0612345678')

    await webPhone.click({ position: { x: 8, y: 8 } })
    await expect(webPhone).toHaveAttribute('aria-expanded', 'true')
    await expect(mobileApp).toHaveAttribute('aria-expanded', 'false')
    await expect(details.first()).toContainText('opus, alaw')
    await expect(details.nth(1)).toBeHidden()

    await drawer.getByRole('button', { name: 'Call 300', exact: true }).click()
    await expect(webPhone).toHaveAttribute('aria-expanded', 'true')
    expect(
      await drawer.evaluate((element) => {
        const scroller = element.querySelector('.overflow-y-auto') ?? element
        return scroller.scrollWidth <= scroller.clientWidth
      }),
    ).toBe(true)
  })

  test('returns the focus to the details button when the drawer closes', async ({
    page,
    mockApi,
  }) => {
    mockOverview(mockApi)
    await page.goto('./users/overview')

    const details = page.getByRole('button', { name: 'Show details of Anna Miller' })
    await details.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('heading', { name: 'Operator details' })).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(page.getByRole('heading', { name: 'Operator details' })).toBeHidden()
    await expect(details).toBeFocused()
  })

  test('keeps a device open while the live status refreshes', async ({ page, mockApi }) => {
    await page.clock.install()
    mockOverview(mockApi)
    await page.goto('./users/overview')

    await page.getByRole('button', { name: 'Show details of Anna Miller' }).click()
    const webPhone = page
      .getByRole('dialog')
      .getByRole('button', { name: 'Web phone 300 settings' })
    await webPhone.click({ position: { x: 8, y: 8 } })
    await expect(webPhone).toHaveAttribute('aria-expanded', 'true')

    const refreshes = mockApi.callsTo('GET', '/freepbx/rest/dashboard/live/extensions').length
    await page.clock.runFor(25000)
    await expect
      .poll(() => mockApi.callsTo('GET', '/freepbx/rest/dashboard/live/extensions').length)
      .toBeGreaterThan(refreshes)

    await expect(webPhone).toHaveAttribute('aria-expanded', 'true')
    await expect(page.getByRole('dialog').getByTestId('device-details').first()).toBeVisible()
  })

  test('disables the call without a device online', async ({ page, mockApi }) => {
    mockOverview(mockApi, {
      'a.miller': endpointUser('a.miller', 'Anna Miller', 'offline', '300', [
        { id: '93300', type: 'physical' },
      ]),
    })
    await page.goto('./users/overview')

    await page.getByRole('button', { name: 'Show details of Anna Miller' }).click()
    const call = page.getByRole('button', { name: 'Call', exact: true })
    await expect(call).toBeDisabled()
    await expect(page.getByTestId('call-disabled-reason')).toHaveText('No device online to call')
    await expect(call).toHaveAccessibleDescription('No device online to call')
    await call.locator('..').hover()
    await expect(page.getByRole('tooltip')).toHaveCount(0)
  })

  test('puts the favorite users first', async ({ page, mockApi }) => {
    mockOverview(mockApi)
    await page.goto('./users/overview')

    const users = page.locator('li[data-user]')
    await expect(users.first()).toHaveAttribute('data-user', 'a.miller')

    await page.getByRole('button', { name: 'Show details of Carla Rossi' }).click()
    const favorite = page.getByRole('button', { name: 'Add to favorites' })
    await expect(favorite.locator('svg')).toHaveAttribute('data-prefix', 'fas')
    await expect(favorite.locator('svg')).toHaveAttribute('data-icon', 'star')
    await favorite.click()
    await expect(
      page.getByRole('button', { name: 'Remove from favorites' }).locator('svg'),
    ).toHaveAttribute('data-prefix', 'fas')
    await page.keyboard.press('Escape')

    await expect(users.first()).toHaveAttribute('data-user', 'c.rossi')
    await expect(users.nth(1)).toHaveAttribute('data-user', 'a.miller')
  })

  test('names the icon buttons with a tooltip', async ({ page, mockApi }) => {
    mockOverview(mockApi)
    await page.goto('./users/overview')

    await page.getByRole('button', { name: 'Show details of Anna Miller' }).hover()
    await expect(page.getByRole('tooltip', { name: 'Show details' })).toBeVisible()

    await page.getByRole('button', { name: 'List view' }).hover()
    await expect(page.getByRole('tooltip', { name: 'List view' })).toBeVisible()
  })

  test('switches to the list view', async ({ page, mockApi }) => {
    mockOverview(mockApi)
    await page.goto('./users/overview')

    const views = page.getByRole('group', { name: 'View' })
    await expect(views.getByRole('button', { name: 'Grid view' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )

    await expect(views.getByRole('button', { name: 'List view' }).locator('svg')).toHaveAttribute(
      'data-icon',
      'list-ul',
    )
    await views.getByRole('button', { name: 'List view' }).click()
    await expect(views.getByRole('button', { name: 'List view' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect(views.getByRole('button', { name: 'Grid view' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    await expect(page.locator('tr[data-user]')).toHaveCount(3)

    await views.getByRole('button', { name: 'Grouped view' }).click()
    await expect(page.getByTestId('overview-group')).toHaveText([/Sales/, /Support/])
    await expect(page.getByRole('region', { name: 'Sales' }).locator('li[data-user]')).toHaveCount(
      2,
    )

    await page.getByRole('button', { name: 'Group by', exact: true }).click()
    await page.getByRole('radio', { name: 'Status' }).check()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('region', { name: 'Online' }).locator('li[data-user]')).toHaveCount(
      1,
    )
  })

  test('shows the users in a table in the list view', async ({ page, mockApi }) => {
    mockOverview(mockApi)
    await page.goto('./users/overview')
    await page.getByRole('button', { name: 'List view' }).click()

    const table = page.getByRole('grid', { name: 'User overview' })
    await expect(table.getByRole('columnheader')).toHaveText([
      'Name',
      'Groups',
      'Devices',
      'Status',
      'Actions',
    ])
    await expect(table.locator('tbody tr')).toHaveCount(3)

    const anna = table.locator('tr[data-user="a.miller"]')
    await expect(anna.getByRole('gridcell')).toHaveText(
      [/Anna Miller/, 'Sales', /300[\s\S]*92300[\s\S]*93300/, 'Online', /Details/],
      { useInnerText: true },
    )
    await expect(anna.getByTestId('device-item')).toHaveText([
      'Web phone 300 Online',
      'Mobile app 92300 Ringing',
      'Fanvil X4U Pro 93300 Offline',
    ])
    await expect(anna.getByRole('button', { name: /^Call/ })).toHaveCount(0)
    await expect(table.locator('tr[data-user="b.smith"]').getByRole('gridcell').nth(3)).toHaveText(
      /DND$/,
      { useInnerText: true },
    )

    await anna.getByTestId('device-item').nth(1).getByText('92300').hover()
    await expect(page.getByRole('tooltip', { name: 'Mobile app · Ringing' })).toBeVisible()

    const details = anna.getByRole('button', { name: 'Details Anna Miller' })
    await details.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('heading', { name: 'Operator details' })).toBeVisible()
    await expect(page.getByRole('tooltip', { includeHidden: true })).toHaveCount(0)
    await page.keyboard.press('Escape')
    await expect(details).toBeFocused()
  })

  test('marks the favorite users and filters the list view', async ({ page, mockApi }) => {
    mockOverview(mockApi)
    await page.goto('./users/overview')

    await page.getByRole('button', { name: 'Show details of Carla Rossi' }).click()
    await page.getByRole('button', { name: 'Add to favorites' }).click()
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'List view' }).click()

    const rows = page.locator('tr[data-user]')
    await expect(rows.first()).toHaveAttribute('data-user', 'c.rossi')
    await expect(rows.first().getByTestId('favorite-star')).toBeVisible()
    await expect(rows.nth(1).getByTestId('favorite-star')).toHaveCount(0)

    await page.getByRole('textbox', { name: 'Filter users' }).fill('nobody')
    await expect(page.getByText('No users found')).toBeVisible()
    await expect(page.getByRole('grid')).toHaveCount(0)
  })

  test('marks the chosen view and remembers it in the browser', async ({ page, mockApi }) => {
    mockOverview(mockApi)
    await page.goto('./users/overview')

    const views = page.getByRole('group', { name: 'View' })
    const grid = views.getByRole('button', { name: 'Grid view' })
    const list = views.getByRole('button', { name: 'List view' })
    await expect(grid).toHaveClass(/bg-elevation-3/)
    await expect(list).not.toHaveClass(/bg-elevation-3/)
    await expect(list.locator('svg')).not.toHaveClass(/text-tertiary-neutral/)

    await list.click()
    await expect(list).toHaveClass(/bg-elevation-3/)
    await expect(grid).not.toHaveClass(/bg-elevation-3/)

    await page.reload()
    await expect(views.getByRole('button', { name: 'List view' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect(page.locator('tr[data-user]')).toHaveCount(3)
  })

  test('reaches the details of a row without stopping on the device numbers', async ({
    page,
    mockApi,
  }) => {
    mockOverview(mockApi)
    await page.goto('./users/overview')
    await page
      .getByRole('group', { name: 'View' })
      .getByRole('button', { name: 'List view' })
      .click()
    await expect(page.locator('tr[data-user]')).toHaveCount(3)

    await page.getByRole('button', { name: 'Grouped view' }).focus()
    const firstDetails = page
      .locator('tr[data-user]')
      .first()
      .getByRole('button', { name: /Details/ })
    const deviceNumbers = page.getByTestId('device-item')
    await expect(deviceNumbers.first()).toContainText('300')
    await expect(deviceNumbers.locator('[tabindex]')).toHaveCount(0)

    for (let step = 0; step < 6; step += 1) {
      await page.keyboard.press('Tab')
      const inDevices = await page.evaluate(
        () => !!document.activeElement?.closest('[data-testid="device-item"]'),
      )
      expect(inDevices).toBe(false)
      if (await firstDetails.evaluate((element) => element === document.activeElement)) {
        break
      }
    }
    await expect(firstDetails).toBeFocused()
    await expect(deviceNumbers.first()).toContainText('Web phone')
  })

  test('announces a favorite once', async ({ page, mockApi }) => {
    mockOverview(mockApi)
    await page.goto('./users/overview')
    await page.getByRole('button', { name: 'Show details of Carla Rossi' }).click()
    await page.getByRole('button', { name: 'Add to favorites' }).click()
    await page.keyboard.press('Escape')
    await page
      .getByRole('group', { name: 'View' })
      .getByRole('button', { name: 'List view' })
      .click()

    const row = page.locator('tr[data-user="c.rossi"]')
    await expect(row.getByTestId('favorite-star')).toHaveAttribute('aria-hidden', 'true')
    await expect(row.getByTestId('favorite-star')).not.toHaveAttribute('aria-label')
    await expect(row.getByText('Favorite', { exact: true })).toHaveCount(1)
    await expect(row.getByRole('gridcell').first()).toContainText('Favorite')
  })

  test('finds the users of a group by its name', async ({ page, mockApi }) => {
    mockOverview(mockApi)
    await page.goto('./users/overview')

    await page.getByRole('textbox', { name: 'Filter users' }).fill('support')
    await expect(page.locator('[data-user]')).toHaveCount(1)
    await expect(page.locator('[data-user]')).toHaveAttribute('data-user', 'c.rossi')
  })

  test('gives the compact cards of a row the same height', async ({ page, mockApi }) => {
    mockOverview(mockApi)
    await page.goto('./users/overview')
    await page
      .getByRole('group', { name: 'View' })
      .getByRole('button', { name: 'Grouped view' })
      .click()

    const cards = page.getByRole('region', { name: 'Sales' }).locator('li[data-user] > *')
    await expect(cards).toHaveCount(2)
    const heights = await cards.evaluateAll((elements) =>
      elements.map((element) => element.getBoundingClientRect().height),
    )
    expect(heights[0]).toBe(heights[1])
  })

  test('shows a number that cannot be called as plain text', async ({ page, mockApi }) => {
    mockOverview(mockApi)
    await page.goto('./users/overview')

    const anna = userCard(page, 'a.miller')
    await expect(anna.getByRole('button', { name: 'Call 300', exact: true })).toBeEnabled()
    const offline = anna.getByTestId('call-number-text')
    await expect(offline).toHaveText(['92300', '93300'])
    await expect(offline.first()).not.toHaveAttribute('tabindex')
    await offline.first().hover()
    await expect(page.getByRole('tooltip')).toHaveCount(0)

    await page.getByRole('button', { name: 'Show details of Anna Miller' }).click()
    const drawer = page.getByRole('dialog')
    const number = drawer.getByTestId('call-number-text').last()
    const physical = drawer.getByRole('button', { name: /93300 settings/ })
    await expect(number).toHaveText('93300')
    expect(
      await number.evaluate((element) => {
        const style = getComputedStyle(element)
        return [style.backgroundColor, style.opacity]
      }),
    ).toEqual(['rgba(0, 0, 0, 0)', '1'])

    await physical.click({ trial: true })
    const box = await number.boundingBox()
    expect(box).not.toBeNull()
    await page.mouse.click(
      (box?.x ?? 0) + (box?.width ?? 0) / 2,
      (box?.y ?? 0) + (box?.height ?? 0) / 2,
    )
    await expect(physical).toHaveAttribute('aria-expanded', 'true')
  })

  test('anchors the presence to the corner of the avatar in every view', async ({
    page,
    mockApi,
  }) => {
    mockOverview(mockApi)
    await page.goto('./users/overview')

    await expectDotOnAvatarCorner(userCard(page, 'a.miller'), 'Online')
    await page.getByRole('button', { name: 'List view' }).click()
    await expectDotOnAvatarCorner(userCard(page, 'a.miller'), 'Online')
    await page.getByRole('button', { name: 'Grouped view' }).click()
    await expectDotOnAvatarCorner(userCard(page, 'a.miller'), 'Online')
    await page.getByRole('button', { name: 'Show details of Anna Miller' }).click()
    await expectDotOnAvatarCorner(page.getByRole('dialog'), 'Online')
  })
})
