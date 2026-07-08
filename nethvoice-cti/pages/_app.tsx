// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import 'react-tooltip/dist/react-tooltip.css'
import '../styles/globals.css'
import type { AppProps } from 'next/app'
import { useState, useEffect } from 'react'
import { Provider } from 'react-redux'
import { store } from '../store'
import { Layout } from '../components/layout'
import { getCredentials, updateAuthStore } from '../lib/login'
import { useRouter } from 'next/router'
import { RouteGuard } from '../config/router'
import { Service } from '../config/service'
import { checkDarkTheme } from '../lib/darkTheme'
import { getBrandedTabTitle, getConfiguredFaviconUrl, getProductSubname } from '../lib/utils'
import Head from 'next/head'
import { loadI18n } from '../lib/i18n'
import { Island } from '../components/island'

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
      router.push('/login')
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
