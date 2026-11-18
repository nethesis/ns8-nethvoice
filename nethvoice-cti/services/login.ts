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
import { clearPhoneKeysConfigurationCache } from '../lib/devices'

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

/**
 * With an SSO method, the user logout must also end the front-door session
 * (Shibboleth SP or oauth2-proxy), otherwise "Sign in with SSO" logs the same
 * user back in without credentials. The SP also propagates the logout to the
 * IdP (SAML2 SLO) when the IdP supports it.
 */
const getSsoLogoutUrl = () => {
  // @ts-ignore
  const method = window.CONFIG?.AUTHENTICATION_METHOD
  if (method === 'saml2') {
    const target = window.location.origin + '/login'
    return '/Shibboleth.sso/Logout?return=' + encodeURIComponent(target)
  }
  if (method === 'oidc') {
    return '/oauth2/sign_out?rd=' + encodeURIComponent('/login')
  }
  return ''
}

/** The chat stops web push for this browser while the session still works; the reload below would cut it short. */
const leaveChat = () =>
  new Promise<void>((resolve) => {
    if (String((window as any).CONFIG?.CHAT_ENABLED) !== 'true') return resolve()
    const done = (): void => (window.removeEventListener('chat-island-logged-out', done), resolve())
    window.addEventListener('chat-island-logged-out', done)
    setTimeout(done, 2000)
    window.dispatchEvent(new CustomEvent('chat-island-logout'))
  })

export const doLogout = async (isLogoutError?: any) => {
  await leaveChat()
  const res = await logout()
  //// TODO logout API is currently authenticated. For this reason, we must not check res.ok (this is a temporary workaround)

  // if (res && res.ok) {
  // Remove credentials from localstorage
  removeItem('credentials')
  // Reset the authentication store
  store.dispatch.authentication.reset()
  clearPhoneKeysConfigurationCache()

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
    const ssoLogoutUrl = getSsoLogoutUrl()
    if (ssoLogoutUrl) {
      window.location.href = ssoLogoutUrl
    } else {
      reloadPage()
    }
  }

  // } ////
}
