//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import * as v from 'valibot'
import { api } from '@/lib/api/client'
import type { components } from '@/lib/api/schema'
import { isApiError } from '@/lib/api/errors'
import { compareNatural, foldText } from '@/lib/common'
import { isLocalHost } from './dbConnections'
import { type FieldIssues, isValidPort, requiredText, validateForm } from './validation'

export const PHONEBOOK_SOURCES_KEY = 'phonebookSources'
export const PHONEBOOK_FIELDS_KEY = 'phonebookFields'
export const PHONEBOOK_STATUS_KEY = 'phonebookStatus'

export const PHONEBOOK_STATUS_POLL_INTERVAL = 5000

export const PHONEBOOK_STATUS_REFRESH_INTERVAL = 60_000

export const PHONEBOOK_SOURCE_KINDS = ['mysql', 'mssql', 'csv', 'infinity'] as const

export type PhonebookSourceKind = (typeof PHONEBOOK_SOURCE_KINDS)[number]

export const DEFAULT_SYNC_INTERVAL = 1440

export const DEFAULT_SOURCE_QUERY = 'SELECT * FROM [table]'

export const NOT_IMPORTED = '-'

export const PREVIEW_ROWS = 3

export const CSV_MAX_SIZE = 8 * 1024 * 1024

const CSV_EXTENSIONS = ['.csv', '.txt']

export const UPLOADED_CSV_PREFIX = 'file:///var/lib/nethvoice/phonebook/uploads/'

export const INFINITY_FIELD_MAPPING = [
  { source: 'name', field: 'name' },
  { source: 'company', field: 'company' },
  { source: 'mobile_phone', field: 'cellphone' },
  { source: 'work_phone', field: 'workphone' },
  { source: 'home_phone', field: 'homephone' },
  { source: 'fax', field: 'fax' },
  { source: 'work_email', field: 'workemail' },
  { source: 'home_email', field: 'homeemail' },
  { source: 'address', field: 'workstreet' },
  { source: 'office', field: 'title' },
  { source: 'office_status_id', field: 'notes' },
]

export const PHONEBOOK_FIELD_ORDER = [
  'name',
  'firstname',
  'lastname',
  'company',
  'title',
  'job',
  'workphone',
  'workphone2',
  'cellphone',
  'cellphone2',
  'homephone',
  'otherphone',
  'fax',
  'workemail',
  'homeemail',
  'otheremail',
  'workstreet',
  'workpob',
  'workcity',
  'workprovince',
  'workpostalcode',
  'workcountry',
  'homestreet',
  'homepob',
  'homecity',
  'homeprovince',
  'homepostalcode',
  'homecountry',
  'url',
  'notes',
  'facebook',
  'instagram',
  'linkedin',
  'owner_id',
]

const COLUMN_SYNONYMS: Record<string, string[]> = {
  name: ['contact_name', 'referente', 'nome'],
  company: ['company_name', 'ragionesociale', 'azienda'],
  workphone: ['phone', 'telefono'],
  cellphone: ['mobile', 'cellulare'],
  workemail: ['email'],
  workcity: ['city', 'citta'],
}

export const NAME_FIELDS = ['name', 'firstname', 'lastname']

const DEFAULT_PORTS: Record<PhonebookSourceKind, string> = {
  mysql: '3306',
  mssql: '1433',
  csv: '',
  infinity: '',
}

const HIDDEN_SOURCE_COLUMNS = ['type']

const OWNER_FIELD = 'owner_id'

type PhonebookSourceInput = components['schemas']['IntegrationsPhonebookSourceInput']

type PhonebookTestInput = components['schemas']['IntegrationsPhonebookTestInput']

const TextSchema = v.pipe(
  v.nullish(v.union([v.string(), v.number()]), ''),
  v.transform((value) => String(value)),
)

