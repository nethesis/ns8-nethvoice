//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import type { Page } from '@playwright/test'
import { expect, mockWizardState, test, type MockApi } from '../fixtures/mockApi'

const USERS = [
  { id: '1', username: 'a.miller', displayname: 'Anna Miller', default_extension: '300' },
  { id: '2', username: 'b.jones', displayname: 'Bob Jones', default_extension: '301' },
  { id: '3', username: 'c.smith', displayname: 'Carl Smith', default_extension: 'none' },
]

const TRUNKS = [
  {
    trunkid: 2,
    tech: 'pjsip',
    name: 'TWT-0212345678',
    outcid: '+390212345678',
    provider: 'twt',
    disabled: 'off',
    username: 'twt-user',
    details: { codecs: 'alaw', sip_server: 'sip.example.com' },
  },
]

const INBOUND_ROUTES = {
  destinations: [],
  routes: [
    { extension: '+39 02 1234567', cidnum: '', description: 'Main office number' },
    { extension: '+39 02 1234580', cidnum: '', description: 'Sales department' },
  ],
}

const TWT = { trunkid: 2, name: 'TWT-0212345678' }

const OUTBOUND_ROUTES = [
  { route_id: 1, name: 'national_it', trunks: [TWT] },
  { route_id: 2, name: 'cellphone_it', trunks: [TWT] },
  { route_id: 3, name: 'international_it', trunks: [TWT] },
  { route_id: 4, name: 'toll_it', trunks: [TWT] },
]

const mockSummary = (mockApi: MockApi) =>
  mockApi
    .on('GET', '/freepbx/rest/settings/languages', {
      json: { it: { default: true }, en: { default: false } },
    })
    .on('GET', '/freepbx/rest/users/all', { json: USERS })
    .on('GET', '/freepbx/rest/trunks', { json: TRUNKS })
    .on('GET', '/freepbx/rest/devices/gateways/list/all', { json: [] })
    .on('GET', '/freepbx/rest/inboundroutes', { json: INBOUND_ROUTES })
    .on('GET', '/freepbx/rest/outboundroutes', { json: OUTBOUND_ROUTES })

const mockDashboard = (mockApi: MockApi) => {
  for (const path of [
    '/freepbx/rest/users/count',
    '/freepbx/rest/cti/groups',
    '/tancredi/api/v1/phones',
    '/freepbx/rest/trunks/count',
    '/freepbx/rest/inboundroutes/count',
    '/freepbx/rest/outboundroutes/count',
    '/freepbx/rest/mainextensions/userlimits',
    '/api/astproxy/extensions',
    '/api/astproxy/trunks',
    '/api/user/endpoints/all',
  ]) {
    mockApi.on('GET', path, { status: 503 })
  }
}

const section = (page: Page, title: string) =>
  page.locator('section').filter({ has: page.getByRole('heading', { name: title }) })

