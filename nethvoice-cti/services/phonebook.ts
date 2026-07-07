// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Contains the request to the APIs of the phonebook
 */

import axios, { AxiosResponse } from 'axios'
import { NewSpeedDialType, SpeedDialType } from './types'
import { handleNetworkError } from '../lib/utils'

/**
 * The path to the user endpoints
 */
const PATH = '/phonebook'

/**
 *
 * Get the speed dials
 *
 * @returns The speed dials
 */

export const getSpeedDials = async () => {
  try {
    const res: AxiosResponse = await axios.get(`${PATH}/speeddials`)
    const data: NewSpeedDialType[] = res.data
    return data || []
  } catch (error) {
    handleNetworkError(error)
    throw error
  }
}

/**
 *
 * Create a new speed dial
 *
 * @returns The speed dials
 */

export const createSpeedDial = async (create: NewSpeedDialType) => {
  try {
    const newSpeedDial: NewSpeedDialType = {
      name: create.name,
      privacy: 'private',
      favorite: true,
      selectedPrefNum: 'extension',
      setInput: '',
      type: 'speeddial',
      speeddial_num: create.speeddial_num,
      notes: "speeddial-basic",
    }
    await axios.post(`${PATH}/create`, newSpeedDial)
    return newSpeedDial
  } catch (error) {
    handleNetworkError(error)
    throw error
  }
}

/**
 *
 * Create a new speed dial, type favorite
 *
 * @returns The speed dials
 */

export const createSpeedDialFavorite = async (create: NewSpeedDialType) => {
  try {
    const newSpeedDial: NewSpeedDialType = {
      name: create.name,
      privacy: 'private',
      favorite: true,
      selectedPrefNum: 'extension',
      setInput: '',
      type: 'speeddial',
      speeddial_num: create.speeddial_num,
      notes: "speeddial-favorite",
      company: create.company,
    }
    await axios.post(`${PATH}/create`, newSpeedDial)
    return newSpeedDial
  } catch (error) {
    handleNetworkError(error)
    throw error
  }
}

/**
 *
 * Edit a speed dial
 *
 * @returns The speed dial
 */

export const editSpeedDial = async (edit: NewSpeedDialType, current: SpeedDialType) => {
  try {
    if (current.name && current.speeddial_num) {
      const newSpeedDial = Object.assign({}, current)
      newSpeedDial.speeddial_num = edit.speeddial_num
      newSpeedDial.name = edit.name
      newSpeedDial.id = newSpeedDial.id?.toString()
      await axios.post(`${PATH}/modify_cticontact`, newSpeedDial)
      return current
    }
  } catch (error) {
    handleNetworkError(error)
    throw error
  }
}

/**
 *
 * Delete an existing speed dial
 *
 * @param - The object containing the id
 *
 */

export const deleteSpeedDial = async (obj: { id: string }) => {
  try {
    await axios.post(`${PATH}/delete_cticontact`, obj)
    return true
  } catch (error) {
    handleNetworkError(error)
    throw error
  }
}

/**
 *
 * Delete all existing speed dials
 *
 */

export const deleteAllSpeedDials = async () => {
  try {
    await axios.delete(`${PATH}/speeddials`)
    return true
  } catch (error) {
    handleNetworkError(error)
    throw error
  }
}

/**
 *
 * Import speed dials from CSV file
 *
 * @param - The object containing base 64 file
 *
 */

export const importCsvSpeedDial = async (obj: { file64: any }) => {
  try {
    await axios.post(`${PATH}/import_csv_speeddial`, obj)
    return true
  } catch (error) {
    handleNetworkError(error)
    throw error
  }
}
