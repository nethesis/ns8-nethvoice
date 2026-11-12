//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { CtiClient } from '../src/ctiClient.mjs'
import { PbxClient } from '../src/pbxClient.mjs'
import { createServer } from '../src/server.mjs'
import { createFakeFetch } from './fakeFetch.mjs'

const CTI_ROUTES = {
  'GET /api/user/me': {
    json: {
      name: 'Anna Miller',
      username: 'a.miller',
      mainPresence: 'online',
      presence: 'online',
      lkhash: 'must-not-leak',
      default_device: { id: '300', secret: 'must-not-leak' },
      profile: { id: '3', name: 'Advanced', macro_permissions: {} },
      endpoints: { mainextension: [{ id: '300' }], extension: [{ id: '300', secret: 'must-not-leak' }, { id: '91300' }] },
    },
  },
  'GET /api/astproxy/extensions': {
    json: {
      300: { exten: '300', name: 'Anna Miller', status: 'online', dnd: false, ip: '10.0.0.5', conversations: {} },
      301: { exten: '301', name: 'Christopher Davis', status: 'offline', dnd: false, conversations: {} },
      302: { exten: '302', name: 'Daniel Jones', status: 'busy', dnd: false, conversations: { c1: {} } },
    },
  },
  'GET /api/astproxy/trunks': {
    json: { Provider: { name: 'Provider', status: 'online', registration: 'registered', ip: '192.0.2.1', conversations: {} } },
  },
  'GET /api/astproxy/queues': {
    json: {
      401: {
        queue: '401',
        name: 'Support',
        waitingCallers: { a: {} },
        members: { 300: { loggedIn: true, paused: false }, 301: { loggedIn: true, paused: true }, 302: { loggedIn: false } },
      },
    },
  },
  'GET /api/phonebook/search/mil': {
    json: { count: 1, rows: [{ id: 7, name: 'Anna Miller', workphone: '300', cellphone: '', company: null, notes: 'n'.repeat(500), owner_id: 'x' }] },
  },
  'POST /api/user/presence': { status: 200, json: {} },
}

const PBX_ROUTES = {
  'POST /freepbx/rest/testauth': { json: { result: 'shared' } },
  'GET /freepbx/rest/users/count': { json: 2 },
  'GET /freepbx/rest/trunks/count': { json: 1 },
  'GET /freepbx/rest/inboundroutes/count': { json: 3 },
  'GET /freepbx/rest/outboundroutes/count': { json: 4 },
  'GET /freepbx/rest/configuration/userprovider': { json: { configured: 1, type: 'ldap', local: 1, domain: 'example.org' } },
  'GET /freepbx/rest/mainextensions/userlimits': { json: { configured: 2, limit: false, configurable: false } },
  'GET /freepbx/rest/configuration/wizard': { json: [{ step: 13, status: 'false' }] },
  'GET /freepbx/rest/users/true': {
    json: [
      {
        username: 'a.miller',
        displayname: 'Anna Miller',
        default_extension: '300',
        profile: 3,
        password: 'must-not-leak',
        devices: [{ type: 'webrtc', extension: '300', secret: 'must-not-leak', web_password: 'must-not-leak' }],
      },
      { username: 'c.davis', displayname: 'Christopher Davis', default_extension: null, profile: 1, devices: [] },
    ],
  },
  'GET /freepbx/rest/outboundroutes': {
    json: [{ route_id: 1, name: 'national_it', password: 'must-not-leak', trunks: [{ trunkid: 2, name: 'Provider' }] }],
  },
}

const connect = async ({ withCti = true, withPbx = false, enableWrites = false } = {}) => {
  const ctiFetch = createFakeFetch(CTI_ROUTES)
  const pbxFetch = createFakeFetch(PBX_ROUTES)
  const audit = []
  const { server } = createServer({
    cti: withCti ? new CtiClient({ baseUrl: 'https://cti.example.org', token: 'jwt', fetch: ctiFetch.fetch }) : undefined,
    pbx: withPbx
      ? new PbxClient({ baseUrl: 'https://voice.example.org', username: 'admin', password: 'pw', fetch: pbxFetch.fetch })
      : undefined,
    enableWrites,
    audit: (entry) => audit.push(entry),
    identity: 'a.miller',
  })
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  const client = new Client({ name: 'test', version: '0.0.0' })

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)])

  const call = async (name, args = {}) => {
    const result = await client.callTool({ name, arguments: args })
    return { result, data: result.isError ? undefined : JSON.parse(result.content[0].text) }
  }

  return { client, call, audit, ctiCalls: ctiFetch.calls, pbxCalls: pbxFetch.calls }
}

describe('tool catalogue', () => {
  it('exposes only read-only user tools by default', async () => {
    const { client } = await connect()
    const { tools } = await client.listTools()

    assert.deepEqual(
      tools.map((tool) => tool.name).sort(),
      ['get_my_profile', 'get_queues_status', 'get_trunks_status', 'list_extensions_status', 'search_contacts'],
    )
    assert.ok(tools.every((tool) => tool.annotations.readOnlyHint === true))
  })

  it('adds the write tool only when writes are enabled, and flags it as not read-only', async () => {
    const { client } = await connect({ enableWrites: true })
    const { tools } = await client.listTools()
    const presence = tools.find((tool) => tool.name === 'set_my_presence')

    assert.ok(presence)
    assert.equal(presence.annotations.readOnlyHint, false)
  })

  it('adds admin tools only with admin credentials, all read-only', async () => {
    const { client } = await connect({ withCti: false, withPbx: true, enableWrites: true })
    const { tools } = await client.listTools()

    assert.deepEqual(tools.map((tool) => tool.name).sort(), ['get_system_overview', 'list_outbound_routes', 'list_users'])
    assert.ok(tools.every((tool) => tool.annotations.readOnlyHint === true))
  })
})

