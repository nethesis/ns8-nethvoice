//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { defineQuery, useQuery } from '@pinia/colada'
import { getUserLimits, USER_LIMITS_KEY } from '@/lib/users/extensions'
import { useLoginStore } from '@/stores/login'

export const useUserLimits = defineQuery(() => {
  const loginStore = useLoginStore()

  const { state, asyncStatus, ...rest } = useQuery({
    key: () => [USER_LIMITS_KEY],
    enabled: () => loginStore.isAuthenticated,
    query: () => getUserLimits(),
  })

  return { state, asyncStatus, ...rest }
})