const RawSourceSchema = v.object({
  dbtype: v.string(),
  host: TextSchema,
  port: TextSchema,
  user: TextSchema,
  password: TextSchema,
  has_password: v.optional(v.boolean()),
  dbname: TextSchema,
  query: TextSchema,
  url: TextSchema,
  username: TextSchema,
  mapping: v.nullish(v.union([v.record(v.string(), v.string()), v.array(v.unknown())]), {}),
  interval: v.nullish(v.union([v.number(), v.string()]), DEFAULT_SYNC_INTERVAL),
  type: TextSchema,
  access: TextSchema,
  enabled: v.nullish(v.union([v.boolean(), v.string(), v.number()]), false),
})

const SourcesResponseSchema = v.union([v.record(v.string(), RawSourceSchema), v.array(v.unknown())])

const FieldsResponseSchema = v.array(v.string())

const RowsSchema = v.array(v.record(v.string(), v.unknown()))

const TestResponseSchema = v.union([
  RowsSchema,
  v.object({ rows: RowsSchema, total: v.pipe(v.number(), v.integer(), v.minValue(0)) }),
])

const READ_ERROR_KINDS = [
  'connection',
  'auth',
  'query',
  'file',
  'http',
  'format',
  'unknown',
] as const

export type PhonebookReadErrorKind = (typeof READ_ERROR_KINDS)[number]

const TestFailureSchema = v.object({
  status: v.literal(false),
  error: v.optional(
    v.object({
      kind: v.fallback(v.picklist(READ_ERROR_KINDS), 'unknown'),
      details: v.fallback(v.string(), ''),
    }),
  ),
})

const UploadResponseSchema = v.object({
  uri: v.pipe(v.string(), v.startsWith('file:///')),
})

const SourceIdResponseSchema = v.object({ id: v.string() })

const SyncStatusResponseSchema = v.array(
  v.object({
    id: v.string(),
    status: v.picklist(['running', 'ok', 'failed']),
    started_at: v.string(),
    finished_at: v.nullish(v.string(), null),
    imported: v.nullish(v.number(), null),
    message: v.nullish(v.string(), null),
  }),
)

export type PhonebookSource = {
  id: string
  name: string
  kind: PhonebookSourceKind | 'unknown'
  host: string
  port: string
  user: string
  hasPassword: boolean
  database: string
  query: string
  url: string
  username: string
  mapping: Record<string, string>
  interval: number
  groups: string[]
  enabled: boolean
}

export type CsvFrom = 'url' | 'upload'

export type PhonebookSourceForm = {
  kind: PhonebookSourceKind
  name: string
  host: string
  port: string
  user: string
  password: string
  database: string
  query: string
  csvFrom: CsvFrom
  url: string
  uploadedUrl: string
  username: string
  mapping: Record<string, string>
  interval?: number
  sharing: 'public' | 'groups'
  groups: string[]
  enabled: boolean
}

export type PhonebookPreview = {
  rows: Record<string, string>[]
  columns: string[]
  total?: number
}

export type PhonebookTestResult =
  ({ ok: true } & PhonebookPreview) | { ok: false; kind: PhonebookReadErrorKind; details: string }

export type PhonebookSyncState = 'running' | 'ok' | 'failed'

export type PhonebookSyncStatus = {
  id: string
  status: PhonebookSyncState
  startedAt: Date
  finishedAt: Date | null
  imported: number | null
  message: string | null
}

export type LastSyncDisplay =
  | { state: 'syncing' }
  | { state: 'never' }
  | { state: 'ok' | 'failed'; day: 'today' | 'yesterday' | 'date'; at: Date }

export type FieldOption = { id: string; label: string; description?: string }

export type SourceFieldsContext = {
  existing?: PhonebookSource
  sameQuery?: boolean
  otherNames?: string[]
  hasFile?: boolean
}

export const isPhonebookSourceKind = (kind: string): kind is PhonebookSourceKind =>
  PHONEBOOK_SOURCE_KINDS.some((item) => item === kind)

export const isDatabaseKind = (kind: string): kind is 'mysql' | 'mssql' =>
  kind === 'mysql' || kind === 'mssql'

