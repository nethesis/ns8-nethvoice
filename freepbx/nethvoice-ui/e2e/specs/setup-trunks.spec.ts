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
    await expect(page.getByText('Step 3/7')).toBeVisible()
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
    await expect(page.getByText('Step 4/7')).toBeVisible()
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

  test('shows the physical trunk actions as in the setup design', async ({ page, mockApi }) => {
    mockTrunksApi(mockApi)
    await page.goto('./setup/physical-trunks')

    const filter = page.getByRole('textbox', { name: 'Filter physical trunks' })
    const create = page.getByRole('button', { name: 'Create physical trunk' })
    await expect(filter).toBeVisible()
    await expect(create).toHaveCount(1)
    expect((await create.boundingBox())!.y).toBeLessThan((await filter.boundingBox())!.y)
    await expect(page.getByRole('columnheader', { name: 'MAC address' })).toBeVisible()

    const row = page.getByRole('row', { name: /TRINITY ISDN 2 Porte/ })
    await expect(row.getByRole('button', { name: /Download configuration/ })).toBeVisible()
    await row.getByRole('button', { name: /Open the menu of/ }).click()
    await expect(page.getByRole('menuitem')).toHaveText(['Edit', 'Delete'])
    await page.getByRole('menuitem', { name: 'Edit' }).click()
    await expect(page.getByRole('heading', { name: 'Edit physical trunk' })).toBeVisible()
    await page.getByRole('button', { name: 'Cancel' }).click()

    await row.getByRole('button', { name: /Open the menu of/ }).click()
    await page.getByRole('menuitem', { name: 'Delete', exact: true }).click()
    const modal = page.getByRole('dialog', { name: 'Delete physical trunk' })
    await expect(
      modal.getByText(
        'Physical trunk Patton TRINITY ISDN 2 Porte will be permanently deleted. The gateway will no longer route calls to the PBX.',
      ),
    ).toBeVisible()
  })

  test('puts the create action in the empty state only', async ({ page, mockApi }) => {
    mockTrunksApi(mockApi, { gateways: [] })
    await page.goto('./setup/physical-trunks')

    await expect(
      page.getByText(
        'Create a physical trunk if your PBX is connected to analog or digital lines. You can skip this step.',
      ),
    ).toBeVisible()
    await expect(page.getByRole('button', { name: 'Create physical trunk' })).toHaveCount(1)
    await expect(page.getByRole('textbox', { name: 'Filter physical trunks' })).toHaveCount(0)
  })

  test('suggests the VoIP trunk name from the provider and the number', async ({
    page,
    mockApi,
  }) => {
    mockTrunksApi(mockApi)
    mockApi.on('GET', '/freepbx/rest/inboundroutes', { json: { destinations: {}, routes: [] } })
    await page.goto('./setup/voip-trunks')

    const filter = page.getByRole('textbox', { name: 'Filter VoIP trunks' })
    const create = page.getByRole('button', { name: 'Create VoIP trunk' })
    await expect(filter).toBeVisible()
    expect((await create.boundingBox())!.y).toBeLessThan((await filter.boundingBox())!.y)

    await create.click()
    const name = page.getByRole('textbox', { name: 'Trunk name' })
    await page.getByRole('combobox', { name: 'Provider' }).click()
    await page.getByRole('option', { name: 'MessageNet' }).click()
    await expect(name).toHaveValue('MessageNet')
    await page.getByRole('textbox', { name: 'Phone number' }).fill('+39 02 1234 5679')
    await expect(name).toHaveValue('MessageNet-390212345679')
    await expect(page.getByText('Filled in from the provider and the phone number.')).toBeVisible()

    await name.fill('office_trunk')
    await page.getByRole('textbox', { name: 'Phone number' }).fill('021234567')
    await expect(name).toHaveValue('office_trunk')

    await page.getByRole('button', { name: 'Cancel' }).click()
    await page.getByRole('button', { name: 'Discard changes' }).click()
    await page.getByRole('button', { name: 'Open the menu of backup_trunk' }).click()
    await page.getByRole('menuitem', { name: 'Delete', exact: true }).click()
    const modal = page.getByRole('dialog', { name: 'Delete VoIP trunk' })
    await expect(
      modal.getByText(
        'VoIP trunk backup_trunk will be permanently deleted. It will also be removed from the outbound routes.',
      ),
    ).toBeVisible()
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
    await expect(page.getByText('VoIP trunk office_trunk has been created.')).toBeVisible()
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
    await page.getByRole('menuitem', { name: 'Delete', exact: true }).click()
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
    await page.getByRole('menuitem', { name: 'Delete', exact: true }).click()
    await page.getByRole('button', { name: 'Delete', exact: true }).click()

    await expect(page.getByText('VoIP trunk backup_trunk has been deleted.')).toBeVisible()
    expect(mockApi.callsTo('GET', '/freepbx/rest/configuration/wizard')).toHaveLength(1)
  })
})
