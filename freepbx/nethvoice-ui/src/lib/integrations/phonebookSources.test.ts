//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest'
import {
  buildAccess,
  buildPhonebookSourcePayload,
  buildPhonebookTestPayload,
  completeMapping,
  emptyPhonebookSourceForm,
  getAvailableFields,
  getConnectionSignature,
  getFormSnapshot,
  getUploadedCsvName,
  getInfinityPreviewColumns,
  getLastSyncDisplay,
  getMappingColumns,
  getReadErrorTexts,
  hasAnyNameColumn,
  hasNameColumn,
  isCsvUploadRejected,
  isLocalHostRefusal,
  isNameTaken,
  isPbxDatabaseSource,
  isUploadedCsv,
  NOT_IMPORTED,
  orderPhonebookFields,
  parsePhonebookSources,
  parsePhonebookSyncStatuses,
  parsePhonebookTestResult,
  parseSharingGroups,
  PHONEBOOK_FIELD_ORDER,
  suggestMapping,
  type PhonebookSource,
  type PhonebookSourceForm,
  type PhonebookSyncStatus,
  toPhonebookSourceForm,
  validateCsvFile,
  validatePhonebookMapping,
  validatePhonebookSourceFields,
  validatePhonebookVisibility,
} from './phonebookSources'
import { ApiError } from '@/lib/api/errors'
import en from '@/i18n/en/translation.json'

const rawSources = {
  custom_2: {
    dbtype: 'csv',
    url: 'https://files.example.com/contacts.csv',
    mapping: { Name: 'name', Phone: 'workphone' },
    interval: '60',
    type: 'Suppliers',
    access: 'group:Sales,Marketing',
    enabled: false,
  },
  custom_1: {
    dbtype: 'mysql',
    host: 'crm.example.com',
    port: 3306,
    user: 'reader',
    password: 'stored-password',
    has_password: true,
    dbname: 'crm',
    query: 'SELECT * FROM contacts',
    mapping: { full_name: 'name' },
    interval: 1440,
    type: 'CRM contacts',
    access: 'public',
    enabled: true,
  },
}

const crmSource = (): PhonebookSource => parsePhonebookSources(rawSources)[0]

const databaseForm = (changes: Partial<PhonebookSourceForm> = {}): PhonebookSourceForm => ({
  ...emptyPhonebookSourceForm(),
  name: 'CRM contacts',
  host: 'crm.example.com',
  user: 'reader',
  password: 'new-password',
  database: 'crm',
  query: 'SELECT * FROM contacts',
  mapping: { full_name: 'name', unused: NOT_IMPORTED },
  ...changes,
})

describe('parsePhonebookSources', () => {
  it('should return no sources for the empty array the API sends', () => {
    expect(parsePhonebookSources([])).toEqual([])
  })

  it('should normalize the sources and sort them by name', () => {
    expect(parsePhonebookSources(rawSources)).toEqual([
      {
        id: 'custom_1',
        name: 'CRM contacts',
        kind: 'mysql',
        host: 'crm.example.com',
        port: '3306',
        user: 'reader',
        hasPassword: true,
        database: 'crm',
        query: 'SELECT * FROM contacts',
        url: '',
        username: '',
        mapping: { full_name: 'name' },
        interval: 1440,
        groups: [],
        enabled: true,
      },
      {
        id: 'custom_2',
        name: 'Suppliers',
        kind: 'csv',
        host: '',
        port: '',
        user: '',
        hasPassword: false,
        database: '',
        query: '',
        url: 'https://files.example.com/contacts.csv',
        username: '',
        mapping: { Name: 'name', Phone: 'workphone' },
        interval: 60,
        groups: ['Sales', 'Marketing'],
        enabled: false,
      },
    ])
  })

  it('should fall back to the database name, then to the id, for unnamed sources', () => {
    const sources = parsePhonebookSources({
      custom_3: { dbtype: 'mysql', dbname: 'legacy' },
      custom_4: { dbtype: 'ldap', mapping: [] },
    })

    expect(sources.map((source) => [source.name, source.kind, source.interval])).toEqual([
      ['custom_4', 'unknown', 1440],
      ['legacy', 'mysql', 1440],
    ])
  })

  it('should reject an unexpected shape', () => {
    expect(() => parsePhonebookSources({ custom_1: 'mysql' })).toThrow()
  })

  it('should never keep a password returned by the server', () => {
    expect(JSON.stringify(parsePhonebookSources(rawSources))).not.toContain('stored-password')
  })

  it('should read the stored password flag of a redacted source', () => {
    const [source] = parsePhonebookSources({ custom_5: { dbtype: 'mysql', has_password: true } })

    expect(source?.hasPassword).toBe(true)
  })
})

