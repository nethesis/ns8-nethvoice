//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { getPreference, savePreference } from '@nethesis/vue-components'
import { normalizeCardOrder, type DashboardCardId } from '@/lib/dashboard/layout'
import { useLoginStore } from '@/stores/login'

const CARD_ORDER_PREFERENCE = 'dashboardCardOrder'

const readCardOrder = (username: string): DashboardCardId[] => {
  if (!username) {
    return normalizeCardOrder(undefined)
  }
  try {
    return normalizeCardOrder(getPreference(CARD_ORDER_PREFERENCE, username))
  } catch {
    return normalizeCardOrder(undefined)
  }
}

export const useDashboardLayoutStore = defineStore('dashboardLayout', () => {
  const loginStore = useLoginStore()
  const cardOrder = ref<DashboardCardId[]>(readCardOrder(loginStore.username))

  watch(
    () => loginStore.username,
    (username) => {
      cardOrder.value = readCardOrder(username)
    },
  )

  const setCardOrder = (order: DashboardCardId[]) => {
    cardOrder.value = order

    if (loginStore.username) {
      try {
        savePreference(CARD_ORDER_PREFERENCE, order, loginStore.username)
      } catch {
        return
      }
    }
  }

  return { cardOrder, setCardOrder }
})
