// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import axios from 'axios'
import { callPhoneNumber, handleNetworkError, isNethlinkOnline, sortByFavorite } from '../lib/utils'
import { store } from '../store'
import { loadCache, loadPreference, saveCache, savePreference, clearPreference } from './storage'
import { isEmpty, cloneDeep } from 'lodash'
import { createSpeedDialFavorite, deleteSpeedDial, getSpeedDials } from '../services/phonebook'

export const AVAILABLE_STATUSES = ['online', 'cellphone', 'callforward', 'voicemail']
export const UNAVAILABLE_STATUSES = ['dnd', 'busy', 'incoming', 'ringing']
export const DEFAULT_GROUP_FILTER = 'all'

/**
 * Normalize the persisted operators group filter to a string array.
 * Handles the new format (JSON array) and the legacy single-value string.
 */
export const normalizeGroupFilter = (value: any): string[] => {
  if (Array.isArray(value)) {
    return value.length ? value : [DEFAULT_GROUP_FILTER]
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) {
      return [DEFAULT_GROUP_FILTER]
    }
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed)
        if (Array.isArray(parsed) && parsed.length) {
          return parsed
        }
      } catch {
        // fall through to default
      }
      return [DEFAULT_GROUP_FILTER]
    }
    // legacy single-value string
    return [trimmed]
  }
  return [DEFAULT_GROUP_FILTER]
}
export const DEFAULT_STATUS_FILTER = 'all'
export const DEFAULT_SORT_BY = 'az'
export const DEFAULT_LAYOUT = 'standard'
export const DEFAULT_GROUP_LAYOUT_GROUP_BY = 'team'
export const DEFAULT_GROUP_LAYOUT_SORT_BY = 'extension'
export const AVATARS_EXPIRATION_MILLIS = 24 * 60 * 60 * 1000 // 24 hours

export async function getUserEndpointsAll() {
  try {
    const { data } = await axios.get('/user/endpoints/all')
    return data
  } catch (error) {
    handleNetworkError(error)
    throw error
  }
}

export async function getAllAvatars() {
  try {
    const { data } = await axios.get('/user/all_avatars')
    return data
  } catch (error) {
    handleNetworkError(error)
    throw error
  }
}

export async function getGroups() {
  try {
    const { data } = await axios.get('/astproxy/opgroups')
    return data
  } catch (error) {
    handleNetworkError(error)
    throw error
  }
}

export async function getExtensions() {
  try {
    const { data } = await axios.get('/astproxy/extensions')
    return data
  } catch (error) {
    handleNetworkError(error)
    throw error
  }
}

export function searchStringInOperator(operator: any, queryText: string) {
  const regex = /[^a-zA-Z0-9]/g
  queryText = queryText.replace(regex, '')
  let found = false

  // search in string attributes
  found = ['name', 'username', 'group'].some((attrName) => {
    return new RegExp(queryText, 'i').test(operator[attrName]?.replace(regex, ''))
  })

  if (found) {
    return true
  }

  const endpoints = operator.endpoints

  // search in extensions
  found = endpoints.extension.some((extension: any) => {
    return new RegExp(queryText, 'i').test(extension?.id?.replace(regex, ''))
  })

  if (found) {
    return true
  }

  // search in cellphones
  found = endpoints.cellphone.some((cellphone: any) => {
    return new RegExp(queryText, 'i').test(cellphone?.id?.replace(regex, ''))
  })
}

export const openShowOperatorDrawer = (operator: any) => {
  store.dispatch.sideDrawer.update({
    isShown: true,
    contentType: 'showOperator',
    config: operator,
  })
}

const splitDisplayName = (name: string): { first: string; last: string } => {
  const tokens = (name || '').trim().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) {
    return { first: '', last: '' }
  }
  if (tokens.length === 1) {
    return { first: tokens[0], last: tokens[0] }
  }
  return { first: tokens[0], last: tokens.slice(1).join(' ') }
}

const firstNameSortKey = (operator: any) => {
  const firstname = operator?.firstname && operator.firstname.trim()
  if (firstname) {
    return firstname
  }
  return splitDisplayName(operator?.name).first || operator?.name || ''
}
const lastNameSortKey = (operator: any) => {
  const lastname = operator?.lastname && operator.lastname.trim()
  if (lastname) {
    return lastname
  }
  return splitDisplayName(operator?.name).last || operator?.name || ''
}

