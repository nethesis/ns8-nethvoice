//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import type { Page } from '@playwright/test'
import { expect, test } from '../fixtures/mockApi'

const INBOUND_ROUTES = {
  destinations: {
    'ext-queues,400,1': {
      destination: 'ext-queues,400,1',
      description: '400 Customer service',
      module: 'queues',
      name: 'Queues',
      edit_url: '',
    },
    'ivr-1,s,1': {
      destination: 'ivr-1,s,1',
      description: 'Main menu',
      module: 'ivr',
      name: 'IVR',
      edit_url: '',
    },
  },
  routes: [
    {
      extension: '123',
      cidnum: '345',
      description: 'Test',
      destination: 'ext-queues,400,1',
      privacyman: 0,
      mohclass: 'default',
    },
    {
      extension: '0212345670',
      cidnum: '',
      description: 'Main office number',
      destination: 'ivr-1,s,1',
    },
  ],
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

test.describe('routes: inbound', () => {
  test.beforeEach(async ({ page, signedIn, mockApi }) => {
    void signedIn
    mockApi.on('GET', '/freepbx/rest/inboundroutes', { json: INBOUND_ROUTES })
    await recordWindowOpen(page)
  })

  test('lists routes with their resolved destination', async ({ page }) => {
    await page.goto('./routes/inbound')

    const rows = page.getByRole('grid', { name: 'Inbound routes' }).getByRole('row')

    await expect(rows).toHaveCount(3)
    await expect(rows.nth(1)).toContainText('123 / 345')
    await expect(rows.nth(1)).toContainText('Queue: Customer service (400)')
    await expect(rows.nth(2)).toContainText('0212345670')
    await expect(rows.nth(2)).toContainText('Main office number')
    await expect(rows.nth(2)).toContainText('IVR: Main menu')
  })

  test('filters the routes and clears the filters', async ({ page }) => {
    await page.goto('./routes/inbound')

    const rows = page.getByRole('grid', { name: 'Inbound routes' }).getByRole('row')

    await page.getByRole('textbox', { name: 'Filter routes' }).fill('queue')
    await expect(rows).toHaveCount(2)
    await expect(rows.nth(1)).toContainText('123 / 345')

    await page.getByRole('textbox', { name: 'Filter routes' }).fill('nothing matches')
    await expect(page.getByText('No routes found')).toBeVisible()

    await page.getByRole('button', { name: 'Clear filters' }).first().click()
    await expect(rows).toHaveCount(3)
    await expect(rows.nth(1)).toContainText('123 / 345')
  })

  test('shows an empty state', async ({ page, mockApi }) => {
    mockApi.on('GET', '/freepbx/rest/inboundroutes', { json: { destinations: [], routes: [] } })

    await page.goto('./routes/inbound')

    await expect(page.getByText('No inbound routes')).toBeVisible()
    await expect(page.getByRole('grid')).toHaveCount(0)
  })

  test('reports a load error and retries', async ({ page, mockApi }) => {
    let failing = true

    mockApi.on('GET', '/freepbx/rest/inboundroutes', () =>
      failing ? { status: 500, json: 'An error occurred' } : { json: INBOUND_ROUTES },
    )

    await page.goto('./routes/inbound')
    await expect(page.getByText('Cannot load inbound routes')).toBeVisible()

    failing = false
    await page.getByRole('button', { name: 'Retry' }).click()

    await expect(page.getByRole('grid', { name: 'Inbound routes' }).getByRole('row')).toHaveCount(3)
  })

  test('opens the Visual Plan to create and to edit a route', async ({ page }) => {
    await page.goto('./routes/inbound')

    await page.getByRole('button', { name: /Create route/ }).click()
    await page.getByRole('button', { name: /route 123 \/ 345 in the Visual Plan/ }).click()

    expect(await openedUrls(page)).toEqual([
      '/freepbx/visualplan/?did=new_route',
      '/freepbx/visualplan/?did=123%20%2F%20345',
    ])
  })

  test('deletes a route after confirmation', async ({ page, mockApi }) => {
    mockApi.on('POST', '/freepbx/rest/inboundroutes/delete', { status: 200 })

    await page.goto('./routes/inbound')
    await page.getByRole('button', { name: 'Open the menu of route 123 / 345' }).click()
    await page.getByRole('menuitem', { name: 'Delete route' }).click()

    const modal = page.getByRole('dialog')

    await expect(modal).toContainText('This action will remove the route 123 / 345 configuration.')
    const listCalls = mockApi.callsTo('GET', '/freepbx/rest/inboundroutes').length

    await modal.getByRole('button', { name: 'Delete' }).click()

    await expect(modal).toBeHidden()
    expect(mockApi.callsTo('POST', '/freepbx/rest/inboundroutes/delete')[0].body).toEqual({
      extension: '123',
      cid: '345',
    })
    await expect
      .poll(() => mockApi.callsTo('GET', '/freepbx/rest/inboundroutes').length)
      .toBeGreaterThan(listCalls)
    await expect(page.getByText('Route deleted')).toBeVisible()
  })

  test('keeps the modal open and shows the error when the delete fails', async ({
    page,
    mockApi,
  }) => {
    mockApi.on('POST', '/freepbx/rest/inboundroutes/delete', { status: 404 })

    await page.goto('./routes/inbound')
    await page.getByRole('button', { name: 'Open the menu of route 0212345670' }).click()
    await page.getByRole('menuitem', { name: 'Delete route' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click()

    await expect(page.getByRole('dialog')).toContainText('Cannot delete route')
    expect(mockApi.callsTo('POST', '/freepbx/rest/inboundroutes/delete')[0].body).toEqual({
      extension: '0212345670',
      cid: '',
    })
  })
})
