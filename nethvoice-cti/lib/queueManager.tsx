// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faMissed } from '@nethesis/nethesis-solid-svg-icons'
import { faXmark, faArrowLeft, IconDefinition } from '@fortawesome/free-solid-svg-icons'
import axios from 'axios'
import { cloneDeep } from 'lodash'
import { store } from '../store'
import { loadPreference, savePreference } from './storage'
import { handleNetworkError } from './utils'
import { intervalToDuration, format } from 'date-fns'
import { openShowOperatorDrawer } from '../lib/operators'
import {
  AMBER_600_SHADOW,
  BLUE_600_SHADOW,
  CYAN_600_SHADOW,
  EMERALD_600_SHADOW,
  EMERALD_800_SHADOW,
  GREEN_600_SHADOW,
  GREEN_800_SHADOW,
  INDIGO_600_SHADOW,
  LIME_600_SHADOW,
  PINK_600_SHADOW,
  PURPLE_600_SHADOW,
  ROSE_600_SHADOW,
  SKY_600_SHADOW,
  TEAL_600_SHADOW,
  VIOLET_600_SHADOW,
  YELLOW_600_SHADOW,
  TEAL_800_SHADOW,
  CYAN_800_SHADOW,
  SKY_800_SHADOW,
  BLUE_800_SHADOW,
  INDIGO_800_SHADOW,
  VIOLET_800_SHADOW,
  PURPLE_800_SHADOW,
  PINK_800_SHADOW,
  ROSE_800_SHADOW,
  AMBER_800_SHADOW,
  YELLOW_800_SHADOW,
  LIME_800_SHADOW,
} from './colors'
import { t } from 'i18next'

export const PAGE_SIZE = 10

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

export const processQueueManager = (
  queueManagerData: any,
  username: string,
  mainextension: string,
  operators: any,
) => {
  let queues: any = {}

  Object.values(queueManagerData).forEach((queue: any) => {
    queues[queue.queue] = queue
  })

  Object.values(queues).forEach((queueData: any) => {
    store.dispatch.queueManagerQueues.processQueue({
      queueData,
      username,
      mainextension,
      operators,
    })
  })

  store.dispatch.queueManagerQueues.setLoaded(true)
  store.dispatch.queueManagerQueues.setLoading(false)
}

export const retrieveQueueManager = async (
  username: string,
  mainextension: string,
  operators: any,
) => {
  store.dispatch.queueManagerQueues.setLoading(true)
  store.dispatch.queueManagerQueues.setLoaded(false)
  store.dispatch.queueManagerQueues.setErrorMessage('')
  let queueManagerData: any = null

  try {
    const res = await axios.get('/astproxy/qmanager_queues')
    queueManagerData = res.data
  } catch (error) {
    handleNetworkError(error)
    store.dispatch.queueManagerQueues.setErrorMessage('Cannot retrieve queues queue manager')
    store.dispatch.queueManagerQueues.setLoaded(true)
    store.dispatch.queueManagerQueues.setLoading(false)
  }

  // favorite queues

  const favoriteQueues = loadPreference('favoriteQueues', username) || []
  store.dispatch.queueManagerQueues.setFavoriteQueues(favoriteQueues)

  // expanded queues

  const expandedQueues = loadPreference('expandedQueues', username) || []
  store.dispatch.queueManagerQueues.setExpandedQueues(expandedQueues)

  processQueueManager(queueManagerData, username, mainextension, operators)
}

export const retrieveOnlyNotManaged = async (selectedQueues: string[]) => {
  try {
    const queues = selectedQueues.join(',')

    const { data } = await axios.get(
      `/astproxy/qmanager_queue_recall/12/${queues}/lost?limit=200&offset=0`,
    )
    return data
  } catch (error) {
    handleNetworkError(error)
    throw error
  }
}

