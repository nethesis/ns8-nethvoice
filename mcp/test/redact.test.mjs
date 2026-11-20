//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { isSecretKey, limitList, MAX_TEXT_LENGTH, sanitize } from '../src/redact.mjs'

describe('sanitize', () => {
  it('drops credential fields at any depth', () => {
    const input = {
      username: 'a.miller',
      password: 'p',
      devices: [{ extension: '300', secret: 's', web_password: 'w', web_user: 'admin' }],
      default_device: { id: '300', secret: 's' },
      lkhash: 'x',
      token: 't',
      voicemailpwd: '1234',
    }

    assert.deepEqual(sanitize(input), {
      username: 'a.miller',
      devices: [{ extension: '300' }],
      default_device: { id: '300' },
    })
  })

  it('keeps fields that only look similar', () => {
    assert.equal(isSecretKey('status'), false)
    assert.equal(isSecretKey('mainPresence'), false)
    assert.equal(isSecretKey('codecs'), false)
    assert.equal(isSecretKey('pinned'), false)
  })

  it('truncates long free text coming from the PBX', () => {
    const notes = 'x'.repeat(MAX_TEXT_LENGTH + 50)
    const result = sanitize({ notes })

    assert.equal(result.notes.length, MAX_TEXT_LENGTH + 1)
    assert.ok(result.notes.endsWith('…'))
  })

  it('leaves numbers, booleans and null untouched', () => {
    assert.deepEqual(sanitize({ a: 1, b: false, c: null }), { a: 1, b: false, c: null })
  })
})

describe('limitList', () => {
  it('reports the total and whether rows were cut', () => {
    assert.deepEqual(limitList([1, 2, 3], 2), { total: 3, truncated: true, items: [1, 2] })
    assert.deepEqual(limitList([1], 2), { total: 1, truncated: false, items: [1] })
  })
})
