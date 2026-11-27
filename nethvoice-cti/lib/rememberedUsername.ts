// Copyright (C) 2026 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

export const REMEMBERED_USERNAME_KEY = 'remembered-username'

export interface UsernameStorage {
  getItem: (name: string) => string | null
  setItem: (name: string, value: string) => void
  removeItem: (name: string) => void
}

export const loadRememberedUsername = (storage: UsernameStorage): string => {
  try {
    return (storage.getItem(REMEMBERED_USERNAME_KEY) || '').trim()
  } catch {
    return ''
  }
}

export const updateRememberedUsername = (
  storage: UsernameStorage,
  username: string,
  remember: boolean,
): void => {
  const value = (username || '').trim()
  try {
    if (remember && value) {
      storage.setItem(REMEMBERED_USERNAME_KEY, value)
    } else {
      storage.removeItem(REMEMBERED_USERNAME_KEY)
    }
  } catch {
    return
  }
}
