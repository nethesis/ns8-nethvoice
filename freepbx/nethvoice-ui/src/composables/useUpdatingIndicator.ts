//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { onScopeDispose, ref, watch } from 'vue'

export const UPDATING_DELAY = 500

export const UPDATING_MIN_VISIBLE = 500

export const useUpdatingIndicator = (isUpdating: () => boolean) => {
  const visible = ref(false)
  let showTimer: ReturnType<typeof setTimeout> | undefined
  let hideTimer: ReturnType<typeof setTimeout> | undefined
  let shownAt = 0

  watch(
    isUpdating,
    (updating) => {
      clearTimeout(showTimer)

      if (updating) {
        clearTimeout(hideTimer)

        if (!visible.value) {
          showTimer = setTimeout(() => {
            visible.value = true
            shownAt = Date.now()
          }, UPDATING_DELAY)
        }
        return
      }

      if (visible.value) {
        hideTimer = setTimeout(
          () => {
            visible.value = false
          },
          Math.max(0, UPDATING_MIN_VISIBLE - (Date.now() - shownAt)),
        )
      }
    },
    { immediate: true },
  )

  onScopeDispose(() => {
    clearTimeout(showTimer)
    clearTimeout(hideTimer)
  })

  return visible
}
