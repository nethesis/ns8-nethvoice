//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { beforeEach, describe, expect, it } from 'vitest'
import { createApp } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { PiniaColada } from '@pinia/colada'
import { CREDENTIALS_STORAGE_KEY } from '@/lib/config'
import { useDensityStore } from './density'

const preferencesOf = (username: string) =>
  JSON.parse(localStorage.getItem(`preferences-${username}`) || '{}')

const signIn = (user: string) =>
  localStorage.setItem(CREDENTIALS_STORAGE_KEY, JSON.stringify({ user, hash: 'secret' }))

const createDensityStore = () => {
  const pinia = createPinia()
  createApp({}).use(pinia).use(PiniaColada)
  setActivePinia(pinia)
  return useDensityStore()
}

describe('useDensityStore', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove('compact')
  })

  it('should start with the standard density', () => {
    signIn('admin')
    const store = createDensityStore()

    expect(store.isCompact).toBe(false)
    expect(document.documentElement.classList.contains('compact')).toBe(false)
  })

  it('should load the compact density saved by the signed in user', () => {
    localStorage.setItem('preferences-admin', JSON.stringify({ density: 'compact' }))
    signIn('admin')
    const store = createDensityStore()

    expect(store.isCompact).toBe(true)
    expect(document.documentElement.classList.contains('compact')).toBe(true)
  })

  it('should toggle the density and save it for the user', () => {
    signIn('admin')
    const store = createDensityStore()

    store.toggleDensity()
    expect(store.isCompact).toBe(true)
    expect(document.documentElement.classList.contains('compact')).toBe(true)
    expect(preferencesOf('admin').density).toBe('compact')

    store.toggleDensity()
    expect(store.isCompact).toBe(false)
    expect(document.documentElement.classList.contains('compact')).toBe(false)
    expect(preferencesOf('admin').density).toBe('standard')
  })

  it('should keep the density of each user separate', () => {
    localStorage.setItem('preferences-operator', JSON.stringify({ density: 'compact' }))
    signIn('admin')
    const store = createDensityStore()

    expect(store.isCompact).toBe(false)
  })

  it('should use the density of the last user before signing in', () => {
    localStorage.setItem('preferences-admin', JSON.stringify({ density: 'compact' }))
    localStorage.setItem('lastUser', 'admin')
    const store = createDensityStore()

    store.loadDensity()

    expect(store.isCompact).toBe(true)
  })
})
