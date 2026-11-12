//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/lib/api/client'
import { postUserProfile } from '@/lib/profiles/profiles'
import { disableSoftwareDevice, enableSoftwareDevice, postVoicemail } from './userSettings'
import {
  assignProfileToUsers,
  buildBulkRequest,
  BulkUserError,
  DEFAULT_DESTINATION,
  EMPTY_ADVANCED_BULK_FORM,
  exceedsDeviceLimit,
  getDisablingPlans,
  parseBulkSettings,
  parseDestinations,
  planDevicesForUsers,
  setDevicesForUsers,
  setVoicemailForUsers,
  validateAdvancedBulk,
} from './bulk'
import type { User, UserDevice } from './users'

vi.mock('./userSettings', () => ({
  postVoicemail: vi.fn(),
  enableSoftwareDevice: vi.fn(),
  disableSoftwareDevice: vi.fn(),
}))

vi.mock('@/lib/profiles/profiles', () => ({ postUserProfile: vi.fn() }))

vi.mock('@/lib/api/client', () => ({ api: { POST: vi.fn(), GET: vi.fn() } }))

const device = (id: number, type: UserDevice['type'], extension: string): UserDevice => ({
  id,
  type,
  extension,
  mac: '',
  vendor: '',
  model: '',
  line: null,
  registered: false,
})

const user = (username: string, mainExtension: string, devices: UserDevice[] = []): User => ({
  id: devices.length + 1,
  username,
  displayName: username,
  mainExtension,
  profileId: 1,
  email: '',
  devices,
})

describe('planDevicesForUsers', () => {
  const users = [
    user('a.miller', '300', [device(1, 'webrtc', '300'), device(2, 'mobile', '91300')]),
    user('c.davis', '301', [device(3, 'webrtc', '301')]),
    user('d.jones', ''),
  ]

  it('enables the chosen devices and disables the others of the users with an extension', () => {
    expect(
      planDevicesForUsers(users, ['webrtc', 'nethlink']).map(({ user, enable, disable }) => ({
        username: user.username,
        enable,
        disable,
      })),
    ).toEqual([
      { username: 'a.miller', enable: ['nethlink'], disable: ['mobile'] },
      { username: 'c.davis', enable: ['nethlink'], disable: [] },
    ])
  })

  it('skips the users that already have the chosen devices', () => {
    expect(planDevicesForUsers([users[1]], ['webrtc'])).toEqual([])
  })

  it('detects the users that would exceed the device limit', () => {
    const full = user(
      'k.lee',
      '305',
      Array.from({ length: 9 }, (_, index) => device(index, 'physical', `9${index}305`)),
    )
    const [plan] = planDevicesForUsers([full], ['webrtc'])

    expect(exceedsDeviceLimit(plan)).toBe(true)
    expect(exceedsDeviceLimit(planDevicesForUsers([users[1]], ['webrtc', 'mobile'])[0])).toBe(false)
  })
})

describe('parseBulkSettings', () => {
  it('keeps the values shared by all the users and leaves the others empty', () => {
    expect(
      parseBulkSettings({
        displayname: null,
        profile: 3,
        callwaiting: false,
        ringtime: '0',
        callgroup: '1',
        pickupgroup: null,
        noanswerdest: '',
        busydest: 'ext-queues,401,1',
        notreachabledest: null,
        outboundcid: '0721405516',
      }),
    ).toEqual({
      displayname: '',
      callwaiting: 'disabled',
      ringtime: '0',
      callgroup: '1',
      pickupgroup: '',
      noanswerdest: DEFAULT_DESTINATION,
      busydest: 'ext-queues,401,1',
      notreachabledest: '',
      outboundcid: '0721405516',
      outboundcidDigits: '',
    })
  })

  it('ignores the values read without Asterisk', () => {
    const settings = parseBulkSettings({ callwaiting: -1, ringtime: -1 })

    expect(settings.callwaiting).toBe('')
    expect(settings.ringtime).toBe('')
  })
})

describe('parseDestinations', () => {
  it('flattens the categories and drops the placeholders', () => {
    expect(
      parseDestinations({
        Announcements: {
          99999: { destination: 'popover', description: 'Add new Announcements &#133' },
        },
        'Terminate Call': [{ destination: 'app-blackhole,hangup,1', description: 'Hangup' }],
        Queues: {
          0: { destination: 'ext-queues,401,1', description: ' 401 Support ' },
          99999: { destination: 'popover', description: 'Add new Queues &#133' },
        },
      }),
    ).toEqual([
      { id: 'app-blackhole,hangup,1', label: 'Hangup', category: 'Terminate Call' },
      { id: 'ext-queues,401,1', label: '401 Support', category: 'Queues' },
    ])
  })
})

