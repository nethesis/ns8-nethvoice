//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { PiniaColada } from '@pinia/colada'
import i18n, { loadLocaleMessages } from '@/i18n'
import { ADMIN_PHONE_RELOAD_DELAY, getServiceExtension } from '@/lib/adminPhone/adminPhone'
import { api } from '@/lib/api/client'
import { ApiError } from '@/lib/api/errors'
import { CREDENTIALS_STORAGE_KEY } from '@/lib/config'
import { useLoginStore } from '@/stores/login'
import { COST_NOTICE_STORAGE_KEY, useAdminPhoneStore } from './adminPhone'

vi.mock('@/lib/api/client', () => ({
  api: { GET: vi.fn(), POST: vi.fn(), PATCH: vi.fn(), DELETE: vi.fn(), use: vi.fn() },
  configureApiClient: vi.fn(),
}))

const notifications = vi.hoisted(() => ({
  createNotification: vi.fn(),
  createNotificationFromError: vi.fn(),
}))

vi.mock('@/stores/notifications', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/stores/notifications')>()),
  useNotificationsStore: () => notifications,
}))

const SESSION = {
  extension: '770000',
  secret: 'f00dcafe',
  display_name: 'Admin (test)',
  sip_host: '127.0.0.1',
  sip_port: 5060,
  cti_host: 'cti2.example.org',
  reloading: false,
}

const mockSession = (session: object = SESSION) =>
  vi.mocked(api.POST).mockResolvedValue({ data: session, response: new Response() })

const createStore = () => {
  localStorage.setItem(CREDENTIALS_STORAGE_KEY, JSON.stringify({ user: 'admin', hash: 'secret' }))
  const pinia = createPinia()
  createApp({}).use(pinia).use(PiniaColada).use(i18n)
  setActivePinia(pinia)
  return useAdminPhoneStore()
}

const emit = (name: string, detail: object = {}) =>
  window.dispatchEvent(new CustomEvent(name, { detail }))

const callStarts = () => {
  const numbers: string[] = []
  const listener = (event: Event) => {
    if (event instanceof CustomEvent) {
      numbers.push(String(event.detail.number))
    }
  }
  window.addEventListener('phone-island-call-start', listener)
  return { numbers, stop: () => window.removeEventListener('phone-island-call-start', listener) }
}

