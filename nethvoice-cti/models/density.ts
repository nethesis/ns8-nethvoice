// Copyright (C) 2026 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { createModel } from '@rematch/core'
import type { RootModel } from '.'

const defaultState = {
  isCompact: false,
}

export const density = createModel<RootModel>()({
  state: defaultState,
  reducers: {
    update: (state, isCompact: boolean) => {
      state.isCompact = isCompact
      return state
    },
    reset: () => {
      return defaultState
    },
  },
})
