//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { beforeEach, describe, expect, it } from 'vitest'
import { createApp } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { PiniaColada } from '@pinia/colada'
import { CREDENTIALS_STORAGE_KEY } from '@/lib/config'
import { useDashboardLayoutStore } from './dashboardLayout'

const signIn = (user: string) =>
  localStorage.setItem(CREDENTIALS_STORAGE_KEY, JSON.stringify({ user, hash: 'secret' }))

const createStore = () => {
  const pinia = createPinia()
  createApp({}).use(pinia).use(PiniaColada)
  setActivePinia(pinia)
  return useDashboardLayoutStore()
}

describe('useDashboardLayoutStore', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('should ignore the period of the calls per hour saved by an older version', () => {
    localStorage.setItem(
      'preferences-admin',
      JSON.stringify({ dashboardCallsRange: '7d', dashboardCardOrder: ['hourlyCalls'] }),
    )
    signIn('admin')

    const store = createStore()

    expect(store.cardOrder[0]).toBe('hourlyCalls')
    expect(store).not.toHaveProperty('callsRange')
  })
})
