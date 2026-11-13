//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { expect, test } from '../fixtures/mockApi'
import {
  AI_AGENT_TRUNK,
  BACKUP_TRUNK,
  GATEWAY_TRUNK,
  IAX_TRUNK,
  mockTrunksApi,
  VOIP_TRUNK,
} from './trunks-data'

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
    await expect(backup).toContainText('G.711 A-law, G.711 μ-law')
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

  test('shows the reason sent by the API when the creation is refused', async ({
    page,
    mockApi,
  }) => {
    mockTrunksApi(mockApi)
    mockApi.on('POST', '/freepbx/rest/trunks', {
      status: 400,
      json: { error: 'codecs must contain strings' },
    })
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
    await expect(page.getByText('codecs must contain strings')).toBeVisible()
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

  test('changes the password and stops forcing the codecs', async ({ page, mockApi }) => {
    mockTrunksApi(mockApi)
    mockApi.on('PATCH', '/freepbx/rest/trunks/:trunkid', { status: 204 })
    await page.goto('./trunks/voip')

    await page
      .getByRole('row', { name: /main_trunk/ })
      .getByRole('button', { name: /Edit/ })
      .click()
    const forceCodec = page.getByRole('group', { name: 'Force codec' }).getByRole('checkbox')
    await expect(forceCodec).toBeChecked()
    await page.getByLabel('Password').fill('New,5678')
    await forceCodec.dispatchEvent('click')
    await expect(forceCodec).not.toBeChecked()
    await expect(
      page.getByText(
        'The provider codecs are added too: G.711 μ-law, G.711 A-law. Enable Force codec to use only the chosen ones',
      ),
    ).toBeVisible()
    await page.getByRole('button', { name: 'Save' }).click()

    await expect(page.getByText('main_trunk has been updated successfully')).toBeVisible()
    expect(mockApi.callsTo('PATCH', '/freepbx/rest/trunks/:trunkid')[0].body).toEqual({
      password: 'New,5678',
      codecs: ['g729'],
      forceCodec: false,
    })
  })

  test('keeps the codecs forced when they change', async ({ page, mockApi }) => {
    mockTrunksApi(mockApi)
    mockApi.on('PATCH', '/freepbx/rest/trunks/:trunkid', { status: 204 })
    await page.goto('./trunks/voip')

    await page
      .getByRole('row', { name: /main_trunk/ })
      .getByRole('button', { name: /Edit/ })
      .click()
    await page.getByRole('combobox', { name: 'Allowed codecs' }).click()
    await page.getByRole('option', { name: 'G.711 A-law' }).click()
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Save' }).click()

    await expect(page.getByText('main_trunk has been updated successfully')).toBeVisible()
    expect(mockApi.callsTo('PATCH', '/freepbx/rest/trunks/:trunkid')[0].body).toEqual({
      codecs: ['g729', 'alaw'],
      forceCodec: true,
    })
  })

  test('names the force codec toggle and its information button', async ({ page, mockApi }) => {
    mockTrunksApi(mockApi)
    await page.goto('./trunks/voip')

    await page.getByRole('button', { name: 'Add VoIP trunk' }).click()
    await expect(page.getByRole('group', { name: 'Force codec' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'About Force codec' })).toBeVisible()
    await expect(page.getByRole('combobox', { name: 'Provider' })).toBeFocused()
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
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByText('Some outbound routes will have no trunk')).toBeVisible()
    await expect(
      dialog.getByText(
        'These outbound routes use only this trunk and will no longer be able to make calls: Cellphone.',
      ),
    ).toBeVisible()
    await expect(
      dialog.getByText(
        'The trunk will be removed from these outbound routes, which will keep using their other trunks: National.',
      ),
    ).toBeVisible()
    await page.getByRole('button', { name: 'Delete', exact: true }).click()

    await expect(page.getByText('backup_trunk has been deleted successfully')).toBeVisible()
    expect(mockApi.callsTo('DELETE', '/freepbx/rest/trunks/:trunkid')[0].path).toBe(
      '/freepbx/rest/trunks/3',
    )
  })

  test('shows the error of a failed deletion inside the modal', async ({ page, mockApi }) => {
    mockTrunksApi(mockApi)
    mockApi.on('DELETE', '/freepbx/rest/trunks/:trunkid', { status: 500, json: { status: false } })
    await page.goto('./trunks/voip')

    await page.getByRole('button', { name: 'Open the menu of backup_trunk' }).click()
    await page.getByRole('menuitem', { name: 'Delete trunk' }).click()
    await page.getByRole('button', { name: 'Delete', exact: true }).click()

    await expect(page.getByText('Cannot delete the trunk')).toBeVisible()
    await expect(
      page.getByText('The server could not complete the request (error 500). Try again later.'),
    ).toBeVisible()
  })
})

