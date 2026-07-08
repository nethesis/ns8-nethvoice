// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 *
 * The top bar
 *
 */

import React from 'react'
import { FC, useEffect, useState, createRef, RefObject } from 'react'
import { Avatar, Dropdown, Modal, TextInput, Button, Badge } from '../common'
import { doLogout } from '../../services/login'
import { store } from '../../store'
import { useSelector, useDispatch } from 'react-redux'
import { RootState, Dispatch } from '../../store'
import { changeStatusPresence, forwardStatus } from '../../lib/topBar'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faArrowRightFromBracket,
  faBars,
  faArrowRight,
  faMobile,
  faVoicemail,
} from '@fortawesome/free-solid-svg-icons'
import { getUserInfo } from '../../services/user'
import { loadNotificationsFromStorage } from '../../lib/notifications'
import { GlobalSearch } from './GlobalSearch'
import { useTranslation } from 'react-i18next'
import { isEmpty } from 'lodash'
import { setMainDevice } from '../../lib/devices'
import { eventDispatch } from '../../lib/hooks/eventDispatch'
import { UserMenu } from './UserMenu'

interface TopBarProps {
  openMobileCb: () => void
}

export const TopBar: FC<TopBarProps> = ({ openMobileCb }) => {
  const { name, mainextension, mainPresence, avatar } = useSelector(
    (state: RootState) => state?.user,
  )
  const { theme } = useSelector((state: RootState) => state.darkTheme)
  const auth = useSelector((state: RootState) => state.authentication)
  const sideDrawer = useSelector((state: RootState) => state.sideDrawer)
  const [firstNotificationsRender, setFirstNotificationsRender]: any = useState(true)
  const authStore = useSelector((state: RootState) => state.authentication)
  const notificationsStore = useSelector((state: RootState) => state.notifications)
  const operators = useSelector((state: RootState) => state.operators.operators)
  const profile = useSelector((state: RootState) => state.user)
  const operatorsStore: any = useSelector((state: RootState) => state.operators)

  const [mainDeviceType, setMainDeviceType] = useState('')
  const [noMobileListDevice, setNoMobileListDevice]: any = useState([])
  const [phoneLinkData, setPhoneLinkDataData]: any = useState([])

  const { t } = useTranslation()
  const dispatch = useDispatch<Dispatch>()

  // Check which type of device is the main device
  // also filter all the devices except the mobile ones
  useEffect(() => {
    if (profile?.endpoints) {
      let extensionObj: any = profile?.endpoints
      if (profile?.default_device?.id && !isEmpty(extensionObj)) {
        const extensionType = extensionObj.extension.find(
          (ext: any) => ext.id === profile?.default_device?.id,
        )
        if (extensionType?.type !== '') {
          setMainDeviceType(extensionType?.type)
        }
      }
      if (!isEmpty(extensionObj)) {
        const filteredDevices = extensionObj?.extension?.filter(
          (device: any) => device?.type !== 'mobile',
        )
        setNoMobileListDevice(filteredDevices)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.default_device])

  // Get phoneLink data on load
  useEffect(() => {
    if (profile?.endpoints) {
      let endpointsInformation = profile?.endpoints
      if (endpointsInformation?.extension) {
        setPhoneLinkDataData(
          endpointsInformation?.extension.filter((phone) => phone?.type === 'nethlink'),
        )
      }
    }
  }, [profile?.endpoints])

  // Get notifications on page load
  useEffect(() => {
    if (firstNotificationsRender) {
      setFirstNotificationsRender(false)
      return
    }

    if (!notificationsStore.isLoaded) {
      store.dispatch.notifications.setLoaded(false)
      const notifications = loadNotificationsFromStorage(authStore.username)
      store.dispatch.notifications.setNotifications(notifications)
      store.dispatch.notifications.setLoaded(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstNotificationsRender, notificationsStore.isLoaded])

  const openNotificationsDrawer = () => {
    store.dispatch.sideDrawer.update({
      isShown: true,
      contentType: 'notifications',
      config: null,
    })
  }

  // Handle presence modal
  const [showPresenceModal, setShowPresenceModal] = React.useState(false)
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setShowPresenceModal(false)
  }
  const numberInputRef: RefObject<HTMLInputElement> = createRef()

  function showModalPresence() {
    setShowPresenceModal(true)
  }

  // Set user presence
  const setPresence = async (presence: any) => {
    if (presence === 'callforward') {
      showModalPresence()
    } else {
      try {
        await changeStatusPresence(presence)
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
        }
      } catch (err) {
        console.log(err)
      }
    }
  }

  // Set call forward presence
  const setForwardPresence = async (number: any) => {
    let presence: any = 'callforward'
    try {
      await forwardStatus(presence, number)
      store.dispatch.operators.updateUserCallForwardStatus(profile?.mainextension, number)
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
          avatar: userInfo?.data?.settings.avatar,
          settings: userInfo?.data?.settings,
          recallOnBusy: userInfo?.data?.recallOnBusy,
          lkhash: userInfo?.data?.lkhash,
          call_summary_enabled: userInfo?.data?.call_summary_enabled === true,
          urlOpened: false,
          feature_codes: null,
        })
      }
    } catch (err) {
      console.log(err)
    }
  }

  // Handle presence modal actions
  const closedModalSaved = () => {
    setShowPresenceModal(false)
    setForwardPresence(numberInputRef.current?.value)
  }

  // Handle logout
  const disconnectionFunction = () => {
    let emptyObjectLogout: any = {}
    doLogout(emptyObjectLogout)
  }

  // Set main device
  const setMainDeviceId = async (device: any) => {
    let deviceExtension: any = {}
    if (device) {
      deviceExtension.id = device?.id
      try {
        await setMainDevice(deviceExtension)
        dispatch.user.updateDefaultDevice(device)
        if (device?.type === 'webrtc') {
          eventDispatch('phone-island-attach', { device })
        } else {
          eventDispatch('phone-island-detach', { device })
        }
      } catch (err) {
        console.log(err)
      }
    }
  }

  // Prepare user menu items
  const userMenuItems = (
    <UserMenu
      name={name}
      mainextension={mainextension}
      mainPresence={mainPresence}
      profile={profile}
      phoneLinkData={phoneLinkData}
      operatorsStore={operatorsStore}
      theme={theme}
      mainDeviceType={mainDeviceType}
      noMobileListDevice={noMobileListDevice}
      setPresence={setPresence}
      setForwardPresence={setForwardPresence}
      setMainDeviceId={setMainDeviceId}
      disconnectionFunction={disconnectionFunction}
    />
  )

  return (
    <header className='w-full'>
      <div className='relative z-50 flex h-16 flex-shrink-0 border-b shadow-sm border-gray-200 dark:border-gray-700 bg-topbar dark:bg-topbarDark'>
        <button
          type='button'
          className='border-r px-4 focus:outline-none focus:ring-2 focus:ring-inset md:hidden focus:ring-primaryLight border-gray-200 text-gray-500 dark:focus:ring-primaryDark dark:border-gray-700 dark:text-gray-400'
          onClick={openMobileCb}
        >
          <span className='sr-only'>{t('TopBar.Open sidebar')}</span>
          <FontAwesomeIcon icon={faBars} className='h-5 w-5' aria-hidden='true' />
        </button>
        <div className='flex flex-1 justify-end px-4 sm:px-6'>
          <GlobalSearch />
          <div className='ml-2 flex items-center space-x-2'>
            {/* Status badge (voicemail or callforward) */}
            {(mainPresence === 'callforward' ||
              mainPresence === 'voicemail' ||
              mainPresence === 'cellphone') && (
              <Badge
                variant={
                  mainPresence === 'callforward' || mainPresence === 'cellphone'
                    ? 'callforward'
                    : 'voicemail'
                }
                rounded='full'
                size='small'
                className='z-[100]'
              >
                <FontAwesomeIcon
                  icon={
                    mainPresence === 'callforward'
                      ? faArrowRight
                      : mainPresence === 'cellphone'
                      ? faMobile
                      : faVoicemail
                  }
                  className='h-4 w-4 mr-1 text-primary dark:text-topBarTextDark'
                  aria-hidden='true'
                />
                <span>
                  {mainPresence === 'callforward'
                    ? t('TopBar.Call forward')
                    : mainPresence === 'cellphone'
                    ? t('TopBar.Cellphone')
                    : t('TopBar.Voicemail')}
                </span>
                {profile?.endpoints?.cellphone[0]?.id &&
                  mainPresence === 'cellphone' &&
                  `${': ' + profile?.endpoints?.cellphone[0]?.id}`}
                {operatorsStore?.extensions[profile?.mainextension]?.cf !== '' &&
                  mainPresence === 'callforward' &&
                  `${': ' + operatorsStore?.extensions[profile?.mainextension]?.cf}`}
              </Badge>
            )}

            {/* Profile dropdown */}
            <Dropdown items={userMenuItems} position='left' className='pl-3'>
              <span className='sr-only'>{t('TopBar.Open user menu')}</span>
              <Avatar
                size='small'
                rounded='full'
                placeholderType='person'
                src={operators[profile?.username]?.avatarBase64}
                status={operators[profile?.username]?.mainPresence}
              />
            </Dropdown>
          </div>

          {/* Call forward modal */}
          <Modal
            show={showPresenceModal}
            focus={numberInputRef}
            onClose={() => setShowPresenceModal(false)}
          >
            <form onSubmit={handleSubmit}>
              <Modal.Content>
                <div className='mt-3 text-center sm:mt-0 sm:text-left w-full'>
                  <h3 className='text-lg text-left font-medium leading-6 text-gray-900 dark:text-gray-100'>
                    {t('TopBar.Enter phone number for call forward')}
                  </h3>
                  <div className='mt-3 flex flex-col gap-2'>
                    <TextInput
                      placeholder={t('Common.Phone number') || ''}
                      name='number'
                      ref={numberInputRef}
                    />
                  </div>
                </div>
              </Modal.Content>
              <Modal.Actions>
                <Button variant='primary' onClick={() => closedModalSaved()}>
                  {t('Common.Save')}
                </Button>
                <Button variant='ghost' onClick={() => setShowPresenceModal(false)}>
                  {t('Common.Cancel')}
                </Button>
              </Modal.Actions>
            </form>
          </Modal>
        </div>
      </div>
    </header>
  )
}
