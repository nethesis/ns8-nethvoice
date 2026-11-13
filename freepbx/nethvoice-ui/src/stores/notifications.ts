//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { type NeNotificationV2 } from '@nethesis/vue-components'
import { useI18n } from 'vue-i18n'
import { isValiError } from 'valibot'
import i18n from '@/i18n'
import { getApiErrorDetail, isApiError, isServiceUnavailable } from '@/lib/api/errors'
import { MissingWebPasswordError } from '@/lib/phones/phones'

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

export const describeError = (
  error: unknown,
  { serverDetail = true }: DescribeErrorOptions = {},
): string => {
  const { t } = i18n.global

  if (isApiError(error)) {
    if (isServiceUnavailable(error.status)) {
      return t('common.error_service_unavailable')
    }
    if (!serverDetail && error.status >= 500) {
      return t('common.error_server', { status: error.status })
    }
    const detail = getApiErrorDetail(error)
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
  return error instanceof Error ? error.message : ''
}

export const useNotificationsStore = defineStore('notifications', () => {
  const { t } = useI18n()
  const notifications = ref<NeNotificationV2[]>([])
  const isNotificationDrawerOpen = ref(false)

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
    setNotificationDrawerOpen,
  }
})
