//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import * as v from 'valibot'
import { api } from '@/lib/api/client'

export const USERS_KEY = 'users'

export const NO_EXTENSION = 'none'

export const MAX_DEVICES_PER_USER = 9

export const USER_DEVICE_TYPES = [
  'webrtc',
  'nethlink',
  'mobile',
  'physical',
  'temporaryphysical',
] as const

export type UserDeviceType = (typeof USER_DEVICE_TYPES)[number] | 'other'

export const SOFTWARE_DEVICE_TYPES = ['webrtc', 'nethlink', 'mobile'] as const

export type SoftwareDeviceType = (typeof SOFTWARE_DEVICE_TYPES)[number]

export type UserDevice = {
  id: number
  type: UserDeviceType
  extension: string
  mac: string
  vendor: string
  model: string
  line: number | null
  registered: boolean
}

export type User = {
  id: number
  username: string
  displayName: string
  mainExtension: string
  profileId: number | null
  email: string
  devices: UserDevice[]
}

export type UsersListMode = 'all' | 'configured' | 'sync'

const IdSchema = v.pipe(v.union([v.number(), v.string()]), v.transform(Number), v.integer())

const NullableNumberSchema = v.optional(
  v.pipe(
    v.nullable(v.union([v.number(), v.string()])),
    v.transform((value) => {
      if (value === null || value === '') {
        return null
      }
      const parsed = Number(value)
      return Number.isFinite(parsed) ? parsed : null
    }),
  ),
  null,
)

const TextSchema = v.optional(
  v.pipe(
    v.nullable(v.union([v.string(), v.number()])),
    v.transform((value) => String(value ?? '').trim()),
  ),
  '',
)

const DeviceSchema = v.object({
  id: IdSchema,
  type: TextSchema,
  extension: TextSchema,
  mac: TextSchema,
  vendor: TextSchema,
  model: TextSchema,
  line: NullableNumberSchema,
  registered: v.optional(v.nullable(v.boolean()), false),
})

const UserSchema = v.object({
  id: IdSchema,
  username: v.string(),
  displayname: TextSchema,
  default_extension: TextSchema,
  email: TextSchema,
  profile: NullableNumberSchema,
  devices: v.optional(v.nullable(v.array(DeviceSchema)), []),
})

const UsersResponseSchema = v.array(UserSchema)

const isKnownDeviceType = (type: string): type is (typeof USER_DEVICE_TYPES)[number] =>
  USER_DEVICE_TYPES.some((known) => known === type)

export const parseUsers = (raw: unknown): User[] =>
  v.parse(UsersResponseSchema, raw).map((user) => ({
    id: user.id,
    username: user.username,
    displayName: user.displayname || user.username,
    mainExtension: user.default_extension === NO_EXTENSION ? '' : user.default_extension,
    profileId: user.profile,
    email: user.email,
    devices: (user.devices ?? []).map((device) => ({
      id: device.id,
      type: isKnownDeviceType(device.type) ? device.type : 'other',
      extension: device.extension,
      mac: device.mac,
      vendor: device.vendor,
      model: device.model,
      line: device.line,
      registered: device.registered === true,
    })),
  }))

const LIST_MODE_PATH = { all: 'all', configured: 'false', sync: 'true' } as const

export const getUsers = async (mode: UsersListMode = 'all'): Promise<User[]> => {
  const { data } = await api.GET('/users/{all}', {
    params: { path: { all: LIST_MODE_PATH[mode] } },
  })
  return parseUsers(data)
}

export const postUsersSync = async (): Promise<void> => {
  await api.POST('/users/sync', { parseAs: 'text' })
}

export const getUsersSyncRunning = async (): Promise<boolean> => {
  const { data } = await api.GET('/users/sync')
  return v.parse(v.boolean(), data)
}

export const hasMainExtension = (user: User): boolean => user.mainExtension !== ''

export const countConfiguredUsers = (users: User[]): number => users.filter(hasMainExtension).length

export const findDevice = (user: User, type: UserDeviceType): UserDevice | undefined =>
  user.devices.find((device) => device.type === type)

export const hasDevice = (user: User, type: UserDeviceType): boolean =>
  findDevice(user, type) !== undefined

export const getSoftwareDeviceTypes = (user: User): SoftwareDeviceType[] =>
  SOFTWARE_DEVICE_TYPES.filter((type) => hasDevice(user, type))

export const getPhysicalPhones = (user: User): UserDevice[] =>
  user.devices.filter((device) => device.type === 'physical' || device.type === 'temporaryphysical')

export const findUserByUsername = (users: User[], username: string): User | undefined =>
  users.find((user) => user.username.toLowerCase() === username.trim().toLowerCase())

export const findUserByExtension = (users: User[], extension: string): User | undefined =>
  extension === '' ? undefined : users.find((user) => user.mainExtension === extension)
