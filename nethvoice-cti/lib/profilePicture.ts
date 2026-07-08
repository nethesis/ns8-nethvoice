// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import axios from 'axios'
import { handleNetworkError } from './utils'
import { store } from '../store'

export const openShowGravatarDrawer = (emptyString: any) => {
  store.dispatch.sideDrawer.update({
    isShown: true,
    contentType: 'showGravatar',
    config: emptyString,
  })
}

export const openShowUploadProfilePictureDrawer = (emptyString: any) => {
  store.dispatch.sideDrawer.update({
    isShown: true,
    contentType: 'showUploadProfilePicture',
    config: emptyString,
  })
}

export async function removeAvatar(obj: any) {
  try {
    const { data, status } = await axios.delete('/user/setting/avatar')
    store.dispatch.profilePicture.setEditedProfile(true)
    return data
  } catch (error) {
    handleNetworkError(error)
    throw error
  }
}

export async function uploadProfilePicture(userInformationObject: any) {
  try {
    const { data } = await axios.post('/user/settings', userInformationObject)
    return data
  } catch (error) {
    console.error(error)
  }
}