describe('buildBulkRequest', () => {
  const initial = { ...EMPTY_ADVANCED_BULK_FORM, callwaiting: 'disabled', ringtime: '0' }

  it('sends only the changed fields', () => {
    expect(
      buildBulkRequest(initial, {
        ...initial,
        callwaiting: 'enabled',
        ringtime: '0',
        callgroup: ' 1,2 ',
        noanswerdest: DEFAULT_DESTINATION,
        busydest: 'ext-queues,401,1',
      }),
    ).toEqual({
      callwaiting: true,
      callgroup: '1,2',
      noanswerdest: '',
      busydest: 'ext-queues,401,1',
    })
  })

  it('sends nothing when nothing changed', () => {
    expect(buildBulkRequest(initial, initial)).toEqual({})
  })

  it('sends the caller ID with the extension digits', () => {
    expect(
      buildBulkRequest(
        { ...initial, outboundcid: '0721405' },
        { ...initial, outboundcid: '0721405', outboundcidDigits: '2' },
      ),
    ).toEqual({ outboundcid_fixed: '0721405', outboundcid_variable: 2 })
  })
})

describe('validateAdvancedBulk', () => {
  it('accepts an empty form', () => {
    expect(validateAdvancedBulk(EMPTY_ADVANCED_BULK_FORM)).toEqual({})
  })

  it('checks the ring time and the caller ID', () => {
    expect(
      validateAdvancedBulk({
        ...EMPTY_ADVANCED_BULK_FORM,
        ringtime: '121',
        outboundcid: 'abc',
      }),
    ).toEqual({
      ringtime: 'users.bulk_ringtime_invalid',
      outboundcid: 'users.bulk_outboundcid_invalid',
    })
    expect(
      validateAdvancedBulk({ ...EMPTY_ADVANCED_BULK_FORM, outboundcid: '"Office" <0721405516>' }),
    ).toEqual({})
  })

  it('requires a numeric caller ID with the extension digits', () => {
    expect(validateAdvancedBulk({ ...EMPTY_ADVANCED_BULK_FORM, outboundcidDigits: '2' })).toEqual({
      outboundcid: 'users.bulk_outboundcid_required',
    })
    expect(
      validateAdvancedBulk({
        ...EMPTY_ADVANCED_BULK_FORM,
        outboundcid: '<0721405>',
        outboundcidDigits: '2',
      }),
    ).toEqual({ outboundcid: 'users.bulk_outboundcid_number_only' })
    expect(
      validateAdvancedBulk({
        ...EMPTY_ADVANCED_BULK_FORM,
        outboundcid: '0721405',
        outboundcidDigits: '0',
      }),
    ).toEqual({ outboundcidDigits: 'users.bulk_outboundcid_digits_invalid' })
  })
})

describe('bulk writes', () => {
  const miller = user('a.miller', '300', [device(1, 'webrtc', '300')])
  const davis = user('c.davis', '301', [device(3, 'nethlink', '301')])
  const jones = user('d.jones', '302')
  const nobody = user('e.brown', '')

  beforeEach(() => {
    vi.mocked(postVoicemail).mockReset().mockResolvedValue()
    vi.mocked(enableSoftwareDevice).mockReset().mockResolvedValue()
    vi.mocked(disableSoftwareDevice).mockReset().mockResolvedValue()
    vi.mocked(postUserProfile).mockReset().mockResolvedValue()
  })

  it('reports the progress of the voicemail and the users updated before a failure', async () => {
    const progress: number[] = []
    vi.mocked(postVoicemail).mockImplementation(async (extension) => {
      if (extension === '302') {
        throw new Error('boom')
      }
    })

    const error = await setVoicemailForUsers([miller, davis, jones], true, (value) =>
      progress.push(value),
    ).catch((caught: unknown) => caught)

    expect(progress).toEqual([33, 67])
    expect(error).toBeInstanceOf(BulkUserError)
    expect(error).toMatchObject({ username: 'd.jones', completed: ['a.miller', 'c.davis'] })
  })

  it('assigns the profile in one call for the users with an extension, then one by one', async () => {
    const progress: number[] = []

    await assignProfileToUsers([miller, nobody], 3, (value) => progress.push(value))

    expect(progress).toEqual([50, 100])
    expect(api.POST).toHaveBeenCalledWith('/bulk/{mainextensions}', {
      params: { path: { mainextensions: '300' } },
      body: { profile: 3 },
    })
    expect(postUserProfile).toHaveBeenCalledWith(nobody.id, 3)
  })

  it('lists the users whose devices were updated before a failure', async () => {
    vi.mocked(enableSoftwareDevice).mockImplementation(async (_, extension) => {
      if (extension === '301') {
        throw new Error('boom')
      }
    })
    const plans = planDevicesForUsers([miller, davis], ['mobile'])

    expect(getDisablingPlans(plans).map((plan) => plan.user.username)).toEqual([
      'a.miller',
      'c.davis',
    ])
    await expect(setDevicesForUsers(plans)).rejects.toMatchObject({
      username: 'c.davis',
      completed: ['a.miller'],
    })
  })
})
