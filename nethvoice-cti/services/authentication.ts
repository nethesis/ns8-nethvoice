// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Contains the request to the APIs of the authentication
 */

import axios, { AxiosResponse } from 'axios'
import { handleNetworkError } from '../lib/utils'
import { APITokenType, PhoneIslandCheckType } from './types'

/**
 * The path to token endpoints
 */
const PATH = '/tokens'
const PERSISTENT_PATH = `${PATH}/persistent`

const createPersistentToken = async (audience: string): Promise<APITokenType> => {
  try {
    const res: AxiosResponse = await axios.post(`${PERSISTENT_PATH}/${audience}`)
    return res.data
  } catch (error: any) {
    handleNetworkError(error)
    throw error
  }
}

const checkPersistentToken = async (audience: string): Promise<PhoneIslandCheckType> => {
  try {
    const res: AxiosResponse = await axios.get(`${PERSISTENT_PATH}/${audience}`)
    return res.data
  } catch (error: any) {
    handleNetworkError(error)
    throw error
  }
}

const removePersistentToken = async (audience: string): Promise<void> => {
  try {
    await axios.delete(`${PERSISTENT_PATH}/${audience}`)
  } catch (error: any) {
    handleNetworkError(error)
    throw error
  }
}

export const getPhoneIslandToken = async () => {
  return await createPersistentToken('phone-island')
}

/**
 * Checks if the island token exists for the user
 *
 * @returns An object with the exists boolean property
 */
export const phoneIslandTokenCheck = async () => {
  return await checkPersistentToken('phone-island')
}

/**
 * Revokes the phone island token for the current user
 */
export const removePhoneIslandToken = async () => {
  await removePersistentToken('phone-island')
}

/**
 * Generate a JWT token for QR code authentication
 *
 * @returns The username and the token
 */
export const generateQRcodeToken = async () => {
  return await createPersistentToken('mobile-app')
}
