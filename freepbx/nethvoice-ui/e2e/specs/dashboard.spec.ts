//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import type { Locator, Page } from '@playwright/test'
import { expect, mockPermissions, test, type MockApi, type MockRequest } from '../fixtures/mockApi'

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
  endpoints: { mainextension: [], extension: extensions },
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

const CALLS_TODAY = {
  total: 12,
  answered: 9,
  missed: 2,
  invalid: 1,
  calls_by_hour: [0, 0, 0, 0, 0, 0, 0, 0, 1, 4, 2],
}

const HOUR = 3600

const LAST_HOUR = Date.UTC(2026, 10, 18, 11) / 1000

const RANGE_HOURS: Record<string, number> = { '24h': 24, '7d': 168, '15d': 360 }

const CALLS_AT_HOUR: Record<number, number> = { 8: 1, 9: 4, 10: 2.5 }

const callsHistory = (range: string, historyStart: number | null = LAST_HOUR - 400 * HOUR) => {
  const hours = RANGE_HOURS[range] ?? 24

  return {
    range,
    source: 'cdr',
    history_start: historyStart,
    series: Array.from({ length: hours }, (_, index) => {
      const time = LAST_HOUR - (hours - 1 - index) * HOUR

      return {
        time,
        calls:
          historyStart === null || time < historyStart
            ? null
            : (CALLS_AT_HOUR[new Date(time * 1000).getUTCHours()] ?? 0),
      }
    }),
  }
}

const callsResponse =
  (history: (range: string) => object = callsHistory, ranges: string[] = []) =>
  (request: MockRequest) => {
    const range = request.query.get('range')

    if (range === null) {
      return { json: CALLS_TODAY }
    }
    ranges.push(range)
    return { json: { ...CALLS_TODAY, ...history(range) } }
  }

const PHONE_STATUS = {
  provisioned: 116,
  pending: 4,
  unassigned: 2,
  failed: 2,
  unknown: 1,
  total: 125,
}

