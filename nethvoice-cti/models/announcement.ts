// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { createModel } from '@rematch/core'
import type { RootModel } from '.'

interface DefaultState {
  reloadValue: boolean
}

const defaultState: DefaultState = {
  reloadValue: false,
}

export const announcement = createModel<RootModel>()({
  state: defaultState,
  reducers: {
    reload: (state) => {
      state.reloadValue = !state.reloadValue
      return state
    },
  },
})