describe('sharing', () => {
  it('should read the groups of a restricted source', () => {
    expect(parseSharingGroups('group:Sales, Marketing,')).toEqual(['Sales', 'Marketing'])
    expect(parseSharingGroups('public')).toEqual([])
    expect(parseSharingGroups('')).toEqual([])
  })

  it('should build the access value', () => {
    expect(buildAccess(['Sales', 'Marketing'])).toBe('group:Sales,Marketing')
    expect(buildAccess([])).toBe('public')
  })
})

describe('isPbxDatabaseSource', () => {
  it('should flag only the database sources on the PBX server', () => {
    expect(isPbxDatabaseSource({ kind: 'mysql', host: 'localhost' })).toBe(true)
    expect(isPbxDatabaseSource({ kind: 'mssql', host: ' 127.0.0.1 ' })).toBe(true)
    expect(isPbxDatabaseSource({ kind: 'mysql', host: '' })).toBe(true)
    expect(isPbxDatabaseSource({ kind: 'mysql', host: 'crm-db.example.com' })).toBe(false)
    expect(isPbxDatabaseSource({ kind: 'csv', host: '' })).toBe(false)
    expect(isPbxDatabaseSource({ kind: 'infinity', host: '' })).toBe(false)
  })
})

describe('parsePhonebookTestResult', () => {
  it('should return rows and columns of a readable source', () => {
    expect(
      parsePhonebookTestResult([
        { full_name: 'Anna Miller', phone: 300, note: null },
        { full_name: 'Christopher Davis', phone: 301, note: 'vip' },
      ]),
    ).toEqual({
      ok: true,
      columns: ['full_name', 'phone', 'note'],
      rows: [
        { full_name: 'Anna Miller', phone: '300', note: '' },
        { full_name: 'Christopher Davis', phone: '301', note: 'vip' },
      ],
    })
  })

  it('should read the total of the rows when the server sends it', () => {
    expect(parsePhonebookTestResult({ rows: [{ full_name: 'Anna Miller' }], total: 1248 })).toEqual(
      { ok: true, columns: ['full_name'], rows: [{ full_name: 'Anna Miller' }], total: 1248 },
    )
  })

  it('should keep the columns of a database source without rows', () => {
    expect(parsePhonebookTestResult({ rows: [{ full_name: '', phone: '' }], total: 0 })).toEqual({
      ok: true,
      columns: ['full_name', 'phone'],
      rows: [],
      total: 0,
    })
  })

  it('should accept a source without rows', () => {
    expect(parsePhonebookTestResult([])).toEqual({ ok: true, rows: [], columns: [] })
  })

  it('should report a failed read with its cause', () => {
    expect(
      parsePhonebookTestResult({
        status: false,
        error: { kind: 'auth', details: " Access denied for user 'reader' " },
      }),
    ).toEqual({ ok: false, kind: 'auth', details: "Access denied for user 'reader'" })
  })

  it('should report a failed read without a cause as unknown', () => {
    expect(parsePhonebookTestResult({ status: false })).toEqual({
      ok: false,
      kind: 'unknown',
      details: '',
    })
    expect(
      parsePhonebookTestResult({ status: false, error: { kind: 'disk', details: 'x' } }),
    ).toEqual({ ok: false, kind: 'unknown', details: 'x' })
    expect(parsePhonebookTestResult('oops')).toEqual({ ok: false, kind: 'unknown', details: '' })
  })
})

