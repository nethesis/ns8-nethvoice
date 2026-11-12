//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { useLoginStore } from './login'
import { getPreference, savePreference } from '@nethesis/vue-components'
import { useStorage } from '@vueuse/core'

type Theme = 'light' | 'dark' | 'system'

const isTheme = (value: unknown): value is Theme =>
  value === 'light' || value === 'dark' || value === 'system'

export const useThemeStore = defineStore('theme', () => {
  const loginStore = useLoginStore()
  const theme = ref('system')

  const isLight = computed(() => {
    switch (theme.value) {
      case 'light':
        return true
      case 'dark':
        return false
      default:
        if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
          return false
        } else {
          return true
        }
    }
  })

  function setTheme(newTheme: Theme) {
    theme.value = newTheme

    const username = loginStore.username

    if (username) {
      savePreference('theme', newTheme, username)
    }

    switch (newTheme) {
      case 'light':
        removeDarkClassFromDocument()
        break
      case 'dark':
        addDarkClassToDocument()
        break
      default:
        if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
          addDarkClassToDocument()
        } else {
          removeDarkClassFromDocument()
        }
    }
  }

  function toggleTheme() {
    switch (theme.value) {
      case 'light':
        setTheme('dark')
        break
      case 'dark':
        setTheme('light')
        break
      default:
        if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
          setTheme('light')
        } else {
          setTheme('dark')
        }
    }
  }

  const addDarkClassToDocument = () => {
    document.documentElement.classList.add('dark')
  }

  const removeDarkClassFromDocument = () => {
    document.documentElement.classList.remove('dark')
  }

  function loadTheme() {
    const lastUser = useStorage('lastUser', '')
    let theme: unknown = null
    const userLogged = loginStore.username

    if (userLogged) {
      theme = getPreference('theme', userLogged)
    } else if (lastUser.value) {
      theme = getPreference('theme', lastUser.value)
    }
    setTheme(isTheme(theme) ? theme : 'system')
  }

  watch(
    () => loginStore.username,
    (username) => {
      if (username) {
        loadTheme()
      }
    },
    { immediate: true },
  )

  return { theme, isLight, setTheme, toggleTheme, loadTheme }
})