const SYSTEM = {
  release: '8.10.0',
  uptime_seconds: 14 * 86400 + 6 * 3600 + 12 * 60 + 30,
  load_average: 0.42,
  memory_used_percent: 38.2,
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
    .on('GET', '/freepbx/rest/trunks/count', { json: 1 })
    .on('GET', '/freepbx/rest/trunks', { json: FREEPBX_TRUNKS })
    .on('GET', '/freepbx/rest/inboundroutes', { json: INBOUND_ROUTES })
    .on('GET', '/freepbx/rest/inboundroutes/count', { json: 6 })
    .on('GET', '/freepbx/rest/outboundroutes/count', { json: 7 })
    .on('GET', '/freepbx/rest/mainextensions/userlimits', {
      json: { configured: 5, limit: false, configurable: false },
    })
    .on('GET', '/freepbx/rest/dashboard/live/extensions', { json: EXTENSIONS })
    .on('GET', '/freepbx/rest/dashboard/live/trunks', { json: TRUNKS })
    .on('GET', '/freepbx/rest/dashboard/live/users', { json: USERS })
    .on('GET', '/freepbx/rest/dashboard/calls', callsResponse())
    .on('GET', '/freepbx/rest/dashboard/system', { json: SYSTEM })
    .on('GET', '/freepbx/rest/dashboard/phones', { json: PHONE_STATUS })

const LIVE_PATHS = [
  '/freepbx/rest/dashboard/live/extensions',
  '/freepbx/rest/dashboard/live/trunks',
  '/freepbx/rest/dashboard/live/users',
]

const counterValue = (page: import('@playwright/test').Page, id: string) =>
  page.getByTestId(`counter-${id}`).getByTestId('counter-value')

const FULL_PERIOD = 'Nov 3, 12:00\u2009–\u2009Nov 18, 11:00'

const period = (start: string, end: string) => `${start}\u2009–\u2009${end}`

const startingWith = (text: string) => new RegExp(`^${text.replaceAll('\u2009', '\\s')}`)

const utc = (day: number, hour: number) => Date.UTC(2026, 10, day, hour)

const plotX = async (chart: Locator, [start, end]: [number, number], time: number) => {
  const plot = await chart.evaluate((element) => {
    const boxes = Array.from(element.querySelectorAll('path'))
      .filter((path) => /-area$/.test(path.getAttribute('class') ?? ''))
      .map((path) => path.getBoundingClientRect())
    const left = Math.min(...boxes.map((box) => box.left))

    return { left, width: Math.max(...boxes.map((box) => box.right)) - left }
  })

  return plot.left + ((time - start) / (end - start)) * plot.width
}

const dragOnChart = async (
  page: Page,
  chart: Locator,
  domain: [number, number],
  from: number,
  to: number,
) => {
  await chart.scrollIntoViewIfNeeded()
  const box = await chart.boundingBox()
  if (!box) {
    throw new Error('missing chart')
  }
  const y = box.y + box.height / 2
  await page.mouse.move(await plotX(chart, domain, from), y)
  await page.mouse.down()
  await page.mouse.move(await plotX(chart, domain, to), y, { steps: 5 })
}

test.describe('dashboard', () => {
  test.use({ timezoneId: 'UTC' })

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
    await expect(counterValue(page, 'physicalPhones')).toHaveText('125')
    await expect(counterValue(page, 'callsInProgress')).toHaveText('2')
    await expect(counterValue(page, 'trunks')).toHaveText('1')
    await expect(counterValue(page, 'inboundRoutes')).toHaveText('6')
    await expect(counterValue(page, 'outboundRoutes')).toHaveText('7')

    await expect(page.getByTestId('subscription-plan')).toHaveText('Enterprise')
    await expect(page.getByTestId('extensions-usage')).toHaveCount(0)
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

    const phoneStatus = page.getByTestId('phone-status-card')
    await expect(phoneStatus).toContainText('Phone status')
    await expect(phoneStatus.getByRole('term')).toHaveText([
      'Provisioned',
      'Pending',
      'Unassigned',
      'Failed',
    ])
    await expect(phoneStatus.getByTestId('breakdown-provisioned')).toHaveText('116')
    await expect(phoneStatus.getByTestId('breakdown-pending')).toHaveText('4')
    await expect(phoneStatus.getByTestId('breakdown-unassigned')).toHaveText('2')
    await expect(phoneStatus.getByTestId('breakdown-failed')).toHaveText('2')
    await expect(phoneStatus.getByTestId('breakdown-unknown')).toHaveCount(0)
    await expect(
      phoneStatus.getByRole('img', {
        name: 'Provisioned: 116, Pending: 4, Unassigned: 2, Failed: 2',
      }),
    ).toBeVisible()
    await expect(page.locator('[data-card]').nth(2)).toHaveAttribute('data-card', 'phoneStatus')

    const callsToday = page.getByTestId('calls-summary-card')
    await expect(callsToday).toContainText('Calls today')
    await expect(callsToday.getByTestId('breakdown-total')).toHaveText('12')
    await expect(callsToday.getByTestId('breakdown-answered')).toHaveText('9')
    await expect(callsToday.getByTestId('breakdown-missed')).toHaveText('2')
    await expect(callsToday.getByTestId('breakdown-invalid')).toHaveText('1')

    const hourlyCard = page.getByTestId('hourly-calls-card')
    await expect(hourlyCard).toContainText('Calls per hour')
    await expect(
      page.getByRole('img', {
        name: `${FULL_PERIOD}: 112.5 calls, busiest hour Wed, Nov 4, 09:00 with 4`,
      }),
    ).toBeVisible()
    const hourlyChart = page.getByTestId('hourly-chart')
    for (const day of ['Nov 4', 'Nov 10', 'Nov 18']) {
      await expect(hourlyChart.locator('svg text', { hasText: day })).toHaveCount(1)
    }
    await expect(hourlyChart.locator('svg text', { hasText: /^\d\d:\d\d$/ })).toHaveCount(0)
    await expect(hourlyChart.locator('svg text', { hasText: /^4$/ })).toHaveCount(1)
    await expect(page.getByTestId('hourly-calls-available-from')).toHaveCount(0)
    await expect(hourlyCard.getByRole('button')).toHaveCount(1)
    await expect(hourlyCard.getByTestId('hourly-calls-period')).toHaveCount(0)

    const rows = page.getByTestId('call-row')
    await expect(rows).toHaveCount(2)
    await expect(rows.nth(0)).toContainText('Incoming')
    await expect(rows.nth(0)).toContainText('0612345678')
    await expect(rows.nth(0)).toContainText('Carla Rossi')
    await expect(rows.nth(0)).toContainText(/12:0\d/)
    await expect(rows.nth(1)).toContainText('Internal')
    await expect(rows.nth(1)).toContainText('Anna Miller')
    await expect(rows.nth(1)).toContainText('Bob Smith')

    const callsCard = page.getByTestId('calls-card')
    await expect(callsCard.getByRole('columnheader')).toHaveText([
      'Call type',
      'Source',
      'Destination',
      'Duration',
    ])
    await expect(callsCard.getByRole('navigation', { name: 'Table pagination' })).toHaveCount(0)
    const queue = rows.nth(0).getByTestId('through-queue')
    await expect(queue).toHaveText('Through a queue')
    await queue.hover()
    await expect(page.getByRole('tooltip', { name: 'Through a queue' })).toBeVisible()
  })

  test('opens the section of a counter', async ({ page }) => {
    await page.goto('./dashboard')

    const card = page.getByTestId('counter-inboundRoutes')
    await expect(card.getByRole('link')).toHaveCount(1)
    await expect(card.getByTestId('counter-title')).toHaveAttribute('tabindex', '-1')
    await card.getByTestId('counter-title').click()
    await expect(page).toHaveURL(/\/nethvoice\/routes\/inbound$/)
    await page.goBack()

    await page
      .getByTestId('counter-inboundRoutes')
      .getByRole('link', { name: 'Inbound routes: 6' })
      .click()
    await expect(page).toHaveURL(/\/nethvoice\/routes\/inbound$/)
  })

  test('shows the system host name, the trunks and the inbound routes', async ({ page }) => {
    await page.route('**/nethvoice/config.json', (route) =>
      route.fulfill({ json: { HOSTNAME: 'pbx.example.org' } }),
    )
    await page.goto('./dashboard')

    await expect(page.getByTestId('system-hostname')).toHaveText('pbx.example.org')
    await expect(page.getByTestId('system-release')).toHaveText('NethVoice 8.10.0')
    await expect(page.getByTestId('system-uptime')).toHaveText('14 days 6 hours 12 minutes')
    await expect(page.getByTestId('system-load-memory')).toHaveText('0.42 · 38%')
    await expect(page.getByTestId('system-card').locator('dt')).toHaveText([
      'Hostname',
      'Release',
      'Uptime',
      'Load / memory',
      'Subscription',
    ])

    const trunksCard = page.getByTestId('trunks-card')
    await expect(trunksCard.getByRole('columnheader')).toHaveText(['Name', 'Status'])
    await expect(trunksCard.getByRole('navigation', { name: 'Table pagination' })).toHaveCount(0)
    const trunkRows = trunksCard.getByTestId('list-row')
    await expect(trunkRows).toHaveCount(2)
    await expect(trunkRows.nth(0)).toContainText('Backup')
    await expect(trunkRows.nth(0)).toContainText('Pending')
    await expect(trunkRows.nth(1)).toContainText('Provider')
    await expect(trunkRows.nth(1)).toContainText('Registered')

    const routesCard = page.getByTestId('inbound-routes-card')
    await expect(routesCard.getByRole('columnheader')).toHaveText(['Route', 'Destination'])
    await expect(routesCard.getByRole('navigation', { name: 'Table pagination' })).toHaveCount(0)
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
    await expect(trunksCard.getByRole('navigation', { name: 'Table pagination' })).toBeVisible()
    await expect(trunksCard.locator('.overflow-y-auto')).toHaveCount(0)

    await trunksCard.getByRole('button', { name: 'Go to next page' }).click()
    await expect(trunkRows).toHaveCount(2)
    await expect(trunkRows.nth(0)).toContainText('A6')
    await expect(trunkRows.nth(1)).toContainText('A7')

    const routesCard = page.getByTestId('inbound-routes-card')
    await expect(routesCard.getByTestId('list-row')).toHaveCount(5)
    await expect(routesCard).toContainText('1 - 5 of 6')
  })

  test('paginates the calls in progress only when they exceed a page', async ({
    page,
    mockApi,
  }) => {
    const conversations = Object.fromEntries(
      Array.from({ length: 7 }, (_, index) => [
        `t${index}`,
        {
          id: `PJSIP/Provider-1${index}>PJSIP/31${index}-2${index}`,
          duration: 700 - index * 10,
          direction: 'in',
          internalNum: `31${index}`,
          internalName: `Agent ${index}`,
          externalNum: `061234500${index}`,
          externalName: '',
          throughQueue: false,
        },
      ]),
    )

    mockApi
      .on('GET', '/freepbx/rest/dashboard/live/extensions', { json: {} })
      .on('GET', '/freepbx/rest/dashboard/live/trunks', {
        json: { Provider: { ...TRUNKS.Provider, conversations } },
      })

    await page.goto('./dashboard')

    const callsCard = page.getByTestId('calls-card')
    const rows = callsCard.getByTestId('call-row')
    await expect(rows).toHaveCount(5)
    await expect(callsCard).toContainText('1 - 5 of 7')
    await expect(callsCard.getByRole('navigation', { name: 'Table pagination' })).toBeVisible()

    await callsCard.getByRole('button', { name: 'Go to next page' }).click()
    await expect(rows).toHaveCount(2)
    await expect(rows.nth(0)).toContainText('Agent 5')
    await expect(rows.nth(1)).toContainText('Agent 6')
  })

  test('puts an offline provider before the trunk registration', async ({ page, mockApi }) => {
    mockApi
      .on('GET', '/freepbx/rest/trunks', {
        json: [...FREEPBX_TRUNKS, { trunkid: 3, tech: 'pjsip', name: 'Fallback', disabled: 'off' }],
      })
      .on('GET', '/freepbx/rest/dashboard/live/trunks', {
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
    await expect(loadError).toContainText(
      'The server could not complete the request (error 500). Try again later.',
    )
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

  test('sends the administrator credentials to the live data routes', async ({ page, mockApi }) => {
    let headers: Record<string, string> = {}

    mockApi.on('GET', '/freepbx/rest/dashboard/live/trunks', (request) => {
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
    await expect(page.getByTestId('system-release')).toHaveText('NethVoice 8.10.0')
    await expect(page.getByTestId('system-uptime')).toHaveText('14 days 6 hours 12 minutes')
    await expect(page.getByTestId('system-load-memory')).toHaveText('0.42 · 38%')
    await expect(
      page.getByRole('progressbar', { name: '4 of 8 extensions configured' }),
    ).toBeVisible()
    await expect(page.getByTestId('extensions-limit-reached')).toHaveCount(0)
    await expect(counterValue(page, 'callsInProgress')).toHaveText('2')
    await expect(counterValue(page, 'outboundRoutes')).toHaveText('7')
    await expect(page.getByTestId('dashboard-cards')).toHaveCount(0)
    await expect(page.getByTestId('drag-handle')).toHaveCount(0)
    expect(mockApi.callsTo('GET', '/freepbx/rest/dashboard/calls')).toHaveLength(0)
    await expect(page.getByTestId('phone-status-card')).toHaveCount(0)
  })

  test('does not report the live users on Community', async ({ page, mockApi }) => {
    mockApi
      .on('GET', '/freepbx/rest/mainextensions/userlimits', {
        json: { configured: 4, limit: 8, configurable: 4 },
      })
      .on('GET', '/freepbx/rest/dashboard/live/users', { status: 500, json: { message: 'busy' } })

    await page.goto('./dashboard')

    await expect(counterValue(page, 'callsInProgress')).toHaveText('2')
    await expect(page.getByTestId('dashboard-load-error')).toHaveCount(0)
  })

  test('reports the calls of today when they cannot be loaded', async ({ page, mockApi }) => {
    let fail = true
    const respond = callsResponse()

    mockApi.on('GET', '/freepbx/rest/dashboard/calls', (request) =>
      fail && !request.query.has('range')
        ? { status: 500, json: 'An error occurred' }
        : respond(request),
    )

    await page.goto('./dashboard')

    await expect(page.getByText("Cannot load today's calls")).toBeVisible()
    await expect(page.getByTestId('calls-summary-card')).toHaveCount(0)
    await expect(page.getByTestId('hourly-chart')).toBeVisible()

    fail = false
    await page.getByRole('button', { name: 'Retry' }).click()

    await expect(page.getByTestId('calls-summary-card').getByTestId('breakdown-total')).toHaveText(
      '12',
    )
  })

  test('reports the calls per hour when they cannot be loaded', async ({ page, mockApi }) => {
    let fail = true
    const respond = callsResponse()

    mockApi.on('GET', '/freepbx/rest/dashboard/calls', (request) =>
      fail && request.query.has('range')
        ? { status: 500, json: 'Prometheus query failed' }
        : respond(request),
    )

    await page.goto('./dashboard')

    const notification = page.getByTestId('dashboard-load-error')
    await expect(notification).toContainText('Cannot load calls per hour')
    await expect(notification).not.toContainText('Prometheus')
    const card = page.getByTestId('hourly-calls-card')
    await expect(card.getByTestId('hourly-calls-unavailable')).toHaveText('Not available')
    await expect(page.getByTestId('calls-summary-card')).toBeVisible()

    fail = false
    await page.getByRole('button', { name: 'Retry' }).click()

    await expect(card.getByTestId('hourly-chart')).toBeVisible()
    await expect(notification).toHaveCount(0)
  })

  test('reports the phone status when it cannot be loaded', async ({ page, mockApi }) => {
    let fail = true

    mockApi.on('GET', '/freepbx/rest/dashboard/phones', () =>
      fail ? { status: 500, json: 'An error occurred' } : { json: PHONE_STATUS },
    )

    await page.goto('./dashboard')

    await expect(page.getByTestId('dashboard-load-error')).toContainText(
      'Not available: counters and phone status.',
    )
    await expect(page.getByTestId('phone-status-card')).toHaveCount(0)
    await expect(counterValue(page, 'physicalPhones')).toHaveCount(0)
    await expect(page.getByTestId('calls-summary-card')).toBeVisible()

    fail = false
    await page.getByRole('button', { name: 'Retry' }).click()

    await expect(page.getByTestId('dashboard-load-error')).toHaveCount(0)
    await expect(
      page.getByTestId('phone-status-card').getByTestId('breakdown-provisioned'),
    ).toHaveText('116')
    await expect(counterValue(page, 'physicalPhones')).toHaveText('125')
  })

  test('replaces the phone status chart with a text without phones', async ({ page, mockApi }) => {
    mockApi.on('GET', '/freepbx/rest/dashboard/phones', {
      json: { provisioned: 0, pending: 0, unassigned: 0, failed: 0, unknown: 0, total: 0 },
    })

    await page.goto('./dashboard')

    const phoneStatus = page.getByTestId('phone-status-card')
    await expect(phoneStatus.getByTestId('breakdown-empty')).toHaveText('No physical phones')
    await expect(phoneStatus.getByRole('img')).toHaveCount(0)
    await expect(phoneStatus.getByTestId('breakdown-failed')).toHaveText('0')
  })

  test('reports the system information when it cannot be loaded', async ({ page, mockApi }) => {
    let fail = true

    mockApi.on('GET', '/freepbx/rest/dashboard/system', () =>
      fail ? { status: 500, json: 'An error occurred' } : { json: SYSTEM },
    )

    await page.goto('./dashboard')

    await expect(page.getByText('Cannot load system information')).toBeVisible()
    await expect(page.getByTestId('system-uptime')).toHaveCount(0)
    await expect(page.getByTestId('system-hostname')).toBeVisible()
    await expect(page.getByTestId('subscription-plan')).toHaveText('Enterprise')

    const subscriptionCalls = mockApi.callsTo(
      'GET',
      '/freepbx/rest/mainextensions/userlimits',
    ).length
    fail = false
    await page.getByRole('button', { name: 'Retry' }).click()

    await expect(page.getByTestId('system-uptime')).toHaveText('14 days 6 hours 12 minutes')
    await expect(page.getByText('Cannot load system information')).toHaveCount(0)
    expect(mockApi.callsTo('GET', '/freepbx/rest/mainextensions/userlimits')).toHaveLength(
      subscriptionCalls,
    )
  })

  test('shows a short uptime and hides an unknown release', async ({ page, mockApi }) => {
    mockApi.on('GET', '/freepbx/rest/dashboard/system', {
      json: { ...SYSTEM, release: null, uptime_seconds: 3600 + 59, memory_used_percent: 100 },
    })

    await page.goto('./dashboard')

    await expect(page.getByTestId('system-uptime')).toHaveText('1 hour')
    await expect(page.getByTestId('system-load-memory')).toHaveText('0.42 · 100%')
    await expect(page.getByTestId('system-release')).toHaveCount(0)
  })

  test('explains the hourly chart without calls in the period', async ({ page, mockApi }) => {
    mockApi.on(
      'GET',
      '/freepbx/rest/dashboard/calls',
      callsResponse((range) => ({
        ...callsHistory(range),
        series: callsHistory(range).series.map((point) => ({ ...point, calls: 0 })),
      })),
    )

    await page.goto('./dashboard')

    await expect(page.getByTestId('hourly-calls-empty')).toContainText('No calls in this period')
    await expect(page.getByTestId('hourly-chart')).toHaveCount(0)
  })

  test('always requests the last 15 days and ignores a saved period', async ({ page, mockApi }) => {
    const ranges: string[] = []
    mockApi.on('GET', '/freepbx/rest/dashboard/calls', callsResponse(callsHistory, ranges))
    await page.addInitScript(() =>
      localStorage.setItem('preferences-admin', JSON.stringify({ dashboardCallsRange: '24h' })),
    )

    await page.goto('./dashboard')

    const card = page.getByTestId('hourly-calls-card')
    await expect(card.getByRole('img', { name: startingWith(`${FULL_PERIOD}:`) })).toBeVisible()
    expect(ranges).toEqual(['15d'])
    await expect(card.getByRole('button', { name: /Period/ })).toHaveCount(0)
    await expect(card.getByRole('radio')).toHaveCount(0)
  })

  test('zooms into the dragged period and back', async ({ page }) => {
    await page.goto('./dashboard')

    const card = page.getByTestId('hourly-calls-card')
    const chart = card.getByTestId('hourly-chart')
    const full: [number, number] = [utc(3, 12), utc(18, 11)]
    await expect(chart).toBeVisible()

    await dragOnChart(page, chart, full, utc(10, 0), utc(12, 0))
    await expect(chart.locator('[class*="plotband-area"]')).toHaveCount(1)
    await page.mouse.up()

    await expect(chart.locator('[class*="plotband-area"]')).toHaveCount(0)
    await expect(card.getByTestId('hourly-calls-period')).toHaveText(
      period('Nov 10, 00:00', 'Nov 12, 00:00'),
    )
    await expect(
      chart.and(
        page.getByRole('img', {
          name: `${period('Nov 10, 00:00', 'Nov 12, 00:00')}: 15 calls, busiest hour Tue, Nov 10, 09:00 with 4`,
        }),
      ),
    ).toBeVisible()
    await expect(chart.locator('svg text', { hasText: 'Nov 11' })).toHaveCount(1)
    await expect(chart.locator('svg text', { hasText: '12:00' })).toHaveCount(2)

    await dragOnChart(page, chart, [utc(10, 0), utc(12, 0)], utc(11, 6), utc(11, 12))
    await page.mouse.up()
    await expect(card.getByTestId('hourly-calls-period')).toHaveText(
      period('Nov 11, 06:00', '12:00'),
    )

    await card.getByRole('button', { name: 'Reset zoom' }).click()

    await expect(card.getByTestId('hourly-calls-period')).toHaveCount(0)
    await expect(card.getByRole('button', { name: 'Reset zoom' })).toHaveCount(0)
    await expect(chart).toBeFocused()
    await expect(chart).toHaveAccessibleName(startingWith(`${FULL_PERIOD}:`))
  })

  test('ignores a click, widens a short selection and resets with a double-click', async ({
    page,
  }) => {
    await page.goto('./dashboard')

    const card = page.getByTestId('hourly-calls-card')
    const chart = card.getByTestId('hourly-chart')
    const full: [number, number] = [utc(3, 12), utc(18, 11)]
    await expect(chart).toBeVisible()

    await dragOnChart(page, chart, full, utc(10, 0), utc(10, 0))
    await page.mouse.up()
    await expect(card.getByTestId('hourly-calls-period')).toHaveCount(0)

    await dragOnChart(page, chart, full, utc(10, 0), utc(10, 2))
    await page.mouse.up()
    await expect(card.getByTestId('hourly-calls-period')).toHaveCount(0)

    await dragOnChart(page, chart, full, utc(10, 0), utc(11, 0))
    await page.mouse.up()
    await expect(card.getByTestId('hourly-calls-period')).toHaveText(
      period('Nov 10, 00:00', 'Nov 11, 00:00'),
    )

    await dragOnChart(page, chart, [utc(10, 0), utc(11, 0)], utc(10, 12), utc(10, 13))
    await page.mouse.up()
    await expect(card.getByTestId('hourly-calls-period')).toHaveText(
      period('Nov 10, 11:00', '14:00'),
    )

    await chart.dblclick()

    await expect(card.getByTestId('hourly-calls-period')).toHaveCount(0)
    await expect(chart).toHaveAccessibleName(startingWith(`${FULL_PERIOD}:`))
  })

  test('zooms and moves with the keyboard', async ({ page }) => {
    await page.goto('./dashboard')

    const card = page.getByTestId('hourly-calls-card')
    const chart = card.getByTestId('hourly-chart')
    const visiblePeriod = card.getByTestId('hourly-calls-period')
    await expect(chart).toBeVisible()
    const hint = card.getByTestId('hourly-chart-hint')
    expect((await hint.boundingBox())?.width).toBeLessThanOrEqual(1)

    await chart.focus()
    expect((await hint.boundingBox())?.width).toBeGreaterThan(1)
    await expect(chart).toHaveAccessibleDescription(
      'Drag across the chart to zoom in, double-click to reset. With the keyboard, press + or - to zoom, the left and right arrows to move, Esc to reset.',
    )
    await page.keyboard.press('ArrowRight')
    await expect(visiblePeriod).toHaveCount(0)

    await page.keyboard.press('+')
    await expect(visiblePeriod).toHaveText(period('Nov 7, 06:00', 'Nov 14, 17:00'))
    await page.keyboard.press('+')
    await page.keyboard.press('+')
    await expect(visiblePeriod).toHaveText(period('Nov 10, 01:00', 'Nov 11, 22:00'))
    await expect(card.getByTestId('hourly-chart-announcement')).toHaveText(
      startingWith(`${period('Nov 10, 01:00', 'Nov 11, 22:00')}: 15 calls`),
    )

    await page.keyboard.press('ArrowRight')
    await expect(visiblePeriod).toHaveText(period('Nov 10, 12:00', 'Nov 12, 09:00'))
    await page.keyboard.press('ArrowLeft')
    await expect(visiblePeriod).toHaveText(period('Nov 10, 01:00', 'Nov 11, 22:00'))

    await page.keyboard.press('-')
    await expect(visiblePeriod).toHaveText(period('Nov 9, 03:00', 'Nov 12, 21:00'))

    await page.keyboard.press('Escape')
    await expect(visiblePeriod).toHaveCount(0)
    await expect(chart).toBeFocused()
  })

  test('keeps the zoom on a refresh while the data still covers part of it', async ({
    page,
    mockApi,
  }) => {
    const ranges: string[] = []
    const shiftedBy = (hours: number) => (range: string) => {
      const history = callsHistory(range)

      return {
        ...history,
        series: history.series.map((point) => ({ ...point, time: point.time + hours * HOUR })),
      }
    }
    await page.clock.install()
    await page.goto('./dashboard')

    const card = page.getByTestId('hourly-calls-card')
    const chart = card.getByTestId('hourly-chart')
    const visiblePeriod = card.getByTestId('hourly-calls-period')
    await expect(chart).toBeVisible()
    await chart.focus()
    for (let zoom = 0; zoom < 3; zoom++) {
      await page.keyboard.press('+')
    }
    await expect(visiblePeriod).toHaveText(period('Nov 10, 01:00', 'Nov 11, 22:00'))

    mockApi.on('GET', '/freepbx/rest/dashboard/calls', callsResponse(shiftedBy(1), ranges))
    await page.clock.runFor(6 * 60 * 1000)

    await expect.poll(() => ranges).toEqual(['15d'])
    await expect(visiblePeriod).toHaveText(period('Nov 10, 01:00', 'Nov 11, 22:00'))
    await page.keyboard.press('Escape')
    await expect(chart).toHaveAccessibleName(
      startingWith(`${period('Nov 3, 13:00', 'Nov 18, 12:00')}:`),
    )

    for (let zoom = 0; zoom < 3; zoom++) {
      await page.keyboard.press('+')
    }
    await expect(visiblePeriod).toHaveCount(1)
    mockApi.on('GET', '/freepbx/rest/dashboard/calls', callsResponse(shiftedBy(216), ranges))
    await page.clock.runFor(6 * 60 * 1000)

    await expect.poll(() => ranges).toEqual(['15d', '15d'])
    await expect(visiblePeriod).toHaveCount(0)
    await expect(chart).toHaveAccessibleName(
      startingWith(`${period('Nov 12, 12:00', 'Nov 27, 11:00')}:`),
    )
  })

  test('shows the value of an hour in the tooltip of a zoomed period', async ({ page }) => {
    await page.goto('./dashboard')

    const card = page.getByTestId('hourly-calls-card')
    const chart = card.getByTestId('hourly-chart')
    await expect(chart).toBeVisible()
    await chart.focus()
    for (let zoom = 0; zoom < 3; zoom++) {
      await page.keyboard.press('+')
    }
    await expect(card.getByTestId('hourly-calls-period')).toHaveText(
      period('Nov 10, 01:00', 'Nov 11, 22:00'),
    )
    await chart.scrollIntoViewIfNeeded()
    const box = await chart.boundingBox()
    if (!box) {
      throw new Error('missing chart')
    }

    await page.mouse.move(
      await plotX(chart, [utc(10, 1), utc(11, 22)], utc(11, 9)),
      box.y + box.height / 2,
    )

    await expect(page.getByText('Wed, Nov 11, 09:00')).toBeVisible()
    await expect(page.getByText('Calls: 4', { exact: true })).toBeVisible()
  })

  test('explains that no calls have been recorded yet', async ({ page, mockApi }) => {
    mockApi.on(
      'GET',
      '/freepbx/rest/dashboard/calls',
      callsResponse((range) => callsHistory(range, null)),
    )

    await page.goto('./dashboard')

    const empty = page.getByTestId('hourly-calls-no-data')
    await expect(empty).toContainText('No calls yet')
    await expect(empty).toContainText('Calls will appear here after the first one.')
    await expect(page.getByTestId('hourly-chart')).toHaveCount(0)
  })

  test('shows when a partial history starts', async ({ page, mockApi }) => {
    mockApi.on(
      'GET',
      '/freepbx/rest/dashboard/calls',
      callsResponse((range) => callsHistory(range, LAST_HOUR - 9 * HOUR)),
    )

    await page.goto('./dashboard')

    await expect(page.getByTestId('hourly-calls-available-from')).toHaveText(
      'Data available from Nov 18, 2026, 02:00',
    )
    await expect(page.getByTestId('hourly-chart')).toBeVisible()
  })

  test('moves a card with the keyboard and remembers the order', async ({ page }) => {
    await page.goto('./dashboard')

    const cards = page.getByTestId('dashboard-cards').locator('> li')
    await expect(cards.first()).toHaveAttribute('data-card', 'presence')

    const handle = page.getByRole('button', { name: 'Move Devices' })
    await handle.focus()
    await page.keyboard.press('ArrowLeft')

    await expect(cards.first()).toHaveAttribute('data-card', 'devices')
    await expect(cards.nth(1)).toHaveAttribute('data-card', 'presence')
    await expect(page.getByTestId('card-move-status')).toHaveText(
      'Devices moved to position 1 of 8',
    )
    await expect(page.getByRole('button', { name: 'Move Devices' })).toBeFocused()

    await page.getByRole('button', { name: 'Move User presence' }).focus()
    await page.keyboard.press('ArrowDown')

    await expect(cards.nth(4)).toHaveAttribute('data-card', 'presence')
    await expect(page.getByTestId('card-move-status')).toHaveText(
      'User presence moved to position 5 of 8',
    )
    await expect(page.getByRole('button', { name: 'Move User presence' })).toBeFocused()

    await page.keyboard.press('ArrowUp')

    await expect(cards.nth(2)).toHaveAttribute('data-card', 'presence')
    await expect(cards.nth(3)).toHaveAttribute('data-card', 'callsSummary')

    await page.reload()

    await expect(cards.first()).toHaveAttribute('data-card', 'devices')
    await expect(cards.nth(2)).toHaveAttribute('data-card', 'presence')
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
      .on('GET', '/freepbx/rest/dashboard/live/extensions', {
        json: { '300': extension('300', 'Anna Miller', 'online') },
      })
      .on('GET', '/freepbx/rest/dashboard/live/trunks', { json: {} })

    await page.goto('./dashboard')

    await expect(counterValue(page, 'callsInProgress')).toHaveText('0')
    await expect(page.getByText('No calls in progress')).toBeVisible()
    await expect(page.getByTestId('call-row')).toHaveCount(0)
  })

  test('reports a live data error and retries', async ({ page, mockApi }) => {
    let fail = true

    mockApi.on('GET', '/freepbx/rest/dashboard/live/trunks', () =>
      fail ? { status: 500, json: { message: 'astproxy not ready' } } : { json: TRUNKS },
    )

    await page.goto('./dashboard')

    await expect(page.getByText('Cannot load live data')).toBeVisible()
    await expect(
      page.getByText('The server could not complete the request (error 500). Try again later.'),
    ).toBeVisible()
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
      '/freepbx/rest/dashboard/live/extensions': EXTENSIONS,
      '/freepbx/rest/dashboard/live/trunks': TRUNKS,
      '/freepbx/rest/dashboard/live/users': USERS,
      '/freepbx/rest/cti/groups': [{ id: 1, name: 'Sales' }],
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
    mockApi.on('GET', '/freepbx/rest/dashboard/live/extensions', {
      status: 500,
      json: { message: 'busy' },
    })

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
    mockApi.on('GET', '/freepbx/rest/dashboard/live/users', {
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
      .on('GET', '/freepbx/rest/dashboard/live/extensions', {
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
      .on('GET', '/freepbx/rest/dashboard/live/trunks', {
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
    mockApi.on('GET', '/freepbx/rest/dashboard/live/users', {
      json: { 'e.verdi': ctiUser('offline', []) },
    })

    await page.goto('./dashboard')

    const devices = page.getByTestId('devices-card')
    await expect(devices.getByTestId('breakdown-empty')).toHaveText('No devices connected')
    await expect(devices.getByRole('img')).toHaveCount(0)
    await expect(devices.getByTestId('breakdown-webPhone')).toHaveText('0')
  })

  test('waits for a slow live response before polling again', async ({ page, mockApi }) => {
    let inFlight = 0
    let maxInFlight = 0

    mockApi.on('GET', '/freepbx/rest/dashboard/live/extensions', async () => {
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
    const before = mockApi.callsTo('GET', '/freepbx/rest/dashboard/live/extensions').length

    mockApi.on('GET', '/freepbx/rest/dashboard/live/trunks', { json: {} })
    await page.clock.runFor(6000)

    await expect(page.getByTestId('call-row')).toHaveCount(1)
    expect(
      mockApi.callsTo('GET', '/freepbx/rest/dashboard/live/extensions').length,
    ).toBeGreaterThan(before)
  })

  test('shows the live data to an administrator with only the dashboard section', async ({
    page,
    mockApi,
  }) => {
    await page.addInitScript(() => {
      localStorage.setItem('secretkey', JSON.stringify({ user: 'operator', hash: 'e2e-secret' }))
    })
    mockPermissions(mockApi, ['dashboard'], 'operator')
    await page.goto('./dashboard')

    await expect(counterValue(page, 'callsInProgress')).toHaveText('2')
    await expect(page.getByTestId('presence-card').getByTestId('breakdown-busy')).toHaveText('2')
    await expect(page.getByTestId('devices-card').getByTestId('breakdown-webPhone')).toHaveText('3')
    await expect(page.getByTestId('call-row')).toHaveCount(2)
    await expect(
      page.getByTestId('trunks-card').getByTestId('list-row').filter({ hasText: 'Provider' }),
    ).toContainText('Registered')
    await expect(page.getByTestId('inbound-routes-card')).toBeVisible()
    await expect(page.getByTestId('dashboard-load-error')).toHaveCount(0)
    await expect(page.getByText('Live data not available')).toHaveCount(0)
    for (const counter of ['users', 'trunks', 'inboundRoutes', 'outboundRoutes']) {
      await expect(page.getByTestId(`counter-${counter}`).getByRole('link')).toHaveCount(0)
    }
    for (const path of LIVE_PATHS) {
      expect(mockApi.callsTo('GET', path).length).toBeGreaterThan(0)
    }
  })

  test('shows the live data to a superadmin with another name', async ({ page, mockApi }) => {
    await page.addInitScript(() => {
      localStorage.setItem('secretkey', JSON.stringify({ user: 'boss', hash: 'e2e-secret' }))
    })
    mockPermissions(mockApi, ['superadmin'], 'boss')
    await page.goto('./dashboard')

    await expect(counterValue(page, 'callsInProgress')).toHaveText('2')
    await expect(page.getByTestId('presence-card').getByTestId('breakdown-online')).toHaveText('1')
    await expect(page.getByTestId('call-row')).toHaveCount(2)
    await expect(page.getByTestId('trunks-card')).toBeVisible()
    await expect(page.getByText('Live data not available')).toHaveCount(0)
    await expect(
      page.getByTestId('counter-trunks').getByRole('link', { name: 'Trunks: 1' }),
    ).toBeVisible()
  })

  test('links the trunks and the inbound routes only to who can open them', async ({
    page,
    mockApi,
  }) => {
    mockPermissions(mockApi, ['dashboard', 'routes'])
    await page.goto('./dashboard')

    await expect(page.getByTestId('inbound-routes-card')).toBeVisible()
    await expect(page.getByTestId('presence-card')).toBeVisible()
    await expect(page.getByTestId('trunks-card')).toBeVisible()
    await expect(counterValue(page, 'trunks')).toHaveText('1')
    await expect(page.getByTestId('counter-trunks').getByRole('link')).toHaveCount(0)
    await expect(
      page.getByTestId('counter-inboundRoutes').getByRole('link', { name: 'Inbound routes: 6' }),
    ).toBeVisible()
  })

  test('signs out when the live data route rejects the secret key', async ({ page, mockApi }) => {
    mockApi.on('GET', '/freepbx/rest/dashboard/live/extensions', {
      status: 403,
      json: { error: 'Forbidden: wrong secret key' },
    })

    await page.goto('./dashboard')

    await expect(page).toHaveURL(/\/nethvoice\/login/)
    await expect(page.getByText('Session expired')).toBeVisible()
  })
})
