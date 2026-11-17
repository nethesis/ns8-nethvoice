//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import * as v from 'valibot'
import type { NeNotificationV2 } from '@nethesis/vue-components'

const NOTIFICATIONS_STORAGE_PREFIX = 'nethvoiceNotifications:'

export const STORED_NOTIFICATIONS_LIMIT = 30

const StoredNotificationSchema = v.object({
  id: v.pipe(v.string(), v.minLength(1)),
  kind: v.picklist(['info', 'warning', 'error', 'success']),
  title: v.string(),
  description: v.optional(v.string(), ''),
  timestamp: v.optional(v.string()),
})

type StoredNotification = v.InferOutput<typeof StoredNotificationSchema>

export const notificationsStorageKey = (username: string) =>
  `${NOTIFICATIONS_STORAGE_PREFIX}${username}`

const toDate = (value: string | undefined): Date | undefined => {
  if (!value) {
    return undefined
  }
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date
}

export const serializeNotifications = (notifications: readonly NeNotificationV2[]): string =>
  JSON.stringify(
    notifications.slice(0, STORED_NOTIFICATIONS_LIMIT).map((notification): StoredNotification => ({
      id: notification.id,
      kind: notification.kind,
      title: notification.title,
      description: notification.description ?? '',
      timestamp: notification.timestamp?.toISOString(),
    })),
  )

export const parseStoredNotifications = (raw: string | null): NeNotificationV2[] => {
  if (!raw) {
    return []
  }
  let items: unknown

  try {
    items = JSON.parse(raw)
  } catch {
    return []
  }
  if (!Array.isArray(items)) {
    return []
  }
  return items
    .flatMap((item) => {
      const parsed = v.safeParse(StoredNotificationSchema, item)
      return parsed.success ? [parsed.output] : []
    })
    .slice(0, STORED_NOTIFICATIONS_LIMIT)
    .map((item): NeNotificationV2 => ({
      id: item.id,
      kind: item.kind,
      title: item.title,
      description: item.description,
      timestamp: toDate(item.timestamp),
      isShown: false,
      firstButtonLabel: '',
      secondButtonLabel: '',
    }))
}

export const readStoredNotifications = (username: string): NeNotificationV2[] => {
  try {
    return parseStoredNotifications(localStorage.getItem(notificationsStorageKey(username)))
  } catch {
    return []
  }
}

export const writeStoredNotifications = (
  username: string,
  notifications: readonly NeNotificationV2[],
) => {
  try {
    if (notifications.length) {
      localStorage.setItem(notificationsStorageKey(username), serializeNotifications(notifications))
    } else {
      localStorage.removeItem(notificationsStorageKey(username))
    }
  } catch {
    return
  }
}

export const forgetStoredNotifications = (username: string) =>
  writeStoredNotifications(username, [])
