//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import * as v from 'valibot'
import { api } from '@/lib/api/client'
import { isApiError } from '@/lib/api/errors'
import type { components } from '@/lib/api/schema'
import { compareNatural } from '@/lib/common'
import { decodeBase64Utf8, encodeBase64Utf8 } from './base64'
import { type FieldIssues, requiredText, validateForm } from './validation'

export const CARD_TEMPLATES_KEY = 'customerCardTemplates'

export const CARD_TEMPLATE_PREVIEW_KEY = 'customerCardTemplatePreview'

export const CUSTOM_TEMPLATE_SUFFIX = '_custom'

export const DEFAULT_TEMPLATE_CODE =
  '<% for (var i = 0; i < results.length; i++) { %>\n' +
  '  <%= results[i].name %> <strong><%= results[i].lastname %></strong>\n' +
  '<% } %>\n'

type CardTemplateInput = components['schemas']['IntegrationsCardTemplateInput']

export type SampleRow = Record<string, unknown>

export const SAMPLE_RESULTS_MAX_BYTES = 65536

export const DEFAULT_SAMPLE_RESULTS: SampleRow[] = [
  { name: 'Anna', lastname: 'Bianchi' },
  { name: 'Luca', lastname: 'Verdi' },
]

export const EXAMPLE_RESULTS: SampleRow[] = [
  { order: 'SO-1042', date: '12/11/2026', total: '€ 1,250.00' },
  { order: 'SO-0987', date: '28/10/2026', total: '€ 430.00' },
  { order: 'SO-0911', date: '02/10/2026', total: '€ 2,980.00' },
]

export const CARD_PREVIEW_STYLESHEET =
  'https://cdnjs.cloudflare.com/ajax/libs/tailwindcss/2.2.19/tailwind.min.css'

const PreviewResponseSchema = v.object({ html: v.string() })

const CardTemplatesResponseSchema = v.array(
  v.object({
    name: v.string(),
    custom: v.nullish(v.boolean(), false),
    html: v.nullish(v.string(), ''),
    color: v.nullish(v.string(), ''),
  }),
)

export type CardTemplate = {
  id: string
  name: string
  custom: boolean
  code: string
  color: string
}

export type CardTemplateForm = {
  name: string
  code: string
}

export const getCardTemplateId = (name: string, custom: boolean): string =>
  custom ? `${name}${CUSTOM_TEMPLATE_SUFFIX}` : name

export const normalizeTemplateName = (name: string): string =>
  name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()

export const parseCardTemplates = (raw: unknown): CardTemplate[] =>
  v
    .parse(CardTemplatesResponseSchema, raw)
    .map((template) => ({
      id: getCardTemplateId(template.name, template.custom),
      name: template.name,
      custom: template.custom,
      code: decodeBase64Utf8(template.html),
      color: template.color.trim(),
    }))
    .sort((a, b) => Number(a.custom) - Number(b.custom) || compareNatural(a.name, b.name))

export const emptyCardTemplateForm = (): CardTemplateForm => ({
  name: '',
  code: DEFAULT_TEMPLATE_CODE,
})

export const toCardTemplateForm = (template: CardTemplate): CardTemplateForm => ({
  name: template.name,
  code: template.code,
})

export const toDuplicatedCardTemplateForm = (template: CardTemplate): CardTemplateForm => ({
  name: `${normalizeTemplateName(template.name)}copy`,
  code: template.code,
})

export const DEFAULT_TEMPLATE_COLOR = 'indigo'

export const TEMPLATE_COLOR_CLASSES: Record<string, string> = {
  red: 'red-600',
  orange: 'yellow-600',
  yellow: 'yellow-500',
  olive: 'lime-800',
  green: 'emerald-600',
  teal: 'green-400',
  blue: 'blue-600',
  indigo: 'indigo-600',
  violet: 'violet-500',
  purple: 'purple-600',
  pink: 'pink-500',
  brown: 'yellow-800',
}

export const TEMPLATE_COLORS = Object.keys(TEMPLATE_COLOR_CLASSES)