describe('getReadErrorTexts', () => {
  const texts = (
    kind: Parameters<typeof getReadErrorTexts>[0],
    source: 'mysql' | 'csv' | 'infinity',
  ) => Object.values(getReadErrorTexts(kind, source)).map((key) => key.split('.').at(-1))

  it('should name the database for connection and credential errors', () => {
    expect(texts('connection', 'mysql')).toEqual([
      'cannot_connect_database',
      'read_error_connection_database',
    ])
    expect(texts('auth', 'mysql')).toEqual(['cannot_connect_database', 'read_error_auth'])
  })

  it('should name Infinity Zucchetti for its connection errors', () => {
    expect(texts('connection', 'infinity')).toEqual([
      'cannot_connect_infinity',
      'read_error_connection_infinity',
    ])
    expect(texts('auth', 'infinity')).toEqual(['cannot_connect_infinity', 'read_error_auth'])
    expect(texts('http', 'infinity')).toEqual(['cannot_connect_infinity', 'read_error_http'])
  })

  it('should describe query, file and unknown errors', () => {
    expect(texts('query', 'mysql')).toEqual(['cannot_run_query', 'read_error_query'])
    expect(texts('file', 'csv')).toEqual(['cannot_read_file', 'read_error_file'])
    expect(texts('format', 'csv')).toEqual(['cannot_read_file', 'read_error_file'])
    expect(texts('http', 'csv')).toEqual(['cannot_download_file', 'read_error_http'])
    expect(texts('connection', 'csv')).toEqual([
      'cannot_download_file',
      'read_error_csv_connection',
    ])
    expect(texts('format', 'mysql')).toEqual(['cannot_read_source', 'read_error_format'])
    expect(texts('unknown', 'mysql')).toEqual(['cannot_read_source', 'read_error_unknown'])
  })
})

describe('getUploadedCsvName', () => {
  it('should return the name of an uploaded file only', () => {
    expect(
      getUploadedCsvName('file:///var/lib/nethvoice/phonebook/uploads/6b04076a92b81.csv'),
    ).toBe('6b04076a92b81.csv')
    expect(getUploadedCsvName('https://example.com/contacts.csv')).toBeUndefined()
    expect(
      getUploadedCsvName('file:///var/lib/nethvoice/phonebook/uploads/../a.csv'),
    ).toBeUndefined()
    expect(getUploadedCsvName('file:///etc/passwd')).toBeUndefined()
  })
})

describe('getFormSnapshot', () => {
  it('should ignore the columns that are not imported', () => {
    const form = { ...emptyPhonebookSourceForm(), mapping: { full_name: 'name' } }

    expect(
      getFormSnapshot({ ...form, mapping: { full_name: 'name', vat: NOT_IMPORTED } }, ''),
    ).toBe(getFormSnapshot(form, ''))
    expect(getFormSnapshot({ ...form, mapping: { full_name: NOT_IMPORTED } }, '')).not.toBe(
      getFormSnapshot(form, ''),
    )
    expect(getFormSnapshot(form, 'file-1')).not.toBe(getFormSnapshot(form, ''))
  })
})

describe('mapping helpers', () => {
  it('should hide the sharing column', () => {
    expect(getMappingColumns(['full_name', 'type', 'phone'])).toEqual(['full_name', 'phone'])
  })

  it('should preview only the phonebook fields of Infinity Zucchetti, in the mapping order', () => {
    expect(
      getInfinityPreviewColumns([
        {
          name: 'Francesca Leone',
          cellphone: '335 0000001',
          type: 'Infinity contacts',
          access: 'public',
          sid_imported: 'phonebook_test_1',
        },
        { company: 'Acme Ltd', workphone: '0721 0000002', notes: 'Infinity ID: 7' },
      ]),
    ).toEqual(['name', 'company', 'cellphone', 'workphone', 'notes'])
  })

  it('should offer only the fields not used by other columns, in a readable order', () => {
    const fields = ['workphone', 'owner_id', 'name']
    const mapping = { full_name: 'name', phone: 'workphone' }

    expect(getAvailableFields(fields, mapping, 'phone', true)).toEqual(['workphone', 'owner_id'])
    expect(getAvailableFields(fields, mapping, 'other', false)).toEqual([])
  })

  it('should order the 34 phonebook fields and keep unknown ones last', () => {
    expect(PHONEBOOK_FIELD_ORDER).toHaveLength(34)
    expect(orderPhonebookFields(['zeta', 'company', 'name', 'firstname'])).toEqual([
      'name',
      'firstname',
      'company',
      'zeta',
    ])
  })

  it('should mark the columns without a choice as not imported', () => {
    expect(completeMapping(['a', 'b', 'type'], { a: 'name' })).toEqual({
      a: 'name',
      b: NOT_IMPORTED,
    })
  })

  it('should require a choice for every column', () => {
    expect(
      validatePhonebookMapping(['a', 'b', 'c', 'type'], { a: 'name', b: NOT_IMPORTED, c: '' }),
    ).toEqual({ c: 'integrations.phonebook.field_required' })
  })

  it('should tell whether a column holds the names', () => {
    expect(hasNameColumn({ a: 'name' })).toBe(true)
    expect(hasNameColumn({ a: 'firstname' })).toBe(false)
    expect(hasAnyNameColumn({ a: 'lastname', b: NOT_IMPORTED })).toBe(true)
    expect(hasAnyNameColumn({ a: 'company' })).toBe(false)
  })

  it('should recognize an uploaded CSV file', () => {
    expect(isUploadedCsv('file:///var/lib/nethvoice/phonebook/uploads/abc.csv')).toBe(true)
    expect(isUploadedCsv('https://files.example.com/contacts.csv')).toBe(false)
  })
})

