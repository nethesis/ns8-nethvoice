// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { createModel } from '@rematch/core'
import type { RootModel } from '.'

const defaultState = {
  isOpen: false,
  isFocused: false,
  isCustomerCardsRedirect: false,
  isRightSideTitleClicked: false,
}

export const globalSearch = createModel<RootModel>()({
  state: defaultState,
  reducers: {
    setOpen: (state, isOpen: boolean) => {
      state.isOpen = isOpen
      return state
    },
    setFocused: (state, isFocused: boolean) => {
      state.isFocused = isFocused
      return state
    },
    // On global search click of customer cards hide focus of global search
    setCustomerCardsRedirect: (state, isCustomerCardsRedirect: boolean) => {
      state.isCustomerCardsRedirect = isCustomerCardsRedirect
      return state
    },
    setRightSideTitleClicked: (state, isRightSideTitleClicked: boolean) => {
      state.isRightSideTitleClicked = isRightSideTitleClicked
      return state
    },
    reset: () => {
      return defaultState
    },
  },
})
