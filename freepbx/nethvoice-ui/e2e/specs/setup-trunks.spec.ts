//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { expect, test } from '../fixtures/mockApi'
import { mockTrunksApi } from './trunks-data'

test.describe('setup: trunks', () => {
  const pageErrors: string[] = []

  test.beforeEach(({ page }) => {
    pageErrors.length = 0
    page.on('pageerror', (error) => pageErrors.push(error.message))
  })

  test.afterEach(() => {
    expect(pageErrors).toEqual([])
  })

  test.beforeEach(async ({ signedIn, mockApi }) => {
    void signedIn
    mockApi.on('GET', '/freepbx/rest/configuration/wizard', { json: [{ step: 2, status: 'true' }] })
  })

  test('manages the physical trunks in step 3 and can be skipped', async ({ page, mockApi }) => {
    mockTrunksApi(mockApi, { gateways: [] })
    await page.goto('./setup/physical-trunks')

    await expect(page.getByRole('heading', { name: 'Physical trunks', level: 1 })).toBeVisible()
    await expect(page.getByText('Step 3 of 7')).toBeVisible()
    await expect(page.getByText('No physical trunks configured')).toBeVisible()

    await page.getByRole('button', { name: 'Add physical trunk' }).click()
    await expect(page.getByRole('heading', { name: 'Add physical trunk' })).toBeVisible()
    await page.getByRole('button', { name: 'Cancel' }).click()

    await page.getByRole('button', { name: 'Next' }).click()
    await expect(page).toHaveURL(/\/setup\/voip-trunks$/)
    expect(mockApi.callsTo('POST', '/freepbx/rest/configuration/wizard')[0].body).toEqual({
      step: 3,
      status: 'true',
    })
  })

  test('manages the VoIP trunks in step 4 and can be skipped', async ({ page, mockApi }) => {
    mockTrunksApi(mockApi)
    mockApi.on('GET', '/freepbx/rest/inboundroutes', { json: { destinations: {}, routes: [] } })
    await page.goto('./setup/voip-trunks')

    await expect(page.getByRole('heading', { name: 'VoIP trunks', level: 1 })).toBeVisible()
    await expect(page.getByText('Step 4 of 7')).toBeVisible()
    await expect(page.getByRole('row', { name: /main_trunk/ })).toContainText('Registered')
    await expect(page.getByText('Patton_0b1cdd_isdn_0')).toHaveCount(0)

    await page.getByRole('button', { name: 'Add VoIP trunk' }).click()
    await expect(page.getByRole('heading', { name: 'Add VoIP trunk' })).toBeVisible()
    await page.getByRole('button', { name: 'Cancel' }).click()

    await page.getByRole('button', { name: 'Next' }).click()
    await expect(page).toHaveURL(/\/setup\/inbound-routes$/)
    expect(mockApi.callsTo('POST', '/freepbx/rest/configuration/wizard')[0].body).toEqual({
      step: 4,
      status: 'true',
    })
  })
})
