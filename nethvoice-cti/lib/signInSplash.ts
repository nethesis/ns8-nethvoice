// Copyright (C) 2026 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { store } from '../store'
import { isRebranded } from './loginAppearance'

export const SIGN_IN_SPLASH_MS = 1100

export const shouldShowSignInSplash = (): boolean => {
  if (typeof window === 'undefined') {
    return false
  }
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  return !reducedMotion && !isRebranded((window as any).CONFIG)
}

export const navigateAfterSignIn = async <T>(navigate: () => Promise<T>): Promise<T> => {
  if (!shouldShowSignInSplash()) {
    return navigate()
  }
  store.dispatch.signInSplash.setVisible(true)

  try {
    const [result] = await Promise.all([
      navigate(),
      new Promise<void>((resolve) => setTimeout(resolve, SIGN_IN_SPLASH_MS)),
    ])
    return result
  } finally {
    store.dispatch.signInSplash.setVisible(false)
  }
}
