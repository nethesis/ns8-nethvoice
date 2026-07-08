// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import axios from 'axios'
import { handleNetworkError } from './utils'
import { store } from '../store'
import { getJSONItem } from './storage'
import { t } from 'i18next'

export const openShowEditPhysicalPhone = (phoneInformation: any, pinstatus: any) => {
  let phoneModel: any = {}
  phoneModel = {
    ...phoneInformation,
    pinStatus: pinstatus,
  }
  store.dispatch.sideDrawer.update({
    isShown: true,
    contentType: 'showEditPhysicalPhone',
    config: phoneModel,
  })
}

export const openShowSwitchDeviceInputOutput = (status: any) => {
  store.dispatch.sideDrawer.update({
    isShown: true,
    contentType: 'showSwitchDeviceInputOutput',
    config: status,
  })
}

export const openShowDownloadLinkContent = (
  status: any,
  defaultOS: string,
  macArchitecture?: string,
) => {
  let objConfig = {
    urlStatus: status,
    selectedOS: defaultOS,
    macArchitecture: macArchitecture || 'x64',
  }
  store.dispatch.sideDrawer.update({
    isShown: true,
    contentType: 'showDownloadLinkContent',
    config: objConfig,
  })
}

export const getInputOutputLocalStorageValue = (currentUsername: string) => {
  const audioInputType = getJSONItem('phone-island-audio-input-device') || ''
  const audioOutputType = getJSONItem('phone-island-audio-output-device') || ''
  const videoInputType = getJSONItem('phone-island-video-input-device') || ''

  return { audioInputType, audioOutputType, videoInputType }
}

// Set main device id
export async function setMainDevice(deviceIdInformation: any) {
  try {
    const { data, status } = await axios.post('/user/default_device', deviceIdInformation)
    return data
  } catch (error) {
    handleNetworkError(error)
    throw error
  }
}

export const getPhysicalDeviceButtonConfiguration = async (macAddress: any) => {
  try {
    const { username, token } = store.getState().authentication
    const res = await fetch(
      // @ts-ignore
      window.CONFIG.API_SCHEME +
        // @ts-ignore
        window.CONFIG.VOICE_ENDPOINT +
        '/api/tancredi/api/v1/phones/' +
        macAddress +
        '?inherit=1',
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      },
    )
    const data = await res.json()
    return data
  } catch (error) {
    console.error(error)
  }
}

export const getPhoneModelData = async (model: any) => {
  try {
    const { username, token } = store.getState().authentication
    const res = await fetch(
      // @ts-ignore
      window.CONFIG.API_SCHEME +
        // @ts-ignore
        window.CONFIG.VOICE_ENDPOINT +
        '/api/tancredi/api/v1/models/' +
        model,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      },
    )
    const data = await res.json()
    return data
  } catch (error) {
    console.error(error)
  }
}

export const saveBtnsConfig = async (macAddress: any, keyUpdatedObject: any) => {
  try {
    const { username, token } = store.getState().authentication
    const res = await fetch(
      // @ts-ignore
      window.CONFIG.API_SCHEME +
        // @ts-ignore
        window.CONFIG.VOICE_ENDPOINT +
        '/api/tancredi/api/v1/phones/' +
        macAddress,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(keyUpdatedObject),
      },
    )
    return res
  } catch (error) {
    console.error(error)
  }
}

/**
 * Save the configuration of buttons of physical phone into the server.
 */
export async function reloadPhysicalPhone(exten: any) {
  try {
    const { data, status } = await axios.post('/astproxy/phone_reload', { exten: exten })
    return data
  } catch (error) {
    handleNetworkError(error)
    throw error
  }
}

export async function getDevicesPin() {
  try {
    const { data, status } = await axios.get('/astproxy/pinstatus')
    return data
  } catch (error) {
    handleNetworkError(error)
    throw error
  }
}

export async function setPin(obj: any) {
  try {
    const { data, status } = await axios.post('/astproxy/pin', obj)
    return data
  } catch (error) {
    handleNetworkError(error)
    throw error
  }
}

export async function getDevicesPinStatusForDevice() {
  try {
    const { data, status } = await axios.get('/astproxy/pin')
    return data
  } catch (error) {
    handleNetworkError(error)
    throw error
  }
}

export async function getDownloadLink() {
  try {
    const response = await fetch('https://api.github.com/repos/nethesis/nethlink/releases/latest')

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Cannot retrieve download url', error)
    handleNetworkError(error)
    throw error
  }
}

export const getFeatureCodes = async () => {
  try {
    const res = await axios.get(`/astproxy/feature_codes`)
    return res.data
  } catch (error) {
    console.error(error)
  }
}

export const tableHeader = () => {
  return (
    <thead className='bg-gray-100 dark:bg-gray-800'>
      <tr>
        <th scope='col' className='py-3.5 pl-4 pr-3 text-left text-sm font-semibold sm:pl-6'>
          {t('Devices.Device name')}
        </th>
        <th scope='col' className='px-3 py-3.5 text-left text-sm font-semibold'>
          {t('Devices.Status')}
        </th>
        <th scope='col' className='px-3 py-3.5 text-left text-sm font-semibold'>
          <span className='sr-only'> {t('Devices.Edit')}</span>
        </th>
        <th scope='col' className='py-3.5 text-right text-sm font-semibold'>
          <span className='sr-only'> {t('Devices.Edit')}</span>
        </th>
        <th scope='col' className='relative py-3.5 pl-3 pr-4 text-right'>
          <span className='sr-only'> {t('Devices.Edit')}</span>
        </th>
      </tr>
    </thead>
  )
}
