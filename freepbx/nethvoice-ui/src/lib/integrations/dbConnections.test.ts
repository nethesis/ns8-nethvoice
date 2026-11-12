//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest'
import {
  buildDbConnectionPayload,
  buildDbConnectionTestPayload,
  type DbConnectionForm,
  getDbConnectionDefaultPort,
  getDbConnectionTypeLabel,
  parseDbConnections,
  parseDbConnectionTypes,
  toDbConnectionForm,
  validateDbConnectionForm,
} from './dbConnections'

const rawConnections = [
  {
    id: 1,
    host: 'localhost',
    port: '3306',
    type: 'mysql',
    user: 'ctiuser',
    pass: 'stored-password',
    name: 'phonebook',
    creation: '2026-01-10 09:00:00',
  },
  {
    id: 5,
    host: 'crm.example.com',
    port: 5432,
    type: 'postgres',
    user: 'reader',
    pass: 'crm-password',
    name: 'crm',
  },
]

const connections = () => parseDbConnections(rawConnections)

const form = (changes: Partial<DbConnectionForm> = {}): DbConnectionForm => ({
  type: 'postgres',
  name: 'crm',
  host: 'crm.example.com',
  port: '5432',
  user: 'reader',
  password: 'new-password',
  ...changes,
})

describe('parseDbConnections', () => {
  it('should normalize the connections and flag the built-in ones', () => {
    expect(connections()).toEqual([
      {
        id: '5',
        name: 'crm',
        type: 'postgres',
        host: 'crm.example.com',
        port: '5432',
        user: 'reader',
        password: 'crm-password',
        builtIn: false,
      },
      {
        id: '1',
        name: 'phonebook',
        type: 'mysql',
        host: 'localhost',
        port: '3306',
        user: 'ctiuser',
        password: 'stored-password',
        builtIn: true,
      },
    ])
  })

  it('should reject an unexpected shape', () => {
    expect(() => parseDbConnections({ id: 1 })).toThrow()
  })
})

describe('database types', () => {
  it('should list the types keeping the server order', () => {
    expect(parseDbConnectionTypes({ mysql: 'MySQL', 'mssql:7_4': 'SQL Server 2012/2014' })).toEqual(
      [
        { id: 'mysql', label: 'MySQL' },
        { id: 'mssql:7_4', label: 'SQL Server 2012/2014' },
      ],
    )
    expect(parseDbConnectionTypes([])).toEqual([])
  })

  it('should label a type and fall back to its id', () => {
    const types = [{ id: 'mysql', label: 'MySQL' }]

    expect(getDbConnectionTypeLabel('mysql', types)).toBe('MySQL')
    expect(getDbConnectionTypeLabel('oracle', types)).toBe('oracle')
  })

  it('should suggest the default port of each engine', () => {
    expect(getDbConnectionDefaultPort('mysql')).toBe('3306')
    expect(getDbConnectionDefaultPort('postgres')).toBe('5432')
    expect(getDbConnectionDefaultPort('mssql:7_3_A')).toBe('1433')
    expect(getDbConnectionDefaultPort('oracle')).toBe('')
  })
})

describe('validateDbConnectionForm', () => {
  it('should accept a complete connection', () => {
    expect(validateDbConnectionForm(form())).toEqual({})
  })

  it('should require every field of a new connection', () => {
    expect(
      validateDbConnectionForm({ type: '', name: '', host: '', port: '', user: '', password: '' }),
    ).toEqual({
      type: 'integrations.cards.connection_type_required',
      name: 'integrations.database_required',
      host: 'integrations.host_required',
      port: 'integrations.port_required',
      user: 'integrations.user_required',
      password: 'integrations.password_required',
    })
  })

  it('should keep the stored password when editing', () => {
    expect(validateDbConnectionForm(form({ password: '' }), connections()[0])).toEqual({})
  })
})

describe('payloads', () => {
  it('should never copy the stored password into the form', () => {
    expect(toDbConnectionForm(connections()[0])).toEqual(form({ password: '' }))
  })

  it('should omit an unchanged password from the saved fields', () => {
    expect(buildDbConnectionPayload(form({ password: '', host: ' crm.example.com ' }))).toEqual({
      type: 'postgres',
      name: 'crm',
      host: 'crm.example.com',
      port: '5432',
      user: 'reader',
    })
    expect(buildDbConnectionPayload(form()).pass).toBe('new-password')
  })

  it('should test with the stored password when it was not changed', () => {
    expect(buildDbConnectionTestPayload(form({ password: '' }), connections()[0])).toEqual({
      type: 'postgres',
      name: 'crm',
      host: 'crm.example.com',
      port: '5432',
      user: 'reader',
      pass: 'crm-password',
    })
    expect(buildDbConnectionTestPayload(form()).pass).toBe('new-password')
  })
})
