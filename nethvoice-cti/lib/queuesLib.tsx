// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faMissed } from '@nethesis/nethesis-solid-svg-icons'
import { faXmark, faArrowLeft, IconDefinition } from '@fortawesome/free-solid-svg-icons'
import axios from 'axios'
import { cloneDeep } from 'lodash'
import { store } from '../store'
import { exactDistanceToNowLoc, formatDurationLoc } from './dateTime'
import { loadPreference, savePreference } from './storage'
import { handleNetworkError } from './utils'
import { useTranslation } from 'react-i18next'

export const PAGE_SIZE = 10
export const DEFAULT_OUTCOME_FILTER = 'lost'
export const DEFAULT_CALLS_REFRESH_INTERVAL = 20
export const DEFAULT_CALLS_LOAD_PERIOD = 12
export const CALLS_LOAD_ALL_DAY_HOURS = 24
export const DEFAULT_CALLS_LOAD_ALL_DAY = false
export const INFINITE_SCROLL_QUEUE_OPERATORS_PAGE_SIZE = 15

export const getQueuesCallsLoadPeriod = (currentUsername: string) => {
  const loadAllDay =
    loadPreference('queuesCallsLoadAllDay', currentUsername) ?? DEFAULT_CALLS_LOAD_ALL_DAY

  if (loadAllDay) {
    return CALLS_LOAD_ALL_DAY_HOURS
  }

  return loadPreference('queuesCallsLoadPeriod', currentUsername) || DEFAULT_CALLS_LOAD_PERIOD
}

export const searchStringInQueue = (queue: any, queryText: string) => {
  const regex = /[^a-zA-Z0-9]/g
  queryText = queryText.replace(regex, '')
  let found = false

  // search in string attributes
  found = ['name', 'queue'].some((attrName) => {
    return new RegExp(queryText, 'i').test(queue[attrName]?.replace(regex, ''))
  })

  if (found) {
    return true
  }
  return false
}

export const processQueues = (
  queuesData: any,
  username: string,
  mainextension: string,
  operators: any,
) => {
  let queues: any = {}

  // keep only user queues
  if (!queuesData) {
    return
  }

  Object.values(queuesData).forEach((queue: any) => {
    if (queue.members[mainextension]) {
      queues[queue.queue] = queue
    }
  })

  Object.values(queues).forEach((queueData: any) => {
    store.dispatch.queues.processQueue({ queueData, username, mainextension, operators })
  })

  store.dispatch.queues.setLoaded(true)
  store.dispatch.queues.setLoading(false)
}

export const retrieveQueues = async (username: string, mainextension: string, operators: any) => {
  store.dispatch.queues.setLoading(true)
  store.dispatch.queues.setLoaded(false)
  store.dispatch.queues.setErrorMessage('')
  let queuesData: any = null

  try {
    const res = await axios.get('/astproxy/queues')
    queuesData = res.data
  } catch (error) {
    handleNetworkError(error)
    store.dispatch.queues.setErrorMessage('Cannot retrieve queues')
    store.dispatch.queues.setLoaded(true)
    store.dispatch.queues.setLoading(false)
  }

  // favorite queues

  const favoriteQueues = loadPreference('favoriteQueues', username) || []
  store.dispatch.queues.setFavoriteQueues(favoriteQueues)

  // expanded queues

  const expandedQueues = loadPreference('expandedQueues', username) || []
  store.dispatch.queues.setExpandedQueues(expandedQueues)

  if (queuesData) {
    processQueues(queuesData, username, mainextension, operators)
  }
}

export const retrieveAndFilterQueueCalls = async (
  pageNum: number,
  textFilter: string,
  outcomeFilter: string,
  selectedQueues: string[],
  numHours: number,
  pageSize: number = PAGE_SIZE,
) => {
  try {
    // this api doesn't support text filter, so we need to retrieve a large page of elements, then filter results and keep only PAGE_SIZE elements

    const queues = selectedQueues.join(',')

    const { data } = await axios.get(
      `/astproxy/queue_recall/${numHours}/${queues}/${outcomeFilter}?limit=200&offset=0`,
    )

    const allFilteredCalls = data.rows.filter((call: any) => {
      return searchStringInCall(call, textFilter)
    })
    data.count = allFilteredCalls.length
    data.totalPages = Math.ceil(allFilteredCalls.length / pageSize)

    // select page
    const start = (pageNum - 1) * pageSize
    const end = start + pageSize
    data.rows = allFilteredCalls.slice(start, end)
    return data
  } catch (error) {
    handleNetworkError(error)
    throw error
  }
}

