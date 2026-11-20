//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { defineQuery, useQuery } from '@pinia/colada'
import { getOrphanExtensions, ORPHAN_EXTENSIONS_KEY } from '@/lib/users/orphans'
import { useLoginStore } from '@/stores/login'

export const useOrphanExtensions = defineQuery(() => {
  const loginStore = useLoginStore()

  const { state, asyncStatus, ...rest } = useQuery({
    key: () => [ORPHAN_EXTENSIONS_KEY],
    enabled: () => loginStore.isAuthenticated,
    query: () => getOrphanExtensions(),
  })

  return { state, asyncStatus, ...rest }
})
