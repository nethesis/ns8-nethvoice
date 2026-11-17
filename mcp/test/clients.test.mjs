//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { describe, it } from 'node:test'
import { CtiClient } from '../src/ctiClient.mjs'
import { buildSecretKey, PbxClient } from '../src/pbxClient.mjs'
import { readJson } from '../src/httpError.mjs'
import { createFakeFetch, networkError } from './fakeFetch.mjs'

const sha1 = (text) => createHash('sha1').update(text).digest('hex')

describe('CtiClient', () => {
  it('logs in once and reuses the token', async () => {
    const { fetch, calls } = createFakeFetch({
      'POST /api/login': { json: { token: 'jwt-1' } },
      'GET /api/user/me': { json: { username: 'a.miller' } },
    })
    const client = new CtiClient({ baseUrl: 'https://cti.example.org', username: 'a.miller', password: 'pw', fetch })

    await client.get('/user/me')
    await client.get('/user/me')

    assert.deepEqual(
      calls.map((call) => `${call.method} ${call.path}`),
      ['POST /api/login', 'GET /api/user/me', 'GET /api/user/me'],
    )
    assert.equal(calls[1].headers.Authorization, 'Bearer jwt-1')
  })

  it('logs in again once when the token expired', async () => {
    let logins = 0
    const { fetch, calls } = createFakeFetch({
      'POST /api/login': () => ({ json: { token: `jwt-${++logins}` } }),
      'GET /api/user/me': (call) =>
        call.headers.Authorization === 'Bearer jwt-2' ? { json: { username: 'a.miller' } } : { status: 401 },
    })
    const client = new CtiClient({ baseUrl: 'https://cti.example.org', username: 'a.miller', password: 'pw', fetch })

    assert.deepEqual(await client.get('/user/me'), { username: 'a.miller' })
    assert.equal(calls.filter((call) => call.path === '/api/login').length, 2)
  })

  it('does not retry forever on a persistent 401', async () => {
    const { fetch, calls } = createFakeFetch({
      'POST /api/login': { json: { token: 'jwt' } },
      'GET /api/user/me': { status: 401, json: { message: 'unauthorized' } },
    })
    const client = new CtiClient({ baseUrl: 'https://cti.example.org', username: 'a.miller', password: 'pw', fetch })

    await assert.rejects(client.get('/user/me'), /status 401: unauthorized/)
    assert.equal(calls.length, 4)
  })

  it('never logs in when it only holds a bearer token', async () => {
    const { fetch, calls } = createFakeFetch({ 'GET /api/user/me': { status: 401 } })
    const client = new CtiClient({ baseUrl: 'https://cti.example.org', token: 'expired', fetch })

    await assert.rejects(client.get('/user/me'), /status 401/)
    assert.equal(calls.length, 1)
  })

  it('shares one login between concurrent calls', async () => {
    let release
    const gate = new Promise((resolve) => {
      release = resolve
    })
    const { fetch, calls } = createFakeFetch({
      'POST /api/login': async () => {
        await gate
        return { json: { token: 'jwt-1' } }
      },
      'GET /api/user/me': { json: { username: 'a.miller' } },
      'GET /api/astproxy/trunks': { json: {} },
    })
    const client = new CtiClient({ baseUrl: 'https://cti.example.org', username: 'a.miller', password: 'pw', fetch })
    const pending = Promise.all([client.get('/user/me'), client.get('/astproxy/trunks'), client.get('/user/me')])

    release()
    await pending
    assert.equal(calls.filter((call) => call.path === '/api/login').length, 1)
  })

  it('logs in again only once when concurrent calls find the token expired', async () => {
    let logins = 0
    const { fetch, calls } = createFakeFetch({
      'POST /api/login': () => ({ json: { token: `jwt-${++logins}` } }),
      'GET /api/user/me': (call) =>
        call.headers.Authorization === 'Bearer jwt-2' ? { json: { username: 'a.miller' } } : { status: 401 },
    })
    const client = new CtiClient({ baseUrl: 'https://cti.example.org', username: 'a.miller', password: 'pw', fetch })

    await client.get('/user/me')
    logins = 0
    const stale = new CtiClient({ baseUrl: 'https://cti.example.org', username: 'a.miller', password: 'pw', fetch })
    calls.length = 0
    await Promise.all([stale.get('/user/me'), stale.get('/user/me'), stale.get('/user/me')])
    assert.equal(calls.filter((call) => call.path === '/api/login').length, 2)
  })

  it('names the request and the cause of a network failure', async () => {
    const { fetch } = createFakeFetch({ 'GET /api/user/me': { throws: networkError('ECONNREFUSED') } })
    const client = new CtiClient({ baseUrl: 'https://cti.example.org', token: 'jwt', fetch })

    await assert.rejects(client.get('/user/me'), (error) => {
      assert.equal(error.message, 'GET /api/user/me failed: ECONNREFUSED')
      assert.equal(error.code, 'ECONNREFUSED')
      return true
    })
  })

  it('reports a timeout with the request that hit it', async () => {
    const { fetch } = createFakeFetch({ 'GET /api/user/me': { hang: true } })
    const client = new CtiClient({ baseUrl: 'https://cti.example.org', token: 'jwt', timeoutMs: 20, fetch })

    await assert.rejects(client.get('/user/me'), /GET \/api\/user\/me failed: timeout/)
  })

  it('stops at the deadline of the caller even while a login is in progress', async () => {
    const { fetch } = createFakeFetch({ 'POST /api/login': { hang: true } })
    const client = new CtiClient({ baseUrl: 'https://cti.example.org', username: 'a', password: 'pw', timeoutMs: 5000, fetch })
    const startedAt = Date.now()

    await assert.rejects(client.get('/user/me', { signal: AbortSignal.timeout(20) }), /POST \/api\/login failed: timeout/)
    assert.ok(Date.now() - startedAt < 1000)
  })

  it('reports a failed login without leaking the password', async () => {
    const { fetch } = createFakeFetch({ 'POST /api/login': { status: 401, json: { message: 'wrong credentials' } } })
    const client = new CtiClient({ baseUrl: 'https://cti.example.org', username: 'a.miller', password: 'hunter2', fetch })

    await assert.rejects(client.get('/user/me'), (error) => {
      assert.match(error.message, /POST \/api\/login failed with status 401/)
      assert.doesNotMatch(error.message, /hunter2/)
      return true
    })
  })
})

