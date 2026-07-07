// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { FC, ReactNode, useState, useEffect, useRef } from 'react'
import { NavBar, TopBar, MobileNavBar, SideDrawer, UserSidebarDrawer } from '.'
import { navItems, NavItemsProps } from '../../config/routes'
import { useRouter } from 'next/router'
import { getUserInfo, getParamUrl } from '../../services/user'
import { useDispatch } from 'react-redux'
import { Dispatch } from '../../store'
import { RootState } from '../../store'
import { useSelector } from 'react-redux'
import {
  closeSideDrawer,
  getBrandedTabTitle,
  getProductName,
  getProductSubname,
  closeToast,
  customScrollbarClass,
  openToast,
} from '../../lib/utils'
import { store } from '../../store'
import {
  buildOperators,
  retrieveAvatars,
  retrieveExtensions,
  retrieveFavoriteOperators,
  retrieveGroups,
  retrieveUserEndpoints,
} from '../../lib/operators'
import { useEventListener } from '../../lib/hooks/useEventListener'
import { retrieveQueues } from '../../lib/queuesLib'
import { retrieveQueueManager } from '../../lib/queueManager'
import Head from 'next/head'
import { capitalize, isEmpty } from 'lodash'
import { doLogout } from '../../services/login'
import { UserNavBar } from './UserNavBar'
import { getProfilingInfo } from '../../services/profiling'
import { ProfilingTypes } from '../../models/profiling'
import { Portal } from '@headlessui/react'
import { ParkCards } from '../parks/parkCards'
import { motion, useAnimation } from 'framer-motion'
import { pauseQueue, unpauseQueue } from '../../lib/queuesLib'
import { Button } from '../common'

interface LayoutProps {
  children: ReactNode
}
import { useTranslation } from 'react-i18next'
import Toast from '../common/Toast'
import { getCustomerCardsList, setUserSettings } from '../../lib/customerCard'
import { retrieveParksList } from '../../lib/park'
import { Tooltip } from 'react-tooltip'
import { getJSONItem, loadPreference, savePreference, setJSONItem } from '../../lib/storage'
import { eventDispatch } from '../../lib/hooks/eventDispatch'
import { setMainDevice, getFeatureCodes } from '../../lib/devices'
import { useHotkeys } from 'react-hotkeys-hook'
import { setIncomingCallsPreference } from '../../lib/incomingCall'