export const sortByFirstName = (operator1: any, operator2: any) =>
  firstNameSortKey(operator1).localeCompare(firstNameSortKey(operator2), undefined, {
    sensitivity: 'base',
    numeric: true,
  })

export const sortByLastName = (operator1: any, operator2: any) =>
  lastNameSortKey(operator1).localeCompare(lastNameSortKey(operator2), undefined, {
    sensitivity: 'base',
    numeric: true,
  })

const OPERATORS_SORT_COMPARATORS: Record<string, (operator1: any, operator2: any) => number> = {
  extension: (operator1: any, operator2: any) =>
    operator1?.endpoints?.extension[0]?.id > operator2?.endpoints?.extension[0]?.id ? 1 : -1,
  az: (operator1: any, operator2: any) => (operator1?.name > operator2?.name ? 1 : -1),
  za: (operator1: any, operator2: any) => (operator1?.name < operator2?.name ? 1 : -1),
  firstname_az: (operator1: any, operator2: any) => sortByFirstName(operator1, operator2),
  firstname_za: (operator1: any, operator2: any) => sortByFirstName(operator2, operator1),
  lastname_az: (operator1: any, operator2: any) => sortByLastName(operator1, operator2),
  lastname_za: (operator1: any, operator2: any) => sortByLastName(operator2, operator1),
}

const normalizeSortBy = (value: any, fallback: string) =>
  typeof value === 'string' && value in OPERATORS_SORT_COMPARATORS ? value : fallback

export const sortOperators = (operators: any[], sortBy: string, fallbackSortBy: string) => {
  const comparator =
    OPERATORS_SORT_COMPARATORS[sortBy] || OPERATORS_SORT_COMPARATORS[fallbackSortBy]
  return operators?.sort(
    (operator1: any, operator2: any) =>
      sortByFavorite(operator1, operator2) || comparator(operator1, operator2),
  )
}

export const callOperator = (
  operator: any,
  event: any = undefined,
  options: { video?: boolean } = {},
) => {
  const phoneNumber = operator?.endpoints?.mainextension?.[0]?.id
  callPhoneNumber(phoneNumber, options)

  store.dispatch.globalSearch.setFocused(false)
  store.dispatch.globalSearch.setOpen(false)
  store.dispatch.globalSearch.setRightSideTitleClicked(true)
  // stop propagation of click event
  if (event) {
    event.stopPropagation()
  }
}

// Desk phones known to handle video calls, matched on the registered User-Agent
const VIDEO_PHONE_USER_AGENTS = /Yealink SIP-(T58|VP59)|Fanvil (V6|X7|i[0-9])|Nethesis NP-V|Akuvox|Grandstream GXV/i

/**
 * True when the extension can receive a video call: WebRTC, NethLink and the mobile app always,
 * physical phones only for known video models
 */
export const isVideoCapableExtension = (extension: any) => {
  if (['webrtc', 'nethlink', 'mobile'].includes(extension?.type)) {
    return true
  }
  return extension?.type === 'physical' && VIDEO_PHONE_USER_AGENTS.test(extension?.description || '')
}

export const isOperatorVideoCallable = (operator: any, currentUsername: string) => {
  return (
    isOperatorCallable(operator, currentUsername) &&
    (operator?.endpoints?.extension || []).some(isVideoCapableExtension)
  )
}

export const isOperatorCallable = (operator: any, currentUsername: string) => {
  return (
    operator?.endpoints?.extension?.length > 0 &&
    (operator?.mainPresence === 'online' ||
      operator?.mainPresence === 'cellphone' ||
      operator?.mainPresence === 'callforward' ||
      operator?.mainPresence === 'voicemail') &&
    operator?.status !== 'busy' &&
    operator?.status !== 'onhold' &&
    operator?.username !== currentUsername
  )
}

export const addOperatorToFavorites = async (
  operatorToAdd: string,
  mainExtension: string,
  realUserName: string,
) => {
  try {
    await createSpeedDialFavorite({
      name: operatorToAdd,
      speeddial_num: mainExtension,
      company: realUserName,
    })
  } catch (error) {
    return
  }
}

