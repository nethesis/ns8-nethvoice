//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { watch } from 'vue'

const findDialogs = () => Array.from(document.querySelectorAll('[role="dialog"]'))

const findClosingDialog = () =>
  document.activeElement?.closest('[role="dialog"]') ?? findDialogs().at(-1)

export const useFocusReturn = (isShown: () => boolean) => {
  let opener: HTMLElement | null = null
  let dialogsAtOpen: Element[] = []
  let cancelReturn: (() => void) | null = null

  watch(isShown, (shown) => {
    cancelReturn?.()
    cancelReturn = null

    if (shown) {
      const active = document.activeElement
      opener = active instanceof HTMLElement && active !== document.body ? active : null
      dialogsAtOpen = findDialogs()
      return
    }
    const target = opener
    opener = null

    if (!target) {
      return
    }
    const closingDialog = findClosingDialog()
    const dialogs = findDialogs().filter(
      (dialog) =>
        dialog === closingDialog || (!dialogsAtOpen.includes(dialog) && !dialog.contains(target)),
    )
    dialogsAtOpen = []
    const returnFocus = () => {
      if (dialogs.some((dialog) => dialog.isConnected)) {
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
