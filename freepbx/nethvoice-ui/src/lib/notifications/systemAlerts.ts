//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import * as v from 'valibot'
import { getDashboardTrunkStatus, type DashboardTrunkStatus } from '@/lib/dashboard/routing'
import type { TrunksLiveState } from '@/lib/trunks/liveState'

export const SYSTEM_ALERTS_POLL_INTERVAL = 60_000

export const LIVE_FAILURES_BEFORE_ALERT = 2

export const TRUNK_ALERT_PREFIX = 'trunk:'

export const LIVE_ALERT_KEY = 'live'

export const EXTENSIONS_LIMIT_ALERT_KEY = 'extensionsLimit'

export const ADMIN_PHONE_ALERT_KEY = 'adminPhone'

const SYSTEM_ALERTS_STORAGE_PREFIX = 'nethvoiceSystemAlerts:'

export type AlertCondition = 'problem' | 'ok' | 'unknown' | 'gone'

export type AlertCheck = { key: string; condition: AlertCondition }

export type AlertTransitions = { raised: string[]; recovered: string[]; notified: string[] }

const DOWN_TRUNK_STATUSES: DashboardTrunkStatus[] = ['offline', 'rejected', 'not_connected']

const UNKNOWN_TRUNK_STATUSES: DashboardTrunkStatus[] = ['pending', 'unknown']

export const reconcileAlerts = (
  notified: readonly string[],
  checks: readonly AlertCheck[],
): AlertTransitions => {
  const known = new Set(notified)
  const raised: string[] = []
  const recovered: string[] = []
  const forgotten = new Set<string>()

  for (const { key, condition } of checks) {
    if (condition === 'problem' && !known.has(key) && !raised.includes(key)) {
      raised.push(key)
    } else if (condition === 'ok' && known.has(key)) {
      recovered.push(key)
      forgotten.add(key)
    } else if (condition === 'gone' && known.has(key)) {
      forgotten.add(key)
    }
  }
  return {
    raised,
    recovered,
    notified: [...notified.filter((key) => !forgotten.has(key)), ...raised],
  }
}

export const trunkAlertKey = (trunkName: string) => `${TRUNK_ALERT_PREFIX}${trunkName}`

export const trunkNameOf = (key: string) => key.slice(TRUNK_ALERT_PREFIX.length)

export const getTrunkCondition = (
  trunkName: string,
  liveTrunks: TrunksLiveState,
): AlertCondition => {
  const status = getDashboardTrunkStatus(trunkName, liveTrunks)

  if (DOWN_TRUNK_STATUSES.includes(status)) {
    return 'problem'
  }
  return UNKNOWN_TRUNK_STATUSES.includes(status) ? 'unknown' : 'ok'
}

export const checkTrunks = (
  notified: readonly string[],
  liveTrunks: TrunksLiveState,
): AlertCheck[] => [
  ...Object.keys(liveTrunks).map((trunkName) => ({
    key: trunkAlertKey(trunkName),
    condition: getTrunkCondition(trunkName, liveTrunks),
  })),
  ...notified
    .filter((key) => key.startsWith(TRUNK_ALERT_PREFIX) && !(trunkNameOf(key) in liveTrunks))
    .map((key): AlertCheck => ({ key, condition: 'gone' })),
]

export const checkLiveService = (consecutiveFailures: number): AlertCheck => ({
  key: LIVE_ALERT_KEY,
  condition:
    consecutiveFailures >= LIVE_FAILURES_BEFORE_ALERT
      ? 'problem'
      : consecutiveFailures === 0
        ? 'ok'
        : 'unknown',
})

export const checkExtensionsLimit = (limitReached: boolean): AlertCheck => ({
  key: EXTENSIONS_LIMIT_ALERT_KEY,
  condition: limitReached ? 'problem' : 'gone',
})

export const checkAdminPhone = (state: string, isEnabled: boolean): AlertCheck => ({
  key: ADMIN_PHONE_ALERT_KEY,
  condition: state === 'error' && isEnabled ? 'problem' : state === 'ready' ? 'ok' : 'unknown',
})

const systemAlertsStorageKey = (username: string) => `${SYSTEM_ALERTS_STORAGE_PREFIX}${username}`

const StoredAlertsSchema = v.array(v.string())

export const readNotifiedAlerts = (username: string): string[] => {
  try {
    const stored = v.safeParse(
      StoredAlertsSchema,
      JSON.parse(localStorage.getItem(systemAlertsStorageKey(username)) ?? '[]'),
    )
    return stored.success ? stored.output : []
  } catch {
    return []
  }
}

export const writeNotifiedAlerts = (username: string, keys: readonly string[]) => {
  try {
    if (keys.length) {
      localStorage.setItem(systemAlertsStorageKey(username), JSON.stringify(keys))
    } else {
      localStorage.removeItem(systemAlertsStorageKey(username))
    }
  } catch {
    return
  }
}

export const forgetNotifiedAlerts = (username: string) => writeNotifiedAlerts(username, [])
