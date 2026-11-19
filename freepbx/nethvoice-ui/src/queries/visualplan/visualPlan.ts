//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { defineQuery, useQuery } from '@pinia/colada'
import { getVisualPlanData, VISUAL_PLAN_KEY } from '@/lib/visualplan/api'
import { useLoginStore } from '@/stores/login'

export const useVisualPlanData = defineQuery(() => {
  const loginStore = useLoginStore()

  const { state, asyncStatus, ...rest } = useQuery({
    key: () => [VISUAL_PLAN_KEY],
    enabled: () => loginStore.isAuthenticated,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    query: () => getVisualPlanData(),
  })

  return { state, asyncStatus, ...rest }
})
