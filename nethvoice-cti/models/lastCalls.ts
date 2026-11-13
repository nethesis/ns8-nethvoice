// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { createModel } from '@rematch/core'
import type { RootModel } from '.'

interface DefaultState {
  isReload: boolean
}

const defaultState: DefaultState = {
    isReload: false,
}

export const lastCalls = createModel<RootModel>()({
  state: defaultState,
  reducers: {
    setReloadLastCalls: (state, isReload: boolean) => {
      state.isReload = isReload
      return state
    },
    reset: () => {
      return defaultState
    },
  },
})
