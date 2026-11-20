//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, nextTick } from 'vue'
import { createPinia } from 'pinia'
import { PiniaColada } from '@pinia/colada'
import * as v from 'valibot'
import i18n, { loadLocaleMessages } from '@/i18n'
import { ApiError } from '@/lib/api/errors'
import { CREDENTIALS_STORAGE_KEY } from '@/lib/config'
import { useLoginStore } from '@/stores/login'
import {
  describeError,
  getClientErrorDetail,
  isNetworkError,
  useNotificationsStore,
} from './notifications'

vi.mock('@/lib/api/client', () => ({
  api: { GET: vi.fn(), POST: vi.fn(), PATCH: vi.fn(), DELETE: vi.fn(), use: vi.fn() },
  configureApiClient: vi.fn(),
}))

const apiError = (status: number, body: unknown = null) =>
  new ApiError({ status, method: 'POST', url: '/freepbx/rest/cti/profiles/4', body })

describe('describeError', () => {
  beforeAll(async () => {
    await loadLocaleMessages('en')
    i18n.global.locale.value = 'en'
  })

  it('never shows the message of a server error', () => {
    const fixed = 'The server could not complete the request (error 500). Try again later.'

    expect(describeError(apiError(500, { message: 'users-admin is unavailable' }))).toBe(fixed)
    expect(
      describeError(apiError(500, { message: 'users-admin is unavailable' }), {
        serverDetail: false,
      }),
    ).toBe(fixed)
    expect(describeError(apiError(500, '<html><body><h1>Internal error</h1></body></html>'))).toBe(
      fixed,
    )
    expect(describeError(apiError(507, { status: 'Disk full on /var/lib/mysql' }))).toBe(
      'The server could not complete the request (error 507). Try again later.',
    )
  })

  it('shows the message of a request error', () => {
    expect(describeError(apiError(400, { message: 'Bad extension' }))).toBe('Bad extension')
    expect(
      describeError(apiError(400, { message: 'Bad extension' }), { serverDetail: false }),
    ).toBe('Bad extension')
    expect(describeError(apiError(422, { message: 'Extension 201 is already used' }))).toBe(
      'Some values are not valid. Check them and try again. Server message: Extension 201 is already used',
    )
  })

  it('hides the technical message of an unexpected response', () => {
    const result = v.safeParse(v.object({ destinations: v.string() }), {})
    const error = result.success ? null : new v.ValiError(result.issues)

    expect(describeError(error)).toBe(
      'The server sent an unexpected response. Reload the page and try again.',
    )
  })

  it('explains an unreachable service without the body of the proxy', () => {
    expect(describeError(apiError(502, 'Bad Gateway'))).toBe(
      'The service is not reachable at the moment. Try again shortly.',
    )
    expect(describeError(apiError(503, '<html><body><h1>503</h1></body></html>'))).toBe(
      'The service is not reachable at the moment. Try again shortly.',
    )
    expect(
      describeError(apiError(504, { message: 'Gateway Timeout' }), { serverDetail: false }),
    ).toBe('The service is not reachable at the moment. Try again shortly.')
  })

  it('explains an error without message', () => {
    expect(describeError(apiError(500))).toBe(
      'The server could not complete the request (error 500). Try again later.',
    )
  })

  it('hides the HTML page of a server error', () => {
    expect(
      describeError(apiError(500, '<br /><b>Fatal error</b>: Uncaught PDOException: SQLSTATE')),
    ).toBe('The server could not complete the request (error 500). Try again later.')
  })

  it('translates the conflict, validation and lock errors and keeps the server message', () => {
    expect(describeError(apiError(423, { message: 'Another profile change is in progress' }))).toBe(
      'Another change is in progress. Wait a few seconds and try again. Server message: Another profile change is in progress',
    )
    expect(describeError(apiError(409))).toBe(
      'This name or value is already in use. Change it and try again.',
    )
    expect(describeError(apiError(422, { result: 'User name or full name invalid' }))).toContain(
      'Some values are not valid.',
    )
  })

  it('translates the network errors', () => {
    const offline = new TypeError('Failed to fetch')

    expect(isNetworkError(offline)).toBe(true)
    expect(describeError(offline)).toBe(
      'Cannot reach the server. Check the connection and try again.',
    )
    expect(describeError(new Error('boom'))).toBe('boom')
  })
})

