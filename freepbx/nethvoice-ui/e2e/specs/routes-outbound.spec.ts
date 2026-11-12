//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import type { Page } from '@playwright/test'
import { expect, test } from '../fixtures/mockApi'

const TWT = { trunkid: 2, name: 'TWT-0212345678' }
const VODAFONE = { trunkid: 5, name: 'Vodafone-0698765432' }
const TIM = { trunkid: 7, name: 'TIM-0114455667' }

const ROUTES = [
  { route_id: 1, name: 'national_it', seq: 0, outcid: '', trunks: [TWT, VODAFONE, TIM] },
  { route_id: 2, name: 'cellphone_it', seq: 1, trunks: [TWT, VODAFONE] },
  { route_id: 3, name: 'international_it', seq: 2, trunks: [TWT, VODAFONE, TIM] },
  { route_id: 4, name: 'toll_it', seq: 3, trunks: [] },
  { route_id: 8, name: 'Emergency', seq: 4, trunks: [VODAFONE] },
]

const DEFAULTS = {
  en: ['national', 'cellphone', 'international', 'toll'].map((kind) => ({
    name: `${kind}_en`,
    trunks: [TWT, VODAFONE, TIM],
  })),
  it: ['national', 'cellphone', 'international', 'toll'].map((kind) => ({
    name: `${kind}_it`,
    trunks: [TWT, VODAFONE, TIM],
  })),
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
      .on('GET', '/freepbx/rest/trunks', { json: [] })
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
    await expect(routeRow(page, 'Toll')).toContainText('No trunks')
    await expect(routeRow(page, 'Emergency')).toContainText('Custom route')
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

    await expect(modal).toBeHidden()
    expect(mockApi.callsTo('POST', '/freepbx/rest/outboundroutes')[0].body).toEqual({
      it: DEFAULTS.it,
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
        { route_id: 8, name: 'Emergency', trunks: [VODAFONE] },
      ],
    })
    await expect(page.getByText('Route saved')).toBeVisible()
  })

  test('reorders trunks by drag and drop', async ({ page, mockApi }) => {
    await page.goto('./routes/outbound')
    await routeRow(page, 'National').getByRole('button', { name: /Edit/ }).click()

    const drawer = page.getByRole('dialog')
    const trunks = drawer.getByRole('list', { name: 'Trunk priority' }).getByRole('listitem')

    await trunks.nth(2).dragTo(trunks.nth(0))
    await expect(trunks).toHaveText([/TIM-0114455667/, /TWT-0212345678/, /Vodafone-0698765432/])

    await drawer.getByRole('button', { name: 'Save' }).click()
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
