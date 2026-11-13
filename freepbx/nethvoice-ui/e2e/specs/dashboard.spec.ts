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

    await expect(page.getByRole('heading', { name: 'Dashboard' })).toHaveAttribute(
      'aria-level',
      '1',
    )
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
    await page.route('**/nethvoice/config.json', (route) =>
      route.fulfill({ json: { HOSTNAME: 'pbx.example.org' } }),
    )
    await page.goto('./dashboard')

    await expect(page.getByTestId('system-hostname')).toHaveText('pbx.example.org')

    const trunksCard = page.getByTestId('trunks-card')
    await expect(trunksCard.getByRole('columnheader')).toHaveText(['Name', 'Status'])
    await expect(trunksCard.getByRole('navigation', { name: 'Table pagination' })).toBeVisible()
    await expect(trunksCard).toContainText('1 - 2 of 2')
    const trunkRows = trunksCard.getByTestId('list-row')
    await expect(trunkRows).toHaveCount(2)
    await expect(trunkRows.nth(0)).toContainText('Backup')
    await expect(trunkRows.nth(0)).toContainText('Pending')
    await expect(trunkRows.nth(1)).toContainText('Provider')
    await expect(trunkRows.nth(1)).toContainText('Registered')

    const routesCard = page.getByTestId('inbound-routes-card')
    await expect(routesCard.getByRole('columnheader')).toHaveText(['Route', 'Destination'])
    await expect(routesCard.getByRole('navigation', { name: 'Table pagination' })).toBeVisible()
    await expect(routesCard).toContainText('1 - 1 of 1')
    const routeRows = routesCard.getByTestId('list-row')
    await expect(routeRows).toHaveCount(1)
    await expect(routeRows.nth(0)).toContainText('0612345678')
    await expect(routeRows.nth(0)).toContainText('Queue: Sales (400)')
  })

  test('paginates the trunks and the inbound routes', async ({ page, mockApi }) => {
    const names = ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7']

    mockApi
      .on('GET', '/freepbx/rest/trunks', {
        json: names.map((name, index) => ({
          trunkid: index + 1,
          tech: 'pjsip',
          name,
          disabled: 'off',
        })),
      })
      .on('GET', '/freepbx/rest/inboundroutes', {
        json: {
          destinations: INBOUND_ROUTES.destinations,
          routes: Array.from({ length: 6 }, (_, index) => ({
            extension: `061234560${index}`,
            cidnum: '',
            description: `Route ${index}`,
            destination: 'ext-queues,400,1',
          })),
        },
      })

    await page.goto('./dashboard')

    const trunksCard = page.getByTestId('trunks-card')
    const trunkRows = trunksCard.getByTestId('list-row')
    await expect(trunkRows).toHaveCount(5)
    await expect(trunksCard).toContainText('1 - 5 of 7')
    await expect(trunksCard.locator('.overflow-y-auto')).toHaveCount(0)

    await trunksCard.getByRole('button', { name: 'Go to next page' }).click()
    await expect(trunkRows).toHaveCount(2)
    await expect(trunkRows.nth(0)).toContainText('A6')
    await expect(trunkRows.nth(1)).toContainText('A7')

    const routesCard = page.getByTestId('inbound-routes-card')
    await expect(routesCard.getByTestId('list-row')).toHaveCount(5)
    await expect(routesCard).toContainText('1 - 5 of 6')
  })

  test('puts an offline provider before the trunk registration', async ({ page, mockApi }) => {
    mockApi
      .on('GET', '/freepbx/rest/trunks', {
        json: [...FREEPBX_TRUNKS, { trunkid: 3, tech: 'pjsip', name: 'Fallback', disabled: 'off' }],
      })
      .on('GET', '/api/astproxy/trunks', {
        json: {
          Provider: { ...TRUNKS.Provider, status: 'offline' },
          Backup: {
            name: 'Backup',
            status: 'online',
            registration: 'unregistered',
            conversations: {},
          },
          Fallback: {
            name: 'Fallback',
            status: 'online',
            registration: 'rejected',
            conversations: {},
          },
        },
      })

    await page.goto('./dashboard')

    const trunkRows = page.getByTestId('trunks-card').getByTestId('list-row')
    await expect(trunkRows.filter({ hasText: 'Provider' })).toContainText('Offline')
    await expect(trunkRows.filter({ hasText: 'Backup' })).toContainText('Not connected')
    await expect(trunkRows.filter({ hasText: 'Fallback' })).toContainText('Rejected')
  })

  test('shows the disabled trunks after the active ones', async ({ page, mockApi }) => {
    mockApi.on('GET', '/freepbx/rest/trunks', {
      json: [{ trunkid: 3, tech: 'pjsip', name: 'Archive', disabled: 'on' }, ...FREEPBX_TRUNKS],
    })

    await page.goto('./dashboard')

    const trunkRows = page.getByTestId('trunks-card').getByTestId('list-row')
    await expect(trunkRows).toHaveCount(3)
    await expect(trunkRows.nth(2)).toContainText('Archive')
    await expect(trunkRows.nth(2)).toContainText('Disabled')
    await expect(trunkRows.nth(2)).not.toContainText('Pending')
  })

  test('names the routes without a DID and flags missing destinations', async ({
    page,
    mockApi,
  }) => {
    mockApi.on('GET', '/freepbx/rest/inboundroutes', {
      json: {
        destinations: INBOUND_ROUTES.destinations,
        routes: [
          { extension: '', cidnum: '', description: 'Any', destination: 'ext-queues,400,1' },
          { extension: '0698765432', cidnum: '', description: 'Old', destination: 'ivr-99,s,1' },
        ],
      },
    })

    await page.goto('./dashboard')

    const routeRows = page.getByTestId('inbound-routes-card').getByTestId('list-row')
    await expect(routeRows.nth(0)).toContainText('Any DID')
    await expect(routeRows.nth(0)).toContainText('Queue: Sales (400)')
    await expect(routeRows.nth(1)).toContainText('Invalid destination')
    await expect(routeRows.nth(1)).not.toContainText('ivr-99')
  })

  test('keeps the trunks and the inbound routes when a refresh fails', async ({
    page,
    mockApi,
  }) => {
    await page.clock.install()
    await page.goto('./dashboard')
    const trunkRows = page.getByTestId('trunks-card').getByTestId('list-row')
    await expect(trunkRows).toHaveCount(2)

    mockApi
      .on('GET', '/freepbx/rest/trunks', { status: 500, json: 'An error occurred' })
      .on('GET', '/freepbx/rest/inboundroutes', { status: 500, json: 'An error occurred' })
    await page.clock.runFor(61000)

    const loadError = page.getByTestId('dashboard-load-error')
    await expect(loadError).toHaveCount(1)
    await expect(loadError).toContainText('Cannot load some dashboard data')
    await expect(loadError).toContainText('Not available: trunks and inbound routes.')
    await expect(loadError).toContainText('An error occurred')
    await expect(trunkRows).toHaveCount(2)
    await expect(page.getByTestId('inbound-routes-card').getByTestId('list-row')).toHaveCount(1)
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
    await expect(page.getByTestId('extensions-limit-reached')).toHaveCount(0)
  })

  test('warns when the community limit is exceeded', async ({ page, mockApi }) => {
    mockApi.on('GET', '/freepbx/rest/mainextensions/userlimits', {
      json: { configured: 10, limit: 8, configurable: 0 },
    })

    await page.goto('./dashboard')

    await expect(page.getByTestId('extensions-usage')).toHaveText('10/8')
    await expect(page.getByTestId('extensions-limit-reached')).toHaveText('Extension limit reached')
    const progress = page.getByRole('progressbar', { name: '10 of 8 extensions configured' })
    await expect(progress).toHaveAttribute('aria-valuenow', '8')
    await expect(progress).toHaveAttribute('aria-valuemax', '8')
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
    await expect(page.getByTestId('calls-card')).toHaveCount(0)
    await expect(page.getByTestId('counter-callsInProgress')).toContainText('Not available')
    await expect(page.getByTestId('presence-card').getByTestId('breakdown-busy')).toHaveText('2')
    await expect(page.getByTestId('devices-card').getByTestId('breakdown-webPhone')).toHaveText('3')
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

  test('summarizes the unreachable services in one notification', async ({ page, mockApi }) => {
    let fail = true
    const responses: Record<string, unknown> = {
      '/api/astproxy/extensions': EXTENSIONS,
      '/api/astproxy/trunks': TRUNKS,
      '/api/user/endpoints/all': USERS,
      '/tancredi/api/v1/phones': [],
    }

    for (const [path, json] of Object.entries(responses)) {
      mockApi.on('GET', path, () =>
        fail
          ? { status: 502, contentType: 'text/html', body: '<html><h1>502 Bad Gateway</h1></html>' }
          : { json },
      )
    }

    await page.goto('./dashboard')

    const loadError = page.getByTestId('dashboard-load-error')
    await expect(loadError).toHaveCount(1)
    await expect(loadError).toContainText('Cannot load some dashboard data')
    await expect(loadError).toContainText(
      'Not available: counters and live data. The service is not reachable at the moment. Try again shortly.',
    )
    await expect(page.getByText('Bad Gateway')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Retry' })).toHaveCount(1)

    const usersCalls = mockApi.callsTo('GET', '/freepbx/rest/users/count').length
    fail = false
    await page.getByRole('button', { name: 'Retry' }).click()

    await expect(loadError).toHaveCount(0)
    expect(mockApi.callsTo('GET', '/freepbx/rest/users/count')).toHaveLength(usersCalls)
  })

  test('keeps the presence and the trunks when the extensions fail', async ({ page, mockApi }) => {
    mockApi.on('GET', '/api/astproxy/extensions', { status: 500, json: { message: 'busy' } })

    await page.goto('./dashboard')

    await expect(page.getByText('Cannot load live data')).toBeVisible()
    await expect(page.getByTestId('presence-card').getByTestId('breakdown-online')).toHaveText('1')
    await expect(page.getByTestId('devices-card')).toHaveCount(0)
    await expect(page.getByTestId('calls-card')).toHaveCount(0)
    await expect(
      page.getByTestId('trunks-card').getByTestId('list-row').filter({ hasText: 'Provider' }),
    ).toContainText('Registered')
  })

  test('counts an unknown presence as offline', async ({ page, mockApi }) => {
    mockApi.on('GET', '/api/user/endpoints/all', {
      json: { ...USERS, 'f.neri': ctiUser('away', []) },
    })

    await page.goto('./dashboard')

    const presence = page.getByTestId('presence-card')
    await expect(presence.getByTestId('breakdown-offline')).toHaveText('2')
    await expect(page.getByText('Cannot load live data')).toHaveCount(0)
  })

  test('lists only connected calls and keeps internal calls to services', async ({
    page,
    mockApi,
  }) => {
    mockApi
      .on('GET', '/api/astproxy/extensions', {
        json: {
          ...EXTENSIONS,
          '302': extension('302', 'Carla Rossi', 'busy', {
            c3: {
              id: 'c3',
              linkedId: '2.1',
              duration: 82,
              direction: 'out',
              connected: true,
              counterpartNum: '401',
              counterpartName: 'Support queue',
            },
          }),
          '303': extension('303', 'Dario Bianchi', 'ringing', {
            c4: {
              id: 'c4',
              linkedId: '3.1',
              duration: 2,
              direction: 'out',
              connected: false,
              counterpartNum: '300',
            },
          }),
        },
      })
      .on('GET', '/api/astproxy/trunks', {
        json: {
          Provider: {
            ...TRUNKS.Provider,
            conversations: {
              t2: {
                id: 't2',
                duration: 5,
                direction: 'in',
                connected: false,
                externalNum: '0711111111',
                throughQueue: true,
              },
            },
          },
        },
      })

    await page.goto('./dashboard')

    const rows = page.getByTestId('call-row')
    await expect(rows).toHaveCount(2)
    await expect(counterValue(page, 'callsInProgress')).toHaveText('2')
    await expect(rows.nth(0)).toContainText('Support queue')
    await expect(rows.nth(0)).toContainText(/1:2\d/)
    await expect(page.getByText('0711111111')).toHaveCount(0)
  })

  test('replaces the devices chart with a text without connected devices', async ({
    page,
    mockApi,
  }) => {
    mockApi.on('GET', '/api/user/endpoints/all', {
      json: { 'e.verdi': ctiUser('offline', []) },
    })

    await page.goto('./dashboard')

    const devices = page.getByTestId('devices-card')
    await expect(devices.getByTestId('breakdown-empty')).toHaveText('No devices connected')
    await expect(devices.getByRole('img')).toHaveCount(0)
    await expect(devices.getByTestId('breakdown-webPhone')).toHaveText('0')
    await expect(
      devices.getByRole('button', { name: 'Devices currently connected to the PBX' }),
    ).toBeVisible()
  })

  test('waits for a slow live response before polling again', async ({ page, mockApi }) => {
    let inFlight = 0
    let maxInFlight = 0

    mockApi.on('GET', '/api/astproxy/extensions', async () => {
      inFlight += 1
      maxInFlight = Math.max(maxInFlight, inFlight)
      await new Promise((resolve) => setTimeout(resolve, 7000))
      inFlight -= 1
      return { json: EXTENSIONS }
    })

    await page.goto('./dashboard')

    await expect(page.getByTestId('call-row')).toHaveCount(2, { timeout: 10000 })
    expect(maxInFlight).toBe(1)
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
