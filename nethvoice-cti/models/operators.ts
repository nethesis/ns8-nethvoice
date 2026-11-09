// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { createModel } from '@rematch/core'
import type { RootModel } from '.'

interface DefaultState {
  operators: any
  isOperatorsLoaded: boolean
  isLoading: boolean
  userEndpoints: Object
  isUserEndpointsLoaded: boolean
  groups: { [key: string]: { users: string[] } }
  isGroupsLoaded: boolean
  errorMessage: string
  extensions: Object
  isExtensionsLoaded: boolean
  avatars: Object
  isAvatarsLoaded: boolean
  favorites: string[]
  favoritesObject: any
  isFavoritesLoaded: boolean
}

const defaultState: DefaultState = {
  operators: {},
  isOperatorsLoaded: false,
  isLoading: false,
  userEndpoints: {},
  isUserEndpointsLoaded: false,
  groups: {},
  isGroupsLoaded: false,
  errorMessage: '',
  extensions: {},
  isExtensionsLoaded: false,
  avatars: {},
  isAvatarsLoaded: false,
  favorites: [],
  favoritesObject: {},
  isFavoritesLoaded: false,
}

export const operators = createModel<RootModel>()({
  state: defaultState,
  reducers: {
    setOperators: (state, operators: Object) => {
      state.operators = operators
      return state
    },
    setOperatorsLoaded: (state, isOperatorsLoaded: boolean) => {
      state.isOperatorsLoaded = isOperatorsLoaded
      return state
    },
    setLoading: (state, isLoading: boolean) => {
      state.isLoading = isLoading
      return state
    },
    setUserEndpoints: (state, userEndpoints: Object) => {
      state.userEndpoints = userEndpoints
      return state
    },
    setUserEndpointsLoaded: (state, isUserEndpointsLoaded: boolean) => {
      state.isUserEndpointsLoaded = isUserEndpointsLoaded
      return state
    },
    setGroups: (state, groups: { [key: string]: { users: string[] } }) => {
      state.groups = groups
      return state
    },
    setGroupsLoaded: (state, isGroupsLoaded: boolean) => {
      state.isGroupsLoaded = isGroupsLoaded
      return state
    },
    setErrorMessage: (state, errorMessage: string) => {
      state.errorMessage = errorMessage
      return state
    },
    setExtensions: (state, extensions: Object) => {
      state.extensions = extensions
      return state
    },
    setExtensionsLoaded: (state, isExtensionsLoaded: boolean) => {
      state.isExtensionsLoaded = isExtensionsLoaded
      return state
    },
    setAvatars: (state, avatars: Object) => {
      state.avatars = avatars
      return state
    },
    setAvatarsLoaded: (state, isAvatarsLoaded: boolean) => {
      state.isAvatarsLoaded = isAvatarsLoaded
      return state
    },
    setFavorites: (state, favorites: string[]) => {
      state.favorites = favorites
      return state
    },
    setFavoritesObjectComplete: (state, favorites: any) => {
      state.favoritesObject = favorites
      return state
    },
    setFavoritesLoaded: (state, isFavoritesLoaded: boolean) => {
      state.isFavoritesLoaded = isFavoritesLoaded
      return state
    },
    updateMainPresence: (state, operatorName: string, newMainPresence: string) => {
      const op = state?.operators[operatorName]

      if (!op) {
        return
      }
      op.mainPresence = newMainPresence
      return state
    },
    updateConversations: (state, operatorName: string, newConversations: any) => {
      const op = state?.operators[operatorName]

      if (!op) {
        return
      }
      let conversations: any = []

      Object.values(newConversations).forEach((conv) => {
        conversations.push(conv)
      })
      op.conversations = conversations

      return state
    },
    //update call forward status
    updateUserCallForwardStatus: (state: any, operatorName: string, newExtensions: any) => {
      const op = state.extensions[operatorName]

      if (!op) {
        return
      }

      op.cf = newExtensions
      return state
      // opExtension = newExtensions
    },
    //update extensions for user when receiving an exten update from WS
    updateExten: (state: any, operatorName: string, newExtensions: any) => {
      let op = state.extensions[operatorName]

      if (!op) {
        return
      }

      for (let prop in newExtensions) {
        if (newExtensions.hasOwnProperty(prop)) {
          if (op.hasOwnProperty(prop)) {
            op[prop] = newExtensions[prop]
          }
        }
      }

      return state
    },
  },
})
