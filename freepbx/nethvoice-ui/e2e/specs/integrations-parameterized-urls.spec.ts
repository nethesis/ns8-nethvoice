//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { expect, test } from '../fixtures/mockApi'

const PROFILES = [
  { id: 1, name: 'Base', macro_permissions: {} },
  { id: 2, name: 'Standard', macro_permissions: {} },
  { id: 3, name: 'Advanced', macro_permissions: {} },
  { id: 5, name: 'Sales', macro_permissions: {} },
]

const URLS = [
  {
    id: 4,
    url: 'https://crm.example.com/open?number=$CALLER_NUMBER',
    profiles: '1,2',
    only_queues: false,
  },
  {
    id: 7,
    url: 'https://support.example.com/ticket?caller=$CALLER_NAME',
    profiles: '3',
    only_queues: true,
  },
]

test.describe('integrations: parameterized URLs', () => {
  test.beforeEach(async ({ signedIn, mockApi }) => {
    void signedIn
    mockApi
      .on('GET', '/freepbx/rest/cti/profiles', { json: PROFILES })
      .on('GET', '/freepbx/rest/cti/paramurls', { json: URLS })
  })

  test('lists the URLs with their profiles', async ({ page }) => {
    await page.goto('./integrations/parameterized-urls')

    const rows = page.getByRole('grid', { name: 'Parameterized URLs' }).getByRole('row')

    await expect(rows).toHaveCount(3)
    await expect(rows.nth(1)).toContainText('https://crm.example.com/open?number=$CALLER_NUMBER')
    await expect(rows.nth(1)).toContainText('Base, Standard')
    await expect(rows.nth(1)).toContainText('All calls')
    await expect(rows.nth(2)).toContainText('Advanced')
    await expect(rows.nth(2)).toContainText('Queue calls only')

    await page.getByRole('textbox', { name: 'Filter URLs' }).fill('advanced')
    await expect(rows).toHaveCount(2)
    await expect(rows.nth(1)).toContainText('support.example.com')
  })

  test('shows an empty state', async ({ page, mockApi }) => {
    mockApi.on('GET', '/freepbx/rest/cti/paramurls', { json: [] })

    await page.goto('./integrations/parameterized-urls')

    await expect(page.getByText('No parameterized URLs')).toBeVisible()
    await expect(page.getByRole('grid')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Create URL' })).toHaveCount(1)
  })

  test('reports a load error and retries', async ({ page, mockApi }) => {
    let failing = true

    mockApi.on('GET', '/freepbx/rest/cti/paramurls', () =>
      failing ? { status: 500 } : { json: URLS },
    )

    await page.goto('./integrations/parameterized-urls')
    await expect(page.getByText('Cannot load the parameterized URLs')).toBeVisible()

    failing = false
    await page.getByRole('button', { name: 'Retry' }).click()

    await expect(
      page.getByRole('grid', { name: 'Parameterized URLs' }).getByRole('row'),
    ).toHaveCount(3)
  })

  test('validates and creates a URL', async ({ page, mockApi }) => {
    mockApi.on('POST', '/freepbx/rest/cti/paramurl', { status: 200 })

    await page.goto('./integrations/parameterized-urls')
    await page.getByRole('button', { name: 'Create URL' }).first().click()

    const drawer = page.getByRole('dialog')
    await drawer.getByRole('button', { name: 'Create URL' }).click()

    await expect(drawer.getByText('Enter the URL')).toBeVisible()
    await expect(drawer.getByText('Select at least one profile')).toBeVisible()
    expect(mockApi.callsTo('POST', '/freepbx/rest/cti/paramurl')).toHaveLength(0)

    await drawer.getByRole('textbox', { name: 'URL' }).fill('https://erp.example.com/call?from=')
    await drawer.getByRole('button', { name: 'Insert placeholder $CALLER_NUMBER' }).click()
    await expect(drawer.getByRole('textbox', { name: 'URL' })).toHaveValue(
      'https://erp.example.com/call?from=$CALLER_NUMBER',
    )

    await drawer.getByRole('combobox', { name: 'Profiles' }).click()
    await expect(page.getByRole('option', { name: /Base/ })).toBeDisabled()
    await expect(page.getByRole('option', { name: /Advanced/ })).toBeDisabled()
    await page.getByRole('option', { name: /Sales/ }).click()
    await drawer.getByRole('heading', { name: 'Create URL' }).click()
    await drawer.getByText('Open only for calls coming from a queue').click()
    await drawer.getByRole('button', { name: 'Create URL' }).click()

    await expect(drawer).toBeHidden()
    expect(mockApi.callsTo('POST', '/freepbx/rest/cti/paramurl')[0].body).toEqual({
      url: 'https://erp.example.com/call?from=$CALLER_NUMBER',
      profiles: [5],
      only_queues: true,
    })
  })

  test('warns when every profile already has a URL', async ({ page, mockApi }) => {
    mockApi.on('GET', '/freepbx/rest/cti/profiles', { json: PROFILES.slice(0, 3) })

    await page.goto('./integrations/parameterized-urls')
    await page.getByRole('button', { name: 'Create URL' }).first().click()

    await expect(page.getByRole('dialog').getByText('No profile available')).toBeVisible()
  })

  test('edits a URL and releases the profiles removed from the previous address', async ({
    page,
    mockApi,
  }) => {
    mockApi
      .on('PUT', '/freepbx/rest/cti/paramurl/:id', { status: 200 })
      .on('POST', '/freepbx/rest/cti/paramurl/delete', { status: 200 })

    await page.goto('./integrations/parameterized-urls')
    await page.getByRole('button', { name: /Edit https:\/\/crm\.example\.com/ }).click()

    const drawer = page.getByRole('dialog')
    const url = drawer.getByRole('textbox', { name: 'URL' })

    await expect(url).toHaveValue('https://crm.example.com/open?number=$CALLER_NUMBER')
    await url.fill('https://crm.example.com/v2?number=$CALLER_NUMBER')
    await drawer.getByRole('button', { name: 'Remove Standard' }).click()
    await drawer.getByRole('button', { name: 'Save' }).click()

    await expect(drawer).toBeHidden()
    const put = mockApi.callsTo('PUT', '/freepbx/rest/cti/paramurl/:id')
    expect(put[0].path).toBe('/freepbx/rest/cti/paramurl/4')
    expect(put[0].body).toEqual({
      id: '4',
      url: 'https://crm.example.com/v2?number=$CALLER_NUMBER',
      profiles: [1],
      only_queues: false,
    })
    expect(mockApi.callsTo('POST', '/freepbx/rest/cti/paramurl/delete')[0].body).toEqual({
      url: 'https://crm.example.com/open?number=$CALLER_NUMBER',
      profiles: [2],
    })
  })

  test('keeps the drawer open when saving fails', async ({ page, mockApi }) => {
    mockApi.on('PUT', '/freepbx/rest/cti/paramurl/:id', {
      status: 400,
      json: { status: 'Invalid CTI profile id' },
    })

    await page.goto('./integrations/parameterized-urls')
    await page.getByRole('button', { name: /Edit https:\/\/support/ }).click()

    const drawer = page.getByRole('dialog')
    await drawer.getByRole('button', { name: 'Save' }).click()

    await expect(drawer.getByText('Cannot save the URL')).toBeVisible()
    await expect(drawer.getByText('Invalid CTI profile id')).toBeVisible()
  })

  test('deletes a URL', async ({ page, mockApi }) => {
    mockApi.on('POST', '/freepbx/rest/cti/paramurl/delete', { status: 200 })

    await page.goto('./integrations/parameterized-urls')
    await page
      .getByRole('button', {
        name: 'Open the menu of https://support.example.com/ticket?caller=$CALLER_NAME',
      })
      .click()
    await page.getByRole('menuitem', { name: 'Delete' }).click()

    const modal = page.getByRole('dialog')
    await expect(modal).toContainText(
      'Delete https://support.example.com/ticket?caller=$CALLER_NAME?',
    )
    await modal.getByRole('button', { name: 'Delete' }).click()

    await expect(modal).toBeHidden()
    expect(mockApi.callsTo('POST', '/freepbx/rest/cti/paramurl/delete')[0].body).toEqual({
      url: 'https://support.example.com/ticket?caller=$CALLER_NAME',
      profiles: [3],
    })
  })
})
