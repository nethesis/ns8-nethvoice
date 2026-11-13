//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/lib/api/client'
import { ApiError } from '@/lib/api/errors'
import { getExtensionOptions } from '@/lib/integrations/lookups'
import { getDestinations } from '@/lib/users/bulk'
import {
  applyPhoneIslandSignal,
  buildPhoneIslandConfig,
  forgetServiceExtension,
  getServiceExtension,
  isCallableNumber,
  isServiceDestination,
  parseAdminPhoneSession,
  parseAdminPhoneStatus,
  rememberServiceExtension,
  toPhoneIslandSignal,
  withoutServiceExtension,
  type AdminPhoneSession,
} from './adminPhone'

vi.mock('@/lib/api/client', () => ({
  api: { GET: vi.fn(), POST: vi.fn(), PATCH: vi.fn(), DELETE: vi.fn() },
}))

const RAW_SESSION = {
  extension: '770000',
  secret: '0123456789abcdef0123456789abcdef',
  display_name: 'Admin (test)',
  sip_host: '127.0.0.1',
  sip_port: 5060,
  cti_host: 'cti2.example.org',
  reloading: true,
}

const SESSION: AdminPhoneSession = {
  extension: '770000',
  secret: '0123456789abcdef0123456789abcdef',
  displayName: 'Admin (test)',
  sipHost: '127.0.0.1',
  sipPort: 5060,
  ctiHost: 'cti2.example.org',
  reloading: true,
}

const mockGet = (responses: Record<string, unknown>) =>
  vi.mocked(api.GET).mockImplementation(async (path: string) => {
    if (!(path in responses)) {
      throw new ApiError({ status: 404, method: 'GET', url: path, body: null })
    }
    return { data: responses[path], response: new Response() }
  })

describe('admin phone session', () => {
  it('parses the session returned by the server', () => {
    expect(parseAdminPhoneSession(RAW_SESSION)).toEqual(SESSION)
  })

  it('rejects a session without the CTI host', () => {
    expect(() => parseAdminPhoneSession({ ...RAW_SESSION, cti_host: '' })).toThrow()
  })

  it('rejects a session with an invalid port', () => {
    expect(() => parseAdminPhoneSession({ ...RAW_SESSION, sip_port: 0 })).toThrow()
  })

  it('builds the Phone Island config without CTI username and token', () => {
    const decoded = atob(buildPhoneIslandConfig(SESSION))

    expect(decoded).toBe(
      'cti2.example.org:::770000:0123456789abcdef0123456789abcdef:127.0.0.1:5060',
    )
    expect(decoded.split(':')).toHaveLength(7)
  })

  it('parses the state of the service extension', () => {
    expect(parseAdminPhoneStatus({ enabled: true, extension: '770001' })).toEqual({
      enabled: true,
      extension: '770001',
    })
    expect(parseAdminPhoneStatus({ enabled: false, extension: '770001' })).toEqual({
      enabled: false,
      extension: null,
    })
  })
})

