//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { expect, mockWizardState, test } from '../fixtures/mockApi'
import { mockTrunksApi } from './trunks-data'

const LIVE_PATH = '/freepbx/rest/dashboard/live/trunks'
const LIVE_REFRESH_INTERVAL = 15_000
const CTI_DOWN = { status: 503, json: { message: 'The CTI server is not reachable' } }

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
    await expect(page.getByRole('row', { name: /main_trunk/ })).toContainText('TWT')
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

  test('does not query the live status of the physical trunks', async ({ page, mockApi }) => {
    const consoleErrors: string[] = []
    page.on('console', (message) => {
      if (message.type() === 'error') {
        consoleErrors.push(message.text())
      }
    })
    mockTrunksApi(mockApi)
    mockApi.on('GET', LIVE_PATH, CTI_DOWN)
    await page.clock.install()
    await page.goto('./setup/physical-trunks')

    await expect(page.getByRole('row', { name: /TRINITY ISDN 2 Porte/ })).toContainText('Patton')
    await expect(page.getByRole('columnheader', { name: 'Trunk' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Status' })).toHaveCount(0)
    await expect(page.getByTestId('live-data-unavailable')).toHaveCount(0)
    await page.clock.runFor(LIVE_REFRESH_INTERVAL * 2)
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)))
    expect(mockApi.callsTo('GET', LIVE_PATH)).toHaveLength(0)
    expect(consoleErrors).toEqual([])
  })

  test('does not query the live status of the VoIP trunks', async ({ page, mockApi }) => {
    mockTrunksApi(mockApi)
    mockApi.on('GET', LIVE_PATH, CTI_DOWN).on('POST', '/freepbx/rest/trunks', { status: 200 })
    await page.clock.install()
    await page.goto('./setup/voip-trunks')

    await expect(page.getByRole('row', { name: /main_trunk/ })).toContainText('TWT')
    await expect(page.getByRole('columnheader', { name: 'Codecs' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Provider status' })).toHaveCount(0)
    await expect(page.getByRole('columnheader', { name: 'SIP registration' })).toHaveCount(0)
    await expect(page.getByText('Unknown')).toHaveCount(0)
    await expect(page.getByText('Cannot retrieve the live status of the trunks')).toHaveCount(0)

    await page.getByRole('button', { name: 'Create VoIP trunk' }).click()
    await page.getByRole('combobox', { name: 'Provider' }).click()
    await page.getByRole('option', { name: 'MessageNet' }).click()
    await page.getByRole('textbox', { name: 'Trunk name' }).fill('office_trunk')
    await page.getByRole('textbox', { name: 'Phone number' }).fill('+390212345679')
    await page.getByRole('textbox', { name: 'Username' }).fill('office_user')
    await page.getByLabel('Password').fill('Secret,1234')
    await page.getByRole('button', { name: 'Create', exact: true }).click()
    await expect(page.getByText('Trunk office_trunk has been created.')).toBeVisible()
    await page.clock.runFor(LIVE_REFRESH_INTERVAL * 2)
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)))
    expect(mockApi.callsTo('GET', LIVE_PATH)).toHaveLength(0)
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
