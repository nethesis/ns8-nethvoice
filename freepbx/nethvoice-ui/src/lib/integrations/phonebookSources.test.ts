//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest'
import {
  buildAccess,
  buildPhonebookSourcePayload,
  buildPhonebookTestPayload,
  emptyPhonebookSourceForm,
  getAvailableFields,
  getMappingColumns,
  getSyncIntervals,
  isCsvUploadRejected,
  isUploadedCsv,
  parsePhonebookSources,
  parsePhonebookTestResult,
  parseSharingGroups,
  suggestMapping,
  type PhonebookSource,
  type PhonebookSourceForm,
  toPhonebookSourceForm,
  validateCsvFile,
  validatePhonebookSourceForm,
} from './phonebookSources'
import { ApiError } from '@/lib/api/errors'

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
  mapping: { full_name: 'name', unused: '' },
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
        password: 'stored-password',
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
        password: '',
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

  it('should accept a source without rows', () => {
    expect(parsePhonebookTestResult([])).toEqual({ ok: true, rows: [], columns: [] })
  })

  it('should report a failed test', () => {
    expect(parsePhonebookTestResult({ status: false })).toEqual({ ok: false })
  })
})

describe('mapping helpers', () => {
  it('should merge tested and already mapped columns, hiding the sharing column', () => {
    expect(
      getMappingColumns(['full_name', 'type', 'phone'], { phone: 'workphone', fax: 'fax' }),
    ).toEqual(['full_name', 'phone', 'fax'])
  })

  it('should offer only the fields not used by other columns', () => {
    const fields = ['name', 'workphone', 'owner_id']
    const mapping = { full_name: 'name', phone: 'workphone' }

    expect(getAvailableFields(fields, mapping, 'phone', 'mysql')).toEqual(['workphone', 'owner_id'])
    expect(getAvailableFields(fields, mapping, 'other', 'csv')).toEqual([])
  })

  it('should recognize an uploaded CSV file', () => {
    expect(isUploadedCsv('file:///var/lib/nethvoice/phonebook/uploads/abc.csv')).toBe(true)
    expect(isUploadedCsv('https://files.example.com/contacts.csv')).toBe(false)
  })
})

describe('toPhonebookSourceForm', () => {
  it('should never copy the stored password into the form', () => {
    const form = toPhonebookSourceForm(crmSource())

    expect(form.password).toBe('')
    expect(form).toMatchObject({ kind: 'mysql', name: 'CRM contacts', sharing: 'public' })
  })

  it('should select group sharing for a restricted source', () => {
    expect(toPhonebookSourceForm(parsePhonebookSources(rawSources)[1])).toMatchObject({
      sharing: 'groups',
      groups: ['Sales', 'Marketing'],
    })
  })
})

describe('validatePhonebookSourceForm', () => {
  it('should accept a complete database source', () => {
    expect(validatePhonebookSourceForm(databaseForm())).toEqual({})
  })

  it('should require the connection fields of a database source', () => {
    expect(
      validatePhonebookSourceForm(
        databaseForm({
          name: '',
          host: '',
          port: 'abc',
          database: '',
          user: '',
          password: '',
          query: '',
          mapping: {},
        }),
      ),
    ).toEqual({
      name: 'integrations.phonebook.name_required',
      host: 'integrations.host_required',
      port: 'integrations.port_invalid',
      database: 'integrations.database_required',
      user: 'integrations.user_required',
      password: 'integrations.password_required',
      query: 'integrations.query_required',
      mapping: 'integrations.phonebook.mapping_required',
    })
  })

  it('should not require the password again when a stored one exists', () => {
    expect(validatePhonebookSourceForm(databaseForm({ password: '' }), crmSource())).toEqual({})
  })

  it('should validate the address of a CSV source', () => {
    const csv = (url: string) =>
      validatePhonebookSourceForm(databaseForm({ kind: 'csv', url, mapping: { Name: 'name' } }))

    expect(csv('https://files.example.com/contacts.csv')).toEqual({})
    expect(csv('file:///var/lib/nethvoice/phonebook/uploads/abc.csv')).toEqual({})
    expect(csv('contacts.csv')).toEqual({ url: 'integrations.phonebook.csv_url_invalid' })
    expect(csv('')).toEqual({ url: 'integrations.url_required' })
  })

  it('should not ask a mapping for Infinity sources', () => {
    expect(
      validatePhonebookSourceForm(
        databaseForm({
          kind: 'infinity',
          url: 'https://infinity.example.com/api',
          username: 'api',
          mapping: {},
        }),
      ),
    ).toEqual({})
  })

  it('should require a group when the source is shared with groups', () => {
    expect(validatePhonebookSourceForm(databaseForm({ sharing: 'groups', groups: [] }))).toEqual({
      groups: 'integrations.phonebook.groups_required',
    })
  })
})

