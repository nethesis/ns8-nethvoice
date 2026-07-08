// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { PropsWithChildren } from 'react'
import axios from 'axios'
import { store } from '../store'
import { eventDispatch } from './hooks/eventDispatch'

export interface ClearProps {
  key: string
  source: Record<string, unknown>
}

const clean = ({ key, source }: ClearProps): object => {
  delete source[key]
  return source
}

export const cleanClassName = (props: PropsWithChildren<object>): object => {
  return clean({
    key: 'className',
    source: props,
  })
}

export function handleNetworkError(error: any) {
  if (axios.isAxiosError(error)) {
    console.error('error: ', error.message)

    // if (!error.status) {
    //   // the request probably failed because auth token is expired (and CORS policy misconfigured)
    //   doLogout()
    // }
    return null
  } else {
    console.error('unexpected error: ', error)
    return null
  }
}

export const closeSideDrawer = () => {
  store.dispatch.sideDrawer.setShown(false)
}

export const closeRightSideDrawer = () => {
  store.dispatch.rightSideMenu.setShown(false)
}

/**
 * Sort function to order array elements by a specific property (for array of objects) or by a specific index (for arrays of arrays)
 *
 */
export const sortByProperty = (property: string | number) => {
  return function (a: any, b: any) {
    if (a[property] < b[property]) {
      return -1
    }
    if (a[property] > b[property]) {
      return 1
    }
    return 0
  }
}

// Parse a date string in the format "dd/mm/yyyy" to a Date object
const parseDate = (dateString: any) => {
  const [day, month, year] = dateString.split('/')
  return new Date(`${year}-${month}-${day}`)
}

// Sort function to order array elements by date in ascending order
export const sortByDateAsc = (a: any, b: any) => {
  const dateA: any = parseDate(a.date_creation)
  const dateB: any = parseDate(b.date_creation)
  return dateA - dateB
}

// Sort function to order array elements by date in descending order
export const sortByDateDesc = (a: any, b: any) => {
  const dateA: any = parseDate(a.date_creation)
  const dateB: any = parseDate(b.date_creation)
  return dateB - dateA
}

/**
 * Sort function to order array elements by a boolean property (for arrays of objects) or by a specific index
 *
 */
export const sortByBooleanProperty = (property: string | number) => {
  return function (a: any, b: any) {
    //set 1 if true, 0 otherwise
    const valueA = a[property] ? 1 : 0
    //set 1 if true, 0 otherwise
    const valueB = b[property] ? 1 : 0

    if (valueA < valueB) {
      return -1
    }
    if (valueA > valueB) {
      return 1
    }
    return 0
  }
}

/**
 * Sort function to order array elements by "favorite" boolean attribute
 */
export const sortByFavorite = (a: any, b: any) => {
  if (a.favorite && !b.favorite) {
    return -1
  }
  if (!a.favorite && b.favorite) {
    return 1
  }
  return 0
}

export function callPhoneNumber(phoneNumber: string) {
  const { default_device, username } = store.getState().user
  const userExtensions = store.getState().operators?.operators[username]?.endpoints?.extension

  // Check if there is an extension with type 'nethlink' that matches the id of default_device
  const hasNethlinkExtension = Array.isArray(userExtensions)
    ? userExtensions.some((ext: any) => ext.type === 'nethlink' && ext.id === default_device?.id)
    : false

  if (default_device?.type === 'webrtc') {
    eventDispatch('phone-island-call-start', { number: phoneNumber })
  } else if (default_device?.type === 'nethlink' || hasNethlinkExtension) {
    console.log('Attempting callto://', phoneNumber)

    let hasBlurred = false

    const onBlur = () => {
      hasBlurred = true
      window.removeEventListener('blur', onBlur)
    }

    window.addEventListener('blur', onBlur)

    // Use callto:// protocol to start a call
    window.location.href = `callto://${phoneNumber}`

    // Fallback to tel:// if the callto:// protocol is not supported
    setTimeout(() => {
      window.removeEventListener('blur', onBlur)
      if (!hasBlurred) {
        console.log('Fallback to tel://', phoneNumber)
        window.location.href = `tel://${phoneNumber}`
      }
    }, 2000)
  } else if (default_device?.type === 'physical') {
    eventDispatch('phone-island-call-start', { number: phoneNumber })
  }

  setTimeout(() => {
    store.dispatch.globalSearch.setFocused(false)
    store.dispatch.globalSearch.setOpen(false)
    store.dispatch.globalSearch.setRightSideTitleClicked(true)
  }, 350)
}

export function getBrandName() {
  if (typeof window === 'undefined') {
    return ''
  }
  // @ts-ignore
  return window.CONFIG.BRAND_NAME || ''
}

export function getProductName() {
  if (typeof window === 'undefined') {
    return ''
  }
  // @ts-ignore
  return `${window.CONFIG.PRODUCT_NAME}`
}

