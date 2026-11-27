//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import * as v from 'valibot'
import { api } from '@/lib/api/client'
import type { components } from '@/lib/api/schema'
import { compareNatural } from '@/lib/common'
import {
  type FieldIssues,
  isValidPort,
  requiredText,
  storableText,
  validateForm,
} from './validation'

export const DB_CONNECTIONS_KEY = 'customerCardDbConnections'
export const DB_CONNECTION_TYPES_KEY = 'customerCardDbConnectionTypes'
export const DB_CONNECTION_STATUSES_KEY = 'customerCardDbConnectionStatuses'

export const DB_CONNECTION_STATUS_STALE_TIME = 5 * 60_000

export const BUILT_IN_DB_CONNECTION_IDS = ['1', '2']

export const DB_CONNECTION_MAX_LENGTHS = { name: 64, host: 128, user: 64, password: 64 } as const

const LOCAL_NAMES = ['', 'localhost']

const HOST_TRIM = /^[\s\0[\]]+|[\s\0[\]]+$/g

type DbConnectionInput = components['schemas']['IntegrationsDbConnectionInput']

type DbConnectionTestInput = components['schemas']['IntegrationsDbConnectionTestInput']

const DEFAULT_PORTS: Record<string, string> = {
  mysql: '3306',
  postgres: '5432',
  mssql: '1433',
}

const TextSchema = v.pipe(
  v.nullish(v.union([v.string(), v.number()]), ''),
  v.transform((value) => String(value)),
)

const DbConnectionsResponseSchema = v.array(
  v.object({
    id: v.pipe(v.union([v.number(), v.string()]), v.transform(String)),
    name: TextSchema,
    type: TextSchema,
    host: TextSchema,
    port: TextSchema,
    user: TextSchema,
    pass: TextSchema,
    has_password: v.optional(v.boolean()),
    pbx_server: v.optional(v.boolean()),
  }),
)

const DbConnectionTestResponseSchema = v.object({ status: v.boolean() })

const DbConnectionTypesResponseSchema = v.union([
  v.record(v.string(), v.string()),
  v.array(v.unknown()),
])

export type DbConnection = {
  id: string
  name: string
  type: string
  host: string
  port: string
  user: string
  hasPassword: boolean
  builtIn: boolean
  pbxServer: boolean
}

export type DbConnectionType = { id: string; label: string }

export type DbConnectionStatus = 'connected' | 'notConnected' | 'unknown'

export type DbConnectionForm = {
  type: string
  name: string
  host: string
  port: string
  user: string
  password: string
}

const parseIpv4 = (address: string): number[] | null => {
  const parts = address.split('.')

  if (parts.length !== 4 || !parts.every((part) => /^(0|[1-9]\d{0,2})$/.test(part))) {
    return null
  }
  const bytes = parts.map(Number)

  return bytes.every((byte) => byte <= 255) ? bytes : null
}

const parseIpv6 = (address: string): number[] | null => {
  const halves = address.split('::')

  if (halves.length > 2) {
    return null
  }
  const groups = halves.map((half) => (half === '' ? [] : half.split(':')))
  const last = groups[groups.length - 1]
  const tail = last[last.length - 1] ?? ''

  if (tail.includes('.')) {
    const ipv4 = parseIpv4(tail)

    if (!ipv4) {
      return null
    }
    last.splice(
      -1,
      1,
      ((ipv4[0] << 8) | ipv4[1]).toString(16),
      ((ipv4[2] << 8) | ipv4[3]).toString(16),
    )
  }
  const count = groups.reduce((total, half) => total + half.length, 0)

  if (
    (halves.length === 1 ? count !== 8 : count > 7) ||
    !groups.every((half) => half.every((group) => /^[0-9a-f]{1,4}$/.test(group)))
  ) {
    return null
  }
  const words = [
    ...groups[0],
    ...Array<string>(8 - count).fill('0'),
    ...(halves.length === 2 ? groups[1] : []),
  ].map((group) => parseInt(group, 16))

  return words.flatMap((word) => [word >> 8, word & 0xff])
}

