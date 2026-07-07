// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import axios from 'axios'
import { handleNetworkError, getApiEndpoint, getApiScheme } from './utils'
import { store } from '../store'
import { loadPreference } from './storage'
import { eventDispatch } from './hooks/eventDispatch'

export const PAGE_SIZE = 10
export const DEFAULT_SORT_BY = 'description'
export const DEFAULT_SORT_BY_ANNOUNCEMENT = 'description'
export const DEFAULT_CONFIGURATION_TYPE = 'all'

const apiEnpoint = getApiEndpoint()
const apiScheme = getApiScheme()
const apiUrl = apiScheme + apiEnpoint + '/api'
let type = ''

export const searchStringInLines = (lines: any, queryText: string, type: string) => {
  const regex = /[^a-zA-Z0-9]/g
  queryText = queryText.replace(regex, '')
  let found = false

  if (type === 'phoneLines') {
    // search in string attributes phone lines
    found = ['description', 'callerIdNum', 'calledIdNum'].some((attrName) => {
      return new RegExp(queryText, 'i').test(lines[attrName]?.replace(regex, ''))
    })

    if (found) {
      return true
    }
    return false
  } else {
    // search in string attributes announcement
    found = ['description', 'username', 'privacy'].some((attrName) => {
      return new RegExp(queryText, 'i').test(lines[attrName]?.replace(regex, ''))
    })

    if (found) {
      return true
    }
    return false
  }
}

export const setFilteredListByConfigurations = (lines: any, configurations: any) => {
  let found = false
  if (configurations === 'active') {
    if (
      lines.offhour &&
      lines.offhour.enabled &&
      (lines.offhour.enabled === 'period' || lines.offhour === 'always')
    ) {
      found = true
    }
  } else {
    if (
      (lines.offhour && lines.offhour.enabled && lines.offhour.enabled === 'never') ||
      !lines.offhour
    ) {
      found = true
    }
  }
  return found
}

// Get phone lines list
export const retrieveLines = async (textFilter: string, pageNum: any, configuration: any) => {
  let userUrlApi = apiUrl + '/offhour/list'
  type = 'phoneLines'

  try {
    const { data, status } = await axios.get(userUrlApi)
    if (configuration === 'all') {
      const allFilteredCalls = Object.values(data).filter((calls: any) => {
        return searchStringInLines(calls, textFilter, type)
      })
      data.count = allFilteredCalls.length
      data.totalPages = Math.ceil(allFilteredCalls.length / PAGE_SIZE)
      const start = (pageNum - 1) * PAGE_SIZE
      const end = start + PAGE_SIZE
      data.rows = allFilteredCalls.slice(start, end)
      return data
    } else {
      const onlyFilteredLines = Object.values(data).filter((calls: any) => {
        return setFilteredListByConfigurations(calls, configuration)
      })
      const allFilteredCalls = Object.values(onlyFilteredLines).filter((calls: any) => {
        return searchStringInLines(calls, textFilter, type)
      })
      data.count = allFilteredCalls.length
      data.totalPages = Math.ceil(allFilteredCalls.length / PAGE_SIZE)
      const start = (pageNum - 1) * PAGE_SIZE
      const end = start + PAGE_SIZE
      data.rows = allFilteredCalls.slice(start, end)
      return data
    }
  } catch (error) {
    handleNetworkError(error)
    throw error
  }
}

// Get announcements list
export async function getAnnouncementsFiltered(textFilter: string, pageNum: any) {
  let userUrlApi = apiUrl + '/offhour/list_announcement'
  type = 'announcement'

  try {
    const { data, status } = await axios.get(userUrlApi)
    const allFilteredCalls = Object.values(data).filter((calls: any) => {
      return searchStringInLines(calls, textFilter, type)
    })
    data.count = allFilteredCalls?.length
    data.totalPages = Math.ceil(allFilteredCalls?.length / PAGE_SIZE)

    data.start = (pageNum - 1) * PAGE_SIZE
    data.end = data.start + PAGE_SIZE
    data.rows = allFilteredCalls

    return data
  } catch (error) {
    handleNetworkError(error)
    throw error
  }
}

// Get announcements list
export async function getAnnouncements() {
  let userUrlApi = apiUrl + '/offhour/list_announcement'

  try {
    const { data, status } = await axios.get(userUrlApi)
    return data
  } catch (error) {
    handleNetworkError(error)
    throw error
  }
}

// Set record announcent
export async function setRecordMsg() {
  let userUrlApi = apiUrl + '/offhour/record_announcement'

  try {
    const { data, status } = await axios.post(userUrlApi)
    return data
  } catch (error) {
    handleNetworkError(error)
    throw error
  }
}

