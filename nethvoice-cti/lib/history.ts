// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import axios from 'axios'
import { handleNetworkError, callPhoneNumber } from './utils'
import { store } from '../store'
import { loadPreference } from './storage'
import { getOperatorByPhoneNumber, openShowOperatorDrawer } from './operators'
import { cloneDeep } from 'lodash'

export const PAGE_SIZE = 10
export const DEFAULT_CALL_TYPE_FILTER = 'user'
export const DEFAULT_CALL_DIRECTION_FILTER = 'all'
export const DEFAULT_SORT_BY = 'time%20desc'
export const DEFAULT_CONTENT_FILTER = 'all'

export function getHistoryUrl() {
  if (window == undefined) {
    return ''
  }
  // @ts-ignore
  return `${window.CONFIG.API_SCHEME + window.CONFIG.API_ENDPOINT}`
}

export async function search(
  callType: string,
  username: string,
  from: string,
  to: string,
  textSearch: string,
  sort: string,
  type: string,
  pageNum: number,
  pageSize: number = PAGE_SIZE,
  contentFilter: string = DEFAULT_CONTENT_FILTER,
) {
  if (window == undefined) {
    return
  }
  // Always route through the middleware endpoint so that server-side enrichment
  // (e.g. Local-channel routing-artifact row correction) is applied uniformly,
  // regardless of the active content filter.
  try {
    const { data } = await axios.get('/history/calls', {
      params: {
        callType,
        username,
        from,
        to,
        textSearch,
        sort,
        direction: type,
        pageNum,
        pageSize,
        artifact: contentFilter,
      },
    })
    return data
  } catch (error) {
    handleNetworkError(error)
    throw error
  }
}

export const openDrawerHistory = (
  name: string,
  company: string,
  number: string,
  callType: string,
  operators: any,
) => {
  // check if phone number belongs to an operator
  const operatorFound: any = getOperatorByPhoneNumber(number, operators)

  if (operatorFound) {
    const operator = cloneDeep(operatorFound)
    operator.lastCallsType = callType

    // show operator drawer
    openShowOperatorDrawer(operator)
  } else {
    // show history drawer
    if (number !== 's' && number !== '') {
      let contact = {
        name: name,
        company: company,
        number: number,
        callType: callType,
      }

      store.dispatch.sideDrawer.update({
        isShown: true,
        contentType: 'showContactHistory',
        config: contact,
      })
    }
  }
}

export async function searchDrawerHistoryUser(
  username: string,
  dataBeginSearch: string,
  dateEndSearch: string,
  number: string,
  sort: string,
  pageSize: number = PAGE_SIZE,
) {
  let apiUrl = getHistoryUrl()
  let historycallUrlApiUser =
    apiUrl +
    '/api/historycall/interval/user/' +
    username +
    '/' +
    dataBeginSearch +
    '/' +
    dateEndSearch +
    '/' +
    number +
    '?offset=0&limit=' +
    pageSize +
    '&sort=' +
    sort +
    '&removeLostCalls=false'

  try {
    const { data, status } = await axios.get(historycallUrlApiUser)
    return data
  } catch (error) {
    handleNetworkError(error)
    throw error
  }
}

export async function searchDrawerHistorySwitchboard(
  dataBeginSearch: string,
  dateEndSearch: string,
  number: string,
  sort: string,
  pageSize: number = PAGE_SIZE,
) {
  let apiUrl = getHistoryUrl()
  number = number.trim()
  let historycallUrlApiSwitchboard =
    apiUrl +
    '/api/histcallswitch/interval/' +
    dataBeginSearch +
    '/' +
    dateEndSearch +
    '/' +
    number +
    '?offset=0&limit=' +
    pageSize +
    '&sort=' +
    sort +
    '&removeLostCalls=false'
  try {
    const { data, status } = await axios.get(historycallUrlApiSwitchboard)
    return data
  } catch (error) {
    handleNetworkError(error)
    throw error
  }
}