export const isPbxDatabaseSource = (source: Pick<PhonebookSource, 'kind' | 'host'>): boolean =>
  isDatabaseKind(source.kind) && isLocalHost(source.host)

export const isUploadedCsv = (url: string) => url.startsWith(UPLOADED_CSV_PREFIX)

export const getUploadedCsvName = (url: string): string | undefined => {
  const name = isUploadedCsv(url) ? url.slice(UPLOADED_CSV_PREFIX.length) : ''
  return /^[\w-]+\.csv$/.test(name) ? name : undefined
}

export const validateCsvFile = (file: Pick<File, 'name' | 'size'>): string => {
  const name = file.name.toLowerCase()

  if (!CSV_EXTENSIONS.some((extension) => name.endsWith(extension))) {
    return 'integrations.phonebook.csv_file_invalid'
  }

  if (file.size === 0) {
    return 'integrations.phonebook.csv_file_empty'
  }

  if (file.size > CSV_MAX_SIZE) {
    return 'integrations.phonebook.csv_file_too_large'
  }
  return ''
}

export const isCsvUploadRejected = (error: unknown): boolean =>
  isApiError(error) && error.status === 400

export const getDefaultPort = (kind: PhonebookSourceKind) => DEFAULT_PORTS[kind]

export const parseSharingGroups = (access: string): string[] =>
  access.startsWith('group:')
    ? access
        .slice('group:'.length)
        .split(',')
        .map((group) => group.trim())
        .filter((group) => group !== '')
    : []

export const buildAccess = (groups: string[]): string =>
  groups.length > 0 ? `group:${groups.join(',')}` : 'public'

const cleanMapping = (mapping: Record<string, string>): Record<string, string> =>
  Object.fromEntries(
    Object.entries(mapping).filter(([, field]) => field !== '' && field !== NOT_IMPORTED),
  )

export const parsePhonebookSources = (raw: unknown): PhonebookSource[] => {
  const response = v.parse(SourcesResponseSchema, raw)

  if (Array.isArray(response)) {
    return []
  }

  return Object.entries(response)
    .map(([id, source]): PhonebookSource => {
      const interval = Number(source.interval)

      return {
        id,
        name: source.type || source.dbname || id,
        kind: isPhonebookSourceKind(source.dbtype) ? source.dbtype : 'unknown',
        host: source.host,
        port: source.port,
        user: source.user,
        hasPassword: source.has_password ?? source.password !== '',
        database: source.dbname,
        query: source.query,
        url: source.url,
        username: source.username,
        mapping: Array.isArray(source.mapping) ? {} : cleanMapping(source.mapping),
        interval: Number.isFinite(interval) && interval > 0 ? interval : DEFAULT_SYNC_INTERVAL,
        groups: parseSharingGroups(source.access),
        enabled: [true, 'true', '1', 1].includes(source.enabled),
      }
    })
    .sort((a, b) => compareNatural(a.name, b.name))
}

const toText = (value: unknown): string => (value == null ? '' : String(value))

export const parsePhonebookTestResult = (raw: unknown): PhonebookTestResult => {
  const failure = v.safeParse(TestFailureSchema, raw)

  if (failure.success) {
    return {
      ok: false,
      kind: failure.output.error?.kind ?? 'unknown',
      details: failure.output.error?.details.trim() ?? '',
    }
  }
  const result = v.safeParse(TestResponseSchema, raw)

  if (!result.success) {
    return { ok: false, kind: 'unknown', details: '' }
  }
  const [rawRows, total] = Array.isArray(result.output)
    ? [result.output, undefined]
    : [result.output.rows, result.output.total]
  const rows = rawRows.map((row) =>
    Object.fromEntries(Object.entries(row).map(([column, value]) => [column, toText(value)])),
  )

  return {
    ok: true,
    columns: Object.keys(rows[0] ?? {}),
    rows: total === 0 ? [] : rows.slice(0, PREVIEW_ROWS),
    ...(total === undefined ? {} : { total }),
  }
}

