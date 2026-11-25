//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { expect, mockWizardState, test } from '../fixtures/mockApi'
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
    mockWizardState(mockApi, 3)
  })

  test('manages the physical trunks in step 3 and can be skipped', async ({ page, mockApi }) => {
    mockTrunksApi(mockApi, { gateways: [] })
    await page.goto('./setup/physical-trunks')

    await expect(page.getByRole('heading', { name: 'Physical trunks', level: 1 })).toBeVisible()
    await expect(page.getByText('Step 3 of 7')).toBeVisible()
    await expect(page.getByText('No physical trunks configured')).toBeVisible()

    await page.getByRole('button', { name: 'Create physical trunk' }).click()
    await expect(page.getByRole('heading', { name: 'Create physical trunk' })).toBeVisible()
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

    await page.getByRole('button', { name: 'Create VoIP trunk' }).click()
    await expect(page.getByRole('heading', { name: 'Create VoIP trunk' })).toBeVisible()
    await page.getByRole('button', { name: 'Cancel' }).click()

    await page.getByRole('button', { name: 'Next' }).click()
    await expect(page).toHaveURL(/\/setup\/inbound-routes$/)
    expect(mockApi.callsTo('POST', '/freepbx/rest/configuration/wizard')[0].body).toEqual({
      step: 4,
      status: 'true',
    })
  })
  test('does not delete a trunk once the setup was completed in another session', async ({
    page,
    mockApi,
  }) => {
    mockApi.allowUnmockedCalls()
    mockTrunksApi(mockApi)
    mockApi.on('DELETE', '/freepbx/rest/trunks/:trunkid', { status: 200 })
    await page.goto('./setup/voip-trunks')

    await page.getByRole('button', { name: 'Open the menu of backup_trunk' }).click()
    await page.getByRole('menuitem', { name: 'Delete trunk' }).click()
    mockWizardState(mockApi, 13, false)
    await page.getByRole('button', { name: 'Delete', exact: true }).click()

    await expect(page).toHaveURL(/\/nethvoice\/dashboard$/)
    await expect(page.getByText('Setup already completed')).toBeVisible()
    expect(mockApi.callsTo('DELETE', '/freepbx/rest/trunks/:trunkid')).toHaveLength(0)
  })

  test('still deletes a trunk from the trunks page after the setup', async ({ page, mockApi }) => {
    mockWizardState(mockApi, 13, false)
    mockTrunksApi(mockApi)
    mockApi.on('DELETE', '/freepbx/rest/trunks/:trunkid', { status: 200 })
    await page.goto('./trunks/voip')

    await page.getByRole('button', { name: 'Open the menu of backup_trunk' }).click()
    await page.getByRole('menuitem', { name: 'Delete trunk' }).click()
    await page.getByRole('button', { name: 'Delete', exact: true }).click()

    await expect(page.getByText('Trunk backup_trunk has been deleted.')).toBeVisible()
    expect(mockApi.callsTo('GET', '/freepbx/rest/configuration/wizard')).toHaveLength(1)
  })
})
