//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { useQuery } from '@pinia/colada'
import {
  DASHBOARD_COUNTER_KEY,
  getDashboardCounter,
  type DashboardCounterId,
} from '@/lib/dashboard/counters'
import { useLoginStore } from '@/stores/login'

export const useDashboardCounter = (id: DashboardCounterId) => {
  const loginStore = useLoginStore()

  const { state, asyncStatus, ...rest } = useQuery({
    key: () => [DASHBOARD_COUNTER_KEY, id],
    enabled: () => loginStore.isAuthenticated,
    query: () => getDashboardCounter(id),
  })

  return { state, asyncStatus, ...rest }
}