describe('payloads', () => {
  it('should build the body of a database source', () => {
    expect(
      buildPhonebookSourcePayload(
        databaseForm({
          name: ' CRM contacts ',
          sharing: 'groups',
          groups: ['Sales'],
          interval: 60,
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
      interval: 60,
      enabled: true,
    })
  })

  it('should send the stored password back when it was not changed', () => {
    const payload = buildPhonebookSourcePayload(databaseForm({ password: '' }), crmSource())

    expect(payload.password).toBe('stored-password')
  })

  it('should ignore selected groups when the source is public', () => {
    expect(buildPhonebookSourcePayload(databaseForm({ groups: ['Sales'] })).access).toBe('public')
  })

  it('should build the body of a CSV source', () => {
    expect(
      buildPhonebookSourcePayload(
        databaseForm({
          kind: 'csv',
          url: 'https://files.example.com/contacts.csv',
          mapping: { Name: 'name' },
          enabled: false,
        }),
      ),
    ).toEqual({
      dbtype: 'csv',
      url: 'https://files.example.com/contacts.csv',
      mapping: { Name: 'name' },
      type: 'CRM contacts',
      access: 'public',
      interval: 1440,
      enabled: false,
    })
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
      interval: 1440,
      enabled: true,
    })
  })

  it('should send only the connection fields to the test endpoint', () => {
    expect(buildPhonebookTestPayload(databaseForm())).toEqual({
      dbtype: 'mysql',
      host: 'crm.example.com',
      port: '3306',
      user: 'reader',
      password: 'new-password',
      dbname: 'crm',
      query: 'SELECT * FROM contacts',
    })
    expect(
      buildPhonebookTestPayload(
        databaseForm({ kind: 'csv', url: 'https://files.example.com/c.csv' }),
      ),
    ).toEqual({ dbtype: 'csv', url: 'https://files.example.com/c.csv' })
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

describe('getSyncIntervals', () => {
  it('should add an interval missing from the list, in order', () => {
    expect(getSyncIntervals(60)).toEqual([15, 30, 60, 360, 1440])
    expect(getSyncIntervals(120)).toEqual([15, 30, 60, 120, 360, 1440])
  })
})

describe('emptyPhonebookSourceForm', () => {
  it('should leave the query empty', () => {
    expect(emptyPhonebookSourceForm().query).toBe('')
  })
})

describe('suggestMapping', () => {
  const fields = ['name', 'company', 'workphone', 'owner_id']

  it('should map the columns named like a phonebook field', () => {
    expect(suggestMapping(['Name', 'company', 'phone', 'type'], fields, {}, 'mysql')).toEqual({
      Name: 'name',
      company: 'company',
    })
  })

  it('should keep the mapping chosen by the user', () => {
    expect(
      suggestMapping(['name', 'company'], fields, { name: '', other: 'company' }, 'mysql'),
    ).toEqual({ name: '', other: 'company' })
  })

  it('should leave out the fields a CSV cannot fill', () => {
    expect(suggestMapping(['owner_id'], fields, {}, 'csv')).toEqual({})
  })
})
