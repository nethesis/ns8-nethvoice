// Copyright (C) 2025 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { createModel } from '@rematch/core'
import type { RootModel } from '.'

interface DefaultState {
  paramUrl: string
  isLoaded: boolean
  isLoading: boolean
  errorMessage: string
  isUrlAvailable: boolean
  onlyQueues: boolean
}

const defaultState: DefaultState = {
  paramUrl: '',
  isLoaded: false,
  isLoading: false,
  errorMessage: '',
  isUrlAvailable: true,
  onlyQueues: false,
}

export const incomingCall = createModel<RootModel>()({
  state: defaultState,
  reducers: {
    setParamUrl: (state, paramUrl: string) => {
      state.paramUrl = paramUrl
      return state
    },
    setLoading: (state, isLoading: boolean) => {
      state.isLoading = isLoading
      return state
    },
    setLoaded: (state, isLoaded: boolean) => {
      state.isLoaded = isLoaded
      return state
    },
    setErrorMessage: (state, errorMessage: string) => {
      state.errorMessage = errorMessage
      return state
    },
    setUrlAvailable: (state, isUrlAvailable: boolean) => {
      state.isUrlAvailable = isUrlAvailable
      return state
    },
    setOnlyQueues: (state, onlyQueues: boolean) => {
      state.onlyQueues = onlyQueues
      return state
    },
    reset: () => {
      return defaultState
    },
  },
})
