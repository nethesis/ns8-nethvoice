//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import * as v from 'valibot'
import { api } from '@/lib/api/client'
import type { components } from '@/lib/api/schema'
import { compareNatural } from '@/lib/common'
import { parseProfileIdList, toProfileIdNumbers } from './lookups'
import { type FieldIssues, validateForm } from './validation'

export const PARAMETERIZED_URLS_KEY = 'parameterizedUrls'

export const PARAMETERIZED_URL_MAX_LENGTH = 255

export const PARAMETERIZED_URL_PLACEHOLDERS = [
  '$CALLER_NUMBER',
  '$CALLER_NAME',
  '$CALLED',
  '$UNIQUEID',
]

type ParamUrlInput = components['schemas']['IntegrationsParamUrlInput']

type ParamUrlDeleteInput = components['schemas']['IntegrationsParamUrlDeleteInput']

const ParamUrlsResponseSchema = v.array(
  v.object({
    id: v.pipe(v.union([v.number(), v.string()]), v.transform(String)),
    url: v.string(),
    profiles: v.nullish(v.string(), ''),
    only_queues: v.nullish(v.union([v.boolean(), v.string(), v.number()]), false),
  }),
)

export type ParameterizedUrl = {
  id: string
  url: string
  profileIds: string[]
  onlyQueues: boolean
}

export type ParameterizedUrlForm = {
  url: string
  profileIds: string[]
  onlyQueues: boolean
}

export const parseParameterizedUrls = (raw: unknown): ParameterizedUrl[] =>
  v
    .parse(ParamUrlsResponseSchema, raw)
    .map((item) => ({
      id: item.id,
      url: item.url,
      profileIds: parseProfileIdList(item.profiles),
      onlyQueues: [true, 'true', '1', 1].includes(item.only_queues),
    }))
    .sort((a, b) => compareNatural(a.url, b.url))

export const emptyParameterizedUrlForm = (): ParameterizedUrlForm => ({
  url: '',
  profileIds: [],
  onlyQueues: false,
})

export const toParameterizedUrlForm = (item: ParameterizedUrl): ParameterizedUrlForm => ({
  url: item.url,
  profileIds: [...item.profileIds],
  onlyQueues: item.onlyQueues,
})

export const getBusyProfileIds = (
  urls: ParameterizedUrl[],
  editing?: ParameterizedUrl,
): string[] => [
  ...new Set(urls.filter((item) => item.id !== editing?.id).flatMap((item) => item.profileIds)),
]

const ParameterizedUrlFormSchema = v.object({
  url: v.pipe(
    v.string(),
    v.trim(),
    v.nonEmpty('integrations.url_required'),
    v.regex(/^https?:\/\/[^\s/]+\S*$/i, 'integrations.url_invalid'),
    v.maxLength(PARAMETERIZED_URL_MAX_LENGTH, 'integrations.param_urls.url_too_long'),
  ),
  profileIds: v.pipe(v.array(v.string()), v.minLength(1, 'integrations.profiles_required')),
})

export const validateParameterizedUrlForm = (
  form: ParameterizedUrlForm,
  otherUrls: ParameterizedUrl[],
): FieldIssues => {
  const issues = validateForm(ParameterizedUrlFormSchema, form)

  if (!issues.url && otherUrls.some((item) => item.url === form.url.trim())) {
    issues.url = 'integrations.param_urls.url_already_used'
  }
  return issues
}

export const buildParameterizedUrlPayload = (
  form: ParameterizedUrlForm,
  existing?: ParameterizedUrl,
): ParamUrlInput => ({
  ...(existing ? { id: existing.id } : {}),
  url: form.url.trim(),
  profiles: toProfileIdNumbers(form.profileIds),
  only_queues: form.onlyQueues,
})

export const buildParameterizedUrlDeletePayload = (
  item: ParameterizedUrl,
): ParamUrlDeleteInput => ({
  url: item.url,
  profiles: toProfileIdNumbers(item.profileIds),
})

export const getReleasedProfilesPayload = (
  form: ParameterizedUrlForm,
  existing: ParameterizedUrl,
): ParamUrlDeleteInput | null => {
  const released = existing.profileIds.filter((id) => !form.profileIds.includes(id))

  return form.url.trim() !== existing.url && released.length > 0
    ? { url: existing.url, profiles: toProfileIdNumbers(released) }
    : null
}

export const getParameterizedUrls = async (): Promise<ParameterizedUrl[]> => {
  const { data } = await api.GET('/cti/paramurls')
  return parseParameterizedUrls(data)
}

export const saveParameterizedUrl = async (
  form: ParameterizedUrlForm,
  existing?: ParameterizedUrl,
): Promise<void> => {
  const body = buildParameterizedUrlPayload(form, existing)

  if (!existing) {
    await api.POST('/cti/paramurl', { body })
    return
  }
  await api.PUT('/cti/paramurl/{id}', { params: { path: { id: existing.id } }, body })

  const released = getReleasedProfilesPayload(form, existing)

  if (released) {
    await api.POST('/cti/paramurl/delete', { body: released })
  }
}

export const deleteParameterizedUrl = async (item: ParameterizedUrl): Promise<void> => {
  await api.POST('/cti/paramurl/delete', { body: buildParameterizedUrlDeletePayload(item) })
}