const COLOR_COMMENT = /<!--\s*color:\s*(.*?)\s*-->/

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export const setCardTemplateColor = (code: string, color: string): string => {
  const current = COLOR_COMMENT.exec(code)?.[1] ?? ''
  const comment = `<!-- color: ${color} -->`
  let result = COLOR_COMMENT.test(code)
    ? code.replace(COLOR_COMMENT, comment)
    : `${comment}\n${code}`
  const from = TEMPLATE_COLOR_CLASSES[current]
  const to = TEMPLATE_COLOR_CLASSES[color]

  if (from && to && from !== to) {
    result = result.replace(
      new RegExp(`(^|[\\s"'])bg-${escapeRegExp(from)}(?=[\\s"']|$)`, 'g'),
      `$1bg-${to}`,
    )
  }
  return result
}

export const buildCardTemplateColorPayload = (
  template: CardTemplate,
  color: string,
): CardTemplateInput => ({
  name: template.name,
  custom: false,
  html: encodeBase64Utf8(setCardTemplateColor(template.code, color)),
})

const CardTemplateFormSchema = v.object({
  name: v.pipe(
    v.string(),
    v.trim(),
    v.nonEmpty('integrations.cards.template_name_required'),
    v.regex(/^[a-zA-Z0-9]+$/, 'integrations.cards.template_name_invalid'),
  ),
  code: requiredText('integrations.cards.template_code_required'),
})

export const validateCardTemplateForm = (
  form: CardTemplateForm,
  otherTemplates: CardTemplate[],
): FieldIssues => {
  const issues = validateForm(CardTemplateFormSchema, form)
  const name = normalizeTemplateName(form.name)

  if (
    !issues.name &&
    otherTemplates.some((template) => normalizeTemplateName(template.name) === name)
  ) {
    issues.name = 'integrations.cards.template_name_already_used'
  }
  return issues
}

export const buildCardTemplatePayload = (form: CardTemplateForm): CardTemplateInput => ({
  name: normalizeTemplateName(form.name),
  custom: true,
  html: encodeBase64Utf8(form.code),
})

export const getCardTemplates = async (): Promise<CardTemplate[]> => {
  const { data } = await api.GET('/cti/customer_card/template')
  return parseCardTemplates(data)
}

export const saveCardTemplate = async (
  payload: CardTemplateInput,
  existing?: CardTemplate,
): Promise<void> => {
  if (existing) {
    await api.PUT('/cti/customer_card/template/{name}', {
      params: { path: { name: existing.name } },
      body: payload,
    })
  } else {
    await api.POST('/cti/customer_card/template', { body: payload })
  }
}

export const deleteCardTemplate = async (name: string): Promise<void> => {
  await api.DELETE('/cti/customer_card/template/{name}', { params: { path: { name } } })
}

export const formatSampleResults = (rows: SampleRow[]): string =>
  `[\n${rows.map((row) => `  ${JSON.stringify(row)}`).join(',\n')}\n]`

const isRow = (value: unknown): value is SampleRow =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export type SampleResultsCheck =
  { results: SampleRow[]; issue?: undefined } | { results?: undefined; issue: string }

export const parseSampleResults = (text: string): SampleResultsCheck => {
  if (!text.trim()) {
    return { issue: 'integrations.cards.sample_results_required' }
  }
  if (new TextEncoder().encode(text).length > SAMPLE_RESULTS_MAX_BYTES) {
    return { issue: 'integrations.cards.sample_results_too_large' }
  }
  let value: unknown

  try {
    value = JSON.parse(text)
  } catch {
    return { issue: 'integrations.cards.sample_results_invalid_json' }
  }
  if (isRow(value)) {
    return { results: [value] }
  }
  if (Array.isArray(value) && value.every(isRow)) {
    return { results: value }
  }
  return { issue: 'integrations.cards.sample_results_not_rows' }
}

export const buildCardPreviewDocument = (html: string): string =>
  `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="${CARD_PREVIEW_STYLESHEET}"><style>body{padding:8px;}</style></head><body>${html}</body></html>`

export const previewCardTemplate = async (
  code: string,
  results: SampleRow[],
  signal?: AbortSignal,
): Promise<string> => {
  const { data } = await api.POST('/cti/customer_card/template/preview', {
    body: { html: encodeBase64Utf8(code), results },
    signal,
  })
  return decodeBase64Utf8(v.parse(PreviewResponseSchema, data).html)
}

export const getTemplateRenderError = (error: unknown): string => {
  if (!isApiError(error) || error.status !== 422 || !isRow(error.body)) {
    return ''
  }
  const message = error.body.error

  return typeof message === 'string' ? message.trim() : ''
}
