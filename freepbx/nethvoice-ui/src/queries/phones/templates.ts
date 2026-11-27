//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { useQuery } from '@pinia/colada'
import { toValue, type MaybeRefOrGetter } from 'vue'
import type { PhoneModel } from '@/lib/phones/models'
import {
  getPhoneTemplates,
  getStandardTemplate,
  PHONE_TEMPLATES_KEY,
  STANDARD_TEMPLATE_KEY,
} from '@/lib/phones/templates'
import { useLoginStore } from '@/stores/login'

export const usePhoneTemplates = (enabled: MaybeRefOrGetter<boolean> = true) => {
  const loginStore = useLoginStore()

  return useQuery({
    key: () => [PHONE_TEMPLATES_KEY],
    enabled: () => loginStore.isAuthenticated && toValue(enabled),
    query: () => getPhoneTemplates(),
  })
}

export const useStandardTemplate = (
  modelName: MaybeRefOrGetter<string>,
  models: MaybeRefOrGetter<PhoneModel[] | undefined>,
  enabled: MaybeRefOrGetter<boolean>,
) => {
  const loginStore = useLoginStore()

  return useQuery({
    key: () => [STANDARD_TEMPLATE_KEY, toValue(modelName)],
    enabled: () => loginStore.isAuthenticated && toValue(enabled) && toValue(models) !== undefined,
    query: () => getStandardTemplate(toValue(modelName), toValue(models) ?? []),
  })
}
