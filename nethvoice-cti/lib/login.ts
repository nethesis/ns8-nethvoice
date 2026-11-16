// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Containes methods used by the Login
 */

import { getJSONItem, setJSONItem } from './storage'
import { store } from '../store'

/**
 * It's used to check if the token
 * is already stored in the browser
 */
export function getCredentials() {
  return getJSONItem('credentials')
}

/**
 * It's used to store the token
 * in the browser
 */
export function saveCredentials(username: string, token: string) {
  let credentials: object = {
    username,
    token,
  }
  setJSONItem('credentials', credentials)
  updateAuthStore(username, token)
}

/**
 * Updates the global authentication store
 *
 * @param username The username to be stored
 * @param token The token to be stored
 */

export const updateAuthStore = (username: string, token: string) => {
  store.dispatch.authentication.update({
    username,
    token,
  })
}
