//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { PiniaColada, useQueryCache } from '@pinia/colada'
import { api, configureApiClient } from '@/lib/api/client'
import { postSignIn, SignInError, type SignInResult } from '@/lib/auth'
import { ME_KEY } from '@/lib/permissions/permissions'
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

const logoutCalls = () =>
  (vi.mocked(api.GET).mock.calls as unknown[][]).filter(([path]) => path === '/logout')

const clientHooks = () => vi.mocked(configureApiClient).mock.calls.at(-1)?.[0]

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

describe('useLoginStore storage', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.mocked(api.GET).mockReset().mockResolvedValue({ data: {}, response: new Response() })
    vi.mocked(postSignIn).mockReset().mockResolvedValue(signIn())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should refuse the sign in with a clear failure when the browser blocks the storage', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError')
    })
    const store = createStore()

    await expect(store.login('admin', 'Password,1', true)).rejects.toMatchObject({
      failure: 'storage_unavailable',
    })

    expect(store.isAuthenticated).toBe(false)
    expect(store.credentials).toBeNull()
    expect(localStorage.getItem('secretkey')).toBeNull()
    expect(sessionCalls()).toHaveLength(0)
  })

  it('should not store half of the credentials when the storage fills up', async () => {
    const setItem = Storage.prototype.setItem
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
      this: Storage,
      key: string,
      value: string,
    ) {
      if (key === 'lastUser') {
        throw new DOMException('full', 'QuotaExceededError')
      }
      setItem.call(this, key, value)
    })
    const store = createStore()

    await expect(store.login('admin', 'Password,1', false)).rejects.toBeInstanceOf(SignInError)

    expect(store.isAuthenticated).toBe(false)
    expect(localStorage.getItem('secretkey')).toBeNull()
  })

  it('should show the sign in page when the remembered username cannot be read', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError')
    })
    const store = createStore()

    expect(store.rememberedUsername()).toBe('')
    expect(store.isAuthenticated).toBe(false)
  })
})

describe('useLoginStore session', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.mocked(api.GET).mockReset().mockResolvedValue({ data: {}, response: new Response() })
    vi.mocked(postSignIn).mockReset().mockResolvedValue(signIn())
  })

  it('should end the FreePBX session with the expired credentials when the session expires', async () => {
    const store = createStore()
    await store.login('admin', 'Password,1', false)
    vi.mocked(api.GET).mockClear().mockRejectedValue(new Error('forbidden'))

    store.handleAuthenticationFailure()
    await Promise.resolve()

    expect(store.isAuthenticated).toBe(false)
    expect(store.sessionExpired).toBe(true)
    expect(localStorage.getItem('secretkey')).toBeNull()
    expect(logoutCalls()).toEqual([
      ['/logout', { headers: { User: 'admin', Secretkey: 'a'.repeat(40) } }],
    ])
  })

  it('should end the FreePBX session once, even when more calls fail together', async () => {
    const store = createStore()
    await store.login('admin', 'Password,1', false)
    vi.mocked(api.GET).mockClear()

    store.handleAuthenticationFailure()
    store.handleAuthenticationFailure()

    expect(logoutCalls()).toHaveLength(1)
  })

  it('should ask the permissions again when a section call is refused', async () => {
    const store = createStore()
    await store.login('admin', 'Password,1', false)
    const invalidate = vi.spyOn(useQueryCache(), 'invalidateQueries').mockResolvedValue([])

    clientHooks()?.onPermissionDenied?.()

    expect(invalidate).toHaveBeenCalledWith({ key: [ME_KEY] })
  })

  it('should not ask the permissions after the sign out', () => {
    createStore()
    const invalidate = vi.spyOn(useQueryCache(), 'invalidateQueries').mockResolvedValue([])

    clientHooks()?.onPermissionDenied?.()

    expect(invalidate).not.toHaveBeenCalled()
  })
})
