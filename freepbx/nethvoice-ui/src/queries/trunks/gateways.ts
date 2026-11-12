//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { defineQuery, useQuery } from '@pinia/colada'
import {
  GATEWAY_MODELS_KEY,
  GATEWAYS_KEY,
  getGatewayModels,
  getGateways,
  getHostNetworks,
  HOST_NETWORKS_KEY,
} from '@/lib/trunks/gateways'
import { FXS_USERS_KEY, getFxsUsers } from '@/lib/trunks/fxsUsers'
import { useLoginStore } from '@/stores/login'

export const useGateways = defineQuery(() => {
  const loginStore = useLoginStore()

  const { state, asyncStatus, ...rest } = useQuery({
    key: () => [GATEWAYS_KEY],
    enabled: () => loginStore.isAuthenticated,
    query: () => getGateways(),
  })

  return { state, asyncStatus, ...rest }
})

export const useGatewayModels = defineQuery(() => {
  const loginStore = useLoginStore()

  const { state, asyncStatus, ...rest } = useQuery({
    key: () => [GATEWAY_MODELS_KEY],
    enabled: () => loginStore.isAuthenticated,
    query: () => getGatewayModels(),
  })

  return { state, asyncStatus, ...rest }
})

export const useHostNetworks = defineQuery(() => {
  const loginStore = useLoginStore()

  const { state, asyncStatus, ...rest } = useQuery({
    key: () => [HOST_NETWORKS_KEY],
    enabled: () => loginStore.isAuthenticated,
    query: () => getHostNetworks(),
  })

  return { state, asyncStatus, ...rest }
})

export const useFxsUsers = defineQuery(() => {
  const loginStore = useLoginStore()

  const { state, asyncStatus, ...rest } = useQuery({
    key: () => [FXS_USERS_KEY],
    enabled: () => loginStore.isAuthenticated,
    query: () => getFxsUsers(),
  })

  return { state, asyncStatus, ...rest }
})
