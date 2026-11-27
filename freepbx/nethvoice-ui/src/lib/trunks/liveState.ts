//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import * as v from 'valibot'
import { api } from '@/lib/api/client'

export const TRUNKS_LIVE_STATE_KEY = 'trunksLiveState'

export const TRUNKS_LIVE_STATE_REFRESH_INTERVAL = 15000

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

export const fetchLiveTrunks = async (signal?: AbortSignal): Promise<unknown> => {
  const { data } = await api.GET('/dashboard/live/trunks', { signal })
  return data
}

export const getTrunksLiveState = async (signal?: AbortSignal): Promise<TrunksLiveState> =>
  parseTrunksLiveState(await fetchLiveTrunks(signal))

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

const PENDING_CHANGE_WINDOW = 2 * 60 * 1000

const changedTrunks = new Map<string, number>()

export const markTrunkChanged = (trunkName: string, now = Date.now()) => {
  changedTrunks.set(trunkName, now)
}

export const isTrunkChangePending = (trunkName: string, now = Date.now()): boolean => {
  const changedAt = changedTrunks.get(trunkName)

  return changedAt !== undefined && now - changedAt < PENDING_CHANGE_WINDOW
}

const isUntracked = (
  trunkName: string,
  liveState: TrunksLiveState | undefined,
  now: number,
): boolean =>
  liveState !== undefined && !liveState[trunkName] && !isTrunkChangePending(trunkName, now)

export const getTrunkProviderStatus = (
  trunkName: string,
  liveState: TrunksLiveState | undefined,
  now = Date.now(),
): ProviderStatus =>
  isUntracked(trunkName, liveState, now) ? 'unmonitored' : getProviderStatus(trunkName, liveState)

export const getTrunkRegistrationStatus = (
  trunkName: string,
  liveState: TrunksLiveState | undefined,
  now = Date.now(),
): RegistrationStatus =>
  isUntracked(trunkName, liveState, now)
    ? 'unmonitored'
    : getRegistrationStatus(trunkName, liveState)
