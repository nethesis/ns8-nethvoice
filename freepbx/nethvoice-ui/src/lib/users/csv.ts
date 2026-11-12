//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import * as v from 'valibot'
import { api } from '@/lib/api/client'
import { isApiError } from '@/lib/api/errors'
import type { UsersDirectory } from '@/lib/users/directory'
import { isValidExtension } from '@/lib/users/extensions'
import { findUserByUsername, type User } from '@/lib/users/users'

export const CSV_IMPORT_POLL_INTERVAL = 2000

export const CSV_IMPORT_START_ATTEMPTS = 15

export const MAX_CSV_IMPORT_BASE64_LENGTH = 120000

export const USERNAME_REGEX = /^[a-z][a-z0-9._-]{0,31}$/

export const IMPORT_PREVIEW_ROWS = 5

export const IMPORT_ISSUES_SHOWN = 3

export type ImportColumn =
  | 'username'
  | 'name'
  | 'surname'
  | 'fullname'
  | 'extension'
  | 'groups'
  | 'profile'
  | 'password'
  | 'mobile'
  | 'voicemail'
  | 'webrtc'
  | 'nethlink'

export type ImportRow = {
  line: number
  username: string
  name: string
  surname: string
  fullName: string
  extension: string
  groups: string[] | null
  profile: string | null
  password: string
  mobile: string | null
  voicemail: boolean | null
  webrtc: boolean | null
  nethlink: boolean | null
}

export type ImportIssue =
  | 'missing_username'
  | 'invalid_username'
  | 'missing_name'
  | 'invalid_extension'
  | 'duplicate_username'
  | 'duplicate_extension'
  | 'extension_in_use'
  | 'unknown_profile'

export type ImportRowError = {
  row: ImportRow
  issue: ImportIssue
}

export type ExistingUsersMode = 'skip' | 'overwrite'

export const DEFAULT_EXISTING_USERS_MODE: ExistingUsersMode = 'overwrite'

export type ImportAnalysis = {
  total: number
  valid: ImportRow[]
  existing: ImportRow[]
  errors: ImportRowError[]
  groups: string[]
}

export type CsvImportErrorCode = 'file_too_large' | 'import_failed'

export class CsvImportError extends Error {
  readonly code: CsvImportErrorCode

  constructor(code: CsvImportErrorCode, message = '') {
    super(message)
    this.name = 'CsvImportError'
    this.code = code
  }
}

export const isCsvImportError = (error: unknown): error is CsvImportError =>
  error instanceof CsvImportError

const LEGACY_COLUMNS: ImportColumn[] = [
  'username',
  'fullname',
  'extension',
  'password',
  'mobile',
  'voicemail',
  'webrtc',
  'groups',
  'profile',
  'nethlink',
]

const COLUMN_ALIASES: Record<string, ImportColumn> = {
  username: 'username',
  user: 'username',
  name: 'name',
  firstname: 'name',
  surname: 'surname',
  lastname: 'surname',
  fullname: 'fullname',
  displayname: 'fullname',
  extension: 'extension',
  group: 'groups',
  groups: 'groups',
  profile: 'profile',
  password: 'password',
  mobile: 'mobile',
  mobilenumber: 'mobile',
  voicemail: 'voicemail',
  webrtc: 'webrtc',
  webphone: 'webrtc',
  nethlink: 'nethlink',
  desktopapp: 'nethlink',
}

export const CSV_TEMPLATE_COLUMNS = [
  'username',
  'name',
  'surname',
  'extension',
  'group',
  'profile',
  'password',
  'mobile',
  'voicemail',
  'webphone',
  'desktop_app',
]

export const CSV_EXPORT_COLUMNS = [
  'username',
  'fullname',
  'extension',
  'groups',
  'profile',
  'mobile',
  'voicemail',
  'webphone',
]

const detectDelimiter = (text: string): string => {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? ''
  return firstLine.split(';').length > firstLine.split(',').length ? ';' : ','
}

export const parseCsv = (text: string): string[][] => {
  const source = text.replace(/^﻿/, '')
  const delimiter = detectDelimiter(source)
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false

  const endRow = () => {
    row.push(field)
    field = ''

    if (row.some((cell) => cell.trim() !== '')) {
      rows.push(row.map((cell) => cell.trim()))
    }
    row = []
  }

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index]

    if (quoted) {
      if (char === '"' && source[index + 1] === '"') {
        field += '"'
        index += 1
      } else if (char === '"') {
        quoted = false
      } else {
        field += char
      }
    } else if (char === '"') {
      quoted = true
    } else if (char === delimiter) {
      row.push(field)
      field = ''
    } else if (char === '\n') {
      endRow()
    } else if (char !== '\r') {
      field += char
    }
  }

  if (field !== '' || row.length > 0) {
    endRow()
  }
  return rows
}

