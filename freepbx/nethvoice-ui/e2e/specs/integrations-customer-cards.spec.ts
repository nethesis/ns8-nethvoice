//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { expect, test } from '../fixtures/mockApi'

const b64 = (text: string) => Buffer.from(text, 'utf-8').toString('base64')

const PROFILES = [
  { id: 1, name: 'Base', macro_permissions: {} },
  { id: 3, name: 'Standard', macro_permissions: {} },
]

const CONNECTIONS = [
  {
    id: 1,
    host: 'localhost',
    port: '3306',
    type: 'mysql',
    user: 'ctiuser',
    pass: 'stored-password',
    name: 'phonebook',
    creation: '2026-01-10 09:00:00',
  },
  {
    id: 5,
    host: 'crm.example.com',
    port: '5432',
    type: 'postgres',
    user: 'reader',
    pass: 'crm-password',
    name: 'crm',
    creation: '2026-02-01 10:00:00',
  },
  {
    id: 6,
    host: 'erp.example.com',
    port: '1433',
    type: 'mssql:7_4',
    user: 'erp',
    pass: 'erp-password',
    name: 'erp',
    creation: '2026-02-02 10:00:00',
  },
]

const TYPES = {
  mysql: 'MySQL',
  postgres: 'PostgreSQL',
  'mssql:7_4': 'SQL Server 2012/2014',
}

const TEMPLATES = [
  {
    name: 'identity',
    custom: false,
    html: b64('<!-- color: red --><div>identity</div>'),
    color: 'red',
  },
  { name: 'invoices', custom: true, html: b64('<p><%= results[0].total %></p>'), color: null },
  { name: 'notes', custom: true, html: b64('<p>notes</p>'), color: null },
]

const CARDS = [
  {
    id: 4,
    name: 'Open invoices',
    creation: '2026-02-01 10:00:00',
    query: b64('SELECT * FROM invoices'),
    template: { name: 'invoices', custom: true },
    dbconn_id: 5,
    permission_id: 31,
    profiles: [3],
  },
]

