//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest'
import {
  buildUserRows,
  findBaseProfile,
  parseMobiles,
  parseVoicemailExtensions,
  type UsersDirectory,
} from './directory'
import { parseUsers } from './users'

const USERS = parseUsers([
  {
    id: 5,
    username: 'a.miller',
    displayname: 'Anna Miller',
    default_extension: '300',
    profile: 2,
    devices: [
      { id: 1, type: 'webrtc', extension: '300' },
      { id: 2, type: 'physical', extension: '91300', mac: '00:11:22:33:44:55' },
    ],
  },
  { id: 6, username: 'c.davis', displayname: 'Christopher Davis', default_extension: 'none' },
])

const DIRECTORY: UsersDirectory = {
  groups: [
    { id: 1, name: 'Marketing', userIds: [5] },
    { id: 2, name: 'Backoffice', userIds: [5, 6] },
  ],
  profiles: [
    { id: 2, name: 'Standard' },
    { id: 1, name: 'Base' },
  ],
  voicemailExtensions: ['300'],
  mobiles: { 'a.miller': '3331234567' },
}

describe('directory parsers', () => {
  it('reads the voicemail extensions from an object or an empty array', () => {
    expect(parseVoicemailExtensions([])).toEqual([])
    expect(parseVoicemailExtensions({ '300': { name: 'Anna Miller' }, '301': {} })).toEqual([
      '300',
      '301',
    ])
  })

  it('keeps only the users that have a mobile number', () => {
    expect(
      parseMobiles([
        { username: 'a.miller', mobile: '3331234567' },
        { username: 'c.davis', mobile: null },
        { username: 'd.jones', mobile: '' },
      ]),
    ).toEqual({ 'a.miller': '3331234567' })
  })
})

describe('buildUserRows', () => {
  const [anna, christopher] = buildUserRows(USERS, DIRECTORY)

  it('joins groups, profile, voicemail, mobile and devices', () => {
    expect(anna).toMatchObject({
      username: 'a.miller',
      groups: [
        { id: 1, name: 'Marketing' },
        { id: 2, name: 'Backoffice' },
      ],
      profileName: 'Standard',
      voicemail: true,
      mobile: '3331234567',
      softwareDevices: ['webrtc'],
    })
    expect(anna.physicalPhones).toHaveLength(1)
  })

  it('leaves a user without extension unconfigured', () => {
    expect(christopher).toMatchObject({
      groups: [{ id: 2, name: 'Backoffice' }],
      profileName: '',
      voicemail: false,
      mobile: '',
      softwareDevices: [],
      physicalPhones: [],
    })
  })
})

describe('findBaseProfile', () => {
  it('prefers the profile named Base', () => {
    expect(findBaseProfile(DIRECTORY.profiles)).toEqual({ id: 1, name: 'Base' })
  })

  it('falls back to the first profile by id', () => {
    expect(
      findBaseProfile([
        { id: 7, name: 'Custom' },
        { id: 4, name: 'Sales' },
      ]),
    ).toEqual({ id: 4, name: 'Sales' })
    expect(findBaseProfile([])).toBeUndefined()
  })
})
