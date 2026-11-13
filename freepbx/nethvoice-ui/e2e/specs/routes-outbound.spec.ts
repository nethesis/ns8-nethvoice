//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import type { Page } from '@playwright/test'
import { expect, test } from '../fixtures/mockApi'

const TWT = { trunkid: 2, name: 'TWT-0212345678' }
const VODAFONE = { trunkid: 5, name: 'Vodafone-0698765432' }
const TIM = { trunkid: 7, name: 'TIM-0114455667' }
const AGENT = { trunkid: 1, name: 'VoiceAgentTrunk_2' }
const BACKUP = { trunkid: 9, name: 'Backup-0611223344' }
const DELETED = { trunkid: 42, name: null }

const TRUNKS = [
  { ...AGENT, tech: 'pjsip', provider: 'satellite-agent' },
  { ...TWT, tech: 'pjsip' },
  { ...VODAFONE, tech: 'pjsip' },
  { ...TIM, tech: 'pjsip' },
  { ...BACKUP, tech: 'pjsip', disabled: 'on' },
]

const KINDS = ['national', 'cellphone', 'international', 'toll']

const ROUTES = [
  { route_id: 1, name: 'national_it', seq: 0, outcid: '', trunks: [TWT, VODAFONE, TIM] },
  { route_id: 2, name: 'cellphone_it', seq: 1, trunks: [TWT, VODAFONE] },
  { route_id: 3, name: 'international_it', seq: 2, trunks: [TWT, VODAFONE, TIM] },
  { route_id: 4, name: 'toll_it', seq: 3, trunks: [] },
  { route_id: 8, name: 'Emergency', seq: 4, trunks: [VODAFONE, BACKUP, DELETED] },
]

const DEFAULTS = {
  en: KINDS.map((kind) => ({ name: `${kind}_en`, trunks: [AGENT, TWT, VODAFONE, TIM, BACKUP] })),
  it: KINDS.map((kind) => ({ name: `${kind}_it`, trunks: [AGENT, TWT, VODAFONE, TIM, BACKUP] })),
}

type OpenedWindows = { __openedUrls?: string[] }

const recordWindowOpen = (page: Page) =>
  page.addInitScript(() => {
    const target = window as unknown as OpenedWindows

    target.__openedUrls = []
    window.open = (url?: string | URL) => {
      target.__openedUrls?.push(String(url))
      return null
    }
  })

const openedUrls = (page: Page) =>
  page.evaluate(() => (window as unknown as OpenedWindows).__openedUrls ?? [])

const routeRow = (page: Page, title: string) =>
  page
    .getByRole('grid', { name: 'Outbound routes' })
    .getByRole('row')
    .filter({ has: page.getByText(title, { exact: true }) })

