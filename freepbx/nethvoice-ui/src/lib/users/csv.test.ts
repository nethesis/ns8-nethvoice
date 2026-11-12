//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest'
import { ApiError } from '@/lib/api/errors'
import {
  analyzeImport,
  buildCsvTemplate,
  convertExportedCsv,
  DEFAULT_EXISTING_USERS_MODE,
  decodeBase64,
  encodeBase64,
  getCsvImportFailure,
  isCsvImportNotRunning,
  parseCsv,
  parseCsvImportProgress,
  parseImportFile,
  serializeCsv,
  toLegacyCsvRow,
} from './csv'
import type { UsersDirectory } from './directory'
import type { User } from './users'

const USERS: User[] = [
  {
    id: 5,
    username: 'a.miller',
    displayName: 'Anna Miller',
    mainExtension: '300',
    profileId: 2,
    email: '',
    devices: [],
  },
]

const DIRECTORY: UsersDirectory = {
  groups: [{ id: 1, name: 'Sales', userIds: [5] }],
  profiles: [
    { id: 1, name: 'Base' },
    { id: 2, name: 'Standard' },
  ],
  voicemailExtensions: [],
  mobiles: { 'a.miller': '3331234567' },
}

const apiError = (status: number, body: unknown) =>
  new ApiError({ status, method: 'GET', url: '/freepbx/rest/csv/csvimport', body })

describe('parseCsv', () => {
  it('handles quotes, escaped quotes, CRLF and empty lines', () => {
    expect(parseCsv('a,"b, c","say ""hi"""\r\n\r\n d ,e\n')).toEqual([
      ['a', 'b, c', 'say "hi"'],
      ['d', 'e'],
    ])
  })

  it('detects the semicolon separator and strips the BOM', () => {
    expect(parseCsv('﻿username;name\na.miller;Anna')).toEqual([
      ['username', 'name'],
      ['a.miller', 'Anna'],
    ])
  })

  it('round trips with serializeCsv', () => {
    const rows = [['a.miller', 'Anna "A" Miller', '300']]
    expect(parseCsv(serializeCsv(rows))).toEqual(rows)
  })
})

describe('base64', () => {
  it('encodes and decodes UTF-8 text', () => {
    expect(decodeBase64(encodeBase64('Niccolò Rossi'))).toBe('Niccolò Rossi')
    expect(encodeBase64('a,b')).toBe('YSxi')
  })
})

describe('parseImportFile', () => {
  it('reads a file with the header of the template', () => {
    const [row] = parseImportFile(
      'Username,Name,Surname,Extension,Group,Profile\nA.Miller,Anna,Miller,201,Sales|Support,Standard\n',
    )

    expect(row).toMatchObject({
      line: 2,
      username: 'a.miller',
      name: 'Anna',
      surname: 'Miller',
      fullName: 'Anna Miller',
      extension: '201',
      groups: ['Sales', 'Support'],
      profile: 'Standard',
      password: '',
      mobile: null,
      voicemail: null,
    })
  })

  it('reads the legacy positional format of the export', () => {
    const [row] = parseImportFile(
      '"c.davis","Christopher Davis","none","","3331234567","TRUE","FALSE","Sales","Base"\r\n',
    )

    expect(row).toMatchObject({
      line: 1,
      username: 'c.davis',
      fullName: 'Christopher Davis',
      extension: '',
      mobile: '3331234567',
      voicemail: true,
      webrtc: false,
      groups: ['Sales'],
      profile: 'Base',
      nethlink: null,
    })
  })

  it('skips comment lines', () => {
    expect(parseImportFile('# a comment\nd.jones,Daniel Jones,302')).toHaveLength(1)
  })
})