export const retrieveSelectedNotManaged = async (selectedQueues: any) => {
  try {
    const { data } = await axios.get(
      `/astproxy/qmanager_queue_recall/12/${selectedQueues}/lost?limit=200&offset=0`,
    )
    return data
  } catch (error) {
    handleNetworkError(error)
    throw error
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
      `/astproxy/qmanager_queue_recall/${numHours}/${queues}/${outcomeFilter}?limit=200&offset=0`,
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

export function searchStringInQueuesMembers(operator: any, queryText: string) {
  const regex = /[^a-zA-Z0-9]/g
  queryText = queryText.replace(regex, '')
  let found = false

  // search in string attributes
  found = ['name', 'member'].some((attrName) => {
    return new RegExp(queryText, 'i').test(operator[attrName]?.replace(regex, ''))
  })

  if (found) {
    return true
  }
}

// Function to filter operators inside realtime tab
export function searchOperatorsInQueuesMembers(
  operator: any,
  queryText: string,
  queuesFilter: string[],
) {
  const regex = /[^a-zA-Z0-9]/g
  queryText = queryText.replace(regex, '')
  let found = false

  // search in string attributes
  found = ['name', 'member'].some((attrName) => {
    return new RegExp(queryText, 'i').test(operator[attrName]?.replace(regex, ''))
  })

  if (found && queuesFilter.some((queue) => operator.queues?.[queue]?.queue)) {
    return true
  }

  return false
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

// Get queueManager alarm
export async function getAlarm() {
  try {
    const { data } = await axios.get('/astproxy/qalarms')
    return data
  } catch (error) {
    handleNetworkError(error)
    throw error
  }
}

// Get queueManager queues information
export const getQueues = async () => {
  try {
    const { data } = await axios.get('/astproxy/qmanager_queues')
    return data
  } catch (error) {
    handleNetworkError(error)
  }
}

// Get queueManager queues history
export const getQueuesHistory = async () => {
  try {
    const { data } = await axios.get('/astproxy/qmanager_qcalls_hist')
    return data
  } catch (error) {
    handleNetworkError(error)
  }
}

//get queues status
export const getQueueStats = async (qid: any) => {
  try {
    const { data } = await axios.get('/astproxy/qmanager_qstats/' + qid)
    return data
  } catch (error) {
    handleNetworkError(error)
  }
}

// Get queueManager queues information
export const getAgentsStats = async () => {
  try {
    const { data } = await axios.get('/astproxy/qmanager_astats')
    return data
  } catch (error) {
    handleNetworkError(error)
  }
}

//Get total number of type for each failed calls
export function getTotalsForEachKey(callbackTimeRank: any) {
  let n = 0
  let list = {} as Record<string, any>
  for (let q in callbackTimeRank) {
    for (let v in callbackTimeRank[q].values) {
      list[n] = {
        name: callbackTimeRank[q].name,
        queue: callbackTimeRank[q].queue,
        note: v,
        values: {
          value: callbackTimeRank[q].values[v],
        },
      }
      n++
    }
  }

  return list
}

export function sortAgentsData(data: any[], sortOrder: any) {
  const sortedData = data.sort((a, b) => {
    if (sortOrder === 'asc') {
      return a.values - b.values
    } else {
      return b.values - a.values
    }
  })

  return sortedData.slice(0, 5)
  // return sortedData
}

//convert from seconds to human readable format
export function convertToHumanReadable(seconds: number | undefined) {
  if (seconds === 0 || seconds === undefined) {
    return '00:00:00'
  }

  const duration = intervalToDuration({ start: 0, end: seconds * 1000 })

  // Extract the hours, minutes and seconds from the formatted string
  const hours = duration.hours?.toString().padStart(2, '0') || '00'
  const minutes = duration.minutes?.toString().padStart(2, '0') || '00'
  const secondsTest = duration.seconds?.toString().padStart(2, '0') || '00'

  return `${hours}:${minutes}:${secondsTest}`
}

//Get chart values for each hours
export const groupDataByHour = (data: any) => {
  const dataArray = Array.isArray(data) ? data : data.data
  const groupedData: Record<string, any> = {}

  dataArray.forEach((item: any) => {
    const { date, stack, views } = item

    if (!groupedData[date]) {
      groupedData[date] = {}
    }

    groupedData[date][stack] = views
  })

  return groupedData
}

//Get line chart values for each hours and each queue
export const groupDataByHourLineChart = (data: any) => {
  const dataArray = Array.isArray(data) ? data : data.dataByTopic
  const groupedData = {} as Record<string, any>

  dataArray.forEach((item: any) => {
    const { topicName, dates } = item

    if (!groupedData[topicName]) {
      groupedData[topicName] = {}
    }

    dates.forEach((dateItem: any) => {
      const { date, value } = dateItem
      const hour = date.split('-')[3]

      groupedData[topicName][hour] = value
    })
  })

  return groupedData
}

// Get color for line chart
export const getRandomColor = (index: number) => {
  const colors = [
    GREEN_600_SHADOW,
    EMERALD_600_SHADOW,
    TEAL_600_SHADOW,
    CYAN_600_SHADOW,
    SKY_600_SHADOW,
    BLUE_600_SHADOW,
    INDIGO_600_SHADOW,
    VIOLET_600_SHADOW,
    PURPLE_600_SHADOW,
    PINK_600_SHADOW,
    ROSE_600_SHADOW,
    AMBER_600_SHADOW,
    YELLOW_600_SHADOW,
    LIME_600_SHADOW,
    SKY_600_SHADOW,
    BLUE_600_SHADOW,
    INDIGO_600_SHADOW,
    VIOLET_600_SHADOW,
    PURPLE_600_SHADOW,
    PINK_600_SHADOW,
    ROSE_600_SHADOW,
    AMBER_600_SHADOW,
  ]

  const colorIndex = index % colors?.length
  return colors[colorIndex]
}

export const getRandomColorDark = (index: number) => {
  const colorsDarkTheme = [
    GREEN_800_SHADOW,
    EMERALD_800_SHADOW,
    TEAL_800_SHADOW,
    CYAN_800_SHADOW,
    SKY_800_SHADOW,
    BLUE_800_SHADOW,
    INDIGO_800_SHADOW,
    VIOLET_800_SHADOW,
    PURPLE_800_SHADOW,
    PINK_800_SHADOW,
    ROSE_800_SHADOW,
    AMBER_800_SHADOW,
    YELLOW_800_SHADOW,
    LIME_800_SHADOW,
    SKY_800_SHADOW,
    BLUE_800_SHADOW,
    INDIGO_800_SHADOW,
    VIOLET_800_SHADOW,
    PURPLE_800_SHADOW,
    PINK_800_SHADOW,
    ROSE_800_SHADOW,
    AMBER_800_SHADOW,
  ]

  const colorIndex = index % colorsDarkTheme?.length
  return colorsDarkTheme[colorIndex]
}

//Get line chart values for each hours and each queue
export const groupDataByHourLineCallsChart = (data: any) => {
  const dataArray = Array.isArray(data) ? data : data.data
  const groupedData = {} as Record<string, any>

  dataArray.forEach((item: any) => {
    const { name, date, value } = item
    const hour = date.split('-')[3]

    if (!groupedData[name]) {
      groupedData[name] = {}
    }

    groupedData[name][hour] = value
  })

  return groupedData
}

//Get line chart values for invalid calls
export const groupDataFailedCallsHourLineChart = (data: any) => {
  const dataArray = Array.isArray(data) ? data : data.dataByTopic
  const groupedData = {} as Record<string, any>

  dataArray.forEach((item: any) => {
    const { topicName, dates } = item

    if (!groupedData[topicName]) {
      groupedData[topicName] = {}
    }

    dates.forEach((dateItem: any) => {
      const { date, value } = dateItem
      const hour = date.split('-')[3]

      groupedData[topicName][hour] = value
    })
  })

  return groupedData
}

//----------------------------------------------------------------
//Local storage section

export const DEFAULT_EXPANDED_OPERATORS = false
export const DEFAULT_EXPANDED_QUEUES = false

export const DEFAULT_OUTCOME_FILTER = 'lost'
export const DEFAULT_CALLS_REFRESH_INTERVAL = 20
export const DEFAULT_CALLS_LOAD_PERIOD = 12
export const INFINITE_SCROLL_QUEUE_OPERATORS_PAGE_SIZE = 15

export const DEFAULT_SORT_BY_QUEUE_MANAGEMENT = 'name'
export const DEFAULT_STATUS_FILTER_QUEUE_MANAGEMENT = 'all'

export const DEFAULT_SORT_BY_REALTIME = 'name'
export const DEFAULT_STATUS_FILTER_REALTIME = 'all'

export const DEFAULT_SORT_BY_SUMMARY = 'name'
export const DEFAULT_STATUS_FILTER_SUMMARY = 'all'

export const DEFAULT_EXPANDED_QUEUES_SUMMARY = false
export const DEFAULT_EXPANDED_OPERATORS_SUMMARY = false
export const DEFAULT_SUMMARY_SELECTED_QUEUE = {}

export const DEFAULT_EXPANDED_QUEUES_MANAGEMENT_DASHBOARD = false
export const DEFAULT_EXPANDED_QUEUES_MANAGEMENT_OPERATORS = false
export const DEFAULT_EXPANDED_QUEUES_MANAGEMENT_CONNECTED = false
export const DEFAULT_EXPANDED_QUEUES_MANAGEMENT_WAITING = false
export const DEFAULT_QUEUES_MANAGEMENT_SELECTED_QUEUE = {}

export const DEFAULT_EXPANDED_REALTIME_QUEUES_STATISTICS = false
export const DEFAULT_EXPANDED_REALTIME_OPERATOR_STATISTICS = false

export const DEFAULT_REALTIME_ROW_NUMBERS = 5
export const DEFAULT_REALTIME_FIRST_QUEUE_SELECTED = {}
export const DEFAULT_REALTIME_SECOND_QUEUE_SELECTED = {}
export const DEFAULT_REALTIME_IS_SECOND_CARD_VISIBLE = false

// Set default queue manager tab to dashboard
// export const DEFAULT_SELECTED_TAB_QUEUE_MANAGER = 'Dashboard'

export const getExpandedSummaryValue = (currentUsername: string) => {
  const expandedOperators =
    loadPreference('operatorsSummaryExpandedPreference', currentUsername) ||
    DEFAULT_EXPANDED_QUEUES_SUMMARY

  const expandedQueues =
    loadPreference('queuesSummaryExpandedPreference', currentUsername) ||
    DEFAULT_EXPANDED_QUEUES_SUMMARY

  return { expandedOperators, expandedQueues }
}

export const getFilterValues = (currentUsername: string) => {
  const outcome = loadPreference('queuesOutcomeFilter', currentUsername) || DEFAULT_OUTCOME_FILTER
  const selectedQueues = loadPreference('queueManagerSelectedQueues', currentUsername) || []
  return { outcome, selectedQueues }
}

export const getFilterValuesQueuesManagement = (currentUsername: string) => {
  const status =
    loadPreference('queueManagementStatusFilter', currentUsername) ||
    DEFAULT_STATUS_FILTER_QUEUE_MANAGEMENT
  const sortBy =
    loadPreference('queueManagementSortBy', currentUsername) || DEFAULT_SORT_BY_QUEUE_MANAGEMENT
  return { status, sortBy }
}

export const getFilterValuesRealtime = (currentUsername: string) => {
  const status =
    loadPreference('realtimeStatusFilter', currentUsername) || DEFAULT_STATUS_FILTER_REALTIME
  const sortBy = loadPreference('realtimeStatusSortBy', currentUsername) || DEFAULT_SORT_BY_REALTIME
  const selectedQueues = loadPreference('realtimeSelectedQueues', currentUsername) || []
  return { status, sortBy, selectedQueues }
}

export const getFilterValuesSummary = (currentUsername: string) => {
  const status =
    loadPreference('summaryOperatorStatusFilter', currentUsername) || DEFAULT_STATUS_FILTER_SUMMARY
  const sortBy = loadPreference('summaryOperatorSortBy', currentUsername) || DEFAULT_SORT_BY_SUMMARY
  const selectedQueues = loadPreference('summaryOperatorSelectedQueues', currentUsername) || []

  const selectedQueuesOperator =
    loadPreference('summaryOperatorSelectedQueuesOperator', currentUsername) || []
  return { status, sortBy, selectedQueues, selectedQueuesOperator }
}

export const getExpandedQueueManagerDashboardValue = (currentUsername: string) => {
  const expandedOperators =
    loadPreference('queueManagerDashboardOperatorsStatisticExpandedPreference', currentUsername) ||
    DEFAULT_EXPANDED_OPERATORS

  const expandedQueues =
    loadPreference('queueManagerQueuesStatisticExpandedPreference', currentUsername) ||
    DEFAULT_EXPANDED_QUEUES

  return { expandedOperators, expandedQueues }
}

export const getExpandedQueueManagamentValue = (currentUsername: string) => {
  const expandedQueueDashboard =
    loadPreference('queueManagementDashboardExpandedPreference', currentUsername) ||
    DEFAULT_EXPANDED_QUEUES_MANAGEMENT_DASHBOARD

  const expandedQueueOperators =
    loadPreference('queueManagementQueueOperatorsExpandedPreference', currentUsername) ||
    DEFAULT_EXPANDED_QUEUES_MANAGEMENT_OPERATORS

  const expandedWaitingCalls =
    loadPreference('queueManagementQueueWaitingCallsExpandedPreference', currentUsername) ||
    DEFAULT_EXPANDED_QUEUES_MANAGEMENT_WAITING

  const expandedConnectedCalls =
    loadPreference('queueManagementQueueConnectedCallsExpandedPreference', currentUsername) ||
    DEFAULT_EXPANDED_QUEUES_MANAGEMENT_CONNECTED

  const selectedQueue =
    loadPreference('queueManagementSelectedQueue', currentUsername) ||
    DEFAULT_QUEUES_MANAGEMENT_SELECTED_QUEUE

  return {
    expandedQueueDashboard,
    expandedQueueOperators,
    expandedWaitingCalls,
    expandedConnectedCalls,
    selectedQueue,
  }
}

export const getSelectedTabQueueManager = (currentUsername: string) => {
  const selectedQueueManagerTab = loadPreference('queueManagerSelectedTab', currentUsername) || ''
  return { selectedQueueManagerTab }
}

export const getExpandedRealtimeValue = (currentUsername: string) => {
  const expandedQueuesStatistics =
    loadPreference('queueManagerRealtimeQueuesPreference', currentUsername) ||
    DEFAULT_EXPANDED_REALTIME_QUEUES_STATISTICS

  const expandedOperatorsStatistics =
    loadPreference('queueManagerRealtimeOperatorPreference', currentUsername) ||
    DEFAULT_EXPANDED_REALTIME_OPERATOR_STATISTICS

  return { expandedQueuesStatistics, expandedOperatorsStatistics }
}

export const getMonitorValue = (currentUsername: string) => {
  const rowNumbers =
    loadPreference('monitorRowNumbers', currentUsername) || DEFAULT_REALTIME_ROW_NUMBERS

  const selectedFirstQueue =
    loadPreference('monitorFirstQueueSelected', currentUsername) ||
    DEFAULT_REALTIME_FIRST_QUEUE_SELECTED

  const selectedSecondQueue =
    loadPreference('monitorSecondQueueSelected', currentUsername) ||
    DEFAULT_REALTIME_FIRST_QUEUE_SELECTED

  const isSecondCardVisible =
    loadPreference('monitorSecondCardIsVisible', currentUsername) ||
    DEFAULT_REALTIME_IS_SECOND_CARD_VISIBLE
  return { rowNumbers, selectedFirstQueue, selectedSecondQueue, isSecondCardVisible }
}

//find totals
export const initTopSparklineChartsData = (queuesHistoryData: any) => {
  const queuesHistoryTotalized = {} as Record<string, any>

  for (const q in queuesHistoryData) {
    for (const c in queuesHistoryData[q]) {
      if (!queuesHistoryTotalized[c]) {
        queuesHistoryTotalized[c] = []
      }

      for (let i = 0; i < queuesHistoryData[q][c].length; i++) {
        if (!queuesHistoryTotalized[c][i]) {
          queuesHistoryTotalized[c][i] = {}
        }

        queuesHistoryTotalized[c][i].name = c
        queuesHistoryTotalized[c][i].fullDate = queuesHistoryData[q][c][i].fullDate
        queuesHistoryTotalized[c][i].date = queuesHistoryData[q][c][i].date

        if (!queuesHistoryTotalized[c][i].value) {
          queuesHistoryTotalized[c][i].value = 0
        }

        queuesHistoryTotalized[c][i].value += queuesHistoryData[q][c][i].value
      }
    }
  }
  return queuesHistoryTotalized
}

// Collect graph data information
export const initHourlyChartsDataPerQueues = (
  queuesHistoryData: any,
  dashboardData: any,
  queuesList: any,
) => {
  //create an empty object to collect chart data
  var queuesHistoryUnified: {
    stacked: {
      data: any[]
    }
    lineTotal: {
      dataByTopic: any[]
    }
    lineFailed: {
      dataByTopic: any[]
    }
    stackedBarComparison: {
      data: any[]
    }
  } = {
    stacked: {
      data: [],
    },
    lineTotal: {
      dataByTopic: [],
    },
    lineFailed: {
      dataByTopic: [],
    },
    stackedBarComparison: {
      data: [],
    },
  }

  let queuesUnified = {} as Record<string, any>

  //cycle through all queueHistory elements
  for (var q in queuesHistoryData) {
    for (let i = 0; i < queuesHistoryData[q].answered.length; i++) {
      //check if queueHistoryData is more than dashboard begin time
      if (new Date(queuesHistoryData[q]?.answered[i]?.fullDate) > dashboardData) {
        queuesHistoryData[q].answered[i].name = queuesList[q]?.name
        queuesHistoryUnified.stacked.data.push(queuesHistoryData[q].answered[i])
      }
    }

    // line chart total object
    var totalTopic: {
      topic: string
      topicName: string
      dates: any[]
    } = {
      topic: q,
      topicName: queuesList[q]?.name,
      dates: [],
    }
    for (let i = 0; i < queuesHistoryData[q]?.total?.length; i++) {
      if (new Date(queuesHistoryData[q]?.total[i]?.fullDate) > dashboardData) {
        totalTopic.dates.push(queuesHistoryData[q]?.total[i])
      }
    }

    queuesHistoryUnified.lineTotal.dataByTopic.push(totalTopic)

    // line chart failed
    var failedTopic: {
      topic: string
      topicName: string
      dates: any[]
    } = {
      topic: q,
      topicName: queuesList[q]?.name,
      dates: [],
    }
    for (let i = 0; i < queuesHistoryData[q]?.failed?.length; i++) {
      if (new Date(queuesHistoryData[q]?.failed[i]?.fullDate) > dashboardData) {
        failedTopic.dates.push(queuesHistoryData[q]?.failed[i])
      }
    }

    queuesHistoryUnified.lineFailed.dataByTopic.push(failedTopic)

    for (let i = 0; i < queuesHistoryData[q].total.length; i++) {
      const date = new Date(queuesHistoryData[q].total[i].fullDate)

      const hour = date.getHours()

      const minutes = date.getMinutes()

      const dateName = `${hour < 10 ? '0' + hour : hour}:${minutes == 0 ? '00' : minutes}`
      if (!queuesUnified[dateName])
        queuesUnified[dateName] = {
          date: date,
          answered: 0,
          failed: 0,
          invalid: 0,
        }
      queuesUnified[dateName].answered += queuesHistoryData[q].answered[i].value || 0
      queuesUnified[dateName].failed += queuesHistoryData[q].failed[i].value || 0
      queuesUnified[dateName].invalid += queuesHistoryData[q].invalid[i].value || 0
    }

    //cycle hours
    for (let k in queuesUnified) {
      //check if hour is inside date
      if (new Date(queuesUnified[k].date) > dashboardData) {
        queuesHistoryUnified.stackedBarComparison.data.push({
          date: k,
          stack: 'answered',
          views: queuesUnified[k].answered,
          valueLabel:
            (100 * queuesUnified[k].answered) /
            (queuesUnified[k].answered + queuesUnified[k].failed + queuesUnified[k].invalid),
        })
        queuesHistoryUnified.stackedBarComparison.data.push({
          date: k,
          stack: 'failed',
          views: queuesUnified[k].failed,
          valueLabel:
            (100 * queuesUnified[k].failed) /
            (queuesUnified[k].answered + queuesUnified[k].failed + queuesUnified[k].invalid),
        })
        queuesHistoryUnified.stackedBarComparison.data.push({
          date: k,
          stack: 'invalid',
          views: queuesUnified[k].invalid,
          valueLabel:
            (100 * queuesUnified[k].invalid) /
            (queuesUnified[k].answered + queuesUnified[k].failed + queuesUnified[k].invalid),
        })
      }
    }
  }
  return queuesHistoryUnified
}

// Get operators shortName to use inside avatar
export function getFullUsername(announcement: any, operatorInformation: any) {
  let shortname = ''
  if (announcement.name && operatorInformation) {
    const username = operatorInformation[announcement.name]
    if (username) {
      shortname = username
    }
  }
  return shortname
}

// Function to retrieve the queues' dashboard rank based on specified keys
export const getQueuesDashboardRank = (keys: any, queuesList: any) => {
  // Array to store queue data
  const result = []
  // Temporary variable to iterate over queues
  let queue: any

  for (queue of Object.values(queuesList)) {
    // Iterate over each queue in the queuesList object
    if (!isNaN(queue.queue)) {
      // Check if the 'queue' field of the queue is a number
      const queueData = {
        name: queue.name,
        queue: queue.queue,
        // Object to store queue statistics values
        values: {} as Record<string, any>,
      }

      // Iterate over the specified keys
      for (const key of keys) {
        // Assign the corresponding statistic value to the queue
        queueData.values[key] = queue.qstats?.[key] || 0
      }
      // Add the queue data to the result array
      result.push(queueData)
    }
  }

  // Return the array of queue data
  return result
}

export const agentsDashboardRanks = (keys: any, agentsStatsList: any) => {
  let n = 0
  const list = {} as Record<string, any>
  let q: any

  for (const agent in agentsStatsList) {
    for (q in agentsStatsList[agent]) {
      if (!isNaN(q)) {
        list[n] = {
          name: agent,
          queue: q,
          values: {},
        }

        for (const key of keys) {
          list[n].values[key] = agentsStatsList[agent][q][key] || 0
        }
        n++
      }
    }
  }

  return list
}

// Get queues name from queue number
export function getQueueName(agentName: any, queuesList: any) {
  const queue = queuesList[agentName]
  if (queue && queue.name) {
    return queue.name
  }
}

//set operator information to open operator drawer
export function setOperatorInformationDrawer(operatorData: any, operatorsStore: any) {
  let operatorInformationDataDrawer = null
  let operatorInformation = operatorsStore.operators
  if (operatorData.shortname && operatorInformation) {
    for (const username in operatorInformation) {
      if (username === operatorData.shortname) {
        operatorInformationDataDrawer = operatorInformation[username]
        openShowOperatorDrawer(operatorInformationDataDrawer)
      }
    }
  }
  return
}

// Get formatted hours from first element of alarm list
export function getFormattedTimeFromAlarmsList(alarmsList: any) {
  const firstAlarm = alarmsList.list[Object.keys(alarmsList.list)[0]]
  const alarmType = Object.keys(firstAlarm)[0]
  const alarmData = firstAlarm[alarmType]

  const timestamp = alarmData.date
  const formattedTime = format(new Date(timestamp), 'HH:mm')

  return formattedTime
}

// Get alarm description
export function getAlarmDescription(alarmsList: any, alarmsTypeObject: any) {
  const firstAlarm = alarmsList.list[Object.keys(alarmsList.list)[0]]
  const alarmType = Object.keys(firstAlarm)[0]
  const alarmDescription = alarmsTypeObject[alarmType]?.description || ''

  return alarmDescription
}

export const cardContent = (icon: any, number: number, description: string) => {
  return (
    <>
      <div className='rounded-lg shadow-md border-gray-200 dark:border-gray-700 bg-cardBackgroud dark:bg-cardBackgroudDark px-5 py-1 sm: mt-1 relative flex items-center'>
        <div className='flex items-center space-x-4'>
          <div className='h-10 w-10 flex items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-800 mt-1 mb-1'>
            <FontAwesomeIcon
              icon={icon}
              className='h-6 w-6 text-emerald-600 dark:text-emerald-100'
              aria-hidden='true'
            />
          </div>
          <div className='flex justify-center text-gray-900 dark:text-white'>
            <p className='text-3xl font-medium tracking-tight text-left leading-10'>
              {number || 0}
            </p>
          </div>
          <span className='text-sm flex justify-center font-medium leading-6 text-center'>
            {t(`QueueManager.${description}`)}
          </span>
        </div>
      </div>
    </>
  )
}
