// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Contains the request to the APIs of the user
 */

import axios from 'axios'

/**
 * The path to the user endpoints
 */
const PATH = '/profiling'

/**
 *
 * Get the user info from the server
 *
 * @returns The user info
 */

export const getProfilingInfo = async () => {
  try {
    const res = await axios.get(`${PATH}/all`)
    return res.data
  } catch (error) {
    console.error(error)
  }
}