const isLocalIpv4 = ([first, second]: number[]): boolean =>
  first === 0 || first === 127 || (first === 169 && second === 254)

const isLocalAddress = (address: string): boolean => {
  const ipv4 = parseIpv4(address)

  if (ipv4) {
    return isLocalIpv4(ipv4)
  }
  const ipv6 = parseIpv6(address)

  if (!ipv6) {
    return false
  }
  const prefix = ipv6.slice(0, 12)
  const mapped = prefix.slice(0, 10).every((byte) => byte === 0)

  if (
    mapped &&
    ((prefix[10] === 0xff && prefix[11] === 0xff) || (prefix[10] === 0 && prefix[11] === 0))
  ) {
    return isLocalIpv4(ipv6.slice(12))
  }
  return ipv6[0] === 0xfe && (ipv6[1] & 0xc0) === 0x80
}

export const isLocalHost = (host: string): boolean => {
  const name = host.replace(HOST_TRIM, '').toLowerCase()

  return LOCAL_NAMES.includes(name) || name.endsWith('.localhost') || isLocalAddress(name)
}

export const parseDbConnections = (raw: unknown): DbConnection[] => {
  const connections = v.parse(DbConnectionsResponseSchema, raw).map((connection) => ({
    id: connection.id,
    name: connection.name,
    type: connection.type,
    host: connection.host,
    port: connection.port,
    user: connection.user,
    hasPassword: connection.has_password ?? connection.pass !== '',
    builtIn: BUILT_IN_DB_CONNECTION_IDS.includes(connection.id) && isLocalHost(connection.host),
    pbx_server: connection.pbx_server,
  }))

  return connections
    .map(({ pbx_server, ...connection }) => ({
      ...connection,
      pbxServer: pbx_server ?? isLocalHost(connection.host),
    }))
    .sort((a, b) => compareNatural(a.name, b.name))
}

export const parseDbConnectionTypes = (raw: unknown): DbConnectionType[] => {
  const response = v.parse(DbConnectionTypesResponseSchema, raw)

  return Array.isArray(response)
    ? []
    : Object.entries(response).map(([id, label]) => ({ id, label }))
}

export const getDbConnectionDefaultPort = (type: string): string =>
  DEFAULT_PORTS[type.split(':')[0]] ?? ''

export const getDbConnectionTypeLabel = (type: string, types: DbConnectionType[]): string =>
  types.find((item) => item.id === type)?.label ?? type

export const getDbConnectionPort = (form: Pick<DbConnectionForm, 'type' | 'port'>): string =>
  form.port.trim() || getDbConnectionDefaultPort(form.type)

export const emptyDbConnectionForm = (): DbConnectionForm => ({
  name: '',
  type: 'mysql',
  host: '',
  port: '',
  user: '',
  password: '',
})

export const toDbConnectionForm = (connection: DbConnection): DbConnectionForm => ({
  name: connection.name,
  type: connection.type,
  host: connection.host,
  port: connection.port,
  user: connection.user,
  password: '',
})

const isSameDbServer = (form: DbConnectionForm, existing: DbConnection): boolean =>
  form.type === existing.type &&
  form.host.trim() === existing.host.trim() &&
  getDbConnectionPort(form) === existing.port.trim()

export const isDbConnectionPasswordKept = (
  form: DbConnectionForm,
  existing?: DbConnection,
): boolean => !!existing?.hasPassword && isSameDbServer(form, existing)

const isDbConnectionPasswordRequired = (form: DbConnectionForm, existing?: DbConnection): boolean =>
  !existing || (existing.hasPassword && !isSameDbServer(form, existing))

const sameText = (a: string, b: string): boolean =>
  a.trim().toLowerCase() === b.trim().toLowerCase()

export const isDbConnectionDuplicated = (form: DbConnectionForm, others: DbConnection[]): boolean =>
  others.some(
    (connection) =>
      sameText(connection.host, form.host) &&
      sameText(connection.port, getDbConnectionPort(form)) &&
      sameText(connection.user, form.user) &&
      sameText(connection.name, form.name),
  )