// Set offhour
export async function setOffHour(offHourElement: any) {
  let userUrlApi = apiUrl + '/offhour/set_offhour'

  try {
    const { data, status } = await axios.post(userUrlApi, offHourElement)
    return data
  } catch (error) {
    handleNetworkError(error)
    throw error
  }
}

// Enable message
export async function enableMsg(msgElement: any) {
  let userUrlApi = apiUrl + '/offhour/enable_announcement'

  try {
    const { data, status } = await axios.post(userUrlApi, msgElement)
    return data
  } catch (error) {
    handleNetworkError(error)
    throw error
  }
}

// Delete message
export async function deleteMsg(msgElement: string) {
  let userUrlApi = apiUrl + '/offhour/delete_announcement'
  let objectToSend = {
    id: msgElement.toString(),
  }
  try {
    const { data, status } = await axios.post(userUrlApi, objectToSend)
    return data
  } catch (error) {
    handleNetworkError(error)
    throw error
  }
}

// Modify message
export async function modifyMsg(msgElement: any) {
  let userUrlApi = apiUrl + '/offhour/modify_announcement'

  try {
    const { data, status } = await axios.post(userUrlApi, msgElement)
    return data
  } catch (error) {
    handleNetworkError(error)
    throw error
  }
}

// Upload audio message
export async function uploadAudioMsg(msgElement: any) {
  let userUrlApi = apiUrl + '/offhour/upload_announcement'
  try {
    const { data, status } = await axios.post(userUrlApi, msgElement)
    return data
  } catch (error) {
    handleNetworkError(error)
    throw error
  }
}

// Listen audio message
export async function listenMsg(keyMessage: any) {
  let userUrlApi = apiUrl + '/offhour/listen_announcement/' + keyMessage

  try {
    const { data, status } = await axios.get(userUrlApi)
    return data
  } catch (error) {
    handleNetworkError(error)
    throw error
  }
}

// Download audio message
export async function downloadMsg(keyMessage: any) {
  let userUrlApi = apiUrl + '/offhour/download_announcement/' + keyMessage

  let pathForDownload: any = userUrlApi
  try {
    const { data } = await axios.get(userUrlApi)
    return data
  } catch (error) {
    handleNetworkError(error)
    throw error
  }
}

export const openShowPhoneLinesDrawer = (object: any) => {
  const config = object

  store.dispatch.sideDrawer.update({
    isShown: true,
    contentType: 'showPhoneLines',
    config: config,
  })
}

// Call this drawer if user select multiple lines
export const openEditMultipleLinesDrawer = (object: any) => {
  const config = object

  store.dispatch.sideDrawer.update({
    isShown: true,
    contentType: 'showMultiplePhoneLines',
    config: config,
  })
}

export const openCreateAnnouncementDrawer = () => {
  store.dispatch.sideDrawer.update({
    isShown: true,
    contentType: 'showTelephoneAnnouncement',
    config: { isEdit: false },
  })
}

export const openEditAnnouncementDrawer = (
  description: any,
  announcement_id: any,
  privacy: any,
) => {
  store.dispatch.sideDrawer.update({
    isShown: true,
    contentType: 'showTelephoneAnnouncement',
    config: {
      isEdit: true,
      description: description,
      announcement_id: announcement_id,
      privacy: privacy,
    },
  })
}

export const openShowRuleDetailsDrawer = (name: any) => {
  const config = { name }

  store.dispatch.sideDrawer.update({
    isShown: true,
    contentType: 'showRuleDetails',
    config: config,
  })
}

export const getFilterValues = (currentUsername: string) => {
  const sortBy = loadPreference('phoneLinesSortBy', currentUsername) || DEFAULT_SORT_BY
  const configurationType =
    loadPreference('phoneLinesConfigurationType', currentUsername) || DEFAULT_CONFIGURATION_TYPE

  return { sortBy, configurationType }
}

export const getFilterAnnouncementValues = (currentUsername: string) => {
  const sortBy = loadPreference('phoneAnnouncementSortBy', currentUsername) || DEFAULT_SORT_BY
  return { sortBy }
}

export function reloadPhoneLines() {
  store.dispatch.phoneLines.reload()
}

export function reloadAnnouncement() {
  store.dispatch.announcement.reload()
}

//phone island events

// The event to show the recording view.
export function recordingAnnouncement(type: string) {
  if (type === 'physical' || type === 'nethlink') {
    eventDispatch('phone-island-physical-recording-view', {})
  } else {
    eventDispatch('phone-island-recording-open', {})
  }
}

export const getSelectedLinesManager = (currentUsername: string) => {
  const selectedLinesTab = loadPreference('linesSelectedTab', currentUsername) || ''
  return { selectedLinesTab }
}
