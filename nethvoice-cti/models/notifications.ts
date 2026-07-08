// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { createModel } from '@rematch/core'
import type { RootModel } from '.'
import { saveNotificationsToStorage } from '../lib/notifications'

const NOTIFICATIONS_LIMIT = 20

interface DefaultState {
  notifications: any[]
  isLoaded: boolean
  unreadCount: number
}

const defaultState: DefaultState = {
  notifications: [],
  isLoaded: false,
  unreadCount: 0,
}

interface SetNotificationReadPayload {
  notificationId: string
  isRead: boolean
  currentUsername: string
}

interface AddNotificationPayload {
  notification: any
  currentUsername: string
}

const updateUnreadCount = (state: DefaultState) => {
  let unreadCount = 0

  state.notifications.forEach((notif) => {
    if (!notif.isRead) {
      unreadCount++
    }
  })
  state.unreadCount = unreadCount
}

export const notifications = createModel<RootModel>()({
  state: defaultState,
  reducers: {
    setNotifications: (state, notifications: any[]) => {
      state.notifications = notifications
      updateUnreadCount(state)
      return state
    },
    setLoaded: (state, isLoaded: boolean) => {
      state.isLoaded = isLoaded
      return state
    },
    addNotification: (state: any, payload: AddNotificationPayload) => {
      // add at first position
      state.notifications.unshift(payload.notification)

      // limit the total number of notifications
      state.notifications = state.notifications.slice(0, NOTIFICATIONS_LIMIT)

      saveNotificationsToStorage(state.notifications, payload.currentUsername)
      updateUnreadCount(state)
      return state
    },
    setNotificationRead: (state, payload: SetNotificationReadPayload) => {
      const notificationFound = state.notifications.find((notification: any) => {
        return notification.id == payload.notificationId
      })

      if (notificationFound) {
        notificationFound.isRead = payload.isRead
        saveNotificationsToStorage(state.notifications, payload.currentUsername)
        updateUnreadCount(state)
      }
      return state
    },
    markAllAsRead: (state, currentUsername) => {
      state.notifications.forEach((notif) => {
        notif.isRead = true
      })
      saveNotificationsToStorage(state.notifications, currentUsername)
      updateUnreadCount(state)
      return state
    },
  },
})
