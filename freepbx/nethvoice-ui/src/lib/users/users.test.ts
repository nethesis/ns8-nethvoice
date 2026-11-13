//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest'
import {
  countConfiguredUsers,
  findDevice,
  findUserByExtension,
  findUserByUsername,
  getPhysicalPhones,
  getSoftwareDeviceTypes,
  hasMainExtension,
  parseUsers,
} from './users'

const RAW_USERS = [
  {
    id: '5',
    username: 'a.miller',
    displayname: 'Anna Miller',
    default_extension: '300',
    email: 'anna.miller@example.com',
    password: 'not-kept',
    profile: 3,
    devices: [
      {
        id: 1,
        type: 'webrtc',
        extension: '300',
        mac: null,
        model: null,
        line: null,
        registered: true,
      },
      { id: 2, type: 'mobile', extension: '91300', mac: null, line: 1, registered: false },
      {
        id: 3,
        type: 'physical',
        extension: '92300',
        mac: '00:11:22:33:44:55',
        vendor: 'Acme',
        model: 'acme-T1',
        line: '1',
        secret: 'not-kept',
        registered: false,
      },
      { id: 4, type: 'gswave', extension: '93300' },
    ],
  },
  {
    id: 6,
    username: 'c.davis',
    displayname: '',
    default_extension: 'none',
    profile: null,
  },
]

describe('parseUsers', () => {
  const users = parseUsers(RAW_USERS)

  it('normalizes ids, names and the main extension', () => {
    expect(users[0]).toMatchObject({
      id: 5,
      username: 'a.miller',
      displayName: 'Anna Miller',
      mainExtension: '300',
      profileId: 3,
      email: 'anna.miller@example.com',
    })
    expect(users[1]).toMatchObject({
      id: 6,
      displayName: 'c.davis',
      mainExtension: '',
      profileId: null,
      email: '',
      devices: [],
    })
  })

  it('maps the devices and drops the secrets', () => {
    expect(users[0].devices).toEqual([
      {
        id: 1,
        type: 'webrtc',
        extension: '300',
        mac: '',
        vendor: '',
        model: '',
        line: null,
        registered: true,
      },
      {
        id: 2,
        type: 'mobile',
        extension: '91300',
        mac: '',
        vendor: '',
        model: '',
        line: 1,
        registered: false,
      },
      {
        id: 3,
        type: 'physical',
        extension: '92300',
        mac: '00:11:22:33:44:55',
        vendor: 'Acme',
        model: 'acme-T1',
        line: 1,
        registered: false,
      },
      {
        id: 4,
        type: 'other',
        extension: '93300',
        mac: '',
        vendor: '',
        model: '',
        line: null,
        registered: false,
      },
    ])
    expect(JSON.stringify(users)).not.toContain('not-kept')
  })

  it('rejects a response that is not a list of users', () => {
    expect(() => parseUsers({ error: 'boom' })).toThrow()
    expect(() => parseUsers([{ id: 'x', username: 'a' }])).toThrow()
  })
})

describe('user helpers', () => {
  const [anna, christopher] = parseUsers(RAW_USERS)

  it('tells who has a main extension', () => {
    expect(hasMainExtension(anna)).toBe(true)
    expect(hasMainExtension(christopher)).toBe(false)
    expect(countConfiguredUsers([anna, christopher])).toBe(1)
  })

  it('finds devices by type', () => {
    expect(findDevice(anna, 'mobile')?.extension).toBe('91300')
    expect(findDevice(christopher, 'webrtc')).toBeUndefined()
    expect(getSoftwareDeviceTypes(anna)).toEqual(['webrtc', 'mobile'])
    expect(getPhysicalPhones(anna).map((phone) => phone.model)).toEqual(['acme-T1'])
  })

  it('finds users by username and extension', () => {
    expect(findUserByUsername([anna, christopher], ' A.Miller ')).toBe(anna)
    expect(findUserByUsername([anna], 'nobody')).toBeUndefined()
    expect(findUserByExtension([anna, christopher], '300')).toBe(anna)
    expect(findUserByExtension([anna, christopher], '')).toBeUndefined()
  })
})
