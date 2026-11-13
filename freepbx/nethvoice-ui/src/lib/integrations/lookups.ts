//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import * as v from 'valibot'
import { getServiceExtension, withoutServiceExtension } from '@/lib/adminPhone/adminPhone'
import { api } from '@/lib/api/client'
import { compareNatural } from '@/lib/common'
import { parseGroups } from '@/lib/groups/groups'
import type { Profile } from '@/lib/profiles/profiles'

export const INTEGRATIONS_GROUPS_KEY = 'integrationsGroups'
export const INTEGRATIONS_EXTENSIONS_KEY = 'integrationsExtensions'

export const LOOKUP_STALE_TIME = 60_000

const IdSchema = v.pipe(v.union([v.number(), v.string()]), v.transform(String))

const ExtensionsResponseSchema = v.array(
  v.object({ extension: IdSchema, name: v.nullish(v.string(), '') }),
)

export type ProfileOption = { id: string; name: string }

export type ExtensionOption = { extension: string; name: string }

export const toProfileOptions = (profiles: Pick<Profile, 'id' | 'name'>[]): ProfileOption[] =>
  profiles
    .map((profile) => ({ id: String(profile.id), name: profile.name }))
    .sort((a, b) => compareNatural(a.name, b.name))

export const parseGroupNames = (raw: unknown): string[] =>
  parseGroups(raw)
    .map((group) => group.name)
    .sort(compareNatural)

export const parseExtensionOptions = (raw: unknown): ExtensionOption[] =>
  v.parse(ExtensionsResponseSchema, raw).sort((a, b) => compareNatural(a.extension, b.extension))

export const getGroupNames = async (): Promise<string[]> => {
  const { data } = await api.GET('/cti/groups')
  return parseGroupNames(data)
}

export const getExtensionOptions = async (): Promise<ExtensionOption[]> => {
  const [{ data }, serviceExtension] = await Promise.all([
    api.GET('/physicalextensions'),
    getServiceExtension(),
  ])
  return withoutServiceExtension(
    parseExtensionOptions(data),
    (option) => option.extension,
    serviceExtension,
  )
}

export const getProfileNames = (profileIds: string[], profiles: ProfileOption[]): string[] =>
  profileIds
    .map((id) => profiles.find((profile) => profile.id === id)?.name ?? `#${id}`)
    .sort(compareNatural)

export const toProfileIdNumbers = (profileIds: string[]): number[] =>
  [...new Set(profileIds.map(Number).filter((id) => Number.isInteger(id) && id > 0))].sort(
    (a, b) => a - b,
  )

export const parseProfileIdList = (raw: string): string[] =>
  raw
    .split(',')
    .map((id) => id.trim())
    .filter((id) => id !== '')
