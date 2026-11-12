//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import * as v from 'valibot'
import { api } from '@/lib/api/client'
import { getGroups, type Group } from '@/lib/groups/groups'
import { getProfiles } from '@/lib/profiles/profiles'
import {
  getPhysicalPhones,
  getSoftwareDeviceTypes,
  type SoftwareDeviceType,
  type User,
  type UserDevice,
} from '@/lib/users/users'

export const USERS_DIRECTORY_KEY = 'usersDirectory'

export type NamedItem = {
  id: number
  name: string
}

export type UsersDirectory = {
  groups: Group[]
  profiles: NamedItem[]
  voicemailExtensions: string[]
  mobiles: Record<string, string>
}

export type UserRow = User & {
  groups: NamedItem[]
  profileName: string
  voicemail: boolean
  mobile: string
  softwareDevices: SoftwareDeviceType[]
  physicalPhones: UserDevice[]
}

const VoicemailsSchema = v.union([v.array(v.unknown()), v.record(v.string(), v.unknown())])

const MobilesSchema = v.array(
  v.object({ username: v.string(), mobile: v.nullish(v.union([v.string(), v.number()])) }),
)

export const parseVoicemailExtensions = (raw: unknown): string[] => {
  const voicemails = v.parse(VoicemailsSchema, raw)
  return Array.isArray(voicemails) ? [] : Object.keys(voicemails)
}

export const parseMobiles = (raw: unknown): Record<string, string> =>
  Object.fromEntries(
    v
      .parse(MobilesSchema, raw)
      .filter((item) => item.mobile !== null && item.mobile !== undefined && item.mobile !== '')
      .map((item) => [item.username, String(item.mobile)]),
  )

export const getVoicemailExtensions = async (): Promise<string[]> => {
  const { data } = await api.GET('/voicemails')
  return parseVoicemailExtensions(data)
}

export const getMobiles = async (): Promise<Record<string, string>> => {
  const { data } = await api.GET('/mobiles')
  return parseMobiles(data)
}

export const getUsersDirectory = async (): Promise<UsersDirectory> => {
  const [groups, profiles, voicemailExtensions, mobiles] = await Promise.all([
    getGroups(),
    getProfiles().then((profiles) => profiles.map(({ id, name }) => ({ id, name }))),
    getVoicemailExtensions(),
    getMobiles(),
  ])

  return { groups, profiles, voicemailExtensions, mobiles }
}

export const EMPTY_USERS_DIRECTORY: UsersDirectory = {
  groups: [],
  profiles: [],
  voicemailExtensions: [],
  mobiles: {},
}

export const buildUserRows = (users: User[], directory: UsersDirectory): UserRow[] =>
  users.map((user) => ({
    ...user,
    groups: directory.groups
      .filter((group) => group.userIds.includes(user.id))
      .map(({ id, name }) => ({ id, name })),
    profileName: directory.profiles.find((profile) => profile.id === user.profileId)?.name ?? '',
    voicemail:
      user.mainExtension !== '' && directory.voicemailExtensions.includes(user.mainExtension),
    mobile: directory.mobiles[user.username] ?? '',
    softwareDevices: getSoftwareDeviceTypes(user),
    physicalPhones: getPhysicalPhones(user),
  }))

export const findBaseProfile = (profiles: NamedItem[]): NamedItem | undefined =>
  profiles.find((profile) => profile.name.toLowerCase() === 'base') ??
  [...profiles].sort((a, b) => a.id - b.id)[0]
