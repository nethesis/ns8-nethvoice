//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { computed } from 'vue'
import { defineQuery, useQuery } from '@pinia/colada'
import { getPhoneEncryption, PHONE_ENCRYPTION_KEY } from '@/lib/phones/encryption'
import { getMacVendors, MAC_VENDORS_KEY } from '@/lib/phones/mac'
import { buildPhones, getTancrediPhones, PHONES_KEY } from '@/lib/phones/phones'
import { usePhoneModels } from '@/queries/phones/models'
import { useUsers } from '@/queries/users/users'
import { useLoginStore } from '@/stores/login'

export const useTancrediPhones = defineQuery(() => {
  const loginStore = useLoginStore()

  const { state, asyncStatus, ...rest } = useQuery({
    key: () => [PHONES_KEY],
    enabled: () => loginStore.isAuthenticated,
    query: () => getTancrediPhones(),
  })

  return { state, asyncStatus, ...rest }
})

export const usePhoneEncryption = defineQuery(() => {
  const loginStore = useLoginStore()

  const { state, asyncStatus, ...rest } = useQuery({
    key: () => [PHONE_ENCRYPTION_KEY],
    enabled: () => loginStore.isAuthenticated,
    query: () => getPhoneEncryption(),
  })

  return { state, asyncStatus, ...rest }
})

export const useMacVendors = defineQuery(() => {
  const loginStore = useLoginStore()

  const { state, asyncStatus, ...rest } = useQuery({
    key: () => [MAC_VENDORS_KEY],
    enabled: () => loginStore.isAuthenticated,
    query: () => getMacVendors(),
  })

  return { state, asyncStatus, ...rest }
})

export const usePhones = defineQuery(() => {
  const phonesQuery = useTancrediPhones()
  const modelsQuery = usePhoneModels()
  const usersQuery = useUsers()
  const encryptionQuery = usePhoneEncryption()
  const queries = [phonesQuery, modelsQuery, usersQuery, encryptionQuery]

  const loading = computed(() => queries.some((query) => query.state.value.status === 'pending'))

  const updating = computed(
    () => !loading.value && queries.some((query) => query.asyncStatus.value === 'loading'),
  )

  const error = computed(
    () => queries.find((query) => query.state.value.status === 'error')?.state.value.error ?? null,
  )

  const users = computed(() => usersQuery.state.value.data ?? [])
  const models = computed(() => modelsQuery.state.value.data ?? [])

  const phones = computed(() =>
    buildPhones(
      phonesQuery.state.value.data ?? [],
      models.value,
      users.value,
      encryptionQuery.state.value.data ?? {},
    ),
  )

  const refetch = () => Promise.all(queries.map((query) => query.refetch()))

  return { phones, models, users, loading, updating, error, refetch }
})
