//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { computed } from 'vue'
import { defineQuery, useQuery } from '@pinia/colada'
import {
  canAccess,
  getMe,
  isSuperadmin,
  ME_KEY,
  type Permission,
} from '@/lib/permissions/permissions'
import { useLoginStore } from '@/stores/login'

export const useMe = defineQuery(() => {
  const loginStore = useLoginStore()

  const { state, asyncStatus, ...rest } = useQuery({
    key: () => [ME_KEY, loginStore.username],
    enabled: () => loginStore.isAuthenticated,
    query: ({ signal }) => getMe(signal),
    staleTime: Number.POSITIVE_INFINITY,
    refetchOnWindowFocus: false,
  })

  return { state, asyncStatus, ...rest }
})

export const usePermissions = () => {
  const { state } = useMe()
  const permissions = computed<Permission[]>(() => state.value.data?.permissions ?? [])

  return {
    permissions,
    isSuperadmin: computed(() => isSuperadmin(permissions.value)),
    can: (permission: Permission) => canAccess(permissions.value, permission),
  }
}

export const loadPermissions = async (): Promise<Permission[] | undefined> => {
  const { refresh } = useMe()
  const state = await refresh()
  return state.data?.permissions
}
