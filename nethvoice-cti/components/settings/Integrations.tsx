// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { RefObject, createRef, useState, useEffect } from 'react'
import { faTriangleExclamation, faCircleNotch } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Button, InlineNotification, Modal } from '../common'
import { useSelector } from 'react-redux'
import { RootState } from '../../store'
import { newIslandConfig } from '../../lib/settings'
import {
  getPhoneIslandToken,
  phoneIslandTokenCheck,
  removePhoneIslandToken,
} from '../../services/authentication'
import { useTranslation } from 'react-i18next'
import { getProductName } from '../../lib/utils'
import CopyComponent from '../common/CopyComponent'

export const Integrations = () => {
  const [config, setConfig] = useState<string>('')
  const currentUser = useSelector((state: RootState) => state.user)
  const webRTCExtension = currentUser.endpoints.extension.find((el) => el.type === 'webrtc')
  const [showMondal, setShowMondal] = useState(false)
  const cancelButtonRef: RefObject<HTMLButtonElement> = createRef()
  const [tokenExists, setTokenExists] = useState<boolean>(false)
  const [loading, setLoading] = useState<boolean>(false)
  const [webrtcData, setWebrtcData]: any = useState([])
  const profile = useSelector((state: RootState) => state.user)

  const { t } = useTranslation()

  const productName = getProductName()

  useEffect(() => {
    // filter phone and insert only physical phones
    if (profile?.endpoints) {
      let endpointsInformation = profile?.endpoints
      if (endpointsInformation?.extension) {
        setWebrtcData(endpointsInformation?.extension.filter((phone) => phone?.type === 'webrtc'))
      }
    }
  }, [profile?.endpoints])

  const newConfig = async () => {
    setLoading(true)
    const data = await getPhoneIslandToken()
    const username = currentUser?.username
    if (data.token && username) {
      const config = newIslandConfig({
        // @ts-ignore
        hostname: window.CONFIG.API_ENDPOINT,
        username,
        auth_token: data.token,
        sip_exten: webRTCExtension?.id || '',
        sip_secret: webRTCExtension?.secret || '',
        // @ts-ignore
        sip_host: window.CONFIG.SIP_HOST,
        // @ts-ignore
        sip_port: window.CONFIG.SIP_PORT,
      })
      setConfig(config)
      setTokenExists(true)
    }
    setLoading(false)
  }

  const removeConfig = async () => {
    setLoading(true)
    setShowMondal(false)
    await removePhoneIslandToken()
    setConfig('')
    setTokenExists(false)
    setLoading(false)
  }

  useEffect(() => {
    const checkPhoneIslandToken = async () => {
      setLoading(true)
      const data = await phoneIslandTokenCheck()
      if (data.exists) {
        setTokenExists(true)
      }
      setLoading(false)
    }
    checkPhoneIslandToken()
  }, [])

  const phoneIslandSection = () => {
    return (
      <div>
        <h4 className='text-sm font-medium leading-6 text-gray-900 dark:text-gray-100'>
          {t('Settings.Phone Island configuration')}
        </h4>
        <p className='mt-1 text-sm text-gray-500 dark:text-gray-400'>
          {t('Settings.phone_island_integration_description', { productName })}
        </p>
        <p className='mt-6 flex items-center gap-2'>
          {loading && (
            <Button variant='white' disabled>
              {t('Common.Loading')}{' '}
              <FontAwesomeIcon icon={faCircleNotch} className='fa-spin ml-2' />
            </Button>
          )}
          {!loading && !tokenExists && (
            <Button variant='white' onClick={newConfig}>
              {t('Settings.Get Phone Island configuration')}{' '}
            </Button>
          )}
          {!loading && tokenExists && (
            <Button variant='white' onClick={() => setShowMondal(true)}>
              {t('Settings.Revoke configuration')}
            </Button>
          )}
        </p>

        {config && (
          <>
            <InlineNotification className='mt-5' type='warning' title={t('Common.Warning')}>
              <p>
                {t(
                  'Settings.The configuration string below is shown only once. If you will need it later, please save it in a safe place',
                )}
              </p>
            </InlineNotification>
            <div className='mt-5 bg-gray-50 dark:bg-gray-900 dark:border dark:border-gray-800 p-5 rounded-lg text-gray-900 dark:text-gray-100 flex gap-5 items-center'>
              <div className='text-sm break-all'>{config}</div>
              <CopyComponent number={config} id='phone-island-config' />
            </div>
          </>
        )}
      </div>
    )
  }

  return (
    <>
      {/* The Integration section */}
      <section aria-labelledby='phone-configuration-heading'>
        <div className='sm:overflow-hidden w-full'>
          <div className='py-6 px-4 sm:p-6 w-full'>
            <div>
              <h2 className='text-lg font-medium leading-6 text-gray-900 dark:text-gray-50 mb-6'>
                {t('Settings.Integrations')}
              </h2>
            </div>
            {webrtcData?.length !== 0 && phoneIslandSection()}
            {webrtcData?.length === 0 && (
              <InlineNotification type='info' title={t('Settings.No WebRTC extension found')}>
                <p>{t('Settings.To enable Phone Island integration, ask your administrator to configure a WebRTC extension')}</p>
              </InlineNotification>
            )}
          </div>
        </div>
      </section>
      {/* Remove token confirmation modal */}
      <Modal show={showMondal} focus={cancelButtonRef} onClose={() => setShowMondal(false)}>
        <Modal.Content>
          <div className='mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-red-100 sm:mx-0'>
            <FontAwesomeIcon
              icon={faTriangleExclamation}
              className='h-5 w-5 text-red-600'
              aria-hidden='true'
            />
          </div>
          <div className='mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left'>
            <h3 className='text-lg font-medium leading-6 text-gray-900 dark:text-gray-200'>
              {t('Settings.Revoke Phone Island configuration')}
            </h3>
            <div className='mt-2'>
              <p className='text-sm text-gray-500'>
                {t('Settings.Any Phone Island using the current configuration will stop working')}
              </p>
            </div>
          </div>
        </Modal.Content>
        <Modal.Actions>
          <Button variant='danger' onClick={removeConfig}>
            {t('Settings.Revoke')}
          </Button>
          <Button variant='ghost' onClick={() => setShowMondal(false)} ref={cancelButtonRef}>
            {t('Common.Cancel')}
          </Button>
        </Modal.Actions>
      </Modal>
    </>
  )
}
