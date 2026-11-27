// Copyright (C) 2026 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  REMEMBERED_USERNAME_KEY,
  loadRememberedUsername,
  updateRememberedUsername,
} from '../lib/rememberedUsername.ts'

const createStorage = (initial = {}) => {
  const items = new Map(Object.entries(initial))
  return {
    items,
    getItem: (name) => (items.has(name) ? items.get(name) : null),
    setItem: (name, value) => items.set(name, value),
    removeItem: (name) => items.delete(name),
  }
}

const throwingStorage = {
  getItem: () => {
    throw new Error('blocked')
  },
  setItem: () => {
    throw new Error('blocked')
  },
  removeItem: () => {
    throw new Error('blocked')
  },
}

test('nothing is remembered by default', () => {
  assert.equal(loadRememberedUsername(createStorage()), '')
})

test('a remembered username is loaded', () => {
  const storage = createStorage({ [REMEMBERED_USERNAME_KEY]: 'john' })
  assert.equal(loadRememberedUsername(storage), 'john')
})

test('remembering saves the username under its key', () => {
  const storage = createStorage()
  updateRememberedUsername(storage, 'john', true)
  assert.equal(storage.items.get(REMEMBERED_USERNAME_KEY), 'john')
  assert.equal(loadRememberedUsername(storage), 'john')
})

test('remembering replaces a previous username', () => {
  const storage = createStorage({ [REMEMBERED_USERNAME_KEY]: 'john' })
  updateRememberedUsername(storage, 'mary', true)
  assert.equal(loadRememberedUsername(storage), 'mary')
})

test('not remembering clears the saved username', () => {
  const storage = createStorage({ [REMEMBERED_USERNAME_KEY]: 'john' })
  updateRememberedUsername(storage, 'john', false)
  assert.equal(storage.items.has(REMEMBERED_USERNAME_KEY), false)
  assert.equal(loadRememberedUsername(storage), '')
})

test('an empty username is never remembered', () => {
  const storage = createStorage({ [REMEMBERED_USERNAME_KEY]: 'john' })
  updateRememberedUsername(storage, '  ', true)
  assert.equal(storage.items.has(REMEMBERED_USERNAME_KEY), false)
})

test('surrounding spaces are not saved', () => {
  const storage = createStorage()
  updateRememberedUsername(storage, ' john ', true)
  assert.equal(storage.items.get(REMEMBERED_USERNAME_KEY), 'john')
})

test('the key is the dedicated one', () => {
  assert.equal(REMEMBERED_USERNAME_KEY, 'remembered-username')
})

test('an unavailable storage neither throws nor remembers', () => {
  assert.equal(loadRememberedUsername(throwingStorage), '')
  assert.doesNotThrow(() => updateRememberedUsername(throwingStorage, 'john', true))
  assert.doesNotThrow(() => updateRememberedUsername(throwingStorage, 'john', false))
})
