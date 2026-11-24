//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { useQueryCache } from '@pinia/colada'
import { api, configureApiClient, type Credentials } from '@/lib/api/client'
import { CREDENTIALS_STORAGE_KEY } from '@/lib/config'
import { postSignIn } from '@/lib/auth'
import { isSuperadmin } from '@/lib/permissions/permissions'

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

  const rememberedUsername = () => localStorage.getItem(REMEMBERED_USERNAME_STORAGE_KEY) ?? ''

  const storeCredentials = (newCredentials: Credentials | null) => {
    credentials.value = newCredentials

    if (newCredentials) {
      localStorage.setItem(CREDENTIALS_STORAGE_KEY, JSON.stringify(newCredentials))
      localStorage.setItem(LAST_USER_STORAGE_KEY, newCredentials.user)
    } else {
      localStorage.removeItem(CREDENTIALS_STORAGE_KEY)
    }
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

    if (rememberUsername) {
      localStorage.setItem(REMEMBERED_USERNAME_STORAGE_KEY, signIn.user)
    } else {
      localStorage.removeItem(REMEMBERED_USERNAME_STORAGE_KEY)
    }

    if (isSuperadmin(signIn.permissions)) {
      await api.GET('/login').catch(() => undefined)
    }
  }

  const logout = async () => {
    await api.GET('/logout').catch(() => undefined)
    clearSession()
  }

  const handleAuthenticationFailure = () => {
    if (credentials.value) {
      sessionExpired.value = true
      clearSession()
    }
  }

  configureApiClient({
    getCredentials: () => credentials.value,
    onAuthenticationFailure: handleAuthenticationFailure,
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
