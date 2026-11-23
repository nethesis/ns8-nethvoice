// Copyright (C) 2026 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { createModel } from '@rematch/core'
import type { RootModel } from '.'

// Conversation list published by chat-island.
export interface ChatConversation {
  peer: string
  kind: 'chat' | 'group'
  name: string
  avatar?: string
  online: boolean
  mobile?: boolean
  inactive?: boolean
  owner?: boolean
  unread: number
  members?: string[]
  guests?: Record<string, string> // people outside the PBX in the group: guest id -> their name there
  locked?: boolean // that group's link no longer lets anyone in (made private or expired)
  last?: { body: string; ts: number; mine: boolean; oob?: string; nick?: string }
  muted?: boolean
}

interface DefaultState {
  host: 'nethlink' | 'cti' // where the person keeps the chat windows while NethLink runs
  status: string
  unread: number
  conversations: ChatConversation[]
  // Groups and recent messages loaded: until then the list is partial.
  ready: boolean
}

const defaultState: DefaultState = {
  host: 'nethlink',
  status: 'offline',
  unread: 0,
  conversations: [],
  ready: false,
}

export const chat = createModel<RootModel>()({
  state: defaultState,
  reducers: {
    setHost: (state, host: 'nethlink' | 'cti') => {
      state.host = host
      return state
    },
    setStatus: (state, status: string) => {
      state.status = status
      return state
    },
    setUnread: (state, unread: number) => {
      state.unread = unread
      return state
    },
    setConversations: (state, { conversations, ready }: { conversations: ChatConversation[]; ready?: boolean }) => {
      state.conversations = conversations
      state.ready = !!ready
      return state
    },
  },
})
