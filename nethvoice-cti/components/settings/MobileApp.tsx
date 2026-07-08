// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { RefObject, createRef, useState } from 'react'
import { faTriangleExclamation, faCircleNotch, faQrcode } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Button, InlineNotification, Modal } from '../common'
import { generateQRcodeToken } from '../../services/authentication'
import { useTranslation } from 'react-i18next'
import { store } from '../../store'
import dynamic from 'next/dynamic'
import { getBrandName } from '../../lib/utils'

const QRCode = dynamic(() => import('./QRCode'), {
  ssr: false,
})

const APP_ID = getBrandName().toUpperCase()

export const MobileApp = () => {
  const [generated, setGenerated] = useState<boolean>(false)
  const [showMondal, setShowMondal] = useState(false)
  const cancelButtonRef: RefObject<HTMLButtonElement> = createRef()
  const [loading, setLoading] = useState<boolean>(false)
  const { t } = useTranslation()
  const [QRString, setQRString] = useState<string>('')

  const newQRcode = async () => {
    setLoading(true)
    setShowMondal(false)
    const authData = await generateQRcodeToken()
    const username = store.getState().user?.username

    if (!username || !authData.token) {
      setLoading(false)
      return
    }

    const profiling = store.getState().profiling
    if (Object.keys(profiling).length > 0) {
      const hostname = profiling.publichost || profiling.hostname || window.location.hostname
      let qrString = `csc:${encodeURIComponent(username)}@${encodeURIComponent(
        hostname,
      )}@qrcode:${encodeURIComponent(authData.token)}@${APP_ID}`
      setQRString(qrString)
      setGenerated(true)
    }
    setLoading(false)
  }

  return (
    <>
      {/* The Integration section */}
      <section aria-labelledby='phone-configuration-heading'>
        <div className='sm:overflow-hidden w-full'>
          <div className='py-6 px-4 sm:p-6 w-full'>
            <div>
              <h2 className='text-lg font-medium leading-6 text-gray-900 dark:text-gray-100 mb-6'>
                {t('Settings.Mobile App')}
              </h2>
            </div>
            <div>
              <h4
                id='phone-configuration-heading'
                className='text-sm font-medium leading-6 text-gray-900 dark:text-gray-100'
              >
                {t('Settings.New QR code creation')}
              </h4>
              <p className='mt-1 text-sm text-gray-500 dark:text-gray-400'>
                {t('Settings.mobile_app_qrcode_description')}
              </p>
              <p className='mt-6 flex items-center gap-2'>
                {loading && (
                  <Button variant='white' disabled>
                    {t('Common.Loading')}{' '}
                    <FontAwesomeIcon icon={faCircleNotch} className='fa-spin ml-2' />
                  </Button>
                )}
                {!loading && (
                  <Button variant='white' onClick={() => setShowMondal(true)}>
                    <FontAwesomeIcon icon={faQrcode} className='mr-2 h-4 w-4' />
                    <span>{t('Settings.Generate QR code')}</span>
                  </Button>
                )}
              </p>

              {generated && QRString && (
                <>
                  <InlineNotification className='mt-5' type='info' title='Info'>
                    <p>{t('Settings.mobile_app_qrcode_info')}</p>
                  </InlineNotification>
                  <div className='mt-5'>
                    <QRCode data={QRString} />
                  </div>
                </>
              )}
            </div>
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
              {t('Settings.New QR code creation')}
            </h3>
            <div className='mt-2'>
              <p className='text-sm text-gray-500'>{t('Settings.mobile_app_qrcode_warning')}</p>
            </div>
          </div>
        </Modal.Content>
        <Modal.Actions>
          <Button variant='danger' onClick={newQRcode}>
            {t('Settings.Generate')}
          </Button>
          <Button variant='ghost' onClick={() => setShowMondal(false)} ref={cancelButtonRef}>
            {t('Common.Cancel')}
          </Button>
        </Modal.Actions>
      </Modal>
    </>
  )
}