describe('Phone Island events', () => {
  it('maps the browser events to signals', () => {
    expect(toPhoneIslandSignal('phone-island-webrtc-registered', {})).toBe('registered')
    expect(toPhoneIslandSignal('phone-island-webrtc-unregistered', {})).toBe('unregistered')
    expect(toPhoneIslandSignal('phone-island-alert-set', { type: 'webrtc_down' })).toBe(
      'connection_lost',
    )
    expect(toPhoneIslandSignal('phone-island-alert-set', { type: 'socket_down' })).toBeNull()
    expect(toPhoneIslandSignal('phone-island-alert-set', null)).toBeNull()
    expect(toPhoneIslandSignal('phone-island-outgoing-call-started', {})).toBe('call_started')
    expect(toPhoneIslandSignal('phone-island-call-answered', {})).toBe('call_started')
    expect(toPhoneIslandSignal('phone-island-call-ended', {})).toBe('call_ended')
    expect(toPhoneIslandSignal('phone-island-expanded', {})).toBeNull()
  })

  it('becomes ready when the extension registers', () => {
    expect(applyPhoneIslandSignal({ state: 'registering', inCall: false }, 'registered')).toEqual({
      state: 'ready',
      inCall: false,
    })
    expect(applyPhoneIslandSignal({ state: 'error', inCall: false }, 'registered')).toEqual({
      state: 'ready',
      inCall: false,
    })
  })

  it('ignores the events when the phone is not mounted', () => {
    const inactive = { state: 'inactive', inCall: false } as const
    const starting = { state: 'starting', inCall: false } as const

    expect(applyPhoneIslandSignal(inactive, 'registered')).toBe(inactive)
    expect(applyPhoneIslandSignal(starting, 'call_started')).toBe(starting)
  })

  it('tracks the call in progress only when ready', () => {
    const inCall = applyPhoneIslandSignal({ state: 'ready', inCall: false }, 'call_started')

    expect(inCall).toEqual({ state: 'ready', inCall: true })
    expect(applyPhoneIslandSignal(inCall, 'call_ended')).toEqual({ state: 'ready', inCall: false })
    expect(applyPhoneIslandSignal({ state: 'registering', inCall: false }, 'call_started')).toEqual(
      { state: 'registering', inCall: false },
    )
  })

  it('reports a lost connection and ends the call', () => {
    expect(applyPhoneIslandSignal({ state: 'ready', inCall: true }, 'connection_lost')).toEqual({
      state: 'error',
      inCall: false,
    })
    expect(applyPhoneIslandSignal({ state: 'ready', inCall: true }, 'unregistered')).toEqual({
      state: 'registering',
      inCall: false,
    })
  })

  it('accepts only dialable numbers', () => {
    expect(isCallableNumber('201')).toBe(true)
    expect(isCallableNumber(' +390612345678 ')).toBe(true)
    expect(isCallableNumber('*43')).toBe(true)
    expect(isCallableNumber('')).toBe(false)
    expect(isCallableNumber('201; DROP')).toBe(false)
  })
})

describe('service extension', () => {
  beforeEach(() => {
    vi.mocked(api.GET).mockReset()
    forgetServiceExtension()
  })

  it('removes the service extension from a list', () => {
    const items = [{ extension: '201' }, { extension: '770000' }, { extension: '7700000' }]

    expect(withoutServiceExtension(items, (item) => item.extension, '770000')).toEqual([
      { extension: '201' },
      { extension: '7700000' },
    ])
    expect(withoutServiceExtension(items, (item) => item.extension, null)).toBe(items)
  })

  it('recognizes the destinations of the service extension', () => {
    expect(isServiceDestination('from-did-direct,770000,1', '770000')).toBe(true)
    expect(isServiceDestination('ext-local,vmb770000,1', '770000')).toBe(true)
    expect(isServiceDestination('from-did-direct,7700001,1', '770000')).toBe(false)
    expect(isServiceDestination('from-did-direct,201,1', '770000')).toBe(false)
    expect(isServiceDestination('from-did-direct,770000,1', null)).toBe(false)
  })

  it('reads the service extension once', async () => {
    mockGet({ '/adminphone': { enabled: true, extension: '770002' } })

    await expect(getServiceExtension()).resolves.toBe('770002')
    await expect(getServiceExtension()).resolves.toBe('770002')
    expect(api.GET).toHaveBeenCalledTimes(1)
  })

  it('filters nothing when the server has no administrator phone', async () => {
    mockGet({})

    await expect(getServiceExtension()).resolves.toBeNull()
  })

  it('uses the extension remembered after a session', async () => {
    rememberServiceExtension('770003')

    await expect(getServiceExtension()).resolves.toBe('770003')
    expect(api.GET).not.toHaveBeenCalled()
  })

  it('hides the service extension from the extension options', async () => {
    mockGet({
      '/adminphone': { enabled: true, extension: '770000' },
      '/physicalextensions': [
        { extension: '770000', name: 'Admin (test)' },
        { extension: '201', name: 'Andrea' },
      ],
    })

    await expect(getExtensionOptions()).resolves.toEqual([{ extension: '201', name: 'Andrea' }])
  })

  it('hides the service extension from the destinations', async () => {
    mockGet({
      '/adminphone': { enabled: true, extension: '770000' },
      '/destinations': {
        Extensions: [
          { destination: 'from-did-direct,201,1', description: '<201> Andrea' },
          { destination: 'from-did-direct,770000,1', description: '<770000> Admin (test)' },
        ],
      },
    })

    await expect(getDestinations()).resolves.toEqual([
      { id: 'from-did-direct,201,1', label: '<201> Andrea', category: 'Extensions' },
    ])
  })
})
