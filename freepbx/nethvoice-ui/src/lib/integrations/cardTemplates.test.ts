//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest'
import { ApiError } from '@/lib/api/errors'
import { encodeBase64Utf8 } from './base64'
import {
  buildCardPreviewDocument,
  buildCardTemplateColorPayload,
  buildCardTemplatePayload,
  EXAMPLE_RESULTS,
  formatSampleResults,
  getTemplateRenderError,
  parseSampleResults,
  SAMPLE_RESULTS_MAX_BYTES,
  TEMPLATE_COLOR_CLASSES,
  getCardTemplateId,
  normalizeTemplateName,
  parseCardTemplates,
  setCardTemplateColor,
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
      { id: 'identity', name: 'identity', custom: false, code: '<div></div>', color: '' },
      { id: 'table', name: 'table', custom: false, code: '<!-- color: red -->', color: 'red' },
      {
        id: 'invoices_custom',
        name: 'invoices',
        custom: true,
        code: '<p><%= results[0].total %> €</p>',
        color: '',
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

  it('should reject the name of another template, built-in or custom, ignoring case', () => {
    expect(validateCardTemplateForm({ name: 'Invoices', code: '<p></p>' }, templates())).toEqual({
      name: 'integrations.cards.template_name_already_used',
    })
    expect(validateCardTemplateForm({ name: 'Table', code: '<p></p>' }, templates())).toEqual({
      name: 'integrations.cards.template_name_already_used',
    })
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

  it('should copy the code and suggest a valid name when duplicating', () => {
    expect(toDuplicatedCardTemplateForm(templates()[1])).toEqual({
      name: 'tablecopy',
      code: '<!-- color: red -->',
    })
    expect(
      validateCardTemplateForm(toDuplicatedCardTemplateForm(templates()[1]), templates()),
    ).toEqual({})
  })
})

describe('built-in template color', () => {
  const table = '<!-- color: red -->\n<thead class="bg-red-600 text-white"><td class="bg-red-6000">'

  it('should change the color comment and the header color class', () => {
    expect(setCardTemplateColor(table, 'blue')).toBe(
      '<!-- color: blue -->\n<thead class="bg-blue-600 text-white"><td class="bg-red-6000">',
    )
  })

  it('should add the color comment when the template has none', () => {
    expect(setCardTemplateColor('<div class="bg-red-600"></div>', 'green')).toBe(
      '<!-- color: green -->\n<div class="bg-red-600"></div>',
    )
  })

  it('should keep the classes of a color it does not know', () => {
    expect(setCardTemplateColor('<!-- color: cyan --><p class="bg-cyan-600">', 'red')).toBe(
      '<!-- color: red --><p class="bg-cyan-600">',
    )
  })

  it('should save a built-in template under its own name', () => {
    const [, builtIn] = templates()

    expect(buildCardTemplateColorPayload(builtIn!, 'teal')).toEqual({
      name: 'table',
      custom: false,
      html: encodeBase64Utf8('<!-- color: teal -->'),
    })
  })
})

describe('sample results', () => {
  it('should accept a list of rows and a single row', () => {
    expect(parseSampleResults('[{"name":"Zoë","total":12.5},{}]')).toEqual({
      results: [{ name: 'Zoë', total: 12.5 }, {}],
    })
    expect(parseSampleResults(' {"name": "Ana"} ')).toEqual({ results: [{ name: 'Ana' }] })
    expect(parseSampleResults('[]')).toEqual({ results: [] })
  })

  it('should read back the text it formats', () => {
    const text = formatSampleResults(EXAMPLE_RESULTS)

    expect(text.split('\n')).toHaveLength(EXAMPLE_RESULTS.length + 2)
    expect(parseSampleResults(text)).toEqual({ results: EXAMPLE_RESULTS })
  })

  it('should require the results', () => {
    expect(parseSampleResults(' \n')).toEqual({
      issue: 'integrations.cards.sample_results_required',
    })
  })

  it('should reject text that is not JSON', () => {
    for (const text of ['[{name: "Ana"}]', "[{'name':'Ana'}]", '[{"name":"Ana"},]', 'Ana']) {
      expect(parseSampleResults(text)).toEqual({
        issue: 'integrations.cards.sample_results_invalid_json',
      })
    }
  })

  it('should reject JSON that is not rows', () => {
    for (const text of [
      '"Ana"',
      '12',
      'null',
      'true',
      '[["Ana","Rossi"]]',
      '[{"a":1},2]',
      '[null]',
    ]) {
      expect(parseSampleResults(text)).toEqual({
        issue: 'integrations.cards.sample_results_not_rows',
      })
    }
  })

  it('should limit the size in bytes, as the server does', () => {
    const row = (text: string) => `[{"notes":"${text}"}]`
    const overhead = row('').length

    expect(parseSampleResults(row('x'.repeat(SAMPLE_RESULTS_MAX_BYTES - overhead)))).toHaveProperty(
      'results',
    )
    expect(parseSampleResults(row('x'.repeat(SAMPLE_RESULTS_MAX_BYTES - overhead + 1)))).toEqual({
      issue: 'integrations.cards.sample_results_too_large',
    })
    expect(parseSampleResults(row('€'.repeat(SAMPLE_RESULTS_MAX_BYTES / 3)))).toEqual({
      issue: 'integrations.cards.sample_results_too_large',
    })
  })
})

describe('template preview', () => {
  const apiError = (status: number, body: unknown) =>
    new ApiError({ status, method: 'POST', url: '/cti/customer_card/template/preview', body })

  it('should read the EJS error of a template that cannot be rendered', () => {
    expect(
      getTemplateRenderError(
        apiError(422, { message: 'x', error: 'ejs:1\n\nmissing is not defined\n' }),
      ),
    ).toBe('ejs:1\n\nmissing is not defined')
  })

  it('should ignore the other errors', () => {
    expect(getTemplateRenderError(apiError(502, { error: 'ejs:1' }))).toBe('')
    expect(getTemplateRenderError(apiError(422, { error: ['ejs:1'] }))).toBe('')
    expect(getTemplateRenderError(apiError(422, 'ejs:1'))).toBe('')
    expect(getTemplateRenderError(new Error('ejs:1'))).toBe('')
  })

  it('should wrap the card in a document without scripts of its own', () => {
    const document = buildCardPreviewDocument('<p>città</p>')

    expect(document).toContain('<meta charset="utf-8">')
    expect(document).toContain('<body><p>città</p></body>')
    expect(document).not.toContain('<script')
  })

  it('should offer indigo, the default color of the design', () => {
    expect(TEMPLATE_COLOR_CLASSES.indigo).toBe('indigo-600')
    expect(
      setCardTemplateColor('<!-- color: indigo -->\n<thead class="bg-indigo-600">', 'red'),
    ).toBe('<!-- color: red -->\n<thead class="bg-red-600">')
  })
})
