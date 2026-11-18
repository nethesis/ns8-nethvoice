// Copyright (C) 2026 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Contains the request to the APIs for password expiration and change
 */

import axios, { AxiosResponse } from 'axios'
import { handleNetworkError } from '../lib/utils'
import { PasswordInfo } from './types/password'

/**
 * Get the password expiration info of the logged in user
 */
export const getPasswordInfo = async (): Promise<PasswordInfo> => {
  try {
    const res: AxiosResponse = await axios.get('/password/info')
    return res.data.data
  } catch (error) {
    handleNetworkError(error)
    throw error
  }
}

/**
 * Change the password of the logged in user
 *
 * @throws The middleware error message, e.g. "error_password_length"
 */
export const changeUserPassword = async (currentPassword: string, newPassword: string) => {
  try {
    const res: AxiosResponse = await axios.post('/user/password', {
      current_password: currentPassword,
      new_password: newPassword,
    })
    return res.data
  } catch (error: any) {
    handleNetworkError(error)
    throw error?.response?.data?.message || 'error_unknown'
  }
}

/**
 * Change an expired password. There is no session yet: the current password
 * authenticates the request.
 *
 * @throws The middleware error message, e.g. "error_password_length"
 */
export const changeExpiredPassword = async (
  username: string,
  currentPassword: string,
  newPassword: string,
) => {
  let res: Response
  try {
    res = await fetch(
      // @ts-ignore
      window.CONFIG.API_SCHEME + window.CONFIG.API_ENDPOINT + '/api/password/change',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: username,
          current_password: currentPassword,
          new_password: newPassword,
        }),
      },
    )
  } catch (error) {
    handleNetworkError(error)
    throw 'error_unknown'
  }

  if (!res.ok) {
    const data = await res.json().catch(() => null)
    throw data?.message || 'error_unknown'
  }
}
