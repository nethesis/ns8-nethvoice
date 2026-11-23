// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { createModel } from '@rematch/core'
import type { RootModel } from '.'

interface UpdateProps {
  username: string
  token: string
}

const defaultState = {
  username: '',
  token: '',
}

export const authentication = createModel<RootModel>()({
  state: defaultState,
  reducers: {
    update: (state, payload: UpdateProps) => {
      state.username = payload.username
      state.token = payload.token
      return state
    },
    reset: () => {
      return defaultState
    },
  },
})
