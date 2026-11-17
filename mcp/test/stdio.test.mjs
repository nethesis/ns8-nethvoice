//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { loadConfig } from '../src/config.mjs'
import { prepareStdio } from '../src/stdio.mjs'
import { createFakeFetch } from './fakeFetch.mjs'

const ADMIN_ENV = {
  NETHVOICE_PBX_URL: 'https://voice.example.org',
  NETHVOICE_ADMIN_USERNAME: 'mcp',
  NETHVOICE_ADMIN_PASSWORD: 'pw',
}

const CTI_ENV = { NETHVOICE_CTI_URL: 'https://cti.example.org', NETHVOICE_CTI_TOKEN: 'jwt' }

describe('prepareStdio', () => {
  it('reads the username and the sections of the administrator', async () => {
    const { fetch } = createFakeFetch({
      'POST /freepbx/rest/testauth': { json: { result: 'shared' } },
      'GET /freepbx/rest/me': { json: { username: 'mcp', permissions: ['dashboard'] } },
    })
    const result = await prepareStdio({ config: loadConfig(ADMIN_ENV), fetch })

    assert.ok(result.pbx)
    assert.equal(result.cti, undefined)
    assert.deepEqual(result.identities, { pbx: 'mcp' })
    assert.deepEqual(result.adminPermissions, ['dashboard'])
  })

  it('fails when only admin tools are configured and the permissions cannot be read', async () => {
    const { fetch } = createFakeFetch({ 'POST /freepbx/rest/testauth': { status: 401 } })

    await assert.rejects(
      prepareStdio({ config: loadConfig(ADMIN_ENV), fetch }),
      /cannot read the administrator permissions: POST \/freepbx\/rest\/testauth failed with status 401/,
    )
  })

  it('keeps the user tools and drops the admin tools when the permissions cannot be read', async () => {
    const logs = []
    const { fetch } = createFakeFetch({
      'POST /freepbx/rest/testauth': { json: { result: 'shared' } },
      'GET /freepbx/rest/me': { status: 404 },
      'GET /api/user/me': { json: { username: 'a.miller' } },
    })
    const result = await prepareStdio({
      config: loadConfig({ ...CTI_ENV, ...ADMIN_ENV }),
      fetch,
      log: (line) => logs.push(line),
    })

    assert.ok(result.cti)
    assert.equal(result.pbx, undefined)
    assert.deepEqual(result.identities, { cti: 'a.miller' })
    assert.match(logs[0], /admin tools disabled/)
  })

  it('uses the configured CTI username without calling the CTI', async () => {
    const { fetch, calls } = createFakeFetch({})
    const result = await prepareStdio({
      config: loadConfig({
        NETHVOICE_CTI_URL: 'https://cti.example.org',
        NETHVOICE_CTI_USERNAME: 'a.miller',
        NETHVOICE_CTI_PASSWORD: 'pw',
      }),
      fetch,
    })

    assert.deepEqual(result.identities, { cti: 'a.miller' })
    assert.equal(calls.length, 0)
  })

  it('refuses to start without credentials', async () => {
    await assert.rejects(
      prepareStdio({ config: loadConfig({ NETHVOICE_CTI_URL: 'https://cti.example.org' }) }),
      /no credentials/,
    )
  })
})
