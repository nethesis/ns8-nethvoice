//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import type { Page } from '@playwright/test'
import { expect, type MockApi, mockPermissions, test } from '../fixtures/mockApi'

const FIELDS = [
  'cellphone',
  'cellphone2',
  'company',
  'facebook',
  'fax',
  'firstname',
  'homecity',
  'homecountry',
  'homeemail',
  'homephone',
  'homepob',
  'homepostalcode',
  'homeprovince',
  'homestreet',
  'instagram',
  'job',
  'lastname',
  'linkedin',
  'name',
  'notes',
  'otheremail',
  'otherphone',
  'owner_id',
  'title',
  'url',
  'workcity',
  'workcountry',
  'workemail',
  'workphone',
  'workphone2',
  'workpob',
  'workpostalcode',
  'workprovince',
  'workstreet',
]

const GROUPS = [
  { id: 1, name: 'Sales' },
  { id: 2, name: 'Purchasing' },
  { id: 3, name: 'Management' },
  { id: 4, name: 'Reception' },
]

const USERS = [
  { username: 'mrossi', displayname: 'Mario Rossi', default_extension: '201' },
  { username: 'lbianchi', displayname: 'Laura Bianchi', default_extension: '202' },
  { username: 'mneri', displayname: 'Marco Neri', default_extension: '210' },
  { username: 'noext', displayname: 'No Extension', default_extension: 'none' },
]

const UPLOADED = 'file:///var/lib/nethvoice/phonebook/uploads/abc123.csv'

const sourcesFixture = (): Record<string, Record<string, unknown>> => ({
  custom_1: {
    dbtype: 'mysql',
    host: 'crm-db.example.com',
    port: '3306',
    user: 'reader',
    has_password: true,
    dbname: 'crm',
    query: 'SELECT * FROM contacts',
    mapping: { contact_name: 'name', phone: 'workphone' },
    interval: '1440',
    type: 'CRM contacts',
    access: 'public',
    enabled: true,
  },
  custom_2: {
    dbtype: 'mssql',
    host: '192.168.5.12',
    port: '1433',
    user: 'sa_readonly',
    has_password: true,
    dbname: 'erp',
    query: 'SELECT * FROM suppliers',
    mapping: { RagioneSociale: 'company', Referente: 'name' },
    interval: 60,
    type: 'ERP suppliers',
    access: 'group:Purchasing,Management',
    enabled: true,
  },
  custom_3: {
    dbtype: 'csv',
    url: UPLOADED,
    mapping: { Name: 'name' },
    interval: 1440,
    type: 'Partners',
    access: 'public',
    enabled: false,
  },
  custom_4: {
    dbtype: 'infinity',
    url: 'https://example.infinity.zucchetti.com',
    username: 'nethvoice',
    has_password: true,
    interval: 360,
    type: 'HR directory',
    access: 'group:Reception',
    enabled: true,
  },
  custom_5: { dbtype: 'ldap', type: 'Legacy directory', access: 'public', enabled: true },
})

const TODAY = new Date().toISOString().slice(0, 10)
const YESTERDAY = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)
const TODAY_AT_11_59 = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'UTC',
}).format(new Date(`${TODAY}T11:59:00Z`))

const statusesFixture = () => [
  {
    id: 'custom_1',
    status: 'ok',
    started_at: `${TODAY}T09:59:30Z`,
    finished_at: `${TODAY}T10:00:00Z`,
    imported: 1248,
    message: null,
  },
  {
    id: 'custom_2',
    status: 'failed',
    started_at: `${TODAY}T02:00:00Z`,
    finished_at: `${TODAY}T02:00:05Z`,
    imported: null,
    message: 'The database server does not answer',
  },
  {
    id: 'custom_3',
    status: 'ok',
    started_at: `${YESTERDAY}T18:29:00Z`,
    finished_at: `${YESTERDAY}T18:30:00Z`,
    imported: 42,
    message: null,
  },
]

const importsFixture = () => [
  {
    id: 3,
    created_at: '2026-11-18T15:40:00Z',
    owner: 'lbianchi',
    filename: 'contacts-laura.csv',
    type: 'public',
    total: 132,
    imported: 132,
    skipped: 0,
    failed: 0,
  },
  {
    id: 2,
    created_at: '2026-11-12T09:12:00Z',
    owner: 'mneri',
    filename: 'export-outlook.csv',
    type: 'group:Sales',
    total: 425,
    imported: 418,
    skipped: 7,
    failed: 0,
  },
  {
    id: 1,
    created_at: '2026-10-03T17:05:00Z',
    owner: 'mrossi',
    filename: 'customers-2026.csv',
    type: 'public',
    total: 95,
    imported: 95,
    skipped: 0,
    failed: 0,
  },
]

const DB_ROWS = [
  {
    contact_name: 'Mario Rossi',
    company_name: 'Acme Ltd',
    phone: '0721 000001',
    mobile: '333 0000001',
    email: 'm.rossi@example.com',
    city: 'Pesaro',
    vat_number: 'IT00000000001',
    notes: '',
  },
  {
    contact_name: 'Laura Bianchi',
    company_name: 'Bianchi Systems',
    phone: '0544 000002',
    mobile: '',
    email: 'l.bianchi@example.com',
    city: 'Ravenna',
    vat_number: 'IT00000000002',
    notes: 'VIP',
  },
  {
    contact_name: 'Giulia Verdi',
    company_name: 'Verdi Logistics',
    phone: '051 000003',
    mobile: '333 0000003',
    email: '',
    city: 'Bologna',
    vat_number: 'IT00000000003',
    notes: '',
  },
]

const CONTACTS_CSV = [
  'Name,Company,Phone,Birthday',
  'Anna Miller,Example Ltd,300,1990-01-01',
  'Christopher Davis,,301,',
  ',Nameless Inc,302,',
  'Grace Lee,Lee Corp,303,',
  'Oscar Wild,,304,',
].join('\n')

const SOURCES_DESCRIPTION =
  "A phonebook source syncs contacts from a database, a CSV file or Infinity Zucchetti into the phonebook. Users see them in NethVoice CTI but can't change them."

const sourcesGrid = (page: Page) => page.getByRole('grid', { name: 'Phonebook sources' })
const importsGrid = (page: Page) => page.getByRole('grid', { name: 'Imported contacts' })
const toasts = (page: Page) => page.getByTestId('toast-notifications')
const drawer = (page: Page) => page.getByRole('dialog')
const sourceRow = (page: Page, name: string) =>
  sourcesGrid(page).getByRole('row').filter({ hasText: name })
const field = (page: Page, name: string) =>
  drawer(page).getByRole('textbox', name === 'Port' ? { name: /^Port/ } : { name, exact: true })
const cells = (page: Page, name: string) => sourceRow(page, name).locator('td')
const syncing = (page: Page, name: string) =>
  sourceRow(page, name).getByRole('status').filter({ hasText: 'Syncing…' })
const combobox = (page: Page, name: string) =>
  drawer(page).getByRole('combobox', { name, exact: true })
const button = (page: Page, name: string) => drawer(page).getByRole('button', { name, exact: true })

