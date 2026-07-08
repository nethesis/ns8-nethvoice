// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Button, InlineNotification } from '../common'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTrash } from '@fortawesome/free-solid-svg-icons'
import { getProductName } from '../../lib/utils'
import { useSelector } from 'react-redux'
import { RootState } from '../../store'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

export const ClearCache = () => {
  const productName = getProductName()

  //Find the credentials of the user saved in the store
  const authenticationStore = useSelector((state: RootState) => state.authentication)
  const { username } = authenticationStore
  //Create the variable that will be used to clear the cache
  const [isCacheCleared, setCacheCleared] = useState(false)

  const { t } = useTranslation()

  const clearCache = () => {
    localStorage.removeItem('caches-' + username)
    setCacheCleared(true)
  }

  return (
    <>
      <section aria-labelledby='clear-cache-heading'>
        <div className='sm:overflow-hidden w-full'>
          <div className='py-6 px-4 sm:p-6 w-full '>
            <div>
              <h2 className='text-lg font-medium leading-6 text-gray-900 dark:text-gray-100 mb-6'>
                {t('Settings.Cache')}
              </h2>
            </div>
            <div>
              <h4
                id='clear-cache-heading'
                className='text-sm font-medium leading-6 text-gray-900 dark:text-gray-100'
              >
                {t('Settings.Clear cache')}
              </h4>
              <p className='mt-1 text-sm text-gray-500 dark:text-gray-400'>
                {t('Settings.clear_cache_description')}
              </p>
              <div className='mt-6'>
                <Button
                  variant='white'
                  onClick={() => {
                    clearCache()
                  }}
                  disabled={isCacheCleared}
                >
                  <FontAwesomeIcon icon={faTrash} className='mr-2 h-4 w-4' />
                  <span>{t('Settings.Clear cache')}</span>
                </Button>
                {isCacheCleared && (
                  <InlineNotification
                    className='mt-5 border-none'
                    type='success'
                    title={t('Settings.Cache cleared')}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
