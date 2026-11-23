//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import type { Page } from '@playwright/test'
import { expect, mockPermissions, type MockRequest, test } from '../fixtures/mockApi'

const b64 = (text: string) => Buffer.from(text, 'utf-8').toString('base64')

const PROFILES = [
  { id: 1, name: 'Base', macro_permissions: {} },
  { id: 3, name: 'Standard', macro_permissions: {} },
  { id: 4, name: 'Advanced', macro_permissions: {} },
]

const CONNECTIONS = [
  {
    id: 1,
    host: 'localhost',
    port: '3306',
    type: 'mysql',
    user: 'ctiuser',
    pass: 'stored-password',
    has_password: true,
    name: 'phonebook',
    creation: '2026-01-10 09:00:00',
  },
  {
    id: 5,
    host: 'crm.example.com',
    port: '5432',
    type: 'postgres',
    user: 'reader',
    has_password: true,
    name: 'crm',
    creation: '2026-02-01 10:00:00',
  },
  {
    id: 6,
    host: 'erp.example.com',
    port: '1433',
    type: 'mssql:7_4',
    user: 'erp',
    has_password: true,
    name: 'erp',
    creation: '2026-02-02 10:00:00',
  },
]

const TYPES = {
  mysql: 'MySQL',
  postgres: 'PostgreSQL',
  'mssql:7_4': 'SQL Server 2012/2014',
}

const TABLE_CODE = '<!-- color: red -->\n<thead class="bg-red-600"></thead>'

const TEMPLATES = [
  { name: 'table', custom: false, html: b64(TABLE_CODE), color: 'red' },
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
  {
    id: 8,
    name: 'Late payments',
    creation: '2026-02-03 10:00:00',
    query: b64('SELECT * FROM payments'),
    template: { name: 'table', custom: false },
    dbconn_id: 6,
    permission_id: 32,
    profiles: [],
  },
]

const CARDS_DESCRIPTION =
  'Each customer card adds a tab, next to General info, to the customer card of a phone number in NethVoice CTI, with data read from a database.'

const cell = (text: string) => new RegExp(`${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`)

const cardsGrid = (page: Page) => page.getByRole('grid', { name: 'Customer cards' })
const templatesGrid = (page: Page) => page.getByRole('grid', { name: 'Templates' })
const databasesGrid = (page: Page) => page.getByRole('grid', { name: 'Databases' })
const toasts = (page: Page) => page.getByTestId('toast-notifications')
const drawer = (page: Page) => page.getByRole('dialog')
const createButton = (page: Page) =>
  drawer(page).getByRole('button', { name: 'Create', exact: true })

const connectionTest = (request: MockRequest) => {
  const body = request.body as { id?: string; user?: string }
  return { json: { status: body.id !== '6' && body.user !== 'wrong' } }
}

