//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { defineQuery, useQuery } from '@pinia/colada'
import {
  getPhonebookFields,
  getPhonebookSources,
  getPhonebookSyncStatuses,
  PHONEBOOK_FIELDS_KEY,
  PHONEBOOK_SOURCES_KEY,
  PHONEBOOK_STATUS_KEY,
} from '@/lib/integrations/phonebookSources'
import {
  getImportOwners,
  getPhonebookImports,
  IMPORT_OWNERS_KEY,
  PHONEBOOK_IMPORTS_KEY,
} from '@/lib/integrations/phonebookImports'
import { LOOKUP_STALE_TIME } from '@/lib/integrations/lookups'
import { useLoginStore } from '@/stores/login'

export const usePhonebookSources = defineQuery(() => {
  const loginStore = useLoginStore()

  const { state, asyncStatus, ...rest } = useQuery({
    key: () => [PHONEBOOK_SOURCES_KEY],
    enabled: () => loginStore.isAuthenticated,
    query: () => getPhonebookSources(),
  })

  return { state, asyncStatus, ...rest }
})

export const usePhonebookSyncStatuses = defineQuery(() => {
  const loginStore = useLoginStore()

  const { state, asyncStatus, ...rest } = useQuery({
    key: () => [PHONEBOOK_STATUS_KEY],
    enabled: () => loginStore.isAuthenticated,
    query: () => getPhonebookSyncStatuses(),
  })

  return { state, asyncStatus, ...rest }
})

export const usePhonebookImports = defineQuery(() => {
  const loginStore = useLoginStore()

  const { state, asyncStatus, ...rest } = useQuery({
    key: () => [PHONEBOOK_IMPORTS_KEY],
    enabled: () => loginStore.isAuthenticated,
    query: () => getPhonebookImports(),
  })

  return { state, asyncStatus, ...rest }
})

export const useImportOwners = () => {
  const loginStore = useLoginStore()

  return useQuery({
    key: () => [IMPORT_OWNERS_KEY],
    enabled: () => loginStore.isAuthenticated,
    staleTime: LOOKUP_STALE_TIME,
    query: () => getImportOwners(),
  })
}

export const usePhonebookFields = (isEnabled: () => boolean = () => true) => {
  const loginStore = useLoginStore()

  return useQuery({
    key: () => [PHONEBOOK_FIELDS_KEY],
    enabled: () => loginStore.isAuthenticated && isEnabled(),
    staleTime: LOOKUP_STALE_TIME,
    query: () => getPhonebookFields(),
  })
}
