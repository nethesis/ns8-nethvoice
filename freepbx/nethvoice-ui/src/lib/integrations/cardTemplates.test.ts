//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest'
import { encodeBase64Utf8 } from './base64'
import {
  buildCardTemplatePayload,
  getCardTemplateId,
  normalizeTemplateName,
  parseCardTemplates,
  toCardTemplateForm,
  toDuplicatedCardTemplateForm,
  validateCardTemplateForm,
} from './cardTemplates'

const rawTemplates = [
  {
    name: 'invoices',
    custom: true,
    html: encodeBase64Utf8('<p><%= results[0].total %> €</p>'),
    color: null,
  },
  { name: 'table', custom: false, html: encodeBase64Utf8('<!-- color: red -->'), color: 'red' },
  { name: 'identity', custom: false, html: encodeBase64Utf8('<div></div>') },
]

const templates = () => parseCardTemplates(rawTemplates)

describe('parseCardTemplates', () => {
  it('should decode the code and list built-in templates first', () => {
    expect(templates()).toEqual([
      { id: 'identity', name: 'identity', custom: false, code: '<div></div>' },
      { id: 'table', name: 'table', custom: false, code: '<!-- color: red -->' },
      {
        id: 'invoices_custom',
        name: 'invoices',
        custom: true,
        code: '<p><%= results[0].total %> €</p>',
      },
    ])
  })

  it('should reject an unexpected shape', () => {
    expect(() => parseCardTemplates([{ custom: true }])).toThrow()
  })
})

describe('template names', () => {
  it('should build the file name the cards refer to', () => {
    expect(getCardTemplateId('invoices', true)).toBe('invoices_custom')
    expect(getCardTemplateId('table', false)).toBe('table')
  })

  it('should mirror the name normalization of the server', () => {
    expect(normalizeTemplateName(' Open Invoices 2 ')).toBe('openinvoices2')
  })
})

describe('validateCardTemplateForm', () => {
  it('should accept letters and digits', () => {
    expect(validateCardTemplateForm({ name: 'Orders2', code: '<p></p>' }, templates())).toEqual({})
  })

  it('should require name and code', () => {
    expect(validateCardTemplateForm({ name: '', code: ' ' }, [])).toEqual({
      name: 'integrations.cards.template_name_required',
      code: 'integrations.cards.template_code_required',
    })
  })

  it('should reject characters the server would strip', () => {
    expect(validateCardTemplateForm({ name: 'open invoices', code: '<p></p>' }, [])).toEqual({
      name: 'integrations.cards.template_name_invalid',
    })
  })

  it('should reject the name of another custom template, ignoring case', () => {
    expect(validateCardTemplateForm({ name: 'Invoices', code: '<p></p>' }, templates())).toEqual({
      name: 'integrations.cards.template_name_already_used',
    })
    expect(validateCardTemplateForm({ name: 'table', code: '<p></p>' }, templates())).toEqual({})
  })
})

describe('forms and payload', () => {
  it('should build the body of a custom template', () => {
    expect(buildCardTemplatePayload({ name: 'Orders2', code: '<p>città</p>' })).toEqual({
      name: 'orders2',
      custom: true,
      html: encodeBase64Utf8('<p>città</p>'),
    })
  })

  it('should fill the form from a template', () => {
    expect(toCardTemplateForm(templates()[2])).toEqual({
      name: 'invoices',
      code: '<p><%= results[0].total %> €</p>',
    })
  })

  it('should copy only the code when duplicating', () => {
    expect(toDuplicatedCardTemplateForm(templates()[1])).toEqual({
      name: '',
      code: '<!-- color: red -->',
    })
  })
})