export const removeOperatorFromFavorites = async (
  operatorToRemove: string,
  currentUsername: string,
  favoriteOperators: any,
  favoriteOperatoreSpeedDialId: any,
) => {
  store.dispatch.operators.setFavoritesLoaded(false)
  await deleteSpeedDial({
    id: favoriteOperatoreSpeedDialId?.id?.toString(),
  })
  favoriteOperators = favoriteOperators.filter((op: any) => op !== operatorToRemove)
  store.dispatch.operators.setFavorites(favoriteOperators)
  store.dispatch.operators.setFavoritesLoaded(true)
}

export function reloadOperators() {
  store.dispatch.operators.setOperatorsLoaded(false)
}

export const getFilterValues = (currentUsername: string) => {
  const group = normalizeGroupFilter(loadPreference('operatorsGroupFilter', currentUsername))

  const status = loadPreference('operatorsStatusFilter', currentUsername) || DEFAULT_STATUS_FILTER

  const sortBy = normalizeSortBy(
    loadPreference('operatorsSortBy', currentUsername),
    DEFAULT_SORT_BY,
  )

  const layout = loadPreference('operatorsLayout', currentUsername) || DEFAULT_LAYOUT

  const groupLayoutGroupBy =
    loadPreference('operatorsGroupLayoutGroupBy', currentUsername) || DEFAULT_GROUP_LAYOUT_GROUP_BY

  const groupLayoutSortBy = normalizeSortBy(
    loadPreference('operatorsGroupLayoutSortBy', currentUsername),
    DEFAULT_GROUP_LAYOUT_SORT_BY,
  )

  return { group, status, sortBy, layout, groupLayoutGroupBy, groupLayoutSortBy }
}

export const retrieveUserEndpoints = async () => {
  store.dispatch.operators.setUserEndpointsLoaded(false)

  try {
    const endpoints = await getUserEndpointsAll()
    store.dispatch.operators.setUserEndpoints(endpoints)
    store.dispatch.operators.setUserEndpointsLoaded(true)
    return endpoints
  } catch (e) {
    console.error(e)
    store.dispatch.operators.setErrorMessage('Cannot retrieve user endpoints')
    store.dispatch.operators.setOperatorsLoaded(true)
    store.dispatch.operators.setLoading(false)
    return null
  }
}

export const retrieveGroups = async () => {
  store.dispatch.operators.setGroupsLoaded(false)

  try {
    const groups = await getGroups()
    store.dispatch.operators.setGroups(groups)
    store.dispatch.operators.setGroupsLoaded(true)
  } catch (e) {
    console.error(e)
    store.dispatch.operators.setErrorMessage('Cannot retrieve groups')
    store.dispatch.operators.setOperatorsLoaded(true)
    store.dispatch.operators.setLoading(false)
  }
}

export const retrieveExtensions = async () => {
  store.dispatch.operators.setExtensionsLoaded(false)

  try {
    const extensions = await getExtensions()
    store.dispatch.operators.setExtensions(extensions)
    store.dispatch.operators.setExtensionsLoaded(true)
  } catch (e) {
    console.error(e)
    store.dispatch.operators.setErrorMessage('Cannot retrieve conversations')
    store.dispatch.operators.setOperatorsLoaded(true)
    store.dispatch.operators.setLoading(false)
  }
}

export const retrieveAvatars = async (authStore: any) => {
  store.dispatch.operators.setAvatarsLoaded(false)

  try {
    let avatars = loadCache('operatorsAvatars', authStore.username)

    if (!avatars) {
      // avatars not cached or cache has expired
      avatars = await getAllAvatars()
      const expiration = new Date().getTime() + AVATARS_EXPIRATION_MILLIS
      saveCache('operatorsAvatars', avatars, authStore.username, expiration)
    }
    store.dispatch.operators.setAvatars(avatars)
    store.dispatch.operators.setAvatarsLoaded(true)
  } catch (e) {
    console.error(e)
    store.dispatch.operators.setErrorMessage('Cannot retrieve avatars')
    store.dispatch.operators.setOperatorsLoaded(true)
    store.dispatch.operators.setLoading(false)
  }
}

