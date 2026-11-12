//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import * as v from 'valibot'
import type { TrunksLiveState } from '@/lib/trunks/liveState'
import { ctiGet } from './ctiClient'

export const DASHBOARD_LIVE_KEY = 'dashboardLive'

export const DASHBOARD_LIVE_REFRESH_INTERVAL = 5000

const DirectionSchema = v.picklist(['in', 'out'])

const ExtensionConversationSchema = v.object({
  id: v.string(),
  linkedId: v.nullish(v.string()),
  duration: v.nullish(v.number()),
  direction: DirectionSchema,
  throughQueue: v.nullish(v.boolean()),
  throughTrunk: v.nullish(v.boolean()),
  counterpartNum: v.nullish(v.string()),
  counterpartName: v.nullish(v.string()),
})

const ExtensionsResponseSchema = v.record(
  v.string(),
  v.object({
    exten: v.string(),
    name: v.string(),
    status: v.string(),
    conversations: v.record(v.string(), ExtensionConversationSchema),
  }),
)

const TrunkConversationSchema = v.object({
  id: v.string(),
  duration: v.nullish(v.number()),
  direction: DirectionSchema,
  internalNum: v.nullish(v.string()),
  internalName: v.nullish(v.string()),
  externalNum: v.nullish(v.string()),
  externalName: v.nullish(v.string()),
  throughQueue: v.nullish(v.boolean()),
})

const TrunksResponseSchema = v.record(
  v.string(),
  v.object({
    name: v.string(),
    status: v.nullish(v.string(), 'unmonitored'),
    registration: v.nullish(v.string(), 'unmonitored'),
    conversations: v.record(v.string(), TrunkConversationSchema),
  }),
)

const MainPresenceSchema = v.picklist([
  'online',
  'dnd',
  'voicemail',
  'cellphone',
  'callforward',
  'busy',
  'ringing',
  'offline',
])

const UsersResponseSchema = v.record(
  v.string(),
  v.object({
    mainPresence: MainPresenceSchema,
    endpoints: v.object({
      extension: v.array(v.object({ id: v.string(), type: v.string() })),
    }),
  }),
)

export type CtiExtensions = v.InferOutput<typeof ExtensionsResponseSchema>
export type CtiTrunks = v.InferOutput<typeof TrunksResponseSchema>
export type CtiUsers = v.InferOutput<typeof UsersResponseSchema>
type MainPresence = v.InferOutput<typeof MainPresenceSchema>

export const PRESENCE_STATUSES = ['online', 'busy', 'dnd', 'offline'] as const
export type PresenceStatus = (typeof PRESENCE_STATUSES)[number]
export type PresenceSummary = Record<PresenceStatus, number>

export const DEVICE_TYPES = ['webPhone', 'desktopPhone', 'mobileApp'] as const
export type DeviceType = (typeof DEVICE_TYPES)[number]
export type DevicesSummary = Record<DeviceType, number>

export type CallType = 'incoming' | 'outgoing' | 'internal'

export type CallInProgress = {
  id: string
  type: CallType
  source: string
  destination: string
  duration: number
  throughQueue: boolean
}

export type DashboardLive = {
  presence: PresenceSummary
  devices: DevicesSummary
  calls: CallInProgress[]
  trunks: TrunksLiveState
  fetchedAt: number
}

const PRESENCE_BY_MAIN_PRESENCE: Record<MainPresence, PresenceStatus> = {
  online: 'online',
  voicemail: 'online',
  cellphone: 'online',
  callforward: 'online',
  busy: 'busy',
  ringing: 'busy',
  dnd: 'dnd',
  offline: 'offline',
}

const DEVICE_TYPE_BY_ENDPOINT_TYPE: Record<string, DeviceType> = {
  webrtc: 'webPhone',
  nethlink: 'desktopPhone',
  mobile: 'mobileApp',
}

const OFFLINE_EXTENSION_STATUS = 'offline'

export const parseCtiExtensions = (raw: unknown): CtiExtensions =>
  v.parse(ExtensionsResponseSchema, raw)

export const parseCtiTrunks = (raw: unknown): CtiTrunks => v.parse(TrunksResponseSchema, raw)

export const parseCtiUsers = (raw: unknown): CtiUsers => v.parse(UsersResponseSchema, raw)

export const summarizePresence = (users: CtiUsers): PresenceSummary => {
  const summary: PresenceSummary = { online: 0, busy: 0, dnd: 0, offline: 0 }

  for (const user of Object.values(users)) {
    summary[PRESENCE_BY_MAIN_PRESENCE[user.mainPresence]] += 1
  }
  return summary
}

