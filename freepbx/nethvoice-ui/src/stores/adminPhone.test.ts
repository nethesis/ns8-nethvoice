//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { PiniaColada } from '@pinia/colada'
import i18n, { loadLocaleMessages } from '@/i18n'
import {
  ADMIN_PHONE_CHANNEL_NAME,
  ADMIN_PHONE_HOLDER_TIMEOUT,
  ADMIN_PHONE_RELOAD_DELAY,
  getServiceExtension,
} from '@/lib/adminPhone/adminPhone'
import { api } from '@/lib/api/client'
import { ApiError } from '@/lib/api/errors'
import { CREDENTIALS_STORAGE_KEY } from '@/lib/config'
import { useLoginStore } from '@/stores/login'
import { useAdminPhoneStore } from './adminPhone'

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

type FakeRequest = {
  callback: (lock: Lock | null) => unknown
  resolve: (value: unknown) => void
  reject: (reason: unknown) => void
}

class FakeLockManager {
  held = false
  stolen = false
  private release: (() => void) | null = null
  private abortHolder: ((reason: unknown) => void) | null = null
  private queue: FakeRequest[] = []

  holdElsewhere() {
    this.held = true
    this.release = () => this.next()
    this.abortHolder = () => undefined
    return () => this.release?.()
  }

  request(_name: string, options: LockOptions, callback: (lock: Lock | null) => unknown) {
    return new Promise((resolve, reject) => {
      const entry = { callback, resolve, reject }

      if (options.steal) {
        this.abortHolder?.(new DOMException('stolen', 'AbortError'))
        this.stolen = true
        this.grant(entry)
        return
      }
      if (!this.held) {
        this.grant(entry)
        return
      }
      if (options.ifAvailable) {
        Promise.resolve(callback(null)).then(resolve, reject)
        return
      }
      this.queue.push(entry)
      options.signal?.addEventListener('abort', () => {
        this.queue = this.queue.filter((queued) => queued !== entry)
        reject(new DOMException('aborted', 'AbortError'))
      })
    })
  }

  private grant(entry: FakeRequest) {
    this.held = true
    this.abortHolder = entry.reject
    const lock = { name: 'lock', mode: 'exclusive' } as Lock
    this.release = () => this.next()
    Promise.resolve(entry.callback(lock)).then((value) => {
      entry.resolve(value)
      if (this.abortHolder === entry.reject) {
        this.next()
      }
    }, entry.reject)
  }

  private next() {
    this.held = false
    this.abortHolder = null
    this.release = null
    const entry = this.queue.shift()
    if (entry) {
      this.grant(entry)
    }
  }
}

class FakeBroadcastChannel {
  static channels: FakeBroadcastChannel[] = []
  onmessage: ((event: MessageEvent) => void) | null = null
  private closed = false

  constructor(readonly name: string) {
    FakeBroadcastChannel.channels.push(this)
  }

  postMessage(data: unknown) {
    for (const channel of FakeBroadcastChannel.channels) {
      if (channel !== this && channel.name === this.name && !channel.closed) {
        queueMicrotask(() => channel.onmessage?.(new MessageEvent('message', { data })))
      }
    }
  }

  close() {
    this.closed = true
  }
}

