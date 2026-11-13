//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { watch } from 'vue'

const RETURN_DELAY = 350

export const useFocusReturn = (isShown: () => boolean) => {
  let opener: HTMLElement | null = null

  watch(isShown, (shown) => {
    if (shown) {
      const active = document.activeElement
      opener = active instanceof HTMLElement && active !== document.body ? active : null
      return
    }
    const target = opener
    opener = null

    if (target) {
      setTimeout(() => {
        if (target.isConnected) {
          target.focus()
        }
      }, RETURN_DELAY)
    }
  })
}