const OptionalPortSchema = v.pipe(
  v.string(),
  v.trim(),
  v.check((port) => port === '' || isValidPort(port), 'integrations.port_invalid'),
)

const storableField = (field: keyof typeof DB_CONNECTION_MAX_LENGTHS) =>
  storableText(
    DB_CONNECTION_MAX_LENGTHS[field],
    'integrations.cards.database_value_too_long',
    'integrations.cards.database_value_invalid_characters',
  )

const buildDbConnectionSchema = (passwordRequired: boolean) =>
  v.object({
    name: v.pipe(requiredText('integrations.cards.database_name_required'), storableField('name')),
    type: requiredText('integrations.cards.database_type_required'),
    host: v.pipe(
      requiredText('integrations.cards.database_address_required'),
      storableField('host'),
    ),
    port: OptionalPortSchema,
    user: v.pipe(
      requiredText('integrations.cards.database_username_required'),
      storableField('user'),
    ),
    password: passwordRequired
      ? v.pipe(requiredText('integrations.password_required'), storableField('password'))
      : storableField('password'),
  })

export const validateDbConnectionForm = (
  form: DbConnectionForm,
  existing?: DbConnection,
  others: DbConnection[] = [],
): FieldIssues => {
  const issues = validateForm(
    buildDbConnectionSchema(isDbConnectionPasswordRequired(form, existing)),
    form,
  )

  if (!issues.name && isDbConnectionDuplicated(form, others)) {
    return { name: 'integrations.cards.database_connection_duplicate', ...issues }
  }
  return issues
}

export const buildDbConnectionPayload = (form: DbConnectionForm): DbConnectionInput => ({
  type: form.type,
  name: form.name.trim(),
  host: form.host.trim(),
  port: getDbConnectionPort(form),
  user: form.user.trim(),
  ...(form.password ? { pass: form.password } : {}),
})

export const buildDbConnectionTestPayload = (
  form: DbConnectionForm,
  existing?: DbConnection,
): DbConnectionTestInput => ({
  type: form.type,
  name: form.name.trim(),
  host: form.host.trim(),
  port: getDbConnectionPort(form),
  user: form.user.trim(),
  pass: form.password,
  ...(existing && !form.password ? { id: existing.id } : {}),
})

export const getDbConnections = async (): Promise<DbConnection[]> => {
  const { data } = await api.GET('/cti/dbconn')
  return parseDbConnections(data)
}

export const getDbConnectionTypes = async (): Promise<DbConnectionType[]> => {
  const { data } = await api.GET('/cti/dbconn/type')
  return parseDbConnectionTypes(data)
}

export const saveDbConnection = async (payload: DbConnectionInput, id?: string): Promise<void> => {
  if (id) {
    await api.PUT('/cti/dbconn/{id}', { params: { path: { id } }, body: payload })
  } else {
    await api.POST('/cti/dbconn', { body: payload })
  }
}

export const deleteDbConnection = async (id: string): Promise<void> => {
  await api.DELETE('/cti/dbconn/{id}', { params: { path: { id } } })
}

export const testDbConnection = async (payload: DbConnectionTestInput): Promise<boolean> => {
  const { data } = await api.POST('/cti/dbconn/test', { body: payload })
  return v.parse(DbConnectionTestResponseSchema, data).status
}

export const getDbConnectionSignature = (connection: DbConnection): string =>
  [connection.id, connection.type, connection.host, connection.port, connection.user].join('|')

export const getDbConnectionStatus = async (
  connection: DbConnection,
): Promise<DbConnectionStatus> => {
  try {
    const connected = await testDbConnection(
      buildDbConnectionTestPayload(toDbConnectionForm(connection), connection),
    )
    return connected ? 'connected' : 'notConnected'
  } catch {
    return 'unknown'
  }
}

export const getDbConnectionStatuses = async (
  connections: DbConnection[],
): Promise<Record<string, DbConnectionStatus>> =>
  Object.fromEntries(
    await Promise.all(
      connections.map(async (connection) => [
        connection.id,
        await getDbConnectionStatus(connection),
      ]),
    ),
  )