export const getReadErrorTexts = (
  kind: PhonebookReadErrorKind,
  sourceKind: PhonebookSourceKind,
): { title: string; description: string } => {
  const database = isDatabaseKind(sourceKind)

  switch (kind) {
    case 'connection':
    case 'auth':
      if (sourceKind === 'csv') {
        return {
          title: 'integrations.phonebook.cannot_download_file',
          description: 'integrations.phonebook.read_error_csv_connection',
        }
      }
      return {
        title: database
          ? 'integrations.phonebook.cannot_connect_database'
          : 'integrations.phonebook.cannot_connect_infinity',
        description:
          kind === 'auth'
            ? 'integrations.phonebook.read_error_auth'
            : database
              ? 'integrations.phonebook.read_error_connection_database'
              : 'integrations.phonebook.read_error_connection_infinity',
      }
    case 'query':
      return {
        title: 'integrations.phonebook.cannot_run_query',
        description: 'integrations.phonebook.read_error_query',
      }
    case 'http':
      return {
        title:
          sourceKind === 'infinity'
            ? 'integrations.phonebook.cannot_connect_infinity'
            : 'integrations.phonebook.cannot_download_file',
        description: 'integrations.phonebook.read_error_http',
      }
    case 'file':
    case 'format':
      if (kind === 'file' || sourceKind === 'csv') {
        return {
          title: 'integrations.phonebook.cannot_read_file',
          description: 'integrations.phonebook.read_error_file',
        }
      }
      return {
        title: 'integrations.phonebook.cannot_read_source',
        description: 'integrations.phonebook.read_error_format',
      }
    default:
      return {
        title: 'integrations.phonebook.cannot_read_source',
        description: 'integrations.phonebook.read_error_unknown',
      }
  }
}

export const emptyPhonebookSourceForm = (): PhonebookSourceForm => ({
  kind: 'mysql',
  name: '',
  host: '',
  port: '',
  user: '',
  password: '',
  database: '',
  query: DEFAULT_SOURCE_QUERY,
  csvFrom: 'url',
  url: '',
  uploadedUrl: '',
  username: '',
  mapping: {},
  sharing: 'public',
  groups: [],
  enabled: true,
})

export const toPhonebookSourceForm = (source: PhonebookSource): PhonebookSourceForm => {
  const uploaded = source.kind === 'csv' && isUploadedCsv(source.url)

  return {
    kind: source.kind === 'unknown' ? 'mysql' : source.kind,
    name: source.name,
    host: source.host,
    port: source.port,
    user: source.user,
    password: '',
    database: source.database,
    query: source.query,
    csvFrom: uploaded ? 'upload' : 'url',
    url: uploaded ? '' : source.url,
    uploadedUrl: uploaded ? source.url : '',
    username: source.username,
    mapping: { ...source.mapping },
    interval: source.interval,
    sharing: source.groups.length > 0 ? 'groups' : 'public',
    groups: [...source.groups],
    enabled: source.enabled,
  }
}

export const getConnectionSignature = (form: PhonebookSourceForm, fileKey = ''): string =>
  JSON.stringify(
    isDatabaseKind(form.kind)
      ? [form.kind, form.database, form.host, form.port, form.user, form.password, form.query]
      : form.kind === 'csv'
        ? [form.kind, form.csvFrom, form.csvFrom === 'url' ? form.url : fileKey]
        : [form.kind, form.url, form.username, form.password],
  )

export const getFormSnapshot = (form: PhonebookSourceForm, fileKey: string): string =>
  JSON.stringify([{ ...form, mapping: cleanMapping(form.mapping) }, fileKey])

export const getFileKey = (file: Pick<File, 'name' | 'size' | 'lastModified'> | null): string =>
  file ? `${file.name}|${file.size}|${file.lastModified}` : ''

export const getMappingColumns = (columns: string[]): string[] =>
  columns.filter((column) => !HIDDEN_SOURCE_COLUMNS.includes(column))

export const getInfinityPreviewColumns = (rows: Record<string, string>[]): string[] =>
  INFINITY_FIELD_MAPPING.map(({ field }) => field).filter((field) =>
    rows.some((row) => field in row),
  )

