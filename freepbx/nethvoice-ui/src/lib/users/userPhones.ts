//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { formatMac, isValidMac, toTancrediMac } from '@/lib/phones/mac'
import { updatePhone, type Phone, type PhoneChanges } from '@/lib/phones/phones'
import { MAX_DEVICES_PER_USER, type UserDevice } from '@/lib/users/users'

export type PhoneChangesPlan = {
  unassign: Phone[]
  assign: Phone[]
}

export type PhoneChangeKind = 'assign' | 'release'

export class PhoneChangeError extends Error {
  readonly phone: Phone
  readonly kind: PhoneChangeKind
  readonly completed: Phone[]
  readonly cause: unknown

  constructor(phone: Phone, kind: PhoneChangeKind, completed: Phone[], cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause))
    this.name = 'PhoneChangeError'
    this.phone = phone
    this.kind = kind
    this.completed = completed
    this.cause = cause
  }
}

export const getPhoneLabel = (phone: Pick<Phone, 'mac' | 'modelLabel' | 'vendor'>): string => {
  const model = phone.modelLabel || phone.vendor
  const mac = formatMac(phone.mac)

  return model ? `${model} (${mac})` : mac
}

export const getAssignedPhoneMacs = (physicalPhones: UserDevice[]): string[] => [
  ...new Set(
    physicalPhones
      .filter((device) => isValidMac(device.mac))
      .map((device) => toTancrediMac(device.mac)),
  ),
]

export const getPhonesWithoutMac = (physicalPhones: UserDevice[]): UserDevice[] =>
  physicalPhones.filter((device) => !isValidMac(device.mac))

export const getMaxPhones = (otherDevicesCount: number): number =>
  Math.max(0, MAX_DEVICES_PER_USER - otherDevicesCount)

export const planPhoneChanges = (
  phones: Phone[],
  currentMacs: string[],
  nextMacs: string[],
  extensionChanged: boolean,
): PhoneChangesPlan => {
  const selected = [...new Set(nextMacs.filter((mac) => mac !== ''))]
  const byMac = (mac: string) => phones.find((phone) => phone.mac === mac)
  const unassign = extensionChanged
    ? []
    : currentMacs
        .filter((mac) => !selected.includes(mac))
        .map(byMac)
        .filter((phone): phone is Phone => phone !== undefined)
  const assign = selected
    .filter((mac) => extensionChanged || !currentMacs.includes(mac))
    .map(byMac)
    .filter((phone): phone is Phone => phone !== undefined)
    .map((phone) => (extensionChanged ? { ...phone, user: null, extension: '' } : phone))

  return { unassign, assign }
}

export const applyPhoneChanges = async (
  plan: PhoneChangesPlan,
  mainExtension: string,
  webPassword: string | null,
  encryptionByDefault: boolean,
): Promise<void> => {
  const completed: Phone[] = []
  const apply = async (phone: Phone, kind: PhoneChangeKind, changes: PhoneChanges) => {
    try {
      await updatePhone(phone, changes, webPassword)
    } catch (error) {
      throw new PhoneChangeError(phone, kind, [...completed], error)
    }
    completed.push(phone)
  }

  for (const phone of plan.unassign) {
    await apply(phone, 'release', {
      model: phone.model,
      mainExtension: '',
      encrypted: phone.encrypted,
    })
  }

  for (const phone of plan.assign) {
    await apply(phone, 'assign', {
      model: phone.model,
      mainExtension,
      encrypted: phone.user ? phone.encrypted : encryptionByDefault,
    })
  }
}
