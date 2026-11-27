//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import * as v from 'valibot'
import { api } from '@/lib/api/client'
import type { components } from '@/lib/api/schema'
import { isApiError } from '@/lib/api/errors'
import { compareNatural } from '@/lib/common'
import { getLegacyStatusMessage } from './errors'
import {
  buildAccess,
  isSharedWithNoGroup,
  NOT_IMPORTED,
  parseSharingGroups,
} from './phonebookSources'

export const PHONEBOOK_IMPORTS_KEY = 'phonebookImports'
export const IMPORT_OWNERS_KEY = 'phonebookImportOwners'

const NO_EXTENSION = 'none'

type ImportInput = components['schemas']['IntegrationsPhonebookImportInput']

const CountSchema = v.pipe(v.number(), v.integer(), v.minValue(0))

const ImportsResponseSchema = v.array(
  v.object({
    id: v.number(),
    created_at: v.string(),
    owner: v.string(),
    filename: v.nullish(v.string(), null),
    type: v.nullish(v.string(), 'public'),
    total: CountSchema,
    imported: CountSchema,
    skipped: CountSchema,
    failed: CountSchema,
  }),
)

const ImportResultSchema = v.object({
  total_rows: CountSchema,
  imported_rows: CountSchema,
  failed_rows: CountSchema,
  skipped_rows: CountSchema,
})

const UsersResponseSchema = v.array(
  v.object({
    username: v.string(),
    displayname: v.nullish(v.string(), ''),
    default_extension: v.nullish(
      v.pipe(v.union([v.string(), v.number()]), v.transform(String)),
      '',
    ),
  }),
)

export type PhonebookImport = {
  id: number
  createdAt: Date
  owner: string
  filename: string | null
  groups: string[]
  sharedWithNoGroup?: boolean
  total: number
  imported: number
  notImported: number
}

export type ImportOwner = { username: string; name: string; extension: string }

export type ImportResult = { total: number; imported: number; skipped: number; failed: number }

export type CsvContent = { columns: string[]; records: string[][] }

export const parseCsv = (text: string): string[][] => {
  const records: string[][] = []
  let record: string[] = []
  let field = ''
  let quoted = false
  let index = text.charCodeAt(0) === 0xfeff ? 1 : 0

  const endRecord = () => {
    record.push(field)
    records.push(record)
    record = []
    field = ''
  }

  for (; index < text.length; index++) {
    const char = text[index]

    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        field += '"'
        index++
      } else if (char === '"') {
        quoted = false
      } else {
        field += char
      }
    } else if (char === '"') {
      quoted = true
    } else if (char === ',') {
      record.push(field)
      field = ''
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[index + 1] === '\n') {
        index++
      }
      endRecord()
    } else {
      field += char
    }
  }

  if (field !== '' || record.length > 0) {
    endRecord()
  }
  return records
}

const isBlankRecord = (record: string[]) => record.every((value) => value.trim() === '')

export const readCsv = (text: string): CsvContent => {
  const [header = [], ...rest] = parseCsv(text)

  return {
    columns: header.map((column) => column.trim()),
    records: rest.filter((record) => !isBlankRecord(record)),
  }
}

export const countCsvRows = (text: string): number => readCsv(text).records.length

export const estimateSkippedRows = (csv: CsvContent, mapping: Record<string, string>): number => {
  const indexOf = (field: string) => {
    const column = Object.entries(mapping).find(([, mapped]) => mapped === field)?.[0]
    return column === undefined ? -1 : csv.columns.indexOf(column.trim())
  }
  const [nameIndex, firstIndex, lastIndex] = ['name', 'firstname', 'lastname'].map(indexOf)
  const value = (record: string[], index: number) => (index < 0 ? '' : (record[index] ?? ''))

  return csv.records.filter(
    (record) =>
      value(record, nameIndex).trim() === '' &&
      `${value(record, firstIndex).trim()} ${value(record, lastIndex).trim()}`.trim() === '',
  ).length
}

export const parsePhonebookImports = (raw: unknown): PhonebookImport[] =>
  v.parse(ImportsResponseSchema, raw).map((item) => ({
    id: item.id,
    createdAt: new Date(item.created_at),
    owner: item.owner,
    filename: item.filename,
    groups: parseSharingGroups(item.type),
    sharedWithNoGroup: isSharedWithNoGroup(item.type),
    total: item.total,
    imported: item.imported,
    notImported: item.skipped + item.failed,
  }))

export const parseImportOwners = (raw: unknown): ImportOwner[] =>
  v
    .parse(UsersResponseSchema, raw)
    .filter((user) => user.default_extension !== '' && user.default_extension !== NO_EXTENSION)
    .map((user) => ({
      username: user.username,
      name: user.displayname.trim() || user.username,
      extension: user.default_extension,
    }))
    .sort((a, b) => compareNatural(a.name, b.name))

export const describeOwner = (username: string, owners: ImportOwner[]): string => {
  const owner = owners.find((item) => item.username === username)
  return owner ? `${owner.name} (${owner.extension})` : username
}

export const parseImportResult = (raw: unknown): ImportResult => {
  const result = v.parse(ImportResultSchema, raw)

  return {
    total: result.total_rows,
    imported: result.imported_rows,
    skipped: result.skipped_rows,
    failed: result.failed_rows,
  }
}

const ImportErrorBodySchema = v.object({ error_messages: v.array(v.string()) })

export const getImportErrorMessage = (error: unknown): string => {
  const legacy = getLegacyStatusMessage(error)

  if (legacy || !isApiError(error) || error.status >= 500) {
    return legacy
  }
  const body = v.safeParse(ImportErrorBodySchema, error.body)
  return body.success ? (body.output.error_messages[0] ?? '') : ''
}

export const buildImportPayload = (input: {
  url: string
  owner: string
  sharing: 'public' | 'groups'
  groups: string[]
  mapping: Record<string, string>
  filename: string
}): ImportInput => ({
  url: input.url,
  owner: input.owner,
  type: buildAccess(input.sharing === 'groups' ? input.groups : []),
  mapping: Object.fromEntries(
    Object.entries(input.mapping).filter(([, field]) => field !== '' && field !== NOT_IMPORTED),
  ),
  filename: input.filename,
})

export const getPhonebookImports = async (): Promise<PhonebookImport[]> => {
  const { data } = await api.GET('/phonebook/imports')
  return parsePhonebookImports(data)
}

export const getImportOwners = async (): Promise<ImportOwner[]> => {
  const { data } = await api.GET('/users/{all}', { params: { path: { all: 'false' } } })
  return parseImportOwners(data)
}

export const importContacts = async (payload: ImportInput): Promise<ImportResult> => {
  const { data } = await api.POST('/phonebook/import-cti', { body: payload })
  return parseImportResult(data)
}
