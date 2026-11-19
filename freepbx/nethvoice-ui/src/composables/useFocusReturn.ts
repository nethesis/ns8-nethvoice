//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { watch } from 'vue'

const findClosingDialog = () =>
  document.activeElement?.closest('[role="dialog"]') ??
  Array.from(document.querySelectorAll('[role="dialog"]')).at(-1)

export const useFocusReturn = (isShown: () => boolean) => {
  let opener: HTMLElement | null = null
  let cancelReturn: (() => void) | null = null

  watch(isShown, (shown) => {
    cancelReturn?.()
    cancelReturn = null

    if (shown) {
      const active = document.activeElement
      opener = active instanceof HTMLElement && active !== document.body ? active : null
      return
    }
    const target = opener
    opener = null

    if (!target) {
      return
    }
    const dialog = findClosingDialog()
    const returnFocus = () => {
      if (dialog?.isConnected) {
        return false
      }
      if (target.isConnected) {
        target.focus()
      }
      return true
    }

    if (returnFocus()) {
      return
    }
    const observer = new MutationObserver(() => {
      if (returnFocus()) {
        observer.disconnect()
        cancelReturn = null
      }
    })
    observer.observe(document.body, { childList: true, subtree: true })
    cancelReturn = () => observer.disconnect()
  })
}
