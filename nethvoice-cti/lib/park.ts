// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import axios from 'axios'
import { handleNetworkError } from './utils'
import { store } from '../store'
import { isEmpty } from 'lodash'

// Retrieve contact information trough id
export async function retrieveParksList() {
  store.dispatch.park.setLoading(true)
  store.dispatch.park.setLoaded(false)
  let parkObject: any = null
  try {
    const { data, status } = await axios.get('/astproxy/parkings')
    parkObject = data
    store.dispatch.park.setParks(parkObject)
    store.dispatch.park.setLoaded(true)
    store.dispatch.park.setLoading(false)
    store.dispatch.park.setParkingCallTaken(false)
    //check if there is at least one park not empty
    isParkingEmpty(parkObject)
  } catch (error) {
    handleNetworkError(error)
    store.dispatch.park.setLoaded(true)
    store.dispatch.park.setLoading(false)
    throw error
  }
}

export function isParkingEmpty(parkingList: any) {
  const filteredParks = Object.keys(parkingList)
    .filter((key) => !isEmpty(parkingList[key].parkedCaller))
    .reduce((obj: any, key: any) => {
      obj[key] = parkingList[key]
      return obj
    }, {})
  // If there is at least one park not empty show parking footerbar section
  const numberOfElements = Object.keys(filteredParks).length
  store.dispatch.park.setNumberOfNotEmptyParkings(numberOfElements)
  if (!isEmpty(filteredParks)) {
    store.dispatch.park.setParkingCallFooterVisibility(true)
  } else {
    store.dispatch.park.setParkingCallFooterVisibility(false)
  }
}

export async function getParking(parkInformation: any) {
  try {
    const { data, status } = await axios.post('/astproxy/pickup_parking', parkInformation)
    return data
  } catch (error) {
    handleNetworkError(error)
    throw error
  }
}
