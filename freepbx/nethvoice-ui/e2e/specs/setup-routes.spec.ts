//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import type { Page } from '@playwright/test'
import { expect, mockWizardState, test, type MockApi } from '../fixtures/mockApi'

const TWT = { trunkid: 2, name: 'TWT-0212345678' }
const VODAFONE = { trunkid: 5, name: 'Vodafone-0698765432' }
const AGENT = { trunkid: 1, name: 'VoiceAgentTrunk_2' }

const TRUNKS = [
  { ...AGENT, tech: 'pjsip', provider: 'satellite-agent' },
  { ...TWT, tech: 'pjsip' },
  { ...VODAFONE, tech: 'pjsip' },
]

const KINDS = ['national', 'cellphone', 'international', 'toll']

const DEFAULTS = {
  en: KINDS.map((kind) => ({ name: `${kind}_en`, trunks: [AGENT, TWT, VODAFONE] })),
  it: KINDS.map((kind) => ({ name: `${kind}_it`, trunks: [AGENT, TWT, VODAFONE] })),
}

const ROUTES = KINDS.map((kind, index) => ({
  route_id: index + 1,
  name: `${kind}_it`,
  seq: index,
  trunks: [TWT, VODAFONE],
}))

const INBOUND_ROUTES = {
  destinations: {
    'ext-queues,400,1': {
      destination: 'ext-queues,400,1',
      description: '400 Sales',
      module: 'queues',
      name: 'Queues',
    },
  },
  routes: [
    {
      extension: '0212345670',
      cidnum: '',
      description: 'Sales department',
      destination: 'ext-queues,400,1',
    },
  ],
}

const mockSummary = (mockApi: MockApi) =>
  mockApi
    .on('GET', '/freepbx/rest/settings/languages', { json: { it: { default: true } } })
    .on('GET', '/freepbx/rest/users/all', { json: [] })
    .on('GET', '/freepbx/rest/trunks', { json: [] })
    .on('GET', '/freepbx/rest/devices/gateways/list/all', { json: [] })

const setCountry = (page: Page, country: string) =>
  page.addInitScript((value) => localStorage.setItem('nethvoiceSetupCountry', value), country)

