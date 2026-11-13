//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { describe, it } from 'node:test'
import { CtiClient } from '../src/ctiClient.mjs'
import { buildSecretKey, PbxClient } from '../src/pbxClient.mjs'
import { createFakeFetch } from './fakeFetch.mjs'

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

  it('surfaces the error of the API', async () => {
    const { fetch } = createFakeFetch({
      'POST /freepbx/rest/testauth': { json: { result: 'shared' } },
      'GET /freepbx/rest/users/count': { status: 403, json: { error: 'Forbidden: wrong secret key' } },
    })
    const client = new PbxClient({ baseUrl: 'https://voice.example.org', username: 'admin', password: 'pw', fetch })

    await assert.rejects(client.get('/users/count'), /status 403: Forbidden: wrong secret key/)
  })
})
