// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Containes methods used inside the TopBar
 */

import axios from 'axios'

const linkPresence = '/user/presence'

export async function changeStatusPresence(status: any) {
  try {
    const { data } = await axios.post(linkPresence, {
      status,
    })
    return data
  } catch (error) {
    console.error(error)
  }
}

export async function forwardStatus(status: any, to: number) {
  try {
    const { data } = await axios.post(linkPresence, {
      status,
      to,
    })
    return data
  } catch (error) {
    console.error(error)
  }
}
