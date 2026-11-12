//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { expect, test } from '../fixtures/mockApi'
import { mockTrunksApi, VOIP_TRUNK } from './trunks-data'

test.describe('trunks: VoIP', () => {
  const pageErrors: string[] = []

  test.beforeEach(({ page }) => {
    pageErrors.length = 0
    page.on('pageerror', (error) => pageErrors.push(error.message))
  })

  test.afterEach(() => {
    expect(pageErrors).toEqual([])
  })

  test.beforeEach(async ({ signedIn }) => {
    void signedIn
  })

  test('lists the VoIP trunks with live status, without the gateway trunks', async ({
    page,
    mockApi,
  }) => {
    mockTrunksApi(mockApi)
    await page.goto('./trunks/voip')

    const rows = page.getByRole('row')
    await expect(rows).toHaveCount(3)

    const main = page.getByRole('row', { name: /main_trunk/ })
    await expect(main).toContainText('TWT')
    await expect(main).toContainText('0212345670')
    await expect(main).toContainText('G.729')
    await expect(main).toContainText('Online')
    await expect(main).toContainText('Registered')

    const backup = page.getByRole('row', { name: /backup_trunk/ })
    await expect(backup).toContainText('sip.backup.example.org')
    await expect(backup).toContainText('alaw, ulaw')
    await expect(backup).toContainText('Offline')
    await expect(backup).toContainText('Rejected')

    await expect(page.getByText('Patton_0b1cdd_isdn_0')).toHaveCount(0)
    expect(JSON.stringify(await page.content())).not.toContain('invented-secret')

    const call = mockApi.callsTo('GET', '/api/astproxy/trunks')[0]
    expect(call).toBeDefined()
  })

  test('filters the trunks', async ({ page, mockApi }) => {
    mockTrunksApi(mockApi)
    await page.goto('./trunks/voip')

    await page.getByRole('textbox', { name: 'Filter trunks' }).fill('backup')
    await expect(page.getByRole('row')).toHaveCount(2)
    await expect(page.getByRole('row', { name: /backup_trunk/ })).toBeVisible()

    await page.getByRole('textbox', { name: 'Filter trunks' }).fill('nothing')
    await expect(page.getByText('No trunks found')).toBeVisible()
    await page.getByRole('button', { name: 'Reset filters' }).last().click()
    await expect(page.getByRole('row')).toHaveCount(3)
  })

  test('shows the empty state', async ({ page, mockApi }) => {
    mockTrunksApi(mockApi, { trunks: [], gateways: [], liveState: {} })
    await page.goto('./trunks/voip')

    await expect(page.getByText('No VoIP trunks configured')).toBeVisible()
    await expect(
      page.getByText(
        'Add VoIP trunks to handle inbound and outbound calls over IP networks. Set up provider connections and parameters required for call routing.',
      ),
    ).toBeVisible()
    await expect(page.getByRole('button', { name: 'Add VoIP trunk' })).toHaveCount(1)
  })

  test('shows a load error and retries', async ({ page, mockApi }) => {
    let failing = true
    mockTrunksApi(mockApi)
    mockApi.on('GET', '/freepbx/rest/trunks', () =>
      failing ? { status: 500, json: 'An error occurred' } : { json: [VOIP_TRUNK] },
    )
    await page.goto('./trunks/voip')

    await expect(page.getByText('Cannot load the VoIP trunks')).toBeVisible()
    failing = false
    await page.getByRole('button', { name: 'Retry' }).click()
    await expect(page.getByRole('row', { name: /main_trunk/ })).toBeVisible()
  })

  test('keeps the list when the live status is not available', async ({ page, mockApi }) => {
    mockTrunksApi(mockApi)
    mockApi.on('GET', '/api/astproxy/trunks', { status: 502, json: { message: 'Bad gateway' } })
    await page.goto('./trunks/voip')

    await expect(page.getByText('Cannot load the live status of the trunks')).toBeVisible()
    await expect(page.getByRole('row', { name: /main_trunk/ })).toContainText('Unknown')
  })

  test('validates the new trunk before calling the API', async ({ page, mockApi }) => {
    mockTrunksApi(mockApi)
    await page.goto('./trunks/voip')

    await page.getByRole('button', { name: 'Add VoIP trunk' }).click()
    await page.getByRole('button', { name: 'Add trunk' }).click()

    await expect(page.getByText('Choose a provider', { exact: true }).last()).toBeVisible()
    await expect(page.getByText('Enter a name for the trunk')).toBeVisible()
    await expect(page.getByText('Enter the phone number')).toBeVisible()
    await expect(page.getByText('Enter the username')).toBeVisible()
    await expect(page.getByText('Enter the password')).toBeVisible()

    await page.getByRole('textbox', { name: 'Trunk name' }).fill('Main trunk')
    await page.getByRole('button', { name: 'Add trunk' }).click()
    await expect(page.getByText('Use only letters, digits, dot, dash and underscore')).toBeVisible()

    await page.getByRole('textbox', { name: 'Trunk name' }).fill('MAIN_TRUNK')
    await page.getByRole('button', { name: 'Add trunk' }).click()
    await expect(page.getByText('Another trunk already uses this name')).toBeVisible()

    expect(mockApi.callsTo('POST', '/freepbx/rest/trunks')).toHaveLength(0)
  })

  test('keeps the trunk name label when the provider uses it as username', async ({
    page,
    mockApi,
  }) => {
    mockTrunksApi(mockApi)
    await page.goto('./trunks/voip')

    await page.getByRole('button', { name: 'Add VoIP trunk' }).click()
    await page.getByRole('combobox', { name: 'Provider' }).click()
    await page.getByRole('option', { name: 'ElevenLabs' }).click()

    await expect(page.getByRole('textbox', { name: 'Trunk name' })).toBeVisible()
    await expect(
      page.getByText('A name to identify this trunk, also used as username'),
    ).toBeVisible()
    await expect(page.getByRole('textbox', { name: 'Username' })).toHaveCount(0)
  })

  test('creates a VoIP trunk', async ({ page, mockApi }) => {
    mockTrunksApi(mockApi)
    mockApi.on('POST', '/freepbx/rest/trunks', { status: 200 })
    await page.goto('./trunks/voip')

    await page.getByRole('button', { name: 'Add VoIP trunk' }).click()
    await page.getByRole('combobox', { name: 'Provider' }).click()
    await page.getByRole('option', { name: 'MessageNet' }).click()
    await page.getByRole('textbox', { name: 'Trunk name' }).fill('office_trunk')
    await page.getByRole('textbox', { name: 'Phone number' }).fill('+390212345679')
    await page.getByRole('textbox', { name: 'Username' }).fill('office_user')
    await page.getByLabel('Password').fill('Secret,1234')
    await page.getByRole('combobox', { name: 'Allowed codecs' }).click()
    await page.getByRole('option', { name: 'G.729' }).click()
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Add trunk' }).click()

    await expect(page.getByText('office_trunk has been created successfully')).toBeVisible()
    expect(mockApi.callsTo('POST', '/freepbx/rest/trunks')[0].body).toEqual({
      provider: 'messagenet',
      name: 'office_trunk',
      username: 'office_user',
      password: 'Secret,1234',
      phone: '+390212345679',
      codecs: ['g729'],
      forceCodec: false,
    })
  })

  test('shows the error of a failed creation inside the drawer', async ({ page, mockApi }) => {
    mockTrunksApi(mockApi)
    mockApi.on('POST', '/freepbx/rest/trunks', { status: 500 })
    await page.goto('./trunks/voip')

    await page.getByRole('button', { name: 'Add VoIP trunk' }).click()
    await page.getByRole('combobox', { name: 'Provider' }).click()
    await page.getByRole('option', { name: 'TWT' }).click()
    await page.getByRole('textbox', { name: 'Trunk name' }).fill('office_trunk')
    await page.getByRole('textbox', { name: 'Phone number' }).fill('0212345679')
    await page.getByRole('textbox', { name: 'Username' }).fill('office_user')
    await page.getByLabel('Password').fill('Secret,1234')
    await page.getByRole('button', { name: 'Add trunk' }).click()

    await expect(page.getByText('Cannot create the trunk')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Add VoIP trunk' })).toBeVisible()
  })

  test('edits a trunk sending only what changed', async ({ page, mockApi }) => {
    mockTrunksApi(mockApi)
    mockApi.on('PATCH', '/freepbx/rest/trunks/:trunkid', { status: 204 })
    await page.goto('./trunks/voip')

    await page
      .getByRole('row', { name: /main_trunk/ })
      .getByRole('button', { name: /Edit/ })
      .click()
    await expect(page.getByRole('textbox', { name: 'Trunk name' })).toBeDisabled()
    await expect(page.getByRole('textbox', { name: 'Provider' })).toHaveValue('TWT')
    await expect(page.getByRole('textbox', { name: 'Username' })).toHaveValue('account_98765')

    await page.getByRole('textbox', { name: 'Phone number' }).fill('0212345699')
    await page.getByRole('button', { name: 'Save' }).click()

    await expect(page.getByText('main_trunk has been updated successfully')).toBeVisible()
    const [call] = mockApi.callsTo('PATCH', '/freepbx/rest/trunks/:trunkid')
    expect(call.path).toBe('/freepbx/rest/trunks/2')
    expect(call.body).toEqual({ username: 'account_98765', phone: '0212345699' })
  })

  test('changes the password and forces the codecs', async ({ page, mockApi }) => {
    mockTrunksApi(mockApi)
    mockApi.on('PATCH', '/freepbx/rest/trunks/:trunkid', { status: 204 })
    await page.goto('./trunks/voip')

    await page
      .getByRole('row', { name: /main_trunk/ })
      .getByRole('button', { name: /Edit/ })
      .click()
    await page.getByLabel('Password').fill('New,5678')
    await page.getByRole('checkbox', { name: 'Disabled' }).check({ force: true })
    await expect(page.getByRole('checkbox', { name: 'Enabled' })).toBeChecked()
    await page.getByRole('button', { name: 'Save' }).click()

    await expect(page.getByText('main_trunk has been updated successfully')).toBeVisible()
    expect(mockApi.callsTo('PATCH', '/freepbx/rest/trunks/:trunkid')[0].body).toEqual({
      password: 'New,5678',
      codecs: ['g729'],
      forceCodec: true,
    })
  })

  test('closes the edit drawer without calling the API when nothing changed', async ({
    page,
    mockApi,
  }) => {
    mockTrunksApi(mockApi)
    await page.goto('./trunks/voip')

    await page
      .getByRole('row', { name: /main_trunk/ })
      .getByRole('button', { name: /Edit/ })
      .click()
    await page.getByRole('button', { name: 'Save' }).click()

    await expect(page.getByRole('heading', { name: 'Edit trunk' })).toBeHidden()
    expect(mockApi.callsTo('PATCH', '/freepbx/rest/trunks/:trunkid')).toHaveLength(0)
  })

  test('deletes a trunk', async ({ page, mockApi }) => {
    mockTrunksApi(mockApi)
    mockApi.on('DELETE', '/freepbx/rest/trunks/:trunkid', { status: 200 })
    await page.goto('./trunks/voip')

    await page.getByRole('button', { name: 'Open the menu of backup_trunk' }).click()
    await page.getByRole('menuitem', { name: 'Delete trunk' }).click()
    await expect(page.getByText('The VoIP trunk backup_trunk will be deleted.')).toBeVisible()
    await page.getByRole('button', { name: 'Delete', exact: true }).click()

    await expect(page.getByText('backup_trunk has been deleted successfully')).toBeVisible()
    expect(mockApi.callsTo('DELETE', '/freepbx/rest/trunks/:trunkid')[0].path).toBe(
      '/freepbx/rest/trunks/3',
    )
  })

  test('shows the error of a failed deletion inside the modal', async ({ page, mockApi }) => {
    mockTrunksApi(mockApi)
    mockApi.on('DELETE', '/freepbx/rest/trunks/:trunkid', { status: 500 })
    await page.goto('./trunks/voip')

    await page.getByRole('button', { name: 'Open the menu of backup_trunk' }).click()
    await page.getByRole('menuitem', { name: 'Delete trunk' }).click()
    await page.getByRole('button', { name: 'Delete', exact: true }).click()

    await expect(page.getByText('Cannot delete the trunk')).toBeVisible()
  })
})
