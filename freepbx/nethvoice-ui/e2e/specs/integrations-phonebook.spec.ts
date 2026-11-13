//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { expect, test } from '../fixtures/mockApi'

const FIELDS = ['company', 'name', 'owner_id', 'workemail', 'workphone']

const GROUPS = [
  { id: 1, name: 'Sales' },
  { id: 2, name: 'Support' },
]

const SOURCES = {
  custom_1: {
    dbtype: 'mysql',
    host: 'crm.example.com',
    port: '3306',
    user: 'reader',
    password: 'stored-password',
    dbname: 'crm',
    query: 'SELECT * FROM contacts',
    mapping: { full_name: 'name', phone: 'workphone' },
    interval: '1440',
    type: 'CRM contacts',
    access: 'public',
    enabled: true,
  },
  custom_2: {
    dbtype: 'csv',
    url: 'https://files.example.com/suppliers.csv',
    mapping: { Company: 'company' },
    interval: 60,
    type: 'Suppliers',
    access: 'group:Sales',
    enabled: false,
  },
}

test.describe('integrations: phonebook sources', () => {
  test.beforeEach(async ({ signedIn, mockApi }) => {
    void signedIn
    mockApi
      .on('GET', '/freepbx/rest/phonebook/config', { json: SOURCES })
      .on('GET', '/freepbx/rest/phonebook/fields', { json: FIELDS })
      .on('GET', '/freepbx/rest/cti/groups', { json: GROUPS })
  })

  test('lists the sources', async ({ page }) => {
    await page.goto('./integrations/phonebook')

    const rows = page.getByRole('grid', { name: 'Phonebook' }).getByRole('row')

    await expect(rows).toHaveCount(3)
    await expect(rows.nth(1)).toContainText('CRM contacts')
    await expect(rows.nth(1)).toContainText('MySQL')
    await expect(rows.nth(1)).toContainText('Public')
    await expect(rows.nth(1)).toContainText('Every 24 hours')
    await expect(rows.nth(1)).toContainText('Enabled')
    await expect(rows.nth(2)).toContainText('Suppliers')
    await expect(rows.nth(2)).toContainText('CSV file')
    await expect(rows.nth(2)).toContainText('Sales')
    await expect(rows.nth(2)).toContainText('Every hour')
    await expect(rows.nth(2)).toContainText('Disabled')
    await expect(page.getByText('stored-password')).toHaveCount(0)
  })

  test('shows an empty state when the API returns an empty list', async ({ page, mockApi }) => {
    mockApi.on('GET', '/freepbx/rest/phonebook/config', { json: [] })

    await page.goto('./integrations/phonebook')

    await expect(page.getByText('No phonebook sources')).toBeVisible()
    await expect(page.getByRole('grid')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Create source' })).toHaveCount(1)
  })

  test('reports a load error and retries', async ({ page, mockApi }) => {
    let failing = true

    mockApi.on('GET', '/freepbx/rest/phonebook/config', () =>
      failing ? { status: 500, json: { status: 'Permission denied' } } : { json: SOURCES },
    )

    await page.goto('./integrations/phonebook')
    await expect(page.getByText('Cannot load the phonebook sources')).toBeVisible()

    failing = false
    await page.getByRole('button', { name: 'Retry' }).click()

    await expect(page.getByRole('grid', { name: 'Phonebook' }).getByRole('row')).toHaveCount(3)
  })

  test('validates, tests, maps and creates a database source', async ({ page, mockApi }) => {
    mockApi
      .on('POST', '/freepbx/rest/phonebook/test', {
        json: [
          { full_name: 'Anna Miller', phone: '300', email: 'a.miller@example.com', type: 'x' },
          { full_name: 'Christopher Davis', phone: '301', email: '', type: 'x' },
        ],
      })
      .on('POST', '/freepbx/rest/phonebook/config', { status: 200 })
    const pageErrors: string[] = []
    page.on('pageerror', (error) => pageErrors.push(error.message))

    await page.goto('./integrations/phonebook')
    await page.getByRole('button', { name: 'Create source' }).first().click()

    const drawer = page.getByRole('dialog')
    await drawer.getByRole('button', { name: 'Create source' }).click()

    await expect(drawer.getByText('Enter the phonebook name')).toBeVisible()
    await expect(drawer.getByText('Enter the host')).toBeVisible()
    await expect(drawer.getByText('Enter the password')).toBeVisible()
    await expect(drawer.getByText('Enter the query')).toBeVisible()
    await expect(drawer.getByText('Test the source to read its columns.')).toBeVisible()
    expect(mockApi.callsTo('POST', '/freepbx/rest/phonebook/config')).toHaveLength(0)

    await drawer.getByRole('textbox', { name: 'Phonebook name' }).fill('CRM')
    await drawer.getByRole('textbox', { name: 'Host' }).fill('db.example.com')
    await drawer.getByRole('textbox', { name: 'Database' }).fill('crm')
    await drawer.getByRole('textbox', { name: 'User' }).fill('reader')
    await drawer.getByLabel('Password', { exact: true }).fill('new-secret')
    await drawer.getByRole('textbox', { name: 'Query' }).fill('SELECT * FROM people')
    await drawer.getByRole('button', { name: 'Create source' }).click()
    await expect(drawer.getByRole('button', { name: 'Test source' })).toBeFocused()
    await drawer.getByRole('button', { name: 'Test source' }).click()

    await expect(drawer.getByText(/first 2 rows shown below/)).toBeVisible()
    await expect(drawer.getByRole('table')).toContainText('Anna Miller')
    expect(mockApi.callsTo('POST', '/freepbx/rest/phonebook/test')[0].body).toEqual({
      dbtype: 'mysql',
      host: 'db.example.com',
      port: '3306',
      user: 'reader',
      password: 'new-secret',
      dbname: 'crm',
      query: 'SELECT * FROM people',
    })

    await drawer.getByRole('combobox', { name: 'full_name' }).click()
    await page.getByRole('option', { name: 'name', exact: true }).click()
    await drawer.getByRole('combobox', { name: 'phone' }).click()
    await expect(page.getByRole('option', { name: 'name', exact: true })).toHaveCount(0)
    await page.getByRole('option', { name: 'workphone' }).click()
    expect(pageErrors).toEqual([])

    await drawer.getByText('Groups', { exact: true }).first().click()
    await drawer.getByRole('combobox', { name: 'Groups' }).click()
    await page.getByRole('option', { name: 'Support' }).click()
    await drawer.getByRole('heading', { name: 'Settings' }).click()
    await drawer.getByRole('combobox', { name: 'Synchronization' }).click()
    await page.getByRole('option', { name: 'Every 6 hours' }).click()
    await drawer.getByRole('button', { name: 'Create source' }).click()

    await expect(drawer).toBeHidden()
    expect(mockApi.callsTo('POST', '/freepbx/rest/phonebook/config')[0].body).toEqual({
      dbtype: 'mysql',
      host: 'db.example.com',
      port: '3306',
      user: 'reader',
      password: 'new-secret',
      dbname: 'crm',
      query: 'SELECT * FROM people',
      mapping: { full_name: 'name', phone: 'workphone' },
      type: 'CRM',
      access: 'group:Support',
      interval: 360,
      enabled: true,
    })
  })

  test('uploads a CSV file and uses its address', async ({ page, mockApi }) => {
    mockApi
      .on('POST', '/freepbx/rest/phonebook/uploadfile', {
        json: { status: true, uri: 'file:///var/lib/nethvoice/phonebook/uploads/abc123.csv' },
      })
      .on('POST', '/freepbx/rest/phonebook/test', {
        json: [{ Name: 'Anna Miller', Phone: '300' }],
      })

    await page.goto('./integrations/phonebook')
    await page.getByRole('button', { name: 'Create source' }).first().click()

    const drawer = page.getByRole('dialog')
    await drawer.getByRole('combobox', { name: 'Source type' }).click()
    await page.getByRole('option', { name: 'CSV file' }).click()
    await drawer.locator('input[type=file]').setInputFiles({
      name: 'contacts.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('Name,Phone\nAnna Miller,300\n'),
    })

    await expect(drawer.getByRole('textbox', { name: 'URL' })).toHaveValue(
      'file:///var/lib/nethvoice/phonebook/uploads/abc123.csv',
    )
    expect(mockApi.callsTo('POST', '/freepbx/rest/phonebook/uploadfile')).toHaveLength(1)

    await drawer.getByRole('button', { name: 'Test source' }).click()
    await expect(drawer.getByText(/first row shown below/)).toBeVisible()
    expect(mockApi.callsTo('POST', '/freepbx/rest/phonebook/test')[0].body).toEqual({
      dbtype: 'csv',
      url: 'file:///var/lib/nethvoice/phonebook/uploads/abc123.csv',
    })
  })

  test('rejects a file that is not a CSV before uploading it', async ({ page, mockApi }) => {
    await page.goto('./integrations/phonebook')
    await page.getByRole('button', { name: 'Create source' }).first().click()

    const drawer = page.getByRole('dialog')
    await drawer.getByRole('combobox', { name: 'Source type' }).click()
    await page.getByRole('option', { name: 'CSV file' }).click()
    await drawer.locator('input[type=file]').setInputFiles({
      name: 'evil.exe',
      mimeType: 'application/octet-stream',
      buffer: Buffer.from('MZ'),
    })

    await expect(drawer.getByText('Choose a .csv or .txt file')).toBeVisible()
    expect(mockApi.callsTo('POST', '/freepbx/rest/phonebook/uploadfile')).toHaveLength(0)
  })

  test('explains an upload rejected by the PBX', async ({ page, mockApi }) => {
    mockApi.on('POST', '/freepbx/rest/phonebook/uploadfile', {
      status: 400,
      json: { status: 'File upload is required' },
    })

    await page.goto('./integrations/phonebook')
    await page.getByRole('button', { name: 'Create source' }).first().click()

    const drawer = page.getByRole('dialog')
    await drawer.getByRole('combobox', { name: 'Source type' }).click()
    await page.getByRole('option', { name: 'CSV file' }).click()
    await drawer.locator('input[type=file]').setInputFiles({
      name: 'contacts.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('Name,Phone\n'),
    })

    await expect(drawer.getByText(/rejected the file: it may be empty or larger/)).toBeVisible()
  })

  test('keeps a synchronization interval missing from the list', async ({ page, mockApi }) => {
    mockApi.on('GET', '/freepbx/rest/phonebook/config', {
      json: { custom_1: { ...SOURCES.custom_1, interval: 120 } },
    })

    await page.goto('./integrations/phonebook')
    await page.getByRole('button', { name: 'Edit CRM contacts' }).click()

    await expect(
      page.getByRole('dialog').getByRole('combobox', { name: 'Synchronization' }),
    ).toHaveValue('Every 2 hours')
  })

  test('reports a source that cannot be read', async ({ page, mockApi }) => {
    mockApi.on('POST', '/freepbx/rest/phonebook/test', { json: { status: false } })

    await page.goto('./integrations/phonebook')
    await page.getByRole('button', { name: 'Edit Suppliers' }).click()

    const drawer = page.getByRole('dialog')
    await drawer.getByRole('button', { name: 'Test source' }).click()

    await expect(drawer.getByText('Cannot read the source')).toBeVisible()
  })

  test('edits a source keeping the stored password', async ({ page, mockApi }) => {
    mockApi.on('POST', '/freepbx/rest/phonebook/config/:id', { status: 200 })

    await page.goto('./integrations/phonebook')
    await page.getByRole('button', { name: 'Edit CRM contacts' }).click()

    const drawer = page.getByRole('dialog')
    await expect(drawer.getByLabel('Password', { exact: true })).toHaveValue('')
    await expect(drawer.getByText('Leave empty to keep the current password')).toBeVisible()
    await expect(drawer.getByRole('textbox', { name: 'Source type' })).toHaveValue('MySQL')
    await expect(drawer.getByRole('combobox', { name: 'full_name' })).toHaveValue('name')
    await drawer.getByRole('textbox', { name: 'Phonebook name' }).fill('CRM customers')
    await drawer.getByRole('button', { name: 'Save' }).click()

    await expect(drawer).toBeHidden()
    const calls = mockApi.callsTo('POST', '/freepbx/rest/phonebook/config/:id')
    expect(calls[0].path).toBe('/freepbx/rest/phonebook/config/custom_1')
    expect(calls[0].body).toEqual({
      dbtype: 'mysql',
      host: 'crm.example.com',
      port: '3306',
      user: 'reader',
      password: 'stored-password',
      dbname: 'crm',
      query: 'SELECT * FROM contacts',
      mapping: { full_name: 'name', phone: 'workphone' },
      type: 'CRM customers',
      access: 'public',
      interval: 1440,
      enabled: true,
    })
  })

  test('keeps the drawer open when saving fails', async ({ page, mockApi }) => {
    mockApi.on('POST', '/freepbx/rest/phonebook/config/:id', {
      status: 400,
      json: { status: 'None of the selected sharing groups exist' },
    })

    await page.goto('./integrations/phonebook')
    await page.getByRole('button', { name: 'Edit Suppliers' }).click()

    const drawer = page.getByRole('dialog')
    await drawer.getByRole('button', { name: 'Save' }).click()

    await expect(drawer.getByText('Cannot save the source')).toBeVisible()
    await expect(drawer.getByText('None of the selected sharing groups exist')).toBeVisible()
  })

  test('synchronizes a source now', async ({ page, mockApi }) => {
    mockApi.on('POST', '/freepbx/rest/phonebook/syncnow/:id', { json: { status: true } })

    await page.goto('./integrations/phonebook')
    await page.getByRole('button', { name: 'Open the menu of Suppliers' }).click()
    await expect(page.getByRole('menuitem', { name: 'Sync now' })).toBeDisabled()
    await page.getByRole('button', { name: 'Open the menu of Suppliers' }).click()
    await expect(page.getByRole('menuitem', { name: 'Sync now' })).toHaveCount(0)

    await page.getByRole('button', { name: 'Open the menu of CRM contacts' }).click()
    await page.getByRole('menuitem', { name: 'Sync now' }).click()

    await expect(page.getByText('Synchronization completed')).toBeVisible()
    expect(mockApi.callsTo('POST', '/freepbx/rest/phonebook/syncnow/:id')[0].path).toBe(
      '/freepbx/rest/phonebook/syncnow/custom_1',
    )
  })

  test('reports a failed synchronization', async ({ page, mockApi }) => {
    mockApi.on('POST', '/freepbx/rest/phonebook/syncnow/:id', {
      status: 500,
      json: { status: false },
    })

    await page.goto('./integrations/phonebook')
    await page.getByRole('button', { name: 'Open the menu of CRM contacts' }).click()
    await page.getByRole('menuitem', { name: 'Sync now' }).click()

    await expect(page.getByText('Cannot synchronize CRM contacts')).toBeVisible()
  })

  test('enables a disabled source', async ({ page, mockApi }) => {
    mockApi.on('POST', '/freepbx/rest/phonebook/config/:id', { status: 200 })

    await page.goto('./integrations/phonebook')
    await page.getByRole('button', { name: 'Open the menu of Suppliers' }).click()
    await page.getByRole('menuitem', { name: 'Enable' }).click()

    await expect(page.getByText('Source enabled')).toBeVisible()
    const calls = mockApi.callsTo('POST', '/freepbx/rest/phonebook/config/:id')
    expect(calls[0].path).toBe('/freepbx/rest/phonebook/config/custom_2')
    expect(calls[0].body).toEqual({
      dbtype: 'csv',
      url: 'https://files.example.com/suppliers.csv',
      mapping: { Company: 'company' },
      type: 'Suppliers',
      access: 'group:Sales',
      interval: 60,
      enabled: true,
    })
  })

  test('deletes a source', async ({ page, mockApi }) => {
    mockApi.on('DELETE', '/freepbx/rest/phonebook/config/:id', { status: 200 })

    await page.goto('./integrations/phonebook')
    await page.getByRole('button', { name: 'Open the menu of Suppliers' }).click()
    await page.getByRole('menuitem', { name: 'Delete' }).click()

    const modal = page.getByRole('dialog')
    await expect(modal).toContainText('contacts imported from this source are removed')
    await modal.getByRole('button', { name: 'Delete' }).click()

    await expect(modal).toBeHidden()
    expect(mockApi.callsTo('DELETE', '/freepbx/rest/phonebook/config/:id')[0].path).toBe(
      '/freepbx/rest/phonebook/config/custom_2',
    )
  })
})
