//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { defineQuery, useQuery, useQueryCache } from '@pinia/colada'
import { ADMINS_KEY, getAdminControl } from '@/lib/admins/admins'
import { USER_ACCOUNTS_KEY } from '@/lib/users/accounts'
import { usePermissions } from '@/queries/permissions/me'
import { useLoginStore } from '@/stores/login'

export const useAdminControl = defineQuery(() => {
  const loginStore = useLoginStore()
  const { isSuperadmin } = usePermissions()

  const { state, asyncStatus, ...rest } = useQuery({
    key: () => [ADMINS_KEY],
    enabled: () => loginStore.isAuthenticated && isSuperadmin.value,
    query: () => getAdminControl(),
  })

  return { state, asyncStatus, ...rest }
})

export function useInvalidateAdmins() {
  const queryCache = useQueryCache()

  return () =>
    Promise.all(
      [ADMINS_KEY, USER_ACCOUNTS_KEY].map((key) => queryCache.invalidateQueries({ key: [key] })),
    )
}
