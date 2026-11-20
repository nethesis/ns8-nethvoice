//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { defineQuery, useQuery, useQueryCache } from '@pinia/colada'
import {
  getUserAccounts,
  getUsersDomain,
  USER_ACCOUNTS_KEY,
  USERS_DOMAIN_KEY,
} from '@/lib/users/accounts'
import { ORPHAN_EXTENSIONS_KEY } from '@/lib/users/orphans'
import { useLoginStore } from '@/stores/login'

export const useUsersDomain = defineQuery(() => {
  const loginStore = useLoginStore()

  const { state, asyncStatus, ...rest } = useQuery({
    key: () => [USERS_DOMAIN_KEY],
    enabled: () => loginStore.isAuthenticated,
    query: () => getUsersDomain(),
  })

  return { state, asyncStatus, ...rest }
})

export const useUserAccounts = defineQuery(() => {
  const loginStore = useLoginStore()
  const domainQuery = useUsersDomain()

  const { state, asyncStatus, ...rest } = useQuery({
    key: () => [USER_ACCOUNTS_KEY],
    enabled: () => loginStore.isAuthenticated && domainQuery.state.value.data?.manageable === true,
    query: () => getUserAccounts(),
  })

  return { state, asyncStatus, ...rest }
})

export function useInvalidateAccounts() {
  const queryCache = useQueryCache()

  return () =>
    Promise.all(
      [USER_ACCOUNTS_KEY, ORPHAN_EXTENSIONS_KEY].map((key) =>
        queryCache.invalidateQueries({ key: [key] }),
      ),
    )
}
