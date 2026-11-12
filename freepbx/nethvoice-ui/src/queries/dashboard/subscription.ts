//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { defineQuery, useQuery } from '@pinia/colada'
import { DASHBOARD_SUBSCRIPTION_KEY, getDashboardSubscription } from '@/lib/dashboard/subscription'
import { useLoginStore } from '@/stores/login'

export const useDashboardSubscription = defineQuery(() => {
  const loginStore = useLoginStore()

  const { state, asyncStatus, ...rest } = useQuery({
    key: () => [DASHBOARD_SUBSCRIPTION_KEY],
    enabled: () => loginStore.isAuthenticated,
    query: () => getDashboardSubscription(),
  })

  return { state, asyncStatus, ...rest }
})
