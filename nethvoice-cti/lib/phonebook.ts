// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import axios from 'axios'
import { handleNetworkError } from './utils'
import { store } from '../store'
import { loadPreference } from './storage'

export const PAGE_SIZE = 10
export const DEFAULT_CONTACT_TYPE_FILTER = 'all'
export const DEFAULT_VISIBILITY_FILTER = 'all'
export const DEFAULT_SORT_BY = 'name'
const GROUP_TYPE_PREFIX = 'group:'
const RESERVED_CONTACT_TYPES = ['private', 'public', 'speeddial']
const DEFAULT_LEGACY_PHONEBOOK_LEVEL = 0

function getPhonebookPermission(profile: any, permissionName: string) {
  const permissions = profile?.macro_permissions?.phonebook?.permissions

  if (Array.isArray(permissions)) {
    return permissions.find((permission: any) => permission?.name === permissionName)
  }

  return permissions?.[permissionName]
}

export function normalizeSharedGroups(sharedGroups: any) {
  if (!Array.isArray(sharedGroups)) {
    return []
  }

  return sharedGroups
    .filter((groupName: any) => typeof groupName === 'string')
    .map((groupName: string) => groupName.trim())
    .filter((groupName: string, index: number, groups: string[]) => {
      return groupName !== '' && groups.indexOf(groupName) === index
    })
}

export function isReservedContactType(type: any) {
  return typeof type === 'string' && RESERVED_CONTACT_TYPES.includes(type)
}

export function hasSerializedGroupType(type: any) {
  return typeof type === 'string' && type.startsWith(GROUP_TYPE_PREFIX)
}

export function getContactSharedGroups(contact: any) {
  if (hasSerializedGroupType(contact?.type)) {
    return normalizeSharedGroups(contact.type.slice(GROUP_TYPE_PREFIX.length).split(','))
  }

  if (Array.isArray(contact?.shared_groups)) {
    return normalizeSharedGroups(contact.shared_groups)
  }

  if (typeof contact?.shared_groups === 'string' && contact.shared_groups !== '') {
    try {
      return normalizeSharedGroups(JSON.parse(contact.shared_groups))
    } catch (error) {
      return normalizeSharedGroups(contact.shared_groups.split(','))
    }
  }

  return []
}

export function getContactVisibility(contact: any) {
  // Only CTI contacts carry the public/private/group sharing taxonomy. Centralized
  // contacts use operational types (extension, rapidcode, custom sources, ...) and
  // must never be classified or tagged by sharing level. Use the same strict
  // source check as canWritePhonebookContact so tagging and write-gating agree.
  if (contact?.source !== 'cti') {
    return 'public'
  }

  if (hasSerializedGroupType(contact?.type)) {
    return 'group'
  }

  if (isReservedContactType(contact?.type)) {
    return contact.type
  }

  return 'public'
}

export function getContactVisibilityKind(contact: any) {
  const visibility = getContactVisibility(contact)

  if (visibility === 'private' || visibility === 'group') {
    return visibility
  }

  return null
}

export function getPhonebookPermissionLevel(profile: any) {
  if (!profile?.macro_permissions?.phonebook?.value) {
    return -1
  }

  if (getPhonebookPermission(profile, 'ad_phonebook')?.value === true) {
    return 2
  }

  if (getPhonebookPermission(profile, 'phonebook_level_2')?.value === true) {
    return 2
  }

  if (getPhonebookPermission(profile, 'phonebook_level_1')?.value === true) {
    return 1
  }

  if (getPhonebookPermission(profile, 'phonebook_level_0')?.value === true) {
    return 0
  }

  return DEFAULT_LEGACY_PHONEBOOK_LEVEL
}

export function canWritePhonebookVisibility(profile: any, visibility: string) {
  const level = getPhonebookPermissionLevel(profile)

  return level >= 2 || (level >= 1 && visibility === 'private')
}

export function canCreatePhonebookContacts(profile: any) {
  return ['public', 'private', 'group'].some((visibility) =>
    canWritePhonebookVisibility(profile, visibility),
  )
}

export function canWritePhonebookContact(profile: any, contact: any, username: string) {
  if (contact?.source !== 'cti') {
    return false
  }

  const level = getPhonebookPermissionLevel(profile)
  if (level >= 2) {
    return true
  }

  return (
    level >= 1 &&
    contact?.owner_id === username &&
    canWritePhonebookVisibility(profile, getContactVisibility(contact))
  )
}

export function serializeSharedGroups(sharedGroups: string[]) {
  return `${GROUP_TYPE_PREFIX}${normalizeSharedGroups(sharedGroups).join(',')}`
}

export function getPhonebookUrl() {
  if (window == undefined) {
    return ''
  }

  // @ts-ignore
  return `${window.CONFIG.API_SCHEME + window.CONFIG.API_ENDPOINT}/api/phonebook/`
}