export const Layout: FC<LayoutProps> = ({ children }) => {
  const [openMobileMenu, setOpenMobileMenu] = useState<boolean>(false)
  const router = useRouter()
  const [items, setItems] = useState<NavItemsProps[]>(navItems)
  const dispatch = useDispatch<Dispatch>()
  const sideDrawer = useSelector((state: RootState) => state.sideDrawer)
  const toast = useSelector((state: RootState) => state.toast)
  const operatorsStore: any = useSelector((state: RootState) => state.operators)
  const [firstRenderOperators, setFirstRenderOperators] = useState(true)
  const [firstRenderGlobalSearchListener, setFirstRenderGlobalSearchListener] = useState(true)
  const [firstRenderAttach, setFirstRenderAttach] = useState(true)
  const [firstRenderDetach, setFirstRenderDetach] = useState(true)
  const [firstRenderFeatureCodes, setFirstRenderFeatureCodes] = useState(true)
  const [firstRenderRingtones, setFirstRenderRingtones] = useState(true)

  const [isUserInfoLoaded, setUserInfoLoaded] = useState(false)
  const authStore = useSelector((state: RootState) => state.authentication)

  const queuesStore = useSelector((state: RootState) => state.queues)

  const queueManagerStore = useSelector((state: RootState) => state.queueManagerQueues)

  const ctiStatus = useSelector((state: RootState) => state.ctiStatus)

  const profilePicture = useSelector((state: RootState) => state.profilePicture)
  const userStore = useSelector((state: RootState) => state.user)

  const currentUsername = authStore.username
  const { operators } = useSelector((state: RootState) => state.operators)
  const { profile } = useSelector((state: RootState) => state.user)
  const { avoidClose } = useSelector((state: RootState) => state.sideDrawer)
  const isSummaryEnabled = userStore?.call_summary_enabled === true

  const productName = getProductName()
  const productTabTitle = getBrandedTabTitle(getProductSubname() || 'CTI')
  // Get current page name, clean the path from / and capitalize page name
  function cleanProductNamePageTitle() {
    if (router.pathname) {
      // Delete slash at the beginning of the path
      const cleanRouterPath: string = router.pathname.replace(/^\/|\/$/g, '')
      // Return path with the uppercase first character
      return t(`Common.${capitalize(cleanRouterPath)}`) + ' - ' + productTabTitle
    }
  }

  const { t } = useTranslation()

  useEffect(() => {
    const currentItems = items.map((route) => {
      if (router.pathname === route.href) {
        route.current = true
      } else {
        route.current = false
      }
      return route
    })
    if (router?.pathname?.includes('/lines')) {
      items[5].current = true
    }

    setItems(currentItems)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  const [resfreshUserInfo, setResfreshUserInfo] = useState(true)
  const incomingCallStore = useSelector((state: RootState) => state.incomingCall)

  // get logged user data on page load
  useEffect(() => {
    const fetchUserInfo = async () => {
      const userInfo = await getUserInfo()

      if (userInfo && userInfo.data) {
        dispatch.user.update({
          default_device: userInfo?.data?.default_device,
          name: userInfo?.data?.name,
          username: userInfo?.data?.username,
          mainextension: userInfo?.data?.endpoints?.mainextension?.[0]?.id,
          mainPresence: userInfo?.data?.mainPresence,
          endpoints: userInfo?.data?.endpoints,
          profile: userInfo?.data?.profile,
          avatar: userInfo?.data?.settings?.avatar,
          settings: userInfo?.data?.settings,
          recallOnBusy: userInfo?.data?.recallOnBusy,
          lkhash: userInfo?.data?.lkhash,
          call_summary_enabled: userInfo?.data?.call_summary_enabled === true,
          urlOpened: false,
          feature_codes: null,
        })
        setUserInfoLoaded(true)

        // Get URL parameter
        try {
          const paramUrlResponse = await getParamUrl()
          // Verify that the response contains a valid URL (not empty)
          if (paramUrlResponse?.data?.url && paramUrlResponse.data.url.trim() !== '') {
            // Save URL to store
            dispatch.incomingCall.setParamUrl(paramUrlResponse.data.url)
            // Save onlyQueues setting to store
            dispatch.incomingCall.setOnlyQueues(paramUrlResponse.data.only_queues || false)
            // Save URL to localStorage
            savePreference('incomingCallUrl', paramUrlResponse.data.url, userInfo.data.username)
            savePreference(
              'paramUrlOnlyQueues',
              paramUrlResponse.data.only_queues || false,
              userInfo.data.username,
            )
            dispatch.incomingCall.setLoaded(true)
            dispatch.incomingCall.setUrlAvailable(true)
          } else {
            // Empty response or invalid URL - treat as an error
            dispatch.incomingCall.setErrorMessage('Invalid URL configuration')
            dispatch.incomingCall.setUrlAvailable(false)

            // Set preference to 'never' if URL is not available
            if (
              userInfo.data.settings?.open_param_url &&
              userInfo.data.settings.open_param_url !== 'never'
            ) {
              const settingsStatus = { open_param_url: 'never' }
              try {
                await setIncomingCallsPreference(settingsStatus)
                dispatch.user.updateOpenParamUrl('never')
              } catch (error) {
                console.error('Failed to set preference to never:', error)
              }
            }

            // Use a placeholder URL just to show something in the interface
            const defaultUrl = 'https://www.example.com/customers?phone={phone}'
            dispatch.incomingCall.setParamUrl(defaultUrl)
            dispatch.incomingCall.setLoaded(true)
          }
        } catch (error) {
          console.error('Error loading parameter URL:', error)
          dispatch.incomingCall.setErrorMessage('Cannot retrieve URL configuration')
          dispatch.incomingCall.setUrlAvailable(false)

          // Set preference to 'never' if URL is not available
          if (
            userInfo.data.settings?.open_param_url &&
            userInfo.data.settings.open_param_url !== 'never'
          ) {
            const settingsStatus = { open_param_url: 'never' }
            try {
              await setIncomingCallsPreference(settingsStatus)
              dispatch.user.updateOpenParamUrl('never')
            } catch (error) {
              console.error('Failed to set preference to never:', error)
            }
          }

          // Use a placeholder URL just to show something in the interface
          const defaultUrl = 'https://www.example.com/customers?phone={phone}'
          dispatch.incomingCall.setParamUrl(defaultUrl)
          dispatch.incomingCall.setLoaded(true)
        }
      } else {
        if (!ctiStatus.isUserInformationMissing) {
          // update global store
          store.dispatch.ctiStatus.setUserInformationMissing(true)
          store.dispatch.ctiStatus.setWebRtcError(true)
          // force logout
          let isLogoutError: any = {
            isUserInformationMissing: true,
          }
          doLogout(isLogoutError)
        }
      }
    }

    // visibilityChangeHandler do not manage refresh, this is only for refresh case
    if (resfreshUserInfo) {
      fetchUserInfo()
      setResfreshUserInfo(false)
    }

    const visibilityChangeHandler = () => {
      if (document.visibilityState === 'visible') {
        setResfreshUserInfo(false)
        setUserInfoLoaded(false)
        fetchUserInfo()
      } else {
        // TODO Implement actions when the visibility is off
      }
    }

    // Manage change of visibility
    document.addEventListener('visibilitychange', visibilityChangeHandler)

    // Refresh api every 45 minutes
    const reloadInterval = setInterval(() => {
      fetchUserInfo()
      // Set timer to 45 minutes
    }, 1000 * 45 * 60)

    // Clean interval if user leave the page
    return () => {
      clearInterval(reloadInterval)
      document.removeEventListener('visibilitychange', visibilityChangeHandler)
    }
  }, [isUserInfoLoaded, resfreshUserInfo])

  // get profiling data on page load
  useEffect(() => {
    const fetchProfilingInfo = async () => {
      const profilingInfo: ProfilingTypes = await getProfilingInfo()

      if (profilingInfo) {
        dispatch.profiling.update(profilingInfo)
      }
    }

    fetchProfilingInfo()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // get feature codes on page load
  useEffect(() => {
    async function initFeatureCodes() {
      try {
        const codes = await getFeatureCodes()
        if (codes) {
          dispatch.user.updateFeatureCodes(codes)
        }
      } catch (error) {
        console.warn('Failed to fetch feature codes:', error)
      }
    }

    if (firstRenderFeatureCodes) {
      initFeatureCodes()
      setFirstRenderFeatureCodes(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstRenderFeatureCodes])

  // Load ringtones from phone-island on page load
  useEffect(() => {
    if (firstRenderRingtones) {
      // Small delay to ensure phone-island is ready
      const initTimeout = setTimeout(() => {
        eventDispatch('phone-island-ringing-tone-list', {})
      }, 500)

      // Retry after 2 seconds if not loaded
      const retryTimeout = setTimeout(() => {
        if (!store.getState().ringtones.isLoaded) {
          console.log('Retrying ringtones request...')
          eventDispatch('phone-island-ringing-tone-list', {})
        }
      }, 5000)

      setFirstRenderRingtones(false)

      return () => {
        clearTimeout(initTimeout)
        clearTimeout(retryTimeout)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstRenderRingtones])

  // Listen for ringtones list response
  useEventListener('phone-island-ringing-tone-list-response', (data: any) => {
    console.log('Ringtones received in Layout:', data)
    if (data?.ringtones) {
      dispatch.ringtones.setRingtones(data.ringtones)
    }
  })

  // check here
  useEffect(() => {
    if (profilePicture?.isProfileEdite) {
      localStorage.removeItem('caches-' + authStore.username)
      retrieveAvatars(authStore)
      store?.dispatch?.profilePicture?.setEditedProfile(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profilePicture?.isProfileEdite])

  // get operators on page load
  useEffect(() => {
    async function fetchOperators() {
      if (profile?.macro_permissions?.presence_panel?.value) {
        if (!operatorsStore.isOperatorsLoaded && !operatorsStore.isLoading) {
          store.dispatch.operators.setLoading(true)
          store.dispatch.operators.setOperatorsLoaded(false)
          store.dispatch.operators.setErrorMessage('')

          try {
            const userEndpoints = await retrieveUserEndpoints()
            retrieveGroups()
            retrieveExtensions()
            retrieveAvatars(authStore)
            retrieveFavoriteOperators(authStore, userEndpoints)
          } catch (e) {
            store.dispatch.operators.setErrorMessage('Cannot retrieve operators')
            store.dispatch.operators.setOperatorsLoaded(true)
            store.dispatch.operators.setLoading(false)
          }
        }
      }
    }

    if (firstRenderOperators) {
      setFirstRenderOperators(false)
    } else {
      fetchOperators()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    operatorsStore?.isOperatorsLoaded,
    firstRenderOperators,
    profile?.macro_permissions?.presence_panel?.value,
  ])

  // detect when operators data has been loaded
  useEffect(() => {
    if (
      operatorsStore.isUserEndpointsLoaded &&
      operatorsStore.isGroupsLoaded &&
      operatorsStore.isExtensionsLoaded &&
      operatorsStore.isAvatarsLoaded &&
      operatorsStore.isFavoritesLoaded
    ) {
      buildOperators(operatorsStore)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    operatorsStore.isUserEndpointsLoaded,
    operatorsStore.isGroupsLoaded,
    operatorsStore.isExtensionsLoaded,
    operatorsStore.isAvatarsLoaded,
    operatorsStore.isFavoritesLoaded,
  ])

  // register to phone island events

  const user = authStore.username
  const { mainPresence: topBarPresence, mainextension } = useSelector(
    (state: RootState) => state.user,
  )

  // load / reload queues
  useEffect(() => {
    if (
      mainextension &&
      operatorsStore.isOperatorsLoaded &&
      !queuesStore.isLoaded &&
      profile?.macro_permissions?.queue_agent?.value
    ) {
      retrieveQueues(authStore.username, mainextension, operatorsStore.operators)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    queuesStore.isLoaded,
    operatorsStore.isOperatorsLoaded,
    mainextension,
    profile?.macro_permissions?.queue_agent?.value,
  ])

  //load / reload queue manager queues
  useEffect(() => {
    if (
      mainextension &&
      operatorsStore.isOperatorsLoaded &&
      !queueManagerStore.isLoaded &&
      profile?.macro_permissions?.qmanager?.value
    ) {
      retrieveQueueManager(authStore.username, mainextension, operatorsStore.operators)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    queueManagerStore.isLoaded,
    operatorsStore.isOperatorsLoaded,
    mainextension,
    profile?.macro_permissions?.qmanager?.value,
  ])

  const globalSearchClick = (event: any) => {
    const globalSearch = document.querySelector('#globalSearch')

    if (globalSearch) {
      const withinBoundaries = event.composedPath().includes(globalSearch)

      if (withinBoundaries) {
        // dim the screen and set user attention on global search
        store.dispatch.globalSearch.setFocused(true)
      } else {
        // close global search
        store.dispatch.globalSearch.setOpen(false)
        store.dispatch.globalSearch.setFocused(false)
      }
    }
  }

  useEffect(() => {
    if (firstRenderGlobalSearchListener) {
      setFirstRenderGlobalSearchListener(false)
    } else {
      document.addEventListener('click', globalSearchClick)
    }

    return () => {
      // clean up event listener
      document.removeEventListener('click', globalSearchClick)
    }
  }, [firstRenderGlobalSearchListener])

  useEventListener('phone-island-main-presence', (data: any) => {
    const opName = Object.keys(data)[0]
    const mainPresence = data[opName]?.mainPresence
    store.dispatch.operators.updateMainPresence(opName, mainPresence)
    if (data[user] && data[user]?.mainPresence !== topBarPresence) {
      dispatch.user.updateMainPresence(mainPresence)
    }
  })

  //Get user information from store
  const userInformation = useSelector((state: RootState) => state.user)

  useEventListener('phone-island-webrtc-unregistered', (data: any) => {})

  const [conversationObject, setConversationObject]: any = useState({})

  const [variableCheck, setVariableCheck] = useState(false)

  useEffect(() => {
    function showNotification() {
      if (document.visibilityState !== 'visible' && variableCheck) {
        if (Notification.permission === 'granted') {
          let iconUrl = ''
          if (conversationObject) {
            if (conversationObject?.avatar && conversationObject?.avatar != '') {
              //If caller has avatar use it
              iconUrl = conversationObject?.avatar
            } else {
              //Else use default icon
              const svgString = `
                <svg className="h-full w-full text-gray-600 bg-white" viewBox="0 0 24 24">
                  <path d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              `
              // Convert svg icon
              const blob = new Blob([svgString], { type: 'image/svg+xml' })
              iconUrl = URL.createObjectURL(blob)
            }

            // Create notification with caller informations
            const notification = new Notification(`${conversationObject?.name}`, {
              body: `${conversationObject?.number}`,
              icon: iconUrl,
            })

            setVariableCheck(false)

            notification.onclick = function () {
              notification.close()
              window.focus()
            }
          }
        } else {
          Notification.requestPermission()

            .then((permission) => {
              if (permission === 'granted') {
                showNotification()
              }
            })
            .catch((error) => {
              console.error('No permissions', error)
            })
        }
      }
    }

    showNotification()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variableCheck])

  function isObjectEmpty(obj: any) {
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        return false
      }
    }
    return true
  }

  //set desktop phone device information
  const [desktopPhoneDevice, setDesktopPhoneDevice]: any = useState({})
  const [webrtcData, setWebrtcData]: any = useState({})

  useEffect(() => {
    if (userInformation?.endpoints) {
      let endpointsInformation = userInformation?.endpoints
      if (endpointsInformation?.extension) {
        setDesktopPhoneDevice(
          endpointsInformation?.extension.filter((phone) => phone?.type === 'nethlink'),
        )
        setWebrtcData(endpointsInformation?.extension.filter((phone) => phone?.type === 'webrtc'))
      }
    }
  }, [userInformation?.endpoints])

  const setMainDeviceId = async (device: any) => {
    let deviceExtension: any = {}
    if (device) {
      deviceExtension.id = device?.id
      try {
        await setMainDevice(deviceExtension)
        dispatch.user.updateDefaultDevice(device)
      } catch (err) {
        console.log(err)
      }
    }
  }

  const isFirstRunRef = useRef(true)
  const handleWebRTCAsDefaultDevice = () => {
    if (
      desktopPhoneDevice?.length > 0 &&
      desktopPhoneDevice[0]?.id !== '' &&
      operatorsStore?.extensions[desktopPhoneDevice[0]?.id]?.status === 'offline' &&
      userInformation?.default_device?.type === 'nethlink' &&
      webrtcData?.length > 0
    ) {
      let deviceIdObject = webrtcData[0]
      setMainDeviceId(deviceIdObject)
    }
  }

  const handlePhysicalDeviceDetach = () => {
    if (userInformation?.default_device?.type === 'physical') {
      let deviceInformationObject = webrtcData[0]
      let physicalPhoneInformationObject = userInformation?.default_device
      eventDispatch('phone-island-detach', { deviceInformationObject })
      eventDispatch('phone-island-destroy', {})
      setMainDeviceId(physicalPhoneInformationObject)
    }
  }

  useEffect(() => {
    if (
      isFirstRunRef?.current &&
      userInformation?.default_device?.type === '' &&
      isEmpty(operatorsStore?.extensions)
    ) {
      isFirstRunRef.current = true
    }
    if (
      isFirstRunRef?.current &&
      userInformation?.default_device?.type !== '' &&
      !isEmpty(operatorsStore?.extensions)
    ) {
      isFirstRunRef.current = false
      handleWebRTCAsDefaultDevice()
      handlePhysicalDeviceDetach()
    }
  }, [
    desktopPhoneDevice,
    operatorsStore?.extensions,
    webrtcData,
    userInformation?.default_device?.type,
  ])

  // Avoid webrtc register if user has a physical phone as main device
  useEventListener('phone-island-webrtc-registered', (data) => {
    if (
      webrtcData?.length > 0 &&
      userInformation?.default_device?.type !== '' &&
      userInformation?.default_device?.type === 'physical'
    ) {
      let deviceIdObject = webrtcData[0]
      let physicalPhoneInformationObject = userInformation?.default_device
      eventDispatch('phone-island-detach', { deviceIdObject })
      eventDispatch('phone-island-destroy', {})
      setMainDeviceId(physicalPhoneInformationObject)
    }
  })

  useEventListener('phone-island-default-device-updated', (data) => {
    let endpointsInformation = userInformation?.endpoints
    let correctExtension = endpointsInformation.extension.filter((phone) => phone?.id === data.id)

    dispatch.user.updateDefaultDevice(correctExtension[0])
  })

  useEventListener('phone-island-extensions-update', (data) => {
    const opName: any = Object.keys(data)[0]

    let extensionInformation: any = {
      conversations: data[opName]?.conversations,
      dnd: data[opName]?.dnd,
      ip: data[opName]?.ip,
      number: data[opName]?.number,
      port: data[opName]?.port,
      sipuseragent: data[opName]?.sipuseragent,
      status: data[opName]?.status,
      username: data[opName]?.username,
      exten: data[opName]?.exten,
      name: data[opName]?.name,
    }

    store.dispatch.operators.updateExten(data[opName]?.number, extensionInformation)
  })

  useEventListener('phone-island-conversations', (data: any) => {
    const opName = Object.keys(data)[0]
    const conversations = data[opName].conversations
    store.dispatch.operators.updateConversations(opName, conversations)
    if (!firstRenderAttach) {
      setFirstRenderAttach(true)
    }
    if (!firstRenderDetach) {
      setFirstRenderDetach(true)
    }

    if (data[currentUsername] && operators[currentUsername]) {
      if (
        operators[currentUsername]?.mainPresence === 'ringing' &&
        userInformation?.settings?.open_param_url === 'ringing' &&
        incomingCallStore?.isUrlAvailable &&
        !userInformation?.urlOpened
      ) {
        // Get the first conversation from the conversations object
        const conversationsObj = data[currentUsername]?.conversations
        if (conversationsObj && Object.keys(conversationsObj).length > 0) {
          const firstConversationKey = Object.keys(conversationsObj)[0]
          const firstConversation = conversationsObj[firstConversationKey]

          // Check onlyQueues setting and conversation type
          const onlyQueues = incomingCallStore?.onlyQueues || false
        }
      } else if (
        operators[currentUsername]?.mainPresence === 'busy' &&
        userInformation?.settings?.open_param_url === 'answered' &&
        data[currentUsername]?.conversations &&
        incomingCallStore?.isUrlAvailable &&
        !userInformation?.urlOpened
      ) {
        // Get the first conversation from the conversations object
        const conversationsObj = data[currentUsername]?.conversations
        if (conversationsObj && Object.keys(conversationsObj).length > 0) {
          const firstConversationKey = Object.keys(conversationsObj)[0]
          const firstConversation = conversationsObj[firstConversationKey]

          // Check onlyQueues setting and conversation type
          const onlyQueues = incomingCallStore?.onlyQueues || false
        }
      }
    }

    // Update queue connected calls
    // Process all conversations once and organize them by queue type
    const queueConnectedCalls: any = {}
    const queueManagerConnectedCalls: any = {}

    // Single loop through conversations to map them to appropriate queues
    Object.values(conversations).forEach((conversation: any) => {
      if (conversation?.throughQueue && conversation?.connected && conversation?.queueId) {
        const queueId = conversation.queueId
        const callInfo = { conversation, operatorUsername: opName }

        // Check and update regular queues
        if (queuesStore.queues[queueId]) {
          const queueName = queuesStore.queues[queueId].queue
          queueConnectedCalls[queueName] = queueConnectedCalls[queueName] || []
          queueConnectedCalls[queueName].push(callInfo)
        }

        // Check and update queue manager queues
        if (queueManagerStore.queues[queueId]) {
          const queueName = queueManagerStore.queues[queueId].queue
          queueManagerConnectedCalls[queueName] = queueManagerConnectedCalls[queueName] || []
          queueManagerConnectedCalls[queueName].push(callInfo)
        }
      }
    })

    // Update store with processed calls for regular queues
    Object.entries(queueConnectedCalls).forEach(([queueId, calls]) => {
      store?.dispatch?.queues?.setConnectedCalls(queueId, calls)
    })

    // Update store with processed calls for queue manager queues
    Object.entries(queueManagerConnectedCalls).forEach(([queueId, calls]) => {
      store?.dispatch?.queueManagerQueues?.setConnectedCalls(queueId, calls)
    })

    // To delete connected calls we need to check user inside store
    // and also user inside data received from phone island event
    //Queues
    for (const queueId in queuesStore?.queues) {
      const queue = queuesStore?.queues[queueId]

      if (!isObjectEmpty(queue?.connectedCalls)) {
        const updatedConnectedCalls = queue.connectedCalls.filter((call: any) => {
          if (data[call?.operatorUsername]) {
            const conversation = data[call?.operatorUsername].conversations
            return !isObjectEmpty(conversation)
          }

          return true
        })

        store.dispatch.queues.setConnectedCalls(queueId, updatedConnectedCalls)
      }
    }

    //Queue manager
    for (const queueId in queueManagerStore?.queues) {
      const queueManagerQueues = queueManagerStore?.queues[queueId]

      if (!isObjectEmpty(queueManagerQueues?.connectedCalls)) {
        const updatedConnectedCalls = queueManagerQueues.connectedCalls.filter((call: any) => {
          if (data[call?.operatorUsername]) {
            const conversation = data[call?.operatorUsername].conversations
            return !isObjectEmpty(conversation)
          }

          return true
        })

        store.dispatch.queueManagerQueues.setConnectedCalls(queueId, updatedConnectedCalls)
      }
    }

    // If user start a call or receive a call close side drawer
    if (data[currentUsername] && isEmpty(data[currentUsername]?.conversations) && !avoidClose) {
      dispatch?.sideDrawer?.setShown(false)
    }

    // When user close listen call set to false and empty id conversation
    if (data[currentUsername] && isEmpty(data[currentUsername]?.conversations)) {
      let listeningInformations = {
        isListening: false,
        listening_id: '',
      }
      store?.dispatch?.userActions?.updateListeningInformation(listeningInformations)
    }

    // When user close intrude call set to false and empty id conversation
    if (data[currentUsername] && isEmpty(data[currentUsername]?.conversations)) {
      let intrudeInfo = {
        isIntrude: false,
        intrude_id: '',
      }
      store?.dispatch?.userActions?.updateIntrudeInformation(intrudeInfo)
    }

    setVariableCheck(false)
    if (
      data[currentUsername] &&
      data[currentUsername]?.conversations &&
      operators[currentUsername]?.mainPresence === 'ringing'
    ) {
      const firstElementConversation = Object.keys(data[currentUsername].conversations)[0]

      if (firstElementConversation && !isEmpty(data[currentUsername]?.conversations)) {
        let callerInfo =
          operatorsStore?.extensions[
            data[currentUsername]?.conversations[firstElementConversation]?.counterpartNum
          ]

        let callerUsername = callerInfo?.username
        let callerAvatar = operatorsStore.avatars[callerUsername]
        let notificationObject: any = {
          number: data[currentUsername]?.conversations[firstElementConversation]?.counterpartNum,
          name: data[currentUsername]?.conversations[firstElementConversation]?.counterpartName,
          avatar: callerAvatar || '',
        }
        //Set all the content that will be displayed on notification
        setConversationObject(notificationObject)
        setVariableCheck(true)
      }
    }

    /* CUSTOMER CARDS SECTION
     * On phone-island-conversations event must be checked if user:
     * - Has customer card permissions
     * - Which type of customer card permissions has selected ( disabled, incoming )
     * - If path if different from customer card
     * - Which type of mainPresence status has got ( ringing, busy )
     * - Check if counterpartNum is not present in allExtension api call result
     */

    // If status is equal to ringing and customer card equal to incoming
    if (
      data[currentUsername] &&
      operators[currentUsername] &&
      operators[currentUsername]?.mainPresence === 'ringing' &&
      profile?.macro_permissions?.customer_card?.value &&
      data[currentUsername]?.conversations &&
      loadPreference('customerCardPreference', authStore.username) === 'incoming'
    ) {
      const conversations = data[currentUsername]?.conversations
      if (conversations && Object.keys(conversations).length > 0) {
        const firstConversationKey = Object.keys(conversations)[0]
        const firstConversation = conversations[firstConversationKey]

        if (firstConversation?.counterpartNum) {
          const counterpartNum = firstConversation.counterpartNum

          // For queue calls, always consider the number as external
          // For other calls, check if the number is in extensions
          const isExternalNumber = firstConversation.throughQueue
            ? true // Queue calls are always considered external for customer cards
            : !operatorsStore?.extensions?.[counterpartNum] // For other calls, check if it's in extensions

          const isUnknown =
            counterpartNum === 'unknown' || counterpartNum === '<unknown>' || !counterpartNum

          if (isExternalNumber && !isUnknown) {
            const customerType = 'person'
            const ccardObject = `?${counterpartNum}-${customerType}`

            dispatch.customerCards.updateCallerCustomerCardInformation(ccardObject)

            if (window.location.search != ccardObject) {
              // Navigate to customer cards page
              router.push(`/customercards${ccardObject}`).catch((error: any) => {
                console.error('Navigation error (Ringing):', error)
              })
            }
          }
        }
      }
    }

    // If status is equal to busy and customer card equal to connected
    if (
      data[currentUsername] &&
      operators[currentUsername] &&
      operators[currentUsername]?.mainPresence === 'busy' &&
      profile?.macro_permissions?.customer_card?.value &&
      data[currentUsername]?.conversations &&
      loadPreference('customerCardPreference', authStore.username) === 'connected'
    ) {
      const conversations = data[currentUsername]?.conversations
      if (conversations && Object.keys(conversations).length > 0) {
        const firstConversationKey = Object.keys(conversations)[0]
        const firstConversation = conversations[firstConversationKey]

        if (firstConversation?.counterpartNum) {
          const counterpartNum = firstConversation.counterpartNum

          // For queue calls, always consider the number as external
          // For other calls, check if the number is in extensions
          const isExternalNumber = firstConversation.throughQueue
            ? true // Queue calls are always considered external for customer cards
            : !operatorsStore?.extensions?.[counterpartNum] // For other calls, check if it's in extensions

          const isUnknown =
            counterpartNum === 'unknown' || counterpartNum === '<unknown>' || !counterpartNum

          if (isExternalNumber && !isUnknown && firstConversation.connected) {
            const customerType = 'person'
            const ccardObject = `?${counterpartNum}-${customerType}`

            dispatch.customerCards.updateCallerCustomerCardInformation(ccardObject)

            if (window.location.search != ccardObject) {
              // Navigate to customer cards page
              router.push(`/customercards${ccardObject}`).catch((error: any) => {
                console.error('Navigation error (Ringing):', error)
              })
            }
          }
        }
      }
    }

    let extenUpdateObject: any = {
      status: data[currentUsername]?.status,
      dnd: data[currentUsername]?.dnd,
      port: data[currentUsername]?.port,
      sipuseragent: data[currentUsername]?.sipuseragent,
      username: data[currentUsername]?.username,
    }
    //check type of extenUpdate event
    // Update user extension
    store.dispatch.operators.updateExten(data[currentUsername]?.number, extenUpdateObject)
    if (
      !isEmpty(desktopPhoneDevice) &&
      data[currentUsername]?.number === desktopPhoneDevice[0]?.id &&
      data[currentUsername]?.status === 'online' &&
      isEmpty(data[currentUsername]?.conversation)
    ) {
      if (firstRenderDetach) {
        let desktopPhoneObject = desktopPhoneDevice[0]
        const isPhysicalDefault = userInformation.endpoints.extension.some(
          (ext: any) => ext.type === 'physical' && ext.id === userInformation?.default_device?.id,
        )
        if (!isPhysicalDefault) {
          setMainDeviceId(desktopPhoneObject)
          setFirstRenderDetach(false)
        }
      }
    } else if (
      data[currentUsername]?.number === desktopPhoneDevice[0]?.id &&
      data[currentUsername]?.status === 'offline' &&
      isEmpty(data[currentUsername]?.conversation)
    ) {
      if (firstRenderAttach) {
        let deviceIdInfo: any = {}
        const isPhysicalDefault = userInformation.endpoints.extension.some(
          (ext: any) => ext.type === 'physical' && ext.id === userInformation?.default_device?.id,
        )
        if (!isPhysicalDefault) {
          deviceIdInfo = webrtcData[0]
          setMainDeviceId(deviceIdInfo)
          setFirstRenderAttach(false)
          eventDispatch('phone-island-attach', { deviceIdInfo })
        }
      }
    }
  })

  const currentOperator = operators[currentUsername]

  // Handle automatic queue pause based on user presence status
  useEffect(() => {
    const userSettings = userInformation?.settings

    if (
      currentOperator &&
      userSettings?.queue_auto_pause_onpresence &&
      userSettings?.queue_autopause_presencelist &&
      Array.isArray(userSettings.queue_autopause_presencelist) &&
      userSettings.queue_autopause_presencelist.length > 0 &&
      queuesStore.isLoaded &&
      mainextension
    ) {
      const shouldPauseQueues = userSettings.queue_autopause_presencelist.some(
        (pauseState: string) => {
          // Map preference states to operator's mainPresence
          switch (pauseState) {
            case 'dnd':
              return currentOperator?.mainPresence === 'dnd'
            case 'callforward':
              return currentOperator?.mainPresence === 'callforward'
            default:
              return false
          }
        },
      )

      if (shouldPauseQueues) {
        // Find all queues where user is logged in and not already paused
        const queuesToPause = Object.values(queuesStore?.queues).filter((queue: any) => {
          const userMember = queue?.members?.[mainextension]
          return userMember?.loggedIn && !userMember?.paused
        })

        // Pause all appropriate queues
        queuesToPause.forEach((queue: any) => {
          const reason =
            currentOperator?.mainPresence === 'dnd'
              ? 'DND'
              : currentOperator?.mainPresence === 'callforward'
              ? 'Call Forward'
              : 'Auto Pause'

          pauseQueue(mainextension, queue?.queue, reason)
        })
      }
    }
  }, [
    currentOperator?.mainPresence,
    userInformation?.settings?.queue_auto_pause_onpresence,
    userInformation?.settings?.queue_autopause_presencelist,
    queuesStore.isLoaded,
    mainextension,
    currentUsername,
  ])

  // Save prev user main presence state
  const [prevOperatorState, setPrevOperatorState] = useState<string | null>(null)

  // Handle automatic queue unpause when exiting from callforward or dnd states
  useEffect(() => {
    const userSettings = userInformation?.settings

    if (
      prevOperatorState &&
      currentOperator &&
      userSettings?.queue_auto_pause_onpresence &&
      userSettings?.queue_autopause_presencelist &&
      Array.isArray(userSettings.queue_autopause_presencelist) &&
      userSettings.queue_autopause_presencelist.length > 0 &&
      queuesStore.isLoaded &&
      mainextension
    ) {
      // Check if we're exiting from a state that was configured for auto-pause
      const exitingFromPauseState = userSettings.queue_autopause_presencelist.some(
        (pauseState: string) => {
          switch (pauseState) {
            case 'dnd':
              return prevOperatorState === 'dnd' && currentOperator?.mainPresence !== 'dnd'
            case 'callforward':
              return (
                prevOperatorState === 'callforward' &&
                currentOperator?.mainPresence !== 'callforward'
              )
            default:
              return false
          }
        },
      )

      if (exitingFromPauseState) {
        // Find all queues where user is logged in and currently paused
        const queuesToUnpause = Object.values(queuesStore?.queues).filter((queue: any) => {
          const userMember = queue?.members?.[mainextension]
          return userMember?.loggedIn && userMember?.paused
        })

        // Unpause all queues
        queuesToUnpause.forEach((queue: any) => {
          unpauseQueue(mainextension, queue?.queue)
        })
      }
    }
  }, [
    currentOperator?.mainPresence,
    prevOperatorState,
    userInformation?.settings?.queue_auto_pause_onpresence,
    userInformation?.settings?.queue_autopause_presencelist,
    queuesStore.isLoaded,
    mainextension,
  ])

  //check if user has closed current calls
  const [closedCall, setClosedCall] = useState(false)

  //check previous user mainPresence
  useEffect(() => {
    if (
      currentOperator &&
      currentOperator?.mainPresence === 'online' &&
      (prevOperatorState === 'busy' || prevOperatorState === 'ringing') &&
      !closedCall
    ) {
      setClosedCall(true)
      // restore open url value inside store to default
      store.dispatch.user.setUrlOpened(false)
    } else {
      setClosedCall(false)
    }

    setPrevOperatorState(currentOperator ? currentOperator?.mainPresence : null)
  }, [currentOperator, prevOperatorState, closedCall])

  // If user has closed phone island call let reload last calls
  useEffect(() => {
    if (closedCall) {
      store.dispatch.lastCalls.setReloadLastCalls(true)
    } else {
      store.dispatch.lastCalls.setReloadLastCalls(false)
    }
  }, [closedCall])

  useEventListener('phone-island-queue-update', (data: any) => {
    const queueId = Object.keys(data)[0]
    const queueData = data[queueId]

    // skip events related to unknown queues
    const knownQueues = Object.keys(queuesStore.queues)

    // skip events related to unknown queue manager queues
    const knownQueueManagerQueues = Object.keys(queueManagerStore.queues)

    // queue
    if (!knownQueues.includes(queueId)) {
      return
    }

    store.dispatch.queues.processQueue({
      queueData,
      username: authStore.username,
      mainextension,
      operators: operatorsStore.operators,
    })

    // // queue manager
    if (!knownQueueManagerQueues.includes(queueId)) {
      return
    }

    store.dispatch.queueManagerQueues.processQueue({
      queueData,
      username: authStore.username,
      mainextension,
      operators: operatorsStore.operators,
    })
  })

  useEventListener('phone-island-queue-member-update', (data: any) => {
    const opMainExtension = Object.keys(data)[0]
    const queueMemberData = data[opMainExtension]
    store?.dispatch?.queues?.setQueueMember(queueMemberData)
    store?.dispatch?.queueManagerQueues?.setQueueMember(queueMemberData)
  })

  //check if the user makes a double login
  useEventListener('phone-island-user-already-login', () => {
    if (!ctiStatus?.webRtcError) {
      // update global store
      store?.dispatch?.ctiStatus?.setWebRtcError(true)
      // force logout
      let isLogoutError: any = {
        isWebrtcError: true,
      }
      doLogout(isLogoutError)
    }
  })

  //check if server reloaded
  useEventListener('phone-island-server-reloaded', () => {
    setResfreshUserInfo(true)
  })

  //check if server restart
  useEventListener('phone-island-server-disconnected', () => {
    if (!ctiStatus.isUserInformationMissing) {
      // update global store
      store.dispatch.ctiStatus.setUserInformationMissing(true)
      store.dispatch.ctiStatus.setWebRtcError(true)
      // force logout
      let isLogoutError: any = {
        isUserInformationMissing: true,
      }
      doLogout(isLogoutError)
    }
  })

  //check if socket reconnect
  useEventListener('phone-island-socket-disconnected', () => {})

  // Reload operators data when socket reconnects to sync state
  // This handles cases where events were lost during network interruption
  useEventListener('phone-island-socket-reconnected', () => {
    console.log('[SOCKET-RECONNECT] Socket reconnected, refreshing state')
    retrieveUserEndpoints()
    retrieveExtensions()
  })

  const defaultToastTimeoutMs = 3000

  //Avoid to see customer card if customer list is empty and preferences is not setted to never show
  const [customerCardsList, setCustomerCardsList]: any = useState({})
  const [isCustomerCardsListLoaded, setIsCustomerCardsListLoaded] = useState(false)
  const [customerCardError, setCustomerCardError] = useState('')

  // retrieve customer cards
  useEffect(() => {
    async function getCustomerCards() {
      if (!isCustomerCardsListLoaded && profile?.macro_permissions?.customer_card?.value) {
        try {
          setCustomerCardError('')
          const res = await getCustomerCardsList()
          setCustomerCardsList(res)
        } catch (e) {
          console.error(e)
          setCustomerCardError('Cannot retrieve customer cards list')
        }
        setIsCustomerCardsListLoaded(true)
      }
    }
    getCustomerCards()
  }, [
    isCustomerCardsListLoaded,
    customerCardsList,
    profile?.macro_permissions?.customer_card?.value,
  ])

  const ccardStatus = loadPreference('customerCardPreference', authStore.username)
  useEffect(() => {
    if (isEmpty(customerCardsList) && ccardStatus !== 'disabled') {
      const ccardObject = {} as Record<string, any>
      ccardObject.open_ccard = 'disabled'
      changeCCardSettings(ccardObject)
      dispatch.user.updateSettings(ccardObject)
    }
  }, [customerCardsList])

  async function changeCCardSettings(ccardObject: any) {
    try {
      await setUserSettings(ccardObject)
      dispatch.user.updateSettings(ccardObject)
    } catch (e) {
      console.error(e)
    }
  }

  const parkingInfo = useSelector((state: RootState) => state.park)
  const parkingsRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const parkingsRefreshInFlightRef = useRef(false)

  const scheduleParksRefresh = () => {
    if (!profile?.macro_permissions?.settings?.permissions?.parkings?.value) {
      return
    }

    // Debounce bursty update events (e.g. multiple parking events in short time).
    if (parkingsRefreshTimerRef.current) {
      clearTimeout(parkingsRefreshTimerRef.current)
    }

    parkingsRefreshTimerRef.current = setTimeout(async () => {
      if (parkingsRefreshInFlightRef.current) {
        return
      }

      parkingsRefreshInFlightRef.current = true
      try {
        await retrieveParksList()
      } catch (e) {
        console.error(e)
      } finally {
        parkingsRefreshInFlightRef.current = false
      }
    }, 250)
  }

  useEffect(() => {
    return () => {
      if (parkingsRefreshTimerRef?.current) {
        clearTimeout(parkingsRefreshTimerRef.current)
      }
    }
  }, [])

  useEventListener('phone-island-parking-update', () => {
    // On phone island event reload park lists
    scheduleParksRefresh()
  })

  const [firstRenderPark, setFirstRenderPark] = useState(true)
  useEffect(() => {
    if (firstRenderPark) {
      setFirstRenderPark(false)
      return
    }

    scheduleParksRefresh()
  }, [firstRenderPark, profile?.macro_permissions?.settings?.permissions?.parkings?.value])

  const controls = useAnimation()

  useEffect(() => {
    if (parkingInfo?.isParkingFooterVisible) {
      controls.start({ y: 0, transition: { type: 'spring', damping: 10, stiffness: 200 } })
    }
  }, [parkingInfo?.isParkingFooterVisible, controls])

  const rightSideStatus: any = useSelector((state: RootState) => state.rightSideMenu)
  useEventListener('phone-island-voicemail-received', () => {
    dispatch.voicemail.reload()
  })
  const { theme } = useSelector((state: RootState) => state?.darkTheme)
  const phoneIslandThemePreference = getJSONItem(`phone-island-theme-selected`) || ''

  useEffect(() => {
    if (
      phoneIslandThemePreference === null ||
      phoneIslandThemePreference === undefined ||
      phoneIslandThemePreference === ''
    ) {
      if (
        theme === 'dark' ||
        (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
      ) {
        setJSONItem('phone-island-theme-selected', { themeSelected: 'light' })
      } else {
        setJSONItem('phone-island-theme-selected', { themeSelected: 'dark' })
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme])

  const closePhoneIslandCall = () => {
    eventDispatch('phone-island-call-end', {})
  }
  // global keyborad shortcut
  useHotkeys('ctrl+alt+c', () => closePhoneIslandCall(), [])

  const [isPageFocused, setIsPageFocused] = useState(true)
  const notifiedSummaryIdsRef = useRef<Set<string>>(new Set())
  const watchedSummaryIdsRef = useRef<Set<string>>(new Set())
  const pendingSummaryIdsRef = useRef<Set<string>>(new Set())
  const summaryStatusTimeoutsRef = useRef<Map<string, number>>(new Map())
  const summaryPollCountRef = useRef<Map<string, number>>(new Map())
  const isSummaryNotificationEnabled = userStore?.settings?.call_summary_notifications !== false
  const summaryStatusPollIntervalMs = 5000
  // Max polls before giving up (~5 minutes at 5s interval, matching backend watch timeout)
  const summaryMaxPollCount = 60

  const getSummaryNotificationContact = (data?: {
    display_name?: string
    display_number?: string
  }) => {
    const displayName = data?.display_name?.trim() || ''
    const displayNumber = data?.display_number?.trim() || ''

    return displayName || displayNumber
  }

  const getSummaryNotificationMessage = (data?: {
    display_name?: string
    display_number?: string
  }) => {
    const contact = getSummaryNotificationContact(data)

    if (!contact) {
      return (
        t('Common.The summary is ready for review and editing') ||
        'The summary is ready for review and editing'
      )
    }

    return (
      t('Common.The summary of your call with {{contact}} is ready', {
        contact,
      }) || `The summary of your call with ${contact} is ready`
    )
  }

  // Track if page has focus
  useEffect(() => {
    const handleFocus = () => setIsPageFocused(true)
    const handleBlur = () => setIsPageFocused(false)

    window.addEventListener('focus', handleFocus)
    window.addEventListener('blur', handleBlur)

    return () => {
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('blur', handleBlur)
    }
  }, [])

  useEffect(() => {
    const summaryStatusTimeouts = summaryStatusTimeoutsRef.current
    const pendingSummaryIds = pendingSummaryIdsRef.current
    const summaryPollCount = summaryPollCountRef.current

    return () => {
      summaryStatusTimeouts.forEach((timeoutId) => window.clearTimeout(timeoutId))
      summaryStatusTimeouts.clear()
      pendingSummaryIds.clear()
      summaryPollCount.clear()
    }
  }, [])

  useEventListener('phone-island-summary-not-ready', (data: { linkedid?: string; uniqueid?: string }) => {
    if (!data?.linkedid || !isSummaryEnabled) {
      return
    }

    if (
      !isSummaryNotificationEnabled ||
      watchedSummaryIdsRef.current.has(data.linkedid) ||
      pendingSummaryIdsRef.current.has(data.linkedid)
    ) {
      return
    }

    pendingSummaryIdsRef.current.add(data.linkedid)

    const clearPendingSummaryStatusCheck = (linkedid: string) => {
      const timeoutId = summaryStatusTimeoutsRef.current.get(linkedid)
      if (timeoutId) {
        window.clearTimeout(timeoutId)
        summaryStatusTimeoutsRef.current.delete(linkedid)
      }
      pendingSummaryIdsRef.current.delete(linkedid)
      summaryPollCountRef.current.delete(linkedid)
    }

    const scheduleSummaryStatusCheck = (linkedid: string) => {
      const timeoutId = window.setTimeout(() => {
        void pollSummaryStatus(linkedid)
      }, summaryStatusPollIntervalMs)
      summaryStatusTimeoutsRef.current.set(linkedid, timeoutId)
    }

    const pollSummaryStatus = async (linkedid: string) => {
      // Enforce max poll budget to avoid polling indefinitely
      const pollCount = (summaryPollCountRef.current.get(linkedid) || 0) + 1
      summaryPollCountRef.current.set(linkedid, pollCount)
      if (pollCount > summaryMaxPollCount) {
        clearPendingSummaryStatusCheck(linkedid)
        return
      }

      try {
        const { checkSummaryList } = await import('../../services/user')
        const response = await checkSummaryList([{ linkedid }])
        const item = Array.isArray(response?.data) ? response.data[0] : null

        // Transcript row may not exist yet right after the call; keep polling
        if (!item || item?.error === 'not_found') {
          scheduleSummaryStatusCheck(linkedid)
          return
        }

        if (item?.has_summary === true) {
          clearPendingSummaryStatusCheck(linkedid)
          eventDispatch('phone-island-summary-ready', {
            linkedid: linkedid,
            uniqueid: item?.uniqueid,
            source: 'cti-polling',
          })
          return
        }

        if (item?.state === 'summarizing' && item?.has_transcription === true) {
          clearPendingSummaryStatusCheck(linkedid)
          watchedSummaryIdsRef.current.add(linkedid)
          eventDispatch('phone-island-call-summary-notify', {
            linkedid: linkedid,
            uniqueid: item?.uniqueid,
          })
          return
        }

        // Keep polling while processing is ongoing or transcription is pending
        if (item?.state === 'progress' || item?.state === 'summarizing') {
          scheduleSummaryStatusCheck(linkedid)
          return
        }

        clearPendingSummaryStatusCheck(linkedid)
      } catch {
        // Retry on transient errors instead of giving up immediately
        scheduleSummaryStatusCheck(linkedid)
      }
    }

    void pollSummaryStatus(data.linkedid)
  })

  useEventListener(
    'phone-island-summary-ready',
    (data: {
      linkedid?: string
      uniqueid?: string
      display_name?: string
      display_number?: string
      source?: 'check' | 'socket' | 'cti-polling'
    }) => {
      if (!data?.uniqueid || !data?.linkedid || !isSummaryEnabled) {
        return
      }

      const timeoutId = summaryStatusTimeoutsRef.current.get(data.linkedid)
      if (timeoutId) {
        window.clearTimeout(timeoutId)
        summaryStatusTimeoutsRef.current.delete(data.linkedid)
      }
      pendingSummaryIdsRef.current.delete(data.linkedid)

      if (notifiedSummaryIdsRef?.current?.has(data.uniqueid)) {
        return
      }
      notifiedSummaryIdsRef?.current?.add(data.uniqueid)

      const summaryMessage = getSummaryNotificationMessage(data)

      if (isSummaryNotificationEnabled && !isPageFocused && 'Notification' in window) {
        if (Notification.permission === 'granted') {
          const notification = new Notification(
            t('Common.Call summary ready') || 'Call summary ready',
            {
              body: summaryMessage,
              tag: `summary-${data.uniqueid}`,
            },
          )

          notification.onclick = () => {
            window.focus()
            dispatch.sideDrawer.update({
              isShown: true,
              contentType: 'callSummary',
              config: {
                uniqueid: data.uniqueid,
                linkedid: data.linkedid,
                isSummary: true,
              },
            })
            closeToast()
            notification.close()
          }
        } else if (Notification.permission !== 'denied') {
          Notification.requestPermission().then((permission) => {
            if (permission === 'granted') {
              const notification = new Notification(
                t('Common.Call summary ready') || 'Call summary ready',
                {
                  body: summaryMessage,
                  tag: `summary-${data.uniqueid}`,
                },
              )

              notification.onclick = () => {
                window.focus()
                dispatch.sideDrawer.update({
                  isShown: true,
                  contentType: 'callSummary',
                  config: {
                    uniqueid: data.uniqueid,
                    linkedid: data.linkedid,
                    isSummary: true,
                  },
                })
                closeToast()
                notification.close()
              }
            }
          })
        }
      }

      openToast(
        'success',
        <>
          {summaryMessage}
          <div className='mt-4'>
            <Button
              variant='primary'
              onClick={() => {
                dispatch.sideDrawer.update({
                  isShown: true,
                  contentType: 'callSummary',
                  config: {
                    uniqueid: data.uniqueid,
                    linkedid: data.linkedid,
                    isSummary: true,
                  },
                })
                closeToast()
              }}
            >
              {t('Common.View summary') || 'View summary'}
            </Button>
          </div>
        </>,
        t('Common.Call summary ready') || 'Call summary ready',
        5000,
        true,
      )
    },
  )

  return (
    <>
      <div>
        <Head>
          <title>{cleanProductNamePageTitle()}</title>
        </Head>
      </div>
      <div className='flex h-full'>
        {/* Navigation bar */}
        <NavBar items={items} />
        <div className='flex flex-1 flex-col overflow-hidden'>
          {/* Top heading bar */}
          <TopBar openMobileCb={() => setOpenMobileMenu(true)} />
          {/* Mobile navigation bar */}
          <MobileNavBar
            show={openMobileMenu}
            items={items}
            closeMobileMenu={() => setOpenMobileMenu(false)}
          />
          {/* Main content */}
          <div className='flex flex-1 items-stretch overflow-hidden bg-body dark:bg-bodyDark'>
            <main
              className={`flex-1 ${customScrollbarClass} ${
                parkingInfo?.isParkingFooterVisible &&
                profile?.macro_permissions?.settings?.permissions?.parkings?.value
                  ? 'pb-16'
                  : ''
              }`}
              id='main-content'
            >
              {/* Primary column */}
              <section
                aria-labelledby='primary-heading'
                className='flex min-w-0 flex-1 flex-col lg:order-last p-8'
              >
                {/* The page content */}
                {children}
              </section>
              <Portal>
                <SideDrawer
                  isShown={sideDrawer.isShown}
                  contentType={sideDrawer.contentType}
                  config={sideDrawer.config}
                  drawerClosed={() => closeSideDrawer()}
                />
                <UserSidebarDrawer isShown={rightSideStatus.isShown} />
              </Portal>
            </main>

            {/* Secondary column (hidden on smaller screens) */}
            <UserNavBar />
            <div className='absolute top-6 right-9 z-50'>
              {toast?.isShown && (
                <div>
                  <Toast
                    type={toast?.contentType || 'info'}
                    title={toast?.tytle || ''}
                    onClose={() => closeToast()}
                    show={toast?.isShown}
                    timeout={(toast?.timeout ?? defaultToastTimeoutMs) / 1000}
                    pauseTimerOnHover={true}
                    smaller={toast?.smaller}
                  >
                    {toast?.message}
                  </Toast>
                </div>
              )}
            </div>

            {parkingInfo?.isParkingFooterVisible &&
            profile?.macro_permissions?.settings?.permissions?.parkings?.value &&
            userInformation?.default_device &&
            userInformation?.default_device?.type !== 'nethlink' ? (
              <motion.div
                className='absolute bottom-0 left:0 sm:bottom-0 sm:left-0 md:bottom-0 md:left-20'
                initial={{ y: 100 }}
                animate={controls}
              >
                <ParkCards />
                <Tooltip anchorSelect='.tooltip-parking-button' className='relative z-30'>
                  {t('Parks.Click and hold to take current parking in call')}
                </Tooltip>
              </motion.div>
            ) : (
              <></>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