export const retrieveFavoriteOperators = async (authStore: any, operatorObject: any) => {
  store.dispatch.operators.setFavoritesLoaded(false)

  // Check if the user has the phonebook permission
  const hasPhonebookPermission = store.getState().user?.profile?.macro_permissions?.phonebook?.value

  if (hasPhonebookPermission) {
    const speedDials = await getSpeedDials()

    // Avoid to add a favorite operator if you add it in the speed dials form
    const speedDialMap: any = speedDials.reduce((acc: any, speedDial: any) => {
      if (speedDial?.notes === 'speeddial-favorite') {
        acc[speedDial?.name] = { id: speedDial?.id }
      }
      return acc
    }, {})

    // Retrieve the favorite operators from the speed dials Object
    store.dispatch.operators.setFavoritesObjectComplete(speedDialMap)

    const favoriteOperatorsLocalStorage =
      loadPreference('favoriteOperators', authStore.username) || []

    //check if the favoriteOperatorsLocalStorage is not empty
    if (favoriteOperatorsLocalStorage.length > 0) {
      // Cycle through all the favorite operators in local storage
      for (const operatorName of favoriteOperatorsLocalStorage) {
        // Check if the operator already exists in the speed dials
        const operatorAlreadyExists = speedDials.some(
          (speedDial: any) => speedDial?.name === operatorName,
        )

        // If the operator does not exist in the speed dials, add it
        if (!operatorAlreadyExists) {
          const operatorSpeedDial = operatorObject[operatorName]
          if (operatorSpeedDial) {
            const mainExtension = operatorSpeedDial?.endpoints?.mainextension?.[0]?.id
            const operatorRealName = operatorSpeedDial?.name

            if (mainExtension && operatorRealName) {
              await addOperatorToFavorites(operatorName, mainExtension, operatorRealName)
            }
          }
        }
      }

      clearPreference('favoriteOperators', authStore?.username)
    }

    const speedDialOwners = speedDials
      .filter((speedDial: any) => speedDial?.notes === 'speeddial-favorite')
      .map((speedDial: any) => speedDial?.name)

    store.dispatch.operators.setFavorites(speedDialOwners)
  } else {
    store.dispatch.operators.setFavoritesObjectComplete({})
    store.dispatch.operators.setFavorites([])
  }

  store.dispatch.operators.setFavoritesLoaded(true)
}

export const buildOperators = (operatorsStore: any) => {
  let operators = cloneDeep(operatorsStore.userEndpoints)

  // groups

  for (let [groupName, groupData] of Object.entries(operatorsStore.groups)) {
    // @ts-ignore
    for (const username of groupData.users) {
      if (operators[username]) {
        let groups = operators[username].groups || []
        groups.push(groupName)
        operators[username].groups = groups
      }
    }
  }

  // conversations

  for (const [extNum, extData] of Object.entries(operatorsStore.extensions)) {
    // @ts-ignore
    if (!isEmpty(extData.conversations)) {
      const opFound: any = Object.values(operators).find((op: any) => {
        return op.endpoints.extension.some((ext: any) => ext.id === extNum)
      })

      if (opFound) {
        let conversations = opFound.conversations || []

        // @ts-ignore
        Object.values(extData.conversations).forEach((conv) => {
          conversations.push(conv)
        })
        opFound.conversations = conversations
      }
    }
  }

  // favorites

  for (const username of operatorsStore?.favorites) {
    if (operators[username]) {
      operators[username].favorite = true
    }
  }
  // avatars

  for (const [username, avatarBase64] of Object.entries(operatorsStore.avatars)) {
    if (operators[username]) {
      operators[username].avatarBase64 = avatarBase64
    }
  }
  store.dispatch.operators.setOperators(operators)
  store.dispatch.operators.setErrorMessage('')
  store.dispatch.operators.setOperatorsLoaded(true)
  store.dispatch.operators.setLoading(false)
}

export const getOperatorByPhoneNumber = (phoneNumber: string, operators: any) => {
  return Object.values(operators).find((operator: any) =>
    operator.endpoints.extension.find((ext: any) => ext.id === phoneNumber),
  )
}

export const getMainExtensionNumber = (phoneNumber: string, operators: any) => {
  const operator: any = getOperatorByPhoneNumber(phoneNumber, operators || {})
  return operator?.endpoints?.mainextension?.[0]?.id || phoneNumber
}

