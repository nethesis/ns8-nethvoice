//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import * as v from 'valibot'
import { api } from '@/lib/api/client'
import type { components } from '@/lib/api/schema'
import { compareNatural } from '@/lib/common'
import { decodeBase64Utf8, encodeBase64Utf8 } from './base64'
import { type FieldIssues, requiredText, validateForm } from './validation'

export const CARD_TEMPLATES_KEY = 'customerCardTemplates'

export const CUSTOM_TEMPLATE_SUFFIX = '_custom'

export const DEFAULT_TEMPLATE_CODE =
  '<% for (var i = 0; i < results.length; i++) { %>\n' +
  '  <%= results[i].name %> <strong><%= results[i].lastname %></strong>\n' +
  '<% } %>\n'

type CardTemplateInput = components['schemas']['IntegrationsCardTemplateInput']

const CardTemplatesResponseSchema = v.array(
  v.object({
    name: v.string(),
    custom: v.nullish(v.boolean(), false),
    html: v.nullish(v.string(), ''),
  }),
)

export type CardTemplate = {
  id: string
  name: string
  custom: boolean
  code: string
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
  name: '',
  code: template.code,
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
