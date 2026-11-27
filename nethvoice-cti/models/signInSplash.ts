// Copyright (C) 2026 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { createModel } from '@rematch/core'
import type { RootModel } from '.'

const defaultState = {
  visible: false,
}

export const signInSplash = createModel<RootModel>()({
  state: defaultState,
  reducers: {
    setVisible: (state, visible: boolean) => {
      state.visible = visible
      return state
    },
    reset: () => {
      return defaultState
    },
  },
})
