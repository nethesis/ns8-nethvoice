//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import * as v from 'valibot'
import { api } from '@/lib/api/client'
import type { components } from '@/lib/api/schema'
import { postUserProfile } from '@/lib/profiles/profiles'
import {
  disableSoftwareDevice,
  enableSoftwareDevice,
  postVoicemail,
} from '@/lib/users/userSettings'
import {
  findDevice,
  getSoftwareDeviceTypes,
  hasMainExtension,
  MAX_DEVICES_PER_USER,
  SOFTWARE_DEVICE_TYPES,
  type SoftwareDeviceType,
  type User,
} from '@/lib/users/users'

export type UsersBulkRequest = components['schemas']['UsersBulkRequest']

export const BULK_SETTINGS_KEY = 'usersBulkSettings'

export const BULK_DESTINATIONS_KEY = 'usersBulkDestinations'

export const DEFAULT_DESTINATION = 'default'

export const MAX_RING_TIME = 120

export const ADVANCED_BULK_FIELDS = [
  'displayname',
  'callwaiting',
  'ringtime',
  'callgroup',
  'pickupgroup',
  'noanswerdest',
  'busydest',
  'notreachabledest',
  'outboundcid',
  'outboundcidDigits',
] as const

export type AdvancedBulkField = (typeof ADVANCED_BULK_FIELDS)[number]

export type AdvancedBulkForm = Record<AdvancedBulkField, string>

export type AdvancedBulkIssues = Partial<Record<AdvancedBulkField, string>>

export type BulkDestination = {
  id: string
  label: string
  category: string
}

export type BulkDevicesPlan = {
  user: User
  enable: SoftwareDeviceType[]
  disable: SoftwareDeviceType[]
}

export type BulkProgress = (progress: number) => void

export class BulkUserError extends Error {
  readonly username: string
  readonly cause: unknown
  readonly completed: string[]

  constructor(username: string, cause: unknown, completed: string[] = []) {
    super(cause instanceof Error ? cause.message : String(cause))
    this.name = 'BulkUserError'
    this.username = username
    this.cause = cause
    this.completed = completed
  }
}

export const EMPTY_ADVANCED_BULK_FORM: AdvancedBulkForm = {
  displayname: '',
  callwaiting: '',
  ringtime: '',
  callgroup: '',
  pickupgroup: '',
  noanswerdest: '',
  busydest: '',
  notreachabledest: '',
  outboundcid: '',
  outboundcidDigits: '',
}

export const splitByMainExtension = (
  users: User[],
): { configured: User[]; unconfigured: User[] } => ({
  configured: users.filter(hasMainExtension),
  unconfigured: users.filter((user) => !hasMainExtension(user)),
})

export const postBulkSettings = async (
  mainExtensions: string[],
  body: UsersBulkRequest,
): Promise<void> => {
  await api.POST('/bulk/{mainextensions}', {
    params: { path: { mainextensions: mainExtensions.join(',') } },
    body,
  })
}

export const postBulkProfile = (mainExtensions: string[], profileId: number): Promise<void> =>
  postBulkSettings(mainExtensions, { profile: profileId })

const runForBatches = async (
  batches: User[][],
  run: (batch: User[]) => Promise<void>,
  onProgress?: BulkProgress,
): Promise<void> => {
  const completed: string[] = []
  let done = 0

  for (const batch of batches) {
    try {
      await run(batch)
    } catch (error) {
      throw new BulkUserError(batch.map((user) => user.username).join(', '), error, [...completed])
    }
    completed.push(...batch.map((user) => user.username))
    done += 1
    onProgress?.(Math.round((done / batches.length) * 100))
  }
}

export const assignProfileToUsers = async (
  users: User[],
  profileId: number,
  onProgress?: BulkProgress,
): Promise<void> => {
  const { configured, unconfigured } = splitByMainExtension(users)
  const batches = [
    ...(configured.length > 0 ? [configured] : []),
    ...unconfigured.map((user) => [user]),
  ]

  await runForBatches(
    batches,
    async (batch) => {
      const [first] = batch

      if (first && hasMainExtension(first)) {
        await postBulkProfile(
          batch.map((user) => user.mainExtension),
          profileId,
        )
      } else if (first) {
        await postUserProfile(first.id, profileId)
      }
    },
    onProgress,
  )
}