describe('user tools', () => {
  it('returns the profile without credentials', async () => {
    const { call } = await connect()
    const { result, data } = await call('get_my_profile')

    assert.equal(data.username, 'a.miller')
    assert.equal(data.mainExtension, '300')
    assert.deepEqual(data.extensions, [
      { id: '300', type: null },
      { id: '91300', type: 'mobile' },
    ])
    assert.doesNotMatch(result.content[0].text, /must-not-leak/)
  })

  it('filters extensions and reports calls in progress', async () => {
    const { call } = await connect()

    const online = (await call('list_extensions_status', { onlyOnline: true })).data
    assert.deepEqual(online.items.map((item) => item.exten), ['300', '302'])
    assert.equal(online.items[1].inConversation, true)

    const searched = (await call('list_extensions_status', { search: 'davis' })).data
    assert.deepEqual(searched.items.map((item) => item.exten), ['301'])
    assert.equal(searched.items[0].ip, undefined)
  })

  it('summarizes trunks and queues', async () => {
    const { call } = await connect()

    assert.deepEqual((await call('get_trunks_status')).data.trunks, [
      { name: 'Provider', status: 'online', registration: 'registered', activeCalls: 0 },
    ])
    assert.deepEqual((await call('get_queues_status')).data.queues, [
      { queue: '401', name: 'Support', waitingCallers: 1, members: 3, loggedInMembers: 2, pausedMembers: 1 },
    ])
  })

  it('searches contacts with the limit in the query and returns only filled, known fields', async () => {
    const { call, ctiCalls } = await connect()
    const { data } = await call('search_contacts', { term: 'mil', limit: 5 })

    assert.equal(ctiCalls[0].path, '/api/phonebook/search/mil?view=all&limit=5&offset=0')
    assert.deepEqual(data.contacts, [{ id: 7, name: 'Anna Miller', workphone: '300' }])
  })

  it('rejects arguments that do not match the schema before calling the PBX', async () => {
    const { call, ctiCalls } = await connect()
    const { result } = await call('search_contacts', { term: 'x' })

    assert.equal(result.isError, true)
    assert.equal(ctiCalls.length, 0)
  })

  it('sets the presence and requires a destination for call forward', async () => {
    const { call, ctiCalls } = await connect({ enableWrites: true })

    assert.deepEqual((await call('set_my_presence', { status: 'dnd' })).data, { presence: 'dnd' })
    assert.deepEqual(ctiCalls[0].body, { status: 'dnd' })

    const missing = await call('set_my_presence', { status: 'callforward' })
    assert.equal(missing.result.isError, true)
    assert.equal(ctiCalls.length, 1)

    await call('set_my_presence', { status: 'callforward', to: '3331234567' })
    assert.deepEqual(ctiCalls[1].body, { status: 'callforward', to: '3331234567' })
  })

  it('refuses the write tool when writes are disabled', async () => {
    const { call, ctiCalls } = await connect()
    const { result } = await call('set_my_presence', { status: 'dnd' })

    assert.equal(result.isError, true)
    assert.equal(ctiCalls.length, 0)
  })
})

describe('admin tools', () => {
  it('builds the overview from the count endpoints', async () => {
    const { call } = await connect({ withPbx: true })

    assert.deepEqual((await call('get_system_overview')).data, {
      users: 2,
      trunks: 1,
      inboundRoutes: 3,
      outboundRoutes: 4,
      userProvider: { configured: 1, type: 'ldap', local: 1, domain: 'example.org' },
      userLimits: { configured: 2, limit: false, configurable: false },
      setupWizardCompleted: true,
    })
  })

  it('lists users and routes without any credential', async () => {
    const { call, pbxCalls } = await connect({ withPbx: true })
    const users = await call('list_users', { search: 'miller' })
    const routes = await call('list_outbound_routes')

    assert.deepEqual(users.data.items, [
      {
        username: 'a.miller',
        displayName: 'Anna Miller',
        mainExtension: '300',
        profileId: 3,
        devices: [{ type: 'webrtc', extension: '300', model: null }],
      },
    ])
    assert.deepEqual(routes.data.routes, [{ id: 1, name: 'national_it', trunks: ['Provider'] }])
    assert.doesNotMatch(users.result.content[0].text + routes.result.content[0].text, /must-not-leak/)
    assert.ok(pbxCalls.every((entry) => entry.method === 'GET' || entry.path === '/freepbx/rest/testauth'))
  })
})

describe('audit log', () => {
  it('records identity, tool, arguments and outcome of every call', async () => {
    const { call, audit } = await connect()

    await call('search_contacts', { term: 'mil' })
    await call('search_contacts', { term: 'zzz' })

    assert.equal(audit.length, 2)
    assert.deepEqual(
      { tool: audit[0].tool, identity: audit[0].identity, args: audit[0].args, outcome: audit[0].outcome },
      { tool: 'search_contacts', identity: 'a.miller', args: { term: 'mil' }, outcome: 'ok' },
    )
    assert.equal(audit[1].outcome, 'error')
    assert.match(audit[1].error, /status 404/)
  })
})
