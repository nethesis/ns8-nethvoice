//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { computed } from 'vue'
import { defineQuery, useQuery } from '@pinia/colada'
import {
  getExtensionOptions,
  getGroupNames,
  INTEGRATIONS_EXTENSIONS_KEY,
  INTEGRATIONS_GROUPS_KEY,
  LOOKUP_STALE_TIME,
  toProfileOptions,
} from '@/lib/integrations/lookups'
import { getProfiles, PROFILES_KEY } from '@/lib/profiles/profiles'
import { useLoginStore } from '@/stores/login'

export const useProfileOptions = () => {
  const loginStore = useLoginStore()

  const { state: profilesState, ...rest } = useQuery({
    key: () => [PROFILES_KEY],
    enabled: () => loginStore.isAuthenticated,
    staleTime: LOOKUP_STALE_TIME,
    query: () => getProfiles(),
  })

  const state = computed(() => ({
    ...profilesState.value,
    data: profilesState.value.data ? toProfileOptions(profilesState.value.data) : undefined,
  }))

  return { state, ...rest }
}

export const useGroupNames = (isEnabled: () => boolean = () => true) => {
  const loginStore = useLoginStore()

  return useQuery({
    key: () => [INTEGRATIONS_GROUPS_KEY],
    enabled: () => loginStore.isAuthenticated && isEnabled(),
    staleTime: LOOKUP_STALE_TIME,
    query: () => getGroupNames(),
  })
}

export const useExtensionOptions = defineQuery(() => {
  const loginStore = useLoginStore()

  const { state, asyncStatus, ...rest } = useQuery({
    key: () => [INTEGRATIONS_EXTENSIONS_KEY],
    enabled: () => loginStore.isAuthenticated,
    staleTime: LOOKUP_STALE_TIME,
    query: () => getExtensionOptions(),
  })

  return { state, asyncStatus, ...rest }
})
