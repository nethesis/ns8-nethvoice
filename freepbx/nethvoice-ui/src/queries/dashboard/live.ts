//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { useQuery } from '@pinia/colada'
import {
  DASHBOARD_LIVE_KEY,
  getLiveExtensions,
  getLiveTrunks,
  getLiveUsers,
  type LiveSnapshot,
} from '@/lib/dashboard/live'
import { useLoginStore } from '@/stores/login'

const useDashboardLiveSource = <TData>(
  source: string,
  load: (signal: AbortSignal) => Promise<LiveSnapshot<TData>>,
) => {
  const loginStore = useLoginStore()

  const { state, asyncStatus, ...rest } = useQuery({
    key: () => [DASHBOARD_LIVE_KEY, source],
    enabled: () => loginStore.isAuthenticated,
    refetchOnWindowFocus: false,
    query: ({ signal }) => load(signal),
  })

  return { state, asyncStatus, ...rest }
}

export const useDashboardLiveExtensions = () =>
  useDashboardLiveSource('extensions', getLiveExtensions)

export const useDashboardLiveTrunks = () => useDashboardLiveSource('trunks', getLiveTrunks)

export const useDashboardLiveUsers = () => useDashboardLiveSource('users', getLiveUsers)
