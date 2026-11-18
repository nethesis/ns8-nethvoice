// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Checks the token validity
 */

import { useState, useEffect, ReactNode, FC, useCallback } from 'react'
import { useRouter } from 'next/router'
import { useSelector } from 'react-redux'
import { RootState } from '../../store'

interface RouterGuardProps {
  children: ReactNode
}

export const RouteGuard: FC<RouterGuardProps> = ({ children }) => {
  const router = useRouter()
  const [authorized, setAuthorized] = useState(false)
  const auth = useSelector((state: RootState) => state.authentication)

  const authCheck = useCallback(() => {
    const isAuthenticated = Boolean(auth.username && auth.token)

    if (isAuthenticated) {
      setAuthorized(true)
    } else {
      setAuthorized(false)
      router.push('/login')
    }
  }, [auth.username, auth.token, router])

  const handleRouteChangeStart = useCallback(() => {
    setAuthorized(false)
  }, [])

  const handleRouteChangeComplete = useCallback(() => {
    authCheck()
  }, [authCheck])

  const handleRouteChangeError = useCallback(() => {
    setAuthorized(true)
  }, [])

  useEffect(() => {
    // Perform initial auth check
    authCheck()

    // Subscribe to router events
    router.events.on('routeChangeStart', handleRouteChangeStart)
    router.events.on('routeChangeComplete', handleRouteChangeComplete)
    router.events.on('routeChangeError', handleRouteChangeError)

    // Cleanup event listeners
    return () => {
      router.events.off('routeChangeStart', handleRouteChangeStart)
      router.events.off('routeChangeComplete', handleRouteChangeComplete)
      router.events.off('routeChangeError', handleRouteChangeError)
    }
  }, [router.events, authCheck, handleRouteChangeStart, handleRouteChangeComplete, handleRouteChangeError])

  return <>{authorized && children}</>
}
