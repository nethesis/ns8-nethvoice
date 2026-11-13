//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { hasAdminCredentials, hasCtiCredentials, loadConfig } from '../src/config.mjs'

describe('loadConfig', () => {
  it('requires at least one backend', () => {
    assert.throws(() => loadConfig({}), /NETHVOICE_CTI_URL/)
  })

  it('refuses plain http for a remote host', () => {
    assert.throws(() => loadConfig({ NETHVOICE_CTI_URL: 'http://cti.example.org' }), /https/)
  })

  it('accepts plain http on the loopback interface', () => {
    assert.equal(loadConfig({ NETHVOICE_CTI_URL: 'http://127.0.0.1:8080/' }).ctiUrl, 'http://127.0.0.1:8080')
  })

  it('keeps writes disabled unless explicitly enabled', () => {
    assert.equal(loadConfig({ NETHVOICE_CTI_URL: 'https://cti.example.org' }).enableWrites, false)
    assert.equal(
      loadConfig({ NETHVOICE_CTI_URL: 'https://cti.example.org', NETHVOICE_MCP_ENABLE_WRITES: 'true' })
        .enableWrites,
      false,
    )
    assert.equal(
      loadConfig({ NETHVOICE_CTI_URL: 'https://cti.example.org', NETHVOICE_MCP_ENABLE_WRITES: '1' })
        .enableWrites,
      true,
    )
  })

  it('needs the PBX URL for admin tools', () => {
    assert.throws(
      () => loadConfig({ NETHVOICE_CTI_URL: 'https://cti.example.org', NETHVOICE_ADMIN_USERNAME: 'admin' }),
      /NETHVOICE_PBX_URL/,
    )
  })

  it('rejects a port that is not a positive integer', () => {
    assert.throws(
      () => loadConfig({ NETHVOICE_CTI_URL: 'https://cti.example.org', NETHVOICE_MCP_PORT: 'abc' }),
      /NETHVOICE_MCP_PORT/,
    )
  })
})

describe('credentials', () => {
  it('detects user and admin credentials', () => {
    const config = loadConfig({
      NETHVOICE_CTI_URL: 'https://cti.example.org',
      NETHVOICE_CTI_TOKEN: 'jwt',
      NETHVOICE_PBX_URL: 'https://voice.example.org',
      NETHVOICE_ADMIN_USERNAME: 'admin',
      NETHVOICE_ADMIN_PASSWORD: 'pw',
    })

    assert.equal(hasCtiCredentials(config), true)
    assert.equal(hasAdminCredentials(config), true)
  })

  it('needs both username and password without a token', () => {
    const config = loadConfig({ NETHVOICE_CTI_URL: 'https://cti.example.org', NETHVOICE_CTI_USERNAME: 'a' })

    assert.equal(hasCtiCredentials(config), false)
    assert.equal(hasAdminCredentials(config), false)
  })
})
