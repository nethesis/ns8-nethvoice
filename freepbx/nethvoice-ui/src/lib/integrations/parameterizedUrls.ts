//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import * as v from 'valibot'
import { api } from '@/lib/api/client'
import type { components } from '@/lib/api/schema'
import { compareNatural } from '@/lib/common'
import { hasControlCharacters } from '@/lib/users/csv'
import { type ProfileOption, parseProfileIdList, toProfileIdNumbers } from './lookups'
import { type FieldIssues, HttpUrlSchema, validateForm } from './validation'

export const PARAMETERIZED_URLS_KEY = 'parameterizedUrls'

export const PARAMETERIZED_URL_MAX_LENGTH = 255

export const PARAMETERIZED_URL_NAME_MAX_LENGTH = 50

export const PARAMETERIZED_URL_PLACEHOLDERS = [
  '$CALLER_NUMBER',
  '$CALLER_NAME',
  '$CALLED',
  '$UNIQUEID',
]

export const PARAMETERIZED_URL_EXAMPLE = 'https://crm.example.com/search?phone=$CALLER_NUMBER'

type ParamUrlInput = components['schemas']['IntegrationsParamUrlInput']

type ParamUrlDeleteInput = components['schemas']['IntegrationsParamUrlDeleteInput']

const ParamUrlsResponseSchema = v.array(
  v.object({
    id: v.pipe(v.union([v.number(), v.string()]), v.transform(String)),
    url: v.string(),
    profiles: v.nullish(v.string(), ''),
    only_queues: v.nullish(v.union([v.boolean(), v.string(), v.number()]), false),
    names: v.nullish(v.record(v.string(), v.string()), {}),
  }),
)

export type ParameterizedUrl = {
  id: string
  groupId: string
  name: string
  url: string
  profileId: string
  onlyQueues: boolean
}

export type ParameterizedUrlForm = {
  name: string
  url: string
  profileId: string
  onlyQueues: boolean
}

export type ParameterizedUrlSaveRequest =
  { method: 'POST'; body: ParamUrlInput } | { method: 'PUT'; id: string; body: ParamUrlInput }

export type ParameterizedUrlSavePlan = {
  save: ParameterizedUrlSaveRequest
  release: ParamUrlDeleteInput | null
}

export const parseParameterizedUrls = (raw: unknown): ParameterizedUrl[] => {
  const rows = new Map<string, ParameterizedUrl>()

  for (const item of v.parse(ParamUrlsResponseSchema, raw)) {
    for (const profileId of parseProfileIdList(item.profiles)) {
      if (!rows.has(profileId)) {
        rows.set(profileId, {
          id: profileId,
          groupId: item.id,
          name: item.names[profileId] ?? '',
          url: item.url,
          profileId,
          onlyQueues: [true, 'true', '1', 1].includes(item.only_queues),
        })
      }
    }
  }
  return [...rows.values()].sort(
    (a, b) =>
      compareNatural(a.name, b.name) ||
      compareNatural(a.url, b.url) ||
      compareNatural(a.profileId, b.profileId),
  )
}

export const getProfileName = (profileId: string, profiles: ProfileOption[]): string =>
  profiles.find((profile) => profile.id === profileId)?.name ?? `#${profileId}`

export const sortParameterizedUrls = (
  rows: ParameterizedUrl[],
  profiles: ProfileOption[],
): ParameterizedUrl[] =>
  [...rows].sort(
    (a, b) =>
      compareNatural(a.name, b.name) ||
      compareNatural(a.url, b.url) ||
      compareNatural(getProfileName(a.profileId, profiles), getProfileName(b.profileId, profiles)),
  )

export const emptyParameterizedUrlForm = (): ParameterizedUrlForm => ({
  name: '',
  url: '',
  profileId: '',
  onlyQueues: false,
})

export const toParameterizedUrlForm = (item: ParameterizedUrl): ParameterizedUrlForm => ({
  name: item.name,
  url: item.url,
  profileId: item.profileId,
  onlyQueues: item.onlyQueues,
})

export const toDuplicatedParameterizedUrlForm = (
  item: ParameterizedUrl,
  copyName: (name: string) => string,
): ParameterizedUrlForm => ({
  ...toParameterizedUrlForm(item),
  name: copyName(item.name),
  profileId: '',
})

