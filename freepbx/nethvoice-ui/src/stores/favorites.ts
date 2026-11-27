//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { getPreference, savePreference } from '@nethesis/vue-components'
import { useLoginStore } from '@/stores/login'

const FAVORITES_PREFERENCE = 'overviewFavorites'

const readFavorites = (username: string): string[] => {
  if (!username) {
    return []
  }
  try {
    const value: unknown = getPreference(FAVORITES_PREFERENCE, username)
    return Array.isArray(value) ? value.filter((item) => typeof item === 'string') : []
  } catch {
    return []
  }
}

export const useFavoritesStore = defineStore('favorites', () => {
  const loginStore = useLoginStore()
  const usernames = ref<string[]>(readFavorites(loginStore.username))

  const favorites = computed(() => new Set(usernames.value))

  watch(
    () => loginStore.username,
    (username) => {
      usernames.value = readFavorites(username)
    },
  )

  const isFavorite = (username: string) => favorites.value.has(username)

  const toggleFavorite = (username: string) => {
    usernames.value = isFavorite(username)
      ? usernames.value.filter((item) => item !== username)
      : [...usernames.value, username]

    if (loginStore.username) {
      try {
        savePreference(FAVORITES_PREFERENCE, usernames.value, loginStore.username)
      } catch {
        return
      }
    }
  }

  return { favorites, isFavorite, toggleFavorite }
})
