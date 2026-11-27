//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { defineQuery, useQuery } from '@pinia/colada'
import { useRoute } from 'vue-router'
import { getTrunks, TRUNKS_KEY } from '@/lib/trunks/trunks'
import {
  getTrunkCodecs,
  getTrunkProviders,
  TRUNK_CODECS_KEY,
  TRUNK_PROVIDERS_KEY,
} from '@/lib/trunks/providers'
import { getTrunksLiveState, TRUNKS_LIVE_STATE_KEY } from '@/lib/trunks/liveState'
import { isSetupRoute } from '@/lib/setup/guard'
import { usePermissions } from '@/queries/permissions/me'
import { useLoginStore } from '@/stores/login'

export const useTrunks = defineQuery(() => {
  const loginStore = useLoginStore()

  const { state, asyncStatus, ...rest } = useQuery({
    key: () => [TRUNKS_KEY],
    enabled: () => loginStore.isAuthenticated,
    query: () => getTrunks(),
  })

  return { state, asyncStatus, ...rest }
})

export const useTrunkProviders = defineQuery(() => {
  const loginStore = useLoginStore()

  const { state, asyncStatus, ...rest } = useQuery({
    key: () => [TRUNK_PROVIDERS_KEY],
    enabled: () => loginStore.isAuthenticated,
    query: () => getTrunkProviders(),
  })

  return { state, asyncStatus, ...rest }
})

export const useTrunkCodecs = defineQuery(() => {
  const loginStore = useLoginStore()

  const { state, asyncStatus, ...rest } = useQuery({
    key: () => [TRUNK_CODECS_KEY],
    enabled: () => loginStore.isAuthenticated,
    query: () => getTrunkCodecs(),
  })

  return { state, asyncStatus, ...rest }
})

export const useTrunksLiveState = defineQuery(() => {
  const loginStore = useLoginStore()
  const { can } = usePermissions()
  const route = useRoute()

  const { state, asyncStatus, ...rest } = useQuery({
    key: () => [TRUNKS_LIVE_STATE_KEY],
    enabled: () => loginStore.isAuthenticated && can('trunks') && !isSetupRoute(route.name),
    refetchOnWindowFocus: false,
    query: ({ signal }) => getTrunksLiveState(signal),
  })

  return { state, asyncStatus, ...rest }
})
