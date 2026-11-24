//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { computed, ref, watch } from 'vue'
import { defineQuery, useQuery } from '@pinia/colada'
import { CARD_TEMPLATES_KEY, getCardTemplates } from '@/lib/integrations/cardTemplates'
import { CUSTOMER_CARDS_KEY, getCustomerCards } from '@/lib/integrations/customerCards'
import {
  DB_CONNECTION_STATUSES_KEY,
  DB_CONNECTION_TYPES_KEY,
  DB_CONNECTIONS_KEY,
  type DbConnection,
  type DbConnectionStatus,
  getDbConnections,
  getDbConnectionSignature,
  getDbConnectionStatus,
  getDbConnectionStatuses,
  getDbConnectionTypes,
} from '@/lib/integrations/dbConnections'
import { LOOKUP_STALE_TIME } from '@/lib/integrations/lookups'
import { useMe, usePermissions } from '@/queries/permissions/me'
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
    staleTime: LOOKUP_STALE_TIME,
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

export const useDbConnectionStatuses = defineQuery(() => {
  const loginStore = useLoginStore()
  const { state: connectionsState } = useDbConnections()
  const { state: meState } = useMe()
  const { isSuperadmin } = usePermissions()
  const connections = computed(() => connectionsState.value.data ?? [])
  const testingIds = ref<string[]>([])
  const retested = ref<Record<string, DbConnectionStatus>>({})

  const { state, asyncStatus, ...rest } = useQuery({
    key: () => [
      DB_CONNECTION_STATUSES_KEY,
      ...connections.value.map(getDbConnectionSignature),
      isSuperadmin.value,
    ],
    enabled: () =>
      loginStore.isAuthenticated &&
      connectionsState.value.status === 'success' &&
      meState.value.status === 'success',
    query: async () => {
      const skipped = isSuperadmin.value
        ? []
        : connections.value.filter((connection) => connection.pbxServer)

      return {
        ...Object.fromEntries(
          skipped.map((connection): [string, DbConnectionStatus] => [connection.id, 'unknown']),
        ),
        ...(await getDbConnectionStatuses(
          connections.value.filter((connection) => !skipped.includes(connection)),
        )),
      }
    },
  })

  watch(
    () => state.value.data,
    () => {
      retested.value = {}
    },
  )

  function getStatus(id: string): DbConnectionStatus | 'testing' | undefined {
    if (testingIds.value.includes(id)) {
      return 'testing'
    }
    const status = retested.value[id] ?? state.value.data?.[id]

    if (status) {
      return status
    }
    return connectionsState.value.status === 'success' && asyncStatus.value === 'loading'
      ? 'testing'
      : undefined
  }

  async function retest(connection: DbConnection) {
    testingIds.value = [...testingIds.value, connection.id]
    const status = await getDbConnectionStatus(connection)

    retested.value = { ...retested.value, [connection.id]: status }
    testingIds.value = testingIds.value.filter((id) => id !== connection.id)
  }

  return { state, asyncStatus, getStatus, retest, ...rest }
})
