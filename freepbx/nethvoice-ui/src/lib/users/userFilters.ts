//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { compareNatural, matchesText } from '@/lib/common'
import type { UserRow } from '@/lib/users/directory'
import type { SoftwareDeviceType } from '@/lib/users/users'

export type VoicemailFilter = 'any' | 'enabled' | 'disabled'

export type PhysicalPhonesFilter = 'any' | 'with' | 'without'

export type UserSortKey = 'displayName' | 'username' | 'mainExtension'

export type UserFilters = {
  text: string
  voicemail: VoicemailFilter
  groupIds: number[]
  profileIds: number[]
  devices: SoftwareDeviceType[]
  physicalPhones: PhysicalPhonesFilter
}

export const DEFAULT_USER_FILTERS: UserFilters = {
  text: '',
  voicemail: 'any',
  groupIds: [],
  profileIds: [],
  devices: [],
  physicalPhones: 'any',
}

export const areDefaultUserFilters = (filters: UserFilters): boolean =>
  filters.text.trim() === '' &&
  filters.voicemail === 'any' &&
  filters.groupIds.length === 0 &&
  filters.profileIds.length === 0 &&
  filters.devices.length === 0 &&
  filters.physicalPhones === 'any'

export const filterUserRows = (rows: UserRow[], filters: UserFilters): UserRow[] =>
  rows.filter((row) => {
    if (!matchesText(filters.text, row.displayName, row.username, row.mainExtension)) {
      return false
    }

    if (filters.voicemail !== 'any' && row.voicemail !== (filters.voicemail === 'enabled')) {
      return false
    }

    if (
      filters.groupIds.length > 0 &&
      !row.groups.some((group) => filters.groupIds.includes(group.id))
    ) {
      return false
    }

    if (
      filters.profileIds.length > 0 &&
      (row.profileId === null || !filters.profileIds.includes(row.profileId))
    ) {
      return false
    }

    if (
      filters.devices.length > 0 &&
      !filters.devices.some((device) => row.softwareDevices.includes(device))
    ) {
      return false
    }

    if (
      filters.physicalPhones !== 'any' &&
      row.physicalPhones.length > 0 !== (filters.physicalPhones === 'with')
    ) {
      return false
    }
    return true
  })

const compareEmptyLast = (a: string, b: string, descending: boolean): number => {
  if (a === '' || b === '') {
    return a === b ? 0 : a === '' ? 1 : -1
  }
  return descending ? compareNatural(b, a) : compareNatural(a, b)
}

export const sortUsers = <
  T extends { displayName: string; username: string; mainExtension: string },
>(
  users: T[],
  sortKey: UserSortKey,
  descending: boolean,
): T[] =>
  [...users].sort(
    (a, b) =>
      compareEmptyLast(a[sortKey], b[sortKey], descending) ||
      compareNatural(a.username, b.username),
  )
