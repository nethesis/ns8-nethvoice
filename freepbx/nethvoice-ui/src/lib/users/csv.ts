//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import * as v from 'valibot'
import { api } from '@/lib/api/client'
import { isApiError } from '@/lib/api/errors'
import { buildGroupFormSchema } from '@/lib/groups/groups'
import type { UsersDirectory } from '@/lib/users/directory'
import { isValidExtension } from '@/lib/users/extensions'
import { applyUserSettingsSteps, type UserSettingsStep } from '@/lib/users/userSettings'
import {
  findUserByUsername,
  getUsers,
  hasDevice,
  MAX_DEVICES_PER_USER,
  type SoftwareDeviceType,
  type User,
} from '@/lib/users/users'

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
  | 'mobileApp'

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
  mobileApp: boolean | null
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
  | 'invalid_group'
  | 'too_many_devices'

export type ImportRowError = {
  row: ImportRow
  issue: ImportIssue
  group?: string
  reason?: string
}

export type ExistingUsersMode = 'skip' | 'overwrite'

export const DEFAULT_EXISTING_USERS_MODE: ExistingUsersMode = 'overwrite'

export type ImportAnalysis = {
  total: number
  valid: ImportRow[]
  existing: ImportRow[]
  errors: ImportRowError[]
  groups: string[]
  newGroups: string[]
}

export type ImportFollowUp = {
  user: User
  steps: UserSettingsStep[]
}

export type CsvImportErrorCode = 'file_too_large' | 'import_failed' | 'settings_failed'

export class CsvImportError extends Error {
  readonly code: CsvImportErrorCode
  readonly cause: unknown

  constructor(code: CsvImportErrorCode, message = '', cause: unknown = undefined) {
    super(message)
    this.name = 'CsvImportError'
    this.code = code
    this.cause = cause
  }
}

export const isCsvImportError = (error: unknown): error is CsvImportError =>
  error instanceof CsvImportError

export type ImportFileErrorCode = 'missing_username_column'

export class ImportFileError extends Error {
  readonly code: ImportFileErrorCode

  constructor(code: ImportFileErrorCode) {
    super(code)
    this.name = 'ImportFileError'
    this.code = code
  }
}

export const isImportFileError = (error: unknown): error is ImportFileError =>
  error instanceof ImportFileError

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
  mobileapp: 'mobileApp',
  nomeutente: 'username',
  utente: 'username',
  nome: 'name',
  cognome: 'surname',
  nomecompleto: 'fullname',
  nomevisualizzato: 'fullname',
  interno: 'extension',
  gruppo: 'groups',
  gruppi: 'groups',
  profilo: 'profile',
  cellulare: 'mobile',
  numerocellulare: 'mobile',
  casellavocale: 'voicemail',
  segreteria: 'voicemail',
  telefonoweb: 'webrtc',
  appdesktop: 'nethlink',
  appmobile: 'mobileApp',
}

const MIN_HEADER_COLUMNS = 2

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
  'mobile_app',
]

export const CSV_EXPORT_COLUMNS = [
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
]

const CSV_BOM = '\ufeff'

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

const normalizeHeader = (cell: string): string =>
  cell
    .normalize('NFD')
    .toLowerCase()
    .replace(/[^a-z]/g, '')

const parseFlag = (value: string | undefined): boolean | null => {
  if (value === undefined || value.trim() === '') {
    return null
  }
  return ['true', '1', 'yes', 'si', 'sì', 'vero'].includes(value.trim().toLowerCase())
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

  if (
    !hasHeader &&
    headerColumns.filter((column) => column !== undefined).length >= MIN_HEADER_COLUMNS
  ) {
    throw new ImportFileError('missing_username_column')
  }
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
      mobileApp: parseFlag(value('mobileApp')),
    }
  })
}

const keepsCurrentExtension = (row: ImportRow, user: User | undefined): user is User =>
  user !== undefined && (row.extension === '' || user.mainExtension === row.extension)

const DEVICE_FLAGS: [
  SoftwareDeviceType,
  keyof Pick<ImportRow, 'webrtc' | 'nethlink' | 'mobileApp'>,
][] = [
  ['webrtc', 'webrtc'],
  ['nethlink', 'nethlink'],
  ['mobile', 'mobileApp'],
]

