//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import * as v from 'valibot'
import { ctiGet } from '@/lib/dashboard/ctiClient'

export const PHONE_REGISTRATIONS_KEY = 'phoneRegistrations'

export const PHONE_REGISTRATIONS_REFRESH_INTERVAL = 10000

const UNREGISTERED_STATUSES = ['', 'offline', 'unknown', 'unavailable']

export type PhoneRegistration = {
  registered: boolean
  ip: string
  port: string
  userAgent: string
}

export type PhoneRegistrations = Record<string, PhoneRegistration>

const TextSchema = v.pipe(
  v.nullish(v.union([v.string(), v.number()]), ''),
  v.transform((value) => String(value).trim()),
)

const ExtensionsResponseSchema = v.record(
  v.string(),
  v.object({
    status: TextSchema,
    ip: TextSchema,
    port: TextSchema,
    sipuseragent: TextSchema,
  }),
)

export const parsePhoneRegistrations = (raw: unknown): PhoneRegistrations => {
  const registrations: PhoneRegistrations = {}

  for (const [extension, state] of Object.entries(v.parse(ExtensionsResponseSchema, raw))) {
    registrations[extension] = {
      registered: !UNREGISTERED_STATUSES.includes(state.status.toLowerCase()),
      ip: state.ip,
      port: state.port,
      userAgent: state.sipuseragent,
    }
  }
  return registrations
}

export const getPhoneRegistrations = async (signal?: AbortSignal): Promise<PhoneRegistrations> =>
  parsePhoneRegistrations(await ctiGet('/astproxy/extensions', v.unknown(), signal))