test.describe('setup wizard: summary', () => {
  test.beforeEach(async ({ page, signedIn, mockApi }) => {
    void signedIn
    mockWizardState(mockApi, 12)
    mockSummary(mockApi)
    await page.addInitScript(() => localStorage.setItem('nethvoiceSetupCountry', 'it'))
  })

  test('summarizes what was configured', async ({ page }) => {
    await page.goto('./setup/summary')

    await expect(page.getByText('Step 7 of 7')).toBeVisible()
    await expect(section(page, '1. System settings')).toContainText('PBX country: Italy')
    await expect(section(page, '1. System settings')).toContainText('PBX language: Italian')
    await expect(section(page, '2. Extensions')).toContainText('2 of 3 users have an extension.')
    await expect(section(page, '3. Physical trunks (optional)')).toContainText(
      'No physical trunks configured',
    )
    await expect(section(page, '4. VoIP trunks')).toContainText('TWT-0212345678')
    await expect(section(page, '4. VoIP trunks')).toContainText('+390212345678')
    await expect(section(page, '5. Inbound routes')).toContainText(
      '+39 02 1234567: Main office number',
    )
    await expect(section(page, '6. Outbound routes')).toContainText('National: TWT-0212345678')
    await expect(page.getByText('Some settings may need attention')).toHaveCount(0)
  })

  test('warns about missing pieces', async ({ page, mockApi }) => {
    mockApi
      .on('GET', '/freepbx/rest/users/all', { json: [USERS[2]] })
      .on('GET', '/freepbx/rest/trunks', { json: [] })
      .on('GET', '/freepbx/rest/inboundroutes', { json: { destinations: [], routes: [] } })
      .on('GET', '/freepbx/rest/outboundroutes', {
        json: [{ route_id: 1, name: 'national_it', trunks: [] }],
      })

    await page.goto('./setup/summary')

    await expect(page.getByText('Some settings may need attention')).toBeVisible()
    await expect(page.getByText('No user has an extension')).toBeVisible()
    await expect(page.getByText('No trunks can be used')).toBeVisible()
    await expect(page.getByText('No inbound routes are configured')).toBeVisible()
    await expect(page.getByText('No outbound route has trunks')).toBeVisible()
    await expect(page.getByText('Some outbound routes have no trunks')).toHaveCount(0)
    await expect(section(page, '6. Outbound routes')).toContainText('National: No trunks')
  })

  test('marks the disabled trunks and gateways and warns when none can be used', async ({
    page,
    mockApi,
  }) => {
    const PATTON = { trunkid: 5, name: 'Patton_106ca3_isdn_1' }

    mockApi
      .on('GET', '/freepbx/rest/trunks', {
        json: [
          { ...TRUNKS[0], disabled: 'on' },
          { trunkid: 5, tech: 'dahdi', name: PATTON.name, disabled: 'on' },
        ],
      })
      .on('GET', '/freepbx/rest/devices/gateways/list/all', {
        json: [
          {
            id: 1,
            model: 3,
            manufacturer: 'Patton',
            name: 'Patton SN4141',
            ipv4_new: '192.168.1.50',
            trunks_isdn: [{ name: 5, type: 'pp' }],
          },
        ],
      })
      .on('GET', '/freepbx/rest/outboundroutes', {
        json: [
          { route_id: 1, name: 'national_it', trunks: [PATTON] },
          { route_id: 2, name: 'cellphone_it', trunks: [TWT, PATTON] },
          { route_id: 3, name: 'international_it', trunks: [] },
        ],
      })

    await page.goto('./setup/summary')

    await expect(page.getByText('No trunks can be used')).toBeVisible()
    await expect(page.getByText('Some outbound routes have no trunks')).toBeVisible()
    await expect(section(page, '3. Physical trunks (optional)')).toContainText(
      'Patton SN4141 192.168.1.50 (Disabled)',
    )
    await expect(section(page, '6. Outbound routes').getByRole('listitem')).toHaveText([
      'National: Patton_106ca3_isdn_1 (Disabled)',
      'Cellphone: TWT-0212345678 (Disabled), Patton_106ca3_isdn_1 (Disabled)',
      'International: No trunks',
    ])
  })

  test('leaves out the AI agents trunk and warns when no trunk can be used', async ({
    page,
    mockApi,
  }) => {
    mockApi.on('GET', '/freepbx/rest/trunks', {
      json: [
        { ...TRUNKS[0], disabled: 'on' },
        {
          trunkid: 3,
          tech: 'pjsip',
          name: 'VoiceAgentTrunk_2',
          outcid: '',
          provider: 'satellite-agent',
          disabled: 'off',
          username: '',
          details: { codecs: 'alaw', sip_server: 'agents.example.com' },
        },
      ],
    })

    await page.goto('./setup/summary')

    await expect(section(page, '4. VoIP trunks')).toContainText('TWT-0212345678')
    await expect(section(page, '4. VoIP trunks')).toContainText('(Disabled)')
    await expect(section(page, '4. VoIP trunks')).not.toContainText('VoiceAgentTrunk_2')
    await expect(page.getByText('No trunks can be used')).toBeVisible()
  })

  test('lists the inbound routes in the order of the routes table', async ({ page, mockApi }) => {
    mockApi.on('GET', '/freepbx/rest/inboundroutes', {
      json: {
        destinations: [],
        routes: [
          { extension: '0211223344', cidnum: '', description: 'Second' },
          { extension: '7777', cidnum: '', description: 'First' },
        ],
      },
    })

    await page.goto('./setup/summary')

    await expect(section(page, '5. Inbound routes').getByRole('listitem')).toHaveText([
      '7777: First',
      '0211223344: Second',
    ])
  })

  test('reports a section that cannot be loaded and retries it', async ({ page, mockApi }) => {
    let failing = true

    mockApi.on('GET', '/freepbx/rest/inboundroutes', () =>
      failing ? { status: 500, json: 'An error occurred' } : { json: INBOUND_ROUTES },
    )

    await page.goto('./setup/summary')
    await expect(section(page, '5. Inbound routes')).toContainText('Cannot load data')

    failing = false
    await section(page, '5. Inbound routes').getByRole('button', { name: 'Retry' }).click()

    await expect(section(page, '5. Inbound routes')).toContainText('Sales department')
  })

  test('completes the setup once and opens the dashboard', async ({ page, mockApi }) => {
    let release: () => void = () => undefined
    const completed = new Promise<void>((resolve) => {
      release = resolve
    })

    mockDashboard(mockApi)
    mockApi.on('POST', '/freepbx/rest/configuration/wizard', async () => {
      await completed
      return { status: 200 }
    })

    await page.goto('./setup/summary')
    await expect(section(page, '6. Outbound routes')).toContainText('National')

    const finish = page.getByRole('button', { name: 'Finish setup' })

    await finish.click()
    const modal = page.getByRole('dialog', { name: 'Finish setup' })
    await expect(modal).toContainText('Asterisk will restart')
    await modal.getByRole('button', { name: 'Finish', exact: true }).click()
    await expect(page.getByText('Adjusting NethVoice settings, almost there…')).toBeVisible()
    await finish.click({ force: true })
    mockApi.on('GET', '/freepbx/rest/configuration/wizard', {
      json: [{ step: 13, status: 'false' }],
    })
    release()

    await expect(page).toHaveURL(/\/nethvoice\/dashboard$/)
    expect(mockApi.callsTo('POST', '/freepbx/rest/configuration/wizard')).toHaveLength(1)
    expect(mockApi.callsTo('POST', '/freepbx/rest/configuration/wizard')[0].body).toEqual({
      step: 13,
      status: 'false',
    })
    expect(await page.evaluate(() => localStorage.getItem('nethvoiceSetupCountry'))).toBe('')
  })

  test('stays on the summary and shows the error when completion fails', async ({
    page,
    mockApi,
  }) => {
    mockApi.on('POST', '/freepbx/rest/configuration/wizard', {
      status: 500,
      json: 'Unable to create notification',
    })

    await page.goto('./setup/summary')
    await page.getByRole('button', { name: 'Finish setup' }).click()
    await page
      .getByRole('dialog', { name: 'Finish setup' })
      .getByRole('button', { name: 'Finish', exact: true })
      .click()

    await expect(page.getByText('Cannot complete the setup')).toBeVisible()
    await expect(page).toHaveURL(/\/nethvoice\/setup\/summary$/)
    await expect(page.getByRole('button', { name: 'Finish setup' })).toBeEnabled()
  })

  test('asks for confirmation before finishing and can be cancelled', async ({ page, mockApi }) => {
    await page.goto('./setup/summary')
    await page.getByRole('button', { name: 'Finish setup' }).click()

    const modal = page.getByRole('dialog', { name: 'Finish setup' })
    await expect(modal).toContainText('NethVoice CTI will restart too')
    await modal.getByRole('button', { name: 'Cancel' }).click()

    await expect(modal).toBeHidden()
    await expect(page).toHaveURL(/\/nethvoice\/setup\/summary$/)
    expect(mockApi.callsTo('POST', '/freepbx/rest/configuration/wizard')).toHaveLength(0)
  })
})
