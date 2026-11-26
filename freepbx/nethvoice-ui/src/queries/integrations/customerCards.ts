//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { computed, ref, watch, type Ref } from 'vue'
import { defineQuery, useQuery } from '@pinia/colada'
import {
  CARD_TEMPLATE_PREVIEW_KEY,
  CARD_TEMPLATES_KEY,
  getCardTemplates,
  previewCardTemplate,
  type SampleRow,
} from '@/lib/integrations/cardTemplates'
import { CUSTOMER_CARDS_KEY, getCustomerCards } from '@/lib/integrations/customerCards'
import {
  DB_CONNECTION_STATUS_STALE_TIME,
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

export type CardTemplatePreviewInput = { code: string; results: SampleRow[] }

export function useCardTemplatePreview(input: Ref<CardTemplatePreviewInput | undefined>) {
  const loginStore = useLoginStore()

  return useQuery({
    key: () => [
      CARD_TEMPLATE_PREVIEW_KEY,
      input.value?.code ?? '',
      JSON.stringify(input.value?.results ?? []),
    ],
    enabled: () => loginStore.isAuthenticated && !!input.value,
    query: ({ signal }) =>
      previewCardTemplate(input.value?.code ?? '', input.value?.results ?? [], signal),
    placeholderData: (previous) => previous,
    staleTime: Infinity,
    gcTime: 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
}

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
    staleTime: DB_CONNECTION_STATUS_STALE_TIME,
    refetchOnWindowFocus: false,
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
