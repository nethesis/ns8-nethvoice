//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import * as v from 'valibot'
import { api } from '@/lib/api/client'
import type { components } from '@/lib/api/schema'
import { isApiError } from '@/lib/api/errors'
import { compareNatural } from '@/lib/common'
import {
  type FieldIssues,
  HttpUrlSchema,
  PortSchema,
  requiredText,
  validateForm,
} from './validation'

export const PHONEBOOK_SOURCES_KEY = 'phonebookSources'
export const PHONEBOOK_FIELDS_KEY = 'phonebookFields'

export const PHONEBOOK_SOURCE_KINDS = ['mysql', 'mssql', 'csv', 'infinity'] as const

export type PhonebookSourceKind = (typeof PHONEBOOK_SOURCE_KINDS)[number]

export const PHONEBOOK_SYNC_INTERVALS = [15, 30, 60, 360, 1440]

export const DEFAULT_SYNC_INTERVAL = 1440

export const DEFAULT_SOURCE_QUERY = 'SELECT * FROM [table]'

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

const DEFAULT_PORTS: Record<PhonebookSourceKind, string> = {
  mysql: '3306',
  mssql: '1433',
  csv: '',
  infinity: '',
}

const HIDDEN_SOURCE_COLUMNS = ['type']

const CSV_EXCLUDED_FIELDS = ['owner_id']

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

const TestRowsSchema = v.array(v.record(v.string(), v.unknown()))

const UploadResponseSchema = v.object({
  uri: v.pipe(v.string(), v.startsWith('file:///')),
})

export type PhonebookSource = {
  id: string
  name: string
  kind: PhonebookSourceKind | 'unknown'
  host: string
  port: string
  user: string
  password: string
  database: string
  query: string
  url: string
  username: string
  mapping: Record<string, string>
  interval: number
  groups: string[]
  enabled: boolean
}

export type PhonebookSourceForm = {
  kind: PhonebookSourceKind
  name: string
  host: string
  port: string
  user: string
  password: string
  database: string
  query: string
  url: string
  username: string
  mapping: Record<string, string>
  interval: number
  sharing: 'public' | 'groups'
  groups: string[]
  enabled: boolean
}

export type PhonebookTestResult =
  { ok: true; rows: Record<string, string>[]; columns: string[] } | { ok: false }

export const isPhonebookSourceKind = (kind: string): kind is PhonebookSourceKind =>
  PHONEBOOK_SOURCE_KINDS.some((item) => item === kind)

export const isDatabaseKind = (kind: string): kind is 'mysql' | 'mssql' =>
  kind === 'mysql' || kind === 'mssql'

export const isUploadedCsv = (url: string) => url.startsWith(UPLOADED_CSV_PREFIX)

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

export const getSyncIntervals = (current: number): number[] =>
  [...new Set([...PHONEBOOK_SYNC_INTERVALS, current])]
    .filter((minutes) => Number.isInteger(minutes) && minutes > 0)
    .sort((a, b) => a - b)

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
  Object.fromEntries(Object.entries(mapping).filter(([, field]) => field !== ''))

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
        password: source.password,
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

export const parsePhonebookTestResult = (raw: unknown): PhonebookTestResult => {
  const result = v.safeParse(TestRowsSchema, raw)

  if (!result.success) {
    return { ok: false }
  }
  const rows = result.output.map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([column, value]) => [column, value == null ? '' : String(value)]),
    ),
  )

  return { ok: true, rows, columns: Object.keys(rows[0] ?? {}) }
}

export const emptyPhonebookSourceForm = (): PhonebookSourceForm => ({
  kind: 'mysql',
  name: '',
  host: '',
  port: getDefaultPort('mysql'),
  user: '',
  password: '',
  database: '',
  query: '',
  url: '',
  username: '',
  mapping: {},
  interval: DEFAULT_SYNC_INTERVAL,
  sharing: 'public',
  groups: [],
  enabled: true,
})

export const toPhonebookSourceForm = (source: PhonebookSource): PhonebookSourceForm => ({
  kind: source.kind === 'unknown' ? 'mysql' : source.kind,
  name: source.name,
  host: source.host,
  port: source.port,
  user: source.user,
  password: '',
  database: source.database,
  query: source.query,
  url: source.url,
  username: source.username,
  mapping: { ...source.mapping },
  interval: source.interval,
  sharing: source.groups.length > 0 ? 'groups' : 'public',
  groups: [...source.groups],
  enabled: source.enabled,
})

export const getMappingColumns = (
  testedColumns: string[],
  mapping: Record<string, string>,
): string[] =>
  [...new Set([...testedColumns, ...Object.keys(mapping)])].filter(
    (column) => !HIDDEN_SOURCE_COLUMNS.includes(column),
  )

