//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import * as v from 'valibot'
import { ApiError } from '@/lib/api/errors'
import type { Credentials } from '@/lib/api/client'
import { CTI_API_URL } from '@/lib/config'

export const TRUNKS_LIVE_STATE_KEY = 'trunksLiveState'

export const TRUNKS_LIVE_STATE_REFRESH_INTERVAL = 15000

const LIVE_TRUNKS_PATH = `${CTI_API_URL}/astproxy/trunks`

const REJECTED_REGISTRATIONS = ['rejected', 'noauth', 'failed', 'unregistered']

const LiveTrunksResponseSchema = v.pipe(
  v.custom<Record<string, unknown>>(
    (input) => typeof input === 'object' && input !== null && !Array.isArray(input),
  ),
  v.record(
    v.string(),
    v.object({
      status: v.nullish(v.string(), 'unmonitored'),
      registration: v.nullish(v.string(), 'unmonitored'),
    }),
  ),
)

export type TrunkLiveState = {
  status: string
  registration: string
}

export type TrunksLiveState = Record<string, TrunkLiveState>

export type ProviderStatus = 'pending' | 'online' | 'unmonitored' | 'offline' | 'unknown'

export type RegistrationStatus = 'pending' | 'registered' | 'rejected' | 'unmonitored' | 'unknown'

export const parseTrunksLiveState = (raw: unknown): TrunksLiveState =>
  v.parse(LiveTrunksResponseSchema, raw)

const readBody = async (response: Response): Promise<unknown> => {
  const text = await response.text()

  if (!text) {
    return null
  }

  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

export const getTrunksLiveState = async (credentials: Credentials): Promise<TrunksLiveState> => {
  const response = await fetch(LIVE_TRUNKS_PATH, {
    headers: {
      Accept: 'application/json',
      User: credentials.user,
      Secretkey: credentials.hash,
    },
  })
  const body = await readBody(response)

  if (!response.ok) {
    throw new ApiError({
      status: response.status,
      method: 'GET',
      url: LIVE_TRUNKS_PATH,
      body,
    })
  }
  return parseTrunksLiveState(body)
}

export const getProviderStatus = (
  trunkName: string,
  liveState: TrunksLiveState | undefined,
): ProviderStatus => {
  if (!liveState) {
    return 'unknown'
  }
  const trunk = liveState[trunkName]

  if (!trunk) {
    return 'pending'
  }

  switch (trunk.status) {
    case 'online':
    case 'busy':
      return 'online'
    case 'offline':
      return 'offline'
    default:
      return 'unmonitored'
  }
}

export const getRegistrationStatus = (
  trunkName: string,
  liveState: TrunksLiveState | undefined,
): RegistrationStatus => {
  if (!liveState) {
    return 'unknown'
  }
  const trunk = liveState[trunkName]

  if (!trunk || trunk.registration === 'sent') {
    return 'pending'
  }

  if (trunk.registration === 'registered') {
    return 'registered'
  }
  return REJECTED_REGISTRATIONS.includes(trunk.registration) ? 'rejected' : 'unmonitored'
}
