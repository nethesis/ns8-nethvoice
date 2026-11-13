//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { expect, test } from '../fixtures/mockApi'

const PROFILES = [
  { id: 1, name: 'Base', macro_permissions: {} },
  { id: 3, name: 'Standard', macro_permissions: {} },
]

const EXTENSIONS = [
  { extension: '300', name: 'Anna Miller', password: '' },
  { extension: '390', name: 'Door phone', password: '' },
]

const SOURCES = [
  {
    descr: 'Front door',
    url: 'http://192.0.2.10/snapshot.jpg',
    user: '',
    secret: '',
    'frame-rate': 1000,
    exten: 390,
    open: '*9',
    profiles: ['1', '3'],
  },
  {
    descr: 'Warehouse',
    url: 'http://192.0.2.20/image.jpg',
    exten: null,
    open: '',
    profiles: [],
  },
]

const PNG_FRAME =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='

test.describe('integrations: video sources', () => {
  test.beforeEach(async ({ signedIn, mockApi }) => {
    void signedIn
    mockApi
      .on('GET', '/freepbx/rest/cti/profiles', { json: PROFILES })
      .on('GET', '/freepbx/rest/physicalextensions', { json: EXTENSIONS })
      .on('GET', '/freepbx/rest/cti/streaming', { json: SOURCES })
  })

  test('lists the video sources', async ({ page }) => {
    await page.goto('./integrations/video-sources')

    const rows = page.getByRole('grid', { name: 'Video sources' }).getByRole('row')

    await expect(rows).toHaveCount(3)
    await expect(rows.nth(1)).toContainText('Front door')
    await expect(rows.nth(1)).toContainText('Opening code: *9')
    await expect(rows.nth(1)).toContainText('390 - Door phone')
    await expect(rows.nth(1)).toContainText('Base, Standard')
    await expect(rows.nth(2)).toContainText('Warehouse')
  })

  test('shows an empty state', async ({ page, mockApi }) => {
    mockApi.on('GET', '/freepbx/rest/cti/streaming', { json: [] })

    await page.goto('./integrations/video-sources')

    await expect(page.getByText('No video sources', { exact: true })).toBeVisible()
    await expect(page.getByRole('grid')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Create video source' })).toHaveCount(1)
  })

  test('reports a load error and retries', async ({ page, mockApi }) => {
    let failing = true

    mockApi.on('GET', '/freepbx/rest/cti/streaming', () =>
      failing ? { status: 500 } : { json: SOURCES },
    )

    await page.goto('./integrations/video-sources')
    await expect(page.getByText('Cannot load the video sources')).toBeVisible()

    failing = false
    await page.getByRole('button', { name: 'Retry' }).click()

    await expect(page.getByRole('grid', { name: 'Video sources' }).getByRole('row')).toHaveCount(3)
  })

  test('validates, tests and creates a video source', async ({ page, mockApi }) => {
    mockApi
      .on('POST', '/freepbx/rest/cti/sources/test', { json: PNG_FRAME })
      .on('POST', '/freepbx/rest/cti/streaming', { status: 200 })

    await page.goto('./integrations/video-sources')
    await page.getByRole('button', { name: 'Create video source' }).first().click()

    const drawer = page.getByRole('dialog')
    await drawer.getByRole('textbox', { name: 'Name' }).fill('front door!')
    await drawer.getByRole('textbox', { name: 'Image URL' }).fill('rtsp://192.0.2.30')
    await drawer.getByRole('textbox', { name: 'Opening code' }).fill('9a')
    await drawer.getByRole('button', { name: 'Create video source' }).click()

    await expect(drawer.getByText('Another video source has the same name')).toBeVisible()
    await expect(drawer.getByText(/Enter a URL starting with http/)).toBeVisible()
    await expect(drawer.getByText(/Use digits, optionally preceded/)).toBeVisible()
    await expect(drawer.getByText('Select at least one profile')).toBeVisible()
    expect(mockApi.callsTo('POST', '/freepbx/rest/cti/streaming')).toHaveLength(0)

    await drawer.getByRole('textbox', { name: 'Name' }).fill('Parking')
    await drawer.getByRole('textbox', { name: 'Image URL' }).fill('http://192.0.2.30/snapshot.png')
    await drawer.getByRole('button', { name: 'Test source' }).click()

    await expect(drawer.getByText('The source returned an image')).toBeVisible()
    await expect(drawer.getByRole('img', { name: 'Image from Parking' })).toBeVisible()
    expect(mockApi.callsTo('POST', '/freepbx/rest/cti/sources/test')[0].body).toEqual({
      url: 'http://192.0.2.30/snapshot.png',
    })

    await drawer.getByRole('combobox', { name: 'Extension' }).click()
    await page.getByRole('option', { name: '300 - Anna Miller' }).click()
    await drawer.getByRole('textbox', { name: 'Opening code' }).fill('#1')
    await drawer.getByRole('combobox', { name: 'Profiles' }).click()
    await page.getByRole('option', { name: 'Standard' }).click()
    await drawer.getByRole('heading', { name: 'Create video source' }).click()
    await drawer.getByRole('button', { name: 'Create video source' }).click()

    await expect(drawer).toBeHidden()
    expect(mockApi.callsTo('POST', '/freepbx/rest/cti/streaming')[0].body).toEqual({
      descr: 'Parking',
      url: 'http://192.0.2.30/snapshot.png',
      exten: '300',
      open: '#1',
      profiles: [3],
    })
  })

  test('reports a failed test', async ({ page, mockApi }) => {
    mockApi.on('POST', '/freepbx/rest/cti/sources/test', { status: 500 })

    await page.goto('./integrations/video-sources')
    await page.getByRole('button', { name: 'Edit Warehouse' }).click()

    const drawer = page.getByRole('dialog')
    await drawer.getByRole('button', { name: 'Test source' }).click()

    await expect(drawer.getByText('Cannot read an image from the source')).toBeVisible()
  })

  test('fails the test when the source does not return an image', async ({ page, mockApi }) => {
    mockApi.on('POST', '/freepbx/rest/cti/sources/test', {
      json: Buffer.from('<html><body>login</body></html>').toString('base64'),
    })

    await page.goto('./integrations/video-sources')
    await page.getByRole('button', { name: 'Edit Warehouse' }).click()

    const drawer = page.getByRole('dialog')
    await drawer.getByRole('button', { name: 'Test source' }).click()

    await expect(drawer.getByText(/does not return a JPEG, PNG or GIF image/)).toBeVisible()
    await expect(drawer.getByRole('img')).toHaveCount(0)
  })

  test('finds a source by the name of its profiles', async ({ page }) => {
    await page.goto('./integrations/video-sources')
    await page.getByRole('textbox', { name: 'Filter video sources' }).fill('Standard')

    const rows = page.getByRole('grid', { name: 'Video sources' }).getByRole('row')
    await expect(rows).toHaveCount(2)
    await expect(rows.nth(1)).toContainText('Front door')
  })

  test('edits a video source by its current name', async ({ page, mockApi }) => {
    mockApi.on('PUT', '/freepbx/rest/cti/streaming/:descr', { status: 200 })

    await page.goto('./integrations/video-sources')
    await page.getByRole('button', { name: 'Edit Front door' }).click()

    const drawer = page.getByRole('dialog')
    await expect(drawer.getByRole('textbox', { name: 'Image URL' })).toHaveValue(
      'http://192.0.2.10/snapshot.jpg',
    )
    await drawer.getByRole('textbox', { name: 'Name' }).fill('Main door')
    await expect(drawer.getByText(/Renaming a source also renames/)).toBeVisible()
    await drawer.getByRole('button', { name: 'Remove Base' }).click()
    await drawer.getByRole('button', { name: 'Save' }).click()

    await expect(drawer).toBeHidden()
    const put = mockApi.callsTo('PUT', '/freepbx/rest/cti/streaming/:descr')
    expect(put[0].path).toBe('/freepbx/rest/cti/streaming/Front%20door')
    expect(put[0].body).toEqual({
      currentDescr: 'Front door',
      descr: 'Main door',
      url: 'http://192.0.2.10/snapshot.jpg',
      exten: '390',
      open: '*9',
      profiles: [3],
    })
  })

  test('keeps the drawer open when saving fails', async ({ page, mockApi }) => {
    mockApi.on('PUT', '/freepbx/rest/cti/streaming/:descr', { status: 500 })

    await page.goto('./integrations/video-sources')
    await page.getByRole('button', { name: 'Edit Front door' }).click()

    const drawer = page.getByRole('dialog')
    await drawer.getByRole('button', { name: 'Save' }).click()

    await expect(drawer.getByText('Cannot save the video source')).toBeVisible()
  })

  test('deletes a video source', async ({ page, mockApi }) => {
    mockApi.on('DELETE', '/freepbx/rest/cti/streaming/:name', { status: 200 })

    await page.goto('./integrations/video-sources')
    await page.getByRole('button', { name: 'Open the menu of Warehouse' }).click()
    await page.getByRole('menuitem', { name: 'Delete' }).click()

    const modal = page.getByRole('dialog')
    await modal.getByRole('button', { name: 'Delete' }).click()

    await expect(modal).toBeHidden()
    expect(mockApi.callsTo('DELETE', '/freepbx/rest/cti/streaming/:name')[0].path).toBe(
      '/freepbx/rest/cti/streaming/Warehouse',
    )
  })
})
