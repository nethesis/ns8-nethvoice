// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { createModel } from '@rematch/core'
import type { RootModel } from '.'

const defaultState = {
  theme: 'system',
}

export const darkTheme = createModel<RootModel>()({
  state: defaultState,
  reducers: {
    update: (state, theme: string) => {
      state.theme = theme
      return state
    },
    reset: () => {
      return defaultState
    },
  },
})
