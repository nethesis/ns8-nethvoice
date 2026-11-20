//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { defineQuery, useQuery } from '@pinia/colada'
import { getGroups, GROUPS_KEY } from '@/lib/groups/groups'
import { useLoginStore } from '@/stores/login'

export const useGroups = defineQuery(() => {
  const loginStore = useLoginStore()

  const { state, asyncStatus, ...rest } = useQuery({
    key: () => [GROUPS_KEY],
    enabled: () => loginStore.isAuthenticated,
    query: () => getGroups(),
  })

  return { state, asyncStatus, ...rest }
})