test.describe('routes: outbound', () => {
  test.beforeEach(async ({ page, signedIn, mockApi }) => {
    void signedIn
    mockApi
      .on('GET', '/freepbx/rest/outboundroutes', { json: ROUTES })
      .on('GET', '/freepbx/rest/outboundroutes/defaults', { json: DEFAULTS })
      .on('POST', '/freepbx/rest/outboundroutes', { status: 200 })
      .on('GET', '/freepbx/rest/trunks', { json: TRUNKS })
      .on('GET', '/freepbx/rest/providers', { json: [] })
    await recordWindowOpen(page)
  })

  test('labels the trunks with provider and phone number', async ({ page, mockApi }) => {
    mockApi
      .on('GET', '/freepbx/rest/trunks', {
        json: [
          {
            trunkid: 2,
            tech: 'pjsip',
            name: 'main_trunk',
            outcid: '0212345678',
            provider: 'twt',
            details: { sip_server: 'sip.example.org', codecs: 'alaw' },
          },
        ],
      })
      .on('GET', '/freepbx/rest/providers', {
        json: [{ id: 13, provider: 'twt', description: 'TWT', codecs: 'ulaw,alaw' }],
      })
    await page.goto('./routes/outbound')

    await expect(routeRow(page, 'National')).toContainText('TWT–0212345678')
    await expect(routeRow(page, 'National')).toContainText('Vodafone-0698765432')

    await routeRow(page, 'National').getByRole('button', { name: /Edit/ }).click()
    const drawer = page.getByRole('dialog')
    const trunks = drawer.getByRole('list', { name: 'Trunk priority' }).getByRole('listitem')
    await expect(trunks.first()).toContainText('TWT–0212345678')
  })

  test('lists default and custom routes with their trunks in priority order', async ({ page }) => {
    await page.goto('./routes/outbound')

    const rows = page.getByRole('grid', { name: 'Outbound routes' }).getByRole('row')

    await expect(rows).toHaveCount(6)
    await expect(rows.nth(1)).toContainText('National')
    await expect(rows.nth(1)).toContainText('Calls within the country')
    await expect(rows.nth(1).getByRole('listitem')).toHaveText([
      'TWT-0212345678',
      'Vodafone-0698765432',
      'TIM-0114455667',
    ])
    await expect(routeRow(page, 'Toll')).toContainText('No trunks: calls cannot be placed')
    await expect(routeRow(page, 'Emergency')).toContainText('Custom route')
    await expect(routeRow(page, 'Emergency').getByRole('listitem')).toHaveText([
      'Vodafone-0698765432',
      /Backup-0611223344\s*Disabled/,
      /42\s*Deleted/,
    ])
  })

  test('warns about the routes whose trunks are all disabled', async ({ page, mockApi }) => {
    mockApi
      .on('GET', '/freepbx/rest/outboundroutes', {
        json: [{ route_id: 1, name: 'national_it', seq: 0, trunks: [BACKUP] }],
      })
      .on('GET', '/freepbx/rest/trunks', {
        json: [
          { ...AGENT, tech: 'pjsip', provider: 'satellite-agent' },
          { ...BACKUP, tech: 'pjsip', disabled: 'on' },
        ],
      })
    await page.goto('./routes/outbound')

    await expect(routeRow(page, 'National')).toContainText(
      'No enabled trunks: calls cannot be placed',
    )

    await routeRow(page, 'National').getByRole('button', { name: /Edit/ }).click()
    await expect(page.getByRole('dialog')).toContainText(
      'All trunks are disabled: enable a trunk to add it to this route',
    )
  })

  test('tells apart the routes of two countries', async ({ page, mockApi }) => {
    mockApi.on('GET', '/freepbx/rest/outboundroutes', {
      json: [
        { route_id: 1, name: 'national_it', trunks: [TWT] },
        { route_id: 2, name: 'national_en', trunks: [TWT] },
      ],
    })
    await page.goto('./routes/outbound')

    await expect(routeRow(page, 'National (Italy)')).toBeVisible()
    await expect(routeRow(page, 'National (United States)')).toBeVisible()
  })

  test('opens the FreePBX pages of all routes and of one route', async ({ page }) => {
    await page.goto('./routes/outbound')

    await page.getByRole('button', { name: /Advanced settings/ }).click()
    await page.getByRole('button', { name: 'Open the menu of route Emergency' }).click()
    await page.getByRole('menuitem', { name: 'Route advanced settings' }).click()

    expect(await openedUrls(page)).toEqual([
      '/freepbx/admin/config.php?display=routing',
      '/freepbx/admin/config.php?display=routing&view=form&id=8',
    ])
  })

  test('reports a load error and retries', async ({ page, mockApi }) => {
    let failing = true

    mockApi.on('GET', '/freepbx/rest/outboundroutes', () =>
      failing ? { status: 500, json: 'An error occurred' } : { json: ROUTES },
    )

    await page.goto('./routes/outbound')
    await expect(page.getByText('Cannot load outbound routes')).toBeVisible()

    failing = false
    await page.getByRole('button', { name: 'Retry' }).click()

    await expect(routeRow(page, 'National')).toBeVisible()
  })

  test('creates the default routes of the chosen country when there are none', async ({
    page,
    mockApi,
  }) => {
    let created = false

    mockApi
      .on('GET', '/freepbx/rest/outboundroutes', () => ({ json: created ? ROUTES : [] }))
      .on('POST', '/freepbx/rest/outboundroutes', () => {
        created = true
        return { status: 200 }
      })

    await page.goto('./routes/outbound')
    await expect(page.getByText('No outbound routes')).toBeVisible()
    await page.getByRole('button', { name: 'Create default routes' }).click()

    const modal = page.getByRole('dialog')

    await modal.getByRole('button', { name: 'Create routes' }).click()
    await expect(modal.getByText('Choose a country')).toBeVisible()
    expect(mockApi.callsTo('POST', '/freepbx/rest/outboundroutes')).toHaveLength(0)

    await modal.getByRole('combobox', { name: 'PBX country' }).click()
    await page.getByRole('option', { name: 'Italy' }).click()
    await modal.getByRole('button', { name: 'Create routes' }).click()

    await expect.poll(() => mockApi.callsTo('POST', '/freepbx/rest/outboundroutes').length).toBe(1)
    await expect(modal).toBeHidden()
    expect(mockApi.callsTo('POST', '/freepbx/rest/outboundroutes')[0].body).toEqual({
      it: KINDS.map((kind) => ({ name: `${kind}_it`, trunks: [TWT, VODAFONE, TIM] })),
    })
    await expect(routeRow(page, 'National')).toBeVisible()
  })

  test('reorders, removes and adds trunks, then saves every route in its order', async ({
    page,
    mockApi,
  }) => {
    await page.goto('./routes/outbound')
    await routeRow(page, 'Cellphone').getByRole('button', { name: /Edit/ }).click()

    const drawer = page.getByRole('dialog')
    const trunks = drawer.getByRole('list', { name: 'Trunk priority' }).getByRole('listitem')

    await expect(drawer.getByRole('heading', { name: 'Edit Cellphone' })).toBeVisible()
    await expect(trunks).toHaveText([/TWT-0212345678/, /Vodafone-0698765432/])

    await drawer.getByRole('button', { name: 'Move Vodafone-0698765432 up' }).click()
    await expect(trunks).toHaveText([/Vodafone-0698765432/, /TWT-0212345678/])
    await expect(
      drawer.getByRole('button', { name: 'Move Vodafone-0698765432 down' }),
    ).toBeFocused()

    await drawer.getByRole('button', { name: 'Remove TWT-0212345678' }).click()
    await drawer.getByRole('button', { name: 'Add trunk' }).click()
    await expect(page.getByRole('menuitem')).toHaveText(['TWT-0212345678', 'TIM-0114455667'])
    await page.getByRole('menuitem', { name: 'TIM-0114455667' }).click()
    await expect(trunks).toHaveText([/Vodafone-0698765432/, /TIM-0114455667/])

    await drawer.getByRole('button', { name: 'Save' }).click()

    await expect(drawer).toBeHidden()
    expect(mockApi.callsTo('POST', '/freepbx/rest/outboundroutes')[0].body).toEqual({
      it: [
        { route_id: 1, name: 'national_it', trunks: [TWT, VODAFONE, TIM] },
        { route_id: 2, name: 'cellphone_it', trunks: [VODAFONE, TIM] },
        { route_id: 3, name: 'international_it', trunks: [TWT, VODAFONE, TIM] },
        { route_id: 4, name: 'toll_it', trunks: [] },
        { route_id: 8, name: 'Emergency', trunks: [VODAFONE, BACKUP] },
      ],
    })
    await expect(page.getByText('Route saved')).toBeVisible()
    await expect(page.getByText('The route Cellphone has been saved')).toBeVisible()
  })

  test('asks before discarding the changes and keeps the drawer open while saving', async ({
    page,
    mockApi,
  }) => {
    let release = () => {}
    const pending = new Promise<void>((resolve) => {
      release = resolve
    })

    mockApi.on('POST', '/freepbx/rest/outboundroutes', async () => {
      await pending
      return { status: 200 }
    })
    await page.goto('./routes/outbound')
    await routeRow(page, 'Cellphone').getByRole('button', { name: /Edit/ }).click()

    const drawer = page.getByRole('dialog').filter({ hasText: 'Edit Cellphone' })
    const drawerTitle = drawer.getByRole('heading', { name: 'Edit Cellphone' })

    await drawer.getByRole('button', { name: 'Remove TWT-0212345678' }).click()
    await page.keyboard.press('Escape')

    const discard = page.getByRole('dialog', { name: 'Unsaved changes' })

    await expect(discard.getByRole('heading', { name: 'Unsaved changes' })).toBeVisible()
    await discard.getByRole('button', { name: 'Keep editing' }).click()
    await expect(discard).toBeHidden()
    await expect(drawerTitle).toBeVisible()

    await drawer.getByRole('button', { name: 'Save' }).click()
    await page.keyboard.press('Escape')
    await expect(drawerTitle).toBeVisible()

    release()
    await expect(drawerTitle).toBeHidden()
  })

  test('explains that the route was deleted in the meantime', async ({ page, mockApi }) => {
    let deleted = false

    mockApi.on('GET', '/freepbx/rest/outboundroutes', () => ({
      json: deleted ? ROUTES.filter((route) => route.route_id !== 2) : ROUTES,
    }))
    await page.goto('./routes/outbound')
    await routeRow(page, 'Cellphone').getByRole('button', { name: /Edit/ }).click()

    const drawer = page.getByRole('dialog')

    await drawer.getByRole('button', { name: 'Remove TWT-0212345678' }).click()
    deleted = true
    await drawer.getByRole('button', { name: 'Save' }).click()

    await expect(drawer.getByText('This route no longer exists.')).toBeVisible()
    expect(mockApi.callsTo('POST', '/freepbx/rest/outboundroutes')).toHaveLength(0)
  })

  test('reorders trunks by drag and drop', async ({ page, mockApi }) => {
    await page.goto('./routes/outbound')
    await routeRow(page, 'National').getByRole('button', { name: /Edit/ }).click()

    const drawer = page.getByRole('dialog')
    const trunks = drawer.getByRole('list', { name: 'Trunk priority' }).getByRole('listitem')

    await expect(trunks).toHaveCount(3)
    await trunks.nth(2).dragTo(trunks.nth(0))
    await expect(trunks).toHaveText([/TIM-0114455667/, /TWT-0212345678/, /Vodafone-0698765432/])

    await drawer.getByRole('button', { name: 'Save' }).click()
    await expect.poll(() => mockApi.callsTo('POST', '/freepbx/rest/outboundroutes').length).toBe(1)
    await expect(drawer).toBeHidden()

    const [call] = mockApi.callsTo('POST', '/freepbx/rest/outboundroutes')
    expect((call.body as Record<string, { trunks: unknown }[]>).it[0].trunks).toEqual([
      TIM,
      TWT,
      VODAFONE,
    ])
  })

  test('closes without saving when nothing changed', async ({ page, mockApi }) => {
    await page.goto('./routes/outbound')
    await routeRow(page, 'Emergency').getByRole('button', { name: /Edit/ }).click()

    const drawer = page.getByRole('dialog')

    await drawer.getByRole('button', { name: 'Save' }).click()
    await expect(drawer).toBeHidden()
    expect(mockApi.callsTo('POST', '/freepbx/rest/outboundroutes')).toHaveLength(0)
  })

  test('keeps the drawer open and shows the error when saving fails', async ({ page, mockApi }) => {
    mockApi.on('POST', '/freepbx/rest/outboundroutes', {
      status: 500,
      json: 'An error occurred',
    })

    await page.goto('./routes/outbound')
    await routeRow(page, 'Toll').getByRole('button', { name: /Edit/ }).click()

    const drawer = page.getByRole('dialog')

    await expect(drawer.getByText('No trunks in this route')).toBeVisible()
    await drawer.getByRole('button', { name: 'Add trunk' }).click()
    await page.getByRole('menuitem', { name: 'TWT-0212345678' }).click()
    await drawer.getByRole('button', { name: 'Save' }).click()

    await expect(drawer.getByText('Cannot save route')).toBeVisible()
    await expect(drawer.getByText('An error occurred')).toBeVisible()
  })
})
