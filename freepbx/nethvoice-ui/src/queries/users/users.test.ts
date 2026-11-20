//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest'
import { GROUPS_KEY } from '@/lib/groups/groups'
import { PROFILES_KEY } from '@/lib/profiles/profiles'
import { USERS_DIRECTORY_KEY } from '@/lib/users/directory'
import { USERS_RELATED_KEYS } from './users'

describe('USERS_RELATED_KEYS', () => {
  it('marks the groups and the profiles stale before the users directory reads them', () => {
    const directoryIndex = USERS_RELATED_KEYS.indexOf(USERS_DIRECTORY_KEY)

    expect(USERS_RELATED_KEYS.indexOf(GROUPS_KEY)).toBeLessThan(directoryIndex)
    expect(USERS_RELATED_KEYS.indexOf(PROFILES_KEY)).toBeLessThan(directoryIndex)
  })
})
