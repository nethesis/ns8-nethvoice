//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it, vi } from 'vitest'
import * as v from 'valibot'
import { api } from '@/lib/api/client'
import {
  applyUserSettingsSteps,
  countFreeDeviceSlots,
  normalizeMobile,
  planUserSettingsUpdate,
  UserSettingsSchema,
  UserSettingsStepError,
  type UserSettings,
} from './userSettings'
import type { User } from './users'

vi.mock('@/lib/api/client', () => ({ api: { POST: vi.fn(), DELETE: vi.fn() } }))

const CURRENT: UserSettings = {
  extension: '300',
  mobile: '+39 333 1234567',
  voicemail: true,
  profileId: 2,
  groupIds: [1, 2],
  devices: ['webrtc', 'mobile'],
}

describe('UserSettingsSchema', () => {
  const issues = (settings: Partial<UserSettings>) => {
    const result = v.safeParse(UserSettingsSchema, { ...CURRENT, ...settings })
    return result.success ? {} : v.flatten(result.issues).nested
  }

  it('accepts valid settings and trims the text', () => {
    const result = v.safeParse(UserSettingsSchema, { ...CURRENT, extension: ' 301 ' })
    expect(result.success && result.output.extension).toBe('301')
  })

  it('rejects an extension that is not a number and a malformed mobile', () => {
    expect(issues({ extension: '30a', mobile: 'call me' })).toEqual({
      extension: ['users.extension_invalid'],
      mobile: ['users.mobile_invalid'],
    })
  })

  it('requires a profile only when the user has an extension', () => {
    expect(issues({ profileId: null })).toEqual({ profileId: ['users.profile_required'] })
    expect(issues({ profileId: null, extension: '' })).toEqual({})
  })
})

describe('normalizeMobile', () => {
  it('normalizes like the backend does', () => {
    expect(normalizeMobile('+39 (333) 123-4567')).toBe('00393331234567')
    expect(normalizeMobile('  ')).toBe('')
  })
})

describe('planUserSettingsUpdate', () => {
  it('does nothing when nothing changed', () => {
    expect(planUserSettingsUpdate(CURRENT, { ...CURRENT, groupIds: [2, 1] })).toEqual([])
    expect(planUserSettingsUpdate(CURRENT, { ...CURRENT, mobile: '0039 3331234567' })).toEqual([])
  })

  it('sends only the changed settings', () => {
    expect(
      planUserSettingsUpdate(CURRENT, {
        ...CURRENT,
        voicemail: false,
        profileId: 3,
        devices: ['webrtc', 'nethlink'],
      }),
    ).toEqual([
      { kind: 'profile', profileId: 3 },
      { kind: 'voicemail', enabled: false },
      { kind: 'disable_device', device: 'mobile' },
      { kind: 'enable_device', device: 'nethlink' },
    ])
  })

  it('recreates groups, voicemail and devices after an extension change', () => {
    expect(planUserSettingsUpdate(CURRENT, { ...CURRENT, extension: '310' })).toEqual([
      { kind: 'extension', extension: '310' },
      { kind: 'groups', groupIds: [1, 2] },
      { kind: 'voicemail', enabled: true },
      { kind: 'enable_device', device: 'webrtc' },
      { kind: 'enable_device', device: 'mobile' },
    ])
  })

  it('skips the settings that need an extension when it is removed', () => {
    expect(
      planUserSettingsUpdate(CURRENT, { ...CURRENT, extension: '', mobile: '', groupIds: [] }),
    ).toEqual([
      { kind: 'extension', extension: '' },
      { kind: 'mobile', mobile: '' },
    ])
  })

  it('configures a user that had no extension', () => {
    const empty: UserSettings = {
      extension: '',
      mobile: '',
      voicemail: false,
      profileId: null,
      groupIds: [],
      devices: [],
    }

    expect(
      planUserSettingsUpdate(empty, {
        ...empty,
        extension: '300',
        profileId: 1,
        devices: ['webrtc'],
      }),
    ).toEqual([
      { kind: 'extension', extension: '300' },
      { kind: 'profile', profileId: 1 },
      { kind: 'enable_device', device: 'webrtc' },
    ])
  })
})

describe('countFreeDeviceSlots', () => {
  const withDevices = (count: number): User => ({
    id: 1,
    username: 'a.miller',
    displayName: 'Anna Miller',
    mainExtension: '300',
    profileId: 1,
    email: '',
    devices: Array.from({ length: count }, (_, index) => ({
      id: index,
      type: 'physical' as const,
      extension: `9${index}300`,
      mac: '',
      vendor: '',
      model: '',
      line: 1,
      registered: false,
    })),
  })

  it('counts the slots left out of nine', () => {
    expect(countFreeDeviceSlots(withDevices(3))).toBe(6)
    expect(countFreeDeviceSlots(withDevices(9))).toBe(0)
    expect(countFreeDeviceSlots(withDevices(10))).toBe(0)
  })
})

describe('applyUserSettingsSteps', () => {
  const user: User = {
    id: 7,
    username: 'a.miller',
    displayName: 'Anna Miller',
    mainExtension: '300',
    profileId: 1,
    email: '',
    devices: [],
  }

  it('reports the steps applied before the one that failed', async () => {
    vi.mocked(api.POST).mockImplementation(async (path) => {
      if (path === '/voicemails') {
        throw new Error('boom')
      }
      return { data: undefined, response: new Response() }
    })

    const error = await applyUserSettingsSteps(user, [
      { kind: 'extension', extension: '299' },
      { kind: 'groups', groupIds: [2] },
      { kind: 'voicemail', enabled: true },
      { kind: 'enable_device', device: 'webrtc' },
    ]).catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(UserSettingsStepError)
    expect(error).toMatchObject({
      step: { kind: 'voicemail', enabled: true },
      completed: [
        { kind: 'extension', extension: '299' },
        { kind: 'groups', groupIds: [2] },
      ],
    })
    expect(api.POST).toHaveBeenCalledWith('/voicemails', {
      body: { extension: '299', state: 'yes' },
    })
  })
})