export const serializeCsv = (rows: string[][]): string =>
  rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',') + '\r\n').join('')

export const encodeBase64 = (text: string): string => {
  const bytes = new TextEncoder().encode(text)
  let binary = ''

  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary)
}

export const decodeBase64 = (base64: string): string => {
  const binary = atob(base64)
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

const normalizeHeader = (cell: string): string => cell.toLowerCase().replace(/[^a-z]/g, '')

const parseFlag = (value: string | undefined): boolean | null => {
  if (value === undefined || value.trim() === '') {
    return null
  }
  return ['true', '1', 'yes'].includes(value.trim().toLowerCase())
}

const parseGroups = (value: string | undefined): string[] | null =>
  value === undefined
    ? null
    : value
        .split('|')
        .map((group) => group.trim())
        .filter((group) => group !== '')

export const parseImportFile = (text: string): ImportRow[] => {
  const table = parseCsv(text).filter((cells) => !cells[0]?.startsWith('#'))

  if (table.length === 0) {
    return []
  }
  const headerColumns = table[0].map((cell) => COLUMN_ALIASES[normalizeHeader(cell)])
  const hasHeader = headerColumns.includes('username')
  const columns: (ImportColumn | undefined)[] = hasHeader ? headerColumns : LEGACY_COLUMNS
  const body = hasHeader ? table.slice(1) : table

  return body.map((cells, index) => {
    const value = (column: ImportColumn): string | undefined => {
      const position = columns.indexOf(column)
      return position >= 0 && position < cells.length ? cells[position] : undefined
    }
    const name = value('name') ?? value('fullname') ?? ''
    const surname = value('surname') ?? ''
    const extension = value('extension') ?? ''

    return {
      line: index + (hasHeader ? 2 : 1),
      username: (value('username') ?? '').toLowerCase(),
      name,
      surname,
      fullName: value('fullname') ?? [name, surname].filter(Boolean).join(' '),
      extension: extension.toLowerCase() === 'none' ? '' : extension,
      groups: parseGroups(value('groups')),
      profile: value('profile') ?? null,
      password: value('password') ?? '',
      mobile: value('mobile') ?? null,
      voicemail: parseFlag(value('voicemail')),
      webrtc: parseFlag(value('webrtc')),
      nethlink: parseFlag(value('nethlink')),
    }
  })
}

const findRowIssue = (
  row: ImportRow,
  seen: { usernames: Set<string>; extensions: Set<string> },
  users: User[],
  directory: UsersDirectory,
): ImportIssue | null => {
  if (row.username === '') {
    return 'missing_username'
  }

  if (!USERNAME_REGEX.test(row.username)) {
    return 'invalid_username'
  }

  if (row.fullName.trim() === '') {
    return 'missing_name'
  }

  if (row.extension !== '' && !isValidExtension(row.extension)) {
    return 'invalid_extension'
  }

  if (seen.usernames.has(row.username)) {
    return 'duplicate_username'
  }

  if (row.extension !== '' && seen.extensions.has(row.extension)) {
    return 'duplicate_extension'
  }

  if (
    row.extension !== '' &&
    users.some((user) => user.mainExtension === row.extension && user.username !== row.username)
  ) {
    return 'extension_in_use'
  }

  if (
    row.profile &&
    !directory.profiles.some((profile) => profile.name.toLowerCase() === row.profile?.toLowerCase())
  ) {
    return 'unknown_profile'
  }
  return null
}

export const analyzeImport = (
  rows: ImportRow[],
  users: User[],
  directory: UsersDirectory,
  existingUsersMode: ExistingUsersMode,
): ImportAnalysis => {
  const analysis: ImportAnalysis = {
    total: rows.length,
    valid: [],
    existing: [],
    errors: [],
    groups: [],
  }
  const seen = { usernames: new Set<string>(), extensions: new Set<string>() }

  for (const row of rows) {
    const issue = findRowIssue(row, seen, users, directory)

    if (issue) {
      analysis.errors.push({ row, issue })
      continue
    }
    seen.usernames.add(row.username)

    if (row.extension !== '') {
      seen.extensions.add(row.extension)
    }

    if (findUserByUsername(users, row.username) && existingUsersMode === 'skip') {
      analysis.existing.push(row)
    } else {
      analysis.valid.push(row)
    }
  }
  analysis.groups = [...new Set(rows.flatMap((row) => row.groups ?? []))]
  return analysis
}

const formatFlag = (flag: boolean | null): string => (flag === null ? '' : flag ? 'TRUE' : 'FALSE')

export const toLegacyCsvRow = (
  row: ImportRow,
  users: User[],
  directory: UsersDirectory,
): string[] => {
  const user = findUserByUsername(users, row.username)
  const keepsExtension = user !== undefined && user.mainExtension === row.extension
  const currentGroups = user
    ? directory.groups.filter((group) => group.userIds.includes(user.id)).map((group) => group.name)
    : []
  const currentProfile =
    directory.profiles.find((profile) => profile.id === user?.profileId)?.name ?? ''
  const cells = [
    row.username,
    row.fullName.trim(),
    keepsExtension ? '' : row.extension,
    row.password,
    row.mobile ?? (user ? (directory.mobiles[user.username] ?? '') : ''),
    keepsExtension ? '' : formatFlag(row.voicemail),
    keepsExtension ? '' : formatFlag(row.webrtc),
    (row.groups ?? currentGroups).join('|'),
    row.profile ?? currentProfile,
    keepsExtension ? '' : formatFlag(row.nethlink),
  ]
  const provided = [
    true,
    true,
    true,
    row.password !== '',
    row.mobile !== null,
    row.voicemail !== null,
    row.webrtc !== null,
    row.groups !== null,
    row.profile !== null,
    row.nethlink !== null,
  ]
  return cells.slice(0, provided.lastIndexOf(true) + 1)
}

export const toLegacyCsv = (rows: ImportRow[], users: User[], directory: UsersDirectory): string =>
  serializeCsv(rows.map((row) => toLegacyCsvRow(row, users, directory)))

export const buildCsvTemplate = (): string =>
  [
    CSV_TEMPLATE_COLUMNS.join(','),
    'a.miller,Anna,Miller,201,Sales,Base,,,FALSE,TRUE,FALSE',
    'c.davis,Christopher,Davis,202,Sales|Support,Standard,,3331234567,TRUE,TRUE,TRUE',
  ].join('\r\n') + '\r\n'

export const convertExportedCsv = (legacyCsv: string): string => {
  const rows = parseCsv(legacyCsv).map((cells) => [
    cells[0] ?? '',
    cells[1] ?? '',
    (cells[2] ?? '') === 'none' ? '' : (cells[2] ?? ''),
    cells[7] ?? '',
    cells[8] ?? '',
    cells[4] ?? '',
    cells[5] ?? '',
    cells[6] ?? '',
  ])
  return serializeCsv([CSV_EXPORT_COLUMNS, ...rows])
}

const ProgressSchema = v.object({
  result: v.nullable(v.pipe(v.union([v.number(), v.string()]), v.transform(Number))),
})

const StatusSchema = v.object({ status: v.string() })

export const parseCsvImportProgress = (raw: unknown): number =>
  v.parse(ProgressSchema, raw).result ?? 0

export const getCsvImportFailure = (error: unknown): string | null => {
  if (!isApiError(error) || error.status !== 500) {
    return null
  }
  const parsed = v.safeParse(StatusSchema, error.body)
  return parsed.success ? parsed.output.status.trim() : null
}

export const isCsvImportNotRunning = (error: unknown): boolean =>
  isApiError(error) && error.status === 422

export const postCsvImport = async (csv: string): Promise<void> => {
  const file = encodeBase64(csv)

  if (file.length > MAX_CSV_IMPORT_BASE64_LENGTH) {
    throw new CsvImportError('file_too_large')
  }
  await api.POST('/csv/csvimport', { body: { file }, parseAs: 'text' })
}

export const getCsvImportProgress = async (): Promise<number> => {
  const { data } = await api.GET('/csv/csvimport')
  return parseCsvImportProgress(data)
}

const wait = (milliseconds: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, milliseconds)
  })

export const runCsvImport = async (
  csv: string,
  onProgress: (progress: number) => void = () => undefined,
  pollInterval = CSV_IMPORT_POLL_INTERVAL,
): Promise<void> => {
  await postCsvImport(csv)
  let startAttempts = 0

  for (;;) {
    await wait(pollInterval)

    try {
      const progress = await getCsvImportProgress()
      onProgress(progress)

      if (progress >= 100) {
        return
      }
    } catch (error) {
      const failure = getCsvImportFailure(error)

      if (failure !== null) {
        throw new CsvImportError('import_failed', failure)
      }

      if (!isCsvImportNotRunning(error)) {
        throw error
      }
      startAttempts += 1

      if (startAttempts >= CSV_IMPORT_START_ATTEMPTS) {
        throw error
      }
    }
  }
}

export const getCsvExport = async (): Promise<string> => {
  const { data } = await api.GET('/csv/csvexport')
  return convertExportedCsv(decodeBase64(v.parse(v.string(), data)))
}

export const downloadTextFile = (fileName: string, content: string, mimeType = 'text/csv') => {
  const url = URL.createObjectURL(new Blob([content], { type: `${mimeType};charset=utf-8` }))
  const link = document.createElement('a')

  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
