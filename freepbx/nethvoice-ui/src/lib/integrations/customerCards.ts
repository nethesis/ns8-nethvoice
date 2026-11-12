//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import * as v from 'valibot'
import { api } from '@/lib/api/client'
import type { components } from '@/lib/api/schema'
import { compareNatural } from '@/lib/common'
import { decodeBase64Utf8, encodeBase64Utf8 } from './base64'
import { getCardTemplateId } from './cardTemplates'
import { postCtiApi } from './ctiApi'
import { toProfileIdNumbers } from './lookups'
import { type FieldIssues, requiredText, validateForm } from './validation'

export const CUSTOMER_CARDS_KEY = 'customerCards'

type CustomerCardInput = components['schemas']['IntegrationsCustomerCardInput']

const IdSchema = v.pipe(v.union([v.number(), v.string()]), v.transform(String))

const CustomerCardsResponseSchema = v.array(
  v.object({
    id: IdSchema,
    name: v.string(),
    query: v.nullish(v.string(), ''),
    template: v.object({ name: v.string(), custom: v.nullish(v.boolean(), false) }),
    dbconn_id: v.pipe(
      v.nullish(v.union([v.number(), v.string()]), ''),
      v.transform((id) => String(id)),
    ),
    profiles: v.nullish(v.array(IdSchema), []),
  }),
)

const PreviewResponseSchema = v.object({ html: v.string() })

export type CustomerCard = {
  id: string
  name: string
  query: string
  templateId: string
  templateName: string
  dbConnectionId: string
  profileIds: string[]
}

export type CustomerCardForm = {
  name: string
  dbConnectionId: string
  templateId: string
  profileIds: string[]
  query: string
}

export type CustomerCardPreviewInput = {
  dbconn_id: string
  template: string
  query: string
}

export const parseCustomerCards = (raw: unknown): CustomerCard[] =>
  v
    .parse(CustomerCardsResponseSchema, raw)
    .map((card) => ({
      id: card.id,
      name: card.name,
      query: decodeBase64Utf8(card.query),
      templateId: getCardTemplateId(card.template.name, card.template.custom),
      templateName: card.template.name,
      dbConnectionId: card.dbconn_id,
      profileIds: card.profiles,
    }))
    .sort((a, b) => compareNatural(a.name, b.name))

export const getCardsUsingConnection = (cards: CustomerCard[], connectionId: string) =>
  cards.filter((card) => card.dbConnectionId === connectionId)

export const getCardsUsingTemplate = (cards: CustomerCard[], templateId: string) =>
  cards.filter((card) => card.templateId === templateId)

export const emptyCustomerCardForm = (): CustomerCardForm => ({
  name: '',
  dbConnectionId: '',
  templateId: '',
  profileIds: [],
  query: '',
})

export const toCustomerCardForm = (card: CustomerCard): CustomerCardForm => ({
  name: card.name,
  dbConnectionId: card.dbConnectionId,
  templateId: card.templateId,
  profileIds: [...card.profileIds],
  query: card.query,
})

const CustomerCardFormSchema = v.object({
  name: requiredText('integrations.cards.card_name_required'),
  dbConnectionId: requiredText('integrations.cards.card_connection_required'),
  templateId: requiredText('integrations.cards.card_template_required'),
  profileIds: v.pipe(v.array(v.string()), v.minLength(1, 'integrations.profiles_required')),
  query: requiredText('integrations.query_required'),
})

export const getCustomerCardPermissionName = (name: string): string =>
  `cc_${name
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .replace(/ /g, '_')
    .toLowerCase()}`

export const validateCustomerCardForm = (
  form: CustomerCardForm,
  otherCards: CustomerCard[],
): FieldIssues => {
  const issues = validateForm(CustomerCardFormSchema, form)
  const permissionName = getCustomerCardPermissionName(form.name.trim())

  if (
    !issues.name &&
    otherCards.some((card) => getCustomerCardPermissionName(card.name) === permissionName)
  ) {
    issues.name = 'integrations.cards.card_name_already_used'
  }
  return issues
}

export const buildCustomerCardPayload = (form: CustomerCardForm): CustomerCardInput => ({
  name: form.name.trim(),
  query: encodeBase64Utf8(form.query.trim()),
  template: form.templateId,
  dbconn_id: Number(form.dbConnectionId),
  profiles: toProfileIdNumbers(form.profileIds),
})

export const buildCustomerCardPreviewPayload = (
  form: Pick<CustomerCardForm, 'dbConnectionId' | 'templateId' | 'query'>,
): CustomerCardPreviewInput => ({
  dbconn_id: form.dbConnectionId,
  template: form.templateId,
  query: encodeBase64Utf8(form.query.trim()),
})

export const parseCustomerCardPreview = (raw: unknown): string =>
  decodeBase64Utf8(v.parse(PreviewResponseSchema, raw).html)

export const getCustomerCards = async (): Promise<CustomerCard[]> => {
  const { data } = await api.GET('/cti/customer_card')
  return parseCustomerCards(data)
}

export const saveCustomerCard = async (payload: CustomerCardInput, id?: string): Promise<void> => {
  if (id) {
    await api.PUT('/cti/customer_card/{id}', { params: { path: { id } }, body: payload })
  } else {
    await api.POST('/cti/customer_card', { body: payload })
  }
}

export const deleteCustomerCard = async (id: string): Promise<void> => {
  await api.DELETE('/cti/customer_card/{id}', { params: { path: { id } } })
}

export const previewCustomerCard = async (payload: CustomerCardPreviewInput): Promise<string> =>
  parseCustomerCardPreview(await postCtiApi('/custcard/preview', payload))