export const orderPhonebookFields = (fields: string[]): string[] => [
  ...PHONEBOOK_FIELD_ORDER.filter((field) => fields.includes(field)),
  ...fields.filter((field) => !PHONEBOOK_FIELD_ORDER.includes(field)),
]

export const getAvailableFields = (
  fields: string[],
  mapping: Record<string, string>,
  column: string,
  withOwner: boolean,
): string[] => {
  const usedByOthers = Object.entries(mapping)
    .filter(([source]) => source !== column)
    .map(([, field]) => field)

  return orderPhonebookFields(fields).filter(
    (field) => !usedByOthers.includes(field) && (withOwner || field !== OWNER_FIELD),
  )
}

const matchesField = (column: string, field: string): boolean => {
  const name = foldText(column)
  return name === field || (COLUMN_SYNONYMS[field] ?? []).includes(name)
}

export const suggestMapping = (
  columns: string[],
  fields: string[],
  mapping: Record<string, string>,
  withOwner: boolean,
): Record<string, string> => {
  const suggested: Record<string, string> = {}

  for (const column of getMappingColumns(columns)) {
    if (mapping[column]) {
      suggested[column] = mapping[column]
    }
  }

  for (const column of getMappingColumns(columns)) {
    if (column in suggested) {
      continue
    }
    const field = getAvailableFields(fields, suggested, column, withOwner).find((candidate) =>
      matchesField(column, candidate),
    )

    if (field) {
      suggested[column] = field
    }
  }
  return suggested
}

export const completeMapping = (
  columns: string[],
  mapping: Record<string, string>,
): Record<string, string> =>
  Object.fromEntries(
    getMappingColumns(columns).map((column) => [column, mapping[column] || NOT_IMPORTED]),
  )

export const validatePhonebookMapping = (
  columns: string[],
  mapping: Record<string, string>,
): FieldIssues =>
  Object.fromEntries(
    getMappingColumns(columns)
      .filter((column) => !mapping[column])
      .map((column) => [column, 'integrations.phonebook.field_required']),
  )

export const hasNameColumn = (mapping: Record<string, string>): boolean =>
  Object.values(mapping).includes('name')

export const hasAnyNameColumn = (mapping: Record<string, string>): boolean =>
  Object.values(mapping).some((field) => NAME_FIELDS.includes(field))

export const isNameTaken = (name: string, otherNames: string[]): boolean => {
  const wanted = name.trim().toLowerCase()
  return wanted !== '' && otherNames.some((other) => other.trim().toLowerCase() === wanted)
}

const OptionalPortSchema = v.pipe(
  v.string(),
  v.trim(),
  v.check((port) => port === '' || isValidPort(port), 'integrations.port_invalid'),
)

const HTTP_URL = /^https?:\/\/\S+$/i

const buildSourceSchema = (passwordRequired: boolean) => {
  const name = requiredText('integrations.phonebook.name_required')
  const password = passwordRequired ? requiredText('integrations.password_required') : v.string()

  return v.variant('kind', [
    v.object({
      kind: v.literal('mysql'),
      name,
      database: requiredText('integrations.cards.database_name_required'),
      host: requiredText('integrations.cards.database_address_required'),
      port: OptionalPortSchema,
      user: requiredText('integrations.cards.database_username_required'),
      password,
      query: v.pipe(
        requiredText('integrations.query_required'),
        v.check((query) => !query.includes('[table]'), 'integrations.phonebook.query_table'),
      ),
    }),
    v.object({
      kind: v.literal('mssql'),
      name,
      database: requiredText('integrations.cards.database_name_required'),
      host: v.pipe(
        requiredText('integrations.cards.database_address_required'),
        v.check((host) => !host.includes('\\'), 'integrations.phonebook.mssql_instance'),
      ),
      port: OptionalPortSchema,
      user: requiredText('integrations.cards.database_username_required'),
      password,
      query: v.pipe(
        requiredText('integrations.query_required'),
        v.check((query) => !query.includes('[table]'), 'integrations.phonebook.query_table'),
      ),
    }),
    v.object({
      kind: v.literal('csv'),
      name,
      csvFrom: v.picklist(['url', 'upload']),
      url: v.string(),
    }),
    v.object({
      kind: v.literal('infinity'),
      name,
      url: v.pipe(
        requiredText('integrations.url_required'),
        v.regex(HTTP_URL, 'integrations.url_invalid'),
      ),
      username: requiredText('integrations.phonebook.username_required'),
      password,
    }),
  ])
}

