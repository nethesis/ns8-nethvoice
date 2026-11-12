//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest'
import {
  buildOverviewUsers,
  filterOverviewUsers,
  formatPhoneModel,
  getInitials,
  parseOverviewEndpointUsers,
  parseOverviewExtensions,
  sortOverviewUsers,
  toOverviewStatus,
  type OverviewUser,
} from './overview'
import type { User } from '@/lib/users/users'

const extensionsResponse = {
  '300': { status: 'online', dnd: false, cf: '', codecs: ['opus', 'alaw'], name: 'Anna Miller' },
  '91300': { status: 'online', dnd: true, cf: '', codecs: [] },
  '92300': { status: 'busy_ringing', dnd: false, cf: '0612345678' },
  '301': { status: 'offline', dnd: false, cf: null, codecs: null },
}

const endpointsResponse = {
  'a.miller': {
    name: 'Anna Miller',
    username: 'a.miller',
    mainPresence: 'busy',
    endpoints: {
      mainextension: [{ id: '300' }],
      extension: [
        { id: '93300', type: 'physical' },
        { id: '300', type: 'webrtc' },
        { id: '92300', type: 'mobile' },
        { id: '91300', type: 'nethlink' },
      ],
    },
  },
  'b.lee': {
    name: 'Bruce Lee',
    username: 'b.lee',
    mainPresence: 'online',
    endpoints: { mainextension: [{ id: '301' }], extension: [{ id: '301', type: 'webrtc' }] },
  },
  'no.ext': {
    name: '',
    username: 'no.ext',
    mainPresence: 'offline',
    endpoints: { mainextension: [], extension: [] },
  },
}

const users: User[] = [
  {
    id: 2,
    username: 'a.miller',
    displayName: 'Anna Miller',
    mainExtension: '300',
    profileId: 3,
    email: '',
    devices: [
      {
        id: 9,
        type: 'physical',
        extension: '93300',
        mac: '',
        vendor: 'Fanvil',
        model: 'fanvil-X4U',
        line: 1,
        registered: false,
      },
    ],
  },
]

const liveState = {
  extensions: parseOverviewExtensions(extensionsResponse),
  users: parseOverviewEndpointUsers(endpointsResponse),
}

const overviewUsers = buildOverviewUsers(liveState, users, [
  { id: 1, name: 'Sales', userIds: [2] },
  { id: 2, name: 'Support', userIds: [] },
])

describe('toOverviewStatus', () => {
  it('should map astproxy and presence values', () => {
    expect(toOverviewStatus('online')).toBe('online')
    expect(toOverviewStatus('callforward')).toBe('online')
    expect(toOverviewStatus('onhold')).toBe('busy')
    expect(toOverviewStatus('busy_ringing')).toBe('ringing')
    expect(toOverviewStatus('DND')).toBe('dnd')
    expect(toOverviewStatus('')).toBe('offline')
  })
})

describe('parseOverviewExtensions', () => {
  it('should show DND on an idle extension that has it enabled', () => {
    expect(liveState.extensions['91300'].status).toBe('dnd')
    expect(liveState.extensions['91300'].doNotDisturb).toBe(true)
  })

  it('should default missing values', () => {
    expect(liveState.extensions['301']).toEqual({
      status: 'offline',
      doNotDisturb: false,
      callForward: '',
      codecs: [],
    })
  })
})

describe('parseOverviewEndpointUsers', () => {
  it('should fall back to the username', () => {
    expect(liveState.users.find((user) => user.username === 'no.ext')?.name).toBe('no.ext')
  })
})

describe('buildOverviewUsers', () => {
  it('should skip users without a main extension', () => {
    expect(overviewUsers.map((user) => user.username)).toEqual(['a.miller', 'b.lee'])
  })

  it('should order the devices and attach their live state', () => {
    const [anna] = overviewUsers

    expect(anna.groups).toEqual(['Sales'])
    expect(anna.presence).toBe('busy')
    expect(anna.devices.map((device) => [device.type, device.extension, device.status])).toEqual([
      ['webrtc', '300', 'online'],
      ['nethlink', '91300', 'dnd'],
      ['mobile', '92300', 'ringing'],
      ['physical', '93300', 'offline'],
    ])
    expect(anna.devices[3].model).toBe('Fanvil X4U')
    expect(anna.devices[2].callForward).toBe('0612345678')
  })

  it('should leave the groups empty for users unknown to the PBX list', () => {
    expect(overviewUsers[1].groups).toEqual([])
  })
})

describe('formatPhoneModel', () => {
  it('should avoid repeating the vendor', () => {
    expect(formatPhoneModel('Fanvil', 'fanvil-X4U')).toBe('Fanvil X4U')
    expect(formatPhoneModel('Yealink', 'T54W')).toBe('Yealink T54W')
    expect(formatPhoneModel('', 'X4U')).toBe('X4U')
  })
})

describe('filterOverviewUsers', () => {
  const filter = (text: string, statuses: OverviewUser['presence'][], groups: string[] = []) =>
    filterOverviewUsers(overviewUsers, { text, statuses, groups }).map((user) => user.username)

  it('should match name, username and extensions', () => {
    expect(filter('bruce', [])).toEqual(['b.lee'])
    expect(filter('92300', [])).toEqual(['a.miller'])
  })

  it('should filter by presence and group', () => {
    expect(filter('', ['online'])).toEqual(['b.lee'])
    expect(filter('', [], ['Sales'])).toEqual(['a.miller'])
    expect(filter('', [], ['Support'])).toEqual([])
  })
})

describe('sortOverviewUsers', () => {
  it('should sort by name, extension or status in both directions', () => {
    const sorted = (key: 'name' | 'extension' | 'status', descending = false) =>
      sortOverviewUsers(overviewUsers, key, descending).map((user) => user.username)

    expect(sorted('name')).toEqual(['a.miller', 'b.lee'])
    expect(sorted('name', true)).toEqual(['b.lee', 'a.miller'])
    expect(sorted('extension', true)).toEqual(['b.lee', 'a.miller'])
    expect(sorted('status')).toEqual(['b.lee', 'a.miller'])
  })
})

describe('getInitials', () => {
  it('should use the first two words', () => {
    expect(getInitials('anna maria miller')).toBe('AM')
    expect(getInitials('  Bruce ')).toBe('B')
  })
})
