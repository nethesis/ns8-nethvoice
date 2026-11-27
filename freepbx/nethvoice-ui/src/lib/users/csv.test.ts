//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it, vi } from 'vitest'
import { api } from '@/lib/api/client'
import { ApiError } from '@/lib/api/errors'
import {
  CsvImportError,
  isValueTooLongFailure,
  analyzeImport,
  buildCsvTemplate,
  buildExportFileName,
  convertExportedCsv,
  DEFAULT_EXISTING_USERS_MODE,
  decodeBase64,
  encodeBase64,
  escapeSpreadsheetFormula,
  exceedsImportSizeLimit,
  getCsvImportFailure,
  hasControlCharacters,
  ImportFileError,
  isCsvImportNotRunning,
  MAX_CSV_IMPORT_BASE64_LENGTH,
  needsFollowUps,
  parseCsv,
  parseCsvImportProgress,
  parseImportFile,
  planImportFollowUps,
  postCsvImport,
  runCsvImport,
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

describe('hasControlCharacters', () => {
  it('finds the C0 control characters and DEL only', () => {
    for (const char of ['\r', '\n', '\t', '\u0000', '\u001b', '\u001f', '\u007f']) {
      expect(hasControlCharacters(`Anna${char}Miller`)).toBe(true)
    }
    for (const value of ['', 'Anna Miller', 'Zoë "Q" O\'Brien', 'R&D #2 / 50%', '\u0080\u00a0é']) {
      expect(hasControlCharacters(value)).toBe(false)
    }
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
    expect(
      analysis.errors.map(({ row, issues }) => `${row.line}:${issues.map(({ issue }) => issue)}`),
    ).toEqual([
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
      analysis.errors.flatMap(({ row, issues }) =>
        issues.map(({ issue, group, reason }) => [row.line, issue, group, reason]),
      ),
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

    expect(analyzeImport(rows, users, DIRECTORY, 'overwrite').errors[0].issues).toEqual([
      { issue: 'too_many_devices' },
    ])
  })

  it('reports a username or a full name that is too long for a new user', () => {
    const rows = parseImportFile(
      [
        'username,name,surname,extension',
        `k${'x'.repeat(32)},Kevin,Lee,305`,
        `m.cole,${'M'.repeat(45)},Coles,306`,
        `n.ray,${'N'.repeat(44)},Rays,307`,
        `a.miller,${'A'.repeat(60)},Miller,300`,
      ].join('\n'),
    )
    const analysis = analyzeImport(rows, USERS, DIRECTORY, 'overwrite')

    expect(analysis.errors.map(({ row, issues }) => [row.line, issues])).toEqual([
      [2, [{ issue: 'username_too_long' }]],
      [3, [{ issue: 'name_too_long' }]],
    ])
    expect(analysis.valid.map((row) => row.username)).toEqual(['n.ray', 'a.miller'])
  })

  it('reports every issue of a row together', () => {
    const rows = parseImportFile('username,name,extension,voicemail\nqa_bad,,abc,maybe')

    expect(analyzeImport(rows, USERS, DIRECTORY, 'overwrite').errors[0].issues).toEqual([
      { issue: 'missing_name' },
      { issue: 'invalid_extension' },
      { issue: 'invalid_flag', column: 'voicemail', value: 'maybe' },
    ])
  })

  it('reports the unrecognized values of the flags instead of reading them as no', () => {
    const rows = parseImportFile(
      [
        'username,name,extension,voicemail,webphone,desktop_app,mobile_app',
        'k.lee,Kevin,305,Y,off,abilitato,',
        'm.cole,Mia,306,x,N,on,0',
      ].join('\n'),
    )
    const analysis = analyzeImport(rows, USERS, DIRECTORY, 'overwrite')

    expect(rows[0]).toMatchObject({ voicemail: true, webrtc: false, nethlink: null })
    expect(rows[1]).toMatchObject({
      voicemail: true,
      webrtc: false,
      nethlink: true,
      mobileApp: false,
      invalidFlags: [],
    })
    expect(analysis.valid.map((row) => row.username)).toEqual(['m.cole'])
    expect(analysis.errors.map(({ row, issues }) => [row.line, issues])).toEqual([
      [2, [{ issue: 'invalid_flag', column: 'nethlink', value: 'abilitato' }]],
    ])
  })

  it('reports the rows with control characters and keeps the other names as they are', () => {
    const rows = parseImportFile(
      [
        'username,name,surname,extension,password,mobile,group',
        'k.lee,"Kevin\tAnn",Lee,305',
        'm.cole,Mia,"Co\u0000le",306',
        'n.ray,"Nora\nJane",Ray,307',
        'o.dean,Omar,Dean,308,"Pass\u007fword"',
        'p.hill,Pia,Hill,309,,"333\u001b000"',
        'r.west,Rita,West,310,,,"Sales|Sup\rport"',
        's.moss,"Zoë ""Q"" O\'Brien",Müller-Ça,311,"P""a s#s&ö1",+39 333 000,R&D #2',
        't.ford,Tom\t,Ford,312',
      ].join('\n'),
    )
    const analysis = analyzeImport(rows, USERS, DIRECTORY, 'overwrite')

    expect(analysis.errors.map(({ row, issues }) => [row.username, issues])).toEqual(
      ['k.lee', 'm.cole', 'n.ray', 'o.dean', 'p.hill', 'r.west'].map((username) => [
        username,
        [{ issue: 'control_characters' }],
      ]),
    )
    expect(
      analysis.valid.map(({ username, fullName, password, mobile, groups }) => ({
        username,
        fullName,
        password,
        mobile,
        groups,
      })),
    ).toEqual([
      {
        username: 's.moss',
        fullName: 'Zoë "Q" O\'Brien Müller-Ça',
        password: 'P"a s#s&ö1',
        mobile: '+39 333 000',
        groups: ['R&D #2'],
      },
      { username: 't.ford', fullName: 'Tom Ford', password: '', mobile: null, groups: null },
    ])
  })

  it('reports the passwords with spaces at the start or the end', () => {
    const rows = parseImportFile(
      [
        'username,name,surname,extension,password',
        'k.lee,Kevin,Lee,305," Secret,123"',
        'm.cole,Mia,Cole,306,"Secret,123 "',
        'n.ray,Nora,Ray,307,"Sec ret,123\\"',
        'o.dean,Omar,Dean,308,',
      ].join('\n'),
    )
    const analysis = analyzeImport(rows, USERS, DIRECTORY, 'skip')

    expect(analysis.errors.map(({ row, issues }) => [row.username, issues])).toEqual([
      ['k.lee', [{ issue: 'password_whitespace' }]],
      ['m.cole', [{ issue: 'password_whitespace' }]],
    ])
    expect(analysis.valid.map(({ username, password }) => [username, password])).toEqual([
      ['n.ray', 'Sec ret,123\\'],
      ['o.dean', ''],
    ])
  })

  it('reports the passwords of new accounts that the create form would refuse', () => {
    const rows = parseImportFile(
      [
        'username,name,surname,extension,password',
        'k.lee,Kevin,Lee,305,weakpass',
        'm.cole,Mia,Cole,306,Strong-Pass-1',
        'o.dean,Omar,Dean,308,',
        'a.miller,Anna,Miller,,weakpass',
      ].join('\n'),
    )
    const analysis = analyzeImport(rows, USERS, DIRECTORY, 'overwrite')

    expect(analysis.errors.map(({ row, issues }) => [row.username, issues])).toEqual([
      ['k.lee', [{ issue: 'weak_password' }]],
    ])
    expect(analysis.valid.map(({ username }) => username)).toEqual(['m.cole', 'o.dean', 'a.miller'])
  })

  it('imports the existing users in overwrite mode', () => {
    const analysis = analyzeImport(rows, USERS, DIRECTORY, 'overwrite')

    expect(DEFAULT_EXISTING_USERS_MODE).toBe('skip')

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

    expect(analyzeImport(rows, USERS, DIRECTORY, 'skip').errors[0].issues).toEqual([
      { issue: 'extension_in_use' },
    ])
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

  it('keeps a spreadsheet from running the cells of the export as formulas', () => {
    const csv = convertExportedCsv(
      'a.miller,"=HYPERLINK(""http://example.org"")",300,,,TRUE,FALSE,+Sales|-Support,@Base\r\n',
      USERS,
    )

    expect(parseCsv(csv)[1].slice(0, 5)).toEqual([
      'a.miller',
      `'=HYPERLINK("http://example.org")`,
      '300',
      "'+Sales|-Support",
      "'@Base",
    ])
    expect(escapeSpreadsheetFormula('\tChristopher')).toBe("'\tChristopher")
    expect(escapeSpreadsheetFormula('\rOps')).toBe("'\rOps")
    expect(escapeSpreadsheetFormula("Anna O'Neil")).toBe("Anna O'Neil")
  })

  it('sends the cells of an import unchanged', () => {
    const rows = [['a.miller', '=Anna', '300', '-Secret,1', '+390000000']]
    expect(parseCsv(serializeCsv(rows))).toEqual(rows)
  })

  it('names the export after the date', () => {
    expect(buildExportFileName(new Date(2026, 0, 5))).toBe('users-2026-01-05.csv')
  })

  it('detects a file too large to be imported at once', () => {
    expect(exceedsImportSizeLimit('a'.repeat(MAX_CSV_IMPORT_BASE64_LENGTH))).toBe(true)
    expect(exceedsImportSizeLimit('a.miller,Anna')).toBe(false)
  })
})

describe('postCsvImport', () => {
  it('asks the server to parse the rows as RFC 4180, keeping backslashes', async () => {
    const post = vi
      .spyOn(api, 'POST')
      .mockResolvedValue({ data: { id: '0123456789abcdef' }, response: new Response() })
    const csv = serializeCsv([['k.lee', 'Kevin Lee\\', '305', 'Secret,123\\']])

    expect(await postCsvImport(csv)).toBe('0123456789abcdef')

    expect(post).toHaveBeenCalledWith('/csv/csvimport', {
      body: { file: encodeBase64(csv), rfc4180: true },
    })
    expect(csv).toBe('"k.lee","Kevin Lee\\","305","Secret,123\\"\r\n')
    post.mockRestore()
  })
})

describe('runCsvImport', () => {
  it('follows only the import it started', async () => {
    const post = vi
      .spyOn(api, 'POST')
      .mockResolvedValue({ data: { id: '0123456789abcdef' }, response: new Response() })
    const get = vi
      .spyOn(api, 'GET')
      .mockResolvedValueOnce({ data: { result: 40 }, response: new Response() })
      .mockResolvedValueOnce({ data: { result: 100 }, response: new Response() })
    const progress: number[] = []

    await runCsvImport('a.b,Anna\r\n', (value) => progress.push(value), 0)

    expect(get).toHaveBeenCalledTimes(2)
    expect(get).toHaveBeenCalledWith('/csv/csvimport', {
      params: { query: { id: '0123456789abcdef' } },
    })
    expect(progress).toEqual([40, 100])
    post.mockRestore()
    get.mockRestore()
  })

  it('keeps polling the latest import when the server gives no id', async () => {
    const post = vi.spyOn(api, 'POST').mockResolvedValue({ data: '', response: new Response() })
    const get = vi
      .spyOn(api, 'GET')
      .mockResolvedValue({ data: { result: 100 }, response: new Response() })

    await runCsvImport('a.b,Anna\r\n', () => undefined, 0)

    expect(get).toHaveBeenCalledWith('/csv/csvimport', { params: { query: {} } })
    post.mockRestore()
    get.mockRestore()
  })

  it('tells that another import is running and that the file is too large', async () => {
    const refusal = (status: number, body: unknown) =>
      new ApiError({ status, method: 'POST', url: '/freepbx/rest/csv/csvimport', body })
    const post = vi
      .spyOn(api, 'POST')
      .mockRejectedValueOnce(refusal(409, { code: 'import_running', message: 'busy' }))
      .mockRejectedValueOnce(refusal(413, { code: 'file_too_large', message: 'big' }))
      .mockRejectedValueOnce(refusal(500, null))

    await expect(runCsvImport('a.b,Anna\r\n', () => undefined, 0)).rejects.toMatchObject({
      name: 'CsvImportError',
      code: 'import_running',
    })
    await expect(runCsvImport('a.b,Anna\r\n', () => undefined, 0)).rejects.toMatchObject({
      name: 'CsvImportError',
      code: 'file_too_large',
    })
    await expect(runCsvImport('a.b,Anna\r\n', () => undefined, 0)).rejects.toBeInstanceOf(ApiError)
    post.mockRestore()
  })

  it('keeps the problems of a failed import', async () => {
    const post = vi
      .spyOn(api, 'POST')
      .mockResolvedValue({ data: { id: '0123456789abcdef' }, response: new Response() })
    const get = vi.spyOn(api, 'GET').mockRejectedValue(
      apiError(500, {
        status: 'Error importing user a.b',
        problems: [{ code: 'protected_account', line: 1, username: 'a.b' }],
      }),
    )

    await expect(runCsvImport('a.b,Anna\r\n', () => undefined, 0)).rejects.toMatchObject({
      code: 'import_failed',
      problems: [{ code: 'protected_account', line: 1, username: 'a.b' }],
    })
    post.mockRestore()
    get.mockRestore()
  })
})

describe('import status', () => {
  it('reads the progress', () => {
    expect(parseCsvImportProgress({ result: 40 })).toBe(40)
    expect(parseCsvImportProgress({ result: '100' })).toBe(100)
    expect(parseCsvImportProgress({ result: null })).toBe(0)
  })

  it('tells a failed import from one that is not running', () => {
    expect(getCsvImportFailure(apiError(500, { status: 'Error creating user x\n' }))).toEqual({
      status: 'Error creating user x',
      problems: [],
    })
    expect(
      getCsvImportFailure(
        apiError(500, { status: 'x', problems: [{ code: 'missing_name', line: 2 }] }),
      ),
    ).toEqual({ status: 'x', problems: [{ code: 'missing_name', line: 2 }] })
    expect(getCsvImportFailure(apiError(500, null))).toBeNull()
    expect(getCsvImportFailure(apiError(422, { status: 'No csv import active' }))).toBeNull()
    expect(isCsvImportNotRunning(apiError(422, { status: 'No csv import active' }))).toBe(true)
    expect(isCsvImportNotRunning(new Error('x'))).toBe(false)
  })

  it('recognizes a value too long for the PBX tables', () => {
    const failure = (message: string) => new CsvImportError('import_failed', message)

    expect(
      isValueTooLongFailure(
        failure(
          "Error adding main extension 300 to user a.b: Unable to insert into users: SQLSTATE[22001]: String data, right truncated: 1406 Data too long for column 'name' at row 1",
        ),
      ),
    ).toBe(true)
    expect(isValueTooLongFailure(failure('Error creating user a.b: HTTP 503'))).toBe(false)
    expect(isValueTooLongFailure(new CsvImportError('file_too_large'))).toBe(false)
    expect(isValueTooLongFailure(new Error('Data too long'))).toBe(false)
  })
})