const planDeviceChanges = (row: ImportRow, user: User) => ({
  enable: DEVICE_FLAGS.filter(
    ([device, flag]) => row[flag] === true && !hasDevice(user, device),
  ).map(([device]) => device),
  disable: DEVICE_FLAGS.filter(
    ([device, flag]) => row[flag] === false && hasDevice(user, device),
  ).map(([device]) => device),
})

const exceedsDeviceLimit = (row: ImportRow, users: User[]): boolean => {
  const user = findUserByUsername(users, row.username)

  if (!keepsCurrentExtension(row, user) || user.mainExtension === '') {
    return false
  }
  const { enable, disable } = planDeviceChanges(row, user)
  return user.devices.length - disable.length + enable.length > MAX_DEVICES_PER_USER
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

  if (exceedsDeviceLimit(row, users)) {
    return 'too_many_devices'
  }
  return null
}

const sameName = (a: string, b: string): boolean =>
  a.trim().toLowerCase() === b.trim().toLowerCase()

const findGroupIssue = (
  row: ImportRow,
  existingGroups: string[],
  newGroups: string[],
): Pick<ImportRowError, 'group' | 'reason'> | null => {
  const accepted = [...newGroups]

  for (const group of row.groups ?? []) {
    if ([...existingGroups, ...accepted].some((name) => sameName(name, group))) {
      continue
    }
    const validation = v.safeParse(buildGroupFormSchema([...existingGroups, ...accepted]), {
      name: group,
      userIds: [],
    })

    if (!validation.success) {
      return { group, reason: validation.issues[0].message }
    }
    accepted.push(group)
  }
  return null
}

const uniqueNames = (names: string[]): string[] =>
  names.filter((name, index) => names.findIndex((other) => sameName(other, name)) === index)

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
    newGroups: [],
  }
  const seen = { usernames: new Set<string>(), extensions: new Set<string>() }
  const existingGroups = directory.groups.map((group) => group.name)

  for (const row of rows) {
    const issue = findRowIssue(row, seen, users, directory)

    if (issue) {
      analysis.errors.push({ row, issue })
      continue
    }
    const skipped = !!findUserByUsername(users, row.username) && existingUsersMode === 'skip'
    const groupIssue = skipped ? null : findGroupIssue(row, existingGroups, analysis.newGroups)

    if (groupIssue) {
      analysis.errors.push({ row, issue: 'invalid_group', ...groupIssue })
      continue
    }
    seen.usernames.add(row.username)

    if (row.extension !== '') {
      seen.extensions.add(row.extension)
    }

    if (skipped) {
      analysis.existing.push(row)
      continue
    }
    analysis.valid.push(row)
    analysis.newGroups = uniqueNames([
      ...analysis.newGroups,
      ...(row.groups ?? []).filter(
        (group) => !existingGroups.some((existing) => sameName(existing, group)),
      ),
    ])
  }
  analysis.groups = uniqueNames(
    rows
      .filter((row) => analysis.valid.includes(row) || analysis.existing.includes(row))
      .flatMap((row) => row.groups ?? []),
  )
  return analysis
}

const formatFlag = (flag: boolean | null): string => (flag === null ? '' : flag ? 'TRUE' : 'FALSE')

