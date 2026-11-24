//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it, vi } from 'vitest'
import { api } from '@/lib/api/client'
import {
  buildDbConnectionPayload,
  buildDbConnectionTestPayload,
  type DbConnectionForm,
  getDbConnectionDefaultPort,
  getDbConnectionPort,
  getDbConnectionStatuses,
  getDbConnectionTypeLabel,
  parseDbConnections,
  parseDbConnectionTypes,
  toDbConnectionForm,
  validateDbConnectionForm,
} from './dbConnections'

vi.mock('@/lib/api/client', () => ({
  api: { GET: vi.fn(), POST: vi.fn(), PUT: vi.fn(), DELETE: vi.fn(), use: vi.fn() },
  configureApiClient: vi.fn(),
}))

const rawConnections = [
  {
    id: 1,
    host: 'localhost',
    port: '3306',
    type: 'mysql',
    user: 'ctiuser',
    pass: 'stored-password',
    has_password: true,
    name: 'phonebook',
    creation: '2026-01-10 09:00:00',
  },
  {
    id: 5,
    host: 'crm.example.com',
    port: 5432,
    type: 'postgres',
    user: 'reader',
    has_password: true,
    name: 'crm',
  },
  {
    id: 7,
    host: 'erp.example.com',
    port: '1433',
    type: 'mssql:7_4',
    user: 'erp',
    has_password: false,
    name: 'erp',
  },
]

const connections = () => parseDbConnections(rawConnections)

const form = (changes: Partial<DbConnectionForm> = {}): DbConnectionForm => ({
  name: 'crm',
  type: 'postgres',
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
        hasPassword: true,
        builtIn: false,
        pbxServer: false,
      },
      {
        id: '7',
        name: 'erp',
        type: 'mssql:7_4',
        host: 'erp.example.com',
        port: '1433',
        user: 'erp',
        hasPassword: false,
        builtIn: false,
        pbxServer: false,
      },
      {
        id: '1',
        name: 'phonebook',
        type: 'mysql',
        host: 'localhost',
        port: '3306',
        user: 'ctiuser',
        hasPassword: true,
        builtIn: true,
        pbxServer: true,
      },
    ])
  })

  it('should flag the other connections to the database server of the PBX', () => {
    const builtIn = { id: 1, name: 'phonebook', type: 'mysql', host: '127.0.0.1', port: '20093' }
    const parsed = parseDbConnections([
      builtIn,
      { id: 3, name: 'orders', type: 'mysql', host: '127.0.0.1', port: '20093' },
      { id: 4, name: 'stock', type: 'mysql', host: 'LocalHost', port: '' },
      { id: 5, name: 'crm', type: 'mysql', host: '127.0.0.1', port: '3306' },
      { id: 6, name: 'erp', type: 'mysql', host: 'erp.example.com', port: '20093' },
    ])

    expect(parsed.map(({ name, builtIn, pbxServer }) => ({ name, builtIn, pbxServer }))).toEqual([
      { name: 'crm', builtIn: false, pbxServer: false },
      { name: 'erp', builtIn: false, pbxServer: false },
      { name: 'orders', builtIn: false, pbxServer: true },
      { name: 'phonebook', builtIn: true, pbxServer: true },
      { name: 'stock', builtIn: false, pbxServer: true },
    ])
  })

  it('should flag as built-in only the first two connections on the PBX server, by id', () => {
    const parsed = parseDbConnections([
      { id: 1, name: 'contacts', type: 'mysql', host: '127.0.0.1', port: '20093' },
      { id: 2, name: 'asteriskcdrdb', type: 'mysql', host: 'crm.example.com', port: '20093' },
      { id: 7, name: 'phonebook', type: 'mysql', host: 'crm.example.com', port: '3306' },
      { id: 8, name: 'asteriskcdrdb', type: 'mysql', host: 'localhost', port: '20093' },
    ])

    expect(parsed.map(({ id, builtIn, pbxServer }) => ({ id, builtIn, pbxServer }))).toEqual([
      { id: '2', builtIn: false, pbxServer: false },
      { id: '8', builtIn: false, pbxServer: true },
      { id: '1', builtIn: true, pbxServer: true },
      { id: '7', builtIn: false, pbxServer: false },
    ])
  })

  it('should not flag a local connection when there is no built-in connection', () => {
    expect(
      parseDbConnections([{ id: 3, name: 'orders', type: 'mysql', host: 'localhost', port: '' }])[0]
        .pbxServer,
    ).toBe(false)
  })

  it('should never keep a password returned by the server', () => {
    expect(JSON.stringify(connections())).not.toContain('stored-password')
  })

  it('should read a stored password from a server without has_password', () => {
    const [connection] = parseDbConnections([
      { id: 2, host: 'h', port: '1', type: 'mysql', user: 'u', pass: 'p', name: 'n' },
    ])

    expect(connection?.hasPassword).toBe(true)
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

  it('should require every field of a new connection except the port', () => {
    expect(
      validateDbConnectionForm({ name: '', type: '', host: '', port: '', user: '', password: '' }),
    ).toEqual({
      name: 'integrations.cards.database_name_required',
      type: 'integrations.cards.database_type_required',
      host: 'integrations.cards.database_address_required',
      user: 'integrations.cards.database_username_required',
      password: 'integrations.password_required',
    })
  })

  it('should accept an empty port and reject a port out of range', () => {
    expect(validateDbConnectionForm(form({ port: ' ' }))).toEqual({})
    expect(validateDbConnectionForm(form({ port: '65536' }))).toEqual({
      port: 'integrations.port_invalid',
    })
    expect(validateDbConnectionForm(form({ port: '54a' }))).toEqual({
      port: 'integrations.port_invalid',
    })
  })

  it('should use the default port of the type when the port is empty', () => {
    expect(getDbConnectionPort(form({ port: '' }))).toBe('5432')
    expect(getDbConnectionPort(form({ port: ' 6432 ' }))).toBe('6432')
  })

  it('should keep the stored password when the empty port means the stored one', () => {
    expect(validateDbConnectionForm(form({ password: '', port: '' }), connections()[0])).toEqual({})
  })

  it('should keep the stored password when editing', () => {
    expect(validateDbConnectionForm(form({ password: '' }), connections()[0])).toEqual({})
  })

  it('should require the password again for a different server', () => {
    const issues = { password: 'integrations.password_required' }

    expect(
      validateDbConnectionForm(form({ password: '', host: 'other' }), connections()[0]),
    ).toEqual(issues)
    expect(
      validateDbConnectionForm(form({ password: '', port: '5433' }), connections()[0]),
    ).toEqual(issues)
    expect(
      validateDbConnectionForm(form({ password: '', type: 'mysql' }), connections()[0]),
    ).toEqual(issues)
    expect(
      validateDbConnectionForm(form({ password: '', host: ' crm.example.com ' }), connections()[0]),
    ).toEqual({})
  })

  it('should require a password when none is stored', () => {
    const erp = connections()[1]!

    expect(validateDbConnectionForm({ ...toDbConnectionForm(erp) }, erp)).toEqual({
      password: 'integrations.password_required',
    })
  })
})

