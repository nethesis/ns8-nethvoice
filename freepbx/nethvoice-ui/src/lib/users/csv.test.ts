//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest'
import { ApiError } from '@/lib/api/errors'
import {
  analyzeImport,
  buildCsvTemplate,
  buildExportFileName,
  convertExportedCsv,
  DEFAULT_EXISTING_USERS_MODE,
  decodeBase64,
  encodeBase64,
  exceedsImportSizeLimit,
  getCsvImportFailure,
  ImportFileError,
  isCsvImportNotRunning,
  MAX_CSV_IMPORT_BASE64_LENGTH,
  needsFollowUps,
  parseCsv,
  parseCsvImportProgress,
  parseImportFile,
  planImportFollowUps,
  serializeCsv,
  toLegacyCsvRow,
} from './csv'
import type { UsersDirectory } from './directory'
import type { User, UserDevice, UserDeviceType } from './users'

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

const device = (type: UserDeviceType, extension: string): UserDevice => ({
  id: Number(extension),
  type,
  extension,
  mac: '',
  vendor: '',
  model: '',
  line: null,
  registered: false,
})

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

  it('reads the Italian column names', () => {
    const [row] = parseImportFile(
      'Nome utente;Nome;Cognome;Interno;Gruppo;Profilo;Cellulare;Casella vocale;App mobile\nm.rossi;Mario;Rossi;201;Vendite;Base;3331234567;sì;1',
    )

    expect(row).toMatchObject({
      username: 'm.rossi',
      fullName: 'Mario Rossi',
      extension: '201',
      groups: ['Vendite'],
      profile: 'Base',
      mobile: '3331234567',
      voicemail: true,
      mobileApp: true,
    })
  })

  it('rejects a header without the username column', () => {
    expect(() => parseImportFile('Login;Nome;Cognome;Interno\nm.rossi;Mario;Rossi;201')).toThrow(
      ImportFileError,
    )
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
    expect(analysis.newGroups).toEqual(['Support'])
  })

  it('lists the new groups and validates them like the groups drawer', () => {
    const analysis = analyzeImport(
      parseImportFile(
        [
          'username,name,extension,group',
          'k.lee,Kevin,305,sales|Marketing',
          'm.cole,Mia,306,marketing|Sa-les',
          `n.ford,Nina,307,${'x'.repeat(66)}`,
          'o.hart,Oscar,308,---',
          'p.king,Paul,309,Market-ing',
        ].join('\n'),
      ),
      USERS,
      DIRECTORY,
      'overwrite',
    )

    expect(analysis.valid.map((row) => row.username)).toEqual(['k.lee'])
    expect(analysis.newGroups).toEqual(['Marketing'])
    expect(
      analysis.errors.map(({ row, issue, group, reason }) => [row.line, issue, group, reason]),
    ).toEqual([
      [3, 'invalid_group', 'Sa-les', 'groups.name_too_similar'],
      [4, 'invalid_group', 'x'.repeat(66), 'groups.name_too_long'],
      [5, 'invalid_group', '---', 'groups.name_needs_letter_or_digit'],
      [6, 'invalid_group', 'Market-ing', 'groups.name_too_similar'],
    ])
  })

  it('reports an existing user that would exceed the device limit', () => {
    const devices = Array.from({ length: 9 }, (_, index) => device('physical', `9${index}300`))
    const users = [{ ...USERS[0], devices }]
    const rows = parseImportFile('username,name,extension,webphone\na.miller,Anna,300,TRUE')

    expect(analyzeImport(rows, users, DIRECTORY, 'overwrite').errors[0].issue).toBe(
      'too_many_devices',
    )
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

describe('planImportFollowUps', () => {
  const before: User[] = [
    { ...USERS[0], devices: [device('webrtc', '92300')] },
    { ...USERS[0], id: 6, username: 'b.smith', mainExtension: '301', devices: [] },
  ]
  const after: User[] = [
    ...before,
    { ...USERS[0], id: 7, username: 'k.lee', mainExtension: '305', devices: [] },
  ]
  const directory: UsersDirectory = { ...DIRECTORY, voicemailExtensions: ['300'] }

  it('applies voicemail and devices to the existing users that keep the extension', () => {
    const rows = parseImportFile(
      [
        'username,name,extension,voicemail,webphone,desktop_app,mobile_app',
        'a.miller,Anna,300,FALSE,FALSE,TRUE,',
        'b.smith,Bob,,TRUE,,,TRUE',
        'k.lee,Kevin,305,TRUE,TRUE,FALSE,TRUE',
      ].join('\n'),
    )

    expect(needsFollowUps(rows, before)).toBe(true)
    expect(
      planImportFollowUps(rows, before, after, directory).map(({ user, steps }) => [
        user.username,
        steps,
      ]),
    ).toEqual([
      [
        'a.miller',
        [
          { kind: 'voicemail', enabled: false },
          { kind: 'disable_device', device: 'webrtc' },
          { kind: 'enable_device', device: 'nethlink' },
        ],
      ],
      [
        'b.smith',
        [
          { kind: 'voicemail', enabled: true },
          { kind: 'enable_device', device: 'mobile' },
        ],
      ],
      ['k.lee', [{ kind: 'enable_device', device: 'mobile' }]],
    ])
  })

  it('needs no follow up when the import handles every column', () => {
    const rows = parseImportFile('username,name,extension,voicemail\nk.lee,Kevin,305,TRUE')

    expect(needsFollowUps(rows, before)).toBe(false)
    expect(planImportFollowUps(rows, before, after, directory)).toEqual([])
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
      [{ ...USERS[0], devices: [device('nethlink', '91300')] }],
    )

    expect(parseCsv(csv)).toEqual([
      [
        'username',
        'fullname',
        'extension',
        'group',
        'profile',
        'mobile',
        'voicemail',
        'webphone',
        'desktop_app',
        'mobile_app',
      ],
      ['a.miller', 'Anna Miller', '300', 'Sales', 'Base', '333', 'TRUE', 'FALSE', 'TRUE', 'FALSE'],
    ])
    expect(csv).not.toContain('secret')
  })

  it('exports a file that the import reads back', () => {
    const [row] = parseImportFile(
      convertExportedCsv('a.miller,Anna Miller,300,,,TRUE,FALSE,Sales,Base\r\n', USERS),
    )

    expect(row).toMatchObject({
      username: 'a.miller',
      fullName: 'Anna Miller',
      voicemail: true,
      webrtc: false,
      nethlink: false,
      mobileApp: false,
    })
  })

  it('names the export after the date', () => {
    expect(buildExportFileName(new Date(2026, 0, 5))).toBe('users-2026-01-05.csv')
  })

  it('detects a file too large to be imported at once', () => {
    expect(exceedsImportSizeLimit('a'.repeat(MAX_CSV_IMPORT_BASE64_LENGTH))).toBe(true)
    expect(exceedsImportSizeLimit('a.miller,Anna')).toBe(false)
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