test.describe('integrations: customer cards', () => {
  test.beforeEach(async ({ signedIn, mockApi }) => {
    void signedIn
    mockApi
      .on('GET', '/freepbx/rest/cti/profiles', { json: PROFILES })
      .on('GET', '/freepbx/rest/cti/dbconn', { json: CONNECTIONS })
      .on('GET', '/freepbx/rest/cti/dbconn/type', { json: TYPES })
      .on('GET', '/freepbx/rest/cti/customer_card/template', { json: TEMPLATES })
      .on('GET', '/freepbx/rest/cti/customer_card', { json: CARDS })
      .on('POST', '/freepbx/rest/cti/dbconn/test', connectionTest)
  })

  test('opens on Customer cards and orders the tabs as the design', async ({ page }) => {
    await page.goto('./integrations')

    await expect(page.getByRole('navigation', { name: 'Tabs' }).locator('a')).toHaveText([
      'Customer cards',
      'Video sources',
      'Phonebook',
      'Parameterized URLs',
      'External services',
    ])
    await expect(
      page.locator('a[aria-current="page"]', { hasText: 'Customer cards' }),
    ).toBeVisible()
    await expect(page.getByText(CARDS_DESCRIPTION)).toBeVisible()
  })

  test('lists the customer cards', async ({ page, mockApi }) => {
    await page.goto('./integrations/customer-cards')

    await expect(page.getByRole('heading', { name: 'Customer cards' })).toBeVisible()
    await expect(page.getByText(CARDS_DESCRIPTION)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Create customer card' })).toBeEnabled()

    const rows = cardsGrid(page).getByRole('row')
    await expect(rows).toHaveCount(3)
    await expect(rows.nth(0).getByRole('columnheader')).toHaveText([
      'Name',
      'Database',
      'Template',
      'Profiles',
      'Actions',
    ])
    await expect(rows.nth(1).getByRole('gridcell')).toHaveText([
      cell('Late payments'),
      /erpDatabase erp is not connected$/,
      cell('table'),
      cell('Not set'),
      /Edit/,
    ])
    await expect(rows.nth(2).getByRole('gridcell')).toHaveText([
      cell('Open invoices'),
      cell('crm'),
      cell('invoices'),
      cell('Standard'),
      /Edit/,
    ])

    await rows.nth(1).getByText('Database erp is not connected').locator('..').hover()
    await expect(page.getByText('Database not connected', { exact: true })).toBeVisible()
    expect(mockApi.callsTo('POST', '/freepbx/rest/cti/dbconn/test')).toHaveLength(3)
  })

  test('lists the templates with color and use', async ({ page }) => {
    await page.goto('./integrations/customer-cards')

    const rows = templatesGrid(page).getByRole('row')
    await expect(rows).toHaveCount(4)
    await expect(rows.nth(0).getByRole('columnheader')).toHaveText([
      'Name',
      'Color',
      'Used by',
      'Actions',
    ])
    await expect(rows.nth(1).getByRole('gridcell')).toHaveText([
      cell('tableBuilt-in'),
      cell('Red'),
      cell('Late payments'),
      /Edit/,
    ])
    await expect(rows.nth(2).getByRole('gridcell')).toHaveText([
      cell('invoices'),
      cell('Set in the code'),
      cell('Open invoices'),
      /Edit/,
    ])
    await expect(rows.nth(3).getByRole('gridcell').nth(2)).toHaveText(cell('Not used'))

    await page.getByRole('button', { name: 'Open the menu of table' }).click()
    await expect(page.getByRole('menu').getByRole('menuitem')).toHaveText(['Duplicate'])
    await page.getByRole('button', { name: 'Open the menu of table' }).click()
    await expect(page.getByRole('menu')).toHaveCount(0)
    await page.getByRole('button', { name: 'Open the menu of invoices' }).click()
    await expect(page.getByRole('menu').getByRole('menuitem')).toHaveText(['Duplicate'])
    await page.getByRole('button', { name: 'Open the menu of invoices' }).click()
    await expect(page.getByRole('menu')).toHaveCount(0)
    await page.getByRole('button', { name: 'Open the menu of notes' }).click()
    await expect(page.getByRole('menu').getByRole('menuitem')).toHaveText(['Duplicate', 'Delete'])
  })

  test('lists the databases with their connection status', async ({ page, mockApi }) => {
    await page.goto('./integrations/customer-cards')

    const rows = databasesGrid(page).getByRole('row')
    await expect(rows).toHaveCount(4)
    await expect(rows.nth(0).getByRole('columnheader')).toHaveText([
      'Name',
      'Type',
      'Address',
      'Username',
      'Used by',
      'Status',
      'Actions',
    ])
    await expect(rows.nth(1).getByRole('gridcell')).toHaveText([
      cell('crm'),
      cell('PostgreSQL'),
      cell('crm.example.com:5432'),
      cell('reader'),
      cell('Open invoices'),
      cell('Connected'),
      /Edit/,
    ])
    await expect(rows.nth(2).getByRole('gridcell')).toHaveText([
      cell('erp'),
      cell('SQL Server 2012/2014'),
      cell('erp.example.com:1433'),
      cell('erp'),
      cell('Late payments'),
      cell('Not connected'),
      /Edit/,
    ])
    await expect(rows.nth(3).getByRole('gridcell')).toHaveText([
      cell('phonebookBuilt-in'),
      cell('MySQL'),
      cell('localhost:3306'),
      cell('ctiuser'),
      cell('Not used'),
      cell('Connected'),
      'Actions',
    ])
    await expect(page.getByRole('button', { name: 'Edit phonebook' })).toHaveCount(0)
    await expect(page.getByText('stored-password')).toHaveCount(0)

    const tests = mockApi.callsTo('POST', '/freepbx/rest/cti/dbconn/test')
    expect(tests.map((call) => call.body)).toContainEqual({
      type: 'mysql',
      name: 'phonebook',
      host: 'localhost',
      port: '3306',
      user: 'ctiuser',
      pass: '',
      id: '1',
    })

    await page.getByRole('button', { name: 'Open the menu of crm' }).click()
    await expect(page.getByRole('menu').getByRole('menuitem')).toHaveText(['Test connection'])
    await page.getByRole('menuitem', { name: 'Test connection' }).click()
    await expect.poll(() => mockApi.callsTo('POST', '/freepbx/rest/cti/dbconn/test').length).toBe(4)
    await expect(rows.nth(1).getByRole('gridcell').nth(5)).toHaveText(cell('Connected'))
  })

  test('shows the connection test in progress', async ({ page, mockApi }) => {
    mockApi.on('POST', '/freepbx/rest/cti/dbconn/test', () => new Promise(() => {}))

    await page.goto('./integrations/customer-cards')

    await expect(databasesGrid(page).getByText('Testing connection…')).toHaveCount(3)
  })

  test('shows an unknown status when the test cannot run', async ({ page, mockApi }) => {
    mockApi.on('POST', '/freepbx/rest/cti/dbconn/test', {
      status: 502,
      json: { message: 'Cannot reach the CTI server' },
    })

    await page.goto('./integrations/customer-cards')

    await expect(databasesGrid(page).getByText('Unknown')).toHaveCount(3)
    await expect(cardsGrid(page).getByText(/is not connected/)).toHaveCount(0)
  })

  test('shows the empty state of a fresh install', async ({ page, mockApi }) => {
    mockApi
      .on('GET', '/freepbx/rest/cti/dbconn', { json: CONNECTIONS.slice(0, 1) })
      .on('GET', '/freepbx/rest/cti/customer_card/template', { json: TEMPLATES.slice(0, 1) })
      .on('GET', '/freepbx/rest/cti/customer_card', { json: [] })

    await page.goto('./integrations/customer-cards')

    await expect(page.getByText('No customer cards configured')).toBeVisible()
    await expect(page.getByText(CARDS_DESCRIPTION)).toHaveCount(1)
    await expect(cardsGrid(page)).toHaveCount(0)
    await expect(templatesGrid(page).getByRole('row')).toHaveCount(2)
    await expect(databasesGrid(page).getByRole('row')).toHaveCount(2)

    await page.getByRole('button', { name: 'Create customer card' }).click()
    await expect(drawer(page).getByRole('heading', { name: 'Create customer card' })).toBeVisible()
  })

  test('shows the loading state', async ({ page, mockApi }) => {
    mockApi.on('GET', '/freepbx/rest/cti/customer_card', () => new Promise(() => {}))

    await page.goto('./integrations/customer-cards')

    await expect(page.getByRole('button', { name: 'Create customer card' })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Create template' })).toBeEnabled()
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

    await expect(cardsGrid(page).getByRole('row')).toHaveCount(3)
  })

  test('validates, previews and creates a customer card', async ({ page, mockApi }) => {
    mockApi
      .on('POST', '/freepbx/rest/cti/customer_card/preview', {
        json: { html: b64('<p>Anna Miller</p>') },
      })
      .on('POST', '/freepbx/rest/cti/customer_card', { status: 200 })

    await page.goto('./integrations/customer-cards')
    await page.getByRole('button', { name: 'Create customer card' }).click()

    const name = drawer(page).getByRole('textbox', { name: 'Name', exact: true })
    await expect(name).toBeFocused()
    await expect(name).toHaveAttribute('placeholder', 'e.g. Orders')
    await expect(drawer(page).getByText('Name of the tab in NethVoice CTI.')).toBeVisible()
    await expect(drawer(page).getByRole('textbox', { name: 'Query' })).toHaveAttribute(
      'placeholder',
      "e.g. SELECT * FROM contacts WHERE phone LIKE '%$NUMBER'",
    )
    await expect(
      drawer(page).getByText(
        'SQL query that reads the data shown in the tab. $NUMBER is replaced with the caller number.',
      ),
    ).toBeVisible()
    await expect(
      drawer(page).getByText('Users with these profiles see the tab in NethVoice CTI.'),
    ).toBeVisible()

    await drawer(page).getByRole('button', { name: 'Show preview' }).click()
    await expect(drawer(page).getByText('Select a database')).toBeVisible()
    await expect(drawer(page).getByText('Select a template')).toBeVisible()
    await expect(drawer(page).getByText('Enter the query')).toBeVisible()
    await expect(drawer(page).getByText('Enter the name')).toHaveCount(0)
    expect(mockApi.callsTo('POST', '/freepbx/rest/cti/customer_card/preview')).toHaveLength(0)

    await createButton(page).click()
    await expect(drawer(page).getByText('Enter the name')).toBeVisible()
    await expect(drawer(page).getByText('Select at least one profile')).toBeVisible()
    await expect(name).toBeFocused()
    expect(mockApi.callsTo('POST', '/freepbx/rest/cti/customer_card')).toHaveLength(0)

    await name.fill('Open Invoices!')
    await createButton(page).click()
    await expect(
      drawer(page).getByText('A customer card with this name already exists. Enter another name.'),
    ).toBeVisible()

    await name.fill('Orders')
    await drawer(page).getByRole('combobox', { name: 'Database' }).click()
    await expect(page.getByRole('option')).toHaveText([
      /crmPostgreSQL/,
      /erpNot connected/,
      /phonebookMySQL/,
    ])
    await page.getByRole('option', { name: /crm/ }).click()
    await drawer(page).getByRole('combobox', { name: 'Template' }).click()
    await page.getByRole('option', { name: /^table/ }).click()
    await drawer(page)
      .getByRole('textbox', { name: 'Query' })
      .fill("SELECT * FROM orders WHERE phone = '$NUMBER'")
    await drawer(page).getByRole('button', { name: 'Show preview' }).click()

    await expect(
      drawer(page).frameLocator('iframe[title="Preview of Orders"]').getByText('Anna Miller'),
    ).toBeVisible()
    await expect(
      drawer(page).getByRole('navigation', { name: /Tabs of the customer card/ }),
    ).toHaveText('Orders')
    expect(mockApi.callsTo('POST', '/freepbx/rest/cti/customer_card/preview')[0].body).toEqual({
      dbconn_id: '5',
      template: 'table',
      query: b64("SELECT * FROM orders WHERE phone = '$NUMBER'"),
    })

    await drawer(page).getByRole('textbox', { name: 'Test number' }).fill('abc')
    await drawer(page).getByRole('button', { name: 'Show preview' }).click()
    await expect(drawer(page).getByText('Use digits only, optionally preceded by +')).toBeVisible()
    await drawer(page).getByRole('textbox', { name: 'Test number' }).fill('0123456789')
    await drawer(page).getByRole('button', { name: 'Show preview' }).click()
    await expect
      .poll(() => mockApi.callsTo('POST', '/freepbx/rest/cti/customer_card/preview').length)
      .toBe(2)
    expect(mockApi.callsTo('POST', '/freepbx/rest/cti/customer_card/preview')[1].body).toEqual({
      dbconn_id: '5',
      template: 'table',
      query: b64("SELECT * FROM orders WHERE phone = '0123456789'"),
    })
    await expect(drawer(page).locator('iframe')).toBeVisible()

    await drawer(page).getByRole('textbox', { name: 'Query' }).fill('SELECT * FROM orders')
    await expect(drawer(page).locator('iframe')).toHaveCount(0)

    await drawer(page).getByRole('combobox', { name: 'Profiles' }).click()
    await page.getByRole('option', { name: 'Base' }).click()
    await drawer(page).getByRole('heading', { name: 'Create customer card' }).click()
    await createButton(page).click()

    await expect(drawer(page)).toBeHidden()
    expect(mockApi.callsTo('POST', '/freepbx/rest/cti/customer_card')[0].body).toEqual({
      name: 'Orders',
      query: b64('SELECT * FROM orders'),
      template: 'table',
      dbconn_id: 5,
      profiles: [1],
    })
    await expect(toasts(page).getByText('Customer card created')).toBeVisible()
    await expect(toasts(page).getByText('Customer card Orders has been created.')).toBeVisible()
  })

  test('edits a customer card', async ({ page, mockApi }) => {
    mockApi.on('PUT', '/freepbx/rest/cti/customer_card/:id', { status: 200 })

    await page.goto('./integrations/customer-cards')
    await page.getByRole('button', { name: 'Edit Open invoices' }).click()

    await expect(drawer(page).getByRole('heading', { name: 'Edit customer card' })).toBeVisible()
    await expect(drawer(page).getByRole('textbox', { name: 'Query' })).toHaveValue(
      'SELECT * FROM invoices',
    )
    await drawer(page)
      .getByRole('textbox', { name: 'Query' })
      .fill('SELECT * FROM invoices WHERE open')
    await drawer(page).getByRole('button', { name: 'Save' }).click()

    await expect(drawer(page)).toBeHidden()
    const put = mockApi.callsTo('PUT', '/freepbx/rest/cti/customer_card/:id')
    expect(put[0].path).toBe('/freepbx/rest/cti/customer_card/4')
    expect(put[0].body).toEqual({
      name: 'Open invoices',
      query: b64('SELECT * FROM invoices WHERE open'),
      template: 'invoices_custom',
      dbconn_id: 5,
      profiles: [3],
    })
    await expect(toasts(page).getByText('Customer card updated')).toBeVisible()
    await expect(
      toasts(page).getByText('Customer card Open invoices has been updated.'),
    ).toBeVisible()
  })

  test('duplicates a customer card', async ({ page, mockApi }) => {
    mockApi.on('POST', '/freepbx/rest/cti/customer_card', { status: 200 })

    await page.goto('./integrations/customer-cards')
    await page.getByRole('button', { name: 'Open the menu of Open invoices' }).click()
    await expect(page.getByRole('menu').getByRole('menuitem')).toHaveText(['Duplicate', 'Delete'])
    await page.getByRole('menuitem', { name: 'Duplicate' }).click()

    await expect(drawer(page).getByRole('heading', { name: 'Create customer card' })).toBeVisible()
    await expect(drawer(page).getByRole('textbox', { name: 'Name', exact: true })).toHaveValue(
      'Open invoices (copy)',
    )
    await createButton(page).click()

    await expect(drawer(page)).toBeHidden()
    expect(mockApi.callsTo('POST', '/freepbx/rest/cti/customer_card')[0].body).toEqual({
      name: 'Open invoices (copy)',
      query: b64('SELECT * FROM invoices'),
      template: 'invoices_custom',
      dbconn_id: 5,
      profiles: [3],
    })
  })

  test('keeps the drawer open when saving a card fails', async ({ page, mockApi }) => {
    mockApi.on('PUT', '/freepbx/rest/cti/customer_card/:id', { status: 500 })

    await page.goto('./integrations/customer-cards')
    await page.getByRole('button', { name: 'Edit Open invoices' }).click()
    await drawer(page).getByRole('button', { name: 'Save' }).click()

    await expect(drawer(page).getByText('Cannot save the customer card')).toBeVisible()
  })

  test('signs out when the preview is rejected for an expired session', async ({
    page,
    mockApi,
  }) => {
    mockApi.on('POST', '/freepbx/rest/cti/customer_card/preview', { status: 401 })

    await page.goto('./integrations/customer-cards')
    await page.getByRole('button', { name: 'Edit Open invoices' }).click()
    await drawer(page).getByRole('button', { name: 'Show preview' }).click()

    await expect(page).toHaveURL(/\/nethvoice\/login/)
  })

  test('explains a query that the server cannot run', async ({ page, mockApi }) => {
    mockApi.on('POST', '/freepbx/rest/cti/customer_card/preview', {
      status: 500,
      json: { message: 'ERROR 1064' },
    })

    await page.goto('./integrations/customer-cards')
    await page.getByRole('button', { name: 'Edit Open invoices' }).click()
    await drawer(page).getByRole('button', { name: 'Show preview' }).click()

    await expect(drawer(page).getByText('Cannot run the query')).toBeVisible()
    await expect(
      drawer(page).getByText(
        'The query cannot be run. Check the query and the database connection.',
      ),
    ).toBeVisible()
    await expect(drawer(page).getByText('ERROR 1064')).toHaveCount(0)
  })

  test('asks before discarding the changes to a card', async ({ page }) => {
    await page.goto('./integrations/customer-cards')
    await page.getByRole('button', { name: 'Edit Open invoices' }).click()

    const editDrawer = page.getByRole('dialog', { name: 'Edit customer card' })
    await editDrawer.getByRole('button', { name: 'Cancel' }).click()
    await expect(editDrawer).toBeHidden()

    await page.getByRole('button', { name: 'Edit Open invoices' }).click()
    await editDrawer.getByRole('textbox', { name: 'Name', exact: true }).fill('Open invoices 2')
    await page.keyboard.press('Escape')
    await expect(page.getByRole('heading', { name: 'Unsaved changes' })).toBeVisible()
    await page.getByRole('button', { name: 'Keep editing' }).click()
    await expect(editDrawer.getByRole('textbox', { name: 'Name', exact: true })).toHaveValue(
      'Open invoices 2',
    )

    await editDrawer.getByRole('button', { name: 'Cancel' }).click()
    await page.getByRole('button', { name: 'Discard changes' }).click()
    await expect(editDrawer).toBeHidden()
  })

  test('deletes a customer card', async ({ page, mockApi }) => {
    mockApi.on('DELETE', '/freepbx/rest/cti/customer_card/:id', { status: 200 })

    await page.goto('./integrations/customer-cards')
    await page.getByRole('button', { name: 'Open the menu of Open invoices' }).click()
    await page.getByRole('menuitem', { name: 'Delete' }).click()

    const modal = page.getByRole('dialog')
    await expect(modal.getByRole('heading', { name: 'Delete customer card' })).toBeVisible()
    await expect(modal).toContainText(
      "Customer card Open invoices will be permanently deleted. Users won't see it in NethVoice CTI anymore.",
    )
    await modal.getByRole('button', { name: 'Delete' }).click()

    await expect(modal).toBeHidden()
    expect(mockApi.callsTo('DELETE', '/freepbx/rest/cti/customer_card/:id')[0].path).toBe(
      '/freepbx/rest/cti/customer_card/4',
    )
    await expect(toasts(page).getByText('Customer card deleted')).toBeVisible()
    await expect(
      toasts(page).getByText('Customer card Open invoices has been deleted.'),
    ).toBeVisible()
  })

  test('validates and creates a template', async ({ page, mockApi }) => {
    mockApi.on('POST', '/freepbx/rest/cti/customer_card/template', { status: 200 })

    await page.goto('./integrations/customer-cards')
    await page.getByRole('button', { name: 'Create template' }).click()

    const name = drawer(page).getByRole('textbox', { name: 'Name', exact: true })
    await expect(drawer(page).getByRole('heading', { name: 'Create template' })).toBeVisible()
    await expect(name).toHaveAttribute('placeholder', 'e.g. invoices')
    await expect(
      drawer(page).getByText(
        'HTML with EJS tags. The query results are in the results array: use their column names, e.g. results[0].name.',
      ),
    ).toBeVisible()
    await expect(
      drawer(page).getByRole('link', { name: 'Open EJS documentation' }),
    ).toHaveAttribute('href', 'https://ejs.co/#docs')

    await name.fill('Invoices')
    await createButton(page).click()
    await expect(
      drawer(page).getByText('Another template, built-in or custom, has the same name'),
    ).toBeVisible()

    await name.fill('Table')
    await createButton(page).click()
    await expect(
      drawer(page).getByText('Another template, built-in or custom, has the same name'),
    ).toBeVisible()

    await name.fill('Orders2')
    await drawer(page).getByRole('textbox', { name: 'Code' }).fill('<p>città</p>')
    await createButton(page).click()

    await expect(drawer(page)).toBeHidden()
    expect(mockApi.callsTo('POST', '/freepbx/rest/cti/customer_card/template')[0].body).toEqual({
      name: 'orders2',
      custom: true,
      html: b64('<p>città</p>'),
    })
    await expect(toasts(page).getByText('Template orders2 has been created.')).toBeVisible()
  })

  test('duplicates a built-in template', async ({ page, mockApi }) => {
    mockApi.on('POST', '/freepbx/rest/cti/customer_card/template', { status: 200 })

    await page.goto('./integrations/customer-cards')
    await page.getByRole('button', { name: 'Open the menu of table' }).click()
    await page.getByRole('menuitem', { name: 'Duplicate' }).click()

    await expect(drawer(page).getByRole('heading', { name: 'Create template' })).toBeVisible()
    await expect(drawer(page).getByRole('textbox', { name: 'Name', exact: true })).toHaveValue(
      'tablecopy',
    )
    await createButton(page).click()

    await expect(drawer(page)).toBeHidden()
    expect(mockApi.callsTo('POST', '/freepbx/rest/cti/customer_card/template')[0].body).toEqual({
      name: 'tablecopy',
      custom: true,
      html: b64(TABLE_CODE),
    })
  })

  test('changes the color of a built-in template', async ({ page, mockApi }) => {
    mockApi.on('PUT', '/freepbx/rest/cti/customer_card/template/:name', { status: 200 })

    await page.goto('./integrations/customer-cards')
    await page.getByRole('button', { name: 'Edit table' }).click()

    await expect(drawer(page).getByRole('heading', { name: 'Edit template' })).toBeVisible()
    await expect(drawer(page).getByRole('textbox')).toHaveCount(0)
    const color = drawer(page).getByRole('combobox', { name: 'Color' })
    await expect(color).toHaveValue('Red')
    await color.click()
    await page.getByRole('option', { name: 'Blue' }).click()
    await drawer(page).getByRole('button', { name: 'Save' }).click()

    await expect(drawer(page)).toBeHidden()
    const put = mockApi.callsTo('PUT', '/freepbx/rest/cti/customer_card/template/:name')
    expect(put[0].path).toBe('/freepbx/rest/cti/customer_card/template/table')
    expect(put[0].body).toEqual({
      name: 'table',
      custom: false,
      html: b64('<!-- color: blue -->\n<thead class="bg-blue-600"></thead>'),
    })
    await expect(toasts(page).getByText('Template updated')).toBeVisible()
  })

  test('asks a color for a built-in template that has none', async ({ page, mockApi }) => {
    mockApi.on('GET', '/freepbx/rest/cti/customer_card/template', {
      json: [{ name: 'statistics', custom: false, html: b64('<dl></dl>'), color: null }],
    })

    await page.goto('./integrations/customer-cards')
    await expect(
      templatesGrid(page).getByRole('row').nth(1).getByRole('gridcell').nth(1),
    ).toHaveText(cell('Not set'))
    await page.getByRole('button', { name: 'Edit statistics' }).click()
    await drawer(page).getByRole('button', { name: 'Save' }).click()

    await expect(drawer(page).getByText('Select a color')).toBeVisible()
    await expect(drawer(page).getByRole('combobox', { name: 'Color' })).toBeFocused()
    expect(mockApi.callsTo('PUT', '/freepbx/rest/cti/customer_card/template/:name')).toHaveLength(0)
  })

  test('edits a custom template', async ({ page, mockApi }) => {
    mockApi.on('PUT', '/freepbx/rest/cti/customer_card/template/:name', { status: 200 })

    await page.goto('./integrations/customer-cards')
    await page.getByRole('button', { name: 'Edit invoices' }).click()

    await expect(drawer(page).getByRole('textbox', { name: 'Name', exact: true })).toBeDisabled()
    await expect(
      drawer(page).getByText('Used by Open invoices. Changes apply to this customer card too.'),
    ).toBeVisible()
    await drawer(page).getByRole('textbox', { name: 'Code' }).fill('<p>new invoices</p>')
    await drawer(page).getByRole('button', { name: 'Save' }).click()

    await expect(drawer(page)).toBeHidden()
    const put = mockApi.callsTo('PUT', '/freepbx/rest/cti/customer_card/template/:name')
    expect(put[0].path).toBe('/freepbx/rest/cti/customer_card/template/invoices')
    expect(put[0].body).toEqual({
      name: 'invoices',
      custom: true,
      html: b64('<p>new invoices</p>'),
    })
  })

  test('deletes an unused template', async ({ page, mockApi }) => {
    mockApi.on('DELETE', '/freepbx/rest/cti/customer_card/template/:name', { status: 200 })

    await page.goto('./integrations/customer-cards')
    await page.getByRole('button', { name: 'Open the menu of notes' }).click()
    await page.getByRole('menuitem', { name: 'Delete' }).click()

    const modal = page.getByRole('dialog')
    await expect(modal.getByRole('heading', { name: 'Delete template' })).toBeVisible()
    await expect(modal).toContainText('Template notes will be permanently deleted.')
    await modal.getByRole('button', { name: 'Delete' }).click()

    await expect(modal).toBeHidden()
    expect(
      mockApi.callsTo('DELETE', '/freepbx/rest/cti/customer_card/template/:name')[0].path,
    ).toBe('/freepbx/rest/cti/customer_card/template/notes')
    await expect(toasts(page).getByText('Template notes has been deleted.')).toBeVisible()
  })

  test('validates a database and saves it only after a successful test', async ({
    page,
    mockApi,
  }) => {
    mockApi.on('POST', '/freepbx/rest/cti/dbconn', { status: 200 })

    await page.goto('./integrations/customer-cards')
    await page.getByRole('button', { name: 'Create database' }).click()

    await expect(drawer(page).getByRole('heading', { name: 'Create database' })).toBeVisible()
    await expect(drawer(page).getByRole('textbox', { name: 'Name', exact: true })).toBeFocused()
    await expect(drawer(page).getByText('Name of the database on the server.')).toBeVisible()
    await expect(
      drawer(page).getByText('Hostname, IP address or socket of the database server.'),
    ).toBeVisible()
    await expect(
      drawer(page).getByText('Changes to the connection are saved only if the test succeeds.'),
    ).toBeVisible()
    const port = drawer(page).getByRole('textbox', { name: 'Port' })
    await expect(port).toHaveValue('')
    await expect(port).toHaveAttribute('placeholder', 'e.g. 3306')
    await expect(
      drawer(page).getByText('Leave empty to use the default port of MySQL (3306).'),
    ).toBeVisible()

    await createButton(page).click()
    await expect(drawer(page).getByText('Enter the name')).toBeVisible()
    await expect(drawer(page).getByText('Enter the address')).toBeVisible()
    await expect(drawer(page).getByText('Enter the username')).toBeVisible()
    await expect(drawer(page).getByText('Enter the password')).toBeVisible()
    await expect(drawer(page).getByRole('textbox', { name: 'Name', exact: true })).toBeFocused()

    await drawer(page).getByRole('textbox', { name: 'Name', exact: true }).fill('orders')
    await drawer(page).getByRole('combobox', { name: 'Type' }).click()
    await page.getByRole('option', { name: 'PostgreSQL' }).click()
    await expect(port).toHaveValue('')
    await expect(port).toHaveAttribute('placeholder', 'e.g. 5432')
    await port.fill('99999')
    await drawer(page).getByRole('textbox', { name: 'Address' }).fill('orders.example.com')
    await drawer(page).getByRole('textbox', { name: 'Username' }).fill('wrong')
    await drawer(page).getByLabel('Password', { exact: true }).fill('orders-secret')
    await createButton(page).click()
    await expect(drawer(page).getByText('Enter a port between 1 and 65535')).toBeVisible()

    await port.fill('')
    await createButton(page).click()
    await expect(drawer(page).getByText('Cannot connect to the database')).toBeVisible()
    expect(mockApi.callsTo('POST', '/freepbx/rest/cti/dbconn')).toHaveLength(0)

    await drawer(page).getByRole('textbox', { name: 'Username' }).fill('reader')
    await expect(drawer(page).getByText('Cannot connect to the database')).toHaveCount(0)
    await drawer(page).getByRole('button', { name: 'Test connection' }).click()
    await expect(drawer(page).getByText('Connection verified')).toBeVisible()
    await createButton(page).click()

    await expect(drawer(page)).toBeHidden()
    const body = {
      type: 'postgres',
      name: 'orders',
      host: 'orders.example.com',
      port: '5432',
      user: 'reader',
      pass: 'orders-secret',
    }
    expect(
      mockApi
        .callsTo('POST', '/freepbx/rest/cti/dbconn/test')
        .filter((call) => (call.body as { name: string }).name === 'orders')
        .at(-1)?.body,
    ).toEqual(body)
    expect(mockApi.callsTo('POST', '/freepbx/rest/cti/dbconn')[0].body).toEqual(body)
    await expect(toasts(page).getByText('Database created')).toBeVisible()
    await expect(toasts(page).getByText('Database orders has been created.')).toBeVisible()
  })

  test('tests before saving and keeps the stored password', async ({ page, mockApi }) => {
    mockApi.on('PUT', '/freepbx/rest/cti/dbconn/:id', { status: 200 })

    await page.goto('./integrations/customer-cards')
    await page.getByRole('button', { name: 'Edit crm' }).click()

    await expect(drawer(page).getByRole('heading', { name: 'Edit database' })).toBeVisible()
    await expect(drawer(page).getByText('Used by Open invoices.')).toBeVisible()
    await expect(drawer(page).getByLabel('Password', { exact: true })).toHaveValue('')
    await expect(drawer(page).getByText('Leave empty to keep the current password.')).toBeVisible()
    await drawer(page).getByRole('textbox', { name: 'Username' }).fill('writer')
    const testsBefore = mockApi.callsTo('POST', '/freepbx/rest/cti/dbconn/test').length
    await drawer(page).getByRole('button', { name: 'Save' }).click()

    await expect(drawer(page)).toBeHidden()
    expect(mockApi.callsTo('POST', '/freepbx/rest/cti/dbconn/test')[testsBefore].body).toEqual({
      type: 'postgres',
      name: 'crm',
      host: 'crm.example.com',
      port: '5432',
      user: 'writer',
      pass: '',
      id: '5',
    })
    const put = mockApi.callsTo('PUT', '/freepbx/rest/cti/dbconn/:id')
    expect(put[0].path).toBe('/freepbx/rest/cti/dbconn/5')
    expect(put[0].body).toEqual({
      type: 'postgres',
      name: 'crm',
      host: 'crm.example.com',
      port: '5432',
      user: 'writer',
    })
    await expect(toasts(page).getByText('Database crm has been updated.')).toBeVisible()
  })

  test('asks the password again to connect to a different server', async ({ page, mockApi }) => {
    await page.goto('./integrations/customer-cards')
    await page.getByRole('button', { name: 'Edit crm' }).click()

    await drawer(page).getByRole('textbox', { name: 'Address' }).fill('crm2.example.com')
    await expect(
      drawer(page).getByText('Enter the password again to connect to a different server.'),
    ).toBeVisible()
    const testsBefore = mockApi.callsTo('POST', '/freepbx/rest/cti/dbconn/test').length
    await drawer(page).getByRole('button', { name: 'Test connection' }).click()

    await expect(drawer(page).getByText('Enter the password', { exact: true })).toBeVisible()
    expect(mockApi.callsTo('POST', '/freepbx/rest/cti/dbconn/test')).toHaveLength(testsBefore)

    await drawer(page).getByLabel('Password', { exact: true }).fill('crm2-secret')
    await drawer(page).getByRole('button', { name: 'Test connection' }).click()

    await expect(drawer(page).getByText('Connection verified')).toBeVisible()
    const body = mockApi.callsTo('POST', '/freepbx/rest/cti/dbconn/test').at(-1)?.body
    expect(body).toMatchObject({ host: 'crm2.example.com', pass: 'crm2-secret' })
    expect(body).not.toHaveProperty('id')
  })

  test('deletes an unused database and hides Delete for a used one', async ({ page, mockApi }) => {
    mockApi
      .on('GET', '/freepbx/rest/cti/customer_card', { json: CARDS.slice(0, 1) })
      .on('DELETE', '/freepbx/rest/cti/dbconn/:id', { json: true })

    await page.goto('./integrations/customer-cards')
    await page.getByRole('button', { name: 'Open the menu of crm' }).click()
    await expect(page.getByRole('menu').getByRole('menuitem')).toHaveText(['Test connection'])
    await page.getByRole('button', { name: 'Open the menu of crm' }).click()
    await expect(page.getByRole('menu')).toHaveCount(0)

    await page.getByRole('button', { name: 'Open the menu of erp' }).click()
    await expect(page.getByRole('menu').getByRole('menuitem')).toHaveText([
      'Test connection',
      'Delete',
    ])
    await page.getByRole('menuitem', { name: 'Delete' }).click()

    const modal = page.getByRole('dialog')
    await expect(modal.getByRole('heading', { name: 'Delete database' })).toBeVisible()
    await expect(modal).toContainText(
      "Database erp will be permanently deleted from NethVoice. Its data on the database server won't change.",
    )
    await modal.getByRole('button', { name: 'Delete' }).click()

    await expect(modal).toBeHidden()
    expect(mockApi.callsTo('DELETE', '/freepbx/rest/cti/dbconn/:id')[0].path).toBe(
      '/freepbx/rest/cti/dbconn/6',
    )
    await expect(toasts(page).getByText('Database erp has been deleted.')).toBeVisible()
  })

  test('works with the keyboard only', async ({ page, mockApi }) => {
    mockApi.on('POST', '/freepbx/rest/cti/customer_card', { status: 200 })

    await page.goto('./integrations/customer-cards')
    const create = page.getByRole('button', { name: 'Create customer card' })

    await create.focus()
    await page.keyboard.press('Enter')
    await expect(drawer(page).getByRole('textbox', { name: 'Name', exact: true })).toBeFocused()
    await page.keyboard.type('Orders')
    await page.keyboard.press('Tab')
    await expect(drawer(page).getByRole('combobox', { name: 'Database' })).toBeFocused()
    await page.keyboard.type('crm')
    await expect(page.getByRole('option')).toHaveText([/^crm/])
    await page.keyboard.press('ArrowDown')
    await expect(page.getByRole('option', { name: /^crm/ })).toHaveAttribute(
      'data-headlessui-state',
      /active/,
    )
    await page.keyboard.press('Enter')
    await expect(drawer(page).getByRole('combobox', { name: 'Database' })).toHaveValue('crm')
    await page.keyboard.press('Tab')
    await expect(drawer(page).getByRole('combobox', { name: 'Template' })).toBeFocused()
    await page.keyboard.type('notes')
    await expect(page.getByRole('option')).toHaveText([/^notes/])
    await page.keyboard.press('ArrowDown')
    await expect(page.getByRole('option', { name: /^notes/ })).toHaveAttribute(
      'data-headlessui-state',
      /active/,
    )
    await page.keyboard.press('Enter')
    await expect(drawer(page).getByRole('combobox', { name: 'Template' })).toHaveValue('notes')
    await drawer(page).getByRole('combobox', { name: 'Profiles' }).focus()
    await page.keyboard.type('Adv')
    await expect(page.getByRole('option')).toHaveText([/Advanced/])
    await page.keyboard.press('ArrowDown')
    await expect(page.getByRole('option', { name: /Advanced/ })).toHaveAttribute(
      'data-headlessui-state',
      /active/,
    )
    await page.keyboard.press('Enter')
    await expect(drawer(page).getByRole('button', { name: 'Remove Advanced' })).toBeVisible()
    await drawer(page).getByRole('textbox', { name: 'Query' }).focus()
    await page.keyboard.type('SELECT 1')
    await createButton(page).focus()
    await page.keyboard.press('Enter')

    await expect
      .poll(() => mockApi.callsTo('POST', '/freepbx/rest/cti/customer_card').length)
      .toBe(1)

    await expect(drawer(page)).toBeHidden()
    expect(mockApi.callsTo('POST', '/freepbx/rest/cti/customer_card')[0].body).toEqual({
      name: 'Orders',
      query: b64('SELECT 1'),
      template: 'notes_custom',
      dbconn_id: 5,
      profiles: [4],
    })
    await expect(create).toBeFocused()
  })

  test('shows the rows as cards on a phone', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('./integrations/customer-cards')

    const firstCard = cardsGrid(page).getByRole('row').nth(0)
    await expect(firstCard).toContainText('Profiles')
    await expect(firstCard).toContainText('Not set')
    await expect(databasesGrid(page).getByRole('row').nth(0)).toContainText('Username')
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    expect(scrollWidth).toBeLessThanOrEqual(390)
  })

  test('uses the tertiary text token in dark and light theme', async ({ page }) => {
    await page.goto('./integrations/customer-cards')
    const description = page.getByText(CARDS_DESCRIPTION)

    await expect(page.locator('html')).toHaveClass(/\bdark\b/)
    await expect(description).toHaveCSS('color', 'oklch(0.707 0.022 261.325)')

    await page.getByRole('button', { name: 'Open account menu' }).click()
    await page.getByRole('menuitem', { name: 'Switch to light theme' }).click()
    await expect(page.locator('html')).not.toHaveClass(/\bdark\b/)
    await expect(description).toHaveCSS('color', 'oklch(0.446 0.03 256.802)')
  })

  test('works for an administrator with only the Integrations section', async ({
    page,
    mockApi,
  }) => {
    mockPermissions(mockApi, ['integrations'], 'integrator')
    mockApi.on('POST', '/freepbx/rest/cti/customer_card', { status: 200 })

    await page.goto('./integrations/customer-cards')

    await expect(cardsGrid(page).getByRole('row')).toHaveCount(3)
    await expect(page.getByRole('button', { name: 'Create template' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Show table' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Edit table' })).toHaveCount(0)

    await page.getByRole('button', { name: 'Open the menu of Open invoices' }).click()
    await page.getByRole('menuitem', { name: 'Duplicate' }).click()
    await drawer(page).getByRole('combobox', { name: 'Template' }).click()
    await expect(page.getByRole('option')).toHaveCount(3)
    await page.getByRole('option', { name: /^table/ }).click()
    await createButton(page).click()
    await expect(drawer(page)).toBeHidden()
    expect(mockApi.callsTo('POST', '/freepbx/rest/cti/customer_card')).toHaveLength(1)
  })

  test('shows the templates read only to an administrator with only Integrations', async ({
    page,
    mockApi,
  }) => {
    mockPermissions(mockApi, ['integrations'], 'integrator')

    await page.goto('./integrations/customer-cards')

    await expect(
      page.getByText(
        'Layouts of the customer cards, written in HTML and EJS. Only the superadmin can create, change or delete them.',
      ),
    ).toBeVisible()
    await expect(page.getByText(/Duplicate a built-in template/)).toHaveCount(0)
    await expect(templatesGrid(page).getByRole('row')).toHaveCount(4)
    await expect(page.getByRole('button', { name: 'Create template' })).toHaveCount(0)
    for (const name of ['table', 'invoices', 'notes']) {
      await expect(templatesGrid(page).getByRole('button', { name: `Show ${name}` })).toBeVisible()
      await expect(templatesGrid(page).getByRole('button', { name: `Edit ${name}` })).toHaveCount(0)
      await expect(page.getByRole('button', { name: `Open the menu of ${name}` })).toHaveCount(0)
    }

    await templatesGrid(page).getByRole('button', { name: 'Show invoices' }).click()
    await expect(drawer(page).getByRole('heading', { name: 'Template invoices' })).toBeVisible()
    await expect(
      drawer(page).getByText('Only the superadmin can change the templates.'),
    ).toBeVisible()
    await expect(drawer(page).getByRole('textbox', { name: 'Name', exact: true })).toHaveCount(0)
    const code = drawer(page).getByRole('textbox', { name: 'Code' })
    await expect(code).toHaveValue('<p><%= results[0].total %></p>')
    await expect(code).not.toBeEditable()
    await expect(drawer(page).getByRole('button', { name: 'Save' })).toHaveCount(0)
    await expect(drawer(page).getByRole('button', { name: 'Create', exact: true })).toHaveCount(0)
    await drawer(page).getByRole('button', { name: 'Close', exact: true }).click()
    await expect(drawer(page)).toBeHidden()

    await templatesGrid(page).getByRole('button', { name: 'Show table' }).click()
    await expect(drawer(page).getByRole('heading', { name: 'Template table' })).toBeVisible()
    await expect(drawer(page).getByRole('combobox', { name: 'Color' })).toHaveCount(0)
    await expect(drawer(page).getByRole('textbox', { name: 'Code' })).toHaveValue(TABLE_CODE)
    await expect(drawer(page).getByRole('textbox', { name: 'Code' })).not.toBeEditable()
    await page.keyboard.press('Escape')
    await expect(drawer(page)).toBeHidden()

    expect(mockApi.callsTo('POST', '/freepbx/rest/cti/customer_card/template')).toHaveLength(0)
    expect(mockApi.callsTo('PUT', '/freepbx/rest/cti/customer_card/template/:name')).toHaveLength(0)
    expect(
      mockApi.callsTo('DELETE', '/freepbx/rest/cti/customer_card/template/:name'),
    ).toHaveLength(0)
  })

  test('previews a card for an administrator with only Integrations', async ({ page, mockApi }) => {
    mockPermissions(mockApi, ['integrations'], 'integrator')
    mockApi.on('POST', '/freepbx/rest/cti/customer_card/preview', {
      json: { html: b64('<p>Anna Miller</p>') },
    })

    await page.goto('./integrations/customer-cards')
    await page.getByRole('button', { name: 'Edit Open invoices' }).click()
    await drawer(page).getByRole('button', { name: 'Show preview' }).click()

    await expect(
      drawer(page)
        .frameLocator('iframe[title="Preview of Open invoices"]')
        .getByText('Anna Miller'),
    ).toBeVisible()
    expect(mockApi.callsTo('POST', '/freepbx/rest/cti/customer_card/preview')[0].body).toEqual({
      dbconn_id: '5',
      template: 'invoices_custom',
      query: b64('SELECT * FROM invoices'),
    })
  })

  test('does not offer the PBX databases to an administrator with only Integrations', async ({
    page,
    mockApi,
  }) => {
    mockPermissions(mockApi, ['integrations'], 'integrator')
    mockApi.on('GET', '/freepbx/rest/cti/customer_card', {
      json: [
        ...CARDS,
        {
          id: 1,
          name: 'Identity',
          creation: '2026-01-10 09:00:00',
          query: b64('SELECT * FROM phonebook'),
          template: { name: 'table', custom: false },
          dbconn_id: 1,
          permission_id: 30,
          profiles: [1],
        },
      ],
    })

    await page.goto('./integrations/customer-cards')
    await page.getByRole('button', { name: 'Create customer card' }).click()
    await drawer(page).getByRole('combobox', { name: 'Database' }).click()
    await expect(page.getByRole('option')).toHaveText([/crmPostgreSQL/, /erpNot connected/])
    await page.keyboard.press('Escape')
    await expect(drawer(page).getByRole('textbox', { name: 'Query' })).not.toHaveAttribute(
      'readonly',
    )
    await drawer(page).getByRole('button', { name: 'Cancel' }).click()

    await page.getByRole('button', { name: 'Edit Identity' }).click()
    const query = drawer(page).getByRole('textbox', { name: 'Query' })
    await expect(query).toHaveAttribute('readonly')
    await expect(
      drawer(page).getByText(
        'Only the superadmin can change the query and show the preview of a card on a database of the PBX.',
      ),
    ).toBeVisible()
    await expect(drawer(page).getByRole('button', { name: 'Show preview' })).toBeDisabled()

    await drawer(page).getByRole('combobox', { name: 'Database' }).click()
    await page.getByRole('option', { name: /crm/ }).click()
    await expect(query).not.toHaveAttribute('readonly')
    await expect(drawer(page).getByRole('button', { name: 'Show preview' })).toBeEnabled()
  })
})
