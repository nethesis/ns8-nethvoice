// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { createModel } from '@rematch/core'
import type { RootModel } from '.'
import { INFINITE_SCROLL_QUEUE_OPERATORS_PAGE_SIZE } from '../lib/queuesLib'
import { sortByLoggedStatus } from '../lib/queuesLib'
import { sortByProperty } from '../lib/utils'

interface DefaultState {
  queues: any
  isLoaded: boolean
  isLoading: boolean
  errorMessage: string
  favoriteQueues: string[]
  expandedQueues: string[]
}

const defaultState: DefaultState = {
  queues: {},
  isLoaded: false,
  isLoading: false,
  errorMessage: '',
  favoriteQueues: [],
  expandedQueues: [],
}

interface ProcessQueueProps {
  queueData: any
  username: string
  mainextension: string
  operators: any
}

export const queues = createModel<RootModel>()({
  state: defaultState,
  reducers: {
    setQueues: (state, queues: Object) => {
      state.queues = queues
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
    setErrorMessage: (state, errorMessage: string) => {
      state.errorMessage = errorMessage
      return state
    },
    setQueueExpanded: (state, queueId: string, expanded: boolean) => {
      const queue = state.queues[queueId]
      queue.expanded = expanded
      return state
    },
    setQueueFavorite: (state, queueId: string, favorite: boolean) => {
      const queue = state.queues[queueId]
      queue.favorite = favorite
      return state
    },
    setFavoriteQueues: (state, favoriteQueues: string[]) => {
      state.favoriteQueues = favoriteQueues
      return state
    },
    setExpandedQueues: (state, expandedQueues: string[]) => {
      state.expandedQueues = expandedQueues
      return state
    },
    setWaitingCallsExpanded: (state, queueId: string, expanded: boolean) => {
      const queue = state.queues[queueId]
      queue.waitingCallsExpanded = expanded
      return state
    },
    setConnectedCallsExpanded: (state, queueId: string, expanded: boolean) => {
      const queue = state.queues[queueId]
      queue.connectedCallsExpanded = expanded
      return state
    },
    setOperatorsExpanded: (state, queueId: string, expanded: boolean) => {
      const queue = state.queues[queueId]
      queue.operatorsExpanded = expanded
      return state
    },
    updateActiveOperators: (state, queueId: string, isMemberActive: boolean) => {
      const queue = state?.queues[queueId]
      if (isMemberActive && queue?.numActiveOperators) {
        queue.numActiveOperators += 1
      } else if (!isMemberActive && queue?.numActiveOperators !== 0) {
        queue.numActiveOperators -= 1
      }
      return state
    },
    processQueue: (state, payload: ProcessQueueProps) => {
      let queueData = payload.queueData
      let queueId = queueData.queue
      const operators = payload.operators

      // convert caller position to number
      Object.values(queueData.waitingCallers).forEach((caller: any) => {
        caller.position = parseInt(caller.position)
      })

      // sort waiting callers
      queueData.waitingCallersList = Object.values(queueData.waitingCallers)
      queueData.waitingCallersList.sort(sortByProperty('position'))

      // compute active operators
      let numActiveOperators = 0

      Object.values(queueData.members).forEach((operator: any) => {
        if (operator.loggedIn && !operator.paused) {
          numActiveOperators++
        }
      })
      queueData.numActiveOperators = numActiveOperators

      // compute connected calls
      let connectedCalls: any[] = []

      Object.values(operators).forEach((operator: any) => {
        operator.conversations?.forEach((conversation: any) => {
          if (
            conversation?.throughQueue &&
            conversation?.connected &&
            conversation?.queueId === queueId
          ) {
            connectedCalls.push({ conversation, operatorUsername: operator?.username })
          }
        })
      })
      queueData.connectedCalls = connectedCalls

      // expanded sections
      queueData.waitingCallsExpanded = true
      queueData.connectedCallsExpanded = true
      queueData.operatorsExpanded = true

      // favorite
      if (state.favoriteQueues.includes(queueId)) {
        queueData.favorite = true
      } else {
        queueData.favorite = false
      }

      // expanded
      if (state.expandedQueues.includes(queueId)) {
        queueData.expanded = true
      } else {
        queueData.expanded = false
      }

      // infinite scroll operators

      const allQueueOperators = Object.values(queueData.members).sort(sortByLoggedStatus)

      queueData.infiniteScrollOperators = {
        operators: allQueueOperators.slice(0, INFINITE_SCROLL_QUEUE_OPERATORS_PAGE_SIZE),
        hasMore: INFINITE_SCROLL_QUEUE_OPERATORS_PAGE_SIZE < allQueueOperators.length,
        lastIndex: INFINITE_SCROLL_QUEUE_OPERATORS_PAGE_SIZE,
      }
      queueData.allQueueOperators = allQueueOperators

      state.queues[queueData.queue] = queueData
      return state
    },
    showMoreInfiniteScrollOperators: (state, queueId) => {
      const queueData = state.queues[queueId]
      const infiniteScrollOperators = queueData.infiniteScrollOperators
      const lastIndex =
        infiniteScrollOperators.lastIndex + INFINITE_SCROLL_QUEUE_OPERATORS_PAGE_SIZE
      infiniteScrollOperators.operators = queueData.allQueueOperators.slice(0, lastIndex)
      infiniteScrollOperators.hasMore = lastIndex < queueData.members.length
      return state
    },
    setConnectedCalls: (state, queueId, connectedCalls) => {
      state.queues[queueId].connectedCalls = connectedCalls
      return state
    },
    setQueueMember: (state, memberData: any) => {
      const queueId = memberData.queue
      const opMainExtension = memberData.member
      let queueData = state.queues[queueId]

      if (queueData) {
        queueData.members[opMainExtension] = memberData

        // sort operators
        queueData.allQueueOperators = Object.values(queueData.members).sort(sortByLoggedStatus)

        queueData.infiniteScrollOperators = {
          operators: queueData.allQueueOperators.slice(
            0,
            INFINITE_SCROLL_QUEUE_OPERATORS_PAGE_SIZE,
          ),
          hasMore: INFINITE_SCROLL_QUEUE_OPERATORS_PAGE_SIZE < queueData.allQueueOperators.length,
          lastIndex: INFINITE_SCROLL_QUEUE_OPERATORS_PAGE_SIZE,
        }
        state.queues[queueData.queue] = queueData
      }
      return state
    },
  },
})