const getPort = (form: PhonebookSourceForm) => form.port.trim() || getDefaultPort(form.kind)

export const isPhonebookPasswordKept = (
  form: PhonebookSourceForm,
  existing?: PhonebookSource,
  sameQuery = false,
): boolean => {
  if (!existing?.hasPassword || form.kind !== existing.kind) {
    return false
  }

  if (form.kind === 'infinity') {
    return form.url.trim() === existing.url.trim()
  }
  return (
    form.host.trim() === existing.host.trim() &&
    getPort(form) === (existing.port.trim() || getDefaultPort(form.kind)) &&
    (!sameQuery ||
      (form.database.trim() === existing.database.trim() &&
        form.user.trim() === existing.user.trim() &&
        form.query.trim() === existing.query.trim()))
  )
}

const validateCsvLocation = (
  form: PhonebookSourceForm,
  existing: PhonebookSource | undefined,
  hasFile: boolean,
): FieldIssues => {
  if (form.csvFrom === 'upload') {
    return hasFile || form.uploadedUrl ? {} : { file: 'integrations.phonebook.file_required' }
  }
  const url = form.url.trim()

  if (url === '') {
    return { url: 'integrations.url_required' }
  }

  if (!HTTP_URL.test(url) && !(existing && url === existing.url.trim())) {
    return { url: 'integrations.url_invalid' }
  }
  return {}
}

export const validatePhonebookSourceFields = (
  form: PhonebookSourceForm,
  { existing, sameQuery = false, otherNames = [], hasFile = false }: SourceFieldsContext = {},
): FieldIssues => {
  const issues = validateForm(
    buildSourceSchema(!isPhonebookPasswordKept(form, existing, sameQuery)),
    form,
  )

  if (!issues.name && isNameTaken(form.name, otherNames)) {
    issues.name = 'integrations.phonebook.name_taken'
  }

  const ordered: FieldIssues = { ...(issues.name ? { name: issues.name } : {}) }

  if (form.kind === 'csv') {
    Object.assign(ordered, validateCsvLocation(form, existing, hasFile))
  }

  for (const field of [
    'database',
    'host',
    'port',
    'url',
    'user',
    'username',
    'password',
    'query',
  ]) {
    if (issues[field]) {
      ordered[field] = issues[field]
    }
  }
  return ordered
}

export const validatePhonebookVisibility = (form: {
  sharing: 'public' | 'groups'
  groups: string[]
}): FieldIssues =>
  form.sharing === 'groups' && form.groups.length === 0
    ? { groups: 'integrations.phonebook.groups_required' }
    : {}

const buildConnection = (form: PhonebookSourceForm) => {
  const password = form.password ? { password: form.password } : {}

  if (isDatabaseKind(form.kind)) {
    return {
      dbtype: form.kind,
      host: form.host.trim(),
      port: getPort(form),
      user: form.user.trim(),
      ...password,
      dbname: form.database.trim(),
      query: form.query.trim(),
    }
  }

  if (form.kind === 'csv') {
    return {
      dbtype: form.kind,
      url: form.csvFrom === 'upload' ? form.uploadedUrl : form.url.trim(),
    }
  }
  return { dbtype: form.kind, url: form.url.trim(), username: form.username.trim(), ...password }
}

export const isLocalHostRefusal = (error: unknown, form: PhonebookSourceForm): boolean =>
  isDatabaseKind(form.kind) && isApiError(error) && error.status === 403

