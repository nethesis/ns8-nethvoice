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

export const openVideoSource = async (obj: any) => {
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
