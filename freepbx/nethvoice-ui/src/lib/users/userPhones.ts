//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { isValidMac, toTancrediMac } from '@/lib/phones/mac'
import { updatePhone, type Phone } from '@/lib/phones/phones'
import { MAX_DEVICES_PER_USER, type UserDevice } from '@/lib/users/users'

export type PhoneChangesPlan = {
  unassign: Phone[]
  assign: Phone[]
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
  webPassword: string,
  encryptionByDefault: boolean,
): Promise<void> => {
  for (const phone of plan.unassign) {
    await updatePhone(
      phone,
      { model: phone.model, mainExtension: '', encrypted: phone.encrypted },
      webPassword,
    )
  }

  for (const phone of plan.assign) {
    await updatePhone(
      phone,
      {
        model: phone.model,
        mainExtension,
        encrypted: phone.user ? phone.encrypted : encryptionByDefault,
      },
      webPassword,
    )
  }
}