describe('suggestMapping', () => {
  const fields = PHONEBOOK_FIELD_ORDER

  it('should map the columns named like a phonebook field or a known synonym', () => {
    expect(
      suggestMapping(
        [
          'contact_name',
          'company_name',
          'phone',
          'mobile',
          'email',
          'city',
          'vat_number',
          'notes',
          'type',
        ],
        fields,
        {},
        true,
      ),
    ).toEqual({
      contact_name: 'name',
      company_name: 'company',
      phone: 'workphone',
      mobile: 'cellphone',
      email: 'workemail',
      city: 'workcity',
      notes: 'notes',
    })
  })

  it('should match Italian names regardless of case and accents', () => {
    expect(
      suggestMapping(
        ['RagioneSociale', 'Referente', 'Telefono', 'Cellulare', 'Città', 'Azienda', 'Nome'],
        fields,
        {},
        true,
      ),
    ).toEqual({
      RagioneSociale: 'company',
      Referente: 'name',
      Telefono: 'workphone',
      Cellulare: 'cellphone',
      Città: 'workcity',
    })
  })

  it('should give a field to the first matching column only', () => {
    expect(suggestMapping(['name', 'nome', 'Name'], fields, {}, true)).toEqual({ name: 'name' })
  })

  it('should keep the choices already made and drop the columns that are gone', () => {
    expect(
      suggestMapping(
        ['name', 'company'],
        fields,
        { name: NOT_IMPORTED, other: 'company', gone: 'fax' },
        true,
      ),
    ).toEqual({ name: NOT_IMPORTED, company: 'company' })
  })

  it('should leave out the owner field when the source cannot fill it', () => {
    expect(suggestMapping(['owner_id'], fields, {}, false)).toEqual({})
    expect(suggestMapping(['owner_id'], fields, {}, true)).toEqual({ owner_id: 'owner_id' })
  })
})

describe('toPhonebookSourceForm', () => {
  it('should never copy the stored password into the form', () => {
    const form = toPhonebookSourceForm(crmSource())

    expect(form.password).toBe('')
    expect(form).toMatchObject({
      kind: 'mysql',
      name: 'CRM contacts',
      sharing: 'public',
      interval: 1440,
    })
  })

  it('should select group sharing for a restricted source', () => {
    expect(toPhonebookSourceForm(parsePhonebookSources(rawSources)[1])).toMatchObject({
      sharing: 'groups',
      groups: ['Sales', 'Marketing'],
      csvFrom: 'url',
      url: 'https://files.example.com/contacts.csv',
    })
  })

  it('should open an uploaded CSV file as an upload', () => {
    const [source] = parsePhonebookSources({
      custom_7: { dbtype: 'csv', url: 'file:///var/lib/nethvoice/phonebook/uploads/abc.csv' },
    })

    expect(toPhonebookSourceForm(source!)).toMatchObject({
      csvFrom: 'upload',
      url: '',
      uploadedUrl: 'file:///var/lib/nethvoice/phonebook/uploads/abc.csv',
    })
  })
})

describe('emptyPhonebookSourceForm', () => {
  it('should prefill the query and leave the port and the interval out', () => {
    const form = emptyPhonebookSourceForm()

    expect(form.query).toBe('SELECT * FROM [table]')
    expect(form.port).toBe('')
    expect(form).not.toHaveProperty('interval')
  })
})

