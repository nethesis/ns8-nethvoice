// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { createModel } from '@rematch/core'
import type { RootModel } from '.'

interface SettingsTypes {
  caller_info: any
}

interface DefaultState {
  settings: SettingsTypes
}

const defaultState: DefaultState = {
  settings: {
    caller_info: '',
  },
}

export const customerCards = createModel<RootModel>()({
  state: defaultState,
  reducers: {
    updateCallerCustomerCardInformation: (state, callerInformations) => {
      state.settings.caller_info = callerInformations
      return state
    },
    reset: () => {
      return defaultState
    },
  },
})
