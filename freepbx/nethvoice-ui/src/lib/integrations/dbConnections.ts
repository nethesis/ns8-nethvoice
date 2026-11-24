//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import * as v from 'valibot'
import { api } from '@/lib/api/client'
import type { components } from '@/lib/api/schema'
import { compareNatural } from '@/lib/common'
import { type FieldIssues, requiredText, validateForm } from './validation'

export const DB_CONNECTIONS_KEY = 'customerCardDbConnections'
export const DB_CONNECTION_TYPES_KEY = 'customerCardDbConnectionTypes'
export const DB_CONNECTION_STATUSES_KEY = 'customerCardDbConnectionStatuses'

export const BUILT_IN_DB_CONNECTIONS = ['phonebook', 'asteriskcdrdb']

const LOCAL_HOSTS = ['', 'localhost', '127.0.0.1', '::1']

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

const isLocalHost = (host: string): boolean => {
  const name = host
    .trim()
    .toLowerCase()
    .replace(/^\[(.*)\]$/, '$1')

  return LOCAL_HOSTS.includes(name) || name.endsWith('.localhost')
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
    builtIn: BUILT_IN_DB_CONNECTIONS.includes(connection.name),
  }))
  const pbxPorts = connections
    .filter((connection) => connection.builtIn && isLocalHost(connection.host))
    .map((connection) => connection.port.trim())

  return connections
    .map((connection) => ({
      ...connection,
      pbxServer:
        connection.builtIn ||
        (pbxPorts.length > 0 &&
          isLocalHost(connection.host) &&
          (connection.port.trim() === '' || pbxPorts.includes(connection.port.trim()))),
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

export const isDbConnectionPasswordKept = (
  form: DbConnectionForm,
  existing?: DbConnection,
): boolean =>
  !!existing?.hasPassword &&
  form.type === existing.type &&
  form.host.trim() === existing.host.trim() &&
  getDbConnectionPort(form) === existing.port.trim()

const OptionalPortSchema = v.pipe(
  v.string(),
  v.trim(),
  v.check(
    (port) => port === '' || (/^\d{1,5}$/.test(port) && Number(port) >= 1 && Number(port) <= 65535),
    'integrations.port_invalid',
  ),
)

const buildDbConnectionSchema = (passwordRequired: boolean) =>
  v.object({
    name: requiredText('integrations.cards.database_name_required'),
    type: requiredText('integrations.cards.database_type_required'),
    host: requiredText('integrations.cards.database_address_required'),
    port: OptionalPortSchema,
    user: requiredText('integrations.cards.database_username_required'),
    password: passwordRequired ? requiredText('integrations.password_required') : v.string(),
  })

export const validateDbConnectionForm = (
  form: DbConnectionForm,
  existing?: DbConnection,
): FieldIssues =>
  validateForm(buildDbConnectionSchema(!isDbConnectionPasswordKept(form, existing)), form)

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
