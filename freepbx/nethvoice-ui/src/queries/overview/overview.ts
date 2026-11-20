//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { defineQuery, useQuery } from '@pinia/colada'
import { getOverviewLiveState, OVERVIEW_LIVE_KEY } from '@/lib/overview/overview'
import { usePermissions } from '@/queries/permissions/me'
import { useLoginStore } from '@/stores/login'

export const useOverviewLiveState = defineQuery(() => {
  const loginStore = useLoginStore()
  const { can } = usePermissions()

  const { state, asyncStatus, ...rest } = useQuery({
    key: () => [OVERVIEW_LIVE_KEY],
    enabled: () => loginStore.isAuthenticated && can('users'),
    query: () => getOverviewLiveState(),
  })

  return { state, asyncStatus, ...rest }
})
