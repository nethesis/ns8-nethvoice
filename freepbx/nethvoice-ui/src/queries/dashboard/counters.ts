//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { useQuery } from '@pinia/colada'
import {
  DASHBOARD_COUNTER_KEY,
  DASHBOARD_COUNTERS_STALE_TIME,
  getDashboardCounter,
  type DashboardCounterId,
} from '@/lib/dashboard/counters'
import { useLoginStore } from '@/stores/login'

export const useDashboardCounter = (id: DashboardCounterId) => {
  const loginStore = useLoginStore()

  const { state, asyncStatus, ...rest } = useQuery({
    key: () => [DASHBOARD_COUNTER_KEY, id],
    enabled: () => loginStore.isAuthenticated,
    staleTime: DASHBOARD_COUNTERS_STALE_TIME,
    refetchOnWindowFocus: false,
    query: ({ signal }) => getDashboardCounter(id, signal),
  })

  return { state, asyncStatus, ...rest }
}
