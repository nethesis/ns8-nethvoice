//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import * as v from 'valibot'
import type { AdminPhoneState } from '@/lib/adminPhone/adminPhone'
import { compareNatural, matchesText } from '@/lib/common'
import { ctiGet } from '@/lib/dashboard/ctiClient'
import type { Group } from '@/lib/groups/groups'
import type { User } from '@/lib/users/users'

export const OVERVIEW_LIVE_KEY = 'userOverviewLive'

export const OVERVIEW_REFRESH_INTERVAL = 10000

export const OVERVIEW_STATUSES = ['online', 'busy', 'ringing', 'dnd', 'forward', 'offline'] as const

export type OverviewStatus = (typeof OVERVIEW_STATUSES)[number]

export const OVERVIEW_DEVICE_TYPES = ['webrtc', 'nethlink', 'mobile', 'physical'] as const

export type OverviewDeviceType = (typeof OVERVIEW_DEVICE_TYPES)[number]

export const OVERVIEW_SORT_KEYS = ['name', 'extension', 'status'] as const

export type OverviewSortKey = (typeof OVERVIEW_SORT_KEYS)[number]

export const OVERVIEW_VIEWS = ['grid', 'list', 'compact'] as const

export type OverviewView = (typeof OVERVIEW_VIEWS)[number]

export const normalizeOverviewView = (saved: unknown): OverviewView =>
  OVERVIEW_VIEWS.find((view) => view === saved) ?? 'grid'

const TextSchema = v.optional(
  v.pipe(
    v.nullable(v.union([v.string(), v.number()])),
    v.transform((value) => String(value ?? '').trim()),
  ),
  '',
)

const ExtensionsResponseSchema = v.record(
  v.string(),
  v.object({
    status: TextSchema,
    dnd: v.nullish(v.boolean(), false),
    cf: TextSchema,
    codecs: v.nullish(v.array(v.string()), []),
  }),
)

const CtiUsersResponseSchema = v.record(
  v.string(),
  v.object({
    name: TextSchema,
    username: v.string(),
    mainPresence: TextSchema,
    endpoints: v.object({
      mainextension: v.nullish(v.array(v.object({ id: TextSchema })), []),
      extension: v.nullish(v.array(v.object({ id: TextSchema, type: TextSchema })), []),
    }),
  }),
)

export type OverviewExtension = {
  status: OverviewStatus
  doNotDisturb: boolean
  callForward: string
  codecs: string[]
}

export type OverviewEndpointUser = {
  username: string
  name: string
  presence: OverviewStatus
  mainExtension: string
  endpoints: { extension: string; type: string }[]
}

export type OverviewLiveState = {
  extensions: Record<string, OverviewExtension>
  users: OverviewEndpointUser[]
}

export type OverviewDevice = OverviewExtension & {
  extension: string
  type: OverviewDeviceType
  model: string
}

export type OverviewUser = {
  username: string
  name: string
  mainExtension: string
  presence: OverviewStatus
  groups: string[]
  devices: OverviewDevice[]
}

export type OverviewFilters = {
  text: string
  statuses: OverviewStatus[]
  groups: string[]
  favorites?: ReadonlySet<string>
}

export const FAVORITES_FILTER_ID = '@favorites'

const STATUS_BY_RAW_VALUE: Record<string, OverviewStatus> = {
  online: 'online',
  voicemail: 'forward',
  cellphone: 'forward',
  callforward: 'forward',
  busy: 'busy',
  onhold: 'busy',
  ringing: 'ringing',
  busy_ringing: 'ringing',
  dnd: 'dnd',
}

export const toOverviewStatus = (raw: string): OverviewStatus =>
  STATUS_BY_RAW_VALUE[raw.toLowerCase()] ?? 'offline'

const isOverviewDeviceType = (type: string): type is OverviewDeviceType =>
  OVERVIEW_DEVICE_TYPES.some((known) => known === type)

export const parseOverviewExtensions = (raw: unknown): Record<string, OverviewExtension> =>
  Object.fromEntries(
    Object.entries(v.parse(ExtensionsResponseSchema, raw)).map(([extension, state]) => {
      const status = toOverviewStatus(state.status)

      return [
        extension,
        {
          status: status === 'online' && state.dnd ? 'dnd' : status,
          doNotDisturb: state.dnd,
          callForward: state.cf,
          codecs: state.codecs,
        },
      ]
    }),
  )

export const parseOverviewEndpointUsers = (raw: unknown): OverviewEndpointUser[] =>
  Object.values(v.parse(CtiUsersResponseSchema, raw)).map((user) => ({
    username: user.username,
    name: user.name || user.username,
    presence: toOverviewStatus(user.mainPresence),
    mainExtension: user.endpoints.mainextension[0]?.id ?? '',
    endpoints: user.endpoints.extension.map((endpoint) => ({
      extension: endpoint.id,
      type: endpoint.type,
    })),
  }))

export const formatPhoneModel = (vendor: string, model: string): string => {
  const vendorPrefix = new RegExp(`^${vendor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[-_ ]+`, 'i')
  const name = vendor ? model.replace(vendorPrefix, '') : model

  return [vendor, name].filter((part) => part !== '').join(' ')
}

export type OverviewCallContext = {
  mainExtension: string
  devices: Pick<OverviewDevice, 'status'>[]
  phoneState: AdminPhoneState
  phoneEnabled: boolean
  inCall: boolean
  otherTabInCall: boolean
}

export type OverviewCallStatus =
  | 'no_extension'
  | 'in_call'
  | 'in_call_elsewhere'
  | 'connection_lost'
  | 'no_online_device'
  | 'phone_error'
  | 'elsewhere'
  | 'ready'
  | 'connecting'

