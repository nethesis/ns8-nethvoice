//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest'
import { encodeBase64Utf8 } from './base64'
import {
  buildCustomerCardPayload,
  buildCustomerCardPreviewPayload,
  type CustomerCardForm,
  getCardsUsingConnection,
  getCardsUsingTemplate,
  getCustomerCardPermissionName,
  parseCustomerCardPreview,
  parseCustomerCards,
  toCustomerCardForm,
  validateCustomerCardForm,
} from './customerCards'

const identityQuery = "select * from phonebook where workphone like '%$NUMBER'"

const rawCards = [
  {
    id: 4,
    name: 'Open invoices',
    creation: '2026-02-01 10:00:00',
    query: encodeBase64Utf8('select * from invoices'),
    template: { name: 'invoices', custom: true },
    dbconn_id: 5,
    permission_id: 31,
    profiles: [3, '1'],
  },
  {
    id: 1,
    name: 'Identity',
    query: encodeBase64Utf8(identityQuery),
    template: { name: 'identity', custom: false },
    dbconn_id: 1,
    permission_id: null,
    profiles: [],
  },
]

const cards = () => parseCustomerCards(rawCards)

const form = (changes: Partial<CustomerCardForm> = {}): CustomerCardForm => ({
  name: 'Open invoices',
  dbConnectionId: '5',
  templateId: 'invoices_custom',
  profileIds: ['3', '1'],
  query: 'select * from invoices',
  ...changes,
})

describe('parseCustomerCards', () => {
  it('should decode the query, resolve the template file and sort by name', () => {
    expect(cards()).toEqual([
      {
        id: '1',
        name: 'Identity',
        query: identityQuery,
        templateId: 'identity',
        templateName: 'identity',
        dbConnectionId: '1',
        profileIds: [],
      },
      {
        id: '4',
        name: 'Open invoices',
        query: 'select * from invoices',
        templateId: 'invoices_custom',
        templateName: 'invoices',
        dbConnectionId: '5',
        profileIds: ['3', '1'],
      },
    ])
  })

  it('should reject an unexpected shape', () => {
    expect(() => parseCustomerCards([{ id: 1, name: 'Identity' }])).toThrow()
  })
})

describe('dependencies', () => {
  it('should find the cards that use a connection or a template', () => {
    expect(getCardsUsingConnection(cards(), '5').map((card) => card.name)).toEqual([
      'Open invoices',
    ])
    expect(getCardsUsingConnection(cards(), '9')).toEqual([])
    expect(getCardsUsingTemplate(cards(), 'identity').map((card) => card.name)).toEqual([
      'Identity',
    ])
    expect(getCardsUsingTemplate(cards(), 'invoices')).toEqual([])
  })
})

describe('getCustomerCardPermissionName', () => {
  it('should mirror the permission name built by the server', () => {
    expect(getCustomerCardPermissionName('Open invoices #2')).toBe('cc_open_invoices_2')
  })
})

describe('validateCustomerCardForm', () => {
  it('should accept a complete card', () => {
    expect(validateCustomerCardForm(form(), [])).toEqual({})
  })

  it('should reject a name whose permission collides with another card', () => {
    expect(validateCustomerCardForm(form({ name: 'identity!' }), cards())).toEqual({
      name: 'integrations.cards.card_name_already_used',
    })
    expect(validateCustomerCardForm(form({ name: 'Identity card' }), cards())).toEqual({})
  })

  it('should require every field', () => {
    expect(
      validateCustomerCardForm(
        {
          name: '',
          dbConnectionId: '',
          templateId: '',
          profileIds: [],
          query: ' ',
        },
        cards(),
      ),
    ).toEqual({
      name: 'integrations.cards.card_name_required',
      dbConnectionId: 'integrations.cards.card_connection_required',
      templateId: 'integrations.cards.card_template_required',
      profileIds: 'integrations.profiles_required',
      query: 'integrations.query_required',
    })
  })
})

describe('payloads', () => {
  it('should build the body of a card', () => {
    expect(buildCustomerCardPayload(form({ name: ' Open invoices ' }))).toEqual({
      name: 'Open invoices',
      query: encodeBase64Utf8('select * from invoices'),
      template: 'invoices_custom',
      dbconn_id: 5,
      profiles: [1, 3],
    })
  })

  it('should send the connection id as a string to the preview endpoint', () => {
    expect(buildCustomerCardPreviewPayload(form())).toEqual({
      dbconn_id: '5',
      template: 'invoices_custom',
      query: encodeBase64Utf8('select * from invoices'),
    })
  })

  it('should fill the form from a card', () => {
    expect(toCustomerCardForm(cards()[1])).toEqual(form())
  })

  it('should decode the rendered preview', () => {
    expect(parseCustomerCardPreview({ html: encodeBase64Utf8('<p>Anna Miller</p>') })).toBe(
      '<p>Anna Miller</p>',
    )
    expect(() => parseCustomerCardPreview({})).toThrow()
  })
})
