//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest'
import {
  getProviderStatus,
  getRegistrationStatus,
  parseTrunksLiveState,
  type TrunksLiveState,
} from './liveState'

const liveState: TrunksLiveState = {
  online: { status: 'online', registration: 'registered' },
  busy: { status: 'busy', registration: 'registered' },
  offline: { status: 'offline', registration: 'rejected' },
  unmonitored: { status: 'unmonitored', registration: 'unmonitored' },
  sent: { status: 'offline', registration: 'sent' },
  noauth: { status: 'offline', registration: 'noauth' },
  failed: { status: 'offline', registration: 'failed' },
  unregistered: { status: 'offline', registration: 'unregistered' },
}

describe('parseTrunksLiveState', () => {
  it('should keep status and registration of each trunk', () => {
    expect(
      parseTrunksLiveState({
        main_trunk: {
          name: 'main_trunk',
          ip: '192.0.2.10',
          status: 'online',
          registration: 'registered',
          conversations: {},
        },
      }),
    ).toEqual({ main_trunk: { status: 'online', registration: 'registered' } })
  })

  it('should default missing values to unmonitored', () => {
    expect(parseTrunksLiveState({ main_trunk: {} })).toEqual({
      main_trunk: { status: 'unmonitored', registration: 'unmonitored' },
    })
  })

  it('should reject an unexpected shape', () => {
    expect(() => parseTrunksLiveState([{ name: 'main_trunk' }])).toThrow()
  })
})

describe('getProviderStatus', () => {
  it('should be unknown when the live state is not available', () => {
    expect(getProviderStatus('online', undefined)).toBe('unknown')
  })

  it('should be pending until the trunk is known to the PBX', () => {
    expect(getProviderStatus('just_created', liveState)).toBe('pending')
  })

  it('should map the live status', () => {
    expect(getProviderStatus('online', liveState)).toBe('online')
    expect(getProviderStatus('busy', liveState)).toBe('online')
    expect(getProviderStatus('offline', liveState)).toBe('offline')
    expect(getProviderStatus('unmonitored', liveState)).toBe('unmonitored')
  })
})

describe('getRegistrationStatus', () => {
  it('should be unknown when the live state is not available', () => {
    expect(getRegistrationStatus('online', undefined)).toBe('unknown')
  })

  it('should be pending while the registration is in progress', () => {
    expect(getRegistrationStatus('just_created', liveState)).toBe('pending')
    expect(getRegistrationStatus('sent', liveState)).toBe('pending')
  })

  it('should map every failure to rejected', () => {
    expect(getRegistrationStatus('offline', liveState)).toBe('rejected')
    expect(getRegistrationStatus('noauth', liveState)).toBe('rejected')
    expect(getRegistrationStatus('failed', liveState)).toBe('rejected')
    expect(getRegistrationStatus('unregistered', liveState)).toBe('rejected')
  })

  it('should map registered and unmonitored', () => {
    expect(getRegistrationStatus('online', liveState)).toBe('registered')
    expect(getRegistrationStatus('unmonitored', liveState)).toBe('unmonitored')
  })
})