describe('payloads', () => {
  it('should never copy the stored password into the form', () => {
    expect(toDbConnectionForm(connections()[0])).toEqual(form({ password: '' }))
  })

  it('should save and test the default port when the port is empty', () => {
    expect(buildDbConnectionPayload(form({ port: '' })).port).toBe('5432')
    expect(buildDbConnectionTestPayload(form({ port: '' })).port).toBe('5432')
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

  it('should test with the stored password of the connection when it was not changed', () => {
    expect(buildDbConnectionTestPayload(form({ password: '' }), connections()[0])).toEqual({
      type: 'postgres',
      name: 'crm',
      host: 'crm.example.com',
      port: '5432',
      user: 'reader',
      pass: '',
      id: '5',
    })
  })

  it('should test with the typed password', () => {
    expect(buildDbConnectionTestPayload(form(), connections()[0])).toEqual({
      type: 'postgres',
      name: 'crm',
      host: 'crm.example.com',
      port: '5432',
      user: 'reader',
      pass: 'new-password',
    })
    expect(buildDbConnectionTestPayload(form()).id).toBeUndefined()
  })
})

describe('getDbConnectionStatuses', () => {
  it('should test each stored connection with its stored password', async () => {
    vi.mocked(api.POST).mockImplementation((async (
      _path: string,
      options: { body: { id: string } },
    ) => {
      if (options.body.id === '7') {
        throw new Error('Cannot reach the CTI server')
      }
      return { data: { status: options.body.id === '1' } }
    }) as never)

    expect(await getDbConnectionStatuses(connections())).toEqual({
      '1': 'connected',
      '5': 'notConnected',
      '7': 'unknown',
    })
    expect(vi.mocked(api.POST)).toHaveBeenCalledWith('/cti/dbconn/test', {
      body: {
        type: 'mysql',
        name: 'phonebook',
        host: 'localhost',
        port: '3306',
        user: 'ctiuser',
        pass: '',
        id: '1',
      },
    })
  })
})
