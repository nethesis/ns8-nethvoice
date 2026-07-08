// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Contains the request to the APIs of the user
 */

import axios from 'axios'

/**
 * The path to the user endpoints
 */
const PATH = '/user'

/**
 *
 * Get the user info from the server
 *
 * @returns The user info
 */

export function getLoginUrl() {
  if (window == undefined) {
    return ''
  }
  // @ts-ignore
  return `${window.CONFIG.API_SCHEME + window.CONFIG.API_ENDPOINT}`
}

export const getUserInfo = async () => {
  try {
    const res = await axios.get(`${PATH}/me`)
    return res
  } catch (error) {
    console.error(error)
  }
}

export const getTimestamp = async () => {
  try {
    const res = await axios.get(`${PATH}/nethlink`)
    return res
  } catch (error) {
    console.error(error)
  }
}

export const loginBeforeDashboard = async (username: any, token: any) => {
  try {
    let apiUrl = getLoginUrl()
    let userUrlApi = apiUrl + '/api' + PATH

    const res = await axios.get(`${userUrlApi}/me`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })

    return res.data
  } catch (error) {
    console.error(error)

    throw new Error('Error')
  }
}

export const getParamUrl = async () => {
  try {
    const res = await axios.get(`${PATH}/paramurl`)
    return res
  } catch (error) {
    console.error(error)
  }
}

export const getSummaryCall = async (
  uniqueid: string,
  linkedid?: string,
  id?: number,
  switchboard?: boolean,
) => {
  try {
    const params: Record<string, any> = {}
    if (linkedid) params.linkedid = linkedid
    if (id) params.id = id
    if (switchboard) params.switchboard = true
    const res = await axios.get(`/summary/${uniqueid}`, {
      params: Object.keys(params).length ? params : undefined,
    })
    return res
  } catch (error: any) {
    if (error?.response?.status === 404 || error?.response?.status === 403) {
      return null
    }
    console.error('Error fetching summary:', error)
    throw error
  }
}

export const checkSummaryList = async (
  lookups: Array<{ uniqueid?: string; linkedid?: string }> | string[],
  switchboard?: boolean,
) => {
  if (!Array.isArray(lookups) || lookups.length === 0) {
    return { code: 200, data: [], message: 'success' }
  }

  try {
    const body: Record<string, any> =
      typeof lookups[0] === 'string'
        ? { uniqueids: lookups as string[] }
        : { lookups: lookups as Array<{ uniqueid?: string; linkedid?: string }> }
    if (switchboard) body.switchboard = true
    const res = await axios.post(`/history/statuses`, body)
    return res.data
  } catch (error: any) {
    const status = error?.response?.status
    const errorMessage = error?.response?.data?.message || error?.message || 'Unknown error'

    // Log error to console but don't crash the app
    console.error(`Error checking summary list (${status}):`, errorMessage)

    // Always return a valid response object with empty data
    return { code: status || 500, data: [], message: errorMessage }
  }
}

export const getTranscription = async (
  uniqueid: string,
  linkedid?: string,
  id?: number,
  switchboard?: boolean,
) => {
  try {
    const params: Record<string, any> = {}
    if (linkedid) params.linkedid = linkedid
    if (id) params.id = id
    if (switchboard) params.switchboard = true
    const res = await axios.get(`/transcripts/${uniqueid}`, {
      params: Object.keys(params).length ? params : undefined,
    })
    return res
  } catch (error: any) {
    if (error?.response?.status === 404) {
      return null
    }
    if (error?.response?.status === 403) {
      return null
    }
    throw error
  }
}

export const updateSummary = async (
  uniqueid: string,
  summary: string,
  linkedid?: string,
  id?: number,
  switchboard?: boolean,
) => {
  try {
    const params: Record<string, any> = {}
    if (linkedid) params.linkedid = linkedid
    if (id) params.id = id
    if (switchboard) params.switchboard = true
    const res = await axios.put(
      `/summary/${uniqueid}`,
      { summary },
      {
        params: Object.keys(params).length ? params : undefined,
      },
    )
    return res.data
  } catch (error: any) {
    console.error('Error updating summary:', error)
    throw error
  }
}
export const deleteSummary = async (uniqueid: string, linkedid?: string) => {
  try {
    const res = await axios.delete(`/summary/${uniqueid}`, {
      params: linkedid ? { linkedid } : undefined,
    })
    return res.data
  } catch (error: any) {
    console.error('Error deleting summary:', error)
    throw error
  }
}
