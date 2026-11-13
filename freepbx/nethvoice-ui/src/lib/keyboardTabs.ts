//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import type { Directive } from 'vue'

const TAB_SELECTOR = 'nav a:not([href])'

const ACTIVATION_KEYS = ['Enter', ' ']

const makeTabsFocusable = (element: HTMLElement) => {
  element.querySelectorAll<HTMLElement>(TAB_SELECTOR).forEach((tab) => {
    if (!tab.hasAttribute('tabindex')) {
      tab.setAttribute('tabindex', '0')
      tab.setAttribute('role', 'link')
    }
  })
}

const activateTab = (event: KeyboardEvent) => {
  const target = event.target

  if (
    ACTIVATION_KEYS.includes(event.key) &&
    target instanceof HTMLElement &&
    target.matches(TAB_SELECTOR)
  ) {
    event.preventDefault()
    target.click()
  }
}

export const vKeyboardTabs: Directive<HTMLElement> = {
  mounted(element) {
    makeTabsFocusable(element)
    element.addEventListener('keydown', activateTab)
  },
  updated(element) {
    makeTabsFocusable(element)
  },
  beforeUnmount(element) {
    element.removeEventListener('keydown', activateTab)
  },
}
