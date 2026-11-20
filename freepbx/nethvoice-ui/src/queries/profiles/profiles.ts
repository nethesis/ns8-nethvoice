//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { defineQuery, useQuery } from '@pinia/colada'
import {
  getProfiles,
  getSubscriptionActive,
  PROFILES_KEY,
  USER_LIMITS_KEY,
} from '@/lib/profiles/profiles'
import { useLoginStore } from '@/stores/login'

export const useProfiles = defineQuery(() => {
  const loginStore = useLoginStore()

  const { state, asyncStatus, ...rest } = useQuery({
    key: () => [PROFILES_KEY],
    enabled: () => loginStore.isAuthenticated,
    query: () => getProfiles(),
  })

  return { state, asyncStatus, ...rest }
})

export const useSubscriptionActive = defineQuery(() => {
  const loginStore = useLoginStore()

  const { state, asyncStatus, ...rest } = useQuery({
    key: () => [USER_LIMITS_KEY],
    enabled: () => loginStore.isAuthenticated,
    query: () => getSubscriptionActive(),
  })

  return { state, asyncStatus, ...rest }
})
