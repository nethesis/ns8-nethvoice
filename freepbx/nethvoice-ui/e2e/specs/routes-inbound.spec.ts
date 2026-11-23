//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { expect, test } from '../fixtures/mockApi'
import { EMPTY_VISUAL_PLAN } from './visual-plan-data'

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

const ANY_DID_ROUTES = {
  destinations: INBOUND_ROUTES.destinations,
  routes: [
    { extension: '', cidnum: '', description: 'Fallback', destination: 'ivr-1,s,1' },
    { extension: '', cidnum: '0612345678', description: 'VIP', destination: 'ext-queues,999,1' },
  ],
}

test.describe('routes: inbound', () => {
  test.beforeEach(async ({ signedIn, mockApi }) => {
    void signedIn
    mockApi.on('GET', '/freepbx/rest/inboundroutes', { json: INBOUND_ROUTES })
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

  test('names the routes without a DID and flags the missing destinations', async ({
    page,
    mockApi,
  }) => {
    mockApi.on('GET', '/freepbx/rest/inboundroutes', { json: ANY_DID_ROUTES })
    mockApi.on('POST', '/freepbx/rest/inboundroutes/delete', { status: 200 })

    await page.goto('./routes/inbound')

    const rows = page.getByRole('grid', { name: 'Inbound routes' }).getByRole('row')

    await expect(rows.nth(1)).toContainText('Any DID')
    await expect(rows.nth(1)).toContainText('IVR: Main menu')
    await expect(rows.nth(2)).toContainText('Any DID / 0612345678')
    await expect(rows.nth(2)).toContainText('Invalid destination')
    await expect(rows.nth(2)).not.toContainText('ext-queues')

    await page.getByRole('textbox', { name: 'Filter routes' }).fill('queues')
    await expect(page.getByText('No routes found')).toBeVisible()
    await expect(page.getByText('Try different or fewer words.')).toBeVisible()
    await page.getByRole('button', { name: 'Clear filter' }).click()
    await expect(page.getByRole('textbox', { name: 'Filter routes' })).toHaveValue('')

    await page.getByRole('button', { name: 'Open the menu of route Any DID / 0612345678' }).click()
    await page.getByRole('menuitem', { name: 'Delete route' }).click()
    await expect(page.getByRole('dialog')).toContainText(
      'Route Any DID / 0612345678 will be permanently deleted.',
    )
    await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click()
    await expect(page.getByText('Route Any DID / 0612345678 has been deleted.')).toBeVisible()
  })

  test('filters the routes and clears the filters', async ({ page }) => {
    await page.goto('./routes/inbound')

    const rows = page.getByRole('grid', { name: 'Inbound routes' }).getByRole('row')

    await page.getByRole('textbox', { name: 'Filter routes' }).fill('queue')
    await expect(rows).toHaveCount(2)
    await expect(rows.nth(1)).toContainText('123 / 345')

    await page.getByRole('textbox', { name: 'Filter routes' }).fill('nothing matches')
    await expect(page.getByText('No routes found')).toBeVisible()

    await page.getByRole('button', { name: 'Reset filters' }).first().click()
    await expect(rows).toHaveCount(3)
    await expect(rows.nth(1)).toContainText('123 / 345')
  })

  test('shows an empty state', async ({ page, mockApi }) => {
    mockApi.on('GET', '/freepbx/rest/inboundroutes', { json: { destinations: [], routes: [] } })

    await page.goto('./routes/inbound')

    await expect(page.getByText('No inbound routes configured')).toBeVisible()
    await expect(
      page.getByText('Define how incoming calls are routed to internal destinations.'),
    ).toBeVisible()
    await expect(page.getByRole('grid')).toHaveCount(0)
    await expect(page.getByRole('textbox', { name: 'Filter routes' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /Create route/ })).toHaveCount(1)
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

  test('opens the Visual Plan to create and to edit a route', async ({ page, mockApi }) => {
    mockApi.on('GET', '/freepbx/rest/visualplan', { json: EMPTY_VISUAL_PLAN })
    await page.goto('./routes/inbound')

    await page.getByRole('button', { name: /Create route/ }).click()
    await expect(page).toHaveURL(/\/routes\/visual-plan$/)

    await page.goto('./routes/inbound')
    await page.getByRole('button', { name: /route 123 \/ 345 in the Visual Plan/ }).click()
    await expect(page).toHaveURL(/\/routes\/visual-plan\?route=123(%2F|\/)345$/)
  })

  test('deletes a route after confirmation', async ({ page, mockApi }) => {
    mockApi.on('POST', '/freepbx/rest/inboundroutes/delete', { status: 200 })

    await page.goto('./routes/inbound')
    await page.getByRole('button', { name: 'Open the menu of route 123 / 345' }).click()
    await page.getByRole('menuitem', { name: 'Delete route' }).click()

    const modal = page.getByRole('dialog')

    await expect(modal).toContainText('Route 123 / 345 will be permanently deleted.')
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

  test('keeps the modal open while deleting', async ({ page, mockApi }) => {
    let release = () => {}
    const pending = new Promise<void>((resolve) => {
      release = resolve
    })

    mockApi.on('POST', '/freepbx/rest/inboundroutes/delete', async () => {
      await pending
      return { status: 200 }
    })

    await page.goto('./routes/inbound')
    await page.getByRole('button', { name: 'Open the menu of route 123 / 345' }).click()
    await page.getByRole('menuitem', { name: 'Delete route' }).click()

    const modal = page.getByRole('dialog')

    await modal.getByRole('button', { name: 'Delete' }).click()
    await page.keyboard.press('Escape')
    await expect(modal.getByRole('heading', { name: 'Delete route' })).toBeVisible()

    release()
    await expect(modal).toBeHidden()
  })

  test('closes the modal when the route was already deleted', async ({ page, mockApi }) => {
    mockApi.on('POST', '/freepbx/rest/inboundroutes/delete', { status: 404 })

    await page.goto('./routes/inbound')
    await page.getByRole('button', { name: 'Open the menu of route 0212345670' }).click()
    await page.getByRole('menuitem', { name: 'Delete route' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click()

    await expect(page.getByRole('dialog')).toBeHidden()
    await expect(page.getByText('Route already deleted')).toBeVisible()
  })

  test('keeps the modal open and shows the error when the delete fails', async ({
    page,
    mockApi,
  }) => {
    mockApi.on('POST', '/freepbx/rest/inboundroutes/delete', {
      status: 500,
      json: 'An error occurred',
    })

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
