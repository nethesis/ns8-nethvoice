//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { getPreference, savePreference } from '@nethesis/vue-components'
import { normalizeCallsRange, type CallsRange } from '@/lib/dashboard/calls'
import { normalizeCardOrder, type DashboardCardId } from '@/lib/dashboard/layout'
import { useLoginStore } from '@/stores/login'

const CARD_ORDER_PREFERENCE = 'dashboardCardOrder'

const CALLS_RANGE_PREFERENCE = 'dashboardCallsRange'

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

const readCallsRange = (username: string): CallsRange => {
  if (!username) {
    return normalizeCallsRange(undefined)
  }
  try {
    return normalizeCallsRange(getPreference(CALLS_RANGE_PREFERENCE, username))
  } catch {
    return normalizeCallsRange(undefined)
  }
}

export const useDashboardLayoutStore = defineStore('dashboardLayout', () => {
  const loginStore = useLoginStore()
  const cardOrder = ref<DashboardCardId[]>(readCardOrder(loginStore.username))
  const callsRange = ref<CallsRange>(readCallsRange(loginStore.username))

  watch(
    () => loginStore.username,
    (username) => {
      cardOrder.value = readCardOrder(username)
      callsRange.value = readCallsRange(username)
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

  const setCallsRange = (range: CallsRange) => {
    callsRange.value = range

    if (loginStore.username) {
      try {
        savePreference(CALLS_RANGE_PREFERENCE, range, loginStore.username)
      } catch {
        return
      }
    }
  }

  return { cardOrder, setCardOrder, callsRange, setCallsRange }
})
