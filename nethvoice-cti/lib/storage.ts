// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Contains the methods to manage browser's storage
 */

import { cloneDeep } from 'lodash'

/**
 * Saves an Item to localstorage
 *
 * @param name - The key of the object
 * @param value - The object to save
 *
 */

export const setJSONItem = (name: string, value: object) => {
  localStorage.setItem(name, JSON.stringify(value))
}

type SavedType = string | null

/**
 * Gets an Item from localstorage
 *
 * @param name - The key used to save the object
 *
 */

export const getJSONItem = (name: string) => {
  const saved: SavedType = localStorage.getItem(name)
  const initialValue = saved && JSON.parse(saved)
  return initialValue || ''
}

/**
 * Deletes an Item from localstorage
 *
 * @param name - The key used to save the object
 *
 */

export const removeItem = (name: string) => {
  localStorage.removeItem(name)
}

export const setStringItem = (name: string, value: string) => {
  localStorage.setItem(name, value)
}

export const getStringItem = (name: string) => {
  return localStorage.getItem(name)
}

/**
 * Used to save user preferences inside a local storage entry "preferences-username"
 *
 * @param preferenceName name of the preference
 * @param preferenceValue can be a string or a JSON object
 * @param currentUsername username currently logged in
 */
export const savePreference = (
  preferenceName: string,
  preferenceValue: any,
  currentUsername: string,
) => {
  const preferences = getJSONItem(`preferences-${currentUsername}`) || {}
  preferences[preferenceName] = preferenceValue
  setJSONItem(`preferences-${currentUsername}`, preferences)
}

/**
 * Used to load user preferences from the local storage entry "preferences-username"
 *
 * @param preferenceName name of the preference
 * @param currentUsername username currently logged in
 */
export const loadPreference = (preferenceName: string, currentUsername: string) => {
  const preferences = getJSONItem(`preferences-${currentUsername}`) || {}
  return preferences[preferenceName]
}

/**
 * Used to clear a specific user preference from the local storage entry "preferences-username"
 *
 * @param preferenceName name of the preference to be cleared
 * @param username username currently logged in
 */
export const clearPreference = (preferenceName: string, username: string) => {
  // Retrieve preferences from localStorage
  const preferences = getJSONItem(`preferences-${username}`) || {}

  // Remove the key corresponding to the preference
  if (preferences[preferenceName]) {
    delete preferences[preferenceName]

    // Save the updated preferences object back to localStorage
    localStorage.setItem(`preferences-${username}`, JSON.stringify(preferences))
  }
}

/**
 * Used to save data to cache inside a local storage entry "caches-username"
 *
 * @param cacheName name of the cache
 * @param cacheValue a JSON object
 * @param currentUsername username currently logged in
 * @param expiration timestamp of expiration of the cache
 */
export const saveCache = (
  cacheName: string,
  cacheData: any,
  currentUsername: string,
  expiration: number,
) => {
  if (!currentUsername) {
    return
  }
  const caches = getJSONItem(`caches-${currentUsername}`) || {}
  let data = cloneDeep(cacheData)
  data['_expiration'] = expiration
  caches[cacheName] = data
  setJSONItem(`caches-${currentUsername}`, caches)
}

/**
 * Used to load user caches from the local storage entry "caches-username"
 *
 * @param cacheName name of the cache
 * @param currentUsername username currently logged in
 */
export const loadCache = (cacheName: string, currentUsername: string) => {
  const caches = getJSONItem(`caches-${currentUsername}`) || {}
  const cache = caches[cacheName]

  if (cache && cache['_expiration'] && new Date().getTime() > cache['_expiration']) {
    // cache has expired
    return undefined
  }
  return cache
}
