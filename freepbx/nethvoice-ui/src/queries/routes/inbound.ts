//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { defineQuery, useQuery } from '@pinia/colada'
import { getInboundRoutes, INBOUND_ROUTES_KEY } from '@/lib/routes/inbound'
import { useLoginStore } from '@/stores/login'

export const useInboundRoutes = defineQuery(() => {
  const loginStore = useLoginStore()

  const { state, asyncStatus, ...rest } = useQuery({
    key: () => [INBOUND_ROUTES_KEY],
    enabled: () => loginStore.isAuthenticated,
    refetchOnWindowFocus: 'always',
    query: () => getInboundRoutes(),
  })

  return { state, asyncStatus, ...rest }
})
