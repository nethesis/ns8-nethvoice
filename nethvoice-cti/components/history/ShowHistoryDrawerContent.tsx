// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { ComponentPropsWithRef, forwardRef } from 'react'
import classNames from 'classnames'
import { Avatar, Button } from '../common'
import { DrawerHeader } from '../common/DrawerHeader'
import { Divider } from '../common/Divider'
import { openAddToPhonebookDrawer, callUser } from '../../lib/history'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPhone, faPlus } from '@fortawesome/free-solid-svg-icons'
import { LastCallsDrawerTable } from './LastCallsDrawerTable'
import { startOfDay, subDays } from 'date-fns'
import { useSelector } from 'react-redux'
import { RootState } from '../../store'
import { t } from 'i18next'

export interface ShowHistoryDrawerContentProps extends ComponentPropsWithRef<'div'> {
  config: any
}

function checkTitle(config: any) {
  if (config.name) {
    return (
      <div className='flex items-center'>
        <div className='flex-shrink-0 mr-4'>
          <Avatar size='large' placeholderType='person' />
        </div>
        <div>
          <h2 className='text-xl font-medium text-gray-700 dark:text-gray-200'>{config?.name}</h2>
        </div>
      </div>
    )
  } else if (!config.name && config.company) {
    return (
      <div className='flex items-center'>
        <div className='flex-shrink-0 mr-4'>
          <Avatar size='large' placeholderType='company' />
        </div>
        <div className='flex-shrink-0 mr-4'>
          <h2 className='text-xl font-medium text-gray-700 dark:text-gray-200'>
            {config?.company}
          </h2>
        </div>
      </div>
    )
  } else {
    return (
      <div className='flex items-center'>
        <div className='flex-shrink-0 mr-4'>
          <Avatar size='large' placeholderType='person' />
        </div>
        <div>
          <h2 className='text-xl font-medium text-gray-700 dark:text-gray-200'>{config?.number}</h2>
        </div>
      </div>
    )
  }
}

export const ShowHistoryDrawerContent = forwardRef<
  HTMLButtonElement,
  ShowHistoryDrawerContentProps
>(({ config, className, ...props }, ref) => {
  const { profile } = useSelector((state: RootState) => state.user)

  return (
    <>
      <DrawerHeader title={t('Common.History details')} />
      {/* drawer content */}
      <div className={classNames('px-5', className)} {...props}>
        <Divider />
        <div className='flex min-w-0 flex-1 items-center justify-between'>{checkTitle(config)}</div>
        <div className='mt-8 flex items-center gap-2'>
          <div>
            <Button variant='primary' className='mr-2' onClick={() => callUser(config)}>
              <FontAwesomeIcon icon={faPhone} className='h-4 w-4 xl:mr-2' />
              <span className='hidden xl:inline-block'>{t('Common.Call')}</span>
              <span className='sr-only'>{t('Common.Call')}</span>
            </Button>
          </div>
          <div>
            {(!config?.name && !config?.company) ||
            (config?.name === config?.number && !config?.company) ||
            (config?.company === config?.number && !config?.name) ? (
              <Button
                variant='white'
                className='mr-2'
                onClick={() => openAddToPhonebookDrawer(config.number)}
              >
                <FontAwesomeIcon
                  icon={faPlus}
                  className='h-4 w-4 xl:mr-2 text-gray-500 dark:text-gray-400'
                />
                <span className='hidden xl:inline-block'>{t('Common.Add to phonebook')}</span>
                <span className='sr-only'>{t('Common.Add to phonebook')}</span>
              </Button>
            ) : (
              <></>
            )}
          </div>
        </div>
        <div>
          {config?.company && (
            <div className='mt-6 border-t border-gray-200 dark:border-gray-700'>
              <dl className='sm:divide-y sm:divide-gray-200 dark:sm:divide-gray-700'>
                {/* Company name */}
                <div className='py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:py-5'>
                  <dt className='text-sm font-medium text-gray-500 dark:text-gray-400'>
                    {t('Common.Company name')}
                  </dt>
                  <dd className='mt-1 text-sm text-gray-900 dark:text-gray-100 sm:col-span-2 sm:mt-0'>
                    <div className='flex items-center text-sm'>
                      <span className='truncate '>{config?.company}</span>
                    </div>
                  </dd>
                </div>
                {/* Phone number */}
                <div className='py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:py-5'>
                  <dt className='text-sm font-medium text-gray-500 dark:text-gray-400'>
                    {t('Common.Phone number')}
                  </dt>
                  <dd className='mt-1 text-sm text-gray-900 dark:text-gray-100 sm:col-span-2 sm:mt-0'>
                    <div className='flex items-center text-sm text-primary dark:text-primaryDark'>
                      <FontAwesomeIcon
                        icon={faPhone}
                        className='mr-2 h-4 w-4 flex-shrink-0 text-gray-400 dark:text-gray-500'
                        aria-hidden='true'
                      />
                      <span className='truncate cursor-pointer hover:underline'>
                        {config?.number}
                      </span>
                    </div>
                  </dd>
                </div>
              </dl>
            </div>
          )}
          {config?.name && !config?.company && config?.number && (
            <div className='mt-6 border-t border-gray-200 dark:border-gray-700'>
              <dl className='sm:divide-y sm:divide-gray-200 dark:sm:divide-gray-700'>
                {/* Phone number */}
                <div className='py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:py-5'>
                  <dt className='text-sm font-medium text-gray-500 dark:text-gray-400'>
                    {t('Common.Phone number')}
                  </dt>
                  <dd className='mt-1 text-sm text-gray-900 dark:text-gray-100 sm:col-span-2 sm:mt-0'>
                    <div className='flex items-center text-sm text-primary dark:text-primaryDark'>
                      <FontAwesomeIcon
                        icon={faPhone}
                        className='mr-2 h-4 w-4 flex-shrink-0 text-gray-400 dark:text-gray-500'
                        aria-hidden='true'
                      />
                      <span className='truncate cursor-pointer hover:underline'>
                        {config?.number}
                      </span>
                    </div>
                  </dd>
                </div>
              </dl>
            </div>
          )}
        </div>

        {/* last calls */}
        {profile?.macro_permissions?.cdr?.permissions?.ad_cdr?.value && (
          <LastCallsDrawerTable
            callType={config?.callType}
            dateFrom={startOfDay(subDays(new Date(), 7))}
            dateTo={new Date()}
            phoneNumbers={[config?.number]}
            limit={10}
          />
        )}
      </div>
    </>
  )
})
ShowHistoryDrawerContent.displayName = 'ShowHistoryDrawerContent'
