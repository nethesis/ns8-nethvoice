//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import * as v from 'valibot'
import { api } from '@/lib/api/client'
import { isApiError } from '@/lib/api/errors'
import type { components } from '@/lib/api/schema'
import { compareNatural } from '@/lib/common'
import { postCtiApi } from './ctiApi'
import { type FieldIssues, PortSchema, requiredText, validateForm } from './validation'

export const DB_CONNECTIONS_KEY = 'customerCardDbConnections'
export const DB_CONNECTION_TYPES_KEY = 'customerCardDbConnectionTypes'

export const BUILT_IN_DB_CONNECTIONS = ['phonebook', 'asteriskcdrdb']

type DbConnectionInput = components['schemas']['IntegrationsDbConnectionInput']

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
  }),
)

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
  password: string
  builtIn: boolean
}

export type DbConnectionType = { id: string; label: string }

export type DbConnectionForm = {
  type: string
  name: string
  host: string
  port: string
  user: string
  password: string
}

export const parseDbConnections = (raw: unknown): DbConnection[] =>
  v
    .parse(DbConnectionsResponseSchema, raw)
    .map((connection) => ({
      id: connection.id,
      name: connection.name,
      type: connection.type,
      host: connection.host,
      port: connection.port,
      user: connection.user,
      password: connection.pass,
      builtIn: BUILT_IN_DB_CONNECTIONS.includes(connection.name),
    }))
    .sort((a, b) => compareNatural(a.name, b.name))

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

export const emptyDbConnectionForm = (): DbConnectionForm => ({
  type: 'mysql',
  name: '',
  host: '',
  port: getDbConnectionDefaultPort('mysql'),
  user: '',
  password: '',
})

export const toDbConnectionForm = (connection: DbConnection): DbConnectionForm => ({
  type: connection.type,
  name: connection.name,
  host: connection.host,
  port: connection.port,
  user: connection.user,
  password: '',
})

const buildDbConnectionSchema = (passwordRequired: boolean) =>
  v.object({
    type: requiredText('integrations.cards.connection_type_required'),
    name: requiredText('integrations.database_required'),
    host: requiredText('integrations.host_required'),
    port: PortSchema,
    user: requiredText('integrations.user_required'),
    password: passwordRequired ? requiredText('integrations.password_required') : v.string(),
  })

export const validateDbConnectionForm = (
  form: DbConnectionForm,
  existing?: DbConnection,
): FieldIssues => validateForm(buildDbConnectionSchema(!existing?.password), form)

export const buildDbConnectionPayload = (form: DbConnectionForm): DbConnectionInput => ({
  type: form.type,
  name: form.name.trim(),
  host: form.host.trim(),
  port: form.port.trim(),
  user: form.user.trim(),
  ...(form.password ? { pass: form.password } : {}),
})

export const buildDbConnectionTestPayload = (
  form: DbConnectionForm,
  existing?: DbConnection,
): Required<DbConnectionInput> => ({
  type: form.type,
  name: form.name.trim(),
  host: form.host.trim(),
  port: form.port.trim(),
  user: form.user.trim(),
  pass: form.password || existing?.password || '',
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

export const testDbConnection = async (payload: Required<DbConnectionInput>): Promise<boolean> => {
  try {
    await postCtiApi('/dbconn/test', payload)
    return true
  } catch (error) {
    if (isApiError(error) && error.status === 503) {
      return false
    }
    throw error
  }
}
