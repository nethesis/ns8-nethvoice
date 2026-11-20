//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { watch } from 'vue'
import { useDocumentVisibility, useIntervalFn } from '@vueuse/core'

export const usePolling = (
  callback: () => unknown,
  intervalMs: number,
  isActive: () => boolean = () => true,
) => {
  const visibility = useDocumentVisibility()
  const shouldPoll = () => visibility.value === 'visible' && isActive()

  const { pause, resume } = useIntervalFn(callback, intervalMs, {
    immediate: shouldPoll(),
  })

  watch(shouldPoll, (polling) => {
    if (polling) {
      resume()
    } else {
      pause()
    }
  })

  watch(visibility, (state) => {
    if (state === 'visible' && isActive()) {
      callback()
    }
  })
}