const optionName = (label: string) =>
  new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}( [a-z_0-9]+)?$`)

const choose = async (page: Page, name: string, option: string) => {
  await combobox(page, name).click()
  await page.getByRole('option', { name: optionName(option) }).click()
  await drawer(page).getByRole('heading', { level: 3 }).first().click()
  await expect(page.getByRole('option')).toHaveCount(0)
}

const chooseGroup = async (page: Page, group: string) => {
  await combobox(page, 'Groups').click()
  await page.getByRole('option', { name: group, exact: true }).click()
  await drawer(page).getByRole('heading', { level: 3 }).first().click()
  await expect(page.getByRole('option')).toHaveCount(0)
}

type MockState = {
  sources: Record<string, Record<string, unknown>>
  statuses: Record<string, unknown>[]
  imports: Record<string, unknown>[]
}

const mockPhonebook = (mockApi: MockApi): MockState => {
  const state: MockState = {
    sources: sourcesFixture(),
    statuses: statusesFixture(),
    imports: importsFixture(),
  }

  mockApi
    .on('GET', '/freepbx/rest/phonebook/config', () => ({ json: state.sources }))
    .on('GET', '/freepbx/rest/phonebook/fields', { json: FIELDS })
    .on('GET', '/freepbx/rest/phonebook/status', () => ({ json: state.statuses }))
    .on('GET', '/freepbx/rest/phonebook/imports', () => ({ json: state.imports }))
    .on('GET', '/freepbx/rest/cti/groups', { json: GROUPS })
    .on('GET', '/freepbx/rest/users/false', { json: USERS })
  return state
}

const fillDatabaseStep = async (page: Page, name = 'Customers') => {
  await field(page, 'Name').fill(name)
  await field(page, 'Database name').fill('crm')
  await field(page, 'Address').fill('crm-db.example.com')
  await field(page, 'Username').fill('nethvoice')
  await drawer(page).getByLabel('Password', { exact: true }).fill('db-secret')
  await field(page, 'Query').fill('SELECT * FROM contacts')
}

test.describe('integrations: phonebook', () => {
  test.use({ timezoneId: 'UTC' })

  let state: MockState

  test.beforeEach(async ({ signedIn, mockApi }) => {
    void signedIn
    state = mockPhonebook(mockApi)
  })

  test('lists the sources with their type, visibility, sync and last sync', async ({ page }) => {
    await page.goto('./integrations/phonebook')

    await expect(page.getByRole('heading', { name: 'Phonebook sources' })).toBeVisible()
    await expect(page.getByText(SOURCES_DESCRIPTION)).toBeVisible()
    const rows = sourcesGrid(page).getByRole('row')
    await expect(rows).toHaveCount(6)
    await expect(sourcesGrid(page).getByRole('columnheader')).toHaveText([
      'Name',
      'Type',
      'Visible to',
      'Sync',
      'Last sync',
      'Actions',
    ])
    await expect(cells(page, 'CRM contacts')).toContainText([
      'CRM contacts',
      'MySQL',
      'Everyone',
      'Every hour',
      'Today at 10:00 AM',
    ])
    await expect(cells(page, 'ERP suppliers')).toContainText([
      'ERP suppliers',
      'MS SQL Server',
      'Purchasing, Management',
      'Every hour',
      'Failed today at 02:00 AM',
    ])
    await expect(cells(page, 'Partners')).toContainText([
      'Partners',
      'CSV',
      'Everyone',
      'Sync-',
      'Yesterday at 06:30 PM',
    ])
    await expect(cells(page, 'HR directory')).toContainText([
      'HR directory',
      'Infinity Zucchetti',
      'Reception',
      'Every hour',
      'Last sync-',
    ])
    await expect(sourceRow(page, 'Legacy directory')).toContainText('Unknown')
    await expect(
      sourceRow(page, 'CRM contacts').locator('svg[data-icon="circle-check"]'),
    ).toHaveCount(1)
    await expect(
      sourceRow(page, 'ERP suppliers').locator('svg[data-icon="circle-xmark"]'),
    ).toHaveCount(1)
    await expect(
      sourceRow(page, 'CRM contacts').getByRole('button', { name: /sync error/ }),
    ).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Edit Legacy directory' })).toBeDisabled()
    await expect(page.getByRole('textbox', { name: /Filter/ })).toHaveCount(0)

    await expect(page.getByRole('heading', { name: 'Import contacts' })).toBeVisible()
    const imports = importsGrid(page).getByRole('row')
    await expect(imports).toHaveCount(4)
    await expect(importsGrid(page).getByRole('columnheader')).toHaveText([
      'Date',
      'Owner',
      'File',
      'Contacts',
      'Visible to',
    ])
    await expect(imports.nth(1).locator('td')).toContainText([
      'Nov 18, 2026, 03:40 PM',
      'Laura Bianchi (202)',
      'contacts-laura.csv',
      '132 imported',
      'Everyone',
    ])
    await expect(imports.nth(2).locator('td')).toContainText([
      'Nov 12, 2026, 09:12 AM',
      'Marco Neri (210)',
      'export-outlook.csv',
      '418 imported',
      'Sales',
    ])
  })

  test('opens the row menu with Sync now, a divider and Delete', async ({ page }) => {
    await page.goto('./integrations/phonebook')
    await page.getByRole('button', { name: 'Open the menu of CRM contacts' }).click()

    await expect(page.getByRole('menuitem')).toHaveText(['Sync now', 'Delete'])
    await expect(page.getByRole('menuitem', { name: 'Sync now' }).locator('svg')).toHaveAttribute(
      'data-icon',
      'arrows-rotate',
    )
    await expect(page.getByRole('menuitem', { name: /Enable|Disable/ })).toHaveCount(0)
    await page.keyboard.press('Escape')

    await page.getByRole('button', { name: 'Open the menu of Legacy directory' }).click()
    const legacyMenu = page.getByRole('menu', { name: 'Open the menu of Legacy directory' })
    await expect(legacyMenu.getByRole('menuitem', { name: 'Sync now' })).toBeDisabled()
    await expect(legacyMenu.getByRole('menuitem', { name: 'Delete' })).toBeEnabled()
  })

  test('shows the empty states when nothing is configured', async ({ page }) => {
    state.sources = {}
    state.statuses = []
    state.imports = []

    await page.goto('./integrations/phonebook')

    await expect(page.getByText('No phonebook sources configured')).toBeVisible()
    await expect(page.getByText('No contacts imported')).toBeVisible()
    await expect(page.getByRole('grid')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Create phonebook source' })).toHaveCount(1)
    await expect(page.getByRole('button', { name: 'Import contacts' })).toHaveCount(1)
    await expect(page.getByText(SOURCES_DESCRIPTION)).toHaveCount(1)
  })

  test('reports a load error and retries', async ({ page, mockApi }) => {
    let failing = true

    mockApi.on('GET', '/freepbx/rest/phonebook/config', () =>
      failing ? { status: 500 } : { json: state.sources },
    )

    await page.goto('./integrations/phonebook')
    await expect(page.getByText('Cannot retrieve phonebook sources')).toBeVisible()

    failing = false
    await page.getByRole('button', { name: 'Retry' }).click()

    await expect(sourcesGrid(page).getByRole('row')).toHaveCount(6)
  })

  test('creates a database source in three steps and syncs it at once', async ({
    page,
    mockApi,
  }) => {
    let releaseSync = () => {}
    const syncGate = new Promise<void>((resolve) => {
      releaseSync = resolve
    })

    mockApi
      .on('POST', '/freepbx/rest/phonebook/test', { json: { rows: DB_ROWS, total: 1248 } })
      .on('POST', '/freepbx/rest/phonebook/config', (request) => {
        state.sources = {
          ...state.sources,
          custom_6: { ...(request.body as Record<string, unknown>), has_password: true },
        }
        return { json: { id: 'custom_6' } }
      })
      .on('POST', '/freepbx/rest/phonebook/syncnow/:id', async () => {
        await syncGate
        state.statuses = [
          ...state.statuses,
          {
            id: 'custom_6',
            status: 'ok',
            started_at: `${TODAY}T11:59:00Z`,
            finished_at: `${TODAY}T11:59:30Z`,
            imported: 1248,
            message: null,
          },
        ]
        return { json: { status: true } }
      })

    await page.goto('./integrations/phonebook')
    await page.getByRole('button', { name: 'Create phonebook source' }).click()

    await expect(drawer(page).getByText('Step 1/3')).toBeVisible()
    await expect(combobox(page, 'Type')).toHaveValue('MySQL')
    await expect(field(page, 'Query')).toHaveValue('SELECT * FROM [table]')
    await expect(field(page, 'Port')).toHaveValue('')
    await expect(field(page, 'Port')).toHaveAttribute('placeholder', 'e.g. 3306')
    await expect(
      drawer(page).getByText('Leave empty to use the default port of MySQL (3306).'),
    ).toBeVisible()
    await expect(field(page, 'Name')).toBeFocused()

    await button(page, 'Next').click()
    await expect(drawer(page).getByText('Enter a name')).toBeVisible()
    await expect(drawer(page).getByText('Enter the name', { exact: true })).toBeVisible()
    await expect(drawer(page).getByText('Enter the address')).toBeVisible()
    await expect(drawer(page).getByText('Enter the username')).toBeVisible()
    await expect(drawer(page).getByText('Enter the password')).toBeVisible()
    await expect(
      drawer(page).getByText('Replace [table] with the name of the table', { exact: true }),
    ).toBeVisible()
    await expect(field(page, 'Name')).toBeFocused()
    expect(mockApi.callsTo('POST', '/freepbx/rest/phonebook/test')).toHaveLength(0)

    await fillDatabaseStep(page)
    await button(page, 'Next').click()

    await expect(drawer(page).getByText('Step 2/3')).toBeVisible()
    expect(mockApi.callsTo('POST', '/freepbx/rest/phonebook/test')[0].body).toEqual({
      dbtype: 'mysql',
      host: 'crm-db.example.com',
      port: '3306',
      user: 'nethvoice',
      password: 'db-secret',
      dbname: 'crm',
      query: 'SELECT * FROM contacts',
      with_total: true,
    })
    await expect(
      drawer(page).getByText(
        "Choose the phonebook field of each column. Choose Not imported for the columns you don't need.",
      ),
    ).toBeVisible()
    await expect(combobox(page, 'contact_name')).toHaveValue('Name')
    await expect(combobox(page, 'company_name')).toHaveValue('Company')
    await expect(combobox(page, 'phone')).toHaveValue('Work phone')
    await expect(combobox(page, 'mobile')).toHaveValue('Mobile phone')
    await expect(combobox(page, 'email')).toHaveValue('Work email')
    await expect(combobox(page, 'city')).toHaveValue('Work city')
    await expect(combobox(page, 'notes')).toHaveValue('Notes')
    await expect(combobox(page, 'vat_number')).toHaveValue('')
    await expect(combobox(page, 'vat_number')).toHaveAttribute('placeholder', 'Choose field')
    await expect(drawer(page).getByRole('grid', { name: 'Preview' })).toContainText('Mario Rossi')
    await expect(drawer(page).getByText('First 3 of 1,248 rows.')).toBeVisible()
    await expect(drawer(page).getByText('No column for Name')).toHaveCount(0)

    await button(page, 'Next').click()
    await expect(drawer(page).getByText('Select a field')).toHaveCount(1)
    await expect(combobox(page, 'vat_number')).toBeFocused()
    await expect(drawer(page).getByText('Step 2/3')).toBeVisible()

    await combobox(page, 'vat_number').click()
    await expect(page.getByRole('option', { name: optionName('Name') })).toHaveCount(0)
    await expect(page.getByRole('option', { name: /^Owner ID/ })).toHaveCount(1)
    await page.getByRole('option', { name: 'Not imported' }).click()
    await expect(drawer(page).getByText('Select a field')).toHaveCount(0)
    await button(page, 'Next').click()

    await expect(drawer(page).getByText('Step 3/3')).toBeVisible()
    await expect(drawer(page).getByRole('radio', { name: 'Everyone' })).toBeChecked()
    await expect(drawer(page).getByRole('checkbox', { name: 'Enabled' })).toBeChecked()
    await expect(drawer(page).getByText('Interval')).toHaveCount(0)
    await drawer(page).getByRole('radio', { name: 'Selected groups' }).check()
    await expect(
      drawer(page).getByText('Users of these groups see the contacts in NethVoice CTI.'),
    ).toBeVisible()
    await button(page, 'Create').click()
    await expect(drawer(page).getByText('Select at least one group')).toBeVisible()
    await chooseGroup(page, 'Sales')
    await button(page, 'Create').click()

    await expect(drawer(page)).toBeHidden()
    expect(mockApi.callsTo('POST', '/freepbx/rest/phonebook/config')[0].body).toEqual({
      dbtype: 'mysql',
      host: 'crm-db.example.com',
      port: '3306',
      user: 'nethvoice',
      password: 'db-secret',
      dbname: 'crm',
      query: 'SELECT * FROM contacts',
      mapping: {
        contact_name: 'name',
        company_name: 'company',
        phone: 'workphone',
        mobile: 'cellphone',
        email: 'workemail',
        city: 'workcity',
        notes: 'notes',
      },
      type: 'Customers',
      access: 'group:Sales',
      enabled: true,
    })
    await expect(toasts(page).getByText('Phonebook source created')).toBeVisible()
    await expect(
      toasts(page).getByText('Phonebook source Customers has been created'),
    ).toBeVisible()
    await expect(syncing(page, 'Customers')).toBeVisible()
    expect(mockApi.callsTo('POST', '/freepbx/rest/phonebook/syncnow/:id')[0]).toMatchObject({
      path: '/freepbx/rest/phonebook/syncnow/custom_6',
      body: { force: true },
    })

    releaseSync()
    await expect(sourceRow(page, 'Customers')).toContainText('Today at 11:59 AM')
    await expect(syncing(page, 'Customers')).toHaveCount(0)
  })

  test('shows the read errors by kind and keeps them in the first step', async ({
    page,
    mockApi,
  }) => {
    let failure: Record<string, unknown> = {
      status: false,
      error: {
        kind: 'connection',
        details: 'Unable to connect: Adaptive Server is unavailable or does not exist',
      },
    }

    mockApi.on('POST', '/freepbx/rest/phonebook/test', () => ({ json: failure }))

    await page.goto('./integrations/phonebook')
    await page.getByRole('button', { name: 'Create phonebook source' }).click()
    await fillDatabaseStep(page)
    await button(page, 'Next').click()

    await expect(drawer(page).getByText('Cannot connect to database')).toBeVisible()
    await expect(
      drawer(page).getByText(
        'The database server does not answer. Check the address, the port and the firewall.',
      ),
    ).toBeVisible()
    await expect(drawer(page).getByText('Step 1/3')).toBeVisible()
    await expect(drawer(page).getByText(/Adaptive Server/)).toBeHidden()
    await button(page, 'Show details').click()
    await expect(drawer(page).getByText(/Adaptive Server is unavailable/)).toBeVisible()
    await expect(drawer(page).getByText('Step 1/3')).toBeVisible()

    const cases: [Record<string, unknown>, string, string][] = [
      [
        { kind: 'auth', details: "Access denied for user 'nethvoice'" },
        'Cannot connect to database',
        'The server rejected the username or password. Check the credentials.',
      ],
      [
        { kind: 'query', details: "Table 'crm.contacts' doesn't exist" },
        'Cannot run query',
        'The database returned an error. Check the query.',
      ],
      [
        { kind: 'unknown', details: '' },
        'Cannot read phonebook source',
        'Check the connection data and try again.',
      ],
    ]

    for (const [error, title, description] of cases) {
      failure = { status: false, error }
      await button(page, 'Next').click()
      await expect(drawer(page).getByText(title)).toBeVisible()
      await expect(drawer(page).getByText(description)).toBeVisible()
      await expect(button(page, 'Show details')).toHaveCount(error.details ? 1 : 0)
    }
    await expect(drawer(page).getByText('Step 1/3')).toBeVisible()

    await field(page, 'Query').fill('SELECT * FROM people')
    await expect(drawer(page).getByText('Cannot read phonebook source')).toHaveCount(0)
  })

  test('stays in the first step when the source has no rows to read the columns from', async ({
    page,
    mockApi,
  }) => {
    let rows: Record<string, string>[] = []

    mockApi.on('POST', '/freepbx/rest/phonebook/test', () => ({
      json: { rows, total: rows.length },
    }))

    await page.goto('./integrations/phonebook')
    await page.getByRole('button', { name: 'Create phonebook source' }).click()
    await fillDatabaseStep(page)
    await button(page, 'Next').click()

    await expect(drawer(page).getByText('Cannot read the columns')).toBeVisible()
    await expect(
      drawer(page).getByText(
        'The query returned no rows, so there are no columns to map. Change the query or add a contact, then try again.',
      ),
    ).toBeVisible()
    await expect(drawer(page).getByText('Step 1/3')).toBeVisible()

    rows = DB_ROWS.slice(0, 1)
    await button(page, 'Next').click()
    await expect(drawer(page).getByText('Step 2/3')).toBeVisible()
    await expect(drawer(page).getByText('Cannot read the columns')).toHaveCount(0)
    expect(mockApi.callsTo('POST', '/freepbx/rest/phonebook/config')).toHaveLength(0)
  })

  test('validates the name, the port, the query and the MS SQL Server address', async ({
    page,
    mockApi,
  }) => {
    mockApi.on('POST', '/freepbx/rest/phonebook/test', { json: { rows: DB_ROWS, total: 3 } })

    await page.goto('./integrations/phonebook')
    await page.getByRole('button', { name: 'Create phonebook source' }).click()
    await choose(page, 'Type', 'MS SQL Server')
    await fillDatabaseStep(page, 'erp SUPPLIERS')
    await field(page, 'Address').fill('erp-db\\SQLEXPRESS')
    await field(page, 'Port').fill('70000')
    await field(page, 'Query').fill('SELECT * FROM [table]')
    await expect(field(page, 'Port')).toHaveAttribute('placeholder', 'e.g. 1433')
    await button(page, 'Next').click()

    await expect(
      drawer(page).getByText(
        'A phonebook source with this name already exists. Enter another name.',
      ),
    ).toBeVisible()
    await expect(
      drawer(page).getByText(
        'Enter the address of the server, not the name of the instance. For a named instance, enter its port in Port.',
      ),
    ).toBeVisible()
    await expect(drawer(page).getByText('Enter a port between 1 and 65535')).toBeVisible()
    await expect(
      drawer(page).getByText('Replace [table] with the name of the table', { exact: true }),
    ).toBeVisible()
    await expect(field(page, 'Name')).toBeFocused()

    await field(page, 'Name').fill('ERP customers')
    await field(page, 'Address').fill('erp-db.example.com')
    await field(page, 'Port').fill('')
    await field(page, 'Query').fill('SELECT * FROM customers')
    await button(page, 'Next').click()

    await expect(drawer(page).getByText('Step 2/3')).toBeVisible()
    expect(mockApi.callsTo('POST', '/freepbx/rest/phonebook/test')[0].body).toMatchObject({
      dbtype: 'mssql',
      host: 'erp-db.example.com',
      port: '1433',
    })
    await expect(drawer(page).getByText('3 rows.')).toBeVisible()
  })

  test('creates a CSV source downloaded from a URL', async ({ page, mockApi }) => {
    mockApi
      .on('POST', '/freepbx/rest/phonebook/test', {
        json: {
          rows: [
            { Name: 'Anna Miller', Phone: '300', Owner: 'x' },
            { Name: 'Grace Lee', Phone: '', Owner: '' },
          ],
          total: 2,
        },
      })
      .on('POST', '/freepbx/rest/phonebook/config', { json: { id: 'custom_6' } })
      .on('POST', '/freepbx/rest/phonebook/syncnow/:id', { json: { status: true } })

    await page.goto('./integrations/phonebook')
    await page.getByRole('button', { name: 'Create phonebook source' }).click()
    await field(page, 'Name').fill('Resellers')
    await choose(page, 'Type', 'CSV')

    await expect(drawer(page).getByRole('radio', { name: 'Download from a URL' })).toBeChecked()
    await expect(field(page, 'URL')).toHaveAttribute(
      'placeholder',
      'e.g. https://intranet.example.com/contacts.csv',
    )
    await expect(
      drawer(page).getByText(
        "CSV file in UTF-8, with the column names in the first row. It's downloaded at every sync.",
      ),
    ).toBeVisible()
    await field(page, 'URL').fill('file:///srv/contacts.csv')
    await button(page, 'Next').click()
    await expect(
      drawer(page).getByText('Enter a URL starting with http:// or https://, without spaces'),
    ).toBeVisible()
    expect(mockApi.callsTo('POST', '/freepbx/rest/phonebook/test')).toHaveLength(0)

    await field(page, 'URL').fill('https://intranet.example.com/contacts.csv')
    await button(page, 'Next').click()

    await expect(combobox(page, 'Name')).toHaveValue('Name')
    await combobox(page, 'Owner').click()
    await expect(page.getByRole('option', { name: /^Owner ID/ })).toHaveCount(0)
    await page.getByRole('option', { name: 'Not imported' }).click()
    await choose(page, 'Phone', 'Work phone')
    await expect(drawer(page).getByText('2 rows.')).toBeVisible()
    await button(page, 'Next').click()
    await button(page, 'Create').click()

    await expect(drawer(page)).toBeHidden()
    expect(mockApi.callsTo('POST', '/freepbx/rest/phonebook/test')[0].body).toEqual({
      dbtype: 'csv',
      url: 'https://intranet.example.com/contacts.csv',
      with_total: true,
    })
    expect(mockApi.callsTo('POST', '/freepbx/rest/phonebook/config')[0].body).toEqual({
      dbtype: 'csv',
      url: 'https://intranet.example.com/contacts.csv',
      mapping: { Name: 'name', Phone: 'workphone' },
      type: 'Resellers',
      access: 'public',
      enabled: true,
    })
  })

  test('creates a CSV source from an uploaded file and counts its rows', async ({
    page,
    mockApi,
  }) => {
    mockApi
      .on('POST', '/freepbx/rest/phonebook/uploadfile', { json: { status: true, uri: UPLOADED } })
      .on('POST', '/freepbx/rest/phonebook/test', {
        json: [
          { Name: 'Anna Miller', Company: 'Example Ltd', Phone: '300', Birthday: '' },
          { Name: 'Christopher Davis', Company: '', Phone: '301', Birthday: '' },
          { Name: '', Company: 'Nameless Inc', Phone: '302', Birthday: '' },
        ],
      })
      .on('POST', '/freepbx/rest/phonebook/config', { json: { id: 'custom_6' } })
      .on('POST', '/freepbx/rest/phonebook/syncnow/:id', { json: { status: true } })

    await page.goto('./integrations/phonebook')
    await page.getByRole('button', { name: 'Create phonebook source' }).click()
    await field(page, 'Name').fill('Resellers')
    await choose(page, 'Type', 'CSV')
    await drawer(page).getByRole('radio', { name: 'Upload file' }).check()
    await button(page, 'Next').click()

    await expect(drawer(page).getByText('Choose a file')).toBeVisible()
    await drawer(page)
      .locator('input[type=file]')
      .setInputFiles({
        name: 'resellers.exe',
        mimeType: 'application/octet-stream',
        buffer: Buffer.from('MZ'),
      })
    await expect(drawer(page).getByText('Choose a .csv or .txt file')).toBeVisible()

    await drawer(page)
      .locator('input[type=file]')
      .setInputFiles({
        name: 'resellers.csv',
        mimeType: 'text/csv',
        buffer: Buffer.from(CONTACTS_CSV),
      })
    await expect(
      drawer(page).getByText('CSV file in UTF-8, with the column names in the first row.'),
    ).toBeVisible()
    await button(page, 'Next').click()

    await expect(drawer(page).getByText('First 3 of 5 rows.')).toBeVisible()
    expect(mockApi.callsTo('POST', '/freepbx/rest/phonebook/uploadfile')).toHaveLength(1)
    expect(mockApi.callsTo('POST', '/freepbx/rest/phonebook/test')[0].body).toEqual({
      dbtype: 'csv',
      url: UPLOADED,
      with_total: true,
    })
    await choose(page, 'Phone', 'Work phone')
    await choose(page, 'Birthday', 'Not imported')
    await button(page, 'Next').click()
    await button(page, 'Create').click()

    await expect(drawer(page)).toBeHidden()
    expect(mockApi.callsTo('POST', '/freepbx/rest/phonebook/config')[0].body).toMatchObject({
      dbtype: 'csv',
      url: UPLOADED,
      mapping: { Name: 'name', Company: 'company', Phone: 'workphone' },
    })
    expect(mockApi.callsTo('DELETE', '/freepbx/rest/phonebook/uploadfile/:name')).toHaveLength(0)
  })

  test('deletes the uploaded file of a source that is not created', async ({ page, mockApi }) => {
    mockApi
      .on('POST', '/freepbx/rest/phonebook/uploadfile', { json: { status: true, uri: UPLOADED } })
      .on('POST', '/freepbx/rest/phonebook/test', { json: { rows: DB_ROWS, total: 3 } })
      .on('DELETE', '/freepbx/rest/phonebook/uploadfile/:name', { json: { status: true } })

    await page.goto('./integrations/phonebook')
    await page.getByRole('button', { name: 'Create phonebook source' }).click()
    await field(page, 'Name').fill('Resellers')
    await choose(page, 'Type', 'CSV')
    await drawer(page).getByRole('radio', { name: 'Upload file' }).check()
    await drawer(page)
      .locator('input[type=file]')
      .setInputFiles({
        name: 'resellers.csv',
        mimeType: 'text/csv',
        buffer: Buffer.from(CONTACTS_CSV),
      })
    await button(page, 'Next').click()
    await expect(drawer(page).getByText('Step 2/3')).toBeVisible()
    await button(page, 'Cancel').click()
    await page.getByRole('button', { name: 'Discard changes' }).click()

    await expect(page.getByRole('button', { name: 'Discard changes' })).toHaveCount(0)
    await expect
      .poll(() => mockApi.callsTo('DELETE', '/freepbx/rest/phonebook/uploadfile/:name').length)
      .toBe(1)
    expect(mockApi.callsTo('DELETE', '/freepbx/rest/phonebook/uploadfile/:name')[0].path).toBe(
      '/freepbx/rest/phonebook/uploadfile/abc123.csv',
    )
  })

  test('creates an Infinity Zucchetti source with the fixed mapping', async ({ page, mockApi }) => {
    mockApi
      .on('POST', '/freepbx/rest/phonebook/test', {
        json: {
          rows: [
            {
              name: 'Francesca Leone',
              company: 'Acme Ltd',
              cellphone: '335 0000001',
              type: 'Infinity contacts',
              access: 'public',
              sid_imported: 'phonebook_test_1',
            },
            {
              name: 'Stefano Marino',
              company: 'Acme Ltd',
              workphone: '0721 0000002',
              type: 'Infinity contacts',
              access: 'public',
              sid_imported: 'phonebook_test_1',
            },
          ],
          total: 57,
        },
      })
      .on('POST', '/freepbx/rest/phonebook/config', { json: { id: 'custom_6' } })
      .on('POST', '/freepbx/rest/phonebook/syncnow/:id', { json: { status: true } })

    await page.goto('./integrations/phonebook')
    await page.getByRole('button', { name: 'Create phonebook source' }).click()
    await field(page, 'Name').fill('Infinity contacts')
    await choose(page, 'Type', 'Infinity Zucchetti')
    await expect(field(page, 'URL')).toHaveAttribute(
      'placeholder',
      'e.g. https://example.infinity.zucchetti.com',
    )
    await expect(drawer(page).getByText('URL of the Infinity Zucchetti APIs.')).toBeVisible()
    await field(page, 'URL').fill('https://example.infinity.zucchetti.com')
    await field(page, 'Username').fill('nethvoice')
    await drawer(page).getByLabel('Password', { exact: true }).fill('api-secret')
    await button(page, 'Next').click()

    await expect(
      drawer(page).getByText('The fields of Infinity Zucchetti go to these phonebook fields.'),
    ).toBeVisible()
    const mapping = drawer(page).getByRole('grid', { name: 'Field mapping' }).getByRole('row')
    await expect(mapping).toHaveCount(12)
    await expect(
      drawer(page).getByRole('grid', { name: 'Field mapping' }).getByRole('columnheader'),
    ).toHaveText(['Column', 'Phonebook field'])
    await expect(mapping.nth(9).locator('td')).toContainText(['Address', 'Work street'])
    const preview = drawer(page).getByRole('grid', { name: 'Preview' })
    await expect(preview.getByRole('columnheader')).toHaveText([
      'Name',
      'Company',
      'Mobile phone',
      'Work phone',
    ])
    await expect(preview).toContainText('Francesca Leone')
    await expect(preview).not.toContainText('phonebook_test_1')
    await expect(drawer(page).getByText('First 2 of 57 rows.')).toBeVisible()
    await expect(drawer(page).getByRole('combobox')).toHaveCount(0)
    await button(page, 'Next').click()
    await button(page, 'Create').click()

    await expect(drawer(page)).toBeHidden()
    expect(mockApi.callsTo('POST', '/freepbx/rest/phonebook/config')[0].body).toEqual({
      dbtype: 'infinity',
      url: 'https://example.infinity.zucchetti.com',
      username: 'nethvoice',
      password: 'api-secret',
      type: 'Infinity contacts',
      access: 'public',
      enabled: true,
    })
  })

  test('warns without blocking when no column holds the names', async ({ page, mockApi }) => {
    mockApi.on('POST', '/freepbx/rest/phonebook/test', { json: { rows: DB_ROWS, total: 3 } })

    await page.goto('./integrations/phonebook')
    await page.getByRole('button', { name: 'Create phonebook source' }).click()
    await fillDatabaseStep(page)
    await button(page, 'Next').click()
    await choose(page, 'contact_name', 'Not imported')
    await choose(page, 'vat_number', 'Not imported')

    await expect(drawer(page).getByText('No column for Name')).toBeVisible()
    await expect(
      drawer(page).getByText(
        'Contacts will be imported without a name. Choose Name for the column with the names of the contacts.',
      ),
    ).toBeVisible()
    await button(page, 'Next').click()
    await expect(drawer(page).getByText('Step 3/3')).toBeVisible()

    await button(page, 'Previous').click()
    await expect(drawer(page).getByText('Step 2/3')).toBeVisible()
    await button(page, 'Previous').click()
    await expect(drawer(page).getByText('Step 1/3')).toBeVisible()
    await button(page, 'Next').click()
    await expect(drawer(page).getByText('Step 2/3')).toBeVisible()
    expect(mockApi.callsTo('POST', '/freepbx/rest/phonebook/test')).toHaveLength(1)
  })

  test('edits a source in sections and keeps the stored password', async ({ page, mockApi }) => {
    mockApi.on('POST', '/freepbx/rest/phonebook/config/:id', { json: { id: 'custom_2' } })

    await page.goto('./integrations/phonebook')
    await page.getByRole('button', { name: 'Edit ERP suppliers' }).click()

    await expect(drawer(page).getByRole('heading', { name: 'Edit phonebook source' })).toBeVisible()
    await expect(drawer(page).getByText(/Step \d\/3/)).toHaveCount(0)
    for (const heading of ['Field mapping', 'Visibility', 'Sync']) {
      await expect(drawer(page).getByRole('heading', { name: heading, exact: true })).toBeVisible()
    }
    await expect(combobox(page, 'Type')).toBeDisabled()
    await expect(combobox(page, 'Type')).toHaveValue('MS SQL Server')
    await expect(field(page, 'Port')).toHaveValue('1433')
    await expect(drawer(page).getByLabel('Password', { exact: true })).toHaveValue('')
    await expect(drawer(page).getByText('Leave empty to keep the current password.')).toBeVisible()
    await expect(combobox(page, 'RagioneSociale')).toHaveValue('Company')
    await expect(combobox(page, 'Referente')).toHaveValue('Name')
    await expect(drawer(page).getByRole('radio', { name: 'Selected groups' })).toBeChecked()
    await expect(button(page, 'Remove Purchasing')).toBeVisible()
    await expect(button(page, 'Show preview')).toBeVisible()

    await field(page, 'Name').fill('crm CONTACTS')
    await button(page, 'Save').click()
    await expect(
      drawer(page).getByText(
        'A phonebook source with this name already exists. Enter another name.',
      ),
    ).toBeVisible()

    await field(page, 'Name').fill('ERP vendors')
    await drawer(page).getByText('Enabled', { exact: true }).click()
    await expect(drawer(page).getByRole('checkbox', { name: 'Disabled' })).not.toBeChecked()
    await button(page, 'Save').click()

    await expect(drawer(page)).toBeHidden()
    expect(mockApi.callsTo('POST', '/freepbx/rest/phonebook/test')).toHaveLength(0)
    const calls = mockApi.callsTo('POST', '/freepbx/rest/phonebook/config/:id')
    expect(calls[0].path).toBe('/freepbx/rest/phonebook/config/custom_2')
    expect(calls[0].body).toEqual({
      dbtype: 'mssql',
      host: '192.168.5.12',
      port: '1433',
      user: 'sa_readonly',
      dbname: 'erp',
      query: 'SELECT * FROM suppliers',
      mapping: { RagioneSociale: 'company', Referente: 'name' },
      type: 'ERP vendors',
      access: 'group:Purchasing,Management',
      interval: 60,
      enabled: false,
    })
    await expect(toasts(page).getByText('Phonebook source updated')).toBeVisible()
    await expect(
      toasts(page).getByText('Phonebook source ERP vendors has been updated'),
    ).toBeVisible()
  })

  test('shows the preview of an edited source and its read errors', async ({ page, mockApi }) => {
    let response: unknown = { rows: DB_ROWS, total: 1248 }

    mockApi.on('POST', '/freepbx/rest/phonebook/test', () => ({ json: response }))

    await page.goto('./integrations/phonebook')
    await page.getByRole('button', { name: 'Edit CRM contacts' }).click()
    await button(page, 'Show preview').click()

    await expect(drawer(page).getByRole('grid', { name: 'Preview' })).toContainText('Laura Bianchi')
    await expect(drawer(page).getByText('First 3 of 1,248 rows.')).toBeVisible()
    expect(mockApi.callsTo('POST', '/freepbx/rest/phonebook/test')[0].body).toEqual({
      dbtype: 'mysql',
      host: 'crm-db.example.com',
      port: '3306',
      user: 'reader',
      dbname: 'crm',
      query: 'SELECT * FROM contacts',
      id: 'custom_1',
      with_total: true,
    })
    await expect(combobox(page, 'contact_name')).toHaveValue('Name')
    await expect(combobox(page, 'vat_number')).toHaveValue('Not imported')

    response = {
      status: false,
      error: { kind: 'auth', details: "Access denied for user 'reader'" },
    }
    await button(page, 'Show preview').click()
    await expect(drawer(page).getByText('Cannot connect to database')).toBeVisible()
    await expect(drawer(page).getByRole('grid', { name: 'Preview' })).toHaveCount(0)
    await button(page, 'Show details').click()
    await expect(drawer(page).getByText("Access denied for user 'reader'")).toBeVisible()
  })

  test('reads an edited source again on Save and stops on new columns', async ({
    page,
    mockApi,
  }) => {
    mockApi
      .on('POST', '/freepbx/rest/phonebook/test', {
        json: { rows: [{ contact_name: 'Mario Rossi', phone: '300', mobile: '333' }], total: 1 },
      })
      .on('POST', '/freepbx/rest/phonebook/config/:id', { json: { id: 'custom_1' } })

    await page.goto('./integrations/phonebook')
    await page.getByRole('button', { name: 'Edit CRM contacts' }).click()
    await field(page, 'Query').fill('SELECT contact_name, phone, mobile FROM contacts')
    await button(page, 'Save').click()

    await expect(combobox(page, 'mobile')).toHaveValue('Not imported')
    await expect(combobox(page, 'mobile')).toBeFocused()
    expect(mockApi.callsTo('POST', '/freepbx/rest/phonebook/config/:id')).toHaveLength(0)

    await choose(page, 'mobile', 'Mobile phone')
    await button(page, 'Save').click()

    await expect(drawer(page)).toBeHidden()
    expect(mockApi.callsTo('POST', '/freepbx/rest/phonebook/test')).toHaveLength(1)
    expect(mockApi.callsTo('POST', '/freepbx/rest/phonebook/config/:id')[0].body).toMatchObject({
      query: 'SELECT contact_name, phone, mobile FROM contacts',
      mapping: { contact_name: 'name', phone: 'workphone', mobile: 'cellphone' },
    })
  })

  test('asks before discarding the changes', async ({ page }) => {
    await page.goto('./integrations/phonebook')
    await page.getByRole('button', { name: 'Edit CRM contacts' }).click()
    await field(page, 'Name').fill('Changed')
    await page.keyboard.press('Escape')

    await expect(page.getByRole('heading', { name: 'Unsaved changes' })).toBeVisible()
    await page.getByRole('button', { name: 'Discard changes' }).click()
    await expect(page.getByRole('dialog', { name: 'Edit phonebook source' })).toBeHidden()
  })

  test('closes an edited source without asking when only the preview was shown', async ({
    page,
    mockApi,
  }) => {
    mockApi.on('POST', '/freepbx/rest/phonebook/test', { json: { rows: DB_ROWS, total: 3 } })

    await page.goto('./integrations/phonebook')
    await page.getByRole('button', { name: 'Edit CRM contacts' }).click()
    await button(page, 'Show preview').click()
    await expect(combobox(page, 'vat_number')).toHaveValue('Not imported')
    await button(page, 'Cancel').click()

    await expect(page.getByRole('dialog', { name: 'Edit phonebook source' })).toBeHidden()
    await expect(page.getByRole('heading', { name: 'Unsaved changes' })).toHaveCount(0)
  })

  test('syncs a source now and shows the syncing state', async ({ page, mockApi }) => {
    let releaseSync = () => {}
    const syncGate = new Promise<void>((resolve) => {
      releaseSync = resolve
    })

    mockApi.on('POST', '/freepbx/rest/phonebook/syncnow/:id', async () => {
      await syncGate
      state.statuses = state.statuses.map((status) =>
        status.id === 'custom_1'
          ? {
              ...status,
              status: 'failed',
              started_at: `${TODAY}T11:58:00Z`,
              finished_at: `${TODAY}T11:58:10Z`,
              message: 'Connection refused',
            }
          : status,
      )
      return { status: 500, json: { status: false } }
    })

    await page.goto('./integrations/phonebook')
    await page.getByRole('button', { name: 'Open the menu of CRM contacts' }).click()
    await page.getByRole('menuitem', { name: 'Sync now' }).click()

    await expect(syncing(page, 'CRM contacts')).toBeVisible()
    await page.getByRole('button', { name: 'Open the menu of CRM contacts' }).click()
    await expect(
      page
        .getByRole('menu', { name: 'Open the menu of CRM contacts' })
        .getByRole('menuitem', { name: 'Sync now' }),
    ).toBeDisabled()
    await page.keyboard.press('Escape')

    releaseSync()
    await expect(sourceRow(page, 'CRM contacts')).toContainText('Failed today at 11:58 AM')
    await expect(
      sourceRow(page, 'CRM contacts').locator('svg[data-icon="circle-xmark"]'),
    ).toHaveCount(1)
    await expect(toasts(page).getByRole('alert')).toHaveCount(0)
    await expect(toasts(page).getByText(/sync/i)).toHaveCount(0)
  })

  test('syncs a source with automatic sync disabled', async ({ page, mockApi }) => {
    mockApi.on('POST', '/freepbx/rest/phonebook/syncnow/:id', () => {
      state.statuses = state.statuses.map((status) =>
        status.id === 'custom_3'
          ? { ...status, started_at: `${TODAY}T11:30:00Z`, finished_at: `${TODAY}T11:30:00Z` }
          : status,
      )
      return { json: { status: true } }
    })

    await page.goto('./integrations/phonebook')
    await expect(sourceRow(page, 'Partners')).toContainText('Yesterday at 06:30 PM')
    await page.getByRole('button', { name: 'Open the menu of Partners' }).click()
    await page.getByRole('menuitem', { name: 'Sync now' }).click()

    await expect(sourceRow(page, 'Partners')).toContainText('Today at 11:30 AM')
    expect(mockApi.callsTo('POST', '/freepbx/rest/phonebook/syncnow/:id')[0]).toMatchObject({
      path: '/freepbx/rest/phonebook/syncnow/custom_3',
      body: { force: true },
    })
  })

  test('reports a sync that cannot start', async ({ page, mockApi }) => {
    mockApi.on('POST', '/freepbx/rest/phonebook/syncnow/:id', {
      status: 400,
      json: { status: 'Invalid source id' },
    })

    await page.goto('./integrations/phonebook')
    await page.getByRole('button', { name: 'Open the menu of HR directory' }).click()
    await page.getByRole('menuitem', { name: 'Sync now' }).click()

    await expect(toasts(page).getByText('Cannot sync phonebook source')).toBeVisible()
    await expect(toasts(page).getByText('Invalid source id')).toBeVisible()
  })

  test('ends the syncing state when the sync status cannot be read again', async ({
    page,
    mockApi,
  }) => {
    mockApi.on('POST', '/freepbx/rest/phonebook/syncnow/:id', () => {
      mockApi.on('GET', '/freepbx/rest/phonebook/status', { status: 500, json: { status: false } })
      return { json: { status: true } }
    })

    await page.goto('./integrations/phonebook')
    await page.getByRole('button', { name: 'Open the menu of CRM contacts' }).click()
    await page.getByRole('menuitem', { name: 'Sync now' }).click()

    await expect(page.getByText('Cannot retrieve the sync status')).toBeVisible()
    await expect(syncing(page, 'CRM contacts')).toHaveCount(0)
    await expect(sourceRow(page, 'CRM contacts')).toContainText('Today at 10:00 AM')
    await page.getByRole('button', { name: 'Open the menu of CRM contacts' }).click()
    await expect(
      page
        .getByRole('menu', { name: 'Open the menu of CRM contacts' })
        .getByRole('menuitem', { name: 'Sync now' }),
    ).toBeEnabled()
  })

  test('polls the sync status while a sync is running', async ({ page }) => {
    state.statuses = [
      {
        id: 'custom_4',
        status: 'running',
        started_at: `${TODAY}T11:59:00Z`,
        finished_at: null,
        imported: null,
        message: null,
      },
    ]
    await page.clock.install()
    await page.goto('./integrations/phonebook')
    await expect(syncing(page, 'HR directory')).toBeVisible()

    state.statuses = [
      {
        id: 'custom_4',
        status: 'ok',
        started_at: `${TODAY}T11:59:00Z`,
        finished_at: `${TODAY}T12:00:00Z`,
        imported: 57,
        message: null,
      },
    ]
    await page.clock.runFor(5_000)

    await expect(sourceRow(page, 'HR directory')).toContainText('Today at 12:00 PM')
  })

  test('refreshes the sync status every minute while the tab is open', async ({
    page,
    mockApi,
  }) => {
    mockApi.allowUnmockedCalls()
    await page.clock.install()
    await page.goto('./integrations/phonebook')
    await expect(sourceRow(page, 'CRM contacts')).toContainText('Today at 10:00 AM')

    state.statuses = state.statuses.map((status) =>
      status.id === 'custom_1'
        ? { ...status, started_at: `${TODAY}T10:59:30Z`, finished_at: `${TODAY}T11:00:00Z` }
        : status,
    )
    await page.clock.runFor(30_000)
    await expect(sourceRow(page, 'CRM contacts')).toContainText('Today at 10:00 AM')
    await page.clock.runFor(30_000)
    await expect(sourceRow(page, 'CRM contacts')).toContainText('Today at 11:00 AM')

    await page.getByRole('link', { name: 'Video sources' }).click()
    await expect(page).toHaveURL(/\/integrations\/video-sources$/)
    const calls = mockApi.callsTo('GET', '/freepbx/rest/phonebook/status').length
    await page.clock.runFor(180_000)
    expect(mockApi.callsTo('GET', '/freepbx/rest/phonebook/status')).toHaveLength(calls)
  })

  test('shows the cause of a failed sync in a tooltip', async ({ page }) => {
    state.statuses = [
      ...state.statuses,
      {
        id: 'custom_4',
        status: 'failed',
        started_at: `${TODAY}T03:00:00Z`,
        finished_at: `${TODAY}T03:00:01Z`,
        imported: null,
        message: null,
      },
    ]

    await page.goto('./integrations/phonebook')
    const cause = sourceRow(page, 'ERP suppliers').getByRole('button', {
      name: 'Show the sync error of ERP suppliers',
    })

    await expect(cause.locator('svg')).toHaveAttribute('data-icon', 'circle-info')
    await expect(page.getByText('The database server does not answer')).toBeHidden()
    await cause.focus()
    await expect(page.getByText('The database server does not answer')).toBeVisible()
    await page.keyboard.press('Tab')
    await expect(page.getByText('The database server does not answer')).toBeHidden()

    await expect(sourceRow(page, 'HR directory')).toContainText('Failed today at 03:00 AM')
    await expect(
      sourceRow(page, 'HR directory').getByRole('button', { name: /sync error/ }),
    ).toHaveCount(0)
  })

  test('keeps the sources on screen and shows Updating while they load again', async ({
    page,
    mockApi,
  }) => {
    let release = () => {}
    let refreshes = 0
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })

    mockApi
      .on('GET', '/freepbx/rest/phonebook/config', async () => {
        refreshes += 1

        if (refreshes > 1) {
          await gate
        }
        return { json: state.sources }
      })
      .on('DELETE', '/freepbx/rest/phonebook/config/:id', () => {
        delete state.sources.custom_3
        return { status: 200 }
      })

    await page.goto('./integrations/phonebook')
    await expect(page.getByText('Updating…')).toHaveCount(0)
    await page.getByRole('button', { name: 'Open the menu of Partners' }).click()
    await page.getByRole('menuitem', { name: 'Delete' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click()

    const updating = page.getByRole('status').filter({ hasText: 'Updating…' })
    await expect(updating).toBeVisible()
    await expect(sourceRow(page, 'Partners')).toBeVisible()
    await expect(sourcesGrid(page).locator('.animate-pulse')).toHaveCount(0)

    release()
    await expect(sourceRow(page, 'Partners')).toHaveCount(0)
    await expect(updating).toHaveCount(0)
  })

  test('warns when the owners of the imports cannot be retrieved', async ({ page, mockApi }) => {
    mockApi.on('GET', '/freepbx/rest/users/false', { status: 500 })

    await page.goto('./integrations/phonebook')

    await expect(page.getByText('Cannot retrieve users')).toBeVisible()
    await expect(importsGrid(page).getByRole('row').nth(1).locator('td').nth(1)).toContainText(
      'lbianchi',
    )
  })

  test('deletes a source', async ({ page, mockApi }) => {
    mockApi.on('DELETE', '/freepbx/rest/phonebook/config/:id', () => {
      delete state.sources.custom_3
      return { status: 200 }
    })

    await page.goto('./integrations/phonebook')
    await page.getByRole('button', { name: 'Open the menu of Partners' }).click()
    await page.getByRole('menuitem', { name: 'Delete' }).click()

    const modal = page.getByRole('dialog')
    await expect(modal.getByRole('heading', { name: 'Delete phonebook source' })).toBeVisible()
    await expect(modal).toContainText(
      "Phonebook source Partners will be permanently deleted. Its contacts will be removed from the phonebook and users won't see them in NethVoice CTI anymore.",
    )
    await expect(modal.getByRole('textbox')).toHaveCount(0)
    await modal.getByRole('button', { name: 'Delete' }).click()

    await expect(modal).toBeHidden()
    expect(mockApi.callsTo('DELETE', '/freepbx/rest/phonebook/config/:id')[0].path).toBe(
      '/freepbx/rest/phonebook/config/custom_3',
    )
    await expect(toasts(page).getByText('Phonebook source deleted')).toBeVisible()
    await expect(sourceRow(page, 'Partners')).toHaveCount(0)
  })

  test('imports contacts in three steps and adds them to the history', async ({
    page,
    mockApi,
  }) => {
    mockApi
      .on('POST', '/freepbx/rest/phonebook/uploadfile', { json: { status: true, uri: UPLOADED } })
      .on('POST', '/freepbx/rest/phonebook/test', {
        json: [
          { Name: 'Anna Miller', Company: 'Example Ltd', Phone: '300', Birthday: '1990-01-01' },
          { Name: 'Christopher Davis', Company: '', Phone: '301', Birthday: '' },
          { Name: '', Company: 'Nameless Inc', Phone: '302', Birthday: '' },
        ],
      })
      .on('POST', '/freepbx/rest/phonebook/import-cti', () => {
        state.imports = [
          {
            id: 4,
            created_at: `${TODAY}T11:59:00Z`,
            owner: 'mrossi',
            filename: 'contacts.csv',
            type: 'public',
            total: 5,
            imported: 4,
            skipped: 1,
            failed: 0,
          },
          ...state.imports,
        ]
        return {
          json: {
            message: 'phonebook import completed',
            total_rows: 5,
            imported_rows: 4,
            failed_rows: 0,
            skipped_rows: 1,
          },
        }
      })

    await page.goto('./integrations/phonebook')
    await page.getByRole('button', { name: 'Import contacts' }).click()

    await expect(drawer(page).getByRole('heading', { name: 'Import contacts' })).toBeVisible()
    await expect(drawer(page).getByText('Step 1/3')).toBeVisible()
    await button(page, 'Next').click()
    await expect(drawer(page).getByText('Choose a file')).toBeVisible()

    await drawer(page)
      .locator('input[type=file]')
      .setInputFiles({
        name: 'contacts.csv',
        mimeType: 'text/csv',
        buffer: Buffer.from(CONTACTS_CSV),
      })
    await expect(drawer(page).getByText('Choose a file')).toHaveCount(0)
    await button(page, 'Next').click()

    await expect(drawer(page).getByText('Step 2/3')).toBeVisible()
    expect(mockApi.callsTo('POST', '/freepbx/rest/phonebook/test')[0].body).toEqual({
      dbtype: 'csv',
      url: UPLOADED,
      cti_import: true,
    })
    await expect(combobox(page, 'Name')).toHaveValue('Name')
    await expect(combobox(page, 'Company')).toHaveValue('Company')
    await expect(combobox(page, 'Phone')).toHaveValue('Work phone')
    await expect(drawer(page).getByText('First 3 of 5 rows.')).toBeVisible()
    await button(page, 'Next').click()
    await expect(drawer(page).getByText('Select a field')).toBeVisible()
    await combobox(page, 'Birthday').click()
    await expect(page.getByRole('option', { name: /^Owner ID/ })).toHaveCount(0)
    await page.getByRole('option', { name: 'Not imported' }).click()
    await button(page, 'Next').click()

    await expect(drawer(page).getByText('Step 3/3')).toBeVisible()
    await expect(drawer(page).getByRole('group', { name: 'Visibility and owner' })).toBeVisible()
    await expect(drawer(page).getByText('1 row will be skipped')).toBeVisible()
    await expect(
      drawer(page).getByText(
        'Rows without a name or not valid are skipped. The other 4 contacts will be imported.',
      ),
    ).toBeVisible()
    await button(page, 'Import').click()
    await expect(drawer(page).getByText('Select an owner')).toBeVisible()
    await expect(combobox(page, 'Owner')).toBeFocused()
    await combobox(page, 'Owner').click()
    await expect(page.getByRole('option', { name: /No Extension/ })).toHaveCount(0)
    await page.getByRole('option', { name: optionName('Mario Rossi (201)') }).click()
    await expect(combobox(page, 'Owner')).toHaveValue('Mario Rossi (201)')
    await expect(
      drawer(page).getByText('The user who can change the contacts in NethVoice CTI.'),
    ).toBeVisible()
    await button(page, 'Import').click()

    await expect(drawer(page)).toBeHidden()
    expect(mockApi.callsTo('POST', '/freepbx/rest/phonebook/import-cti')[0].body).toEqual({
      url: UPLOADED,
      owner: 'mrossi',
      type: 'public',
      mapping: { Name: 'name', Company: 'company', Phone: 'workphone' },
      filename: 'contacts.csv',
    })
    await expect(toasts(page).getByText('Contacts imported')).toBeVisible()
    await expect(
      toasts(page).getByText('4 contacts have been imported into the phonebook'),
    ).toBeVisible()
    const first = importsGrid(page).getByRole('row').nth(1)
    await expect(first.locator('td')).toContainText([
      TODAY_AT_11_59,
      'Mario Rossi (201)',
      'contacts.csv',
      '4 imported',
      'Everyone',
    ])
    await expect(first.getByRole('button', { name: '1 row skipped' })).toBeVisible()
    expect(mockApi.callsTo('DELETE', '/freepbx/rest/phonebook/uploadfile/:name')).toHaveLength(0)
  })

  test('deletes the uploaded file of an import that is cancelled', async ({ page, mockApi }) => {
    mockApi
      .on('POST', '/freepbx/rest/phonebook/uploadfile', { json: { status: true, uri: UPLOADED } })
      .on('POST', '/freepbx/rest/phonebook/test', { json: DB_ROWS })
      .on('DELETE', '/freepbx/rest/phonebook/uploadfile/:name', { json: { status: true } })

    await page.goto('./integrations/phonebook')
    await page.getByRole('button', { name: 'Import contacts' }).click()
    await drawer(page)
      .locator('input[type=file]')
      .setInputFiles({
        name: 'contacts.csv',
        mimeType: 'text/csv',
        buffer: Buffer.from(CONTACTS_CSV),
      })
    await button(page, 'Next').click()
    await expect(drawer(page).getByText('Step 2/3')).toBeVisible()
    await button(page, 'Cancel').click()
    await page.getByRole('button', { name: 'Discard changes' }).click()

    await expect(page.getByRole('button', { name: 'Discard changes' })).toHaveCount(0)
    await expect
      .poll(() => mockApi.callsTo('DELETE', '/freepbx/rest/phonebook/uploadfile/:name').length)
      .toBe(1)
    expect(mockApi.callsTo('DELETE', '/freepbx/rest/phonebook/uploadfile/:name')[0].path).toBe(
      '/freepbx/rest/phonebook/uploadfile/abc123.csv',
    )
  })

  test('explains the errors of a contact import', async ({ page, mockApi }) => {
    let failure: unknown = {
      status: false,
      error: { kind: 'file', details: 'Invalid byte sequence for encoding "UTF8"' },
    }

    mockApi
      .on('POST', '/freepbx/rest/phonebook/uploadfile', { json: { status: true, uri: UPLOADED } })
      .on('POST', '/freepbx/rest/phonebook/test', () => ({ json: failure }))
      .on('POST', '/freepbx/rest/phonebook/import-cti', {
        status: 400,
        json: { status: 'None of the selected sharing groups exist' },
      })

    await page.goto('./integrations/phonebook')
    await page.getByRole('button', { name: 'Import contacts' }).click()
    const input = drawer(page).locator('input[type=file]')

    await input.setInputFiles({
      name: 'contacts.xlsx',
      mimeType: 'application/octet-stream',
      buffer: Buffer.from('PK'),
    })
    await expect(drawer(page).getByText('Choose a .csv or .txt file')).toBeVisible()
    expect(mockApi.callsTo('POST', '/freepbx/rest/phonebook/uploadfile')).toHaveLength(0)

    await input.setInputFiles({
      name: 'contacts.xlsx.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('Name\n\xe0 C'),
    })
    await expect(drawer(page).getByText('Cannot read file')).toBeVisible()
    await expect(
      drawer(page).getByText(
        'The file is not a valid CSV file. Save it as CSV in UTF-8, with the column names in the first row.',
      ),
    ).toBeVisible()
    await button(page, 'Show details').click()
    await expect(drawer(page).getByText(/Invalid byte sequence/)).toBeVisible()
    await button(page, 'Next').click()
    await expect(drawer(page).getByText('Choose a valid CSV file')).toBeVisible()
    await expect(drawer(page).getByText('Step 1/3')).toBeVisible()

    failure = [{ Company: 'Example Ltd', Phone: '300' }]
    await input.setInputFiles({
      name: 'companies.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('Company,Phone\nExample Ltd,300\n'),
    })
    await expect(drawer(page).getByText('Cannot read file')).toHaveCount(0)
    await button(page, 'Next').click()
    await expect(combobox(page, 'Company')).toHaveValue('Company')
    await button(page, 'Next').click()

    await expect(drawer(page).getByText('No column for Name')).toBeVisible()
    await expect(
      drawer(page).getByText(
        'Contacts without a name cannot be imported. Choose Name, First name or Last name for the column with the names of the contacts.',
      ),
    ).toBeVisible()
    await expect(drawer(page).getByText('Step 2/3')).toBeVisible()
    await choose(page, 'Company', 'Last name')
    await expect(drawer(page).getByText('No column for Name')).toHaveCount(0)
    await button(page, 'Next').click()

    await drawer(page).getByRole('radio', { name: 'Selected groups' }).check()
    await chooseGroup(page, 'Sales')
    await choose(page, 'Owner', 'Laura Bianchi (202)')
    await button(page, 'Import').click()

    await expect(drawer(page).getByText('Cannot import contacts')).toBeVisible()
    await expect(drawer(page).getByText('None of the selected sharing groups exist')).toBeVisible()
    expect(mockApi.callsTo('POST', '/freepbx/rest/phonebook/import-cti')[0].body).toMatchObject({
      type: 'group:Sales',
      owner: 'lbianchi',
      mapping: { Company: 'lastname', Phone: 'workphone' },
      filename: 'companies.csv',
    })
  })

  test('shows the rows skipped by an import in a tooltip', async ({ page }) => {
    await page.goto('./integrations/phonebook')
    const info = importsGrid(page).getByRole('button', { name: '7 rows skipped' })

    await expect(importsGrid(page).getByRole('button')).toHaveCount(1)
    await info.focus()
    await expect(
      page.getByText("7 rows have been skipped because they have no name or aren't valid"),
    ).toBeVisible()
    await expect(info.locator('svg')).toHaveAttribute('data-icon', 'circle-info')
  })

  test('creates a source with the keyboard only', async ({ page, mockApi }) => {
    mockApi
      .on('POST', '/freepbx/rest/phonebook/test', { json: { rows: DB_ROWS.slice(0, 1), total: 1 } })
      .on('POST', '/freepbx/rest/phonebook/config', { json: { id: 'custom_6' } })
      .on('POST', '/freepbx/rest/phonebook/syncnow/:id', { json: { status: true } })

    await page.goto('./integrations/phonebook')
    const create = page.getByRole('button', { name: 'Create phonebook source' })
    await create.focus()
    await page.keyboard.press('Enter')

    await expect(field(page, 'Name')).toBeFocused()
    await page.keyboard.type('Keyboard source')
    await field(page, 'Database name').focus()
    await page.keyboard.type('crm')
    await page.keyboard.press('Tab')
    await expect(field(page, 'Address')).toBeFocused()
    await page.keyboard.type('crm-db.example.com')
    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')
    await expect(field(page, 'Username')).toBeFocused()
    await page.keyboard.type('nethvoice')
    await page.keyboard.press('Tab')
    await page.keyboard.type('db-secret')
    await field(page, 'Query').fill('SELECT * FROM contacts')
    await field(page, 'Address').focus()
    await page.keyboard.press('Enter')

    await expect(drawer(page).getByText('Step 2/3')).toBeVisible()
    await expect(combobox(page, 'contact_name')).toBeFocused()
    await combobox(page, 'vat_number').focus()
    await page.keyboard.type('Not imp')
    await expect(page.getByRole('option')).toHaveText(['Not imported'])
    await page.keyboard.press('ArrowDown')
    await expect(page.getByRole('option', { name: 'Not imported' })).toHaveAttribute(
      'data-headlessui-state',
      /active/,
    )
    await page.keyboard.press('Enter')
    await expect(combobox(page, 'vat_number')).toHaveValue('Not imported')
    await button(page, 'Next').focus()
    await page.keyboard.press('Enter')

    await expect(drawer(page).getByText('Step 3/3')).toBeVisible()
    await button(page, 'Create').focus()
    await expect(button(page, 'Create')).not.toHaveCSS('box-shadow', 'none')
    await page.keyboard.press('Enter')

    await expect(drawer(page)).toBeHidden()
    expect(mockApi.callsTo('POST', '/freepbx/rest/phonebook/config')[0].body).toMatchObject({
      type: 'Keyboard source',
      host: 'crm-db.example.com',
    })
    await expect(create).toBeFocused()
  })

  test('shows the rows as cards on a phone without horizontal scroll', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('./integrations/phonebook')

    const firstRow = sourcesGrid(page).getByRole('row').nth(0)
    await expect(firstRow).toContainText('Name')
    await expect(firstRow).toContainText('CRM contacts')
    await expect(firstRow).toContainText('Last sync')
    await expect(importsGrid(page).getByRole('row').nth(0)).toContainText('Owner')
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)

    await page.getByRole('button', { name: 'Edit CRM contacts' }).click()
    await expect(field(page, 'Name')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  })

  test('uses the semantic text tokens in dark and light theme', async ({ page }) => {
    await page.goto('./integrations/phonebook')
    const description = page.getByText(SOURCES_DESCRIPTION)

    await expect(page.locator('html')).toHaveClass(/\bdark\b/)
    await expect(description).toHaveCSS('color', 'oklch(0.707 0.022 261.325)')

    await page.getByRole('button', { name: 'Open account menu' }).click()
    await page.getByRole('menuitem', { name: 'Switch to light theme' }).click()
    await expect(page.locator('html')).not.toHaveClass(/\bdark\b/)
    await expect(description).toHaveCSS('color', 'oklch(0.446 0.03 256.802)')
  })

  test('does not offer to edit a database source on the PBX to an administrator with only Integrations', async ({
    page,
    mockApi,
  }) => {
    state.sources.custom_6 = {
      dbtype: 'mysql',
      host: '127.0.0.1',
      port: '3306',
      user: 'pbx_reader',
      has_password: true,
      dbname: 'contacts',
      query: 'SELECT * FROM contacts',
      mapping: { name: 'name' },
      interval: 60,
      type: 'PBX contacts',
      access: 'public',
      enabled: true,
    }
    await page.goto('./integrations/phonebook')
    await expect(page.getByRole('button', { name: 'Edit PBX contacts' })).toBeVisible()

    mockPermissions(mockApi, ['integrations'], 'integrator')
    await page.reload()
    await expect(sourceRow(page, 'PBX contacts')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Edit PBX contacts' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Edit CRM contacts' })).toBeVisible()
    await page.getByRole('button', { name: 'Open the menu of PBX contacts' }).click()
    await expect(page.getByRole('menu').getByRole('menuitem')).toHaveText(['Sync now', 'Delete'])
  })

  test('works for an administrator with only the Integrations section', async ({
    page,
    mockApi,
  }) => {
    mockPermissions(mockApi, ['integrations'], 'integrator')
    mockApi
      .on('POST', '/freepbx/rest/phonebook/test', (request) =>
        (request.body as { host?: string }).host === '127.0.0.1'
          ? { status: 403, json: { message: 'Forbidden: missing permission' } }
          : { json: { rows: DB_ROWS, total: 3 } },
      )
      .on('POST', '/freepbx/rest/phonebook/config/:id', { json: { id: 'custom_1' } })
      .on('POST', '/freepbx/rest/phonebook/syncnow/:id', { json: { status: true } })

    await page.goto('./integrations/phonebook')
    await expect(sourcesGrid(page).getByRole('row')).toHaveCount(6)
    await expect(importsGrid(page).getByRole('row')).toHaveCount(4)
    await expect(page.getByRole('button', { name: 'Import contacts' })).toBeEnabled()

    await page.getByRole('button', { name: 'Create phonebook source' }).click()
    await fillDatabaseStep(page)
    await field(page, 'Address').fill('127.0.0.1')
    await button(page, 'Next').click()
    await expect(drawer(page).getByText('Enter a server other than the PBX')).toBeVisible()
    await expect(field(page, 'Address')).toBeFocused()
    await expect(drawer(page).getByText('Step 1/3')).toBeVisible()
    await button(page, 'Cancel').click()
    await page.getByRole('button', { name: 'Discard changes' }).click()

    await page.getByRole('button', { name: 'Edit CRM contacts' }).click()
    await expect(drawer(page).getByText('Leave empty to keep the current password.')).toBeVisible()
    await field(page, 'Query').fill('SELECT * FROM other')
    await expect(
      drawer(page).getByText(
        'Enter the password again to change the database, the user or the query.',
      ),
    ).toBeVisible()
    await button(page, 'Save').click()
    await expect(drawer(page).getByText('Enter the password', { exact: true })).toBeVisible()
    expect(mockApi.callsTo('POST', '/freepbx/rest/phonebook/test')).toHaveLength(1)

    await drawer(page).getByLabel('Password', { exact: true }).fill('crm-secret')
    await button(page, 'Save').click()
    await expect(combobox(page, 'company_name')).toHaveValue('Not imported')
    await button(page, 'Save').click()
    await expect(drawer(page)).toBeHidden()
    expect(mockApi.callsTo('POST', '/freepbx/rest/phonebook/config/:id')[0].body).toMatchObject({
      password: 'crm-secret',
      query: 'SELECT * FROM other',
    })

    await page.getByRole('button', { name: 'Open the menu of CRM contacts' }).click()
    await page.getByRole('menuitem', { name: 'Sync now' }).click()
    await expect(sourceRow(page, 'CRM contacts')).toContainText('Today at 10:00 AM')
    expect(mockApi.callsTo('POST', '/freepbx/rest/phonebook/syncnow/:id')).toHaveLength(1)
  })
})