export function getTimezone() {
  if (typeof window === 'undefined') {
    return ''
  }
  // @ts-ignore
  return `${window.CONFIG.TIMEZONE || 'UTC'}`
}

export function getNumericTimezone() {
  if (typeof window === 'undefined') {
    return ''
  }
  // @ts-ignore
  return `${window.CONFIG.NUMERIC_TIMEZONE || '+0100'}`
}

export function getApiEndpoint() {
  if (typeof window === 'undefined') {
    return ''
  }
  // @ts-ignore
  return `${window.CONFIG.API_ENDPOINT}`
}

export function getApiScheme() {
  if (typeof window === 'undefined') {
    return ''
  }
  // @ts-ignore
  return `${window.CONFIG.API_SCHEME}`
}

export function getApiVoiceEndpoint() {
  if (typeof window === 'undefined') {
    return ''
  }
  // @ts-ignore
  return `${window.CONFIG.VOICE_ENDPOINT}`
}

/**
 * Returns true if the device used by the user is using a mobile device. Useful to check if the user is using a touch screen, for example to disable hover features
 */
export function isMobileDevice() {
  if (!navigator) {
    return true
  }
  return /Android|iPhone|iPad|iPod|Windows Phone/i.test(navigator.userAgent)
}

/**
 * Returns the input string after removing all spaces and special characters
 */
export function cleanString(s: string) {
  return s.replace(/[^a-zA-Z0-9]/g, '')
}

/**
 * Returns the converted size of the input file
 */
export function formatFileSize(sizeInBytes: any) {
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let size = sizeInBytes
  let unitIndex = 0

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }

  const sizeFormatted = size.toFixed(2)
  const unit = units[unitIndex]

  return `${sizeFormatted} ${unit}`
}

// The event to show the audio player view and play an audio file.
export function playFileAudio(audioFileId: any, typeFile: string) {
  let objectPlayAudioFile = {
    type: typeFile ? typeFile : 'call_recording',
    id: audioFileId.toString(),
  }
  eventDispatch('phone-island-audio-player-start', { ...objectPlayAudioFile })
}

// The event to show the audio player view and play an audio file.
export function playFileAudioBase64(base64: string) {
  let objectPlayAudioFile = {
    base64_audio_file: base64,
  }
  eventDispatch('phone-island-audio-player-start', { ...objectPlayAudioFile })
}

// Get favicon element
export function getHtmlFaviconElement() {
  if (typeof window === 'undefined') {
    return ''
  }

  let faviconHtmlElement = document.querySelector("link[rel*='icon']") as HTMLLinkElement
  return faviconHtmlElement
}

export function getConfiguredFaviconUrl() {
  if (typeof window === 'undefined') {
    return '/favicon.ico'
  }

  // @ts-ignore
  return window.CONFIG.FAVICON_URL || '/favicon.ico'
}

export function getConfiguredNavbarLogoUrl(preferDarkTheme: boolean = false) {
  if (typeof window === 'undefined') {
    return preferDarkTheme ? '/navbar_logo_dark.svg' : '/navbar_logo.svg'
  }

  // @ts-ignore
  const lightLogoUrl = window.CONFIG.NAVBAR_LOGO_URL || '/navbar_logo.svg'
  // @ts-ignore
  const darkLogoUrl = window.CONFIG.NAVBAR_LOGO_DARK_URL || lightLogoUrl || '/navbar_logo_dark.svg'

  return preferDarkTheme ? darkLogoUrl : lightLogoUrl
}

export function convertToCSV(objArray: any) {
  const array = typeof objArray !== 'object' ? JSON.parse(objArray) : objArray
  let str = ''

  for (let i = 0; i < array.length; i++) {
    let line = ''
    for (const index in array[i]) {
      if (line !== '') {
        line += ','
      }
      line += array[i][index] === null ? '' : array[i][index]
    }
    str += line + '\r\n'
  }
  return str
}

export function getNMonthsAgoDate(monthsAgo: number = 0): Date {
  const currentDate = new Date()
  const targetDate = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth() - monthsAgo,
    currentDate.getDate(),
  )
  return targetDate
}

// Inverts an object by swapping its keys and values
export function invertObject(obj: any) {
  const invertedObj: any = {}

  // Iterate over each key-value pair in the original object.
  for (const key in obj) {
    const value = obj[key]
    // Swap the key and value in the inverted object.
    invertedObj[value.name] = key
  }
  return invertedObj
}

//Open selected email manager
export const openEmailClient = (emailAddress: any) => {
  const mailtoLink = `mailto:${emailAddress.trim()}`
  window.location.href = mailtoLink
}

export const closeToast = () => {
  store.dispatch.toast.setShownToast(false)
}

export const openToast = (
  toastType: any,
  messageToast: any,
  toastTytle: any,
  timeout?: number,
  smaller?: boolean,
) => {
  store.dispatch.toast.updateToast({
    isShown: true,
    contentType: toastType.toString(),
    message: messageToast,
    tytle: toastTytle,
    timeout,
    smaller,
  })
}

