// Copyright (C) 2025 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import axios from 'axios'

const PATH = '/streaming'

import { handleNetworkError } from '../lib/utils'

export const getVideoSources = async () => {
  try {
    const response = await axios.get(`${PATH}/sources`)
    return response.data
  } catch (error) {
    handleNetworkError(error)
    throw error
  }
}

export interface StreamingToken {
  token: string
  expires_in: number
  whep: string
}

// Short-lived token used to authenticate on the video gateway (WHEP) of an "rtsp" source
export const getStreamingToken = async (id: string): Promise<StreamingToken> => {
  const response = await axios.post(`${PATH}/token`, { id })
  return response.data
}

// The gateway is published on the CTI host, the same host of the API (see config/axios.ts)
export const getWhepUrl = (whep: string) => {
  // @ts-ignore
  const base = `${window.CONFIG.API_SCHEME}${window.CONFIG.API_ENDPOINT}/`
  return new URL(whep, base).toString()
}

export const openVideoSource = async (obj: { id: string; gate?: string }) => {
  try {
    await axios.post(`${PATH}/open`, obj)
    return true
  } catch (error) {
    handleNetworkError(error)
    throw error
  }
}

export const subscribe = async (obj: any) => {
  try {
    await axios.post(`${PATH}/subscribe`, obj)
    return true
  } catch (error) {
    handleNetworkError(error)
    throw error
  }
}

export const unsubscribe = async (obj: any) => {
  try {
    await axios.post(`${PATH}/unsubscribe`, obj)
    return true
  } catch (error) {
    handleNetworkError(error)
    throw error
  }
}
