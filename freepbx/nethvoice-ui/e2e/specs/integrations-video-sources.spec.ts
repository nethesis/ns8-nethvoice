//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import type { Page } from '@playwright/test'
import { expect, mockPermissions, test } from '../fixtures/mockApi'
import {
  DOOR_PHONES,
  MAIN_ENTRANCE_URL,
  PROFILES,
  PUBLIC_IP,
  seedDemo,
  VideoBackend,
  WAREHOUSE_URL,
} from './video-sources-data'

const TEST_PATH = '/freepbx/rest/cti/sources/test'
const STREAMING_PATH = '/freepbx/rest/cti/streaming'

let backend: VideoBackend

const grid = (page: Page) => page.getByRole('grid', { name: 'Video sources' })
const row = (page: Page, name: string) => grid(page).getByRole('row', { name: new RegExp(name) })

async function openTab(page: Page) {
  await page.goto('./integrations/video-sources')
  await expect(row(page, 'Warehouse')).toContainText('Not connected')
  await expect(row(page, 'Main entrance')).toContainText('Connected')
  await expect(row(page, 'Parking gate')).toContainText('Connected')
}

async function openRowMenu(page: Page, name: string) {
  await page.getByRole('button', { name: `Open the menu of ${name}` }).click()
}

async function chooseOption(page: Page, label: string, option: string | RegExp) {
  await page
    .getByRole('dialog')
    .getByRole('button', { name: new RegExp(`^${label}`) })
    .last()
    .click()
  await page.getByRole('option', { name: option }).click()
}

async function fillStep1(page: Page, url: string, name = 'Front door') {
  const drawer = page.getByRole('dialog')
  await drawer.getByRole('textbox', { name: 'Name', exact: true }).fill(name)
  await drawer.getByRole('combobox', { name: 'Extension' }).click()
  await page.getByRole('option', { name: 'Reception (303)' }).click()
  await expect(page.getByRole('option')).toHaveCount(0)
  await drawer.getByRole('textbox', { name: 'URL' }).fill(url)
}

