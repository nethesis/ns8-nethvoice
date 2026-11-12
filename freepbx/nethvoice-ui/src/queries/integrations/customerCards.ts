//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { defineQuery, useQuery } from '@pinia/colada'
import { CARD_TEMPLATES_KEY, getCardTemplates } from '@/lib/integrations/cardTemplates'
import { CUSTOMER_CARDS_KEY, getCustomerCards } from '@/lib/integrations/customerCards'
import {
  DB_CONNECTION_TYPES_KEY,
  DB_CONNECTIONS_KEY,
  getDbConnections,
  getDbConnectionTypes,
} from '@/lib/integrations/dbConnections'
import { useLoginStore } from '@/stores/login'

export const useCustomerCards = defineQuery(() => {
  const loginStore = useLoginStore()

  const { state, asyncStatus, ...rest } = useQuery({
    key: () => [CUSTOMER_CARDS_KEY],
    enabled: () => loginStore.isAuthenticated,
    query: () => getCustomerCards(),
  })

  return { state, asyncStatus, ...rest }
})

export const useDbConnections = defineQuery(() => {
  const loginStore = useLoginStore()

  const { state, asyncStatus, ...rest } = useQuery({
    key: () => [DB_CONNECTIONS_KEY],
    enabled: () => loginStore.isAuthenticated,
    query: () => getDbConnections(),
  })

  return { state, asyncStatus, ...rest }
})

export const useDbConnectionTypes = defineQuery(() => {
  const loginStore = useLoginStore()

  const { state, asyncStatus, ...rest } = useQuery({
    key: () => [DB_CONNECTION_TYPES_KEY],
    enabled: () => loginStore.isAuthenticated,
    query: () => getDbConnectionTypes(),
  })

  return { state, asyncStatus, ...rest }
})

export const useCardTemplates = defineQuery(() => {
  const loginStore = useLoginStore()

  const { state, asyncStatus, ...rest } = useQuery({
    key: () => [CARD_TEMPLATES_KEY],
    enabled: () => loginStore.isAuthenticated,
    query: () => getCardTemplates(),
  })

  return { state, asyncStatus, ...rest }
})
