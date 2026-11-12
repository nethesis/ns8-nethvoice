//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { useQuery } from '@pinia/colada'
import type { MaybeRefOrGetter } from 'vue'
import { toValue } from 'vue'
import { getPhoneModel, PHONE_MODEL_KEY } from '@/lib/phones/models'
import { getPhoneFiles, PHONE_FILES_KEY, type PhoneFileType } from '@/lib/phones/files'
import { useLoginStore } from '@/stores/login'

export const usePhoneModel = (name: MaybeRefOrGetter<string>) => {
  const loginStore = useLoginStore()

  return useQuery({
    key: () => [PHONE_MODEL_KEY, toValue(name)],
    enabled: () => loginStore.isAuthenticated && toValue(name) !== '',
    query: () => getPhoneModel(toValue(name)),
  })
}

export const usePhoneFiles = (type: PhoneFileType, enabled: MaybeRefOrGetter<boolean> = true) => {
  const loginStore = useLoginStore()

  return useQuery({
    key: () => [PHONE_FILES_KEY, type],
    enabled: () => loginStore.isAuthenticated && toValue(enabled),
    query: () => getPhoneFiles(type),
  })
}
