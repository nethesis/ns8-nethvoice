//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { expect, test, type MockApi } from '../fixtures/mockApi'

const extension = (exten: string, name: string, status: string, conversations = {}) => ({
  exten,
  name,
  status,
  conversations,
})

const ctiUser = (mainPresence: string, extensions: { id: string; type: string }[]) => ({
  name: 'Anna Miller',
  username: 'a.miller',
  mainPresence,
  presence: 'online',
  endpoints: { extension: extensions, mainextension: [] },
})

const EXTENSIONS = {
  '300': extension('300', 'Anna Miller', 'busy', {
    c1: {
      id: 'PJSIP/300-01>PJSIP/301-02',
      linkedId: '1700000000.1',
      duration: 65,
      direction: 'out',
      throughTrunk: false,
      throughQueue: false,
      counterpartNum: '301',
      counterpartName: 'Bob Smith',
    },
  }),
  '301': extension('301', 'Bob Smith', 'busy', {
    c2: {
      id: 'PJSIP/301-02>PJSIP/300-01',
      linkedId: '1700000000.1',
      duration: 64,
      direction: 'in',
      throughTrunk: false,
      throughQueue: false,
      counterpartNum: '300',
      counterpartName: 'Anna Miller',
    },
  }),
  '302': extension('302', 'Carla Rossi', 'online'),
  '91302': extension('91302', 'Carla Rossi', 'online'),
  '92302': extension('92302', 'Carla Rossi', 'offline'),
  '303': extension('303', 'Dario Bianchi', 'dnd'),
}

const TRUNKS = {
  Provider: {
    name: 'Provider',
    status: 'online',
    registration: 'registered',
    conversations: {
      t1: {
        id: 'PJSIP/Provider-03>PJSIP/302-04',
        duration: 723,
        direction: 'in',
        internalNum: '302',
        internalName: 'Carla Rossi',
        externalNum: '0612345678',
        externalName: '',
        throughQueue: true,
      },
    },
  },
}

const USERS = {
  'a.miller': ctiUser('busy', [{ id: '300', type: 'webrtc' }]),
  'b.smith': ctiUser('busy', [{ id: '301', type: 'webrtc' }]),
  'c.rossi': ctiUser('online', [
    { id: '302', type: 'webrtc' },
    { id: '91302', type: 'mobile' },
    { id: '92302', type: 'nethlink' },
  ]),
  'd.bianchi': ctiUser('dnd', [{ id: '303', type: 'physical' }]),
  'e.verdi': ctiUser('offline', []),
}

const FREEPBX_TRUNKS = [
  { trunkid: 1, tech: 'pjsip', name: 'Provider', disabled: 'off' },
  { trunkid: 2, tech: 'pjsip', name: 'Backup', disabled: 'off' },
]

const INBOUND_ROUTES = {
  destinations: {
    'ext-queues,400,1': {
      destination: 'ext-queues,400,1',
      description: '400 Sales',
      name: 'Queues',
    },
  },
  routes: [
    {
      extension: '0612345678',
      cidnum: '',
      description: 'Main number',
      destination: 'ext-queues,400,1',
    },
  ],
}

const mockDashboard = (mockApi: MockApi) =>
  mockApi
    .on('GET', '/freepbx/rest/users/count', { json: 5 })
    .on('GET', '/freepbx/rest/cti/groups', {
      json: [
        { id: 1, name: 'Sales' },
        { id: 2, name: 'Support' },
      ],
    })
    .on('GET', '/tancredi/api/v1/phones', {
      json: [
        { mac: 'AA-BB-CC-DD-EE-01' },
        { mac: 'AA-BB-CC-DD-EE-02' },
        { mac: 'AA-BB-CC-DD-EE-03' },
      ],
    })
    .on('GET', '/freepbx/rest/trunks/count', { json: 1 })
    .on('GET', '/freepbx/rest/trunks', { json: FREEPBX_TRUNKS })
    .on('GET', '/freepbx/rest/inboundroutes', { json: INBOUND_ROUTES })
    .on('GET', '/freepbx/rest/inboundroutes/count', { json: 6 })
    .on('GET', '/freepbx/rest/outboundroutes/count', { json: 7 })
    .on('GET', '/freepbx/rest/mainextensions/userlimits', {
      json: { configured: 5, limit: false, configurable: false },
    })
    .on('GET', '/api/astproxy/extensions', { json: EXTENSIONS })
    .on('GET', '/api/astproxy/trunks', { json: TRUNKS })
    .on('GET', '/api/user/endpoints/all', { json: USERS })

