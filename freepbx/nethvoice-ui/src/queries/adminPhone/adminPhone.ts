//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { defineQuery, useQuery } from '@pinia/colada'
import {
  ADMIN_PHONE_STATUS_KEY,
  getAdminPhoneStatus,
  rememberServiceExtension,
} from '@/lib/adminPhone/adminPhone'
import { useLoginStore } from '@/stores/login'

export const useAdminPhoneStatus = defineQuery(() => {
  const loginStore = useLoginStore()

  const { state, asyncStatus, ...rest } = useQuery({
    key: () => [ADMIN_PHONE_STATUS_KEY],
    enabled: () => loginStore.isAuthenticated,
    refetchOnWindowFocus: false,
    query: async ({ signal }) => {
      const status = await getAdminPhoneStatus(signal)

      rememberServiceExtension(status.extension)
      return status
    },
  })

  return { state, asyncStatus, ...rest }
})