export async function getPhonebook(
  pageNum: number,
  textFilter: string,
  contactType: string,
  sortBy: string,
  pageSize: number = PAGE_SIZE,
  visibility: string = DEFAULT_VISIBILITY_FILTER,
) {
  if (window == undefined) {
    return
  }
  let apiUrl = getPhonebookUrl()

  if (textFilter.trim()) {
    apiUrl += `search/${textFilter.trim()}`
  } else {
    apiUrl += 'search/'
  }
  const offset = (pageNum - 1) * pageSize
  apiUrl += `?offset=${offset}&limit=${pageSize}&view=${contactType}&visibility=${visibility}`

  try {
    const { data, status } = await axios.get(apiUrl)
    return data
  } catch (error) {
    handleNetworkError(error)
    throw error
  }
}

export async function getContact(contactId: number, source: string) {
  if (window == undefined) {
    return
  }

  const contactPath = source === 'cti' ? 'cticontact' : 'contact'
  let apiUrl = getPhonebookUrl() + `${contactPath}/${contactId}`

  try {
    const { data, status } = await axios.get(apiUrl)
    return data
  } catch (error) {
    handleNetworkError(error)
    throw error
  }
}

export async function createContact(contactData: any) {
  if (window == undefined) {
    return
  }
  let apiUrl = getPhonebookUrl() + 'create'

  try {
    const { data, status } = await axios.post(apiUrl, contactData)
    return data
  } catch (error) {
    handleNetworkError(error)
    throw error
  }
}

export async function editContact(contactData: any) {
  if (window == undefined) {
    return
  }
  let apiUrl = getPhonebookUrl() + 'modify_cticontact'

  try {
    const { data, status } = await axios.post(apiUrl, contactData)
    return data
  } catch (error) {
    handleNetworkError(error)
    throw error
  }
}

export async function deleteContact(contactId: string) {
  if (window == undefined) {
    return
  }
  let apiUrl = getPhonebookUrl() + 'delete_cticontact'

  try {
    const { data, status } = await axios.post(apiUrl, { id: contactId })
    return data
  } catch (error) {
    handleNetworkError(error)
    throw error
  }
}

export function reloadPhonebook() {
  store.dispatch.phonebook.reload()
}

export async function fetchContact(contactId: number, source: string) {
  const res = await getContact(contactId, source)
  const contact = mapContact(res)
  openShowContactDrawer(contact)
}

export function mapContact(contact: any) {
  contact.shared_groups = getContactSharedGroups(contact)

  // kind & display name
  if (contact?.kind) {
    // Use existing kind if it's already set
    if (contact?.kind === 'person') {
      contact.displayName = contact?.name
    } else {
      contact.displayName = contact?.company
    }
  } else {
    // Determine kind based on content: if name exists and is not just "-", it's a person
    if (contact?.name && contact?.name !== '-') {
      contact.kind = 'person'
      contact.displayName = contact?.name
    } else {
      contact.kind = 'company'
      contact.displayName = contact?.company
    }
  }

  // company contacts
  if (contact?.contacts) {
    contact.contacts = JSON.parse(contact?.contacts)
  }
  return contact
}

export const openShowContactDrawer = (contact: any) => {
  store.dispatch.sideDrawer.update({
    isShown: true,
    contentType: 'showContact',
    config: contact,
  })
}

export const openCreateContactDrawer = () => {
  store.dispatch.sideDrawer.update({
    isShown: true,
    contentType: 'createOrEditContact',
    config: { isEdit: false },
  })
}

export const openCreateContactDrawerWithPhone = (contact: any) => {
  store.dispatch.sideDrawer.update({
    isShown: true,
    contentType: 'createOrEditContact',
    config: { isEdit: false, contact: contact },
  })
}

export const openEditContactDrawer = (contact: any) => {
  store.dispatch.sideDrawer.update({
    isShown: true,
    contentType: 'createOrEditContact',
    config: { isEdit: true, contact: contact },
  })
}

export const openAddToContactDrawer = (contact: any, phone: any) => {
  contact.phone = phone
  store.dispatch.sideDrawer.update({
    isShown: true,
    contentType: 'createOrEditContact',
    config: { isEdit: true, contact: contact },
  })
}

export const openCreateLastCallContact = (contact: any) => {
  store.dispatch.sideDrawer.update({
    isShown: true,
    contentType: 'createOrEditContact',
    config: { isEdit: false, isCreateContactUserLastCalls: true, contact: contact },
  })
}

export const getFilterValues = (currentUsername: string) => {
  const contactType =
    loadPreference('phonebookContactTypeFilter', currentUsername) || DEFAULT_CONTACT_TYPE_FILTER

  const visibility =
    loadPreference('phonebookVisibilityFilter', currentUsername) ||
    loadPreference('phonebookSharingOptionFilter', currentUsername) ||
    DEFAULT_VISIBILITY_FILTER

  const sortBy = loadPreference('phonebookSortBy', currentUsername) || DEFAULT_SORT_BY

  return { contactType, visibility, sortBy }
}

export const mapPhonebookResponse = (phonebookResponse: any) => {
  if (!phonebookResponse) {
    return null
  }

  phonebookResponse.rows.map((contact: any) => {
    return mapContact(contact)
  })

  // total pages
  phonebookResponse.totalPages = Math.ceil(phonebookResponse.count / PAGE_SIZE)
  return phonebookResponse
}

// Retrieve contact information trough id
export async function retrieveContact(contactId: any) {
  try {
    const { data, status } = await axios.get('/phonebook/contact/' + contactId)
    return data
  } catch (error) {
    handleNetworkError(error)
    throw error
  }
}