const otherTab = (inCall: boolean) => {
  const channel = new FakeBroadcastChannel(ADMIN_PHONE_CHANNEL_NAME)
  const tab = { inCall, messages: [] as unknown[] }

  channel.onmessage = (event) => {
    tab.messages.push(event.data)

    if (event.data?.type === 'query') {
      channel.postMessage({ type: 'status', inCall: tab.inCall })
    }
  }
  return {
    messages: tab.messages,
    query: () => channel.postMessage({ type: 'query' }),
    setInCall: (value: boolean, announce = true) => {
      tab.inCall = value

      if (announce) {
        channel.postMessage({ type: 'status', inCall: value })
      }
    },
  }
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
    expect(store.errorMessage).toBe(
      'The server could not complete the request (error 500). Try again later.',
    )
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

  it('enables the phone on start when the browser has no lock manager', async () => {
    mockSession()
    const store = createStore()

    store.start()
    await vi.waitFor(() => expect(store.state).toBe('registering'))

    store.stop()
    expect(store.state).toBe('inactive')
  })

  describe('with another tab', () => {
    let fakeLocks: FakeLockManager

    beforeEach(() => {
      fakeLocks = new FakeLockManager()
      Object.defineProperty(navigator, 'locks', { value: fakeLocks, configurable: true })
      FakeBroadcastChannel.channels = []
      vi.stubGlobal('BroadcastChannel', FakeBroadcastChannel)
    })

    afterEach(() => {
      Reflect.deleteProperty(navigator, 'locks')
      vi.unstubAllGlobals()
    })

    const stealFromOtherTab = () => {
      let release: () => void = () => undefined
      void fakeLocks
        .request('lock', { steal: true }, () => new Promise<void>((done) => (release = done)))
        .catch(() => undefined)
      return () => release()
    }

    it('takes the phone from another tab when it starts', async () => {
      mockSession()
      fakeLocks.holdElsewhere()
      otherTab(false)
      const store = createStore()

      store.start()
      await vi.waitFor(() => expect(store.state).toBe('registering'))
      expect(fakeLocks.stolen).toBe(true)
      store.stop()
    })

    it('takes the phone when no other tab answers, as after a reload', async () => {
      mockSession()
      fakeLocks.holdElsewhere()
      const store = createStore()

      store.start()
      await vi.advanceTimersByTimeAsync(ADMIN_PHONE_HOLDER_TIMEOUT - 1)
      expect(fakeLocks.stolen).toBe(false)

      await vi.waitFor(() => expect(store.state).toBe('registering'))
      expect(fakeLocks.stolen).toBe(true)
      store.stop()
    })

    it('waits for the tab in a call and takes the phone when the call ends', async () => {
      mockSession()
      fakeLocks.holdElsewhere()
      const other = otherTab(true)
      const store = createStore()

      store.start()
      await vi.waitFor(() => expect(store.state).toBe('elsewhere'))
      await vi.advanceTimersByTimeAsync(ADMIN_PHONE_HOLDER_TIMEOUT)
      expect(fakeLocks.stolen).toBe(false)
      expect(store.otherTabInCall).toBe(true)
      expect(store.isCallBlocked).toBe(true)
      expect(api.POST).not.toHaveBeenCalled()

      other.setInCall(false)
      await vi.waitFor(() => expect(store.state).toBe('registering'))
      expect(fakeLocks.stolen).toBe(true)
      expect(store.otherTabInCall).toBe(false)
      store.stop()
    })

    it('gets the phone when the tab in a call closes', async () => {
      mockSession()
      const release = fakeLocks.holdElsewhere()
      otherTab(true)
      const store = createStore()

      store.start()
      await vi.waitFor(() => expect(store.state).toBe('elsewhere'))

      release()
      await vi.waitFor(() => expect(store.state).toBe('registering'))
      expect(fakeLocks.stolen).toBe(false)
      store.stop()
    })

    it('does not take the phone from a tab in a call', async () => {
      mockSession()
      const store = createStore()

      store.start()
      await vi.waitFor(() => expect(store.state).toBe('registering'))
      const other = otherTab(false)
      const releaseOther = stealFromOtherTab()
      await vi.waitFor(() => expect(store.state).toBe('elsewhere'))

      other.setInCall(true)
      await vi.waitFor(() => expect(store.otherTabInCall).toBe(true))
      vi.mocked(api.POST).mockClear()

      await store.call('300')
      store.useHere()
      await vi.advanceTimersByTimeAsync(ADMIN_PHONE_HOLDER_TIMEOUT * 2)
      expect(store.state).toBe('elsewhere')
      expect(api.POST).not.toHaveBeenCalled()

      other.setInCall(false)
      await vi.waitFor(() => expect(store.otherTabInCall).toBe(false))
      expect(store.state).toBe('elsewhere')
      releaseOther()
      store.stop()
    })

    it('asks the other tab before taking the phone to call', async () => {
      mockSession()
      const store = createStore()
      const calls = callStarts()

      store.start()
      await vi.waitFor(() => expect(store.state).toBe('registering'))
      const other = otherTab(false)
      const releaseOther = stealFromOtherTab()
      await vi.waitFor(() => expect(store.state).toBe('elsewhere'))
      other.setInCall(true, false)
      vi.mocked(api.POST).mockClear()

      await store.call('300')

      expect(store.state).toBe('elsewhere')
      expect(store.otherTabInCall).toBe(true)
      expect(api.POST).not.toHaveBeenCalled()
      await vi.runOnlyPendingTimersAsync()
      expect(calls.numbers).toEqual([])
      calls.stop()
      releaseOther()
      store.stop()
    })

    it('tells the other tabs whether the phone is in a call', async () => {
      mockSession()
      const store = createStore()

      store.start()
      await vi.waitFor(() => expect(store.state).toBe('registering'))
      store.handleIslandEvent('phone-island-webrtc-registered', {})
      const other = otherTab(false)

      other.query()
      await vi.waitFor(() => expect(other.messages).toEqual([{ type: 'status', inCall: false }]))

      store.handleIslandEvent('phone-island-call-started', {})
      await vi.waitFor(() => expect(other.messages).toHaveLength(2))
      expect(other.messages[1]).toEqual({ type: 'status', inCall: true })
      store.stop()
    })

    it('uses the phone without the lock when the browser refuses it', async () => {
      mockSession()
      const request = vi.fn(() => Promise.reject(new DOMException('denied', 'SecurityError')))
      Object.defineProperty(navigator, 'locks', { value: { request }, configurable: true })
      const store = createStore()

      store.start()
      await vi.waitFor(() => expect(store.state).toBe('registering'))
      await vi.advanceTimersByTimeAsync(ADMIN_PHONE_HOLDER_TIMEOUT * 2)
      expect(request).toHaveBeenCalledTimes(1)
      expect(api.POST).toHaveBeenCalledTimes(1)
      store.stop()
    })

    it('waits when a newer tab takes the phone and takes it back when asked', async () => {
      mockSession()
      const store = createStore()

      store.start()
      await vi.waitFor(() => expect(store.state).toBe('registering'))

      const releaseOther = stealFromOtherTab()
      await vi.waitFor(() => expect(store.state).toBe('elsewhere'))

      store.useHere()
      await vi.waitFor(() => expect(store.state).toBe('registering'))
      releaseOther()
      store.stop()
    })

    it('takes the phone back when the newer tab closes', async () => {
      mockSession()
      const store = createStore()

      store.start()
      await vi.waitFor(() => expect(store.state).toBe('registering'))

      const releaseOther = stealFromOtherTab()
      await vi.waitFor(() => expect(store.state).toBe('elsewhere'))

      releaseOther()
      await vi.waitFor(() => expect(store.state).toBe('registering'))
      store.stop()
    })

    it('takes the phone back to call from a tab without it', async () => {
      mockSession()
      const store = createStore()

      store.start()
      await vi.waitFor(() => expect(store.state).toBe('registering'))
      otherTab(false)
      const releaseOther = stealFromOtherTab()
      await vi.waitFor(() => expect(store.state).toBe('elsewhere'))
      vi.mocked(api.POST).mockClear()

      await store.call('300')

      await vi.waitFor(() => expect(store.state).toBe('registering'))
      expect(api.POST).toHaveBeenCalledTimes(1)
      releaseOther()
      store.stop()
    })
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

  it('ignores the events of the island when the phone is disabled', () => {
    const store = createStore()

    emit('phone-island-webrtc-registered')
    store.handleIslandEvent('phone-island-webrtc-registered', {})

    expect(store.state).toBe('inactive')
  })
})