export const getAvailableProfiles = (
  profiles: ProfileOption[],
  rows: ParameterizedUrl[],
  editing?: ParameterizedUrl,
): ProfileOption[] =>
  profiles.filter(
    (profile) =>
      profile.id === editing?.profileId || !rows.some((row) => row.profileId === profile.id),
  )

export const areAllProfilesBound = (profiles: ProfileOption[], rows: ParameterizedUrl[]) =>
  profiles.length > 0 && getAvailableProfiles(profiles, rows).length === 0

export const getRowsSharingUrl = (
  rows: ParameterizedUrl[],
  url: string,
  editing?: ParameterizedUrl,
): ParameterizedUrl[] =>
  rows.filter((row) => row.url === url.trim() && row.profileId !== editing?.profileId)

export const isSameParameterizedUrlName = (a: string, b: string): boolean =>
  a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase()

const ParameterizedUrlFormSchema = v.object({
  name: v.pipe(
    v.string(),
    v.trim(),
    v.nonEmpty('integrations.param_urls.name_required'),
    v.maxLength(PARAMETERIZED_URL_NAME_MAX_LENGTH, 'integrations.param_urls.name_too_long'),
    v.check((name) => !hasControlCharacters(name), 'integrations.param_urls.name_invalid'),
  ),
  url: v.pipe(
    HttpUrlSchema('integrations.url_required', 'integrations.param_urls.url_invalid'),
    v.maxLength(PARAMETERIZED_URL_MAX_LENGTH, 'integrations.param_urls.url_too_long'),
  ),
  profileId: v.pipe(v.string(), v.nonEmpty('integrations.param_urls.profile_required')),
})

export const validateParameterizedUrlForm = (
  form: ParameterizedUrlForm,
  rows: ParameterizedUrl[],
  editing?: ParameterizedUrl,
): FieldIssues => {
  const issues = validateForm(ParameterizedUrlFormSchema, form)

  if (
    !issues.profileId &&
    rows.some((row) => row.profileId === form.profileId && row.profileId !== editing?.profileId)
  ) {
    issues.profileId = 'integrations.param_urls.profile_already_used'
  }
  if (
    !issues.name &&
    rows.some(
      (row) =>
        row.profileId !== editing?.profileId && isSameParameterizedUrlName(row.name, form.name),
    )
  ) {
    return { name: 'integrations.param_urls.name_in_use', ...issues }
  }
  return issues
}

export const buildParameterizedUrlSavePlan = (
  form: ParameterizedUrlForm,
  rows: ParameterizedUrl[],
  editing?: ParameterizedUrl,
): ParameterizedUrlSavePlan => {
  const url = form.url.trim()
  const sharing = getRowsSharingUrl(rows, url, editing)
  const groupId = sharing[0]?.groupId ?? editing?.groupId
  const body: ParamUrlInput = {
    url,
    profiles: toProfileIdNumbers([...sharing.map((row) => row.profileId), form.profileId]),
    only_queues: form.onlyQueues,
    names: { [form.profileId]: form.name.trim() },
  }
  const release =
    editing && editing.url !== url && editing.profileId !== form.profileId
      ? { url: editing.url, profiles: toProfileIdNumbers([editing.profileId]) }
      : null

  return {
    save: groupId
      ? { method: 'PUT', id: groupId, body: { id: groupId, ...body } }
      : { method: 'POST', body },
    release,
  }
}

export const buildParameterizedUrlDeletePayload = (
  item: ParameterizedUrl,
): ParamUrlDeleteInput => ({
  url: item.url,
  profiles: toProfileIdNumbers([item.profileId]),
})

export const getParameterizedUrls = async (): Promise<ParameterizedUrl[]> => {
  const { data } = await api.GET('/cti/paramurls')
  return parseParameterizedUrls(data)
}

export const saveParameterizedUrl = async (
  form: ParameterizedUrlForm,
  rows: ParameterizedUrl[],
  editing?: ParameterizedUrl,
): Promise<void> => {
  const { save, release } = buildParameterizedUrlSavePlan(form, rows, editing)

  if (save.method === 'POST') {
    await api.POST('/cti/paramurl', { body: save.body })
  } else {
    await api.PUT('/cti/paramurl/{id}', { params: { path: { id: save.id } }, body: save.body })
  }

  if (release) {
    await api.POST('/cti/paramurl/delete', { body: release })
  }
}

export const deleteParameterizedUrl = async (item: ParameterizedUrl): Promise<void> => {
  await api.POST('/cti/paramurl/delete', { body: buildParameterizedUrlDeletePayload(item) })
}
