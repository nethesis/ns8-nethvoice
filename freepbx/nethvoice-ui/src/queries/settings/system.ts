//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { defineQuery, useQuery } from '@pinia/colada'
import {
  getPbxCountries,
  getPbxLanguages,
  PBX_COUNTRIES_KEY,
  PBX_LANGUAGES_KEY,
} from '@/lib/settings/system'
import { useLoginStore } from '@/stores/login'

export const usePbxLanguages = defineQuery(() => {
  const loginStore = useLoginStore()

  const { state, asyncStatus, ...rest } = useQuery({
    key: () => [PBX_LANGUAGES_KEY],
    enabled: () => loginStore.isAuthenticated,
    query: () => getPbxLanguages(),
  })

  return { state, asyncStatus, ...rest }
})

export const usePbxCountries = defineQuery(() => {
  const loginStore = useLoginStore()

  const { state, asyncStatus, ...rest } = useQuery({
    key: () => [PBX_COUNTRIES_KEY],
    enabled: () => loginStore.isAuthenticated,
    query: () => getPbxCountries(),
  })

  return { state, asyncStatus, ...rest }
})