export const getInfiniteScrollOperatorsPageSize = () => {
  let pageSize = 30

  if (typeof window !== 'undefined' && window.innerHeight > 1000) {
    pageSize = 100
  }
  return pageSize
}

export async function postRecallOnBusy(obj: any) {
  try {
    const { data, status } = await axios.post('/astproxy/recall_on_busy', obj)
    return data
  } catch (error) {
    handleNetworkError(error)
    throw error
  }
}

export async function hangup(obj: any) {
  try {
    const { data, status } = await axios.post('/astproxy/hangup', obj)
    return data
  } catch (error) {
    handleNetworkError(error)
    throw error
  }
}

export async function startListen(obj: any) {
  try {
    const { data, status } = await axios.post('/astproxy/start_spy', obj)
    return data
  } catch (error) {
    handleNetworkError(error)
    throw error
  }
}

export async function toggleRecord(recordingType: any, obj: any) {
  if (recordingType === 'not_started') {
    try {
      const { data, status } = await axios.post('/astproxy/start_record', obj)
      return data
    } catch (error) {
      handleNetworkError(error)
      throw error
    }
  } else {
    if (recordingType === 'started') {
      try {
        const { data, status } = await axios.post('/astproxy/mute_record', obj)
        return data
      } catch (error) {
        handleNetworkError(error)
        throw error
      }
    } else {
      try {
        const { data, status } = await axios.post('/astproxy/unmute_record', obj)
        return data
      } catch (error) {
        handleNetworkError(error)
        throw error
      }
    }
  }
}

export async function intrude(obj: any) {
  try {
    const { data, status } = await axios.post('/astproxy/intrude', obj)
    return data
  } catch (error) {
    handleNetworkError(error)
    throw error
  }
}

export async function pickup(obj: any) {
  try {
    const userExtensions = store.getState().user?.endpoints?.extension || []
    const isNethLinkDestination =
      isNethlinkOnline() &&
      userExtensions.some((ext: any) => ext?.type === 'nethlink' && ext?.id === `${obj?.destId}`)
    const { data, status } = await axios.post('/astproxy/pickup_conv', obj)
    if (isNethLinkDestination && obj?.endpointId) {
      window.location.href = `nethlink://pickup?to=${obj.endpointId}`
    }
    return data
  } catch (error) {
    handleNetworkError(error)
    throw error
  }
}

/**
 * Operator groups a user may share a phonebook contact with: ONLY the groups the
 * user is directly a member of (CTI Configurations > Users > Group).
 *
 * There is no admin / phonebook-level-2 bypass: contact sharing depends solely on
 * group membership for everyone, mirroring the nethcti-middleware write validation.
 *
 * This intentionally does NOT consider presence-panel permissions
 * (all_groups / grp_*): those govern only the operators view. Keep it separate
 * from getUserGroups, which must keep its presence-panel semantics.
 */
export function getShareableGroups(
  allGroups: { [key: string]: { users: string[] } },
  username: string,
) {
  return Object.keys(allGroups).filter((groupName) =>
    allGroups[groupName]?.users.includes(username),
  )
}

export function getUserGroups(
  allowedGroupsIds: string[],
  allGroups: { [key: string]: { users: string[] } },
  canSeeAllGroups: boolean,
  username: string,
) {
  if (canSeeAllGroups) {
    // user has the permission to see all groups
    return Object.keys(allGroups)
  }

  // the groups the user has access to:
  const allowedGroups = Object.keys(allGroups).filter((group) => {
    // using different formats, e.g. group = 'Test group', allowedGroupId: 'grp_testgroup'
    const groupId = 'grp_' + group.replace(/[^a-z0-9]/gi, '').toLowerCase()
    return allowedGroupsIds.includes(groupId)
  })

  // the groups the user is a member of:
  const belongingGroups = Object.keys(allGroups).filter((groupName) => {
    return allGroups[groupName]?.users.includes(username)
  })

  // concat groups and remove duplicates
  return Array.from(new Set([...allowedGroups, ...belongingGroups]))
}

export async function hangupMainExt(obj: any) {
  try {
    const { data, status } = await axios.post('/astproxy/hangup_mainexten', obj)
    return data
  } catch (error) {
    handleNetworkError(error)
    throw error
  }
}
