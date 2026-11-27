// Copyright (C) 2026 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { keepAvailableGroupFilter } from '../lib/operatorsGroupFilter.ts'

test('a saved group that no longer exists falls back to all the groups', () => {
  assert.deepEqual(keepAvailableGroupFilter(['Old sales'], ['Sales', 'Support']), ['all'])
  assert.deepEqual(keepAvailableGroupFilter(['Old sales'], []), ['all'])
})

test('the saved groups that still exist are kept', () => {
  assert.deepEqual(keepAvailableGroupFilter(['Sales', 'Old sales'], ['Sales', 'Support']), [
    'Sales',
  ])
  assert.deepEqual(keepAvailableGroupFilter(['Support', 'Sales'], ['Sales', 'Support']), [
    'Support',
    'Sales',
  ])
})

test('all and favorites do not depend on the groups', () => {
  assert.deepEqual(keepAvailableGroupFilter(['all'], []), ['all'])
  assert.deepEqual(keepAvailableGroupFilter(['favorites', 'Old sales'], ['Sales']), ['favorites'])
})
