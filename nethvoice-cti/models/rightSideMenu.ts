// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { createModel } from '@rematch/core'
import type { RootModel } from '.'
import { getJSONItem, setJSONItem } from '../lib/storage'

interface DefaultState {
  isShown: boolean
  actualTab: string
}
const defaultState: DefaultState = {
  isShown: false,
  actualTab: '',
}
export const rightSideMenu = createModel<RootModel>()({
  state: defaultState,
  reducers: {
    setShown: (state, isShown: boolean) => {
      state.isShown = isShown
      return state
    },
    updateTab: (state, actualTab: string) => {
      state.actualTab = actualTab
      return state
    },
    toggleSideMenu: (state, payload: { tabName: string; username: string; force?: boolean }) => {
      const { tabName, username, force } = payload

      // Update the tab name
      state.actualTab = tabName

      // Calculate and update the state for the menu
      if (force !== undefined) {
        // If force parameter is provided, use it directly
        state.isShown = force
      } else if (state.actualTab === tabName && state.isShown) {
        // If clicking on the same tab and menu is open, close it
        state.isShown = false
      } else {
        // Otherwise open it
        state.isShown = true
      }

      // Save to localStorage (only if we have a valid username)
      if (username) {
        const preferences = getJSONItem(`preferences-${username}`) || {}
        preferences['userSideBarTab'] = tabName
        setJSONItem(`preferences-${username}`, preferences)
      }

      return state
    },
  },
})