test.describe('trunks: VoIP, special cases', () => {
  test.beforeEach(async ({ signedIn }) => {
    void signedIn
  })

  test('shows the AI agents and the other technologies as read only', async ({ page, mockApi }) => {
    mockTrunksApi(mockApi, {
      trunks: [VOIP_TRUNK, AI_AGENT_TRUNK, IAX_TRUNK],
      gateways: [],
    })
    await page.goto('./trunks/voip')

    const agents = page.getByRole('row', { name: /VoiceAgentTrunk_2/ })
    await expect(agents).toContainText('AI agents')
    await expect(agents).toContainText('Read only')
    await expect(agents.getByRole('button', { name: /Edit/ })).toHaveCount(0)
    await expect(
      page.getByRole('button', { name: 'Open the menu of VoiceAgentTrunk_2' }),
    ).toHaveCount(0)

    const iax = page.getByRole('row', { name: /legacy_iax/ })
    await expect(iax).toContainText('IAX2')
    await expect(iax).toContainText('Disabled')
    await expect(iax).toContainText('Unmonitored')
    await expect(iax).toContainText('Read only')
  })

  test('lists the trunks when the gateways cannot be loaded', async ({ page, mockApi }) => {
    mockTrunksApi(mockApi)
    mockApi.on('GET', '/freepbx/rest/devices/gateways/list/:id', { status: 500 })
    await page.goto('./trunks/voip')

    await expect(
      page.getByText('Cannot load the gateways, so their trunks may be listed here too'),
    ).toBeVisible()
    await expect(page.getByRole('row', { name: /main_trunk/ })).toBeVisible()
    await expect(page.getByText(GATEWAY_TRUNK.name)).toHaveCount(0)
  })

  test('finds the codecs by the label shown in the list', async ({ page, mockApi }) => {
    mockTrunksApi(mockApi)
    await page.goto('./trunks/voip')

    await page.getByRole('textbox', { name: 'Filter trunks' }).fill('g.729')
    await expect(page.getByRole('row', { name: /main_trunk/ })).toBeVisible()
    await expect(page.getByRole('row', { name: new RegExp(BACKUP_TRUNK.name) })).toHaveCount(0)
  })

  test('cleans the phone number and checks name and password', async ({ page, mockApi }) => {
    mockTrunksApi(mockApi)
    mockApi.on('POST', '/freepbx/rest/trunks', { status: 200 })
    await page.goto('./trunks/voip')

    await page.getByRole('button', { name: 'Add VoIP trunk' }).click()
    await page.getByRole('combobox', { name: 'Provider' }).click()
    await page.getByRole('option', { name: 'TWT' }).click()
    const name = page.getByRole('textbox', { name: 'Trunk name' })
    await name.fill('a'.repeat(60))
    await expect(name).toHaveValue('a'.repeat(50))
    await name.fill('office_trunk')
    await page.getByRole('textbox', { name: 'Phone number' }).fill('+39 02-123.4567')
    await page.getByRole('textbox', { name: 'Username' }).fill('office_user')
    await page.getByLabel('Password').fill('   ')
    await page.getByRole('button', { name: 'Add trunk' }).click()

    await expect(page.getByText('The password cannot contain only spaces')).toBeVisible()
    await expect(page.getByRole('textbox', { name: 'Phone number' })).toHaveValue('+39021234567')
    await page.getByLabel('Password').fill('Secret,1234')
    await page.getByRole('button', { name: 'Add trunk' }).click()

    await expect(page.getByText('office_trunk has been created successfully')).toBeVisible()
    expect(mockApi.callsTo('POST', '/freepbx/rest/trunks')[0].body).toMatchObject({
      phone: '+39021234567',
    })
  })

  test('does not close while saving and asks before losing changes', async ({ page, mockApi }) => {
    let release: () => void = () => {}
    const pending = new Promise<void>((resolve) => (release = resolve))
    mockTrunksApi(mockApi)
    mockApi.on('PATCH', '/freepbx/rest/trunks/:trunkid', async () => {
      await pending
      return { status: 204 }
    })
    await page.goto('./trunks/voip')

    await page
      .getByRole('row', { name: /main_trunk/ })
      .getByRole('button', { name: /Edit/ })
      .click()
    const heading = page.getByRole('heading', { name: 'Edit trunk' })
    await page.getByRole('textbox', { name: 'Phone number' }).fill('0212345699')
    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.getByText('Unsaved changes', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Keep editing' }).click()
    await expect(heading).toBeVisible()

    await page.getByRole('button', { name: 'Save' }).click()
    await page.keyboard.press('Escape')
    await expect(heading).toBeVisible()
    release()
    await expect(page.getByText('main_trunk has been updated successfully')).toBeVisible()
    await expect(heading).toBeHidden()
  })

  test('reaches the tabs with the keyboard', async ({ page, mockApi }) => {
    mockTrunksApi(mockApi)
    await page.goto('./trunks/voip')

    const physicalTab = page.getByRole('link', { name: 'Physical trunks' })
    await physicalTab.focus()
    await expect(physicalTab).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/trunks\/physical$/)
  })
})
