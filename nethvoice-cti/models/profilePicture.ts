// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { createModel } from '@rematch/core'
import type { RootModel } from '.'
interface DefaultState {
  isProfileEdite: boolean
}
const defaultState: DefaultState = {
  isProfileEdite: false,
}
export const profilePicture = createModel<RootModel>()({
  state: defaultState,
  reducers: {
    setEditedProfile: (state, isProfileEdite: boolean) => {
      state.isProfileEdite = isProfileEdite
      return state
    },
    reset: () => {
      return defaultState
    },
  },
})
