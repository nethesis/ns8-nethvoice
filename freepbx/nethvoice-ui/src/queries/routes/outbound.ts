//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { defineQuery, useQuery } from '@pinia/colada'
import {
  getOutboundRouteDefaults,
  getOutboundRoutes,
  OUTBOUND_ROUTE_DEFAULTS_KEY,
  OUTBOUND_ROUTES_KEY,
} from '@/lib/routes/outbound'
import { useLoginStore } from '@/stores/login'

export const useOutboundRoutes = defineQuery(() => {
  const loginStore = useLoginStore()

  const { state, asyncStatus, ...rest } = useQuery({
    key: () => [OUTBOUND_ROUTES_KEY],
    enabled: () => loginStore.isAuthenticated,
    refetchOnWindowFocus: 'always',
    query: () => getOutboundRoutes(),
  })

  return { state, asyncStatus, ...rest }
})

export const useOutboundRouteDefaults = defineQuery(() => {
  const loginStore = useLoginStore()

  const { state, asyncStatus, ...rest } = useQuery({
    key: () => [OUTBOUND_ROUTE_DEFAULTS_KEY],
    enabled: () => loginStore.isAuthenticated,
    query: () => getOutboundRouteDefaults(),
  })

  return { state, asyncStatus, ...rest }
})
