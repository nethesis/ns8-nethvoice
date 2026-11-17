//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { useQuery } from '@pinia/colada'
import { DASHBOARD_PHONES_KEY, getDashboardPhones } from '@/lib/dashboard/phones'
import { DASHBOARD_COUNTERS_STALE_TIME } from '@/lib/dashboard/counters'
import { useLoginStore } from '@/stores/login'

export const useDashboardPhones = (enabled: () => boolean) => {
  const loginStore = useLoginStore()

  return useQuery({
    key: () => [DASHBOARD_PHONES_KEY],
    enabled: () => loginStore.isAuthenticated && enabled(),
    staleTime: DASHBOARD_COUNTERS_STALE_TIME,
    refetchOnWindowFocus: false,
    query: ({ signal }) => getDashboardPhones(signal),
  })
}
