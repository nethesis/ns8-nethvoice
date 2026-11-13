//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { defineQuery, useQuery } from '@pinia/colada'
import { getPhoneRegistrations, PHONE_REGISTRATIONS_KEY } from '@/lib/phones/registration'
import { useLoginStore } from '@/stores/login'

export const usePhoneRegistrations = defineQuery(() => {
  const loginStore = useLoginStore()

  const { state, asyncStatus, ...rest } = useQuery({
    key: () => [PHONE_REGISTRATIONS_KEY],
    enabled: () => loginStore.isAuthenticated,
    refetchOnWindowFocus: false,
    query: ({ signal }) => getPhoneRegistrations(signal),
  })

  return { state, asyncStatus, ...rest }
})
