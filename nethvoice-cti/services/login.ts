// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Contains the request to the APIs consumed by the Login
 */

import router from 'next/router'
import { removeItem } from '../lib/storage'
import { store } from '../store'
import { isEmpty } from 'lodash'
import { clearLocalStorageAndCache, reloadPage, saveQueryParams } from '../lib/utils'

/**
 * This method performs the logout action
 */
export const logout = async () => {
  try {
    const { username, token } = store.getState().authentication
    const res = await fetch(
      // @ts-ignore
      window.CONFIG.API_SCHEME + window.CONFIG.API_ENDPOINT + '/api/logout',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      },
    )
    return res
  } catch (error) {
    console.error(error)
  }
}

export const doLogout = async (isLogoutError?: any) => {
  const res = await logout()
  //// TODO logout API is currently authenticated. For this reason, we must not check res.ok (this is a temporary workaround)

  // if (res && res.ok) {
  // Remove credentials from localstorage
  removeItem('credentials')
  // Reset the authentication store
  store.dispatch.authentication.reset()

  let queryParams = ''

  if (!isEmpty(isLogoutError)) {
    if (isLogoutError.isUserInformationMissing) {
      queryParams = 'error=sessionExpired'
      clearLocalStorageAndCache()
      router.push('/login?error=sessionExpired')
      if (document?.visibilityState === 'visible') {
        reloadPage()
      }
    } else {
      queryParams = 'error=webrtcError'
      clearLocalStorageAndCache()
      router.push('/login?error=webrtcError')
      if (document?.visibilityState === 'visible') {
        reloadPage()
      }
    }
   
    saveQueryParams(queryParams)
  } else {
    clearLocalStorageAndCache()
    reloadPage()
  }

  // } ////
}