test.describe('integrations: customer cards', () => {
  test.beforeEach(async ({ signedIn, mockApi }) => {
    void signedIn
    mockApi
      .on('GET', '/freepbx/rest/cti/profiles', { json: PROFILES })
      .on('GET', '/freepbx/rest/cti/dbconn', { json: CONNECTIONS })
      .on('GET', '/freepbx/rest/cti/dbconn/type', { json: TYPES })
      .on('GET', '/freepbx/rest/cti/customer_card/template', { json: TEMPLATES })
      .on('GET', '/freepbx/rest/cti/customer_card', { json: CARDS })
  })

  test('lists cards, templates and connections', async ({ page }) => {
    await page.goto('./integrations/customer-cards')

    const cards = page.getByRole('grid', { name: 'Cards' }).getByRole('row')
    await expect(cards).toHaveCount(2)
    await expect(cards.nth(1)).toContainText('Open invoices')
    await expect(cards.nth(1)).toContainText('crm')
    await expect(cards.nth(1)).toContainText('invoices')
    await expect(cards.nth(1)).toContainText('Standard')

    const templates = page.getByRole('grid', { name: 'Templates' }).getByRole('row')
    await expect(templates).toHaveCount(4)
    await expect(templates.nth(1)).toContainText('identity')
    await expect(templates.nth(1)).toContainText('Built-in')
    await expect(templates.nth(2)).toContainText('Custom')

    const connections = page.getByRole('grid', { name: 'Database connections' }).getByRole('row')
    await expect(connections).toHaveCount(4)
    await expect(connections.nth(1)).toContainText('crm')
    await expect(connections.nth(1)).toContainText('PostgreSQL')
    await expect(connections.nth(3)).toContainText('phonebook')
    await expect(connections.nth(3)).toContainText('Managed by the system')
    await expect(page.getByRole('button', { name: 'Edit phonebook' })).toHaveCount(0)
    await expect(page.getByText('crm-password')).toHaveCount(0)
  })

  test('shows an empty state', async ({ page, mockApi }) => {
    mockApi
      .on('GET', '/freepbx/rest/cti/dbconn', { json: [] })
      .on('GET', '/freepbx/rest/cti/customer_card/template', { json: [] })
      .on('GET', '/freepbx/rest/cti/customer_card', { json: [] })

    await page.goto('./integrations/customer-cards')

    await expect(page.getByText('No customer cards configured')).toBeVisible()
    await expect(page.getByRole('grid')).toHaveCount(0)
  })

  test('reports a load error and retries', async ({ page, mockApi }) => {
    let failing = true

    mockApi.on('GET', '/freepbx/rest/cti/customer_card', () =>
      failing ? { status: 500 } : { json: CARDS },
    )

    await page.goto('./integrations/customer-cards')
    await expect(page.getByText('Cannot load the customer cards')).toBeVisible()

    failing = false
    await page.getByRole('button', { name: 'Retry' }).click()

    await expect(page.getByRole('grid', { name: 'Cards' }).getByRole('row')).toHaveCount(2)
  })

  test('validates, tests and creates a database connection', async ({ page, mockApi }) => {
    mockApi
      .on('POST', '/api/dbconn/test', { status: 200 })
      .on('POST', '/freepbx/rest/cti/dbconn', { status: 200 })

    await page.goto('./integrations/customer-cards')
    await page.getByRole('button', { name: 'Create connection' }).click()

    const drawer = page.getByRole('dialog')
    await drawer.getByRole('button', { name: 'Create connection' }).click()

    await expect(drawer.getByText('Enter the database name')).toBeVisible()
    await expect(drawer.getByText('Enter the host')).toBeVisible()
    await expect(drawer.getByText('Enter the password')).toBeVisible()
    expect(mockApi.callsTo('POST', '/freepbx/rest/cti/dbconn')).toHaveLength(0)

    await drawer.getByRole('combobox', { name: 'Database type' }).click()
    await page.getByRole('option', { name: 'PostgreSQL' }).click()
    await expect(drawer.getByRole('textbox', { name: 'Port' })).toHaveValue('5432')
    await drawer.getByRole('textbox', { name: 'Database' }).fill('orders')
    await drawer.getByRole('textbox', { name: 'Host' }).fill('orders.example.com')
    await drawer.getByRole('textbox', { name: 'User' }).fill('reader')
    await drawer.getByLabel('Password', { exact: true }).fill('orders-secret')
    await drawer.getByRole('button', { name: 'Test connection' }).click()

    await expect(drawer.getByText('Connection succeeded')).toBeVisible()
    expect(mockApi.callsTo('POST', '/api/dbconn/test')[0].body).toEqual({
      type: 'postgres',
      name: 'orders',
      host: 'orders.example.com',
      port: '5432',
      user: 'reader',
      pass: 'orders-secret',
    })

    await drawer.getByRole('button', { name: 'Create connection' }).click()

    await expect(drawer).toBeHidden()
    expect(mockApi.callsTo('POST', '/freepbx/rest/cti/dbconn')[0].body).toEqual({
      type: 'postgres',
      name: 'orders',
      host: 'orders.example.com',
      port: '5432',
      user: 'reader',
      pass: 'orders-secret',
    })
  })

  test('reports a failed connection test', async ({ page, mockApi }) => {
    mockApi.on('POST', '/api/dbconn/test', { status: 503 })

    await page.goto('./integrations/customer-cards')
    await page.getByRole('button', { name: 'Edit crm' }).click()

    const drawer = page.getByRole('dialog')
    await drawer.getByRole('button', { name: 'Test connection' }).click()

    await expect(drawer.getByText('Connection failed')).toBeVisible()
    expect(mockApi.callsTo('POST', '/api/dbconn/test')[0].body).toMatchObject({
      pass: 'crm-password',
    })
  })

  test('edits a connection without sending the unchanged password', async ({ page, mockApi }) => {
    mockApi.on('PUT', '/freepbx/rest/cti/dbconn/:id', { status: 200 })

    await page.goto('./integrations/customer-cards')
    await page.getByRole('button', { name: 'Edit crm' }).click()

    const drawer = page.getByRole('dialog')
    await expect(drawer.getByLabel('Password', { exact: true })).toHaveValue('')
    await drawer.getByRole('textbox', { name: 'Host' }).fill('crm2.example.com')
    await drawer.getByRole('button', { name: 'Save' }).click()

    await expect(drawer).toBeHidden()
    const put = mockApi.callsTo('PUT', '/freepbx/rest/cti/dbconn/:id')
    expect(put[0].path).toBe('/freepbx/rest/cti/dbconn/5')
    expect(put[0].body).toEqual({
      type: 'postgres',
      name: 'crm',
      host: 'crm2.example.com',
      port: '5432',
      user: 'reader',
    })
  })

  test('does not delete a connection used by a card', async ({ page, mockApi }) => {
    await page.goto('./integrations/customer-cards')
    await page.getByRole('button', { name: 'Open the menu of crm' }).click()
    await page.getByRole('menuitem', { name: 'Delete' }).click()

    const modal = page.getByRole('dialog')
    await expect(modal).toContainText('these cards use it')
    await expect(modal).toContainText('Open invoices')
    await expect(modal.getByRole('button', { name: 'Delete' })).toHaveCount(0)
    await modal.getByRole('button', { name: 'Close', exact: true }).last().click()
    await expect(modal).toBeHidden()
    expect(mockApi.callsTo('DELETE', '/freepbx/rest/cti/dbconn/:id')).toHaveLength(0)
  })

  test('deletes an unused connection', async ({ page, mockApi }) => {
    mockApi.on('DELETE', '/freepbx/rest/cti/dbconn/:id', { json: true })

    await page.goto('./integrations/customer-cards')
    await page.getByRole('button', { name: 'Open the menu of erp' }).click()
    await page.getByRole('menuitem', { name: 'Delete' }).click()

    const modal = page.getByRole('dialog')
    await modal.getByRole('button', { name: 'Delete' }).click()

    await expect(modal).toBeHidden()
    expect(mockApi.callsTo('DELETE', '/freepbx/rest/cti/dbconn/:id')[0].path).toBe(
      '/freepbx/rest/cti/dbconn/6',
    )
  })

  test('validates and creates a template', async ({ page, mockApi }) => {
    mockApi.on('POST', '/freepbx/rest/cti/customer_card/template', { status: 200 })

    await page.goto('./integrations/customer-cards')
    await page.getByRole('button', { name: 'Create template' }).click()

    const drawer = page.getByRole('dialog')
    await drawer.getByRole('textbox', { name: 'Name' }).fill('Invoices')
    await drawer.getByRole('button', { name: 'Create template' }).click()
    await expect(
      drawer.getByText('Another template, built-in or custom, has the same name'),
    ).toBeVisible()

    await drawer.getByRole('textbox', { name: 'Name' }).fill('Identity')
    await drawer.getByRole('button', { name: 'Create template' }).click()
    await expect(
      drawer.getByText('Another template, built-in or custom, has the same name'),
    ).toBeVisible()

    await drawer.getByRole('textbox', { name: 'Name' }).fill('Orders2')
    await drawer.getByRole('textbox', { name: 'Code (EJS)' }).fill('<p>città</p>')
    await drawer.getByRole('button', { name: 'Create template' }).click()

    await expect(drawer).toBeHidden()
    expect(mockApi.callsTo('POST', '/freepbx/rest/cti/customer_card/template')[0].body).toEqual({
      name: 'orders2',
      custom: true,
      html: b64('<p>città</p>'),
    })
  })

  test('duplicates a built-in template', async ({ page, mockApi }) => {
    mockApi.on('POST', '/freepbx/rest/cti/customer_card/template', { status: 200 })

    await page.goto('./integrations/customer-cards')
    await page.getByRole('button', { name: 'Open the menu of identity' }).click()
    await page.getByRole('menuitem', { name: 'Duplicate' }).click()

    const drawer = page.getByRole('dialog')
    await expect(drawer.getByRole('heading', { name: 'Duplicate identity' })).toBeVisible()
    await drawer.getByRole('textbox', { name: 'Name' }).fill('myidentity')
    await drawer.getByRole('button', { name: 'Create template' }).click()

    await expect(drawer).toBeHidden()
    expect(mockApi.callsTo('POST', '/freepbx/rest/cti/customer_card/template')[0].body).toEqual({
      name: 'myidentity',
      custom: true,
      html: b64('<!-- color: red --><div>identity</div>'),
    })
  })

  test('edits a custom template', async ({ page, mockApi }) => {
    mockApi.on('PUT', '/freepbx/rest/cti/customer_card/template/:name', { status: 200 })

    await page.goto('./integrations/customer-cards')
    await page.getByRole('button', { name: 'Edit notes' }).click()

    const drawer = page.getByRole('dialog')
    await expect(drawer.getByRole('textbox', { name: 'Name' })).toBeDisabled()
    await drawer.getByRole('textbox', { name: 'Code (EJS)' }).fill('<p>new notes</p>')
    await drawer.getByRole('button', { name: 'Save' }).click()

    await expect(drawer).toBeHidden()
    const put = mockApi.callsTo('PUT', '/freepbx/rest/cti/customer_card/template/:name')
    expect(put[0].path).toBe('/freepbx/rest/cti/customer_card/template/notes')
    expect(put[0].body).toEqual({ name: 'notes', custom: true, html: b64('<p>new notes</p>') })
  })

  test('deletes an unused template and protects a used one', async ({ page, mockApi }) => {
    mockApi.on('DELETE', '/freepbx/rest/cti/customer_card/template/:name', { status: 200 })

    await page.goto('./integrations/customer-cards')
    await page.getByRole('button', { name: 'Open the menu of invoices' }).click()
    await page.getByRole('menuitem', { name: 'Delete' }).click()

    const modal = page.getByRole('dialog')
    await expect(modal).toContainText('Open invoices')
    await expect(modal.getByRole('button', { name: 'Delete' })).toHaveCount(0)
    await modal.getByRole('button', { name: 'Close', exact: true }).last().click()
    await expect(modal).toBeHidden()

    await page.getByRole('button', { name: 'Open the menu of notes' }).click()
    await page.getByRole('menuitem', { name: 'Delete' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click()

    await expect(page.getByRole('dialog')).toBeHidden()
    expect(
      mockApi.callsTo('DELETE', '/freepbx/rest/cti/customer_card/template/:name')[0].path,
    ).toBe('/freepbx/rest/cti/customer_card/template/notes')
  })

  test('validates, previews and creates a card', async ({ page, mockApi }) => {
    mockApi
      .on('POST', '/api/custcard/preview', { json: { html: b64('<p>Anna Miller</p>') } })
      .on('POST', '/freepbx/rest/cti/customer_card', { status: 200 })

    await page.goto('./integrations/customer-cards')
    await page.getByRole('button', { name: 'Create card' }).click()

    const drawer = page.getByRole('dialog')
    await drawer.getByRole('button', { name: 'Create card' }).click()

    await expect(drawer.getByText('Select a database connection')).toBeVisible()
    await expect(drawer.getByText('Select a template')).toBeVisible()
    await expect(drawer.getByText('Select at least one profile')).toHaveCount(0)
    await expect(drawer.getByText('Enter the query')).toBeVisible()
    expect(mockApi.callsTo('POST', '/freepbx/rest/cti/customer_card')).toHaveLength(0)

    await drawer.getByRole('textbox', { name: 'Name' }).fill('Orders')
    await drawer.getByRole('combobox', { name: 'Database connection' }).click()
    await page.getByRole('option', { name: /crm/ }).click()
    await drawer.getByRole('combobox', { name: 'Template' }).click()
    await page.getByRole('option', { name: /identity/ }).click()
    await drawer
      .getByRole('textbox', { name: 'Query' })
      .fill("SELECT * FROM orders WHERE phone = '$NUMBER'")
    await drawer.getByRole('button', { name: 'Show preview' }).click()

    await expect(
      drawer.frameLocator('iframe[title="Preview"]').getByText('Anna Miller'),
    ).toBeVisible()
    expect(mockApi.callsTo('POST', '/api/custcard/preview')[0].body).toEqual({
      dbconn_id: '5',
      template: 'identity',
      query: b64("SELECT * FROM orders WHERE phone = '$NUMBER'"),
    })

    await drawer.getByRole('textbox', { name: 'Test number' }).fill('abc')
    await drawer.getByRole('button', { name: 'Show preview' }).click()
    await expect(drawer.getByText('Use digits only, optionally preceded by +')).toBeVisible()
    await drawer.getByRole('textbox', { name: 'Test number' }).fill('0721405516')
    await drawer.getByRole('button', { name: 'Show preview' }).click()
    await expect.poll(() => mockApi.callsTo('POST', '/api/custcard/preview').length).toBe(2)
    expect(mockApi.callsTo('POST', '/api/custcard/preview')[1].body).toEqual({
      dbconn_id: '5',
      template: 'identity',
      query: b64("SELECT * FROM orders WHERE phone = '0721405516'"),
    })

    await drawer.getByRole('combobox', { name: 'Profiles' }).click()
    await page.getByRole('option', { name: 'Base' }).click()
    await drawer.getByRole('heading', { name: 'Create card' }).click()
    await drawer.getByRole('button', { name: 'Create card' }).click()

    await expect(drawer).toBeHidden()
    expect(mockApi.callsTo('POST', '/freepbx/rest/cti/customer_card')[0].body).toEqual({
      name: 'Orders',
      query: b64("SELECT * FROM orders WHERE phone = '$NUMBER'"),
      template: 'identity',
      dbconn_id: 5,
      profiles: [1],
    })
  })

  test('edits a card', async ({ page, mockApi }) => {
    mockApi.on('PUT', '/freepbx/rest/cti/customer_card/:id', { status: 200 })

    await page.goto('./integrations/customer-cards')
    await page.getByRole('button', { name: 'Edit Open invoices' }).click()

    const drawer = page.getByRole('dialog')
    await expect(drawer.getByRole('textbox', { name: 'Query' })).toHaveValue(
      'SELECT * FROM invoices',
    )
    await drawer.getByRole('textbox', { name: 'Query' }).fill('SELECT * FROM invoices WHERE open')
    await drawer.getByRole('button', { name: 'Save' }).click()

    await expect(drawer).toBeHidden()
    const put = mockApi.callsTo('PUT', '/freepbx/rest/cti/customer_card/:id')
    expect(put[0].path).toBe('/freepbx/rest/cti/customer_card/4')
    expect(put[0].body).toEqual({
      name: 'Open invoices',
      query: b64('SELECT * FROM invoices WHERE open'),
      template: 'invoices_custom',
      dbconn_id: 5,
      profiles: [3],
    })
  })

  test('keeps the drawer open when saving a card fails', async ({ page, mockApi }) => {
    mockApi.on('PUT', '/freepbx/rest/cti/customer_card/:id', { status: 500 })

    await page.goto('./integrations/customer-cards')
    await page.getByRole('button', { name: 'Edit Open invoices' }).click()

    const drawer = page.getByRole('dialog')
    await drawer.getByRole('button', { name: 'Save' }).click()

    await expect(drawer.getByText('Cannot save the card')).toBeVisible()
  })

  test('signs out when the preview is rejected for an expired session', async ({
    page,
    mockApi,
  }) => {
    mockApi.on('POST', '/api/custcard/preview', { status: 401 })

    await page.goto('./integrations/customer-cards')
    await page.getByRole('button', { name: 'Edit Open invoices' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Show preview' }).click()

    await expect(page).toHaveURL(/\/nethvoice\/login/)
  })

  test('explains a preview that the server cannot run', async ({ page, mockApi }) => {
    mockApi.on('POST', '/api/custcard/preview', { status: 500 })

    await page.goto('./integrations/customer-cards')
    await page.getByRole('button', { name: 'Edit Open invoices' }).click()
    const drawer = page.getByRole('dialog')
    await drawer.getByRole('button', { name: 'Show preview' }).click()

    await expect(
      drawer.getByText('The query cannot be run. Check the query and the database connection.'),
    ).toBeVisible()
  })

  test('asks before discarding the changes to a card', async ({ page }) => {
    await page.goto('./integrations/customer-cards')
    await page.getByRole('button', { name: 'Edit Open invoices' }).click()

    const drawer = page.getByRole('dialog', { name: 'Edit card' })
    await drawer.getByRole('button', { name: 'Cancel' }).click()
    await expect(drawer).toBeHidden()

    await page.getByRole('button', { name: 'Edit Open invoices' }).click()
    await drawer.getByRole('textbox', { name: 'Name' }).fill('Open invoices 2')
    await page.keyboard.press('Escape')
    await expect(page.getByRole('heading', { name: 'Unsaved changes' })).toBeVisible()
    await page.getByRole('button', { name: 'Keep editing' }).click()
    await expect(drawer.getByRole('textbox', { name: 'Name' })).toHaveValue('Open invoices 2')

    await drawer.getByRole('button', { name: 'Cancel' }).click()
    await page.getByRole('button', { name: 'Discard changes' }).click()
    await expect(drawer).toBeHidden()
  })

  test('deletes a card', async ({ page, mockApi }) => {
    mockApi.on('DELETE', '/freepbx/rest/cti/customer_card/:id', { status: 200 })

    await page.goto('./integrations/customer-cards')
    await page.getByRole('button', { name: 'Open the menu of Open invoices' }).click()
    await page.getByRole('menuitem', { name: 'Delete' }).click()

    const modal = page.getByRole('dialog')
    await modal.getByRole('button', { name: 'Delete' }).click()

    await expect(modal).toBeHidden()
    expect(mockApi.callsTo('DELETE', '/freepbx/rest/cti/customer_card/:id')[0].path).toBe(
      '/freepbx/rest/cti/customer_card/4',
    )
  })
})