describe('validatePhonebookSourceFields', () => {
  it('should accept a complete database source with an empty port', () => {
    expect(validatePhonebookSourceFields(databaseForm({ port: '' }))).toEqual({})
  })

  it('should require the connection fields of a database source', () => {
    expect(
      validatePhonebookSourceFields(
        databaseForm({
          name: '',
          host: '',
          port: 'abc',
          database: '',
          user: '',
          password: '',
          query: '',
        }),
      ),
    ).toEqual({
      name: 'integrations.phonebook.name_required',
      database: 'integrations.cards.database_name_required',
      host: 'integrations.cards.database_address_required',
      port: 'integrations.port_invalid',
      user: 'integrations.cards.database_username_required',
      password: 'integrations.password_required',
      query: 'integrations.query_required',
    })
  })

  it('should refuse ports out of range', () => {
    expect(validatePhonebookSourceFields(databaseForm({ port: '0' }))).toEqual({
      port: 'integrations.port_invalid',
    })
    expect(validatePhonebookSourceFields(databaseForm({ port: '65536' }))).toEqual({
      port: 'integrations.port_invalid',
    })
    expect(validatePhonebookSourceFields(databaseForm({ port: '65535' }))).toEqual({})
  })

  it('should ask to replace the table placeholder of the query', () => {
    expect(validatePhonebookSourceFields(databaseForm({ query: 'SELECT * FROM [table]' }))).toEqual(
      { query: 'integrations.phonebook.query_table' },
    )
  })

  it('should refuse the name of an MS SQL Server instance in the address', () => {
    expect(
      validatePhonebookSourceFields(databaseForm({ kind: 'mssql', host: 'erp-db\\SQLEXPRESS' })),
    ).toEqual({ host: 'integrations.phonebook.mssql_instance' })
    expect(
      validatePhonebookSourceFields(databaseForm({ kind: 'mysql', host: 'erp-db\\SQLEXPRESS' })),
    ).toEqual({})
  })

  it('should refuse a name already used by another source, ignoring case', () => {
    expect(
      validatePhonebookSourceFields(databaseForm({ name: ' crm CONTACTS ' }), {
        otherNames: ['CRM contacts', 'Suppliers'],
      }),
    ).toEqual({ name: 'integrations.phonebook.name_taken' })
    expect(isNameTaken('Partners', ['CRM contacts'])).toBe(false)
    expect(isNameTaken('', [''])).toBe(false)
  })

  it('should not require the password again when a stored one exists', () => {
    expect(
      validatePhonebookSourceFields(databaseForm({ password: '' }), { existing: crmSource() }),
    ).toEqual({})
    expect(
      validatePhonebookSourceFields(databaseForm({ password: '', port: '' }), {
        existing: crmSource(),
      }),
    ).toEqual({})
  })

  it('should require the password again for a different server', () => {
    const required = { password: 'integrations.password_required' }
    const edited = (changes: Partial<PhonebookSourceForm>) =>
      validatePhonebookSourceFields(databaseForm({ password: '', ...changes }), {
        existing: crmSource(),
      })

    expect(edited({ host: 'other.example.com' })).toEqual(required)
    expect(edited({ port: '3307' })).toEqual(required)
    expect(edited({ kind: 'mssql' })).toEqual(required)
    expect(edited({ user: 'writer', database: 'crm2' })).toEqual({})
  })

  it('should require the password again for another query when the query must stay with it', () => {
    const required = { password: 'integrations.password_required' }
    const edited = (changes: Partial<PhonebookSourceForm>) =>
      validatePhonebookSourceFields(databaseForm({ password: '', ...changes }), {
        existing: crmSource(),
        sameQuery: true,
      })

    expect(edited({})).toEqual({})
    expect(edited({ name: 'Renamed', enabled: false })).toEqual({})
    expect(edited({ query: 'SELECT * FROM other' })).toEqual(required)
    expect(edited({ database: 'crm2' })).toEqual(required)
    expect(edited({ user: 'writer' })).toEqual(required)
    expect(edited({ host: 'other.example.com' })).toEqual(required)
    expect(
      validatePhonebookSourceFields(
        databaseForm({ password: 'typed', query: 'SELECT * FROM other' }),
        { existing: crmSource(), sameQuery: true },
      ),
    ).toEqual({})
  })

  it('should read a refused database source as a host on the PBX', () => {
    const refused = new ApiError({
      status: 403,
      method: 'POST',
      url: '/phonebook/config',
      body: {},
    })
    const failed = new ApiError({ status: 500, method: 'POST', url: '/phonebook/config', body: {} })

    expect(isLocalHostRefusal(refused, databaseForm())).toBe(true)
    expect(isLocalHostRefusal(refused, databaseForm({ kind: 'mssql' }))).toBe(true)
    expect(isLocalHostRefusal(refused, databaseForm({ kind: 'csv' }))).toBe(false)
    expect(isLocalHostRefusal(failed, databaseForm())).toBe(false)
    expect(isLocalHostRefusal(new Error('x'), databaseForm())).toBe(false)
  })

  it('should require the password again for a different Infinity address', () => {
    const [infinity] = parsePhonebookSources({
      custom_6: {
        dbtype: 'infinity',
        url: 'https://infinity.example.com/api',
        username: 'api',
        has_password: true,
      },
    })
    const form = { ...toPhonebookSourceForm(infinity!), name: 'Infinity' }

    expect(validatePhonebookSourceFields(form, { existing: infinity })).toEqual({})
    expect(
      validatePhonebookSourceFields(
        { ...form, url: 'https://other.example.com/api' },
        { existing: infinity },
      ),
    ).toEqual({ password: 'integrations.password_required' })
  })

  it('should validate the Infinity fields', () => {
    expect(
      validatePhonebookSourceFields(
        databaseForm({ kind: 'infinity', url: 'infinity.example.com', username: '' }),
      ),
    ).toEqual({
      url: 'integrations.url_invalid',
      username: 'integrations.phonebook.username_required',
    })
  })

  it('should accept only http and https addresses for a CSV file to download', () => {
    const csv = (url: string) => validatePhonebookSourceFields(databaseForm({ kind: 'csv', url }))

    expect(csv('https://files.example.com/contacts.csv')).toEqual({})
    expect(csv('http://files.example.com/contacts.csv')).toEqual({})
    expect(csv('file:///srv/contacts.csv')).toEqual({ url: 'integrations.url_invalid' })
    expect(csv('contacts.csv')).toEqual({ url: 'integrations.url_invalid' })
    expect(csv('')).toEqual({ url: 'integrations.url_required' })
  })

  it('should keep the stored local address of an existing CSV source', () => {
    const [source] = parsePhonebookSources({
      custom_8: { dbtype: 'csv', url: 'file:///srv/contacts.csv', type: 'Local' },
    })
    const form = toPhonebookSourceForm(source!)

    expect(validatePhonebookSourceFields(form, { existing: source })).toEqual({})
    expect(
      validatePhonebookSourceFields(
        { ...form, url: 'file:///srv/other.csv' },
        { existing: source },
      ),
    ).toEqual({ url: 'integrations.url_invalid' })
  })

  it('should ask a file to upload unless one is already stored', () => {
    const upload = databaseForm({ kind: 'csv', csvFrom: 'upload' })

    expect(validatePhonebookSourceFields(upload)).toEqual({
      file: 'integrations.phonebook.file_required',
    })
    expect(validatePhonebookSourceFields(upload, { hasFile: true })).toEqual({})
    expect(
      validatePhonebookSourceFields({
        ...upload,
        uploadedUrl: 'file:///var/lib/nethvoice/phonebook/uploads/abc.csv',
      }),
    ).toEqual({})
  })
})

