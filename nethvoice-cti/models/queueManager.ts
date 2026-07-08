// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { createModel } from '@rematch/core'
import type { RootModel } from '.'
import { INFINITE_SCROLL_QUEUE_OPERATORS_PAGE_SIZE } from '../lib/queuesLib'
import { sortByLoggedStatus } from '../lib/queuesLib'
import { sortByProperty, invertObject } from '../lib/utils'

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

interface ProcessQueuemanagerProps {
  queueData: any
  username: string
  mainextension: string
  operators: any
}

export const queueManagerQueues = createModel<RootModel>()({
  state: defaultState,
  reducers: {
    setQueueManagerQueues: (state, queues: Object) => {
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
    setQstats: (state, queueId: string, expanded: boolean) => {
      const queue = state.queues[queueId]
      queue.qStats = expanded
      return state
    },
    processQueue: (state, payload: ProcessQueuemanagerProps) => {
      let queueData: any = {}
      queueData = { ...payload.queueData }
      const queueId = queueData.queue
      const operators = payload.operators

      const updatedWaitingCallers = Object.values(queueData.waitingCallers).map((caller: any) => {
        const updatedCaller = { ...caller }
        updatedCaller.position = parseInt(updatedCaller.position)
        return updatedCaller
      })

      queueData.waitingCallers = updatedWaitingCallers
      queueData.waitingCallersList = Object.values(queueData.waitingCallers).sort(
        sortByProperty('position'),
      )

      const updatedMembers: any = {}
      Object.values(queueData.members).forEach((operator: any) => {
        let fullName = operator.name
        let invertedOperatorInformation = invertObject(operators)
        if (fullName && invertedOperatorInformation) {
          const username = invertedOperatorInformation[fullName]
          if (username) {
            updatedMembers[operator.member] = {
              ...operator,
              shortname: username,
            }
          } else {
            updatedMembers[operator.member] = operator
          }
        }
      })

      queueData.members = updatedMembers

      let numActiveOperators = 0
      Object.values(queueData?.members).forEach((operator: any) => {
        if (operator?.loggedIn && !operator?.paused) {
          numActiveOperators++
        }
      })
      queueData.numActiveOperators = numActiveOperators

      let onlineOperators = 0
      Object.values(queueData?.members).forEach((operator: any) => {
        if (operator.loggedIn) {
          onlineOperators++
        }
      })
      queueData.onlineOperators = onlineOperators

      let numPausedOperators = 0
      Object.values(queueData.members).forEach((operator: any) => {
        if (operator.loggedIn && operator.paused) {
          numPausedOperators++
        }
      })
      queueData.numPausedOperators = numPausedOperators

      let totalOperators = 0
      Object.values(queueData.members).forEach((operator: any) => {
        totalOperators++
      })

      queueData.totalOperators = totalOperators

      let connectedCalls: any[] = []
      Object.values(operators).forEach((operator: any) => {
        operator?.conversations?.forEach((conversation: any) => {
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

      queueData.waitingCallsExpanded = true
      queueData.connectedCallsExpanded = true
      queueData.operatorsExpanded = true

      queueData.favorite = state.favoriteQueues.includes(queueId)
      queueData.expanded = state.expandedQueues.includes(queueId)

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
      if (state.queues[queueId]) {
        state.queues[queueId].connectedCalls = connectedCalls
      }
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
