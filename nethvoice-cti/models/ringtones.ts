// Copyright (C) 2025 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { createModel } from '@rematch/core'
import type { RootModel } from './index'

export interface Ringtone {
  name: string
  displayName: string
  base64Audio: string
}

export interface RingtonesState {
  ringtones: Ringtone[]
  isLoaded: boolean
}

const initialState: RingtonesState = {
  ringtones: [],
  isLoaded: false,
}

export const ringtones = createModel<RootModel>()({
  state: initialState,
  reducers: {
    setRingtones(state, payload: Ringtone[]) {
      return {
        ...state,
        ringtones: payload,
        isLoaded: true,
      }
    },
    reset() {
      return initialState
    },
  },
})