describe('validatePhonebookVisibility', () => {
  it('should require a group when the source is visible to selected groups', () => {
    expect(validatePhonebookVisibility({ sharing: 'groups', groups: [] })).toEqual({
      groups: 'integrations.phonebook.groups_required',
    })
    expect(validatePhonebookVisibility({ sharing: 'groups', groups: ['Sales'] })).toEqual({})
    expect(validatePhonebookVisibility({ sharing: 'public', groups: [] })).toEqual({})
  })
})

describe('getConnectionSignature', () => {
  it('should change only with the connection fields', () => {
    const base = getConnectionSignature(databaseForm())

    expect(getConnectionSignature(databaseForm({ name: 'Other', enabled: false }))).toBe(base)
    expect(getConnectionSignature(databaseForm({ password: 'other' }))).not.toBe(base)
    expect(getConnectionSignature(databaseForm({ query: 'SELECT 1' }))).not.toBe(base)
  })

  it('should follow the chosen file of an upload', () => {
    const upload = databaseForm({ kind: 'csv', csvFrom: 'upload' })

    expect(getConnectionSignature(upload, 'a.csv|1|1')).not.toBe(
      getConnectionSignature(upload, 'b.csv|1|1'),
    )
    expect(getConnectionSignature({ ...upload, url: 'https://x' }, 'a')).toBe(
      getConnectionSignature(upload, 'a'),
    )
  })
})

