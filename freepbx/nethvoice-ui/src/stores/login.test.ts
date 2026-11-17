//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { PiniaColada } from '@pinia/colada'
import { api } from '@/lib/api/client'
import { loadPermissions } from '@/queries/permissions/me'
import { useLoginStore } from './login'

vi.mock('@/lib/api/client', () => ({
  api: { GET: vi.fn(), POST: vi.fn(), use: vi.fn() },
  configureApiClient: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({ postTestAuth: vi.fn().mockResolvedValue('shared-secret') }))

vi.mock('@/lib/sha1', () => ({ buildSecretKey: vi.fn().mockResolvedValue('secret-key') }))

vi.mock('@/queries/permissions/me', () => ({ loadPermissions: vi.fn() }))

const createStore = () => {
  const pinia = createPinia()
  createApp({}).use(pinia).use(PiniaColada)
  setActivePinia(pinia)
  return useLoginStore()
}

const sessionCalls = () =>
  (vi.mocked(api.GET).mock.calls as unknown[][]).filter(([path]) => path === '/login')

describe('useLoginStore login', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.mocked(api.GET).mockReset().mockResolvedValue({ data: {}, response: new Response() })
    vi.mocked(loadPermissions).mockReset()
  })

  it('should open the FreePBX session for a superadmin', async () => {
    vi.mocked(loadPermissions).mockResolvedValue(['superadmin'])
    const store = createStore()

    await store.login('admin', 'Password,1', false)

    expect(store.credentials).toEqual({ user: 'admin', hash: 'secret-key' })
    expect(sessionCalls()).toHaveLength(1)
  })

  it('should not open the FreePBX session for a section administrator', async () => {
    vi.mocked(loadPermissions).mockResolvedValue(['dashboard', 'users'])
    const store = createStore()

    await store.login('operator', 'Password,1', false)

    expect(store.isAuthenticated).toBe(true)
    expect(sessionCalls()).toHaveLength(0)
  })

  it('should not open the FreePBX session when the permissions cannot be loaded', async () => {
    vi.mocked(loadPermissions).mockRejectedValue(new Error('offline'))
    const store = createStore()

    await store.login('operator', 'Password,1', true)

    expect(store.isAuthenticated).toBe(true)
    expect(store.rememberedUsername()).toBe('operator')
    expect(sessionCalls()).toHaveLength(0)
  })
})
