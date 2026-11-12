//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { computed } from 'vue'
import { defineQuery, useQuery } from '@pinia/colada'
import {
  getExtensionOptions,
  getGroupNames,
  INTEGRATIONS_EXTENSIONS_KEY,
  INTEGRATIONS_GROUPS_KEY,
  toProfileOptions,
} from '@/lib/integrations/lookups'
import { useProfiles } from '@/queries/profiles/profiles'
import { useLoginStore } from '@/stores/login'

export const useProfileOptions = () => {
  const { state: profilesState, ...rest } = useProfiles()

  const state = computed(() => ({
    ...profilesState.value,
    data: profilesState.value.data ? toProfileOptions(profilesState.value.data) : undefined,
  }))

  return { state, ...rest }
}

export const useGroupNames = defineQuery(() => {
  const loginStore = useLoginStore()

  const { state, asyncStatus, ...rest } = useQuery({
    key: () => [INTEGRATIONS_GROUPS_KEY],
    enabled: () => loginStore.isAuthenticated,
    query: () => getGroupNames(),
  })

  return { state, asyncStatus, ...rest }
})

export const useExtensionOptions = defineQuery(() => {
  const loginStore = useLoginStore()

  const { state, asyncStatus, ...rest } = useQuery({
    key: () => [INTEGRATIONS_EXTENSIONS_KEY],
    enabled: () => loginStore.isAuthenticated,
    query: () => getExtensionOptions(),
  })

  return { state, asyncStatus, ...rest }
})
