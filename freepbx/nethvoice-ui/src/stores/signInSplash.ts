//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { ref } from 'vue'
import { defineStore } from 'pinia'
import { usePreferredReducedMotion } from '@vueuse/core'
import { isRebranded, shouldShowSignInSplash, SIGN_IN_SPLASH_MS } from '@/lib/signInSplash'
import { useRuntimeConfigStore } from '@/stores/runtimeConfig'

export const useSignInSplashStore = defineStore('signInSplash', () => {
  const runtimeConfigStore = useRuntimeConfigStore()
  const reducedMotion = usePreferredReducedMotion()
  const visible = ref(false)

  const navigateAfterSignIn = async <T>(navigate: () => Promise<T>): Promise<T> => {
    const show = shouldShowSignInSplash({
      configLoaded: runtimeConfigStore.loaded,
      rebranded: isRebranded(runtimeConfigStore.config),
      reducedMotion: reducedMotion.value === 'reduce',
    })

    if (!show) {
      return navigate()
    }
    visible.value = true

    try {
      const [result] = await Promise.all([
        navigate(),
        new Promise<void>((resolve) => setTimeout(resolve, SIGN_IN_SPLASH_MS)),
      ])
      return result
    } finally {
      visible.value = false
    }
  }

  return { visible, navigateAfterSignIn }
})
