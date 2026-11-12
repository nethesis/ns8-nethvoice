//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { defineQuery, useQuery } from '@pinia/colada'
import { getUsersDirectory, USERS_DIRECTORY_KEY } from '@/lib/users/directory'
import { useLoginStore } from '@/stores/login'

export const useUsersDirectory = defineQuery(() => {
  const loginStore = useLoginStore()

  const { state, asyncStatus, ...rest } = useQuery({
    key: () => [USERS_DIRECTORY_KEY],
    enabled: () => loginStore.isAuthenticated,
    query: () => getUsersDirectory(),
  })

  return { state, asyncStatus, ...rest }
})
