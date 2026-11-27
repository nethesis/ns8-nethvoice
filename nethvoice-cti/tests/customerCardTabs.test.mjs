// Copyright (C) 2026 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { decodeCustomerCardHtml, orderCustomerCards } from '../lib/customerCardTabs.ts'

test('customer card html keeps accented letters and symbols', () => {
  const html = '<p>Società Città · Müller €</p>'

  assert.equal(decodeCustomerCardHtml(Buffer.from(html, 'utf8').toString('base64')), html)
  assert.equal(decodeCustomerCardHtml(''), '')
})

test('customer card tabs follow the saved order', () => {
  const cards = { cc_crm: {}, cc_shop: {}, cc_orders: {} }

  assert.deepEqual(orderCustomerCards(['cc_orders', 'cc_crm', 'cc_shop'], cards), [
    'cc_orders',
    'cc_crm',
    'cc_shop',
  ])
})

test('customer cards missing from the saved order are appended, never hidden', () => {
  const cards = { cc_crm: {}, cc_crm_2: {}, cc_shop: {} }

  assert.deepEqual(orderCustomerCards(['cc_shop', 'cc_old_name', 'cc_shop'], cards), [
    'cc_shop',
    'cc_crm',
    'cc_crm_2',
  ])
  assert.deepEqual(orderCustomerCards(undefined, cards), ['cc_crm', 'cc_crm_2', 'cc_shop'])
  assert.deepEqual(orderCustomerCards([1, null, 'cc_crm'], cards), ['cc_crm', 'cc_crm_2', 'cc_shop'])
})
