//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import * as v from 'valibot'
import { api } from '@/lib/api/client'
import { isApiError } from '@/lib/api/errors'
import type { components } from '@/lib/api/schema'
import { compareNatural } from '@/lib/common'
import { decodeBase64Utf8, encodeBase64Utf8 } from './base64'
import { getCardTemplateId } from './cardTemplates'
import { toProfileIdNumbers } from './lookups'
import { type FieldIssues, requiredText, storableText, validateForm } from './validation'

export const CUSTOMER_CARDS_KEY = 'customerCards'

export const CUSTOMER_CARD_NAME_MAX_LENGTH = 128

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

export type CustomerCardPreviewInput = components['schemas']['IntegrationsCustomerCardPreviewInput']

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

export const toDuplicatedCustomerCardForm = (
  card: CustomerCard,
  name: string,
): CustomerCardForm => ({ ...toCustomerCardForm(card), name })

const CustomerCardFormSchema = v.object({
  name: v.pipe(
    requiredText('integrations.cards.card_name_required'),
    storableText(
      CUSTOMER_CARD_NAME_MAX_LENGTH,
      'integrations.cards.card_name_too_long',
      'integrations.cards.card_name_invalid_characters',
    ),
  ),
  dbConnectionId: requiredText('integrations.cards.card_database_required'),
  templateId: requiredText('integrations.cards.card_template_required'),
  profileIds: v.pipe(v.array(v.string()), v.minLength(1, 'integrations.profiles_required')),
  query: requiredText('integrations.query_required'),
})

const normalizeCardName = (name: string): string => name.trim().toLowerCase()

export const validateCustomerCardForm = (
  form: CustomerCardForm,
  otherCards: CustomerCard[],
): FieldIssues => {
  const issues = validateForm(CustomerCardFormSchema, form)
  const name = normalizeCardName(form.name)

  if (!issues.name && otherCards.some((card) => normalizeCardName(card.name) === name)) {
    return { name: 'integrations.cards.card_name_in_use', ...issues }
  }
  return issues
}

export const buildCustomerCardPayload = (
  form: CustomerCardForm,
  keepQuery = false,
): CustomerCardInput => ({
  name: form.name.trim(),
  query: encodeBase64Utf8(keepQuery ? form.query : form.query.trim()),
  template: form.templateId,
  dbconn_id: Number(form.dbConnectionId),
  profiles: toProfileIdNumbers(form.profileIds),
})

export const CALLER_NUMBER_PLACEHOLDER = '$NUMBER'

export const buildCustomerCardPreviewPayload = (
  form: Pick<CustomerCardForm, 'dbConnectionId' | 'templateId' | 'query'>,
  testNumber = '',
): CustomerCardPreviewInput => {
  const query = form.query.trim()
  const number = testNumber.trim()

  return {
    dbconn_id: form.dbConnectionId,
    template: form.templateId,
    query: encodeBase64Utf8(number ? query.replaceAll(CALLER_NUMBER_PLACEHOLDER, number) : query),
  }
}

export const CUSTOMER_CARD_PREVIEW_ERROR_INLINE_LENGTH = 120

export const getCustomerCardPreviewQueryError = (error: unknown): string | undefined => {
  if (!isApiError(error) || error.status !== 422) {
    return undefined
  }
  const body = error.body
  const message =
    typeof body === 'object' && body !== null && 'error' in body ? body.error : undefined

  return typeof message === 'string' ? message.trim() : undefined
}

export const isLongPreviewError = (text: string): boolean =>
  text.length > CUSTOMER_CARD_PREVIEW_ERROR_INLINE_LENGTH || text.includes('\n')

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

export const previewCustomerCard = async (payload: CustomerCardPreviewInput): Promise<string> => {
  const { data } = await api.POST('/cti/customer_card/preview', { body: payload })
  return parseCustomerCardPreview(data)
}
