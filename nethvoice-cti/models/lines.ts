// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { createModel } from '@rematch/core'
import type { RootModel } from '.'

interface DefaultState {
  lines: any
  isLoaded: boolean
  isLoading: boolean
  errorMessage: string
}

const defaultState: DefaultState = {
  lines: {},
  isLoaded: false,
  isLoading: false,
  errorMessage: '',
}

export const lines = createModel<RootModel>()({
  state: defaultState,
  reducers: {
    setLines: (state, lines: Object) => {
      state.lines = lines
      return state
    },
    setLoaded: (state, isLoaded: boolean) => {
      state.isLoaded = isLoaded
      return state
    },
    setLoading: (state, isLoading: boolean) => {
      state.isLoading = isLoading
      return state
    },
    setErrorMessage: (state, errorMessage: string) => {
      state.errorMessage = errorMessage
      return state
    },
  },
})
