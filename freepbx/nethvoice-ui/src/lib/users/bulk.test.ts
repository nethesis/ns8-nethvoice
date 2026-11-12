//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest'
import {
  buildBulkRequest,
  DEFAULT_DESTINATION,
  EMPTY_ADVANCED_BULK_FORM,
  exceedsDeviceLimit,
  parseBulkSettings,
  parseDestinations,
  planDevicesForUsers,
  validateAdvancedBulk,
} from './bulk'
import type { User, UserDevice } from './users'

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