test.describe('integrations: video sources', () => {
  test.beforeEach(async ({ signedIn, mockApi }) => {
    void signedIn
    backend = new VideoBackend()
    backend.doorPhones = DOOR_PHONES.map((phone) => ({ ...phone }))
    seedDemo(backend).install(mockApi)
  })

  test('lists the sources and tests each of them, three at a time', async ({ page, mockApi }) => {
    backend.hold('test')
    await page.goto('./integrations/video-sources')

    await expect(
      page.getByText('Show IP camera and intercom streams to users in NethVoice CTI.'),
    ).toBeVisible()
    await expect(grid(page).getByRole('row')).toHaveCount(4)
    await expect(row(page, 'Main entrance')).toContainText('Main entrance (300)')
    await expect(row(page, 'Main entrance')).toContainText('Main gate, Pedestrian gate')
    await expect(row(page, 'Parking gate')).toContainText('Parking (301)')
    await expect(row(page, 'Parking gate')).toContainText('Standard')
    await expect(row(page, 'Warehouse')).toContainText('Warehouse (302)')
    await expect(grid(page).getByText('Testing connection…')).toHaveCount(3)

    backend.release('test')
    await expect(row(page, 'Main entrance')).toContainText('Connected')
    await expect(row(page, 'Warehouse')).toContainText('Not connected')
    expect(mockApi.callsTo('POST', TEST_PATH).map((call) => call.body)).toEqual(
      expect.arrayContaining([
        {
          url: MAIN_ENTRANCE_URL,
          user: 'rtsp-viewer',
          secret: '',
          tls_skip_verify: false,
          details: true,
          descr: 'Main entrance',
          door_phone: '0C-38-3E-32-6B-84',
        },
        {
          url: WAREHOUSE_URL,
          user: 'admin',
          secret: '',
          tls_skip_verify: false,
          details: true,
          descr: 'Warehouse',
        },
      ]),
    )

    mockApi.allowUnmockedCalls()
    await page.getByRole('link', { name: 'Phonebook' }).click()
    await expect(grid(page)).toHaveCount(0)
    await page.getByRole('link', { name: 'Video sources' }).click()
    await expect(row(page, 'Warehouse')).toContainText('Not connected')
    expect(mockApi.callsTo('POST', TEST_PATH)).toHaveLength(3)
  })

  test('runs at most three tests at once', async ({ page, mockApi }) => {
    for (let index = 1; index <= 5; index += 1) {
      backend.addSource({ descr: `Camera ${index}`, url: `rtsp://192.0.2.${index}/live` })
    }
    backend.hold('test')
    await page.goto('./integrations/video-sources')

    await expect(grid(page).getByText('Testing connection…')).toHaveCount(8)
    await expect.poll(() => backend.waiting('test')).toBe(3)
    expect(mockApi.callsTo('POST', TEST_PATH)).toHaveLength(3)

    backend.release('test')
    await expect(grid(page).getByText('Testing connection…')).toHaveCount(0)
    expect(mockApi.callsTo('POST', TEST_PATH)).toHaveLength(8)
  })

  test('shows the loading state', async ({ page }) => {
    backend.hold('list')
    await page.goto('./integrations/video-sources')

    await expect(page.getByRole('button', { name: 'Create video source' })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Create from a door phone' })).toBeDisabled()
    await expect(page.getByRole('textbox', { name: 'Filter video sources' })).toHaveCount(0)
    await expect(grid(page).locator('.animate-pulse').first()).toBeVisible()
    await expect(grid(page).getByRole('row', { name: /Main entrance/ })).toHaveCount(0)
    backend.release('list')
    await expect(row(page, 'Main entrance')).toBeVisible()
  })

  test('filters by text, profile and status', async ({ page }) => {
    await openTab(page)
    const filter = page.getByRole('textbox', { name: 'Filter video sources' })
    const reset = page.getByRole('button', { name: 'Reset filters' })

    await expect(reset).toBeDisabled()
    await filter.fill('parking (301')
    await expect(grid(page).getByRole('row')).toHaveCount(2)
    await expect(row(page, 'Parking gate')).toBeVisible()

    await filter.fill('zzz')
    await expect(page.getByText('No video sources found')).toBeVisible()
    await expect(page.getByText('Try changing your search filters.')).toBeVisible()
    await page.getByRole('button', { name: 'Reset filters' }).last().click()
    await expect(filter).toHaveValue('')
    await expect(grid(page).getByRole('row')).toHaveCount(4)

    await page.getByRole('button', { name: 'Open filter Profile' }).click()
    await expect(page.getByRole('checkbox')).toHaveCount(5)
    await page.getByRole('checkbox', { name: 'Standard', exact: true }).check()
    await page.keyboard.press('Escape')
    await expect(grid(page).getByRole('row')).toHaveCount(2)
    await expect(row(page, 'Parking gate')).toBeVisible()

    await reset.first().click()
    await page.getByRole('button', { name: 'Open filter Status' }).click()
    await page.getByRole('checkbox', { name: 'Not connected', exact: true }).check()
    await page.keyboard.press('Escape')
    await expect(grid(page).getByRole('row')).toHaveCount(2)
    await expect(row(page, 'Warehouse')).toBeVisible()
  })

  test('says that the status filter waits for running tests', async ({ page }) => {
    backend.hold('test')
    await page.goto('./integrations/video-sources')
    await expect(grid(page).getByText('Testing connection…')).toHaveCount(3)

    await page.getByRole('button', { name: 'Open filter Status' }).click()
    await page.getByRole('checkbox', { name: 'Connected', exact: true }).check()
    await page.keyboard.press('Escape')

    await expect(page.getByText('No video sources found')).toBeVisible()
    await expect(
      page.getByText(
        'Testing the connection of 3 video sources: the Status filter shows them when the tests end.',
      ),
    ).toBeVisible()
    backend.release('test')
    await expect(grid(page).getByRole('row')).toHaveCount(3)
    await expect(page.getByText(/Testing the connection of/)).toHaveCount(0)
  })

  test('shows the empty state with both create actions', async ({ page }) => {
    backend.sources = []
    await page.goto('./integrations/video-sources')

    await expect(page.getByText('No video sources', { exact: true })).toBeVisible()
    await expect(
      page.getByText(
        'Create a video source from a camera or a door phone to show its images in NethVoice CTI.',
      ),
    ).toBeVisible()
    await expect(page.getByRole('grid')).toHaveCount(0)
    await expect(page.getByRole('textbox', { name: 'Filter video sources' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Create video source' })).toHaveCount(1)
    await expect(page.getByRole('button', { name: 'Create from a door phone' })).toBeEnabled()
  })

  test('disables creating from a door phone when none is free, with the reason', async ({
    page,
  }) => {
    backend.doorPhones = [DOOR_PHONES[0]!]
    await openTab(page)

    const button = page.getByRole('button', { name: 'Create from a door phone' })
    await expect(button).toBeDisabled()
    await page.getByTestId('door-phone-unavailable').focus()
    await expect(page.getByText('All door phones already have a video source')).toBeVisible()

    backend.doorPhones = []
    backend.sources = []
    await page.reload()
    await page.locator('[tabindex="0"]', { has: button }).focus()
    await expect(page.getByText('No door phones in Physical phones')).toBeVisible()
  })

  test('reports a load error and retries', async ({ page, mockApi }) => {
    let failing = true

    mockApi.on('GET', STREAMING_PATH, () => (failing ? { status: 500 } : { json: [] }))
    await page.goto('./integrations/video-sources')
    await expect(page.getByText('Cannot retrieve the video sources')).toBeVisible()

    failing = false
    await page.getByRole('button', { name: 'Retry' }).click()
    await expect(page.getByText('No video sources', { exact: true })).toBeVisible()
  })

  test('tests a source from the row menu', async ({ page, mockApi }) => {
    await openTab(page)

    await openRowMenu(page, 'Warehouse')
    await expect(page.getByRole('menuitem')).toHaveText(['Preview', 'Test connection', 'Delete'])
    backend.hold('test')
    await page.getByRole('menuitem', { name: 'Test connection' }).click()

    await expect(row(page, 'Warehouse')).toContainText('Testing connection…')
    await openRowMenu(page, 'Warehouse')
    await expect(page.getByRole('menuitem', { name: 'Preview' })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: 'Test connection' })).toHaveCount(0)
    await page.keyboard.press('Escape')
    await expect(
      row(page, 'Warehouse').getByRole('button', { name: 'Edit Warehouse' }),
    ).toBeEnabled()

    backend.release('test')
    await expect(page.getByText('Connection failed', { exact: true })).toBeVisible()
    await expect(
      page.getByText(
        'Cannot connect to video source Warehouse. The device does not answer. Check the address and the firewall.',
      ),
    ).toBeVisible()
    await expect(row(page, 'Warehouse')).toContainText('Not connected')

    backend.check(WAREHOUSE_URL, { success: true })
    await openRowMenu(page, 'Warehouse')
    await page.getByRole('menuitem', { name: 'Test connection' }).click()
    await expect(page.getByText('Video source Warehouse is connected')).toBeVisible()
    await expect(row(page, 'Warehouse')).toContainText('Connected')
    expect(mockApi.callsTo('POST', TEST_PATH)).toHaveLength(5)
  })

  test('previews a source', async ({ page }) => {
    await openTab(page)

    await openRowMenu(page, 'Main entrance')
    await page.getByRole('menuitem', { name: 'Preview' }).click()
    const modal = page.getByRole('dialog', { name: 'Main entrance' })
    await expect(modal.getByRole('img', { name: 'Image from Main entrance' })).toBeVisible()
    await modal.getByRole('button', { name: 'Close' }).last().click()
    await expect(modal.getByRole('heading')).toHaveCount(0)

    await openRowMenu(page, 'Warehouse')
    await page.getByRole('menuitem', { name: 'Preview' }).click()
    await expect(page.getByText('Video feed not available')).toBeVisible()
    await expect(
      page
        .getByRole('dialog', { name: 'Warehouse' })
        .getByText('The device does not answer. Check the address and the firewall.'),
    ).toBeVisible()
    await page.keyboard.press('Escape')

    backend.hold('test')
    await openRowMenu(page, 'Parking gate')
    await page.getByRole('menuitem', { name: 'Test connection' }).click()
    await openRowMenu(page, 'Parking gate')
    await page.getByRole('menuitem', { name: 'Preview' }).click()
    await expect(
      page.getByRole('dialog', { name: 'Parking gate' }).getByText('Testing connection…'),
    ).toBeVisible()
    backend.release('test')
    await expect(
      page.getByRole('dialog', { name: 'Parking gate' }).getByRole('img', {
        name: 'Image from Parking gate',
      }),
    ).toBeVisible()
  })

  test('deletes a source', async ({ page, mockApi }) => {
    await openTab(page)
    await openRowMenu(page, 'Warehouse')
    await page.getByRole('menuitem', { name: 'Delete' }).click()

    const modal = page.getByRole('dialog', { name: 'Delete video source' })
    await expect(modal).toContainText(
      'Video source Warehouse will be permanently deleted. Users will no longer see it in NethVoice CTI.',
    )
    await modal.getByRole('button', { name: 'Delete' }).click()

    await expect(modal.getByRole('heading')).toHaveCount(0)
    await expect(page.getByText('Video source Warehouse has been deleted.')).toBeVisible()
    await expect(grid(page).getByRole('row')).toHaveCount(3)
    expect(mockApi.callsTo('DELETE', `${STREAMING_PATH}/:name`)[0]?.path).toBe(
      `${STREAMING_PATH}/Warehouse`,
    )
  })

  test('shows Updating while the list reloads after a delete', async ({ page }) => {
    await openTab(page)
    await openRowMenu(page, 'Warehouse')
    await page.getByRole('menuitem', { name: 'Delete' }).click()
    backend.hold('list')
    await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click()

    await expect(page.getByRole('status').filter({ hasText: 'Updating…' })).toBeVisible()
    await expect(grid(page).getByRole('row')).toHaveCount(4)
    backend.release('list')
    await expect(page.getByText('Updating…')).toHaveCount(0)
    await expect(grid(page).getByRole('row')).toHaveCount(3)
  })

  test('validates step 1 and reports a failed test with its details', async ({ page, mockApi }) => {
    await openTab(page)
    await page.getByRole('button', { name: 'Create video source' }).click()
    const drawer = page.getByRole('dialog')

    await expect(drawer.getByText('Step 1/2')).toBeVisible()
    await expect(drawer.getByRole('textbox', { name: 'Name', exact: true })).toBeFocused()
    await expect(drawer.getByRole('button', { name: 'Remove Base' })).toBeVisible()
    await drawer.getByRole('button', { name: 'Next' }).click()
    await expect(drawer.getByText('Enter the name')).toBeVisible()
    await expect(drawer.getByText('Enter the URL', { exact: true })).toBeVisible()
    await expect(drawer.getByRole('textbox', { name: 'Name', exact: true })).toBeFocused()

    await drawer.getByRole('textbox', { name: 'Name', exact: true }).fill('Front door')
    await drawer.getByRole('textbox', { name: 'URL' }).fill('ftp://192.168.1.52/stream1')
    await drawer.getByRole('button', { name: 'Next' }).click()
    await expect(
      drawer.getByText('Enter a URL that starts with rtsp://, rtsps://, http:// or https://'),
    ).toBeVisible()
    expect(mockApi.callsTo('POST', TEST_PATH)).toHaveLength(3)

    backend.unreachableHosts.add('192.168.1.52')
    await fillStep1(page, 'rtsp://192.168.1.52:554/stream1')
    await expect(drawer.getByText('The PBX cannot reach the device at this address')).toBeVisible()
    await expect(
      drawer.getByText(
        `This is a private network address: the PBX cannot reach it if it is in the cloud or in another network. Forward port 554 on the router of the device, allow it only from the public IP address of the PBX (${PUBLIC_IP}) and enter the public address of the device in the URL.`,
      ),
    ).toBeVisible()

    await drawer.getByRole('textbox', { name: 'Username' }).fill('admin')
    await drawer.getByLabel(/^Password/).fill('Secret-1')
    backend.hold('test')
    await drawer.getByRole('button', { name: 'Next' }).click()
    await expect(drawer.getByRole('button', { name: 'Next' })).toBeDisabled()
    await expect(drawer.getByRole('textbox', { name: 'Name', exact: true })).toBeDisabled()
    await page.keyboard.press('Escape')
    await expect(drawer.getByRole('textbox', { name: 'Name', exact: true })).toBeVisible()
    backend.release('test')

    await expect(drawer.getByText('Cannot connect to the video source')).toBeVisible()
    await expect(
      drawer.getByText('The device does not answer. Check the address and the firewall.'),
    ).toBeVisible()
    await drawer.getByRole('button', { name: 'Show details' }).click()
    await expect(
      drawer.getByText('rtsp://192.168.1.52:554/stream1: Connection timed out'),
    ).toBeVisible()
    await expect(drawer.getByText('Step 1/2')).toBeVisible()
    expect(mockApi.callsTo('POST', TEST_PATH).at(-1)?.body).toEqual({
      url: 'rtsp://192.168.1.52:554/stream1',
      user: 'admin',
      secret: 'Secret-1',
      tls_skip_verify: false,
      details: true,
    })

    backend.check('rtsp://192.168.1.52:554/stream1', {
      success: false,
      reason: 'auth_failed',
      message: 'rtsp://192.168.1.52:554/stream1: 401 Unauthorized',
    })
    await drawer.getByLabel(/^Password/).fill('Secret-2')
    await expect(drawer.getByText('Cannot connect to the video source')).toHaveCount(0)
    await drawer.getByRole('button', { name: 'Next' }).click()
    await expect(
      drawer.getByText('The device rejected the username or password. Check the credentials.'),
    ).toBeVisible()
  })

  test('creates a source in two steps with gates', async ({ page, mockApi }) => {
    const url = 'rtsp://192.168.1.53:554/h264/stream.live1'
    backend.check(url, { success: true })
    await openTab(page)
    await page.getByRole('button', { name: 'Create video source' }).click()
    const drawer = page.getByRole('dialog')

    await chooseOption(page, 'Device type', 'Fanvil i-series')
    await expect(drawer.getByRole('textbox', { name: 'URL' })).toHaveAttribute(
      'placeholder',
      'e.g. rtsp://192.0.2.50:554/h264/stream.live0',
    )
    await fillStep1(page, 'rtsp://192.168.1.53:554/h264/stream.live0')
    await chooseOption(page, 'Video quality', /Standard \(sub stream/)
    await expect(drawer.getByRole('textbox', { name: 'URL' })).toHaveValue(url)
    await expect(drawer.getByText('The PBX reaches the device at this address.')).toBeVisible()

    await drawer.getByRole('button', { name: 'Next' }).click()
    await expect(drawer.getByText('Step 2/2')).toBeVisible()
    await expect(drawer.getByText('Connection verified')).toBeVisible()
    await expect(drawer.getByRole('img', { name: 'Image from Front door' })).toBeVisible()
    await expect(drawer.getByRole('img', { name: 'Image from Front door' })).toHaveCSS(
      'object-fit',
      'contain',
    )
    await expect(drawer.getByText('H264, 1280 × 720')).toBeVisible()

    await drawer.getByRole('button', { name: 'Add gate' }).click()
    const gateName = drawer.getByRole('textbox', { name: 'Name', exact: true }).last()
    await expect(gateName).toBeFocused()
    await expect(drawer.getByRole('button', { name: 'Move gate 1 up' })).toBeDisabled()
    await expect(drawer.getByRole('button', { name: 'Move gate 1 down' })).toBeDisabled()
    await drawer.getByRole('button', { name: 'Create' }).click()
    await expect(drawer.getByText('Enter the name')).toBeVisible()
    await expect(drawer.getByText('Enter the DTMF code')).toBeVisible()
    await expect(gateName).toBeFocused()

    await gateName.fill('Main gate')
    await drawer.getByRole('textbox', { name: 'DTMF code' }).fill('*1x')
    await drawer.getByRole('button', { name: 'Create' }).click()
    await expect(drawer.getByText('Use only digits, *, #, + and the letters A to D')).toBeVisible()
    await drawer.getByRole('textbox', { name: 'DTMF code' }).fill('*1')

    await drawer.getByRole('button', { name: 'Add gate' }).click()
    await drawer.getByRole('textbox', { name: 'Name', exact: true }).last().fill('Pedestrian gate')
    await chooseOption(page, 'Type', 'URL')
    await expect(drawer.getByRole('textbox', { name: 'DTMF code' })).toHaveCount(1)
    await drawer.getByRole('button', { name: 'Create' }).click()
    await expect(drawer.getByText('Enter the URL', { exact: true })).toBeVisible()
    await drawer.getByRole('textbox', { name: 'URL' }).last().fill('ftp://192.168.1.60/open')
    await drawer.getByRole('button', { name: 'Create' }).click()
    await expect(drawer.getByText('Enter a URL that starts with http:// or https://')).toBeVisible()
    await drawer.getByRole('textbox', { name: 'URL' }).last().fill('http://192.168.1.60/open')
    await chooseOption(page, 'Request method', 'POST')
    await drawer.getByRole('button', { name: 'Move Pedestrian gate up' }).click()
    await expect(drawer.getByRole('button', { name: 'Collapse Pedestrian gate' })).toBeVisible()

    await drawer.getByRole('button', { name: 'Previous' }).click()
    await expect(drawer.getByRole('textbox', { name: 'URL' })).toHaveValue(url)
    await drawer.getByRole('button', { name: 'Next' }).click()
    await expect(drawer.getByText('Step 2/2')).toBeVisible()
    expect(mockApi.callsTo('POST', TEST_PATH)).toHaveLength(4)

    await drawer.getByRole('button', { name: 'Create' }).click()
    await expect(drawer.getByRole('heading')).toHaveCount(0)
    await expect(page.getByText('Video source Front door has been created.')).toBeVisible()
    expect(mockApi.callsTo('POST', STREAMING_PATH)[0]?.body).toEqual({
      descr: 'Front door',
      url,
      user: '',
      secret: '',
      exten: '303',
      tls_skip_verify: false,
      profiles: [1],
      gates: [
        {
          name: 'Pedestrian gate',
          type: 'url',
          url: 'http://192.168.1.60/open',
          method: 'POST',
          username: '',
          password: '',
        },
        { name: 'Main gate', type: 'dtmf', code: '*1' },
      ],
    })
    await expect(row(page, 'Front door')).toContainText('Reception (303)')
    await expect(row(page, 'Front door')).toContainText('Pedestrian gate, Main gate')
    await expect(row(page, 'Front door')).toContainText('Connected')
    expect(mockApi.callsTo('POST', TEST_PATH)).toHaveLength(4)
  })

  test('maps server field errors and conflicts to the form', async ({ page }) => {
    const url = 'http://192.168.1.54/snap.jpg'
    backend.check(url, { success: true, mime: 'image/png' })
    await openTab(page)
    await page.getByRole('button', { name: 'Create video source' }).click()
    const drawer = page.getByRole('dialog')

    await fillStep1(page, url, 'parking gate!')
    await drawer.getByRole('button', { name: 'Next' }).click()
    await expect(drawer.getByText('Another video source has the same name')).toBeVisible()

    await drawer.getByRole('textbox', { name: 'Name', exact: true }).fill('Parking gate 2')
    await drawer.getByRole('button', { name: 'Next' }).click()
    await expect(drawer.getByText('Step 2/2')).toBeVisible()
    await expect(drawer.getByText(/^PNG/)).toBeVisible()

    backend.addSource({ descr: 'Parking gate 2!', url: 'http://192.0.2.9/' })
    await drawer.getByRole('button', { name: 'Create' }).click()
    await expect(drawer.getByText('Step 1/2')).toBeVisible()
    await expect(drawer.getByText('Another video source has the same name')).toBeVisible()
    await expect(drawer.getByRole('textbox', { name: 'Name', exact: true })).toBeFocused()
  })

  test('creates a source from a door phone', async ({ page, mockApi }) => {
    backend.check('rtsp://192.168.5.218:554/h264/stream.live0', { success: true })
    await openTab(page)
    await page.getByRole('button', { name: 'Create from a door phone' }).click()

    const modal = page.getByRole('dialog', { name: 'Create from a door phone' })
    const phones = modal.getByRole('grid', { name: 'Door phones' })
    await expect(phones.getByRole('row')).toHaveCount(3)
    await expect(phones).not.toContainText('Main entrance')
    await expect(phones.getByRole('row', { name: /Courtyard/ })).toContainText('0C-38-3E-32-7C-01')
    await expect(phones.getByRole('row', { name: /Courtyard/ })).toContainText('192.168.5.218')
    await modal.getByRole('button', { name: 'Use Courtyard' }).click()

    const drawer = page.getByRole('dialog', { name: 'Create video source' })
    await expect(drawer.getByRole('textbox', { name: 'Name', exact: true })).toHaveValue(
      'Courtyard',
    )
    await expect(drawer.getByRole('combobox', { name: 'Extension' })).toHaveValue('Courtyard (305)')
    await expect(drawer.getByRole('button', { name: 'Remove Security staff' })).toBeVisible()
    await expect(drawer.getByRole('button', { name: /^Device type/ })).toContainText(
      'Fanvil i-series',
    )
    await expect(drawer.getByRole('button', { name: /^Video quality/ })).toContainText(
      'High (main stream), 1280 × 720',
    )
    await expect(drawer.getByRole('textbox', { name: 'URL' })).toHaveValue(
      'rtsp://192.168.5.218:554/h264/stream.live0',
    )
    await expect(drawer.getByRole('textbox', { name: 'Username' })).toHaveCount(0)
    await expect(drawer.getByText(/New credentials: the door phone was asked/)).toBeVisible()
    await expect(drawer.getByText('The PBX reaches the device at this address.')).toBeVisible()
    expect(mockApi.callsTo('POST', '/freepbx/rest/cti/streaming/doorphones/:mac')[0]?.path).toBe(
      '/freepbx/rest/cti/streaming/doorphones/0C-38-3E-32-7C-01',
    )

    await drawer.getByRole('button', { name: 'Next' }).click()
    await expect(drawer.getByText('Step 2/2')).toBeVisible()
    expect(mockApi.callsTo('POST', TEST_PATH).at(-1)?.body).toEqual({
      url: 'rtsp://192.168.5.218:554/h264/stream.live0',
      user: 'rtsp-viewer',
      secret: '',
      tls_skip_verify: false,
      details: true,
      door_phone: '0C-38-3E-32-7C-01',
    })
    await expect(drawer.getByText('Door phone relays')).toBeVisible()
    await expect(drawer.getByText('http://192.168.5.218/cgi-bin/relay?output=2')).toBeVisible()
    await expect(drawer.getByRole('button', { name: 'Expand Door 1' })).toBeVisible()
    await expect(drawer.getByRole('button', { name: 'Expand Door 2' })).toBeVisible()
    await expect(drawer.getByRole('button', { name: 'Add gate' })).toBeDisabled()

    await drawer.getByRole('button', { name: 'Expand Door 1' }).click()
    const code = drawer.getByRole('textbox', { name: 'DTMF code' })
    await expect(code).toHaveValue('*')
    await expect(code).toHaveAttribute('readonly', /.*/)
    await expect(
      drawer.getByText('Code of relay 1 of the door phone, set by its provisioning.'),
    ).toBeVisible()

    await drawer.getByRole('button', { name: 'Expand Door 2' }).click()
    await chooseOption(page, 'Type', 'URL')
    await expect(drawer.getByRole('textbox', { name: 'URL' }).last()).toHaveValue(
      'http://192.168.5.218/cgi-bin/relay?output=2',
    )
    await expect(drawer.getByRole('textbox', { name: 'Username' })).toHaveValue('admin')
    await expect(
      drawer.getByText('Username and password of the web interface of the door phone.'),
    ).toBeVisible()

    await drawer.getByRole('button', { name: 'Create' }).click()
    await expect(drawer.getByRole('heading')).toHaveCount(0)
    await expect(page.getByText('Video source Courtyard has been created.')).toBeVisible()
    expect(mockApi.callsTo('POST', STREAMING_PATH)[0]?.body).toEqual({
      descr: 'Courtyard',
      url: 'rtsp://192.168.5.218:554/h264/stream.live0',
      user: 'rtsp-viewer',
      secret: '',
      exten: '305',
      tls_skip_verify: false,
      profiles: [7],
      door_phone: '0C-38-3E-32-7C-01',
      gates: [
        { name: 'Door 1', type: 'dtmf', code: '*' },
        {
          name: 'Door 2',
          type: 'url',
          url: 'http://192.168.5.218/cgi-bin/relay?output=2',
          method: 'GET',
          username: 'admin',
          password: '',
        },
      ],
    })
    await expect(row(page, 'Courtyard')).toContainText('Security staff')
  })

  test('handles a door phone that is not registered', async ({ page }) => {
    backend.doorPhones = backend.doorPhones.map((phone) =>
      phone.extension === '306' ? { ...phone, ip: null } : phone,
    )
    await openTab(page)
    await page.getByRole('button', { name: 'Create from a door phone' }).click()
    const modal = page.getByRole('dialog', { name: 'Create from a door phone' })

    await expect(modal.getByRole('row', { name: /Training room/ })).toContainText('Not registered')
    await modal.getByRole('button', { name: 'Use Training room' }).click()

    const drawer = page.getByRole('dialog', { name: 'Create video source' })
    await expect(drawer.getByRole('textbox', { name: 'URL' })).toHaveValue('')
    await expect(
      drawer.getByText(
        'The door phone is not registered: enter the address the PBX uses to reach it.',
      ),
    ).toBeVisible()
    await expect(drawer.getByRole('button', { name: 'Remove Standard' })).toBeVisible()
  })

  test('edits a door phone source with its stored result', async ({ page, mockApi }) => {
    await openTab(page)
    await page.getByRole('button', { name: 'Edit Main entrance' }).click()
    const drawer = page.getByRole('dialog', { name: 'Edit video source' })

    await expect(drawer.getByText(/^Step/)).toHaveCount(0)
    await expect(drawer.getByRole('textbox', { name: 'Username' })).toHaveCount(0)
    await expect(drawer.getByRole('button', { name: /^Video quality/ })).toContainText('High')
    await expect(drawer.getByRole('img', { name: 'Image from Main entrance' })).toBeVisible()
    await expect(drawer.getByText('H264, 1280 × 720')).toBeVisible()
    await expect(drawer.getByText('Door phone relays')).toBeVisible()
    await expect(drawer.getByRole('button', { name: 'Expand Main gate' })).toBeVisible()
    await expect(
      drawer.getByText('Changes to the connection are saved only if the test succeeds.'),
    ).toBeVisible()

    await drawer.getByRole('textbox', { name: 'Name', exact: true }).fill('Main door')
    await expect(drawer.getByText(/Renaming a source also renames/)).toBeVisible()
    await drawer.getByRole('button', { name: 'Save' }).click()

    await expect(drawer.getByRole('heading')).toHaveCount(0)
    await expect(page.getByText('Video source Main door has been updated.')).toBeVisible()
    const put = mockApi.callsTo('PUT', `${STREAMING_PATH}/:descr`)[0]
    expect(put?.path).toBe(`${STREAMING_PATH}/Main%20entrance`)
    expect(put?.body).toEqual({
      currentDescr: 'Main entrance',
      descr: 'Main door',
      url: MAIN_ENTRANCE_URL,
      user: 'rtsp-viewer',
      secret: '',
      exten: '300',
      tls_skip_verify: false,
      profiles: [1],
      door_phone: '0C-38-3E-32-6B-84',
      gates: [
        { id: 1, name: 'Main gate', type: 'dtmf', code: '*' },
        {
          id: 2,
          name: 'Pedestrian gate',
          type: 'url',
          url: 'http://192.168.1.50/cgi-bin/relay?output=2',
          method: 'GET',
          username: 'admin',
          password: '',
        },
      ],
    })
    expect(mockApi.callsTo('POST', TEST_PATH)).toHaveLength(3)
    await expect(row(page, 'Main door')).toContainText('Connected')
  })

  test('keeps the relay of each door phone gate and the focus when gates are removed or moved', async ({
    page,
    mockApi,
  }) => {
    await openTab(page)
    await page.getByRole('button', { name: 'Edit Main entrance' }).click()
    const drawer = page.getByRole('dialog', { name: 'Edit video source' })

    await drawer.getByRole('button', { name: 'Expand Pedestrian gate' }).click()
    await chooseOption(page, 'Type', 'DTMF')
    await expect(drawer.getByRole('textbox', { name: 'DTMF code' })).toHaveValue('#')

    await drawer.getByRole('button', { name: 'Expand Main gate' }).click()
    await drawer.getByRole('button', { name: 'Delete gate Main gate' }).click()
    await expect(drawer.getByRole('button', { name: 'Pedestrian gate', exact: true })).toBeFocused()
    await expect(drawer.getByRole('textbox', { name: 'DTMF code' })).toHaveValue('#')
    await expect(
      drawer.getByText('Code of relay 2 of the door phone, set by its provisioning.'),
    ).toBeVisible()

    await drawer.getByRole('button', { name: 'Add gate' }).click()
    await drawer.getByRole('textbox', { name: 'Name', exact: true }).last().fill('Main gate')
    await expect(drawer.getByRole('textbox', { name: 'DTMF code' }).last()).toHaveValue('*')
    await drawer.getByRole('button', { name: 'Move Main gate up' }).click()
    await expect(drawer.getByRole('button', { name: 'Move Main gate down' })).toBeFocused()
    await drawer.getByRole('button', { name: 'Move Main gate down' }).click()
    await expect(drawer.getByRole('button', { name: 'Move Main gate up' })).toBeFocused()
    await drawer.getByRole('button', { name: 'Move Main gate up' }).click()

    await drawer.getByRole('button', { name: 'Save' }).click()
    await expect(drawer.getByRole('heading')).toHaveCount(0)
    expect(mockApi.callsTo('PUT', `${STREAMING_PATH}/:descr`)[0]?.body).toMatchObject({
      gates: [
        { name: 'Main gate', type: 'dtmf', code: '*' },
        { id: 2, name: 'Pedestrian gate', type: 'dtmf', code: '#' },
      ],
    })
  })

  test('tests the connection in edit and saves only after a passing test', async ({
    page,
    mockApi,
  }) => {
    await openTab(page)
    await page.getByRole('button', { name: 'Edit Warehouse' }).click()
    const drawer = page.getByRole('dialog', { name: 'Edit video source' })

    await expect(drawer.getByText('Leave empty to keep the current password.')).toBeVisible()
    await expect(drawer.getByRole('img')).toHaveCount(0)
    await expect(drawer.getByText('Cannot connect to the video source')).toHaveCount(0)

    await drawer.getByRole('textbox', { name: 'URL' }).fill('rtsp://192.168.1.52:554/stream2')
    await drawer.getByRole('button', { name: 'Save' }).click()
    await expect(drawer.getByText('Cannot connect to the video source')).toBeVisible()
    expect(mockApi.callsTo('PUT', `${STREAMING_PATH}/:descr`)).toHaveLength(0)
    expect(mockApi.callsTo('POST', TEST_PATH).at(-1)?.body).toEqual({
      url: 'rtsp://192.168.1.52:554/stream2',
      user: 'admin',
      secret: '',
      tls_skip_verify: false,
      details: true,
      descr: 'Warehouse',
    })

    backend.check('rtsp://192.168.1.52:554/stream2', { success: true })
    backend.hold('test')
    await drawer.getByRole('button', { name: 'Test connection' }).click()
    await expect(drawer.getByRole('button', { name: 'Testing connection…' })).toBeDisabled()
    backend.release('test')
    await expect(drawer.getByRole('img', { name: 'Image from Warehouse' })).toBeVisible()

    await drawer.getByRole('textbox', { name: 'URL' }).fill('rtsp://192.168.1.52:554/stream3')
    await expect(drawer.getByRole('img')).toHaveCount(0)
    await drawer.getByRole('textbox', { name: 'URL' }).fill('rtsp://192.168.1.52:554/stream2')
    await drawer.getByRole('button', { name: 'Save' }).click()
    await expect(drawer.getByRole('heading')).toHaveCount(0)
    await expect(page.getByText('Video source Warehouse has been updated.')).toBeVisible()
    expect(
      mockApi
        .callsTo('POST', TEST_PATH)
        .filter((call) => (call.body as { url: string }).url.endsWith('stream2')),
    ).toHaveLength(2)
    await expect(row(page, 'Warehouse')).toContainText('Connected')
  })

  test('asks for the password again when the device changes', async ({ page, mockApi }) => {
    backend.check('rtsp://192.168.7.52:554/stream1', { success: true, secret: 'Warehouse-1' })
    await openTab(page)
    await page.getByRole('button', { name: 'Edit Warehouse' }).click()
    const drawer = page.getByRole('dialog', { name: 'Edit video source' })

    await expect(drawer.getByText('Leave empty to keep the current password.')).toBeVisible()
    await drawer.getByRole('textbox', { name: 'URL' }).fill('rtsp://192.168.7.52:554/stream1')
    await expect(
      drawer.getByText('Enter the password again to connect to a different device.'),
    ).toBeVisible()
    const tests = mockApi.callsTo('POST', TEST_PATH).length
    await drawer.getByRole('button', { name: 'Save' }).click()

    await expect(
      drawer.getByText('Enter the password again: the device address has changed'),
    ).toBeVisible()
    await expect(drawer.getByLabel(/^Password/)).toBeFocused()
    await expect(drawer.getByText(/authentication/i)).toHaveCount(0)
    expect(mockApi.callsTo('POST', TEST_PATH)).toHaveLength(tests)

    await drawer.getByLabel(/^Password/).fill('Warehouse-1')
    await drawer.getByRole('button', { name: 'Save' }).click()
    await expect(drawer.getByRole('heading')).toHaveCount(0)
    await expect(row(page, 'Warehouse')).toContainText('Connected')
  })

  test('keeps the stored password for another path on the same device', async ({ page }) => {
    backend.check('rtsp://192.168.1.52/stream2', { success: true, secret: 'Warehouse-1' })
    await openTab(page)
    await page.getByRole('button', { name: 'Edit Warehouse' }).click()
    const drawer = page.getByRole('dialog', { name: 'Edit video source' })

    await drawer.getByRole('textbox', { name: 'URL' }).fill('rtsp://192.168.1.52/stream2')
    await expect(drawer.getByText('Leave empty to keep the current password.')).toBeVisible()
    await drawer.getByRole('button', { name: 'Save' }).click()
    await expect(drawer.getByRole('heading')).toHaveCount(0)
    await expect(row(page, 'Warehouse')).toContainText('Connected')
  })

  test('shows a fixed text when saving fails on the server', async ({ page, mockApi }) => {
    mockApi.on('PUT', `${STREAMING_PATH}/:descr`, { status: 500 })
    await openTab(page)
    await page.getByRole('button', { name: 'Edit Parking gate' }).click()
    const drawer = page.getByRole('dialog', { name: 'Edit video source' })

    await expect(drawer.getByText('Leave empty to keep the current password.')).toHaveCount(0)
    await drawer.getByRole('button', { name: 'Save' }).click()
    await expect(drawer.getByText('Cannot save the video source')).toBeVisible()
    await expect(drawer.getByText(/500/)).toBeVisible()
  })

  test('asks before discarding changes and returns the focus', async ({ page }) => {
    await openTab(page)
    const edit = page.getByRole('button', { name: 'Edit Parking gate' })
    await edit.click()
    const drawer = page.getByRole('dialog', { name: 'Edit video source' })

    await drawer.getByRole('textbox', { name: 'Name', exact: true }).fill('Parking 2')
    await page.keyboard.press('Escape')
    await expect(page.getByRole('heading', { name: 'Unsaved changes' })).toBeVisible()
    await page.getByRole('button', { name: 'Discard changes' }).click()
    await expect(drawer.getByRole('heading')).toHaveCount(0)
    await expect(edit).toBeFocused()
  })

  test('offers to skip the TLS verification for TLS devices', async ({ page, mockApi }) => {
    const url = 'rtsps://192.168.1.70/live'
    backend.check(url, {
      success: false,
      reason: 'tls_error',
      message: 'certificate verify failed',
    })
    backend.addSource({
      descr: 'Lobby',
      url: 'rtsps://192.168.1.71/live',
      tlsSkipVerify: true,
      tlsUnpinned: true,
    })
    await page.goto('./integrations/video-sources')
    await expect(row(page, 'Lobby')).toContainText('Certificate not pinned')

    await page.getByRole('button', { name: 'Edit Lobby' }).click()
    const editDrawer = page.getByRole('dialog', { name: 'Edit video source' })
    await expect(
      editDrawer.getByRole('checkbox', { name: 'Skip TLS certificate verification' }),
    ).toBeChecked()
    await expect(editDrawer.getByText(/saved by an older version/)).toBeVisible()
    await editDrawer.getByRole('button', { name: 'Cancel' }).click()

    await page.getByRole('button', { name: 'Create video source' }).click()
    const drawer = page.getByRole('dialog', { name: 'Create video source' })
    await expect(drawer.getByRole('checkbox')).toHaveCount(0)
    await fillStep1(page, url, 'Hall')
    await drawer.getByRole('button', { name: 'Next' }).click()
    await expect(
      drawer.getByText('The certificate of the device is not valid.', { exact: false }),
    ).toBeVisible()
    await expect(drawer.getByText(/select Skip TLS certificate verification/)).toBeVisible()

    backend.check(url, { success: true })
    await drawer.getByRole('checkbox', { name: 'Skip TLS certificate verification' }).check()
    await drawer.getByRole('button', { name: 'Next' }).click()
    await expect(drawer.getByText('Step 2/2')).toBeVisible()
    expect(mockApi.callsTo('POST', TEST_PATH).at(-1)?.body).toMatchObject({ tls_skip_verify: true })
  })

  test('lets a limited administrator with Integrations manage the sources', async ({
    page,
    mockApi,
  }) => {
    mockPermissions(mockApi, ['integrations'], 'operator')
    backend.check('http://192.168.1.80/snap.jpg', { success: true })
    await openTab(page)

    await page.getByRole('button', { name: 'Create video source' }).click()
    await fillStep1(page, 'http://192.168.1.80/snap.jpg', 'Yard')
    await page.getByRole('dialog').getByRole('button', { name: 'Next' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Create' }).click()
    await expect(page.getByText('Video source Yard has been created.')).toBeVisible()
  })

  test('lays out the list as cards on a phone', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await openTab(page)

    await expect(grid(page).getByText('Actions', { exact: true }).last()).toBeVisible()
    const width = await page.evaluate(() => document.documentElement.scrollWidth)
    expect(width).toBeLessThanOrEqual(390)
    await page.getByRole('button', { name: 'Create video source' }).click()
    await expect(
      page.getByRole('dialog').getByRole('textbox', { name: 'Name', exact: true }),
    ).toBeVisible()
  })

  test('keeps an unknown door phone list usable', async ({ page, mockApi }) => {
    mockApi.on('GET', '/freepbx/rest/cti/streaming/doorphones', { status: 500 })
    await openTab(page)

    await page.getByRole('button', { name: 'Create from a door phone' }).click()
    await expect(page.getByText('Cannot retrieve the door phones')).toBeVisible()
  })

  test('waits for the profiles before listing the sources', async ({ page, mockApi }) => {
    let releaseProfiles = () => {}
    const profilesLoaded = new Promise<void>((resolve) => {
      releaseProfiles = resolve
    })

    mockApi.on('GET', '/freepbx/rest/cti/profiles', async () => {
      await profilesLoaded
      return { json: PROFILES }
    })
    await page.goto('./integrations/video-sources')

    await expect(grid(page).locator('.animate-pulse').first()).toBeVisible()
    await expect(grid(page)).not.toContainText('Main entrance (300)')
    await expect(page.getByText('#1', { exact: true })).toHaveCount(0)

    releaseProfiles()
    await expect(row(page, 'Parking gate')).toContainText('Standard')
  })

  test('never shows the stored passwords', async ({ page }) => {
    await openTab(page)

    await page.getByRole('button', { name: 'Edit Warehouse' }).click()
    const drawer = page.getByRole('dialog', { name: 'Edit video source' })
    await expect(drawer.getByRole('textbox', { name: 'Username' })).toHaveValue('admin')
    await expect(drawer.getByLabel(/^Password/)).toHaveValue('')
    await expect(drawer.getByText('Leave empty to keep the current password.')).toBeVisible()
    await drawer.getByRole('button', { name: 'Cancel' }).click()

    await page.getByRole('button', { name: 'Edit Main entrance' }).click()
    const doorDrawer = page.getByRole('dialog', { name: 'Edit video source' })
    await doorDrawer.getByRole('button', { name: 'Expand Pedestrian gate' }).click()
    await expect(doorDrawer.getByLabel(/^Password/)).toHaveValue('')
    await expect(doorDrawer.getByText('Leave empty to keep the current password.')).toBeVisible()

    const html = await page.content()
    expect(html).not.toContain('Warehouse-1')
    expect(html).not.toContain('relay-secret')
    expect(html).not.toContain('door-phone-generated')
  })

  test('shows the PBX addresses refused to a limited administrator as field errors', async ({
    page,
    mockApi,
  }) => {
    mockPermissions(mockApi, ['integrations'], 'operator')
    backend.limited = true
    backend.nodeHosts.add('192.0.2.200')
    await openTab(page)

    await page.getByRole('button', { name: 'Create video source' }).click()
    const drawer = page.getByRole('dialog', { name: 'Create video source' })
    await fillStep1(page, 'rtsp://192.0.2.200:554/live', 'Node camera')
    await drawer.getByRole('button', { name: 'Next' }).click()

    const url = drawer.getByRole('textbox', { name: 'URL' })
    await expect(
      drawer.getByText('This is an address of the PBX: enter the address of the device'),
    ).toBeVisible()
    await expect(url).toBeFocused()
    await expect(drawer.getByText('Cannot connect to the video source')).toHaveCount(0)
    await expect(drawer.getByText('Step 1/2')).toBeVisible()
    await drawer.getByRole('button', { name: 'Cancel' }).click()
    await page.getByRole('button', { name: 'Discard changes' }).click()

    await page.getByRole('button', { name: 'Edit Parking gate' }).click()
    const editDrawer = page.getByRole('dialog', { name: 'Edit video source' })
    await editDrawer.getByRole('button', { name: 'Add gate' }).click()
    await editDrawer.getByRole('textbox', { name: 'Name', exact: true }).last().fill('Side door')
    await chooseOption(page, 'Type', 'URL')
    await editDrawer.getByRole('textbox', { name: 'URL' }).last().fill('http://192.0.2.200/open')
    await editDrawer.getByRole('button', { name: 'Save' }).click()

    const gateUrl = editDrawer.getByRole('textbox', { name: 'URL' }).last()
    await expect(
      editDrawer.getByText('This is an address of the PBX: enter the address of the device'),
    ).toBeVisible()
    await expect(gateUrl).toBeFocused()
    await expect(editDrawer.getByText('Cannot save the video source')).toHaveCount(0)
    expect(mockApi.callsTo('PUT', `${STREAMING_PATH}/:descr`)).toHaveLength(1)
  })

  test('shows a source of the PBX node read-only to a limited administrator', async ({
    page,
    mockApi,
  }) => {
    mockPermissions(mockApi, ['integrations'], 'operator')
    backend.limited = true
    backend.nodeHosts.add('192.168.1.51')
    await page.goto('./integrations/video-sources')
    await expect(row(page, 'Parking gate')).toContainText('Not connected')

    await expect(row(page, 'Parking gate').getByRole('button', { name: /^Edit/ })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Edit Warehouse' })).toBeVisible()
    await openRowMenu(page, 'Parking gate')
    await expect(page.getByRole('menuitem', { name: 'Delete' })).toBeVisible()
  })

  test('does not ask to forward a port for an address the PBX never contacts', async ({ page }) => {
    backend.nodeHosts.add('192.0.2.200')
    backend.check('rtsp://192.0.2.200:554/live', { success: true })
    await openTab(page)
    await page.getByRole('button', { name: 'Create video source' }).click()
    const drawer = page.getByRole('dialog', { name: 'Create video source' })
    await fillStep1(page, 'rtsp://192.0.2.200:554/live', 'Node camera')
    await drawer.getByRole('button', { name: 'Next' }).click()

    await expect(drawer.getByText('Step 2/2')).toBeVisible()
    await expect(drawer.getByText('The PBX cannot reach the device at this address')).toHaveCount(0)
    await drawer.getByRole('button', { name: 'Previous' }).click()
    await expect(drawer.getByText('The PBX reaches the device at this address.')).toHaveCount(0)
    await expect(drawer.getByText('The PBX cannot reach the device at this address')).toHaveCount(0)
  })

  test('asks for the password when a door phone source points to another address', async ({
    page,
    mockApi,
  }) => {
    backend.check('rtsp://192.168.9.218:554/h264/stream.live0', { success: true })
    await openTab(page)
    await page.getByRole('button', { name: 'Create from a door phone' }).click()
    await page
      .getByRole('dialog', { name: 'Create from a door phone' })
      .getByRole('button', { name: 'Use Courtyard' })
      .click()

    const drawer = page.getByRole('dialog', { name: 'Create video source' })
    await expect(drawer.getByLabel(/^Password/)).toHaveCount(0)
    await drawer
      .getByRole('textbox', { name: 'URL' })
      .fill('rtsp://192.168.9.218:554/h264/stream.live0')
    await drawer.getByRole('button', { name: 'Next' }).click()

    const password = drawer.getByLabel(/^Password/)
    await expect(
      drawer.getByText(
        'The password of the door phone is sent only to the address it registers from: enter the password to use this address',
      ),
    ).toBeVisible()
    await expect(password).toBeFocused()
    await expect(drawer.getByRole('textbox', { name: 'Username' })).toHaveValue('rtsp-viewer')

    await drawer.getByRole('button', { name: 'Next' }).click()
    await expect(drawer.getByText('Enter the password', { exact: true })).toBeVisible()
    await password.fill('Typed-1')
    await drawer.getByRole('button', { name: 'Next' }).click()
    await expect(drawer.getByText('Step 2/2')).toBeVisible()
    expect(mockApi.callsTo('POST', TEST_PATH).at(-1)?.body).toEqual({
      url: 'rtsp://192.168.9.218:554/h264/stream.live0',
      user: 'rtsp-viewer',
      secret: 'Typed-1',
      tls_skip_verify: false,
      details: true,
    })

    await drawer.getByRole('button', { name: 'Create' }).click()
    await expect(page.getByText('Video source Courtyard has been created.')).toBeVisible()
    const body = mockApi.callsTo('POST', STREAMING_PATH)[0]?.body as Record<string, unknown>
    expect(body).toMatchObject({ user: 'rtsp-viewer', secret: 'Typed-1' })
    expect(body).not.toHaveProperty('door_phone')
  })

  test('suggests the public address of a door phone the PBX cannot reach', async ({
    page,
    mockApi,
  }) => {
    backend.unreachableHosts.add('192.168.5.218')
    backend.publicAddresses.set('192.168.5.218', '203.0.113.7')
    backend.check('rtsp://203.0.113.7:554/h264/stream.live0', { success: true })
    await openTab(page)
    await page.getByRole('button', { name: 'Create from a door phone' }).click()
    await page
      .getByRole('dialog', { name: 'Create from a door phone' })
      .getByRole('button', { name: 'Use Courtyard' })
      .click()

    const drawer = page.getByRole('dialog', { name: 'Create video source' })
    await expect(drawer.getByText('The PBX cannot reach the device at this address')).toBeVisible()
    await expect(
      drawer.getByText('The PBX reaches the door phone at its public address 203.0.113.7.'),
    ).toBeVisible()
    await drawer.getByRole('button', { name: 'Use public address' }).click()
    await expect(drawer.getByRole('textbox', { name: 'URL' })).toHaveValue(
      'rtsp://203.0.113.7:554/h264/stream.live0',
    )
    await expect(drawer.getByText('The PBX reaches the device at this address.')).toBeVisible()
    expect(mockApi.callsTo('POST', '/freepbx/rest/cti/streaming/reachability').at(0)?.body).toEqual(
      {
        url: 'rtsp://192.168.5.218:554/h264/stream.live0',
        door_phone: '0C-38-3E-32-7C-01',
      },
    )

    await drawer.getByRole('button', { name: 'Next' }).click()
    await expect(drawer.getByText('Step 2/2')).toBeVisible()
    expect(mockApi.callsTo('POST', TEST_PATH).at(-1)?.body).toMatchObject({
      url: 'rtsp://203.0.113.7:554/h264/stream.live0',
      secret: '',
      door_phone: '0C-38-3E-32-7C-01',
    })
  })
})