export const retrieveQueueStats = async () => {
  try {
    let { data } = await axios.get('/astproxy/queue_astats')

    // compute missing stats

    let lastLogin = 0
    let lastLogout = 0
    let lastCall = 0
    let answeredCalls = 0
    let missedCalls = 0

    Object.keys(data).map((queueNum: string) => {
      const queue = data[queueNum]

      // last login
      if (queue.last_login_time) {
        if (!lastLogin || lastLogin < queue.last_login_time) {
          lastLogin = queue.last_login_time
        }
      }

      // last logout
      if (queue.last_logout_time) {
        if (!lastLogout || lastLogout < queue.last_logout_time) {
          lastLogout = queue.last_logout_time
        }
      }

      // last call
      if (queue.last_call_time) {
        if (!lastCall || lastCall < queue.last_call_time) {
          lastCall = queue.last_call_time
        }
      }

      // answered calls
      if (queue.calls_taken) {
        answeredCalls += queue.calls_taken
      }

      // missed calls
      if (queue.no_answer_calls) {
        missedCalls += queue.no_answer_calls
      }
    })

    if (lastLogin) {
      data.lastLogin = new Date(lastLogin * 1000).toLocaleTimeString()
    }

    if (lastLogout) {
      data.lastLogout = new Date(lastLogout * 1000).toLocaleTimeString()
    }

    if (lastCall) {
      data.fromLastCall = exactDistanceToNowLoc(new Date(lastCall * 1000))
    }

    data.answeredCalls = answeredCalls
    data.missedCalls = missedCalls

    // time at phone
    data.timeAtPhone = formatDurationLoc(
      (data.outgoingCalls?.duration_outgoing || 0) + (data.incomingCalls?.duration_incoming || 0),
    )

    return data
  } catch (error) {
    handleNetworkError(error)
    throw error
  }
}

export const getFilterValues = (currentUsername: string) => {
  const outcome = loadPreference('queuesOutcomeFilter', currentUsername) || DEFAULT_OUTCOME_FILTER
  const selectedQueues = loadPreference('queuesSelectedQueues', currentUsername) || []
  return { outcome, selectedQueues }
}

export const searchStringInCall = (call: any, queryText: string) => {
  const regex = /[^a-zA-Z0-9]/g
  queryText = queryText.replace(regex, '')
  let found = false

  // search in string attributes
  found = ['name', 'company', 'cid'].some((attrName) => {
    return new RegExp(queryText, 'i').test(call[attrName]?.replace(regex, ''))
  })

  if (found) {
    return true
  }
  return false
}

export const getCallIcon = (call: any) => {
  switch (call.direction) {
    case 'IN':
      if (
        ['ANSWERED', 'DONE', 'COMPLETEAGENT', 'COMPLETECALLER', 'CONNECT', 'ENTERQUEUE'].includes(
          call.event,
        )
      ) {
        // positive outcome
        return (
          <FontAwesomeIcon
            icon={faArrowLeft}
            className='mr-2 h-5 w-3.5 -rotate-45 text-green-600 dark:text-green-400'
            aria-hidden='true'
          />
        )
      } else {
        // negative outcome
        return (
          <FontAwesomeIcon
            icon={faMissed as IconDefinition}
            className='mr-2 h-5 w-4 text-red-400 dark:text-red-500'
            aria-hidden='true'
          />
        )
      }
      break
    case 'OUT':
      if (
        ['ANSWERED', 'DONE', 'COMPLETEAGENT', 'COMPLETECALLER', 'CONNECT', 'ENTERQUEUE'].includes(
          call.event,
        )
      ) {
        // positive outcome
        return (
          <FontAwesomeIcon
            icon={faArrowLeft}
            className='mr-2 h-5 w-3.5 rotate-[135deg] text-green-600 dark:text-green-400'
            aria-hidden='true'
          />
        )
      } else {
        // negative outcome
        return (
          <FontAwesomeIcon
            icon={faXmark}
            className='mr-2 h-5 w-4 text-red-400 dark:text-red-500'
            aria-hidden='true'
          />
        )
      }
      break
  }
}

export const loginToQueue = async (endpointId: string, queueId: string) => {
  try {
    const { data, status } = await axios.post('/astproxy/queuemember_add', {
      endpointId,
      queueId,
    })
    return data
  } catch (error) {
    handleNetworkError(error)
    throw error
  }
}

