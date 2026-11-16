// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { createModel } from '@rematch/core'
import type { RootModel } from '.'

interface ListeningTypes {
  isListening: boolean
  listening_id: string
}

interface IntrudeTypes {
  isIntrude: boolean
  intrude_id: string
}

interface DefaultState {
  listeningInfo: ListeningTypes
  intrudeInfo: IntrudeTypes
}

const defaultState: DefaultState = {
  listeningInfo: {
    isListening: false,
    listening_id: '',
  },
  intrudeInfo: {
    isIntrude: false,
    intrude_id: '',
  },
}

export const userActions = createModel<RootModel>()({
  state: defaultState,
  reducers: {
    updateListeningInformation: (state, listeningInformations) => {
      state.listeningInfo.isListening = listeningInformations.isListening
      state.listeningInfo.listening_id = listeningInformations.listening_id
      return state
    },
    updateIntrudeInformation: (state, intrudeInformations) => {
      state.intrudeInfo.isIntrude = intrudeInformations.isIntrude
      state.intrudeInfo.intrude_id = intrudeInformations.intrude_id
      return state
    },
    reset: () => {
      return defaultState
    },
  },
})
