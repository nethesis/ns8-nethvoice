//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { defineQuery, useQuery } from '@pinia/colada'
import { getPhoneModels, PHONE_MODELS_KEY } from '@/lib/phones/models'
import { useLoginStore } from '@/stores/login'

export const usePhoneModels = defineQuery(() => {
  const loginStore = useLoginStore()

  const { state, asyncStatus, ...rest } = useQuery({
    key: () => [PHONE_MODELS_KEY],
    enabled: () => loginStore.isAuthenticated,
    query: () => getPhoneModels(),
  })

  return { state, asyncStatus, ...rest }
})
