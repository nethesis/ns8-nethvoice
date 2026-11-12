//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest'
import type { UserRow } from './directory'
import {
  areDefaultUserFilters,
  DEFAULT_USER_FILTERS,
  filterUserRows,
  sortUsers,
  type UserFilters,
} from './userFilters'

const row = (overrides: Partial<UserRow>): UserRow => ({
  id: 1,
  username: 'a.miller',
  displayName: 'Anna Miller',
  mainExtension: '300',
  profileId: 1,
  email: '',
  devices: [],
  groups: [],
  profileName: 'Base',
  voicemail: false,
  mobile: '',
  softwareDevices: [],
  physicalPhones: [],
  ...overrides,
})

const PHONE = {
  id: 9,
  type: 'physical' as const,
  extension: '91301',
  mac: '00:11:22:33:44:55',
  vendor: 'Acme',
  model: 'acme-T1',
  line: 1,
  registered: false,
}

const ROWS: UserRow[] = [
  row({ id: 1, groups: [{ id: 1, name: 'Marketing' }], softwareDevices: ['webrtc'] }),
  row({
    id: 2,
    username: 'c.davis',
    displayName: 'Christopher Davis',
    mainExtension: '301',
    profileId: 2,
    voicemail: true,
    groups: [{ id: 2, name: 'Backoffice' }],
    softwareDevices: ['webrtc', 'nethlink'],
    physicalPhones: [PHONE],
  }),
  row({
    id: 3,
    username: 'd.jones',
    displayName: 'Daniel Jones',
    mainExtension: '',
    profileId: null,
  }),
]

const usernames = (filters: Partial<UserFilters>) =>
  filterUserRows(ROWS, { ...DEFAULT_USER_FILTERS, ...filters }).map((item) => item.username)

describe('filterUserRows', () => {
  it('returns every user with the default filters', () => {
    expect(usernames({})).toEqual(['a.miller', 'c.davis', 'd.jones'])
    expect(areDefaultUserFilters(DEFAULT_USER_FILTERS)).toBe(true)
    expect(areDefaultUserFilters({ ...DEFAULT_USER_FILTERS, voicemail: 'enabled' })).toBe(false)
  })

  it('matches the text on name, username and extension', () => {
    expect(usernames({ text: 'christ' })).toEqual(['c.davis'])
    expect(usernames({ text: 'D.JON' })).toEqual(['d.jones'])
    expect(usernames({ text: '300' })).toEqual(['a.miller'])
  })

  it('filters by voicemail state', () => {
    expect(usernames({ voicemail: 'enabled' })).toEqual(['c.davis'])
    expect(usernames({ voicemail: 'disabled' })).toEqual(['a.miller', 'd.jones'])
  })

  it('filters by group, profile and device (any of the selected ones)', () => {
    expect(usernames({ groupIds: [1, 2] })).toEqual(['a.miller', 'c.davis'])
    expect(usernames({ profileIds: [2] })).toEqual(['c.davis'])
    expect(usernames({ devices: ['nethlink'] })).toEqual(['c.davis'])
    expect(usernames({ devices: ['webrtc', 'mobile'] })).toEqual(['a.miller', 'c.davis'])
  })

  it('filters by presence of physical phones', () => {
    expect(usernames({ physicalPhones: 'with' })).toEqual(['c.davis'])
    expect(usernames({ physicalPhones: 'without' })).toEqual(['a.miller', 'd.jones'])
  })

  it('combines the filters', () => {
    expect(usernames({ text: 'a', voicemail: 'disabled', groupIds: [1] })).toEqual(['a.miller'])
  })
})

describe('sortUsers', () => {
  it('sorts by name in both directions', () => {
    expect(sortUsers(ROWS, 'displayName', false).map((item) => item.id)).toEqual([1, 2, 3])
    expect(sortUsers(ROWS, 'displayName', true).map((item) => item.id)).toEqual([3, 2, 1])
  })

  it('sorts extensions naturally and keeps the users without extension last', () => {
    const rows = [...ROWS, row({ id: 4, username: 'e.johnson', mainExtension: '99' })]

    expect(sortUsers(rows, 'mainExtension', false).map((item) => item.id)).toEqual([4, 1, 2, 3])
    expect(sortUsers(rows, 'mainExtension', true).map((item) => item.id)).toEqual([2, 1, 4, 3])
  })

  it('does not change the given list', () => {
    const rows = [...ROWS].reverse()
    sortUsers(rows, 'username', false)
    expect(rows.map((item) => item.id)).toEqual([3, 2, 1])
  })
})