export const getFilterValues = (currentUsername: string) => {
  const callType =
    loadPreference('historyCallTypeFilter', currentUsername) || DEFAULT_CALL_TYPE_FILTER

  const callDirection =
    loadPreference('historyCallTypeDirection', currentUsername) || DEFAULT_CALL_DIRECTION_FILTER

  const sortBy = loadPreference('historySortTypePreference', currentUsername) || DEFAULT_SORT_BY
  const contentFilter =
    loadPreference('historyContentFilter', currentUsername) || DEFAULT_CONTENT_FILTER

  return { callType, callDirection, sortBy, contentFilter }
}

export const openAddToPhonebookDrawer = (operator: any) => {
  store.dispatch.sideDrawer.update({
    isShown: true,
    contentType: 'addToPhonebookDrawer',
    config: operator,
  })
}

export const callUser = (user: any, event: any = undefined) => {
  const phoneNumber = user.number
  callPhoneNumber(phoneNumber)

  // stop propagation of click event
  if (event) {
    event.stopPropagation()
  }
}

export const getLastCalls = async (
  username: string,
  dateFrom: string,
  dateTo: string,
  sort: SortTypes = 'time_desc',
): Promise<LastCallsResponse> => {
  try {
    if (sort === 'time_desc') {
      sort = 'time%20desc'
    } else if (sort === 'time_asc') {
      sort = 'time%20asc'
    }

    const requestUrl = `${getHistoryUrl()}/api/historycall/interval/user/${username}/${dateFrom}/${dateTo}?offset=0&limit=15&sort=${sort}&removeLostCalls=undefined`
    const { data, status } = await axios.get(requestUrl)

    if (status === 200) {
      return data
    } else {
      throw 'Error retrieving the last calls'
    }
  } catch (error) {
    handleNetworkError(error)
    throw error
  }
}

export const downloadCallRec = async (idRecording: string) => {
  try {
    const requestUrl = `${getHistoryUrl()}/api/historycall/down_callrec/${idRecording}`
    const { data, status } = await axios.get(requestUrl)

    if (status === 200) {
      return data
    } else {
      throw 'Error retrieving recording'
    }
  } catch (error) {
    handleNetworkError(error)
    throw error
  }
}

export const deleteRec = async (idRecording: string) => {
  try {
    const requestUrl = `${getHistoryUrl()}/api/historycall/delete_callrec`
    const { data, status } = await axios.post(requestUrl, { id: idRecording })

    if (status === 200) {
      return data
    } else {
      throw 'Error removing recording'
    }
  } catch (error) {
    handleNetworkError(error)
    throw error
  }
}

export interface CallTypes {
  time: number
  channel: string
  dstchannel: string
  uniqueid: string
  linkedid: string
  userfield: string
  duration: number
  billsec: number
  disposition: string
  normalized_disposition?: string
  dcontext: string
  lastapp?: string
  lastdata?: string
  recordingfile: string
  cnum: string
  cnam: string
  ccompany: string
  src: string
  dst: string
  dst_cnam: string
  dst_ccompany: string
  clid: string
  direction: 'in' | 'out'
  queue: string
  reached_voicemail?: boolean
  has_voicemail_message?: boolean
  voicemail_message_id?: string
}

export interface LastCallsResponse {
  count: number
  rows: CallTypes[]
}

export type SortTypes = 'time_desc' | 'time_asc' | string

type CallDispositionLike = {
  disposition?: string
  normalized_disposition?: string
}

type CallVoicemailLike = {
  has_voicemail_message?: boolean
}

export const getNormalizedDisposition = (call?: CallDispositionLike) =>
  call?.normalized_disposition || call?.disposition || ''

export const isCallAnswered = (call?: CallDispositionLike) =>
  getNormalizedDisposition(call) === 'ANSWERED'

export const hasVoicemailMessage = (call?: CallVoicemailLike) =>
  call?.has_voicemail_message === true

/**
 * Returns the effective display name for a call party.
 * Returns empty string when the name field is identical to the phone number,
 * which happens for external calls where the system stores the caller number as CNAM.
 */
export function getEffectiveCnam(
  cnam: string | undefined,
  phoneNumber: string | undefined,
): string {
  const name = cnam?.trim() ?? ''
  const number = phoneNumber?.trim() ?? ''
  return name !== '' && name !== number ? name : ''
}
