//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import * as v from 'valibot'
import { api } from '@/lib/api/client'
import { postUserGroups } from '@/lib/groups/groups'
import { postUserProfile } from '@/lib/profiles/profiles'
import type { UserRow } from '@/lib/users/directory'
import { isValidExtension, postMainExtension } from '@/lib/users/extensions'
import {
  findDevice,
  MAX_DEVICES_PER_USER,
  SOFTWARE_DEVICE_TYPES,
  type SoftwareDeviceType,
  type User,
} from '@/lib/users/users'

export type UserSettings = {
  extension: string
  mobile: string
  voicemail: boolean
  profileId: number | null
  groupIds: number[]
  devices: SoftwareDeviceType[]
}

export type UserSettingsStep =
  | { kind: 'extension'; extension: string }
  | { kind: 'mobile'; mobile: string }
  | { kind: 'voicemail'; enabled: boolean }
  | { kind: 'profile'; profileId: number }
  | { kind: 'groups'; groupIds: number[] }
  | { kind: 'enable_device'; device: SoftwareDeviceType }
  | { kind: 'disable_device'; device: SoftwareDeviceType }

export type UserSettingsStepKind = UserSettingsStep['kind']

export class UserSettingsStepError extends Error {
  readonly step: UserSettingsStep
  readonly cause: unknown
  readonly completed: UserSettingsStep[]

  constructor(step: UserSettingsStep, cause: unknown, completed: UserSettingsStep[] = []) {
    super(cause instanceof Error ? cause.message : String(cause))
    this.name = 'UserSettingsStepError'
    this.step = step
    this.cause = cause
    this.completed = completed
  }
}

const MOBILE_NUMBER_REGEX = /^\+?[0-9 ().-]*$/

export const UserSettingsSchema = v.pipe(
  v.object({
    extension: v.pipe(
      v.string(),
      v.trim(),
      v.check((value) => value === '' || isValidExtension(value), 'users.extension_invalid'),
    ),
    mobile: v.pipe(v.string(), v.trim(), v.regex(MOBILE_NUMBER_REGEX, 'users.mobile_invalid')),
    voicemail: v.boolean(),
    profileId: v.nullable(v.number()),
    groupIds: v.array(v.number()),
    devices: v.array(v.picklist(SOFTWARE_DEVICE_TYPES)),
  }),
  v.forward(
    v.partialCheck(
      [['extension'], ['profileId']],
      (input) => input.extension === '' || input.profileId !== null,
      'users.profile_required',
    ),
    ['profileId'],
  ),
)

export const normalizeMobile = (mobile: string): string =>
  mobile
    .trim()
    .replace(/^\+/, '00')
    .replace(/[^0-9]/g, '')

export const getUserSettings = (row: UserRow): UserSettings => ({
  extension: row.mainExtension,
  mobile: row.mobile,
  voicemail: row.voicemail,
  profileId: row.profileId,
  groupIds: row.groups.map((group) => group.id),
  devices: [...row.softwareDevices],
})

const haveSameItems = (a: number[], b: number[]): boolean =>
  a.length === b.length && a.every((item) => b.includes(item))

export const planUserSettingsUpdate = (
  current: UserSettings,
  next: UserSettings,
): UserSettingsStep[] => {
  const steps: UserSettingsStep[] = []
  const extensionChanged = current.extension !== next.extension
  const hasExtension = next.extension !== ''
  const baseline: UserSettings = extensionChanged
    ? { ...current, voicemail: false, groupIds: [], devices: [] }
    : current

  if (extensionChanged) {
    steps.push({ kind: 'extension', extension: next.extension })
  }

  if (normalizeMobile(current.mobile) !== normalizeMobile(next.mobile)) {
    steps.push({ kind: 'mobile', mobile: next.mobile.trim() })
  }

  if (next.profileId !== null && next.profileId !== current.profileId) {
    steps.push({ kind: 'profile', profileId: next.profileId })
  }

  if (!haveSameItems(baseline.groupIds, next.groupIds)) {
    steps.push({ kind: 'groups', groupIds: [...next.groupIds] })
  }

  if (!hasExtension) {
    return steps
  }

  if (baseline.voicemail !== next.voicemail) {
    steps.push({ kind: 'voicemail', enabled: next.voicemail })
  }

  for (const device of SOFTWARE_DEVICE_TYPES) {
    const wasEnabled = baseline.devices.includes(device)
    const isEnabled = next.devices.includes(device)

    if (wasEnabled && !isEnabled) {
      steps.push({ kind: 'disable_device', device })
    }
  }

  for (const device of SOFTWARE_DEVICE_TYPES) {
    const wasEnabled = baseline.devices.includes(device)
    const isEnabled = next.devices.includes(device)

    if (!wasEnabled && isEnabled) {
      steps.push({ kind: 'enable_device', device })
    }
  }
  return steps
}

export const countFreeDeviceSlots = (user: User): number =>
  Math.max(0, MAX_DEVICES_PER_USER - user.devices.length)

export const postUserMobile = async (username: string, mobile: string): Promise<void> => {
  await api.POST('/mobiles', { body: { username, mobile }, parseAs: 'text' })
}

export const postVoicemail = async (extension: string, enabled: boolean): Promise<void> => {
  await api.POST('/voicemails', { body: { extension, state: enabled ? 'yes' : 'no' } })
}

export const enableSoftwareDevice = async (
  device: SoftwareDeviceType,
  mainExtension: string,
): Promise<void> => {
  switch (device) {
    case 'webrtc':
      await api.POST('/webrtc', { body: { extension: mainExtension } })
      return
    case 'nethlink':
      await api.POST('/nethlink', { body: { extension: mainExtension } })
      return
    case 'mobile':
      await api.POST('/mobileapp', { body: { mainextension: mainExtension } })
  }
}

export const disableSoftwareDevice = async (
  device: SoftwareDeviceType,
  mainExtension: string,
  deviceExtension: string,
): Promise<void> => {
  switch (device) {
    case 'webrtc':
      await api.DELETE('/webrtc/{mainextension}', {
        params: { path: { mainextension: mainExtension } },
        parseAs: 'text',
      })
      return
    case 'nethlink':
      await api.DELETE('/nethlink/{mainextension}', {
        params: { path: { mainextension: mainExtension } },
        parseAs: 'text',
      })
      return
    case 'mobile':
      await api.DELETE('/mobileapp/{extension}', {
        params: { path: { extension: deviceExtension } },
        parseAs: 'text',
      })
  }
}

const applyStep = async (user: User, extension: string, step: UserSettingsStep): Promise<void> => {
  switch (step.kind) {
    case 'extension':
      return postMainExtension(user.username, step.extension)
    case 'mobile':
      return postUserMobile(user.username, step.mobile)
    case 'voicemail':
      return postVoicemail(extension, step.enabled)
    case 'profile':
      return postUserProfile(user.id, step.profileId)
    case 'groups':
      return postUserGroups(user.id, step.groupIds)
    case 'enable_device':
      return enableSoftwareDevice(step.device, extension)
    case 'disable_device':
      return disableSoftwareDevice(
        step.device,
        extension,
        findDevice(user, step.device)?.extension ?? '',
      )
  }
}

export const applyUserSettingsSteps = async (
  user: User,
  steps: UserSettingsStep[],
): Promise<void> => {
  let extension = user.mainExtension
  const completed: UserSettingsStep[] = []

  for (const step of steps) {
    try {
      await applyStep(user, extension, step)
    } catch (error) {
      throw new UserSettingsStepError(step, error, [...completed])
    }
    completed.push(step)

    if (step.kind === 'extension') {
      extension = step.extension
    }
  }
}