describe('analyzeImport', () => {
  const rows = parseImportFile(
    [
      'username,name,surname,extension,group,profile',
      'a.miller,Anna,Miller,300,Sales,Standard',
      'c.davis,Christopher,Davis,xxx,Support,Base',
      'd.jones,,,302,,',
      'e.johnson,Emma,Johnson,300,,',
      'j.smith,John,Smith,304,,Unknown',
      'k.lee,Kevin,Lee,305,Support,base',
      'k.lee,Kevin,Lee,306,,',
      ',No,Username,307,,',
      '1abc,Bad,Name,308,,',
    ].join('\n'),
  )

  it('splits valid, existing and wrong rows', () => {
    const analysis = analyzeImport(rows, USERS, DIRECTORY, 'skip')

    expect(analysis.total).toBe(9)
    expect(analysis.valid.map((row) => row.username)).toEqual(['k.lee'])
    expect(analysis.existing.map((row) => row.username)).toEqual(['a.miller'])
    expect(analysis.errors.map(({ row, issue }) => `${row.line}:${issue}`)).toEqual([
      '3:invalid_extension',
      '4:missing_name',
      '5:duplicate_extension',
      '6:unknown_profile',
      '8:duplicate_username',
      '9:missing_username',
      '10:invalid_username',
    ])
    expect(analysis.groups).toEqual(['Sales', 'Support'])
  })

  it('imports the existing users in overwrite mode', () => {
    const analysis = analyzeImport(rows, USERS, DIRECTORY, 'overwrite')

    expect(DEFAULT_EXISTING_USERS_MODE).toBe('overwrite')

    expect(analysis.valid.map((row) => row.username)).toEqual(['a.miller', 'k.lee'])
    expect(analysis.existing).toEqual([])
  })
})

describe('toLegacyCsvRow', () => {
  it('converts a new user to the positional format', () => {
    const [row] = parseImportFile(
      'username,name,surname,extension,group,profile\nk.lee,Kevin,Lee,305,Sales,Base',
    )

    expect(toLegacyCsvRow(row, USERS, DIRECTORY)).toEqual([
      'k.lee',
      'Kevin Lee',
      '305',
      '',
      '',
      '',
      '',
      'Sales',
      'Base',
    ])
  })

  it('keeps the extension and the current values of an existing user', () => {
    const [row] = parseImportFile('username,name,extension\na.miller,Anna M.,300')

    expect(toLegacyCsvRow(row, USERS, DIRECTORY)).toEqual(['a.miller', 'Anna M.', ''])
  })

  it('fills the columns before the last one given with the current values', () => {
    const [row] = parseImportFile('username,name,extension,profile\na.miller,Anna,300,Base')

    expect(toLegacyCsvRow(row, USERS, DIRECTORY)).toEqual([
      'a.miller',
      'Anna',
      '',
      '',
      '3331234567',
      '',
      '',
      'Sales',
      'Base',
    ])
  })

  it('reports a new user that takes the extension of another user', () => {
    const rows = parseImportFile('username,name,extension\nk.lee,Kevin,300')

    expect(analyzeImport(rows, USERS, DIRECTORY, 'skip').errors[0].issue).toBe('extension_in_use')
  })

  it('writes the flags that the file sets', () => {
    const [row] = parseImportFile(
      'username,fullname,extension,voicemail,webphone,desktop app\nk.lee,Kevin Lee,305,yes,no,1',
    )

    expect(toLegacyCsvRow(row, USERS, DIRECTORY)).toEqual([
      'k.lee',
      'Kevin Lee',
      '305',
      '',
      '',
      'TRUE',
      'FALSE',
      '',
      '',
      'TRUE',
    ])
  })
})

describe('templates and export', () => {
  it('builds a template that parses back', () => {
    const rows = parseImportFile(buildCsvTemplate())
    expect(rows.map((row) => row.username)).toEqual(['a.miller', 'c.davis'])
    expect(rows[1].groups).toEqual(['Sales', 'Support'])
  })

  it('converts the legacy export to a CSV with a header and no passwords', () => {
    const csv = convertExportedCsv(
      '"a.miller","Anna Miller","300","secret","333","TRUE","FALSE","Sales","Base"\r\n',
    )

    expect(parseCsv(csv)).toEqual([
      ['username', 'fullname', 'extension', 'groups', 'profile', 'mobile', 'voicemail', 'webphone'],
      ['a.miller', 'Anna Miller', '300', 'Sales', 'Base', '333', 'TRUE', 'FALSE'],
    ])
    expect(csv).not.toContain('secret')
  })
})

describe('import status', () => {
  it('reads the progress', () => {
    expect(parseCsvImportProgress({ result: 40 })).toBe(40)
    expect(parseCsvImportProgress({ result: '100' })).toBe(100)
    expect(parseCsvImportProgress({ result: null })).toBe(0)
  })

  it('tells a failed import from one that is not running', () => {
    expect(getCsvImportFailure(apiError(500, { status: 'Error creating user x\n' }))).toBe(
      'Error creating user x',
    )
    expect(getCsvImportFailure(apiError(500, null))).toBeNull()
    expect(getCsvImportFailure(apiError(422, { status: 'No csv import active' }))).toBeNull()
    expect(isCsvImportNotRunning(apiError(422, { status: 'No csv import active' }))).toBe(true)
    expect(isCsvImportNotRunning(new Error('x'))).toBe(false)
  })
})
