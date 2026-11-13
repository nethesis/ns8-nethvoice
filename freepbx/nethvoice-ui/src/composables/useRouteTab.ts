//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

export function useRouteTab<T extends string>(tabNames: readonly T[]) {
  const route = useRoute()
  const router = useRouter()

  const selectedTab = computed<T>({
    get() {
      const current = route.params.tab
      const name = Array.isArray(current) ? current[0] : current
      return tabNames.find((tabName) => tabName === name) ?? tabNames[0]
    },
    set(tabName) {
      const current = route.params.tab
      const currentName = Array.isArray(current) ? current[0] : current

      if (currentName === tabName) {
        return
      }
      router.push({ name: route.name, params: { ...route.params, tab: tabName } })
    },
  })

  return { selectedTab }
}