export const setVoicemailForUsers = async (
  users: User[],
  enabled: boolean,
  onProgress?: BulkProgress,
): Promise<void> => {
  await runForBatches(
    splitByMainExtension(users).configured.map((user) => [user]),
    async ([user]) => {
      if (user) {
        await postVoicemail(user.mainExtension, enabled)
      }
    },
    onProgress,
  )
}

export const planDevicesForUsers = (
  users: User[],
  devices: SoftwareDeviceType[],
): BulkDevicesPlan[] =>
  splitByMainExtension(users)
    .configured.map((user) => {
      const current = getSoftwareDeviceTypes(user)

      return {
        user,
        enable: SOFTWARE_DEVICE_TYPES.filter(
          (device) => devices.includes(device) && !current.includes(device),
        ),
        disable: SOFTWARE_DEVICE_TYPES.filter(
          (device) => !devices.includes(device) && current.includes(device),
        ),
      }
    })
    .filter((plan) => plan.enable.length > 0 || plan.disable.length > 0)

export const exceedsDeviceLimit = (plan: BulkDevicesPlan): boolean =>
  plan.user.devices.length - plan.disable.length + plan.enable.length > MAX_DEVICES_PER_USER

export const getDisablingPlans = (plans: BulkDevicesPlan[]): BulkDevicesPlan[] =>
  plans.filter((plan) => plan.disable.length > 0)

export const setDevicesForUsers = async (
  plans: BulkDevicesPlan[],
  onProgress?: BulkProgress,
): Promise<void> => {
  const completed: string[] = []

  for (const { user, enable, disable } of plans) {
    try {
      for (const device of disable) {
        await disableSoftwareDevice(
          device,
          user.mainExtension,
          findDevice(user, device)?.extension ?? '',
        )
      }

      for (const device of enable) {
        await enableSoftwareDevice(device, user.mainExtension)
      }
    } catch (error) {
      throw new BulkUserError(user.username, error, [...completed])
    }
    completed.push(user.username)
    onProgress?.(Math.round((completed.length / plans.length) * 100))
  }
}

const NullableTextSchema = v.optional(
  v.pipe(
    v.nullable(v.union([v.string(), v.number()])),
    v.transform((value) => (value === null ? null : String(value).trim())),
  ),
  null,
)

const BulkSettingsSchema = v.object({
  displayname: NullableTextSchema,
  callwaiting: v.optional(v.nullable(v.union([v.boolean(), v.number()])), null),
  ringtime: NullableTextSchema,
  callgroup: NullableTextSchema,
  pickupgroup: NullableTextSchema,
  noanswerdest: NullableTextSchema,
  busydest: NullableTextSchema,
  notreachabledest: NullableTextSchema,
  outboundcid: NullableTextSchema,
})

const toDestinationValue = (value: string | null): string => {
  if (value === null) {
    return ''
  }
  return value === '' ? DEFAULT_DESTINATION : value
}

const toCallWaitingValue = (value: boolean | number | null): string => {
  if (value === true) {
    return 'enabled'
  }
  return value === false ? 'disabled' : ''
}

export const parseBulkSettings = (raw: unknown): AdvancedBulkForm => {
  const settings = v.parse(BulkSettingsSchema, raw)

  return {
    displayname: settings.displayname ?? '',
    callwaiting: toCallWaitingValue(settings.callwaiting),
    ringtime:
      settings.ringtime !== null && /^[0-9]+$/.test(settings.ringtime) ? settings.ringtime : '',
    callgroup: settings.callgroup ?? '',
    pickupgroup: settings.pickupgroup ?? '',
    noanswerdest: toDestinationValue(settings.noanswerdest),
    busydest: toDestinationValue(settings.busydest),
    notreachabledest: toDestinationValue(settings.notreachabledest),
    outboundcid: settings.outboundcid ?? '',
    outboundcidDigits: '',
  }
}