export const getAvailableFields = (
  fields: string[],
  mapping: Record<string, string>,
  column: string,
  kind: PhonebookSourceKind,
): string[] => {
  const usedByOthers = Object.entries(mapping)
    .filter(([source]) => source !== column)
    .map(([, field]) => field)

  return fields.filter(
    (field) =>
      !usedByOthers.includes(field) && !(kind === 'csv' && CSV_EXCLUDED_FIELDS.includes(field)),
  )
}

export const suggestMapping = (
  columns: string[],
  fields: string[],
  mapping: Record<string, string>,
  kind: PhonebookSourceKind,
): Record<string, string> => {
  const suggested = { ...mapping }

  for (const column of getMappingColumns(columns, {})) {
    if (column in suggested) {
      continue
    }
    const field = getAvailableFields(fields, suggested, column, kind).find(
      (candidate) => candidate.toLowerCase() === column.trim().toLowerCase(),
    )

    if (field) {
      suggested[column] = field
    }
  }
  return suggested
}

const MappingSchema = v.pipe(
  v.record(v.string(), v.string()),
  v.check(
    (mapping) => Object.values(mapping).some((field) => field !== ''),
    'integrations.phonebook.mapping_required',
  ),
)

const buildSourceSchema = (passwordRequired: boolean) => {
  const name = requiredText('integrations.phonebook.name_required')
  const password = passwordRequired ? requiredText('integrations.password_required') : v.string()

  return v.variant('kind', [
    v.object({
      kind: v.picklist(['mysql', 'mssql']),
      name,
      host: requiredText('integrations.host_required'),
      port: PortSchema,
      database: requiredText('integrations.database_required'),
      user: requiredText('integrations.user_required'),
      password,
      query: requiredText('integrations.query_required'),
      mapping: MappingSchema,
    }),
    v.object({
      kind: v.literal('csv'),
      name,
      url: v.pipe(
        v.string(),
        v.trim(),
        v.nonEmpty('integrations.url_required'),
        v.regex(/^(https?:\/\/|file:\/\/\/)\S+$/i, 'integrations.phonebook.csv_url_invalid'),
      ),
      mapping: MappingSchema,
    }),
    v.object({
      kind: v.literal('infinity'),
      name,
      url: HttpUrlSchema('integrations.url_required', 'integrations.url_invalid'),
      username: requiredText('integrations.user_required'),
      password,
    }),
  ])
}

export const validatePhonebookSourceForm = (
  form: PhonebookSourceForm,
  existing?: PhonebookSource,
): FieldIssues => {
  const issues = validateForm(buildSourceSchema(!existing?.password), form)

  if (form.sharing === 'groups' && form.groups.length === 0) {
    issues.groups = 'integrations.phonebook.groups_required'
  }
  return issues
}

const buildConnection = (form: PhonebookSourceForm, existing?: PhonebookSource) => {
  const password = form.password || existing?.password || ''

  if (isDatabaseKind(form.kind)) {
    return {
      dbtype: form.kind,
      host: form.host.trim(),
      port: form.port.trim(),
      user: form.user.trim(),
      password,
      dbname: form.database.trim(),
      query: form.query.trim(),
    }
  }

  if (form.kind === 'csv') {
    return { dbtype: form.kind, url: form.url.trim() }
  }
  return { dbtype: form.kind, url: form.url.trim(), username: form.username.trim(), password }
}

export const buildPhonebookTestPayload = (
  form: PhonebookSourceForm,
  existing?: PhonebookSource,
): PhonebookTestInput => buildConnection(form, existing)

export const buildPhonebookSourcePayload = (
  form: PhonebookSourceForm,
  existing?: PhonebookSource,
): PhonebookSourceInput => ({
  ...buildConnection(form, existing),
  ...(form.kind === 'infinity' ? {} : { mapping: cleanMapping(form.mapping) }),
  type: form.name.trim(),
  access: buildAccess(form.sharing === 'groups' ? form.groups : []),
  interval: form.interval,
  enabled: form.enabled,
})

export const getPhonebookSources = async (): Promise<PhonebookSource[]> => {
  const { data } = await api.GET('/phonebook/config')
  return parsePhonebookSources(data)
}

export const getPhonebookFields = async (): Promise<string[]> => {
  const { data } = await api.GET('/phonebook/fields')
  return v.parse(FieldsResponseSchema, data)
}

export const savePhonebookSource = async (
  payload: PhonebookSourceInput,
  id?: string,
): Promise<void> => {
  if (id) {
    await api.POST('/phonebook/config/{id}', { params: { path: { id } }, body: payload })
  } else {
    await api.POST('/phonebook/config', { body: payload })
  }
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
  await api.POST('/phonebook/syncnow/{id}', { params: { path: { id } } })
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
