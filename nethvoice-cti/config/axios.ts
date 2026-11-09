// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Contains the axios configuration methods
 */

import axios from 'axios'
import { store } from '../store'

/**
 * Set the default parameters for axios
 */
export const axiosSetup = () => {
  const { token } = store.getState().authentication

  // @ts-ignore
  axios.defaults.baseURL = window.CONFIG.API_SCHEME + window.CONFIG.API_ENDPOINT + '/api'
  axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
  axios.defaults.headers.post['Content-Type'] = 'application/json'
}
