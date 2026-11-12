//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import * as v from 'valibot'
import { api } from '@/lib/api/client'

export const PHONE_ENCRYPTION_KEY = 'phoneEncryption'

export type PhoneEncryption = Record<string, boolean>

const DeviceSchema = v.object({
  extension: v.nullish(v.union([v.string(), v.number()])),
  srtp: v.nullish(v.union([v.number(), v.string(), v.boolean()])),
})

const UsersResponseSchema = v.array(
  v.object({
    devices: v.nullish(v.array(DeviceSchema), []),
  }),
)

const isEnabled = (srtp: number | string | boolean | null | undefined) =>
  srtp === 1 || srtp === '1' || srtp === true

export const parsePhoneEncryption = (raw: unknown): PhoneEncryption => {
  const encryption: PhoneEncryption = {}

  for (const user of v.parse(UsersResponseSchema, raw)) {
    for (const device of user.devices) {
      if (device.extension !== null && device.extension !== undefined) {
        encryption[String(device.extension)] = isEnabled(device.srtp)
      }
    }
  }
  return encryption
}

export const getPhoneEncryption = async (): Promise<PhoneEncryption> => {
  const { data } = await api.GET('/users/{all}', { params: { path: { all: 'false' } } })
  return parsePhoneEncryption(data)
}

export const postExtensionEncryption = async (
  extension: string,
  enabled: boolean,
): Promise<void> => {
  await api.POST('/extensions/{extension}/srtp/{enabled}', {
    params: { path: { extension, enabled: enabled ? 'true' : 'false' } },
  })
}
