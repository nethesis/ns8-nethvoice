//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest'
import {
  buildImportPayload,
  countCsvRows,
  describeOwner,
  estimateSkippedRows,
  getImportErrorMessage,
  parseCsv,
  parseImportOwners,
  parseImportResult,
  parsePhonebookImports,
  readCsv,
} from './phonebookImports'
import { NOT_IMPORTED } from './phonebookSources'
import { ApiError } from '@/lib/api/errors'

const CSV = [
  '﻿Name,Company,Phone,Notes',
  'Anna Miller,Example Ltd,300,',
  '"Davis, Christopher","Shop ""North""",301,"two',
  'lines"',
  '',
  ',Nameless Inc,302,',
  '   ,  ,  ,  ',
  'Grace Lee,,303,',
].join('\r\n')

describe('parseCsv', () => {
  it('should read quoted fields, escaped quotes and line breaks inside quotes', () => {
    expect(parseCsv('a,"b ""c""","d\ne"\n1,2,3')).toEqual([
      ['a', 'b "c"', 'd\ne'],
      ['1', '2', '3'],
    ])
  })

  it('should drop the byte order mark and accept CRLF, LF and CR line ends', () => {
    expect(parseCsv('﻿a,b\r\n1,2\r3,4\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
      ['3', '4'],
    ])
  })

  it('should return no records for an empty file', () => {
    expect(parseCsv('')).toEqual([])
  })
})

describe('readCsv', () => {
  it('should split the header from the records and skip blank lines', () => {
    expect(readCsv(CSV)).toEqual({
      columns: ['Name', 'Company', 'Phone', 'Notes'],
      records: [
        ['Anna Miller', 'Example Ltd', '300', ''],
        ['Davis, Christopher', 'Shop "North"', '301', 'two\r\nlines'],
        ['', 'Nameless Inc', '302', ''],
        ['Grace Lee', '', '303', ''],
      ],
    })
  })

  it('should count the rows of a file', () => {
    expect(countCsvRows(CSV)).toBe(4)
    expect(countCsvRows('Name\n')).toBe(0)
    expect(countCsvRows('')).toBe(0)
  })
})

describe('estimateSkippedRows', () => {
  const csv = readCsv(CSV)

  it('should count the rows without a value in the column of the names', () => {
    expect(estimateSkippedRows(csv, { Name: 'name', Company: 'company' })).toBe(1)
  })

  it('should use first and last name when no column holds the full name', () => {
    const people = readCsv('First,Last,Phone\nAnna,,1\n,Lee,2\n , ,3\n')

    expect(estimateSkippedRows(people, { First: 'firstname', Last: 'lastname' })).toBe(1)
    expect(estimateSkippedRows(people, { First: 'firstname', Last: NOT_IMPORTED })).toBe(2)
  })

  it('should skip every row when no column holds a name', () => {
    expect(estimateSkippedRows(csv, { Name: NOT_IMPORTED, Company: 'company' })).toBe(4)
  })
})

describe('imports history', () => {
  it('should parse the imports and add up the rows not imported', () => {
    expect(
      parsePhonebookImports([
        {
          id: 2,
          created_at: '2026-11-12T08:12:00Z',
          owner: 'mneri',
          filename: 'export-outlook.csv',
          type: 'group:Sales,Support',
          total: 425,
          imported: 418,
          skipped: 5,
          failed: 2,
        },
        {
          id: 1,
          created_at: '2026-10-03T15:05:00Z',
          owner: 'mrossi',
          filename: null,
          type: 'public',
          total: 95,
          imported: 95,
          skipped: 0,
          failed: 0,
        },
      ]),
    ).toEqual([
      {
        id: 2,
        createdAt: new Date('2026-11-12T08:12:00Z'),
        owner: 'mneri',
        filename: 'export-outlook.csv',
        groups: ['Sales', 'Support'],
        sharedWithNoGroup: false,
        total: 425,
        imported: 418,
        notImported: 7,
      },
      {
        id: 1,
        createdAt: new Date('2026-10-03T15:05:00Z'),
        owner: 'mrossi',
        filename: null,
        groups: [],
        sharedWithNoGroup: false,
        total: 95,
        imported: 95,
        notImported: 0,
      },
    ])
  })

  it('should reject an unexpected shape', () => {
    expect(() => parsePhonebookImports({})).toThrow()
  })
})

describe('owners', () => {
  const users = [
    { username: 'mrossi', displayname: 'Mario Rossi', default_extension: '201' },
    { username: 'agalli', displayname: '', default_extension: 215 },
    { username: 'noext', displayname: 'No Extension', default_extension: 'none' },
    { username: 'empty', displayname: 'Empty', default_extension: null },
  ]

  it('should list only the users with an extension, by name', () => {
    expect(parseImportOwners(users)).toEqual([
      { username: 'agalli', name: 'agalli', extension: '215' },
      { username: 'mrossi', name: 'Mario Rossi', extension: '201' },
    ])
  })

  it('should describe an owner with name and extension, or the username alone', () => {
    const owners = parseImportOwners(users)

    expect(describeOwner('mrossi', owners)).toBe('Mario Rossi (201)')
    expect(describeOwner('former', owners)).toBe('former')
  })
})

describe('import', () => {
  it('should build the import body without the columns not imported', () => {
    expect(
      buildImportPayload({
        url: 'file:///var/lib/nethvoice/phonebook/uploads/abc.csv',
        owner: 'mrossi',
        sharing: 'groups',
        groups: ['Sales'],
        mapping: { Name: 'name', Notes: NOT_IMPORTED },
        filename: 'contacts.csv',
      }),
    ).toEqual({
      url: 'file:///var/lib/nethvoice/phonebook/uploads/abc.csv',
      owner: 'mrossi',
      type: 'group:Sales',
      mapping: { Name: 'name' },
      filename: 'contacts.csv',
    })
  })

  it('should read the counts of the import', () => {
    expect(
      parseImportResult({
        message: 'phonebook import completed',
        total_rows: 248,
        imported_rows: 245,
        failed_rows: 0,
        skipped_rows: 3,
      }),
    ).toEqual({ total: 248, imported: 245, skipped: 3, failed: 0 })
  })

  it('should explain an import refused by the server', () => {
    const refused = (body: unknown, status = 400) =>
      new ApiError({ status, method: 'POST', url: '/phonebook/import-cti', body })

    expect(getImportErrorMessage(refused({ status: 'CSV separator must be a comma' }))).toBe(
      'CSV separator must be a comma',
    )
    expect(
      getImportErrorMessage(
        refused({ message: 'phonebook import failed', error_messages: ['Row 2: name is empty'] }),
      ),
    ).toBe('Row 2: name is empty')
    expect(getImportErrorMessage(refused({ error_messages: ['x'] }, 502))).toBe('')
    expect(getImportErrorMessage(new Error('network'))).toBe('')
  })
})
