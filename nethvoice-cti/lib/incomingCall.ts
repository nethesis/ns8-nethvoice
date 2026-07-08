// Copyright (C) 2025 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { handleNetworkError } from './utils'
import axios from 'axios'

export async function setIncomingCallsPreference(settingsStatus: any) {
  try {
    const { data, status } = await axios.post('/user/settings', settingsStatus)
    return data
  } catch (error) {
    handleNetworkError(error)
    throw error
  }
}