describe('payloads', () => {
  it('should build the body of a new database source with the default port and no interval', () => {
    expect(
      buildPhonebookSourcePayload(
        databaseForm({
          name: ' CRM contacts ',
          port: '',
          sharing: 'groups',
          groups: ['Sales'],
        }),
      ),
    ).toEqual({
      dbtype: 'mysql',
      host: 'crm.example.com',
      port: '3306',
      user: 'reader',
      password: 'new-password',
      dbname: 'crm',
      query: 'SELECT * FROM contacts',
      mapping: { full_name: 'name' },
      type: 'CRM contacts',
      access: 'group:Sales',
      enabled: true,
    })
    expect(buildPhonebookSourcePayload(databaseForm({ kind: 'mssql' })).port).toBe('1433')
  })

  it('should send back the stored interval of an edited source', () => {
    expect(
      buildPhonebookSourcePayload({ ...toPhonebookSourceForm(crmSource()), password: '' }),
    ).toMatchObject({ interval: 1440, port: '3306' })
    expect(buildPhonebookSourcePayload(databaseForm({ interval: 60 })).interval).toBe(60)
  })

  it('should omit an unchanged password so the server keeps the stored one', () => {
    expect(buildPhonebookSourcePayload(databaseForm({ password: '' }))).not.toHaveProperty(
      'password',
    )
  })

  it('should ignore selected groups when the source is visible to everyone', () => {
    expect(buildPhonebookSourcePayload(databaseForm({ groups: ['Sales'] })).access).toBe('public')
  })

  it('should build the body of a CSV source to download', () => {
    expect(
      buildPhonebookSourcePayload(
        databaseForm({
          kind: 'csv',
          url: ' https://files.example.com/contacts.csv ',
          mapping: { Name: 'name', Phone: NOT_IMPORTED },
          enabled: false,
        }),
      ),
    ).toEqual({
      dbtype: 'csv',
      url: 'https://files.example.com/contacts.csv',
      mapping: { Name: 'name' },
      type: 'CRM contacts',
      access: 'public',
      enabled: false,
    })
  })

  it('should send the address of the uploaded file', () => {
    expect(
      buildPhonebookSourcePayload(
        databaseForm({
          kind: 'csv',
          csvFrom: 'upload',
          url: 'https://ignored.example.com/c.csv',
          uploadedUrl: 'file:///var/lib/nethvoice/phonebook/uploads/abc.csv',
        }),
      ).url,
    ).toBe('file:///var/lib/nethvoice/phonebook/uploads/abc.csv')
  })

  it('should build the body of an Infinity source without mapping', () => {
    expect(
      buildPhonebookSourcePayload(
        databaseForm({
          kind: 'infinity',
          url: 'https://infinity.example.com/api',
          username: 'api',
        }),
      ),
    ).toEqual({
      dbtype: 'infinity',
      url: 'https://infinity.example.com/api',
      username: 'api',
      password: 'new-password',
      type: 'CRM contacts',
      access: 'public',
      enabled: true,
    })
  })

  it('should send the connection fields and ask the total to the read endpoint', () => {
    expect(buildPhonebookTestPayload(databaseForm({ port: '' }))).toEqual({
      dbtype: 'mysql',
      host: 'crm.example.com',
      port: '3306',
      user: 'reader',
      password: 'new-password',
      dbname: 'crm',
      query: 'SELECT * FROM contacts',
      with_total: true,
    })
    expect(
      buildPhonebookTestPayload(
        databaseForm({ kind: 'csv', url: 'https://files.example.com/c.csv' }),
      ),
    ).toEqual({ dbtype: 'csv', url: 'https://files.example.com/c.csv', with_total: true })
  })

  it('should read an edited source with its stored password', () => {
    expect(buildPhonebookTestPayload(databaseForm({ password: '' }), crmSource())).toEqual({
      dbtype: 'mysql',
      host: 'crm.example.com',
      port: '3306',
      user: 'reader',
      dbname: 'crm',
      query: 'SELECT * FROM contacts',
      id: 'custom_1',
      with_total: true,
    })
    expect(buildPhonebookTestPayload(databaseForm(), crmSource())).not.toHaveProperty('id')
  })
})

