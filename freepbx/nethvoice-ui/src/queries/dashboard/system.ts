//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { useQuery } from '@pinia/colada'
import { DASHBOARD_COUNTERS_STALE_TIME } from '@/lib/dashboard/counters'
import { DASHBOARD_SYSTEM_KEY, getDashboardSystem } from '@/lib/dashboard/system'
import { useLoginStore } from '@/stores/login'

export const useDashboardSystem = () => {
  const loginStore = useLoginStore()

  return useQuery({
    key: () => [DASHBOARD_SYSTEM_KEY],
    enabled: () => loginStore.isAuthenticated,
    staleTime: DASHBOARD_COUNTERS_STALE_TIME,
    refetchOnWindowFocus: false,
    query: ({ signal }) => getDashboardSystem(signal),
  })
}