export const logoutFromQueue = async (endpointId: string, queueId: string) => {
  try {
    const { data, status } = await axios.post('/astproxy/queuemember_remove', {
      endpointId,
      queueId,
    })
    return data
  } catch (error) {
    handleNetworkError(error)
    throw error
  }
}

export const pauseQueue = async (endpointId: string, queueId: string, reason: string) => {
  const payload: any = {
    endpointId,
    queueId,
  }

  if (reason) {
    payload.reason = reason
  }

  try {
    const { data, status } = await axios.post('/astproxy/queuemember_pause', payload)
    return data
  } catch (error) {
    handleNetworkError(error)
    throw error
  }
}

export const unpauseQueue = async (endpointId: string, queueId: string) => {
  try {
    const { data, status } = await axios.post('/astproxy/queuemember_unpause', {
      endpointId,
      queueId,
    })
    return data
  } catch (error) {
    handleNetworkError(error)
    throw error
  }
}

export const openShowQueueCallDrawer = (call: any, queues: any) => {
  if (!call.cid) {
    return
  }
  const config = { ...call, queues: cloneDeep(queues) }

  store.dispatch.sideDrawer.update({
    isShown: true,
    contentType: 'showQueueCall',
    config: config,
  })
}

export const retrieveQueueCallInfo = async (
  phoneNumber: string,
  queueId: string,
  numHours: number,
) => {
  try {
    const { data } = await axios.get(`/astproxy/qrecall_info/${numHours}/${phoneNumber}/${queueId}`)
    return data
  } catch (error) {
    handleNetworkError(error)
    throw error
  }
}

export const addQueueToFavorites = (queueId: string, currentUsername: string) => {
  const favoriteQueues = loadPreference('favoriteQueues', currentUsername) || []
  favoriteQueues.push(queueId)
  savePreference('favoriteQueues', favoriteQueues, currentUsername)
  store.dispatch.queues.setFavoriteQueues(favoriteQueues)
}

export const removeQueueFromFavorites = (queueId: string, currentUsername: string) => {
  let favoriteQueues = loadPreference('favoriteQueues', currentUsername) || []
  favoriteQueues = favoriteQueues.filter((q: string) => q !== queueId)
  savePreference('favoriteQueues', favoriteQueues, currentUsername)
  store.dispatch.queues.setFavoriteQueues(favoriteQueues)
}

export const addQueueToExpanded = (queueId: string, currentUsername: string) => {
  const expandedQueues = loadPreference('expandedQueues', currentUsername) || []

  if (!expandedQueues.includes(queueId)) {
    expandedQueues.push(queueId)
  }
  savePreference('expandedQueues', expandedQueues, currentUsername)
  store.dispatch.queues.setExpandedQueues(expandedQueues)
}

export const removeQueueFromExpanded = (queueId: string, currentUsername: string) => {
  let expandedQueues = loadPreference('expandedQueues', currentUsername) || []
  expandedQueues = expandedQueues.filter((q: string) => q !== queueId)
  savePreference('expandedQueues', expandedQueues, currentUsername)
  store.dispatch.queues.setExpandedQueues(expandedQueues)
}

/**
 * Get operator status on a queue
 */
export const getLoggedStatus = (operator: any) => {
  if (!operator.loggedIn) {
    return 'loggedOut'
  } else {
    if (operator.paused) {
      return 'paused'
    } else {
      return 'loggedIn'
    }
  }
}

/**
 * Sort function to order queue members by logged / paused attributes
 */
export const sortByLoggedStatus = (operator1: any, operator2: any) => {
  const loggedStatusRanking = ['loggedIn', 'paused', 'loggedOut']
  const status1 = getLoggedStatus(operator1)
  const status2 = getLoggedStatus(operator2)
  const rank1 = loggedStatusRanking.indexOf(status1)
  const rank2 = loggedStatusRanking.indexOf(status2)

  if (rank1 < rank2) {
    return -1
  }
  if (rank1 > rank2) {
    return 1
  }
  return 0
}

// Set default queue tab to Queues management

export const getSelectedTabQueue = (currentUsername: string) => {
  const selectedQueueTab = loadPreference('queueSelectedTab', currentUsername) || ''
  return { selectedQueueTab }
}

export async function setQueueUserPreferences(settingsStatus: any) {
  try {
    const { data, status } = await axios.post('/user/settings', settingsStatus)
    return data
  } catch (error) {
    handleNetworkError(error)
    throw error
  }
}