test.describe('setup wizard: inbound routes', () => {
  test.beforeEach(({ signedIn, mockApi }) => {
    void signedIn
    mockWizardState(mockApi, 4)
    mockApi
      .on('GET', '/freepbx/rest/inboundroutes', { json: INBOUND_ROUTES })
      .on('GET', '/freepbx/rest/outboundroutes', { json: ROUTES })
      .on('GET', '/freepbx/rest/outboundroutes/defaults', { json: DEFAULTS })
      .on('GET', '/freepbx/rest/trunks', { json: [] })
      .on('GET', '/freepbx/rest/providers', { json: [] })
  })

  test('lists the inbound routes and moves to the outbound routes', async ({ page, mockApi }) => {
    await page.goto('./setup/inbound-routes')

    await expect(page.getByRole('heading', { name: 'Inbound routes', level: 1 })).toBeVisible()
    await expect(page.getByText('Step 5 of 7')).toBeVisible()
    await expect(
      page.getByText('Inbound routes are created and managed using the Visual Plan.'),
    ).toBeVisible()
    await expect(page.getByRole('grid', { name: 'Inbound routes' })).toContainText(
      'Queue: Sales (400)',
    )
    await expect(page.getByRole('button', { name: /Create route/ })).toBeVisible()

    await page.getByRole('button', { name: 'Next' }).click()

    await expect(page).toHaveURL(/\/nethvoice\/setup\/outbound-routes$/)
    expect(mockApi.callsTo('POST', '/freepbx/rest/configuration/wizard')[0].body).toEqual({
      step: 5,
      status: 'true',
    })
  })

  test('shows an empty state when there are no inbound routes', async ({ page, mockApi }) => {
    mockApi.on('GET', '/freepbx/rest/inboundroutes', { json: { destinations: {}, routes: [] } })

    await page.goto('./setup/inbound-routes')

    await expect(page.getByText('No inbound routes')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Next' })).toBeEnabled()
  })
})

test.describe('setup wizard: outbound routes', () => {
  test.beforeEach(({ signedIn, mockApi }) => {
    void signedIn
    mockWizardState(mockApi, 5)
    mockApi
      .on('GET', '/freepbx/rest/outboundroutes', { json: ROUTES })
      .on('GET', '/freepbx/rest/outboundroutes/defaults', { json: DEFAULTS })
      .on('POST', '/freepbx/rest/outboundroutes', { status: 200 })
      .on('GET', '/freepbx/rest/trunks', { json: TRUNKS })
      .on('GET', '/freepbx/rest/providers', { json: [] })
  })

  test('creates the default routes of the chosen country once', async ({ page, mockApi }) => {
    let created = false

    mockApi
      .on('GET', '/freepbx/rest/outboundroutes', () => ({ json: created ? ROUTES : [] }))
      .on('POST', '/freepbx/rest/outboundroutes', () => {
        created = true
        return { status: 200 }
      })
    await setCountry(page, 'it')

    await page.goto('./setup/outbound-routes')

    await expect(page.getByText('Calls within the country')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Next' })).toBeEnabled()
    expect(mockApi.callsTo('POST', '/freepbx/rest/outboundroutes')).toHaveLength(1)
    expect(mockApi.callsTo('POST', '/freepbx/rest/outboundroutes')[0].body).toEqual({
      it: KINDS.map((kind) => ({ name: `${kind}_it`, trunks: [TWT, VODAFONE] })),
    })
  })

  test('keeps the existing routes', async ({ page, mockApi }) => {
    await setCountry(page, 'en')
    mockSummary(mockApi).on('GET', '/freepbx/rest/inboundroutes', { json: INBOUND_ROUTES })

    await page.goto('./setup/outbound-routes')

    await expect(page.getByText('Step 6 of 7')).toBeVisible()
    await expect(page.getByText('Calls within the country')).toBeVisible()
    await expect(page.getByRole('textbox', { name: 'Filter routes' })).toHaveCount(0)

    await page.getByRole('button', { name: 'Next' }).click()

    await expect(page).toHaveURL(/\/nethvoice\/setup\/summary$/)
    expect(mockApi.callsTo('POST', '/freepbx/rest/outboundroutes')).toHaveLength(0)
    expect(mockApi.callsTo('POST', '/freepbx/rest/configuration/wizard')[0].body).toEqual({
      step: 12,
      status: 'true',
    })
  })

  test('lets the admin pick the country when the first step was skipped', async ({
    page,
    mockApi,
  }) => {
    mockApi.on('GET', '/freepbx/rest/outboundroutes', { json: [] })

    await page.goto('./setup/outbound-routes')

    await expect(page.getByText('No outbound routes')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Create default routes' })).toBeVisible()
    expect(mockApi.callsTo('POST', '/freepbx/rest/outboundroutes')).toHaveLength(0)
  })

  test('reports a failure to create the default routes', async ({ page, mockApi }) => {
    mockApi
      .on('GET', '/freepbx/rest/outboundroutes', { json: [] })
      .on('POST', '/freepbx/rest/outboundroutes', { status: 500, json: 'An error occurred' })
    await setCountry(page, 'it')

    await page.goto('./setup/outbound-routes')

    await expect(page.getByText('Cannot create default outbound routes')).toBeVisible()
    expect(mockApi.callsTo('POST', '/freepbx/rest/outboundroutes')).toHaveLength(1)
  })

  test('edits the trunks of a route from the wizard', async ({ page, mockApi }) => {
    await setCountry(page, 'it')
    await page.goto('./setup/outbound-routes')

    await page
      .getByRole('grid', { name: 'Outbound routes' })
      .getByRole('row')
      .filter({ hasText: 'International' })
      .getByRole('button', { name: /Edit/ })
      .click()

    const drawer = page.getByRole('dialog')

    await drawer.getByRole('button', { name: 'Remove TWT-0212345678' }).click()
    await drawer.getByRole('button', { name: 'Save' }).click()
    await expect(drawer).toBeHidden()

    const body = mockApi.callsTo('POST', '/freepbx/rest/outboundroutes')[0].body as Record<
      string,
      { route_id: number; trunks: unknown[] }[]
    >
    expect(body.it.map((route) => route.route_id)).toEqual([1, 2, 3, 4])
    expect(body.it[2].trunks).toEqual([VODAFONE])
  })
})
