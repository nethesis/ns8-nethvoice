//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import { createServer as createHttpServer } from 'node:http'
import { after, before, beforeEach, describe, it } from 'node:test'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { loadConfig } from '../src/config.mjs'
import { checkRequestHeaders, createHttpHandler, createTokenValidator } from '../src/http.mjs'
import { createFakeFetch, networkError } from './fakeFetch.mjs'

const ctiRoutes = {
  'GET /api/user/me': (call) =>
    call.headers.Authorization === 'Bearer good'
      ? { json: { username: 'a.miller', name: 'Anna Miller', lkhash: 'must-not-leak' } }
      : { status: 401, json: { message: 'unauthorized' } },
  'GET /api/astproxy/trunks': { json: {} },
}

describe('HTTP mode', () => {
  let httpServer
  let baseUrl
  let config
  let audit
  let logs
  let ctiFetch
  let routes

  before(async () => {
    config = loadConfig({ NETHVOICE_CTI_URL: 'https://cti.example.org' })
    ctiFetch = createFakeFetch(new Proxy({}, { get: (_target, key) => routes[key] }))
    httpServer = createHttpServer(
      createHttpHandler({
        config,
        fetch: ctiFetch.fetch,
        log: (line) => logs.push(line),
        audit: (entry) => audit.push(entry),
      }),
    )
    await new Promise((resolve) => httpServer.listen(0, '127.0.0.1', resolve))
    const { port } = httpServer.address()

    config.allowedHosts = [`127.0.0.1:${port}`]
    baseUrl = `http://127.0.0.1:${port}/mcp`
  })

  after(() => new Promise((resolve) => httpServer.close(resolve)))

  beforeEach(() => {
    audit = []
    logs = []
    routes = { ...ctiRoutes }
    ctiFetch.calls.length = 0
  })

  const post = (headers = {}) =>
    fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', ...headers },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
    })

  const connectClient = async (token) => {
    const client = new Client({ name: 'test', version: '0.0.0' })
    await client.connect(
      new StreamableHTTPClientTransport(new URL(baseUrl), {
        requestInit: { headers: { Authorization: `Bearer ${token}` } },
      }),
    )
    return client
  }

  it('asks for a bearer token', async () => {
    const response = await post()

    assert.equal(response.status, 401)
    assert.equal(response.headers.get('www-authenticate'), 'Bearer')
    assert.equal(ctiFetch.calls.length, 0)
  })

  it('rejects a token that NethVoice CTI does not accept, before handling the request', async () => {
    const response = await post({ Authorization: 'Bearer bad' })

    assert.equal(response.status, 401)
    assert.match(response.headers.get('www-authenticate'), /^Bearer error="invalid_token"/)
    assert.deepEqual(
      ctiFetch.calls.map((call) => call.path),
      ['/api/user/me'],
    )
    assert.equal(audit.length, 0)
  })

  it('answers 502 when NethVoice CTI cannot be reached', async () => {
    routes['GET /api/user/me'] = { throws: networkError('ECONNREFUSED') }
    const response = await post({ Authorization: 'Bearer good' })

    assert.equal(response.status, 502)
    assert.match(logs[0], /GET \/api\/user\/me failed: ECONNREFUSED/)
  })

  it('rejects a host or an origin that is not allowed', async () => {
    const wrongOrigin = await post({ Authorization: 'Bearer good', Origin: 'https://evil.example.com' })

    assert.equal(wrongOrigin.status, 403)
    assert.equal(ctiFetch.calls.length, 0)
    assert.equal(checkRequestHeaders({ host: 'evil.example.com' }, config), 'host evil.example.com is not allowed')
    assert.equal(checkRequestHeaders({ host: config.allowedHosts[0] }, config), '')
    assert.equal(
      checkRequestHeaders(
        { host: config.allowedHosts[0], origin: 'https://claude.ai' },
        {
          ...config,
          allowedOrigins: ['https://claude.ai'],
        },
      ),
      '',
    )
  })

  it('runs the tools as the user of the token and logs that username', async () => {
    const client = await connectClient('good')
    const { tools } = await client.listTools()

    assert.ok(tools.some((tool) => tool.name === 'get_trunks_status'))
    assert.ok(!tools.some((tool) => tool.name === 'list_users'))

    await client.callTool({ name: 'get_trunks_status', arguments: {} })
    await client.close()

    assert.deepEqual(
      audit.map((entry) => [entry.tool, entry.identity, entry.outcome]),
      [['get_trunks_status', 'a.miller', 'ok']],
    )
    assert.equal(ctiFetch.calls.filter((call) => call.path === '/api/user/me').length, 1)
  })
})

describe('createTokenValidator', () => {
  it('caches a valid token for a limited time', async () => {
    let time = 0
    const { fetch, calls } = createFakeFetch({ 'GET /api/user/me': { json: { username: 'a.miller' } } })
    const validate = createTokenValidator({
      ctiUrl: 'https://cti.example.org',
      timeoutMs: 1000,
      fetch,
      now: () => time,
    })

    assert.equal(await validate('jwt'), 'a.miller')
    time = 59_000
    assert.equal(await validate('jwt'), 'a.miller')
    assert.equal(calls.length, 1)
    time = 61_000
    assert.equal(await validate('jwt'), 'a.miller')
    assert.equal(calls.length, 2)
  })

  it('validates concurrent requests with the same token once', async () => {
    const { fetch, calls } = createFakeFetch({ 'GET /api/user/me': { json: { username: 'a.miller' } } })
    const validate = createTokenValidator({ ctiUrl: 'https://cti.example.org', timeoutMs: 1000, fetch })

    await Promise.all([validate('jwt'), validate('jwt'), validate('jwt')])
    assert.equal(calls.length, 1)
  })

  it('does not cache a rejected token', async () => {
    const { fetch, calls } = createFakeFetch({ 'GET /api/user/me': { status: 401 } })
    const validate = createTokenValidator({ ctiUrl: 'https://cti.example.org', timeoutMs: 1000, fetch })

    await assert.rejects(validate('jwt'), { name: 'InvalidTokenError' })
    await assert.rejects(validate('jwt'), { name: 'InvalidTokenError' })
    assert.equal(calls.length, 2)
  })
})
