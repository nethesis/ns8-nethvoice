//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { watch } from 'vue'
import { useDocumentVisibility, useIntervalFn } from '@vueuse/core'

export const usePolling = (callback: () => unknown, intervalMs: number) => {
  const visibility = useDocumentVisibility()

  const { pause, resume } = useIntervalFn(callback, intervalMs, {
    immediate: visibility.value === 'visible',
  })

  watch(visibility, (state) => {
    if (state === 'visible') {
      callback()
      resume()
    } else {
      pause()
    }
  })
}
