//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { useQueryCache } from '@pinia/colada'
import { api, configureApiClient, type Credentials } from '@/lib/api/client'
import { CREDENTIALS_STORAGE_KEY } from '@/lib/config'
import { postSignIn, SignInError } from '@/lib/auth'
import { isSuperadmin, ME_KEY } from '@/lib/permissions/permissions'

const LAST_USER_STORAGE_KEY = 'lastUser'
const REMEMBERED_USERNAME_STORAGE_KEY = 'nethvoiceRememberedUsername'

const isCredentials = (value: unknown): value is Credentials => {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const candidate = value as Record<string, unknown>

  return (
    typeof candidate.user === 'string' &&
    typeof candidate.hash === 'string' &&
    candidate.user !== '' &&
    candidate.hash !== ''
  )
}

const tryStorage = (action: () => void): boolean => {
  try {
    action()
    return true
  } catch {
    return false
  }
}

export const readStoredCredentials = (): Credentials | null => {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(CREDENTIALS_STORAGE_KEY) || 'null')
    return isCredentials(value) ? { user: value.user, hash: value.hash } : null
  } catch {
    return null
  }
}

export const useLoginStore = defineStore('login', () => {
  const queryCache = useQueryCache()
  const credentials = ref<Credentials | null>(readStoredCredentials())
  const sessionExpired = ref(false)

  const isAuthenticated = computed(() => credentials.value !== null)
  const username = computed(() => credentials.value?.user ?? '')

  const rememberedUsername = () => {
    let username = ''
    tryStorage(() => {
      username = localStorage.getItem(REMEMBERED_USERNAME_STORAGE_KEY) ?? ''
    })
    return username
  }

  const storeCredentials = (newCredentials: Credentials | null) => {
    if (!newCredentials) {
      credentials.value = null
      tryStorage(() => localStorage.removeItem(CREDENTIALS_STORAGE_KEY))
      return
    }
    const stored = tryStorage(() => {
      localStorage.setItem(CREDENTIALS_STORAGE_KEY, JSON.stringify(newCredentials))
      localStorage.setItem(LAST_USER_STORAGE_KEY, newCredentials.user)
    })

    if (!stored) {
      tryStorage(() => localStorage.removeItem(CREDENTIALS_STORAGE_KEY))
      throw new SignInError('storage_unavailable')
    }
    credentials.value = newCredentials
  }

  const clearSession = () => {
    storeCredentials(null)
    queryCache.cancelQueries()
    queryCache.invalidateQueries()
  }

  const login = async (user: string, password: string, rememberUsername: boolean) => {
    const signIn = await postSignIn(user, password)

    storeCredentials({ user: signIn.user, hash: signIn.secretkey })
    sessionExpired.value = false

    tryStorage(() =>
      rememberUsername
        ? localStorage.setItem(REMEMBERED_USERNAME_STORAGE_KEY, signIn.user)
        : localStorage.removeItem(REMEMBERED_USERNAME_STORAGE_KEY),
    )

    if (isSuperadmin(signIn.permissions)) {
      await api.GET('/login').catch(() => undefined)
    }
  }

  const endServerSession = async (sessionCredentials: Credentials | null): Promise<boolean> => {
    try {
      await api.GET(
        '/logout',
        sessionCredentials
          ? { headers: { User: sessionCredentials.user, Secretkey: sessionCredentials.hash } }
          : {},
      )
      return true
    } catch {
      return false
    }
  }

  const logout = async () => {
    await endServerSession(credentials.value)
    clearSession()
  }

  const handleAuthenticationFailure = () => {
    const expired = credentials.value

    if (expired) {
      sessionExpired.value = true
      clearSession()
      void endServerSession(expired)
    }
  }

  const handlePermissionDenied = () => {
    if (credentials.value) {
      queryCache.invalidateQueries({ key: [ME_KEY] }).catch(() => undefined)
    }
  }

  configureApiClient({
    getCredentials: () => credentials.value,
    onAuthenticationFailure: handleAuthenticationFailure,
    onPermissionDenied: handlePermissionDenied,
  })

  return {
    credentials,
    isAuthenticated,
    username,
    sessionExpired,
    rememberedUsername,
    login,
    logout,
    handleAuthenticationFailure,
  }
})