const HISTORY_KEY = 'nethvoiceNotifications:admin'

const signIn = (user = 'admin') =>
  localStorage.setItem(CREDENTIALS_STORAGE_KEY, JSON.stringify({ user, hash: 'secret' }))

type Stores = {
  notifications: ReturnType<typeof useNotificationsStore>
  login: ReturnType<typeof useLoginStore>
}

const createStores = (): Stores => {
  const created: Stores[] = []
  const app = createApp({
    setup() {
      created.push({ notifications: useNotificationsStore(), login: useLoginStore() })
      return () => null
    },
  })
  app.use(createPinia()).use(PiniaColada).use(i18n)
  app.mount(document.createElement('div'))

  const [stores] = created
  if (!stores) {
    throw new Error('The stores were not created')
  }
  return stores
}

describe('getClientErrorDetail', () => {
  it('reads the message of a client error only', () => {
    expect(getClientErrorDetail(apiError(400, { message: 'Missing field: name' }))).toBe(
      'Missing field: name',
    )
    expect(getClientErrorDetail(apiError(500, { message: 'users-admin is unavailable' }))).toBe('')
    expect(getClientErrorDetail(apiError(503, { message: 'Try later' }))).toBe('')
    expect(getClientErrorDetail(new Error('network'))).toBe('')
  })
})

describe('notification history', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.clear()
    signIn()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('keeps the history of the user after a reload, without showing it again', () => {
    const first = createStores().notifications
    first.createNotification({ kind: 'error', title: 'Trunk unreachable', description: 'Backup' })

    const { notifications } = createStores()

    expect(notifications.notifications).toHaveLength(1)
    expect(notifications.notifications[0]).toMatchObject({
      kind: 'error',
      title: 'Trunk unreachable',
      description: 'Backup',
      isShown: false,
    })
    expect(notifications.notifications[0]?.timestamp).toBeInstanceOf(Date)
  })

  it('keeps a separate history for each user', () => {
    createStores().notifications.createNotification({ title: 'For admin' })
    signIn('operator')

    expect(createStores().notifications.notifications).toEqual([])
    expect(localStorage.getItem(HISTORY_KEY)).toContain('For admin')
  })

  it('keeps the 30 most recent notifications', () => {
    const { notifications } = createStores()

    for (let index = 0; index < 35; index += 1) {
      notifications.createNotification({ title: `Notification ${index}` })
    }

    const restored = createStores().notifications.notifications
    expect(restored).toHaveLength(30)
    expect(restored[0]?.title).toBe('Notification 34')
  })

  it('clears all the notifications', () => {
    const { notifications } = createStores()
    notifications.createNotification({ title: 'Saved' })

    notifications.clearNotifications()

    expect(notifications.notifications).toEqual([])
    expect(localStorage.getItem(HISTORY_KEY)).toBeNull()
  })

  it('forgets the history on sign out', async () => {
    const { notifications, login } = createStores()
    notifications.createNotification({ title: 'Saved' })

    login.handleAuthenticationFailure()
    await nextTick()

    expect(notifications.notifications).toEqual([])
    expect(localStorage.getItem(HISTORY_KEY)).toBeNull()
  })

  it('works when the browser storage is not available', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError')
    })
    const { notifications } = createStores()

    expect(() => notifications.createNotification({ title: 'Saved' })).not.toThrow()
    expect(notifications.notifications).toHaveLength(1)
  })

  it('follows the history changed in another tab', () => {
    const { notifications } = createStores()
    notifications.createNotification({ title: 'Here' })

    window.dispatchEvent(new StorageEvent('storage', { key: HISTORY_KEY, newValue: null }))

    expect(notifications.notifications).toEqual([])
  })
})