const BLOCKING_CALL_STATUSES: OverviewCallStatus[] = [
  'no_extension',
  'in_call',
  'in_call_elsewhere',
  'connection_lost',
  'no_online_device',
]

export const hasOnlineDevice = (devices: Pick<OverviewDevice, 'status'>[]): boolean =>
  devices.some((device) => device.status === 'online')

export const isDeviceCallable = (
  device: Pick<OverviewDevice, 'status'>,
  callBlocked: boolean,
): boolean => device.status === 'online' && !callBlocked

export const getOverviewCallStatus = (context: OverviewCallContext): OverviewCallStatus => {
  if (!context.mainExtension) {
    return 'no_extension'
  }
  if (context.inCall) {
    return 'in_call'
  }
  if (context.phoneState === 'elsewhere' && context.otherTabInCall) {
    return 'in_call_elsewhere'
  }
  if (context.phoneState === 'error' && context.phoneEnabled) {
    return 'connection_lost'
  }
  if (!hasOnlineDevice(context.devices)) {
    return 'no_online_device'
  }
  switch (context.phoneState) {
    case 'error':
      return 'phone_error'
    case 'elsewhere':
      return 'elsewhere'
    case 'ready':
      return 'ready'
    default:
      return 'connecting'
  }
}

export const isOverviewCallBlocked = (status: OverviewCallStatus): boolean =>
  BLOCKING_CALL_STATUSES.includes(status)

export const buildModelLabels = (
  models: { name: string; displayName: string }[],
): ReadonlyMap<string, string> => new Map(models.map((model) => [model.name, model.displayName]))

export const getPhoneModelLabel = (
  vendor: string,
  model: string,
  modelLabels: ReadonlyMap<string, string> = new Map(),
): string => modelLabels.get(model) ?? formatPhoneModel(vendor, model)

const OFFLINE_EXTENSION: OverviewExtension = {
  status: 'offline',
  doNotDisturb: false,
  callForward: '',
  codecs: [],
}

export const buildOverviewUsers = (
  liveState: OverviewLiveState,
  users: User[],
  groups: Group[],
  modelLabels: ReadonlyMap<string, string> = new Map(),
): OverviewUser[] =>
  liveState.users
    .filter((liveUser) => liveUser.mainExtension !== '')
    .map((liveUser) => {
      const user = users.find((item) => item.username === liveUser.username)

      return {
        username: liveUser.username,
        name: liveUser.name,
        mainExtension: liveUser.mainExtension,
        presence: liveUser.presence,
        groups: groups
          .filter((group) => user !== undefined && group.userIds.includes(user.id))
          .map((group) => group.name),
        devices: liveUser.endpoints
          .flatMap((endpoint) => {
            const type = endpoint.type

            if (!isOverviewDeviceType(type)) {
              return []
            }
            const device = user?.devices.find((item) => item.extension === endpoint.extension)

            return [
              {
                ...(liveState.extensions[endpoint.extension] ?? OFFLINE_EXTENSION),
                extension: endpoint.extension,
                type,
                model: device ? getPhoneModelLabel(device.vendor, device.model, modelLabels) : '',
              },
            ]
          })
          .sort(
            (a, b) =>
              OVERVIEW_DEVICE_TYPES.indexOf(a.type) - OVERVIEW_DEVICE_TYPES.indexOf(b.type) ||
              compareNatural(a.extension, b.extension),
          ),
      }
    })

export const filterOverviewUsers = (
  users: OverviewUser[],
  filters: OverviewFilters,
): OverviewUser[] =>
  users.filter(
    (user) =>
      matchesText(
        filters.text,
        user.name,
        user.username,
        ...user.groups,
        ...user.devices.map((device) => device.extension),
      ) &&
      (filters.statuses.length === 0 || filters.statuses.includes(user.presence)) &&
      (filters.groups.length === 0 ||
        filters.groups.some((group) =>
          group === FAVORITES_FILTER_ID
            ? (filters.favorites?.has(user.username) ?? false)
            : user.groups.includes(group),
        )),
  )

export const sortOverviewUsers = (
  users: OverviewUser[],
  sortKey: OverviewSortKey,
  descending: boolean,
  favorites: ReadonlySet<string> = new Set(),
): OverviewUser[] => {
  const favoriteRank = (user: OverviewUser) => (favorites.has(user.username) ? 0 : 1)
  const compare = (a: OverviewUser, b: OverviewUser): number => {
    switch (sortKey) {
      case 'extension':
        return compareNatural(a.mainExtension, b.mainExtension)
      case 'status':
        return (
          OVERVIEW_STATUSES.indexOf(a.presence) - OVERVIEW_STATUSES.indexOf(b.presence) ||
          compareNatural(a.name, b.name)
        )
      default:
        return compareNatural(a.name, b.name)
    }
  }

  return [...users].sort(
    (a, b) => favoriteRank(a) - favoriteRank(b) || (descending ? compare(b, a) : compare(a, b)),
  )
}

export const getInitials = (name: string): string =>
  name
    .split(/\s+/)
    .filter((part) => part !== '')
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')

export const getOverviewLiveState = async (): Promise<OverviewLiveState> => {
  const [extensions, users] = await Promise.all([
    ctiGet('/astproxy/extensions', v.unknown()),
    ctiGet('/user/endpoints/all', v.unknown()),
  ])

  return {
    extensions: parseOverviewExtensions(extensions),
    users: parseOverviewEndpointUsers(users),
  }
}
