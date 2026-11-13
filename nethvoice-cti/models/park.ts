// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { createModel } from '@rematch/core'
import type { RootModel } from '.'

interface DefaultState {
  parks: any
  isLoaded: boolean
  isLoading: boolean
  isParkingCallTaken: boolean
  isParkingFooterVisible: boolean
  notEmptyParking: number
}

const defaultState: DefaultState = {
  parks: {},
  isLoaded: false,
  isLoading: false,
  isParkingCallTaken: false,
  isParkingFooterVisible: false,
  notEmptyParking: 0,
}

export const park = createModel<RootModel>()({
  state: defaultState,
  reducers: {
    setParks: (state, parks: Object) => {
      state.parks = parks
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
    setParkingCallTaken: (state, isParkingCallTaken: boolean) => {
      state.isParkingCallTaken = isParkingCallTaken
      return state
    },
    setParkingCallFooterVisibility: (state, isParkingFooterVisible: boolean) => {
      state.isParkingFooterVisible = isParkingFooterVisible
      return state
    },
    setNumberOfNotEmptyParkings: (state, notEmptyParking: any) => {
      state.notEmptyParking = notEmptyParking
      return state
    },
  },
})