describe('CSV files', () => {
  it('should accept CSV and text files up to 8 MB', () => {
    expect(validateCsvFile({ name: 'Contacts.CSV', size: 1024 })).toBe('')
    expect(validateCsvFile({ name: 'contacts.txt', size: 8 * 1024 * 1024 })).toBe('')
  })

  it('should reject other extensions, empty files and files over 8 MB', () => {
    expect(validateCsvFile({ name: 'evil.exe', size: 10 })).toBe(
      'integrations.phonebook.csv_file_invalid',
    )
    expect(validateCsvFile({ name: 'contacts.csv', size: 0 })).toBe(
      'integrations.phonebook.csv_file_empty',
    )
    expect(validateCsvFile({ name: 'contacts.csv', size: 8 * 1024 * 1024 + 1 })).toBe(
      'integrations.phonebook.csv_file_too_large',
    )
  })

  it('should recognize the upload rejected by the server', () => {
    const rejected = new ApiError({
      status: 400,
      method: 'POST',
      url: '/phonebook/uploadfile',
      body: { status: 'File upload is required' },
    })
    expect(isCsvUploadRejected(rejected)).toBe(true)
    expect(isCsvUploadRejected(new Error('network'))).toBe(false)
  })
})

describe('sync status', () => {
  const now = new Date(2026, 10, 23, 12, 0)
  const status = (changes: Partial<PhonebookSyncStatus>): PhonebookSyncStatus => ({
    id: 'custom_1',
    status: 'ok',
    startedAt: new Date(2026, 10, 23, 9, 59),
    finishedAt: new Date(2026, 10, 23, 10, 0),
    imported: 10,
    message: null,
    ...changes,
  })

  it('should parse the statuses with their dates', () => {
    expect(
      parsePhonebookSyncStatuses([
        {
          id: 'custom_1',
          status: 'failed',
          started_at: '2026-11-23T02:00:00Z',
          finished_at: '2026-11-23T02:00:05Z',
          imported: null,
          message: 'The database server does not answer',
        },
        {
          id: 'custom_2',
          status: 'running',
          started_at: '2026-11-23T03:00:00Z',
          finished_at: null,
          imported: null,
          message: null,
        },
      ]),
    ).toEqual([
      {
        id: 'custom_1',
        status: 'failed',
        startedAt: new Date('2026-11-23T02:00:00Z'),
        finishedAt: new Date('2026-11-23T02:00:05Z'),
        imported: null,
        message: 'The database server does not answer',
      },
      {
        id: 'custom_2',
        status: 'running',
        startedAt: new Date('2026-11-23T03:00:00Z'),
        finishedAt: null,
        imported: null,
        message: null,
      },
    ])
    expect(() => parsePhonebookSyncStatuses([{ id: 'x', status: 'done' }])).toThrow()
  })

  it('should show a source being synced', () => {
    expect(getLastSyncDisplay(status({ status: 'running' }), false, now)).toEqual({
      state: 'syncing',
    })
    expect(getLastSyncDisplay(status({}), true, now)).toEqual({ state: 'syncing' })
    expect(getLastSyncDisplay(undefined, true, now)).toEqual({ state: 'syncing' })
  })

  it('should show a source never synced', () => {
    expect(getLastSyncDisplay(undefined, false, now)).toEqual({ state: 'never' })
  })

  it('should tell today, yesterday and older syncs apart', () => {
    expect(getLastSyncDisplay(status({}), false, now)).toEqual({
      state: 'ok',
      day: 'today',
      at: new Date(2026, 10, 23, 10, 0),
    })
    expect(
      getLastSyncDisplay(
        status({ status: 'failed', finishedAt: new Date(2026, 10, 22, 23, 59) }),
        false,
        now,
      ),
    ).toMatchObject({ state: 'failed', day: 'yesterday' })
    expect(
      getLastSyncDisplay(status({ finishedAt: new Date(2026, 10, 20, 8, 0) }), false, now),
    ).toMatchObject({ state: 'ok', day: 'date' })
    expect(
      getLastSyncDisplay(status({ finishedAt: null, status: 'failed' }), false, now),
    ).toMatchObject({ state: 'failed', at: new Date(2026, 10, 23, 9, 59) })
  })
})

describe('translations', () => {
  it('should have an English text for every read error and phonebook field', () => {
    const kinds = ['connection', 'auth', 'query', 'file', 'http', 'format', 'unknown'] as const
    const sources = ['mysql', 'mssql', 'csv', 'infinity'] as const
    const keys = [
      ...kinds.flatMap((kind) =>
        sources.flatMap((source) => Object.values(getReadErrorTexts(kind, source))),
      ),
      ...PHONEBOOK_FIELD_ORDER.map((field) => `integrations.phonebook.fields.${field}`),
      ...sources.map((source) => `integrations.phonebook.kind_${source}`),
    ]
    const lookup = (key: string): unknown =>
      key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown>)?.[part], en)

    expect(keys.filter((key) => typeof lookup(key) !== 'string')).toEqual([])
  })
})