describe('PbxClient', () => {
  it('computes the secret key like the REST API does', () => {
    assert.equal(buildSecretKey('admin', 'pw', 'shared'), sha1(`admin${sha1('pw')}shared`))
  })

  it('authenticates once and sends the User and Secretkey headers', async () => {
    const { fetch, calls } = createFakeFetch({
      'POST /freepbx/rest/testauth': { json: { result: 'shared' } },
      'GET /freepbx/rest/users/count': { json: 4 },
    })
    const client = new PbxClient({ baseUrl: 'https://voice.example.org', username: 'admin', password: 'pw', fetch })

    assert.equal(await client.get('/users/count'), 4)
    assert.equal(await client.get('/users/count'), 4)
    assert.equal(calls.filter((call) => call.path === '/freepbx/rest/testauth').length, 1)
    assert.equal(calls[1].headers.User, 'admin')
    assert.equal(calls[1].headers.Secretkey, buildSecretKey('admin', 'pw', 'shared'))
  })

  it('exposes no way to send a write request', () => {
    const client = new PbxClient({ baseUrl: 'https://voice.example.org', username: 'admin', password: 'pw' })
    const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(client)).filter((name) => name !== 'constructor')

    assert.deepEqual(methods, ['get'])
  })

  it('shares one authentication between concurrent calls', async () => {
    const { fetch, calls } = createFakeFetch({
      'POST /freepbx/rest/testauth': { json: { result: 'shared' } },
      'GET /freepbx/rest/users/count': { json: 4 },
      'GET /freepbx/rest/trunks/count': { json: 1 },
    })
    const client = new PbxClient({ baseUrl: 'https://voice.example.org', username: 'admin', password: 'pw', fetch })

    await Promise.all([client.get('/users/count'), client.get('/trunks/count'), client.get('/users/count')])
    assert.equal(calls.filter((call) => call.path === '/freepbx/rest/testauth').length, 1)
  })

  it('authenticates again once when the secret key is no longer valid', async () => {
    let secrets = 0
    const { fetch, calls } = createFakeFetch({
      'POST /freepbx/rest/testauth': () => ({ json: { result: `shared-${++secrets}` } }),
      'GET /freepbx/rest/users/count': (call) =>
        call.headers.Secretkey === buildSecretKey('admin', 'pw', 'shared-2')
          ? { json: 4 }
          : { status: 403, json: { error: 'Forbidden: wrong secret key' } },
    })
    const client = new PbxClient({ baseUrl: 'https://voice.example.org', username: 'admin', password: 'pw', fetch })

    assert.equal(await client.get('/users/count'), 4)
    assert.equal(calls.filter((call) => call.path === '/freepbx/rest/testauth').length, 2)
  })

  it('surfaces a persistent wrong secret key after one new authentication', async () => {
    const { fetch, calls } = createFakeFetch({
      'POST /freepbx/rest/testauth': { json: { result: 'shared' } },
      'GET /freepbx/rest/users/count': { status: 403, json: { error: 'Forbidden: wrong secret key' } },
    })
    const client = new PbxClient({ baseUrl: 'https://voice.example.org', username: 'admin', password: 'pw', fetch })

    await assert.rejects(client.get('/users/count'), /status 403: Forbidden: wrong secret key/)
    assert.equal(calls.length, 4)
  })

  it('does not retry when the administrator lacks the permission', async () => {
    const { fetch, calls } = createFakeFetch({
      'POST /freepbx/rest/testauth': { json: { result: 'shared' } },
      'GET /freepbx/rest/dashboard/calls': { status: 403, json: { message: 'Forbidden: missing permission' } },
    })
    const client = new PbxClient({ baseUrl: 'https://voice.example.org', username: 'mcp', password: 'pw', fetch })

    await assert.rejects(client.get('/dashboard/calls'), /GET \/freepbx\/rest\/dashboard\/calls failed with status 403: Forbidden: missing permission/)
    assert.deepEqual(
      calls.map((call) => call.path),
      ['/freepbx/rest/testauth', '/freepbx/rest/dashboard/calls'],
    )
  })

  it('names the host lookup failure', async () => {
    const { fetch } = createFakeFetch({ 'POST /freepbx/rest/testauth': { throws: networkError('ENOTFOUND') } })
    const client = new PbxClient({ baseUrl: 'https://voice.example.org', username: 'admin', password: 'pw', fetch })

    await assert.rejects(client.get('/users/count'), (error) => {
      assert.equal(error.message, 'POST /freepbx/rest/testauth failed: ENOTFOUND')
      assert.doesNotMatch(error.message, /pw/)
      return true
    })
  })
})

describe('readJson', () => {
  it('reports invalid JSON with the request method and path, without the response URL', async () => {
    await assert.rejects(readJson(new Response('<html>', { status: 200 }), 'POST', '/api/login'), {
      name: 'UpstreamError',
      message: 'POST /api/login failed with status 200: not JSON',
    })
  })

  it('returns null for an empty body', async () => {
    assert.equal(await readJson(new Response('', { status: 200 }), 'GET', '/x'), null)
  })
})
