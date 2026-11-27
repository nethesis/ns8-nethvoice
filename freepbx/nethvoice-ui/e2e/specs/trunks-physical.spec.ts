//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { expect, mockPermissions, test } from '../fixtures/mockApi'
import { ISDN_GATEWAY, mockTrunksApi } from './trunks-data'

test.describe('trunks: physical', () => {
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

  test('lists the gateways with their status', async ({ page, mockApi }) => {
    mockTrunksApi(mockApi)
    await page.goto('./trunks/physical')

    await expect(page.getByRole('row')).toHaveCount(3)
    const patton = page.getByRole('row', { name: /TRINITY ISDN 2 Porte/ })
    await expect(patton).toContainText('Patton')
    await expect(patton).toContainText('192.168.10.20')
    await expect(patton).toContainText('00:A0:BA:0B:1C:DD')
    await expect(patton).toContainText('Connected')
    await expect(patton.getByRole('button', { name: '192.168.10.20', exact: true })).toBeVisible()
    await expect(
      patton.getByRole('button', { name: '00:A0:BA:0B:1C:DD', exact: true }),
    ).toBeVisible()

    const grandstream = page.getByRole('row', { name: /HT802 SIP 2 Porte FXS/ })
    await expect(grandstream).toContainText('Grandstream')
    await expect(grandstream).toContainText('Unmonitored')
    expect(mockApi.callsTo('GET', '/freepbx/rest/devices/gateways/list/:id')).not.toHaveLength(0)
  })

  test('keeps the gateways and shows the error above them when a refresh fails', async ({
    page,
    mockApi,
  }) => {
    mockTrunksApi(mockApi)
    await page.clock.install()
    await page.goto('./trunks/physical')
    await expect(page.getByRole('row', { name: /TRINITY ISDN 2 Porte/ })).toBeVisible()

    mockApi.on('GET', '/freepbx/rest/devices/gateways/list/:id', {
      status: 500,
      json: 'An error occurred',
    })
    await page.clock.runFor(10_000)
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))

    await expect(page.getByText('Cannot retrieve the physical trunks')).toBeVisible()
    await expect(page.getByRole('row', { name: /TRINITY ISDN 2 Porte/ })).toBeVisible()
  })

  test('shows the gateway status to an administrator with only the trunks section', async ({
    page,
    mockApi,
  }) => {
    await page.addInitScript(() => {
      localStorage.setItem('secretkey', JSON.stringify({ user: 'operator', hash: 'e2e-secret' }))
    })
    mockPermissions(mockApi, ['trunks'], 'operator')
    mockTrunksApi(mockApi)
    await page.goto('./trunks/physical')

    await expect(page.getByRole('row', { name: /TRINITY ISDN 2 Porte/ })).toContainText('Connected')
    await expect(page.getByTestId('live-data-unavailable')).toHaveCount(0)
  })

  test('keeps the gateways when the live status cannot be loaded', async ({ page, mockApi }) => {
    mockTrunksApi(mockApi)
    mockApi.on('GET', '/freepbx/rest/dashboard/live/trunks', {
      status: 503,
      json: { message: 'The CTI server is not reachable' },
    })
    await page.goto('./trunks/physical')

    await expect(page.getByTestId('live-data-unavailable')).toContainText('Live data not available')
    await expect(page.getByRole('row', { name: /TRINITY ISDN 2 Porte/ })).toContainText('Patton')
  })

  test('filters the gateways', async ({ page, mockApi }) => {
    mockTrunksApi(mockApi)
    await page.goto('./trunks/physical')

    await page.getByRole('textbox', { name: 'Filter physical trunks' }).fill('02:2A')
    await expect(page.getByRole('row')).toHaveCount(2)
    await expect(page.getByRole('row', { name: /HT802/ })).toBeVisible()
  })

  test('shows the empty state', async ({ page, mockApi }) => {
    mockTrunksApi(mockApi, { gateways: [] })
    await page.goto('./trunks/physical')

    await expect(page.getByText('No physical trunks configured')).toBeVisible()
    await expect(
      page.getByText('Create physical trunks to connect your PBX to traditional telephony lines.'),
    ).toBeVisible()
    await expect(
      page.getByText(
        'Use a supported gateway to enable communication with analog or ISDN networks.',
      ),
    ).toBeVisible()
  })

  test('shows a load error and retries', async ({ page, mockApi }) => {
    let failing = true
    mockTrunksApi(mockApi)
    mockApi.on('GET', '/freepbx/rest/devices/gateways/list/:id', () =>
      failing ? { status: 500 } : { json: [ISDN_GATEWAY] },
    )
    await page.goto('./trunks/physical')

    await expect(page.getByText('Cannot retrieve the physical trunks')).toBeVisible()
    failing = false
    await page.getByRole('button', { name: 'Retry' }).click()
    await expect(page.getByRole('row', { name: /TRINITY ISDN 2 Porte/ })).toBeVisible()
  })

  test('validates a new gateway before calling the API', async ({ page, mockApi }) => {
    mockTrunksApi(mockApi)
    await page.goto('./trunks/physical')

    await page.getByRole('button', { name: 'Create physical trunk' }).click()
    await expect(page.getByRole('textbox', { name: 'MAC address' })).toHaveAttribute(
      'placeholder',
      'e.g. 00:1A:2B:3C:4D:5E',
    )
    await expect(page.getByRole('textbox', { name: 'Device IP address' })).toHaveAttribute(
      'placeholder',
      'e.g. 192.168.1.10',
    )
    await expect(page.getByRole('textbox', { name: 'PBX address' })).toHaveAttribute(
      'placeholder',
      'e.g. 192.168.1.2',
    )
    await page.getByRole('textbox', { name: 'PBX address' }).fill('')
    await page.getByRole('button', { name: 'Create', exact: true }).click()

    await expect(page.getByText('Choose a manufacturer')).toBeVisible()
    await expect(page.getByText('Choose a model', { exact: true }).last()).toBeVisible()
    await expect(page.getByText('Enter the MAC address')).toBeVisible()
    await expect(page.getByText('Enter the IP address')).toBeVisible()
    await expect(page.getByText('Enter the subnet mask')).toBeVisible()
    await expect(page.getByText('Enter the network gateway')).toBeVisible()
    await expect(page.getByText('Enter the PBX address')).toBeVisible()

    await page.getByText('Patton', { exact: true }).last().click()
    await page.getByRole('combobox', { name: 'Device model' }).click()
    await page.getByRole('option', { name: /TRI_ISDN_2/ }).click()
    await page.getByRole('textbox', { name: 'MAC address' }).fill('00:a0:ba:0b:1c:dd')
    await page.getByRole('textbox', { name: 'Device IP address' }).fill('192.168.10.300')
    await page.getByRole('textbox', { name: 'Subnet mask' }).fill('255.0.255.0')
    await page.getByRole('button', { name: 'Create', exact: true }).click()

    await expect(page.getByText('Another gateway already uses this MAC address')).toBeVisible()
    await expect(page.getByText('Enter a valid IPv4 address')).toBeVisible()
    await expect(page.getByText('Enter a valid subnet mask, like 255.255.255.0')).toBeVisible()
    expect(mockApi.callsTo('POST', '/freepbx/rest/devices/gateways')).toHaveLength(0)
  })

  test('creates an ISDN gateway', async ({ page, mockApi }) => {
    mockTrunksApi(mockApi)
    mockApi.on('POST', '/freepbx/rest/devices/gateways', {
      json: { status: true, errors: [], warnings: [], infos: [], id: 8 },
    })
    await page.goto('./trunks/physical')

    await page.getByRole('button', { name: 'Create physical trunk' }).click()
    await expect(page.getByRole('textbox', { name: 'PBX address' })).toHaveValue(
      'voice.example.org',
    )
    await page.getByText('Patton', { exact: true }).last().click()
    await page.getByRole('combobox', { name: 'Device model' }).click()
    await page.getByRole('option', { name: /TRI_ISDN_2/ }).click()
    await page.getByRole('textbox', { name: 'MAC address' }).fill('00-a0-ba-0b-1c-ee')
    await page.getByRole('textbox', { name: 'Device IP address' }).fill('192.168.10.21')
    await page.getByRole('textbox', { name: 'Subnet mask' }).fill('255.255.255.0')
    await page.getByRole('textbox', { name: 'Network gateway' }).fill('192.168.10.1')
    await page
      .getByRole('group', { name: 'ISDN port 1 mode' })
      .getByText('Point-to-multipoint')
      .click()
    await page.getByRole('button', { name: 'Create', exact: true }).click()

    await expect(
      page.getByText('Physical trunk Patton TRINITY ISDN 2 Porte has been created.'),
    ).toBeVisible()
    expect(mockApi.callsTo('POST', '/freepbx/rest/devices/gateways')[0].body).toEqual({
      name: 'Patton-TRINITY ISDN 2 Porte',
      model: 17,
      manufacturer: 'Patton',
      mac: '00:A0:BA:0B:1C:EE',
      ipv4: '',
      ipv4_new: '192.168.10.21',
      netmask_green: '255.255.255.0',
      gateway: '192.168.10.1',
      ipv4_green: 'voice.example.org',
      proxy: 'sip:10.5.4.1:5060;lr',
      trunks_isdn: [
        { name: 0, type: 'pp' },
        { name: 1, type: 'pmp' },
      ],
      trunks_pri: [],
      trunks_fxo: [],
      trunks_fxs: [],
    })
  })

  test('creates an FXS gateway assigning users to the ports', async ({ page, mockApi }) => {
    mockTrunksApi(mockApi, { gateways: [ISDN_GATEWAY] })
    mockApi.on('POST', '/freepbx/rest/devices/gateways', { json: { status: true, id: 9 } })
    await page.goto('./trunks/physical')

    await page.getByRole('button', { name: 'Create physical trunk' }).click()
    await page.getByText('Grandstream', { exact: true }).last().click()
    await page.getByRole('combobox', { name: 'Device model' }).click()
    await page.getByRole('option', { name: /ht802/ }).click()
    await page.getByRole('textbox', { name: 'MAC address' }).fill('02:2a:3b:4c:5d:6e')
    await page.getByRole('textbox', { name: 'Device IP address' }).fill('192.168.10.24')
    await page.getByRole('textbox', { name: 'Subnet mask' }).fill('255.255.255.0')
    await page.getByRole('textbox', { name: 'Network gateway' }).fill('192.168.10.1')
    await page.getByRole('combobox', { name: 'Port FXS 1' }).click()
    await page.getByRole('option', { name: /c\.davis \(301\)/ }).click()
    await page.getByRole('button', { name: 'Create', exact: true }).click()

    await expect(
      page.getByText(/Physical trunk .*HT802 SIP 2 Porte FXS has been created\./),
    ).toBeVisible()
    const { body } = mockApi.callsTo('POST', '/freepbx/rest/devices/gateways')[0]
    expect(body).toMatchObject({
      name: 'Grandstream-HT802 SIP 2 Porte FXS',
      model: 33,
      mac: '02:2A:3B:4C:5D:6E',
      trunks_isdn: [],
      trunks_fxs: [{ name: 1, linked_extension: '301' }],
    })
  })

  test('shows the errors returned by the API inside the drawer', async ({ page, mockApi }) => {
    mockTrunksApi(mockApi, { gateways: [] })
    mockApi.on('POST', '/freepbx/rest/devices/gateways', {
      status: 400,
      json: {
        status: false,
        errors: ['Missing gateway field mac', 'Gateway model not found'],
        warnings: ['Ignored warning'],
        infos: [],
      },
    })
    await page.goto('./trunks/physical')

    await page.getByRole('button', { name: 'Create physical trunk' }).click()
    await page.getByText('Patton', { exact: true }).last().click()
    await page.getByRole('combobox', { name: 'Device model' }).click()
    await page.getByRole('option', { name: /TRI_PRI_1/ }).click()
    await page.getByRole('textbox', { name: 'MAC address' }).fill('00:a0:ba:0b:1c:ee')
    await page.getByRole('textbox', { name: 'Device IP address' }).fill('192.168.10.21')
    await page.getByRole('textbox', { name: 'Subnet mask' }).fill('255.255.255.0')
    await page.getByRole('textbox', { name: 'Network gateway' }).fill('192.168.10.1')
    await page.getByRole('button', { name: 'Create', exact: true }).click()

    await expect(page.getByText('Cannot create the trunk')).toBeVisible()
    await expect(
      page.getByText('Missing gateway field mac; Gateway model not found', { exact: true }),
    ).toBeVisible()
    await expect(page.getByText('Ignored warning')).toHaveCount(0)
    expect(mockApi.callsTo('POST', '/freepbx/rest/devices/gateways')[0].body).toMatchObject({
      trunks_pri: [{ name: 0 }],
    })
  })

  test('edits a gateway and warns before deleting the extension of an FXS port', async ({
    page,
    mockApi,
  }) => {
    mockTrunksApi(mockApi)
    mockApi.on('PUT', '/freepbx/rest/devices/gateways/:id', { json: { status: true, id: 4 } })
    await page.goto('./trunks/physical')

    await page.getByRole('button', { name: /Open the menu of Grandstream/ }).click()
    await page.getByRole('menuitem', { name: 'Edit', exact: true }).click()

    await expect(page.getByRole('heading', { name: 'Edit physical trunk' })).toBeVisible()
    await expect(page.getByRole('combobox', { name: 'Device model' })).toBeDisabled()
    await expect(
      page.getByText('To use another model, delete the trunk and create it again'),
    ).toBeVisible()
    const macAddress = page.getByRole('textbox', { name: 'MAC address' })
    await expect(macAddress).toHaveValue('02:2A:3B:4C:5D:6E')
    await expect(macAddress).toBeEnabled()
    await expect(macAddress).toBeFocused()
    await expect(page.getByRole('combobox', { name: 'Port FXS 1' })).toHaveValue(/c\.davis/)
    await expect(page.getByText('Some FXS extensions will be deleted')).toHaveCount(0)

    await page.getByRole('textbox', { name: 'Device IP address' }).fill('192.168.10.30')
    await page.getByRole('combobox', { name: 'Port FXS 1' }).click()
    await page.getByRole('option', { name: /a\.miller \(300\)/ }).click()
    await expect(page.getByText('Some FXS extensions will be deleted')).toBeVisible()
    await expect(
      page.getByText('Saving deletes the FXS port extensions of these users: c.davis (301).'),
    ).toBeVisible()
    await page.getByRole('button', { name: 'Save', exact: true }).click()

    await expect(
      page.getByText('Physical trunk Grandstream HT802 SIP 2 Porte FXS has been updated.'),
    ).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Edit physical trunk' })).toBeHidden()
    const [call] = mockApi.callsTo('PUT', '/freepbx/rest/devices/gateways/:id')
    expect(call.path).toBe('/freepbx/rest/devices/gateways/4')
    expect(call.body).toEqual({
      name: 'Grandstream-HT802 SIP 2 Porte FXS',
      model: 33,
      manufacturer: 'Grandstream',
      mac: '02:2A:3B:4C:5D:6E',
      ipv4: '',
      ipv4_new: '192.168.10.30',
      netmask_green: '255.255.255.0',
      gateway: '192.168.10.1',
      ipv4_green: 'voice.example.org',
      proxy: 'sip:10.5.4.1:5060;lr',
      trunks_isdn: [],
      trunks_pri: [],
      trunks_fxo: [],
      trunks_fxs: [{ name: 1, linked_extension: '300' }],
    })
    expect(mockApi.callsTo('POST', '/freepbx/rest/devices/gateways')).toHaveLength(0)
  })

  test('edits the ISDN ports of a gateway keeping its trunks', async ({ page, mockApi }) => {
    mockTrunksApi(mockApi)
    mockApi.on('PUT', '/freepbx/rest/devices/gateways/:id', { json: { status: true, id: 3 } })
    await page.goto('./trunks/physical')

    await page.getByRole('button', { name: /Open the menu of Patton/ }).click()
    await page.getByRole('menuitem', { name: 'Edit', exact: true }).click()
    await page.getByText('Point-to-point', { exact: true }).click()
    await page.getByRole('button', { name: 'Save', exact: true }).click()

    await expect(page.getByText('Physical trunk updated')).toBeVisible()
    const [call] = mockApi.callsTo('PUT', '/freepbx/rest/devices/gateways/:id')
    expect(call.path).toBe('/freepbx/rest/devices/gateways/3')
    expect(call.body).toMatchObject({
      mac: '00:A0:BA:0B:1C:DD',
      ipv4_new: '192.168.10.20',
      trunks_isdn: [{ name: 0, type: 'pp' }],
    })
  })

  test('validates the changes of a gateway before calling the API', async ({ page, mockApi }) => {
    mockTrunksApi(mockApi)
    await page.goto('./trunks/physical')

    await page.getByRole('button', { name: /Open the menu of Grandstream/ }).click()
    await page.getByRole('menuitem', { name: 'Edit', exact: true }).click()
    await page.getByRole('textbox', { name: 'MAC address' }).fill('00:a0:ba:0b:1c:dd')
    await page.getByRole('textbox', { name: 'Device IP address' }).fill('192.168.10.300')
    await page.getByRole('button', { name: 'Save', exact: true }).click()

    await expect(page.getByText('Another gateway already uses this MAC address')).toBeVisible()
    await expect(page.getByText('Enter a valid IPv4 address')).toBeVisible()
    await expect(page.getByRole('textbox', { name: 'MAC address' })).toBeFocused()
    expect(mockApi.callsTo('PUT', '/freepbx/rest/devices/gateways/:id')).toHaveLength(0)

    await page.getByRole('button', { name: 'Cancel' }).click()
    await page.getByRole('button', { name: 'Discard changes' }).click()
    await expect(page.getByRole('heading', { name: 'Edit physical trunk' })).toBeHidden()
    expect(mockApi.callsTo('PUT', '/freepbx/rest/devices/gateways/:id')).toHaveLength(0)
  })

  test('shows the error of a failed gateway update inside the drawer', async ({
    page,
    mockApi,
  }) => {
    mockTrunksApi(mockApi)
    mockApi.on('PUT', '/freepbx/rest/devices/gateways/:id', {
      status: 409,
      json: {
        status: false,
        errors: ['Another gateway already uses this MAC address'],
        warnings: [],
        infos: [],
      },
    })
    await page.goto('./trunks/physical')

    await page.getByRole('button', { name: /Open the menu of Grandstream/ }).click()
    await page.getByRole('menuitem', { name: 'Edit', exact: true }).click()
    await page.getByRole('textbox', { name: 'MAC address' }).fill('02:2a:3b:4c:5d:6f')
    await page.getByRole('button', { name: 'Save', exact: true }).click()

    await expect(page.getByText('Cannot save the trunk')).toBeVisible()
    await expect(
      page.getByText('Another gateway already uses this MAC address', { exact: true }),
    ).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Edit physical trunk' })).toBeVisible()

    mockApi.on('PUT', '/freepbx/rest/devices/gateways/:id', { status: 500 })
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(page.getByText('Cannot save the trunk')).toBeVisible()
    await expect(page.getByText(/error 500/)).toBeVisible()
  })

  test('downloads the configuration file', async ({ page, mockApi }) => {
    mockTrunksApi(mockApi)
    mockApi.on('GET', '/freepbx/rest/devices/gateways/download/:name/:mac', {
      json: Buffer.from('cli version 4.00').toString('base64'),
    })
    await page.goto('./trunks/physical')

    const downloadPromise = page.waitForEvent('download')
    await page
      .getByRole('row', { name: /TRINITY ISDN 2 Porte/ })
      .getByRole('button', { name: /Download/ })
      .click()
    const download = await downloadPromise

    expect(download.suggestedFilename()).toBe('Patton-TRINITY.cfg')
    expect(
      mockApi.callsTo('GET', '/freepbx/rest/devices/gateways/download/:name/:mac')[0].path,
    ).toBe(
      '/freepbx/rest/devices/gateways/download/Patton-TRINITY%20ISDN%202%20Porte/00%3AA0%3ABA%3A0B%3A1C%3ADD',
    )
  })

  test('deletes a gateway', async ({ page, mockApi }) => {
    mockTrunksApi(mockApi)
    mockApi.on('DELETE', '/freepbx/rest/devices/gateways/:id', { json: { status: true } })
    await page.goto('./trunks/physical')

    await page.getByRole('button', { name: /Open the menu of Patton/ }).click()
    await page.getByRole('menuitem', { name: 'Delete', exact: true }).click()
    await expect(
      page.getByText(
        'Physical trunk Patton TRINITY ISDN 2 Porte will be permanently deleted. The gateway will no longer route calls to the PBX.',
      ),
    ).toBeVisible()
    await expect(page.getByText('Its trunks are deleted too.')).toBeVisible()
    await expect(
      page.getByText(
        'These outbound routes use only this trunk and will no longer be able to make calls: Emergency.',
      ),
    ).toBeVisible()
    await page.getByRole('button', { name: 'Delete', exact: true }).click()

    await expect(
      page.getByText('Physical trunk Patton TRINITY ISDN 2 Porte has been deleted.'),
    ).toBeVisible()
    expect(mockApi.callsTo('DELETE', '/freepbx/rest/devices/gateways/:id')[0].path).toBe(
      '/freepbx/rest/devices/gateways/3',
    )
  })

  test('creates and deletes a gateway while the CTI server is not reachable', async ({
    page,
    mockApi,
  }) => {
    const livePath = '/freepbx/rest/dashboard/live/trunks'
    mockTrunksApi(mockApi)
    mockApi
      .on('GET', livePath, { status: 503, json: { message: 'The CTI server is not reachable' } })
      .on('POST', '/freepbx/rest/devices/gateways', {
        json: { status: true, errors: [], warnings: [], infos: [], id: 8 },
      })
      .on('DELETE', '/freepbx/rest/devices/gateways/:id', { json: { status: true } })
    await page.goto('./trunks/physical')
    await expect(page.getByTestId('live-data-unavailable')).toBeVisible()

    await page.getByRole('button', { name: 'Create physical trunk' }).click()
    await page.getByText('Patton', { exact: true }).last().click()
    await page.getByRole('combobox', { name: 'Device model' }).click()
    await page.getByRole('option', { name: /TRI_ISDN_2/ }).click()
    await page.getByRole('textbox', { name: 'MAC address' }).fill('00-a0-ba-0b-1c-ee')
    await page.getByRole('textbox', { name: 'Device IP address' }).fill('192.168.10.21')
    await page.getByRole('textbox', { name: 'Subnet mask' }).fill('255.255.255.0')
    await page.getByRole('textbox', { name: 'Network gateway' }).fill('192.168.10.1')
    await page.getByRole('button', { name: 'Create', exact: true }).click()
    await expect(
      page.getByText('Physical trunk Patton TRINITY ISDN 2 Porte has been created.'),
    ).toBeVisible()
    await expect.poll(() => mockApi.callsTo('GET', livePath).length).toBeGreaterThan(1)
    const afterCreate = mockApi.callsTo('GET', livePath).length

    await page.getByRole('button', { name: /Open the menu of Patton/ }).click()
    await page.getByRole('menuitem', { name: 'Delete', exact: true }).click()
    await page.getByRole('button', { name: 'Delete', exact: true }).click()
    await expect(
      page.getByText('Physical trunk Patton TRINITY ISDN 2 Porte has been deleted.'),
    ).toBeVisible()
    await expect.poll(() => mockApi.callsTo('GET', livePath).length).toBeGreaterThan(afterCreate)
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)))
  })

  test('shows the error of a failed deletion inside the modal', async ({ page, mockApi }) => {
    mockTrunksApi(mockApi)
    mockApi.on('DELETE', '/freepbx/rest/devices/gateways/:id', {
      status: 404,
      json: { status: 'Gateway configuration not found' },
    })
    await page.goto('./trunks/physical')

    await page.getByRole('button', { name: /Open the menu of Patton/ }).click()
    await page.getByRole('menuitem', { name: 'Delete', exact: true }).click()
    await page.getByRole('button', { name: 'Delete', exact: true }).click()

    await expect(page.getByText('Cannot delete the trunk')).toBeVisible()
    await expect(page.getByText('Gateway configuration not found')).toBeVisible()
  })

  test('lists the gateways when the models cannot be loaded', async ({ page, mockApi }) => {
    mockTrunksApi(mockApi)
    mockApi.on('GET', '/freepbx/rest/devices/gateways/manufacturers', { status: 500 })
    await page.goto('./trunks/physical')

    await expect(page.getByText('Cannot retrieve the gateway models')).toBeVisible()
    await expect(page.getByRole('row', { name: /Patton-TRINITY ISDN 2 Porte/ })).toBeVisible()
  })

  test('shows the errors of a gateway the API did not save', async ({ page, mockApi }) => {
    mockTrunksApi(mockApi, { gateways: [] })
    mockApi.on('POST', '/freepbx/rest/devices/gateways', {
      json: { status: false, errors: ['Error creating extension'], warnings: [], infos: [] },
    })
    await page.goto('./trunks/physical')

    await page.getByRole('button', { name: 'Create physical trunk' }).click()
    await page.getByText('Patton', { exact: true }).last().click()
    await page.getByRole('combobox', { name: 'Device model' }).click()
    await page.getByRole('option', { name: /TRI_PRI_1/ }).click()
    await page.getByRole('textbox', { name: 'MAC address' }).fill('00:a0:ba:0b:1c:ee')
    await page.getByRole('textbox', { name: 'Device IP address' }).fill('192.168.10.21')
    await page.getByRole('textbox', { name: 'Subnet mask' }).fill('255.255.255.0')
    await page.getByRole('textbox', { name: 'Network gateway' }).fill('192.168.10.1')
    await page.getByRole('button', { name: 'Create', exact: true }).click()

    await expect(page.getByText('Cannot create the trunk')).toBeVisible()
    await expect(page.getByText('Error creating extension', { exact: true })).toBeVisible()
    await expect(page.getByText(/Invalid type/)).toHaveCount(0)
  })

  test('rejects network settings that make the gateway unreachable', async ({ page, mockApi }) => {
    mockTrunksApi(mockApi, { gateways: [] })
    await page.goto('./trunks/physical')

    await page.getByRole('button', { name: 'Create physical trunk' }).click()
    await page.getByText('Patton', { exact: true }).last().click()
    await page.getByRole('combobox', { name: 'Device model' }).click()
    await page.getByRole('option', { name: /TRI_PRI_1/ }).click()
    await page.getByRole('textbox', { name: 'MAC address' }).fill('ff:ff:ff:ff:ff:ff')
    await page.getByRole('textbox', { name: 'Device IP address' }).fill('192.168.10.21')
    await page.getByRole('textbox', { name: 'Subnet mask' }).fill('255.255.255.0')
    await page.getByRole('textbox', { name: 'Network gateway' }).fill('10.0.0.1')
    await page.getByRole('textbox', { name: 'PBX address' }).fill('999.1.1.1')
    await page.getByRole('button', { name: 'Create', exact: true }).click()

    await expect(page.getByText('Enter the MAC address of a single device')).toBeVisible()
    await expect(
      page.getByText('The network gateway must be in the same network as the device'),
    ).toBeVisible()
    await expect(page.getByText('Enter a valid hostname or IP address')).toBeVisible()
    expect(mockApi.callsTo('POST', '/freepbx/rest/devices/gateways')).toHaveLength(0)
  })

  test('asks before discarding a new gateway', async ({ page, mockApi }) => {
    mockTrunksApi(mockApi, { gateways: [] })
    await page.goto('./trunks/physical')

    await page.getByRole('button', { name: 'Create physical trunk' }).click()
    await page.getByRole('textbox', { name: 'MAC address' }).fill('00:a0:ba:0b:1c:ee')
    await page.getByRole('button', { name: 'Cancel' }).click()
    await page.getByRole('button', { name: 'Discard changes' }).click()

    await expect(page.getByRole('heading', { name: 'Create physical trunk' })).toBeHidden()
  })
})
