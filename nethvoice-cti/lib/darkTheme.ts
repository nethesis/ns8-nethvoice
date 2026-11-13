// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { getJSONItem, setJSONItem } from './storage'
import { store } from '../store'

const addDarkClassToDocument = () => {
  document.documentElement.classList.add('dark')
}

const removeDarkClassFromDocument = () => {
  document.documentElement.classList.remove('dark')
}

/**
 * Read theme from local storage and update global store
 */
export const checkDarkTheme = (currentUsername?: string) => {
  if (!currentUsername) {
    // use theme of last logged user
    const credentials = getJSONItem('credentials')
    currentUsername = credentials.username
  }
  const preferences = getJSONItem(`preferences-${currentUsername}`) || {}
  let theme = 'system'

  if (preferences.theme === 'dark') {
    theme = 'dark'
    addDarkClassToDocument()
  } else if (preferences.theme === 'light') {
    theme = 'light'
    removeDarkClassFromDocument()
  } else {
    // system theme
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      addDarkClassToDocument()
    } else {
      removeDarkClassFromDocument()
    }
  }

  // update global store
  store.dispatch.darkTheme.update(theme)
}

export const setTheme = (theme: string, currentUsername: string) => {
  const preferences = getJSONItem(`preferences-${currentUsername}`) || {}
  preferences.theme = theme
  setJSONItem(`preferences-${currentUsername}`, preferences)
  checkDarkTheme(currentUsername)
}
