//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { defineQuery, useQuery } from '@pinia/colada'
import { getWizardState, WIZARD_STATE_KEY } from '@/lib/setup/wizard'
import { useLoginStore } from '@/stores/login'

export const useWizardState = defineQuery(() => {
  const loginStore = useLoginStore()

  const { state, asyncStatus, ...rest } = useQuery({
    key: () => [WIZARD_STATE_KEY],
    enabled: () => loginStore.isAuthenticated,
    query: () => getWizardState(),
  })

  return { state, asyncStatus, ...rest }
})