export const buildPhonebookTestPayload = (
  form: PhonebookSourceForm,
  existing?: PhonebookSource,
): PhonebookTestInput => ({
  ...buildConnection(form),
  ...(existing && !form.password && form.kind !== 'csv' ? { id: existing.id } : {}),
  with_total: true,
})

export const buildPhonebookSourcePayload = (form: PhonebookSourceForm): PhonebookSourceInput => ({
  ...buildConnection(form),
  ...(form.kind === 'infinity' ? {} : { mapping: cleanMapping(form.mapping) }),
  type: form.name.trim(),
  access: buildAccess(form.sharing === 'groups' ? form.groups : []),
  ...(form.interval === undefined ? {} : { interval: form.interval }),
  enabled: form.enabled,
})

export const parsePhonebookSyncStatuses = (raw: unknown): PhonebookSyncStatus[] =>
  v.parse(SyncStatusResponseSchema, raw).map((item) => ({
    id: item.id,
    status: item.status,
    startedAt: new Date(item.started_at),
    finishedAt: item.finished_at ? new Date(item.finished_at) : null,
    imported: item.imported,
    message: item.message,
  }))

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate())

export const getLastSyncDisplay = (
  status: PhonebookSyncStatus | undefined,
  syncing: boolean,
  now: Date,
): LastSyncDisplay => {
  if (syncing || status?.status === 'running') {
    return { state: 'syncing' }
  }

  if (!status) {
    return { state: 'never' }
  }
  const at = status.finishedAt ?? status.startedAt
  const days = Math.round((startOfDay(now).getTime() - startOfDay(at).getTime()) / 86_400_000)

  return {
    state: status.status,
    day: days === 0 ? 'today' : days === 1 ? 'yesterday' : 'date',
    at,
  }
}

export const getPhonebookSources = async (): Promise<PhonebookSource[]> => {
  const { data } = await api.GET('/phonebook/config')
  return parsePhonebookSources(data)
}

export const getPhonebookFields = async (): Promise<string[]> => {
  const { data } = await api.GET('/phonebook/fields')
  return v.parse(FieldsResponseSchema, data)
}

export const getPhonebookSyncStatuses = async (): Promise<PhonebookSyncStatus[]> => {
  const { data } = await api.GET('/phonebook/status')
  return parsePhonebookSyncStatuses(data)
}

export const savePhonebookSource = async (
  payload: PhonebookSourceInput,
  id?: string,
): Promise<string | undefined> => {
  const { data } = id
    ? await api.POST('/phonebook/config/{id}', { params: { path: { id } }, body: payload })
    : await api.POST('/phonebook/config', { body: payload })
  const result = v.safeParse(SourceIdResponseSchema, data)

  return result.success ? result.output.id : id
}

export const deletePhonebookSource = async (id: string): Promise<void> => {
  await api.DELETE('/phonebook/config/{id}', { params: { path: { id } } })
}

export const testPhonebookSource = async (
  payload: PhonebookTestInput,
): Promise<PhonebookTestResult> => {
  const { data } = await api.POST('/phonebook/test', { body: payload })
  return parsePhonebookTestResult(data)
}

export const syncPhonebookSource = async (id: string): Promise<void> => {
  await api.POST('/phonebook/syncnow/{id}', { params: { path: { id } }, body: { force: true } })
}

export const deletePhonebookUploads = async (urls: string[]): Promise<void> => {
  const names = urls.flatMap((url) => getUploadedCsvName(url) ?? [])

  await Promise.allSettled(
    names.map((name) => api.DELETE('/phonebook/uploadfile/{name}', { params: { path: { name } } })),
  )
}

export const uploadPhonebookCsv = async (file: File): Promise<string> => {
  const formData = new FormData()
  formData.append('file', file)

  const { data } = await api.POST('/phonebook/uploadfile', {
    body: { file: file.name },
    bodySerializer: () => formData,
  })
  return v.parse(UploadResponseSchema, data).uri
}
