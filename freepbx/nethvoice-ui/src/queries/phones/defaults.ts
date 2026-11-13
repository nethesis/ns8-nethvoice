//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { defineQuery, useQuery } from '@pinia/colada'
import { getPhoneDefaults, PHONE_DEFAULTS_KEY } from '@/lib/phones/defaults'
import { useLoginStore } from '@/stores/login'

export const usePhoneDefaults = defineQuery(() => {
  const loginStore = useLoginStore()

  const { state, asyncStatus, ...rest } = useQuery({
    key: () => [PHONE_DEFAULTS_KEY],
    enabled: () => loginStore.isAuthenticated,
    query: () => getPhoneDefaults(),
  })

  return { state, asyncStatus, ...rest }
})
