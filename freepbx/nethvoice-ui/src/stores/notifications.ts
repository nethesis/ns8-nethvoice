//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { type NeNotificationV2 } from '@nethesis/vue-components'
import { useI18n } from 'vue-i18n'
import { useEventListener } from '@vueuse/core'
import { isValiError } from 'valibot'
import i18n from '@/i18n'
import { getApiErrorDetail, isApiError, isServiceUnavailable } from '@/lib/api/errors'
import {
  forgetStoredNotifications,
  notificationsStorageKey,
  parseStoredNotifications,
  readStoredNotifications,
  writeStoredNotifications,
} from '@/lib/notifications/history'
import { MissingWebPasswordError } from '@/lib/phones/phones'
import { PhoneSettingsNotSavedError } from '@/lib/phones/persistence'
import { useLoginStore } from '@/stores/login'

const NOTIFICATIONS_LIMIT = 30
const DEFAULT_NOTIFICATION_TIMEOUT = 5000
const ERROR_NOTIFICATION_TIMEOUT = 10000

let lastNotificationId = 0

const nextNotificationId = () => {
  lastNotificationId += 1
  return `notification-${Date.now()}-${lastNotificationId}`
}

const STATUS_MESSAGES: Record<number, string> = {
  409: 'common.error_conflict',
  422: 'common.error_invalid_data',
  423: 'common.error_locked',
}

const NETWORK_ERROR_REGEX = /failed to fetch|networkerror|load failed|network request failed/i

export const isNetworkError = (error: unknown): boolean =>
  error instanceof TypeError && NETWORK_ERROR_REGEX.test(error.message)

export type DescribeErrorOptions = { serverDetail?: boolean }

export const getClientErrorDetail = (error: unknown): string =>
  isApiError(error) && error.status < 500 ? getApiErrorDetail(error) : ''

export const describeError: (error: unknown, options?: DescribeErrorOptions) => string = (
  error,
) => {
  const { t } = i18n.global

  if (isApiError(error)) {
    if (isServiceUnavailable(error.status)) {
      return t('common.error_service_unavailable')
    }
    if (error.status >= 500) {
      return t('common.error_server', { status: error.status })
    }
    const detail = getClientErrorDetail(error)
    const statusMessage = STATUS_MESSAGES[error.status]

    if (statusMessage) {
      return detail
        ? `${t(statusMessage)} ${t('common.error_server_detail', { detail })}`
        : t(statusMessage)
    }
    return detail || t('common.error_server', { status: error.status })
  }

  if (isNetworkError(error)) {
    return t('common.error_network')
  }

  if (isValiError(error)) {
    return t('common.error_invalid_response')
  }

  if (error instanceof MissingWebPasswordError) {
    return t('phones.inventory.admin_password_missing_description')
  }

  if (error instanceof PhoneSettingsNotSavedError) {
    return t('phones.changes_not_saved')
  }

  if (error instanceof Error && error.cause !== undefined && error.cause !== error) {
    return describeError(error.cause)
  }
  return error === null || error === undefined ? '' : t('common.request_failed')
}

export const useNotificationsStore = defineStore('notifications', () => {
  const { t } = useI18n()
  const loginStore = useLoginStore()
  const notifications = ref<NeNotificationV2[]>([])
  const isNotificationDrawerOpen = ref(false)

  const persist = () => {
    if (loginStore.username) {
      writeStoredNotifications(loginStore.username, notifications.value)
    }
  }

  const keepShown = (restored: NeNotificationV2[]) => {
    const shown = new Set(notifications.value.filter((item) => item.isShown).map((item) => item.id))
    return restored.map((item) => ({ ...item, isShown: shown.has(item.id) }))
  }

  watch(
    () => loginStore.username,
    (username, previous) => {
      if (!username) {
        if (previous) {
          forgetStoredNotifications(previous)
        }
        notifications.value = []
        return
      }
      const restored = readStoredNotifications(username)
      const ids = new Set(restored.map((item) => item.id))

      notifications.value = [
        ...notifications.value.filter((item) => !ids.has(item.id)),
        ...restored,
      ].slice(0, NOTIFICATIONS_LIMIT)
    },
    { immediate: true, flush: 'sync' },
  )

  useEventListener(window, 'storage', (event: StorageEvent) => {
    if (loginStore.username && event.key === notificationsStorageKey(loginStore.username)) {
      notifications.value = keepShown(parseStoredNotifications(event.newValue))
    }
  })

  const numNotifications = computed(() => notifications.value.length)

  const getNotificationTimeout = (notification: NeNotificationV2) =>
    ['error', 'warning'].includes(notification.kind)
      ? ERROR_NOTIFICATION_TIMEOUT
      : DEFAULT_NOTIFICATION_TIMEOUT

  const setNotificationShown = (notificationId: string, isShown: boolean) => {
    const notification = notifications.value.find((item) => item.id === notificationId)

    if (!notification) {
      return
    }
    notification.isShown = isShown

    if (isShown) {
      setTimeout(() => {
        setNotificationShown(notificationId, false)
      }, getNotificationTimeout(notification))
    }
  }

  const createNotification = (notificationData: Partial<NeNotificationV2>) => {
    const notification: NeNotificationV2 = {
      id: notificationData.id || nextNotificationId(),
      kind: notificationData.kind || 'info',
      title: notificationData.title || '',
      description: notificationData.description || '',
      timestamp: notificationData.timestamp || new Date(),
      firstButtonLabel: '',
      secondButtonLabel: '',
    }

    notifications.value.unshift(notification)
    notifications.value = notifications.value.slice(0, NOTIFICATIONS_LIMIT)
    setNotificationShown(notification.id, true)
    persist()
  }

  const clearNotifications = () => {
    notifications.value = []
    persist()
  }

  const createNotificationFromError = (
    error: unknown,
    title?: string,
    options?: DescribeErrorOptions,
  ) => {
    createNotification({
      kind: 'error',
      title: title || t('common.request_failed'),
      description: describeError(error, options),
    })
  }

  const hideNotification = (notificationId: string) => {
    setNotificationShown(notificationId, false)
  }

  const setNotificationDrawerOpen = (isOpen: boolean) => {
    isNotificationDrawerOpen.value = isOpen
  }

  return {
    notifications,
    numNotifications,
    isNotificationDrawerOpen,
    createNotification,
    createNotificationFromError,
    hideNotification,
    clearNotifications,
    setNotificationDrawerOpen,
  }
})
