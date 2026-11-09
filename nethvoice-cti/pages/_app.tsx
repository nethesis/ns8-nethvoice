// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import 'react-tooltip/dist/react-tooltip.css'
import '../styles/globals.css'
import type { AppProps } from 'next/app'
import { useState, useEffect } from 'react'
import { Provider } from 'react-redux'
import { store } from '../store'
import { Layout } from '../components/layout'
import { getCredentials, updateAuthStore, saveCredentials } from '../lib/login'
import { useRouter } from 'next/router'
import { RouteGuard } from '../config/router'
import { Service } from '../config/service'
import { checkDarkTheme } from '../lib/darkTheme'
import { getBrandedTabTitle, getConfiguredFaviconUrl, getProductSubname } from '../lib/utils'
import Head from 'next/head'
import { loadI18n } from '../lib/i18n'
import { Island } from '../components/island'
import { ChatIslandMount } from '../components/chat'

function MyApp({ Component, pageProps }: AppProps) {
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const router = useRouter()
  const [firstRenderI18n, setFirstRenderI18n] = useState(true)
  const [firstRenderAscii, setFirstRenderAscii] = useState(true)

  useEffect(() => {
    const { username, token } = getCredentials()
    const loaded = () => setIsLoading(false)

    // Load the auth data to the store
    if (username && token) {
      updateAuthStore(username, token)
      loaded()
    } else {
      // Optional auto-start of the SSO flow: ?login=sso (or ?autologin) goes
      // straight to the IdP, like the legacy ?login=shibboleth entry point.
      const cfg: any = (typeof window !== 'undefined' && (window as any).CONFIG) || {}
      const params =
        typeof window !== 'undefined'
          ? new URLSearchParams(window.location.search)
          : new URLSearchParams()
      // SSO return leg (?ssologin): mint the JWT via the forwardAuth-guarded
      // /api/sso-login and store it like a normal login.
      if (params.has('ssologin')) {
        fetch(cfg.API_SCHEME + cfg.API_ENDPOINT + '/api/sso-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{}',
        })
          .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
          .then((d) => {
            const token = d.token
            const uid = JSON.parse(atob(token.split('.')[1])).id
            saveCredentials(uid, token)
            window.location.replace('/')
          })
          .catch((status) => {
            // reaching here means the IdP authenticated the user but the mint
            // was rejected: a 401/403 is a user not enabled on this CTI, any
            // other failure is a generic SSO error
            const reason =
              status === 401 || status === 403 ? 'ssoUserNotEnabled' : 'sso'
            window.location.replace('/login?error=' + reason)
          })
        return
      }
      const autoSso =
        params.get('login') === 'sso' || params.has('autologin') || params.has('sso')
      if (autoSso && ['saml2', 'oidc'].includes(cfg.AUTHENTICATION_METHOD)) {
        window.location.href = cfg.SSO_LOGIN_URL || '/sso'
        return
      }
      // keep ?error (e.g. ssoUserNotEnabled from the SSO return leg): the login
      // page reads it from the URL to show the matching message
      const error = params.get('error')
      router.push(error ? '/login?error=' + encodeURIComponent(error) : '/login')
      router.events.on('routeChangeComplete', loaded)
    }

    return () => {
      router.events.off('routeChangeComplete', loaded)
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  //initialize i18n
  useEffect(() => {
    if (firstRenderI18n) {
      loadI18n()
      setFirstRenderI18n(false)
    }
  }, [firstRenderI18n])

  const welcomeMsg = [
    '  _   _        _    _  __      __     _               _____  _______  _____ ',
    ' | \\ | |      | |  | | \\ \\    / /    (_)             / ____||__   __||_   _|',
    ' |  \\| |  ___ | |_ | |__\\ \\  / /___   _   ___  ___  | |        | |     | |  ',
    " | . ` | / _ \\| __|| '_ \\\\ \\/ // _ \\ | | / __|/ _ \\ | |        | |     | |  ",
    ' | |\\  ||  __/| |_ | | | |\\  /| (_) || || (__|  __/ | |____    | |    _| |_ ',
    ' |_| \\_| \\___| \\__||_| |_| \\/  \\___/ |_| \\___|\\___|  \\_____|   |_|   |_____|',
    '                                                                            ',
  ].join('\n')

  useEffect(() => {
    if (firstRenderAscii) {
      console.log('%c' + welcomeMsg, 'background: #059669; color: white;')
      setFirstRenderAscii(false)
    }
  }, [firstRenderAscii])

  // check if dark theme should be enabled
  useEffect(() => {
    checkDarkTheme()
  }, [])

  useEffect(() => {
    const faviconElement = document.querySelector("link[rel*='icon']") as HTMLLinkElement | null

    if (faviconElement) {
      faviconElement.href = getConfiguredFaviconUrl()
    }
  }, [])

  const productTabTitle = getBrandedTabTitle(getProductSubname() || 'CTI')

  return (
    <>
      <div>
        <Head>
          <title>{productTabTitle}</title>
          <link rel='icon' href={getConfiguredFaviconUrl()} />
        </Head>
      </div>
      {!isLoading && (
        <Provider store={store} >
          {router.pathname !== '/login' ? (
            <>
              <Service>
                <Layout>
                  <RouteGuard>
                    <Component {...pageProps} />
                  </RouteGuard>
                </Layout>
              </Service>
              <Island />
              <ChatIslandMount />
            </>
          ) : (
            // Render the Login page
            <Component {...pageProps} />
          )}
        </Provider>
      )}
    </>
  )
}

export default MyApp
