//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { beforeEach, describe, expect, it } from 'vitest'
import { createApp } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { PiniaColada } from '@pinia/colada'
import { CREDENTIALS_STORAGE_KEY } from '@/lib/config'
import { useDashboardLayoutStore } from './dashboardLayout'

const preferencesOf = (username: string) =>
  JSON.parse(localStorage.getItem(`preferences-${username}`) || '{}')

const signIn = (user: string) =>
  localStorage.setItem(CREDENTIALS_STORAGE_KEY, JSON.stringify({ user, hash: 'secret' }))

const createStore = () => {
  const pinia = createPinia()
  createApp({}).use(pinia).use(PiniaColada)
  setActivePinia(pinia)
  return useDashboardLayoutStore()
}

describe('useDashboardLayoutStore calls range', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('should start with the last 24 hours', () => {
    signIn('admin')

    expect(createStore().callsRange).toBe('24h')
  })

  it('should save the range for the user and read it back', () => {
    signIn('admin')
    createStore().setCallsRange('7d')

    expect(preferencesOf('admin').dashboardCallsRange).toBe('7d')
    expect(createStore().callsRange).toBe('7d')
  })

  it('should ignore an unknown saved range', () => {
    localStorage.setItem('preferences-admin', JSON.stringify({ dashboardCallsRange: '1y' }))
    signIn('admin')

    expect(createStore().callsRange).toBe('24h')
  })

  it('should keep the chosen range when the storage cannot be written', () => {
    signIn('admin')
    const store = createStore()
    const setItem = Storage.prototype.setItem
    Storage.prototype.setItem = () => {
      throw new Error('quota exceeded')
    }

    try {
      store.setCallsRange('15d')
    } finally {
      Storage.prototype.setItem = setItem
    }

    expect(store.callsRange).toBe('15d')
  })
})
