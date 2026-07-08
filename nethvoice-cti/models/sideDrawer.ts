// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { createModel } from '@rematch/core'
import type { RootModel } from '.'
import { ContentType } from '../components/layout/SideDrawer'

interface DefaultState {
  isShown: boolean
  contentType: ContentType
  config: any
  avoidClose?: boolean
}

const defaultState: DefaultState = {
  isShown: false,
  contentType: 'showContact' as ContentType,
  config: null,
  avoidClose: false,
}

export const sideDrawer = createModel<RootModel>()({
  state: defaultState,
  reducers: {
    update: (state, payload: DefaultState) => {
      state.isShown = payload.isShown
      state.contentType = payload.contentType
      state.config = payload.config
      return state
    },
    setShown: (state, isShown: boolean) => {
      state.isShown = isShown
      return state
    },
    setAvoidClose: (state, avoidClose: boolean) => {
      state.avoidClose = avoidClose
      return state
    },
    reset: () => {
      return defaultState
    },
  },
})
