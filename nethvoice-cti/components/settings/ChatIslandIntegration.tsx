// Copyright (C) 2026 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { RefObject, createRef, useEffect, useState } from 'react'
import { faTriangleExclamation, faCircleNotch } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { Button, InlineNotification, Modal } from '../common'
import { RootState } from '../../store'
import {
  chatIslandTokenCheck,
  getChatIslandToken,
  removeChatIslandToken,
} from '../../services/authentication'
import { getProductName } from '../../lib/utils'
import CopyComponent from '../common/CopyComponent'

/** The Chat Island configuration for other web applications: host, username and a token of its own. */
export const ChatIslandIntegration = () => {
  const username = useSelector((state: RootState) => state.user.username)
  const [config, setConfig] = useState('')
  const [tokenExists, setTokenExists] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [failed, setFailed] = useState(false)
  const cancelButtonRef: RefObject<HTMLButtonElement> = createRef()
  const { t } = useTranslation()

  useEffect(() => {
    setLoading(true)
    chatIslandTokenCheck()
      .then((data) => setTokenExists(!!data.exists))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const newConfig = async () => {
    setLoading(true)
    setFailed(false)
    try {
      const data = await getChatIslandToken()
      if (data.token && username) {
        // @ts-ignore
        setConfig(btoa(`${window.CONFIG.API_ENDPOINT}:${username}:${data.token}`))
        setTokenExists(true)
      }
    } catch {
      setFailed(true)
    } finally {
      setLoading(false)
    }
  }

  const removeConfig = async () => {
    setLoading(true)
    setShowModal(false)
    setFailed(false)
    try {
      await removeChatIslandToken()
      setConfig('')
      setTokenExists(false)
    } catch {
      setFailed(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h4 className='text-sm font-medium leading-6 text-gray-900 dark:text-gray-100'>
        {t('Settings.Chat Island configuration')}
      </h4>
      <p className='mt-1 text-sm text-gray-500 dark:text-gray-400'>
        {t('Settings.chat_island_integration_description', { productName: getProductName() })}
      </p>
      <p className='mt-6 flex items-center gap-2'>
        {loading && (
          <Button variant='white' disabled>
            {t('Common.Loading')} <FontAwesomeIcon icon={faCircleNotch} className='fa-spin ml-2' />
          </Button>
        )}
        {!loading && !tokenExists && (
          <Button variant='white' onClick={newConfig}>
            {t('Settings.Get Chat Island configuration')}
          </Button>
        )}
        {!loading && tokenExists && (
          <Button variant='white' onClick={() => setShowModal(true)}>
            {t('Settings.Revoke configuration')}
          </Button>
        )}
      </p>

      {failed && (
        <InlineNotification className='mt-5' type='error' title={t('Common.Error')}>
          <p>{t('Settings.Cannot update the Chat Island configuration')}</p>
        </InlineNotification>
      )}

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
            <CopyComponent number={config} id='chat-island-config' />
          </div>
        </>
      )}

      <Modal show={showModal} focus={cancelButtonRef} onClose={() => setShowModal(false)}>
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
              {t('Settings.Revoke Chat Island configuration')}
            </h3>
            <div className='mt-2'>
              <p className='text-sm text-gray-500'>
                {t('Settings.Any Chat Island using the current configuration will stop working')}
              </p>
            </div>
          </div>
        </Modal.Content>
        <Modal.Actions>
          <Button variant='danger' onClick={removeConfig}>
            {t('Settings.Revoke')}
          </Button>
          <Button variant='ghost' onClick={() => setShowModal(false)} ref={cancelButtonRef}>
            {t('Common.Cancel')}
          </Button>
        </Modal.Actions>
      </Modal>
    </div>
  )
}
