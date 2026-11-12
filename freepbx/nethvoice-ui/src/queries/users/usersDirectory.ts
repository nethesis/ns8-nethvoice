//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { defineQuery, useQuery, useQueryCache, type UseQueryOptions } from '@pinia/colada'
import { getGroups, GROUPS_KEY } from '@/lib/groups/groups'
import { getProfiles, PROFILES_KEY } from '@/lib/profiles/profiles'
import { getUsersDirectory, USERS_DIRECTORY_KEY } from '@/lib/users/directory'
import { useLoginStore } from '@/stores/login'

export const useUsersDirectory = defineQuery(() => {
  const loginStore = useLoginStore()
  const queryCache = useQueryCache()

  const loadShared = async <T>(options: UseQueryOptions<T>): Promise<T> => {
    const state = await queryCache.refresh(queryCache.ensure(options))

    if (state.status !== 'success') {
      throw state.error
    }
    return state.data
  }

  const { state, asyncStatus, ...rest } = useQuery({
    key: () => [USERS_DIRECTORY_KEY],
    enabled: () => loginStore.isAuthenticated,
    query: () =>
      getUsersDirectory({
        groups: () => loadShared({ key: [GROUPS_KEY], query: getGroups }),
        profiles: () => loadShared({ key: [PROFILES_KEY], query: getProfiles }),
      }),
  })

  return { state, asyncStatus, ...rest }
})