describe('useAdminPhoneStore', () => {
  beforeAll(async () => {
    await loadLocaleMessages('en')
    i18n.global.locale.value = 'en'
  })

  beforeEach(() => {
    vi.useFakeTimers()
    vi.mocked(api.POST).mockReset()
    notifications.createNotification.mockReset()
    notifications.createNotificationFromError.mockReset()
    localStorage.clear()
    sessionStorage.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts disabled', () => {
    const store = createStore()

    expect(store.state).toBe('inactive')
    expect(store.isEnabled).toBe(false)
    expect(store.dataConfig).toBe('')
  })

  it('prepares the session and waits for the registration', async () => {
    mockSession()
    const store = createStore()

    await store.enable()

    expect(api.POST).toHaveBeenCalledWith('/adminphone/session', { body: {} })
    expect(store.state).toBe('registering')
    expect(store.extension).toBe('770000')
    expect(atob(store.dataConfig)).toBe('cti2.example.org:::770000:f00dcafe:127.0.0.1:5060')
    await expect(getServiceExtension()).resolves.toBe('770000')

    store.handleIslandEvent('phone-island-webrtc-registered', {})
    expect(store.state).toBe('ready')
    expect(store.canCall).toBe(true)
  })

  it('keeps the secret out of the browser storage', async () => {
    mockSession()
    const store = createStore()

    await store.enable()
    store.handleIslandEvent('phone-island-webrtc-registered', {})

    const stored = [
      ...Object.values({ ...localStorage }),
      ...Object.values({ ...sessionStorage }),
    ].join('\n')
    expect(stored).not.toContain('f00dcafe')
  })

  it('waits for the reload of the PBX before mounting the phone', async () => {
    mockSession({ ...SESSION, reloading: true })
    const store = createStore()

    const enabling = store.enable()
    await vi.advanceTimersByTimeAsync(ADMIN_PHONE_RELOAD_DELAY - 1)
    expect(store.state).toBe('starting')
    expect(store.dataConfig).toBe('')

    await vi.advanceTimersByTimeAsync(1)
    await enabling
    expect(store.state).toBe('registering')
    expect(store.dataConfig).not.toBe('')
  })

  it('shows the error when the session cannot be prepared', async () => {
    vi.mocked(api.POST).mockRejectedValue(
      new ApiError({
        status: 500,
        method: 'POST',
        url: '/freepbx/rest/adminphone/session',
        body: { message: 'Cannot prepare the administrator phone' },
      }),
    )
    const store = createStore()

    await store.enable()

    expect(store.state).toBe('error')
    expect(store.isEnabled).toBe(false)
    expect(store.errorMessage).toBe('Cannot prepare the administrator phone')
  })

  it('reports a lost connection and recovers when the extension registers again', async () => {
    mockSession()
    const store = createStore()

    await store.enable()
    store.handleIslandEvent('phone-island-alert-set', { type: 'webrtc_down' })
    expect(store.state).toBe('error')
    expect(store.isEnabled).toBe(true)

    store.handleIslandEvent('phone-island-webrtc-registered', {})
    expect(store.state).toBe('ready')
  })

  it('enables the phone and then calls the pending number', async () => {
    mockSession()
    const store = createStore()
    const calls = callStarts()

    await store.call('201')
    expect(store.state).toBe('registering')
    await vi.runAllTimersAsync()
    expect(calls.numbers).toEqual([])

    store.handleIslandEvent('phone-island-webrtc-registered', {})
    await vi.runAllTimersAsync()
    expect(calls.numbers).toEqual(['201'])
    calls.stop()
  })

  it('calls right away when the phone is ready and not during a call', async () => {
    mockSession()
    const store = createStore()
    const calls = callStarts()

    await store.enable()
    store.handleIslandEvent('phone-island-webrtc-registered', {})
    await store.call(' 202 ')
    await vi.runAllTimersAsync()
    expect(calls.numbers).toEqual(['202'])

    store.handleIslandEvent('phone-island-call-started', {})
    expect(store.inCall).toBe(true)
    await store.call('203')
    await store.call('20;3')
    await vi.runAllTimersAsync()
    expect(calls.numbers).toEqual(['202'])

    store.handleIslandEvent('phone-island-call-ended', {})
    expect(store.inCall).toBe(false)
    calls.stop()
  })

  it('shows the notice about the cost of calls once per session', async () => {
    mockSession()
    const store = createStore()

    await store.enable()
    store.handleIslandEvent('phone-island-webrtc-registered', {})
    store.handleIslandEvent('phone-island-webrtc-unregistered', {})
    store.handleIslandEvent('phone-island-webrtc-registered', {})

    expect(notifications.createNotification).toHaveBeenCalledTimes(1)
    expect(notifications.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'info', title: 'Calls to external numbers' }),
    )
    expect(sessionStorage.getItem(COST_NOTICE_STORAGE_KEY)).toBe('true')
  })

  it('disables the phone and ignores a late session', async () => {
    let resolve: (value: { data: object; response: Response }) => void = () => undefined
    vi.mocked(api.POST).mockReturnValue(
      new Promise((done) => {
        resolve = done
      }),
    )
    const store = createStore()

    const enabling = store.enable()
    store.disable()
    resolve({ data: SESSION, response: new Response() })
    await enabling

    expect(store.state).toBe('inactive')
    expect(store.dataConfig).toBe('')
  })

  it('disables the phone on sign out', async () => {
    mockSession()
    const store = createStore()
    const loginStore = useLoginStore()

    await store.enable()
    loginStore.handleAuthenticationFailure()
    await nextTick()

    expect(store.state).toBe('inactive')
    expect(store.dataConfig).toBe('')
  })

  it('regenerates the credentials and prepares the phone again', async () => {
    vi.mocked(api.POST).mockImplementation(async (path: string) => ({
      data: path === '/adminphone/session' ? { ...SESSION, secret: 'beef' } : null,
      response: new Response(),
    }))
    const store = createStore()

    await store.enable()
    const rotating = store.rotate()
    await vi.advanceTimersByTimeAsync(ADMIN_PHONE_RELOAD_DELAY)
    await rotating

    expect(api.POST).toHaveBeenCalledTimes(3)
    expect(api.POST).toHaveBeenNthCalledWith(1, '/adminphone/session', { body: {} })
    expect(api.POST).toHaveBeenNthCalledWith(2, '/adminphone/rotate')
    expect(api.POST).toHaveBeenNthCalledWith(3, '/adminphone/session', { body: {} })
    expect(store.state).toBe('registering')
    expect(store.isRotating).toBe(false)
    expect(notifications.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'success', title: 'Phone credentials regenerated' }),
    )
  })

  it('ignores the events of the island when the phone is disabled', () => {
    const store = createStore()

    emit('phone-island-webrtc-registered')
    store.handleIslandEvent('phone-island-webrtc-registered', {})

    expect(store.state).toBe('inactive')
  })
})
