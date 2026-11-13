//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { useLoginStore } from './login'
import { getPreference, savePreference } from '@nethesis/vue-components'
import { useStorage } from '@vueuse/core'

type Density = 'standard' | 'compact'

export const useDensityStore = defineStore('density', () => {
  const loginStore = useLoginStore()
  const isCompact = ref(false)

  function setDensity(newDensity: Density) {
    isCompact.value = newDensity === 'compact'

    const username = loginStore.username

    if (username) {
      savePreference('density', newDensity, username)
    }

    document.documentElement.classList.toggle('compact', isCompact.value)
  }

  function toggleDensity() {
    setDensity(isCompact.value ? 'standard' : 'compact')
  }

  function loadDensity() {
    const lastUser = useStorage('lastUser', '')
    const username = loginStore.username || lastUser.value
    const saved = username ? getPreference('density', username) : null
    setDensity(saved === 'compact' ? 'compact' : 'standard')
  }

  watch(
    () => loginStore.username,
    (username) => {
      if (username) {
        loadDensity()
      }
    },
    { immediate: true },
  )

  return { isCompact, setDensity, toggleDensity, loadDensity }
})