export async function transferCall(operatorBadgeInformations: any) {
  let extensionToTransfer = operatorBadgeInformations?.endpoints?.mainextension?.[0]?.id
  const isNethLinkActive = isNethlinkOnline()

  if (isNethLinkActive) {
    console.log('Attempting nethlink://transfer', extensionToTransfer)
    // Use nethlink protocol to transfer the call
    window.location.href = `nethlink://transfer?to=${extensionToTransfer}`
  } else {
    eventDispatch('phone-island-call-transfer', { to: extensionToTransfer })
  }
}

// Function to transfer call from every page
export async function transferCallToExtension(extensionToTransfer: any) {
  const isNethLinkActive = isNethlinkOnline()

  if (isNethLinkActive) {
    console.log('Attempting nethlink://transfer', extensionToTransfer)
    // Use nethlink protocol to transfer the call
    window.location.href = `nethlink://transfer?to=${extensionToTransfer}`
  } else {
    eventDispatch('phone-island-call-transfer', { to: extensionToTransfer })
  }
}

/**
 * Checks if NethLink is available and online
 * @returns boolean - true if NethLink is available and online, false otherwise
 */
export function isNethlinkOnline() {
  const { username } = store.getState().user
  const operators: any = store.getState().operators
  const phoneLinkExtensions = operators?.operators[username]?.endpoints?.extension.filter(
    (ext: any) => ext.type === 'nethlink',
  )

  // If there's no NethLink extension, return false
  if (!phoneLinkExtensions || phoneLinkExtensions?.length === 0) {
    return false
  }

  // Check if NethLink is online
  const nethLinkId = phoneLinkExtensions[0].id
  return operators?.extensions[nethLinkId]?.status !== 'offline'
}

export const clearLocalStorageAndCache = () => {
  // Delete credentials and caches element from local storage
  localStorage.removeItem('credentials')

  for (let i = 0; i < localStorage.length; i++) {
    const key: any = localStorage.key(i)

    if (key.includes('caches')) {
      localStorage.removeItem(key)
    }
  }
  // Delete browser caches
  if (caches && caches.keys) {
    caches.keys().then(function (names) {
      for (let name of names) {
        caches.delete(name)
      }
    })
  }
}

export const reloadPage = () => {
  window.location.reload()
}

export function saveQueryParams(query: any) {
  sessionStorage.setItem('queryParams', query)
}

export function getSavedQueryParams() {
  const savedQueryParams = sessionStorage.getItem('queryParams')
  return savedQueryParams ? savedQueryParams : null
}

export function getProductSubname() {
  if (typeof window === 'undefined') {
    return ''
  }
  // @ts-ignore
  return `${window.CONFIG.COMPANY_SUBNAME}`
}

export function getBrandedTabTitle(productLabel: string) {
  const brandName = getBrandName().trim()
  const productName = getProductName().trim()
  const hasProductName = !!productName && productName !== 'undefined' && productName !== 'null'

  if (!brandName || brandName === 'NethVoice') {
    return hasProductName ? productName : `NethVoice ${productLabel}`
  }

  return `${brandName} | ${productLabel}`
}

export function getNethvoiceUrl() {
  if (typeof window == 'undefined') {
    return ''
  }
  // @ts-ignore
  return `${window.CONFIG.API_SCHEME + window.CONFIG.VOICE_ENDPOINT}`
}

export function getPeopleImageVisibilityValue() {
  if (typeof window === 'undefined') {
    return ''
  }
  // @ts-ignore
  return `${window.CONFIG.LOGIN_PEOPLE}`
}


export const voiceRequest = async (methodVoice: string, url: any, object?: any) => {
  try {
    const { username, token } = store.getState().authentication
    const res = await fetch(
      // @ts-ignore
      window.CONFIG.API_SCHEME +
        // @ts-ignore
        window.CONFIG.VOICE_ENDPOINT +
        url,
      {
        method: methodVoice,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      },
    )
    return res
  } catch (error) {
    console.error(error)
  }
}

export const formatPhoneNumber = (rawNumber: string) => {
  if (!rawNumber) return null

  if (rawNumber.startsWith('00')) {
    // Convert "00" to "+" if necessary
    rawNumber = rawNumber.startsWith('00') ? `+${rawNumber.slice(2)}` : rawNumber
  }

  return rawNumber
}

// Custom scrollbar class for Tailwind CSS
export const customScrollbarClass =
  'overflow-y-auto scrollbar-thin scrollbar-thumb-gray-400 dark:scrollbar-thumb-gray-400 scrollbar-thumb-rounded-full scrollbar-thumb-opacity-50 scrollbar-track-gray-200 dark:scrollbar-track-gray-900 scrollbar-track-rounded-full scrollbar-track-opacity-25'

export const getISODateForFilename = () => {
  return new Date()
    .toISOString()
    .replace(/\.\d{3}Z$/, 'Z')
    .replace(/:/g, '-')
}
