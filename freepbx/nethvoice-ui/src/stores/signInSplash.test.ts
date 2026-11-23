//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { SIGN_IN_SPLASH_MS } from '@/lib/signInSplash'
import { parseRuntimeConfig, useRuntimeConfigStore } from './runtimeConfig'
import { useSignInSplashStore } from './signInSplash'

const createStores = (rawConfig: unknown = {}, failed = false) => {
  const pinia = createPinia()
  createApp({}).use(pinia)
  setActivePinia(pinia)
  const runtimeConfigStore = useRuntimeConfigStore()
  runtimeConfigStore.config = parseRuntimeConfig(rawConfig)
  runtimeConfigStore.loaded = true
  runtimeConfigStore.failed = failed
  return useSignInSplashStore()
}

const deferred = () => {
  let resolve: (value: string) => void = () => {}
  const promise = new Promise<string>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

describe('useSignInSplashStore', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('should start hidden, as on a reload of a signed in session', () => {
    expect(createStores().visible).toBe(false)
  })

  it('should hold the splash for the minimum time when the navigation is faster', async () => {
    const store = createStores()
    let done = false

    const navigation = store
      .navigateAfterSignIn(async () => 'dashboard')
      .then((result) => {
        done = true
        return result
      })
    expect(store.visible).toBe(true)

    await vi.advanceTimersByTimeAsync(SIGN_IN_SPLASH_MS - 1)
    expect(done).toBe(false)
    expect(store.visible).toBe(true)

    await vi.advanceTimersByTimeAsync(1)
    expect(await navigation).toBe('dashboard')
    expect(store.visible).toBe(false)
  })

  it('should keep the splash until a slower navigation ends', async () => {
    const store = createStores()
    const pending = deferred()

    const navigation = store.navigateAfterSignIn(() => pending.promise)
    await vi.advanceTimersByTimeAsync(SIGN_IN_SPLASH_MS * 2)
    expect(store.visible).toBe(true)

    pending.resolve('setup')
    expect(await navigation).toBe('setup')
    expect(store.visible).toBe(false)
  })

  it('should hide the splash when the navigation fails', async () => {
    const store = createStores()

    const navigation = store.navigateAfterSignIn(() => Promise.reject(new Error('failed')))

    await expect(navigation).rejects.toThrow('failed')
    expect(store.visible).toBe(false)
  })

  it('should navigate at once without the splash on a rebranded instance', async () => {
    const store = createStores({ BRAND_NAME: 'Acme Voice' })
    const navigate = vi.fn(async () => 'dashboard')

    const navigation = store.navigateAfterSignIn(navigate)
    expect(store.visible).toBe(false)
    expect(await navigation).toBe('dashboard')
    expect(vi.getTimerCount()).toBe(0)
  })

  it('should navigate at once without the splash when the runtime configuration failed to load', async () => {
    const store = createStores({}, true)

    const navigation = store.navigateAfterSignIn(async () => 'dashboard')
    expect(store.visible).toBe(false)
    expect(await navigation).toBe('dashboard')
    expect(vi.getTimerCount()).toBe(0)
  })

  it('should navigate at once without the splash when the user prefers reduced motion', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      })),
    )
    const store = createStores()

    const navigation = store.navigateAfterSignIn(async () => 'dashboard')
    expect(store.visible).toBe(false)
    expect(await navigation).toBe('dashboard')
    expect(vi.getTimerCount()).toBe(0)
  })
})
