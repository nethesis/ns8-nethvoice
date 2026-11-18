// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { createModel } from '@rematch/core'
import type { RootModel } from '.'

interface DefaultState {
  isSearchFirstOpen: boolean
}

const defaultState: DefaultState = {
    isSearchFirstOpen: false,
}

export const devices = createModel<RootModel>()({
  state: defaultState,
  reducers: {
    updateFirstOpenStatus: (state) => {
      state.isSearchFirstOpen = !state.isSearchFirstOpen
      return state
    },
  },
})
