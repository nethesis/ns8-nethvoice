//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest'
import { getFxsUserOptions, parseFxsUsers } from './fxsUsers'

const rawUsers = [
  { id: '2', username: 'c.davis', displayname: 'c.davis', default_extension: '301' },
  { id: '1', username: 'a.miller', displayname: 'Anna Miller', default_extension: 300 },
  { id: '3', username: 'guest', displayname: 'Guest', default_extension: 'none' },
  { id: '4', username: 'nobody', displayname: null, default_extension: null },
]

describe('parseFxsUsers', () => {
  it('should keep only the users that have an extension, sorted by username', () => {
    expect(parseFxsUsers(rawUsers)).toEqual([
      { extension: '300', label: 'a.miller (300)', description: 'Anna Miller' },
      { extension: '301', label: 'c.davis (301)', description: '' },
    ])
  })

  it('should reject an unexpected shape', () => {
    expect(() => parseFxsUsers({ username: 'a.miller' })).toThrow()
  })
})

describe('getFxsUserOptions', () => {
  const users = parseFxsUsers(rawUsers)

  it('should add the extensions already assigned that have no user anymore', () => {
    expect(getFxsUserOptions(users, ['300', '', '305', '305']).map((user) => user.label)).toEqual([
      'a.miller (300)',
      'c.davis (301)',
      '305',
    ])
  })

  it('should return the users when nothing is assigned', () => {
    expect(getFxsUserOptions(users, [])).toEqual(users)
  })
})