export const getBulkSettings = async (mainExtensions: string[]): Promise<AdvancedBulkForm> => {
  const { data } = await api.GET('/bulk/{mainextensions}', {
    params: { path: { mainextensions: mainExtensions.join(',') } },
  })
  return parseBulkSettings(data)
}

const DestinationItemSchema = v.object({
  destination: v.string(),
  description: v.optional(v.nullable(v.string()), ''),
})

const DestinationsSchema = v.record(
  v.string(),
  v.union([v.array(DestinationItemSchema), v.record(v.string(), DestinationItemSchema)]),
)

export const parseDestinations = (raw: unknown): BulkDestination[] =>
  Object.entries(v.parse(DestinationsSchema, raw)).flatMap(([category, group]) =>
    (Array.isArray(group) ? group : Object.values(group))
      .filter((item) => item.destination !== 'popover')
      .map((item) => ({
        id: item.destination,
        label: (item.description ?? '').trim() || item.destination,
        category,
      })),
  )

export const getDestinations = async (): Promise<BulkDestination[]> => {
  const { data } = await api.GET('/destinations')
  return parseDestinations(data)
}

const OUTBOUND_CID_REGEX = /^("[^"]*"\s*<[0-9]+>|<[0-9]+>|[0-9]+)$/

const isChanged = (initial: AdvancedBulkForm, form: AdvancedBulkForm, field: AdvancedBulkField) =>
  form[field].trim() !== '' && form[field].trim() !== initial[field].trim()

export const validateAdvancedBulk = (form: AdvancedBulkForm): AdvancedBulkIssues => {
  const issues: AdvancedBulkIssues = {}
  const ringtime = form.ringtime.trim()
  const outboundcid = form.outboundcid.trim()
  const digits = form.outboundcidDigits.trim()

  if (ringtime !== '' && (!/^[0-9]+$/.test(ringtime) || Number(ringtime) > MAX_RING_TIME)) {
    issues.ringtime = 'users.bulk_ringtime_invalid'
  }

  if (outboundcid !== '' && !OUTBOUND_CID_REGEX.test(outboundcid)) {
    issues.outboundcid = 'users.bulk_outboundcid_invalid'
  }

  if (digits !== '') {
    if (!/^[1-9][0-9]*$/.test(digits)) {
      issues.outboundcidDigits = 'users.bulk_outboundcid_digits_invalid'
    } else if (outboundcid === '') {
      issues.outboundcid = 'users.bulk_outboundcid_required'
    } else if (!/^[0-9]+$/.test(outboundcid)) {
      issues.outboundcid = 'users.bulk_outboundcid_number_only'
    }
  }
  return issues
}

export const buildBulkRequest = (
  initial: AdvancedBulkForm,
  form: AdvancedBulkForm,
): UsersBulkRequest => {
  const body: UsersBulkRequest = {}

  if (isChanged(initial, form, 'displayname')) {
    body.displayname = form.displayname.trim()
  }

  if (isChanged(initial, form, 'callwaiting')) {
    body.callwaiting = form.callwaiting === 'enabled'
  }

  if (isChanged(initial, form, 'ringtime')) {
    body.ringtime = String(Number(form.ringtime.trim()))
  }

  if (isChanged(initial, form, 'callgroup')) {
    body.callgroup = form.callgroup.trim()
  }

  if (isChanged(initial, form, 'pickupgroup')) {
    body.pickupgroup = form.pickupgroup.trim()
  }

  for (const field of ['noanswerdest', 'busydest', 'notreachabledest'] as const) {
    if (isChanged(initial, form, field)) {
      body[field] = form[field] === DEFAULT_DESTINATION ? '' : form[field]
    }
  }

  const digits = form.outboundcidDigits.trim()

  if (form.outboundcid.trim() !== '' && (isChanged(initial, form, 'outboundcid') || digits)) {
    body.outboundcid_fixed = form.outboundcid.trim()

    if (digits) {
      body.outboundcid_variable = Number(digits)
    }
  }
  return body
}
