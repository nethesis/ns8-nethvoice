// Copyright (C) 2026 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { getJSONItem, loadPreference, savePreference } from './storage'
import { store } from '../store'

export type Density = 'standard' | 'compact'

const applyDensity = (isCompact: boolean) => {
  document.documentElement.classList.toggle('compact', isCompact)
  store.dispatch.density.update(isCompact)
}

export const checkDensity = (currentUsername?: string) => {
  const username = currentUsername || getJSONItem('credentials')?.username
  const density = username ? loadPreference('density', username) : undefined
  applyDensity(density === 'compact')
}

export const setDensity = (density: Density, currentUsername: string) => {
  if (currentUsername) {
    savePreference('density', density, currentUsername)
  }
  applyDensity(density === 'compact')
}