export const toLegacyCsvRow = (
  row: ImportRow,
  users: User[],
  directory: UsersDirectory,
): string[] => {
  const user = findUserByUsername(users, row.username)
  const keepsExtension = keepsCurrentExtension(row, user)
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

export const exceedsImportSizeLimit = (csv: string): boolean =>
  encodeBase64(csv).length > MAX_CSV_IMPORT_BASE64_LENGTH

export const needsFollowUps = (rows: ImportRow[], users: User[]): boolean =>
  rows.some(
    (row) =>
      row.mobileApp === true ||
      (keepsCurrentExtension(row, findUserByUsername(users, row.username)) &&
        (row.voicemail !== null || row.webrtc !== null || row.nethlink !== null)),
  )

export const planImportFollowUps = (
  rows: ImportRow[],
  usersBefore: User[],
  usersAfter: User[],
  directory: UsersDirectory,
): ImportFollowUp[] =>
  rows.flatMap((row) => {
    const user = findUserByUsername(usersAfter, row.username)

    if (!user || user.mainExtension === '') {
      return []
    }
    const keepsExtension = keepsCurrentExtension(row, findUserByUsername(usersBefore, row.username))
    const { enable, disable } = planDeviceChanges(
      keepsExtension
        ? row
        : {
            ...row,
            voicemail: null,
            webrtc: null,
            nethlink: null,
            mobileApp: row.mobileApp || null,
          },
      user,
    )
    const hasVoicemail = directory.voicemailExtensions.includes(user.mainExtension)
    const steps: UserSettingsStep[] = [
      ...(keepsExtension && row.voicemail !== null && row.voicemail !== hasVoicemail
        ? [{ kind: 'voicemail' as const, enabled: row.voicemail }]
        : []),
      ...disable.map((device) => ({ kind: 'disable_device' as const, device })),
      ...enable.map((device) => ({ kind: 'enable_device' as const, device })),
    ]

    return steps.length > 0 ? [{ user, steps }] : []
  })

export const buildCsvTemplate = (): string =>
  [
    CSV_TEMPLATE_COLUMNS.join(','),
    'a.miller,Anna,Miller,201,Sales,Base,,,FALSE,TRUE,FALSE,FALSE',
    'c.davis,Christopher,Davis,202,Sales|Support,Standard,,3331234567,TRUE,TRUE,TRUE,TRUE',
  ].join('\r\n') + '\r\n'

const formatDevice = (user: User | undefined, device: SoftwareDeviceType): string =>
  user ? formatFlag(hasDevice(user, device)) : ''

export const convertExportedCsv = (legacyCsv: string, users: User[] = []): string => {
  const rows = parseCsv(legacyCsv).map((cells) => {
    const user = findUserByUsername(users, cells[0] ?? '')

    return [
      cells[0] ?? '',
      cells[1] ?? '',
      (cells[2] ?? '') === 'none' ? '' : (cells[2] ?? ''),
      cells[7] ?? '',
      cells[8] ?? '',
      cells[4] ?? '',
      cells[5] ?? '',
      cells[6] ?? '',
      formatDevice(user, 'nethlink'),
      formatDevice(user, 'mobile'),
    ]
  })
  return serializeCsv([CSV_EXPORT_COLUMNS, ...rows])
}

const padDatePart = (value: number): string => String(value).padStart(2, '0')

export const buildExportFileName = (date: Date = new Date()): string =>
  `users-${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}.csv`

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
  if (exceedsImportSizeLimit(csv)) {
    throw new CsvImportError('file_too_large')
  }
  await api.POST('/csv/csvimport', { body: { file: encodeBase64(csv) }, parseAs: 'text' })
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

export const IMPORT_FOLLOW_UPS_SHARE = 20

export const applyImportFollowUps = async (
  followUps: ImportFollowUp[],
  onProgress: (progress: number) => void = () => undefined,
): Promise<void> => {
  for (const [index, { user, steps }] of followUps.entries()) {
    try {
      await applyUserSettingsSteps(user, steps)
    } catch (error) {
      throw new CsvImportError('settings_failed', user.username, error)
    }
    onProgress(Math.round(((index + 1) / followUps.length) * 100))
  }
}

export const importUsers = async (
  rows: ImportRow[],
  users: User[],
  directory: UsersDirectory,
  onProgress: (progress: number) => void = () => undefined,
  pollInterval = CSV_IMPORT_POLL_INTERVAL,
): Promise<void> => {
  const withFollowUps = needsFollowUps(rows, users)
  const importShare = withFollowUps ? 100 - IMPORT_FOLLOW_UPS_SHARE : 100

  await runCsvImport(
    toLegacyCsv(rows, users, directory),
    (progress) => onProgress(Math.round((progress * importShare) / 100)),
    pollInterval,
  )

  if (!withFollowUps) {
    return
  }
  const followUps = planImportFollowUps(rows, users, await getUsers(), directory)

  await applyImportFollowUps(followUps, (progress) =>
    onProgress(importShare + Math.round((progress * IMPORT_FOLLOW_UPS_SHARE) / 100)),
  )
  onProgress(100)
}

export const getCsvExport = async (): Promise<string> => {
  const [{ data }, users] = await Promise.all([api.GET('/csv/csvexport'), getUsers()])
  return convertExportedCsv(decodeBase64(v.parse(v.string(), data)), users)
}

export const downloadTextFile = (fileName: string, content: string, mimeType = 'text/csv') => {
  const body = mimeType === 'text/csv' && !content.startsWith(CSV_BOM) ? CSV_BOM + content : content
  const url = URL.createObjectURL(new Blob([body], { type: `${mimeType};charset=utf-8` }))
  const link = document.createElement('a')

  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
