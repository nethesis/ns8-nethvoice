//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { defineQuery, useQuery } from '@pinia/colada'
import { getParameterizedUrls, PARAMETERIZED_URLS_KEY } from '@/lib/integrations/parameterizedUrls'
import { useLoginStore } from '@/stores/login'

export const useParameterizedUrls = defineQuery(() => {
  const loginStore = useLoginStore()

  const { state, asyncStatus, ...rest } = useQuery({
    key: () => [PARAMETERIZED_URLS_KEY],
    enabled: () => loginStore.isAuthenticated,
    query: () => getParameterizedUrls(),
  })

  return { state, asyncStatus, ...rest }
})
