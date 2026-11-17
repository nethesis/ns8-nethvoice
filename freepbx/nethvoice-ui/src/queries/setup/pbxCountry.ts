//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { computed, watch } from 'vue'
import { derivePbxCountry } from '@/lib/setup/country'
import { getRoutesLocale } from '@/lib/routes/outbound'
import { useOutboundRoutes } from '@/queries/routes/outbound'
import { usePbxCountries, usePbxLanguages } from '@/queries/settings/system'
import { useSetupStore } from '@/stores/setup'

export function usePbxCountry({ remember = true }: { remember?: boolean } = {}) {
  const setupStore = useSetupStore()
  const { state: routesState } = useOutboundRoutes()
  const { state: countriesState } = usePbxCountries()
  const { state: languagesState } = usePbxLanguages()

  const settled = computed(
    () =>
      routesState.value.status !== 'pending' &&
      countriesState.value.status !== 'pending' &&
      languagesState.value.status !== 'pending',
  )

  const country = computed(() =>
    derivePbxCountry({
      cached: setupStore.country,
      routesLocale: getRoutesLocale(routesState.value.data ?? []),
      countries: countriesState.value.data,
      defaultLanguage: languagesState.value.data?.defaultLanguage,
    }),
  )

  watch(
    () => [settled.value, country.value] as const,
    ([isSettled, value]) => {
      if (remember && isSettled && value && !setupStore.country) {
        setupStore.country = value
      }
    },
    { immediate: true },
  )

  return { country, settled }
}
