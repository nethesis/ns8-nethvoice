//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { defineQuery, useQuery } from '@pinia/colada'
import {
  getPhonebookFields,
  getPhonebookSources,
  PHONEBOOK_FIELDS_KEY,
  PHONEBOOK_SOURCES_KEY,
} from '@/lib/integrations/phonebookSources'
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

export const usePhonebookFields = defineQuery(() => {
  const loginStore = useLoginStore()

  const { state, asyncStatus, ...rest } = useQuery({
    key: () => [PHONEBOOK_FIELDS_KEY],
    enabled: () => loginStore.isAuthenticated,
    query: () => getPhonebookFields(),
  })

  return { state, asyncStatus, ...rest }
})