export const summarizeDevices = (users: CtiUsers, extensions: CtiExtensions): DevicesSummary => {
  const summary: DevicesSummary = { webPhone: 0, desktopPhone: 0, mobileApp: 0 }

  for (const user of Object.values(users)) {
    for (const endpoint of user.endpoints.extension) {
      const deviceType = DEVICE_TYPE_BY_ENDPOINT_TYPE[endpoint.type]
      const status = extensions[endpoint.id]?.status

      if (deviceType && status && status !== OFFLINE_EXTENSION_STATUS) {
        summary[deviceType] += 1
      }
    }
  }
  return summary
}

export const summarizeTrunks = (trunks: CtiTrunks): TrunksLiveState =>
  Object.fromEntries(
    Object.entries(trunks).map(([trunkId, trunk]) => [
      trunkId,
      { status: trunk.status, registration: trunk.registration },
    ]),
  )

const firstFilled = (...values: (string | null | undefined)[]): string =>
  values.find((value) => value?.trim())?.trim() ?? ''

const listExternalCalls = (trunks: CtiTrunks): CallInProgress[] =>
  Object.entries(trunks).flatMap(([trunkId, trunk]) =>
    Object.values(trunk.conversations).map((conversation): CallInProgress => {
      const external = firstFilled(conversation.externalName, conversation.externalNum)
      const internal = firstFilled(conversation.internalName, conversation.internalNum)
      const incoming = conversation.direction === 'in'

      return {
        id: `trunk:${trunkId}:${conversation.id}`,
        type: incoming ? 'incoming' : 'outgoing',
        source: incoming ? external : internal,
        destination: incoming ? internal : external,
        duration: conversation.duration ?? 0,
        throughQueue: conversation.throughQueue === true,
      }
    }),
  )

const listInternalCalls = (extensions: CtiExtensions): CallInProgress[] => {
  const calls = new Map<string, { call: CallInProgress; fromCaller: boolean }>()

  for (const extension of Object.values(extensions)) {
    for (const conversation of Object.values(extension.conversations)) {
      const counterpart = conversation.counterpartNum ?? ''

      if (
        conversation.throughTrunk === true ||
        conversation.throughQueue === true ||
        !extensions[counterpart]
      ) {
        continue
      }

      const callId = conversation.linkedId || conversation.id
      const fromCaller = conversation.direction === 'out'
      const known = calls.get(callId)

      if (known && (known.fromCaller || !fromCaller)) {
        continue
      }

      const owner = firstFilled(extension.name, extension.exten)
      const other = firstFilled(
        conversation.counterpartName,
        extensions[counterpart].name,
        counterpart,
      )

      calls.set(callId, {
        fromCaller,
        call: {
          id: `internal:${callId}`,
          type: 'internal',
          source: fromCaller ? owner : other,
          destination: fromCaller ? other : owner,
          duration: conversation.duration ?? 0,
          throughQueue: false,
        },
      })
    }
  }
  return [...calls.values()].map(({ call }) => call)
}

export const listCallsInProgress = (
  extensions: CtiExtensions,
  trunks: CtiTrunks,
): CallInProgress[] =>
  [...listExternalCalls(trunks), ...listInternalCalls(extensions)].sort(
    (a, b) => b.duration - a.duration,
  )

export const formatCallDuration = (seconds: number): string => {
  const total = Math.max(0, Math.floor(seconds))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const pad = (value: number) => String(value).padStart(2, '0')

  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(total % 60)}`
    : `${pad(minutes)}:${pad(total % 60)}`
}

export const getElapsedCallDuration = (
  call: CallInProgress,
  fetchedAt: number,
  now: number,
): number => call.duration + Math.max(0, Math.floor((now - fetchedAt) / 1000))

export const getDashboardLive = async (): Promise<DashboardLive> => {
  const [extensions, trunks, users] = await Promise.all([
    ctiGet('/astproxy/extensions', ExtensionsResponseSchema),
    ctiGet('/astproxy/trunks', TrunksResponseSchema),
    ctiGet('/user/endpoints/all', UsersResponseSchema),
  ])

  return {
    presence: summarizePresence(users),
    devices: summarizeDevices(users, extensions),
    calls: listCallsInProgress(extensions, trunks),
    trunks: summarizeTrunks(trunks),
    fetchedAt: Date.now(),
  }
}
