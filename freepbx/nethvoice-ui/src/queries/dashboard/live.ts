//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { defineQuery, useQuery } from '@pinia/colada'
import { DASHBOARD_LIVE_KEY, getDashboardLive } from '@/lib/dashboard/live'
import { useLoginStore } from '@/stores/login'

export const useDashboardLive = defineQuery(() => {
  const loginStore = useLoginStore()

  const { state, asyncStatus, ...rest } = useQuery({
    key: () => [DASHBOARD_LIVE_KEY],
    enabled: () => loginStore.isAuthenticated,
    query: () => getDashboardLive(),
  })

  return { state, asyncStatus, ...rest }
})