const counterValue = (page: import('@playwright/test').Page, id: string) =>
  page.getByTestId(`counter-${id}`).getByTestId('counter-value')

test.describe('dashboard', () => {
  test.beforeEach(({ signedIn, mockApi }) => {
    void signedIn
    mockDashboard(mockApi)
  })

  test('shows counters, subscription and live data', async ({ page }) => {
    await page.goto('./dashboard')

    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
    await expect(counterValue(page, 'users')).toHaveText('5')
    await expect(counterValue(page, 'groups')).toHaveText('2')
    await expect(counterValue(page, 'physicalPhones')).toHaveText('3')
    await expect(counterValue(page, 'callsInProgress')).toHaveText('2')
    await expect(counterValue(page, 'trunks')).toHaveText('1')
    await expect(counterValue(page, 'inboundRoutes')).toHaveText('6')
    await expect(counterValue(page, 'outboundRoutes')).toHaveText('7')

    await expect(page.getByTestId('subscription-plan')).toHaveText('Enterprise')
    await expect(page.getByTestId('extensions-usage')).toHaveText('5')
    await expect(page.getByTestId('updated-at')).toContainText('Updated at')

    const presence = page.getByTestId('presence-card')
    await expect(presence.getByTestId('breakdown-online')).toHaveText('1')
    await expect(presence.getByTestId('breakdown-busy')).toHaveText('2')
    await expect(presence.getByTestId('breakdown-dnd')).toHaveText('1')
    await expect(presence.getByTestId('breakdown-offline')).toHaveText('1')

    const devices = page.getByTestId('devices-card')
    await expect(devices.getByTestId('breakdown-webPhone')).toHaveText('3')
    await expect(devices.getByTestId('breakdown-desktopPhone')).toHaveText('0')
    await expect(devices.getByTestId('breakdown-mobileApp')).toHaveText('1')

    const rows = page.getByTestId('call-row')
    await expect(rows).toHaveCount(2)
    await expect(rows.nth(0)).toContainText('Incoming')
    await expect(rows.nth(0)).toContainText('0612345678')
    await expect(rows.nth(0)).toContainText('Carla Rossi')
    await expect(rows.nth(0)).toContainText(/12:0\d/)
    await expect(rows.nth(1)).toContainText('Internal')
    await expect(rows.nth(1)).toContainText('Anna Miller')
    await expect(rows.nth(1)).toContainText('Bob Smith')
  })

  test('shows the system host name, the trunks and the inbound routes', async ({ page }) => {
    await page.goto('./dashboard')

    await expect(page.getByTestId('system-hostname')).toHaveText(/\S+/)

    const trunkRows = page.getByTestId('trunks-card').getByTestId('list-row')
    await expect(trunkRows).toHaveCount(2)
    await expect(trunkRows.nth(0)).toContainText('Backup')
    await expect(trunkRows.nth(0)).toContainText('Pending')
    await expect(trunkRows.nth(1)).toContainText('Provider')
    await expect(trunkRows.nth(1)).toContainText('Registered')

    const routeRows = page.getByTestId('inbound-routes-card').getByTestId('list-row')
    await expect(routeRows).toHaveCount(1)
    await expect(routeRows.nth(0)).toContainText('0612345678')
    await expect(routeRows.nth(0)).toContainText('Queue: Sales (400)')
  })

  test('shows empty states without trunks and inbound routes', async ({ page, mockApi }) => {
    mockApi
      .on('GET', '/freepbx/rest/trunks', { json: [] })
      .on('GET', '/freepbx/rest/inboundroutes', { json: { destinations: [], routes: [] } })

    await page.goto('./dashboard')

    await expect(page.getByText('No trunks configured')).toBeVisible()
    await expect(page.getByText('No inbound routes configured')).toBeVisible()
  })

  test('sends the admin credentials to the CTI API', async ({ page, mockApi }) => {
    let headers: Record<string, string> = {}

    mockApi.on('GET', '/api/astproxy/trunks', (request) => {
      headers = request.headers
      return { json: TRUNKS }
    })

    await page.goto('./dashboard')
    await expect(counterValue(page, 'callsInProgress')).toHaveText('2')

    expect(headers.user).toBe('admin')
    expect(headers.secretkey).toBe('e2e-secret-key')
  })

  test('shows the community limit', async ({ page, mockApi }) => {
    mockApi.on('GET', '/freepbx/rest/mainextensions/userlimits', {
      json: { configured: 4, limit: 8, configurable: 4 },
    })

    await page.goto('./dashboard')

    await expect(page.getByTestId('subscription-plan')).toHaveText('Community')
    await expect(page.getByTestId('extensions-usage')).toHaveText('4/8')
    await expect(
      page.getByRole('progressbar', { name: '4 of 8 extensions configured' }),
    ).toBeVisible()
  })

  test('shows an empty state when no call is in progress', async ({ page, mockApi }) => {
    mockApi
      .on('GET', '/api/astproxy/extensions', {
        json: { '300': extension('300', 'Anna Miller', 'online') },
      })
      .on('GET', '/api/astproxy/trunks', { json: {} })

    await page.goto('./dashboard')

    await expect(counterValue(page, 'callsInProgress')).toHaveText('0')
    await expect(page.getByText('No calls in progress')).toBeVisible()
    await expect(page.getByTestId('call-row')).toHaveCount(0)
  })

  test('reports a live data error and retries', async ({ page, mockApi }) => {
    let fail = true

    mockApi.on('GET', '/api/astproxy/trunks', () =>
      fail ? { status: 500, json: { message: 'astproxy not ready' } } : { json: TRUNKS },
    )

    await page.goto('./dashboard')

    await expect(page.getByText('Cannot load live data')).toBeVisible()
    await expect(page.getByText('astproxy not ready')).toBeVisible()
    await expect(page.getByTestId('presence-card')).toHaveCount(0)
    await expect(counterValue(page, 'users')).toHaveText('5')

    fail = false
    await page.getByRole('button', { name: 'Retry' }).click()

    await expect(page.getByText('Cannot load live data')).toHaveCount(0)
    await expect(page.getByTestId('call-row')).toHaveCount(2)
  })

  test('reports a counter error and retries', async ({ page, mockApi }) => {
    let fail = true

    mockApi.on('GET', '/freepbx/rest/trunks/count', () =>
      fail ? { status: 500, json: 'An error occurred' } : { json: 1 },
    )

    await page.goto('./dashboard')

    await expect(page.getByText('Cannot load some counters')).toBeVisible()
    await expect(counterValue(page, 'trunks')).toHaveCount(0)
    await expect(counterValue(page, 'users')).toHaveText('5')

    fail = false
    await page.getByRole('button', { name: 'Retry' }).click()

    await expect(counterValue(page, 'trunks')).toHaveText('1')
    await expect(page.getByText('Cannot load some counters')).toHaveCount(0)
  })

  test('refreshes live data on an interval', async ({ page, mockApi }) => {
    await page.clock.install()
    await page.goto('./dashboard')
    await expect(page.getByTestId('call-row')).toHaveCount(2)
    const before = mockApi.callsTo('GET', '/api/astproxy/extensions').length

    mockApi.on('GET', '/api/astproxy/trunks', { json: {} })
    await page.clock.runFor(6000)

    await expect(page.getByTestId('call-row')).toHaveCount(1)
    expect(mockApi.callsTo('GET', '/api/astproxy/extensions').length).toBeGreaterThan(before)
  })

  test('signs out when the CTI API rejects the secret key', async ({ page, mockApi }) => {
    mockApi.on('GET', '/api/astproxy/extensions', { status: 401 })

    await page.goto('./dashboard')

    await expect(page).toHaveURL(/\/nethvoice\/login/)
    await expect(page.getByText('Session expired')).toBeVisible()
  })
})
