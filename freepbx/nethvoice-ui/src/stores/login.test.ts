//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { PiniaColada } from '@pinia/colada'
import { api } from '@/lib/api/client'
import { postSignIn, SignInError, type SignInResult } from '@/lib/auth'
import { useLoginStore } from './login'

vi.mock('@/lib/api/client', () => ({
  api: { GET: vi.fn(), POST: vi.fn(), use: vi.fn() },
  configureApiClient: vi.fn(),
}))

vi.mock('@/lib/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth')>()),
  postSignIn: vi.fn(),
}))

const createStore = () => {
  const pinia = createPinia()
  createApp({}).use(pinia).use(PiniaColada)
  setActivePinia(pinia)
  return useLoginStore()
}

const signIn = (overrides: Partial<SignInResult> = {}): SignInResult => ({
  user: 'admin',
  secretkey: 'a'.repeat(40),
  permissions: ['superadmin'],
  source: 'local',
  ...overrides,
})

const sessionCalls = () =>
  (vi.mocked(api.GET).mock.calls as unknown[][]).filter(([path]) => path === '/login')

describe('useLoginStore login', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.mocked(api.GET).mockReset().mockResolvedValue({ data: {}, response: new Response() })
    vi.mocked(postSignIn).mockReset()
  })

  it('should store the key returned by the sign in, as the previous interface reads it', async () => {
    vi.mocked(postSignIn).mockResolvedValue(signIn())
    const store = createStore()

    await store.login('admin', 'Password,1', false)

    expect(postSignIn).toHaveBeenCalledWith('admin', 'Password,1')
    expect(store.credentials).toEqual({ user: 'admin', hash: 'a'.repeat(40) })
    expect(JSON.parse(localStorage.getItem('secretkey') ?? 'null')).toEqual({
      user: 'admin',
      hash: 'a'.repeat(40),
    })
  })

  it('should keep the username as the account provider stores it', async () => {
    vi.mocked(postSignIn).mockResolvedValue(
      signIn({ user: 'a.miller', permissions: ['users'], source: 'domain' }),
    )
    const store = createStore()

    await store.login('A.Miller', 'Password,1', true)

    expect(store.username).toBe('a.miller')
    expect(store.rememberedUsername()).toBe('a.miller')
  })

  it('should open the FreePBX session for a superadmin', async () => {
    vi.mocked(postSignIn).mockResolvedValue(signIn())
    const store = createStore()

    await store.login('admin', 'Password,1', false)

    expect(sessionCalls()).toHaveLength(1)
  })

  it('should not open the FreePBX session for a section administrator', async () => {
    vi.mocked(postSignIn).mockResolvedValue(
      signIn({ user: 'operator', permissions: ['dashboard', 'users'], source: 'domain' }),
    )
    const store = createStore()

    await store.login('operator', 'Password,1', false)

    expect(store.isAuthenticated).toBe(true)
    expect(sessionCalls()).toHaveLength(0)
  })

  it('should store nothing when the sign in fails', async () => {
    vi.mocked(postSignIn).mockRejectedValue(new SignInError('invalid_credentials'))
    const store = createStore()

    await expect(store.login('admin', 'wrong', true)).rejects.toMatchObject({
      failure: 'invalid_credentials',
    })

    expect(store.isAuthenticated).toBe(false)
    expect(localStorage.getItem('secretkey')).toBeNull()
    expect(store.rememberedUsername()).toBe('')
    expect(sessionCalls()).toHaveLength(0)
  })
})
