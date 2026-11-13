// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import axios from 'axios'
import { getJSONItem, setJSONItem } from './storage'
import { handleNetworkError } from './utils'

/**
 * Used to load user notifications from the local storage entry "notifications-username"
 *
 * @param currentUsername username currently logged in
 */
export const loadNotificationsFromStorage = (currentUsername: string) => {
  return getJSONItem(`notifications-${currentUsername}`) || []
}

/**
 * Used to add an notification item inside a local storage entry "notifications-username"
 *
 * @param notification a JSON object
 * @param currentUsername username currently logged in
 */
export const saveNotificationsToStorage = (notifications: any[], currentUsername: string) => {
  setJSONItem(`notifications-${currentUsername}`, notifications)
}

export async function setNotificationSettings(settings: Record<string, any>) {
  try {
    const { data } = await axios.post('/user/settings', settings)
    return data
  } catch (error) {
    handleNetworkError(error)
    throw error
  }
}
