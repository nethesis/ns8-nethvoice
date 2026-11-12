//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { defineQuery, useQuery, useQueryCache } from '@pinia/colada'
import { GROUPS_KEY } from '@/lib/groups/groups'
import { PROFILES_KEY, USER_LIMITS_KEY as PROFILES_USER_LIMITS_KEY } from '@/lib/profiles/profiles'
import { USERS_DIRECTORY_KEY } from '@/lib/users/directory'
import { USER_LIMITS_KEY } from '@/lib/users/extensions'
import { getUsers, USERS_KEY } from '@/lib/users/users'
import { useLoginStore } from '@/stores/login'

export const useUsers = defineQuery(() => {
  const loginStore = useLoginStore()

  const { state, asyncStatus, ...rest } = useQuery({
    key: () => [USERS_KEY],
    enabled: () => loginStore.isAuthenticated,
    query: () => getUsers(),
  })

  return { state, asyncStatus, ...rest }
})

export const USERS_RELATED_KEYS = [
  USERS_KEY,
  USERS_DIRECTORY_KEY,
  USER_LIMITS_KEY,
  GROUPS_KEY,
  PROFILES_KEY,
  PROFILES_USER_LIMITS_KEY,
]

export function useInvalidateUsers() {
  const queryCache = useQueryCache()

  return () =>
    Promise.all(USERS_RELATED_KEYS.map((key) => queryCache.invalidateQueries({ key: [key] })))
}
