// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { ComponentPropsWithRef, forwardRef, useEffect, useState } from 'react'
import classNames from 'classnames'
import { Avatar, InlineNotification } from '../common'
import { DrawerHeader } from '../common/DrawerHeader'
import { useTranslation } from 'react-i18next'
import {
  faChevronDown,
  faChevronUp,
  faPhone,
  faSuitcase,
  faUser,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { callPhoneNumber, transferCallToExtension } from '../../lib/utils'
import { getCallIcon, retrieveQueueCallInfo } from '../../lib/queuesLib'
import { formatCallDuration } from '../../lib/dateTime'
import { useSelector } from 'react-redux'
import { RootState } from '../../store'
import { openShowOperatorDrawer } from '../../lib/operators'
import { CallsDate } from '../history/CallsDate'

export interface ShowQueueCallDrawerContentProps extends ComponentPropsWithRef<'div'> {
  config: any
}

export const ShowQueueCallDrawerContent = forwardRef<
  HTMLButtonElement,
  ShowQueueCallDrawerContentProps
>(({ config, className, ...props }, ref) => {
  const { t } = useTranslation()
  const [callInfo, setCallInfo] = useState([])
  const [firstRender, setFirstRender] = useState(true)
  const [isLoaded, setLoaded] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const operatorsStore = useSelector((state: RootState) => state.operators)
  const authStore = useSelector((state: RootState) => state.authentication)

  const retrieveCallInformation = async () => {
    try {
      setErrorMessage('')
      setLoaded(false)

      //// todo: read numHours from preferences
      const numHours = 12

      const res = await retrieveQueueCallInfo(config.cid, config.queueId, numHours)

      res.forEach((call: any) => {
        if (call == res[res.length - 1]) {
          // expand last call detail
          call.expanded = true
        } else {
          call.expanded = false
        }

        call.queueId = call.queuename
        call.queueName = config.queues[call.queueId]?.name

        // queuename attribute name is misleading
        delete call.queuename
      })
      setCallInfo(res)
    } catch (e) {
      console.error(e)
      setErrorMessage(t('Queues.Cannot retrieve calls') || '')
    }
    setLoaded(true)
  }

  // retrieve call information on drawer opening
  useEffect(() => {
    if (firstRender) {
      setFirstRender(false)
      return
    }
    retrieveCallInformation()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstRender, config?.cid, config?.queueId])

  const toggleExpandCall = (index: number) => {
    // good example of how to update an object inside an array managed by useState

    const newCallInfo: any = callInfo.map((call: any, i) => {
      if (index === i) {
        return { ...call, expanded: !call.expanded }
      } else {
        return call
      }
    })
    setCallInfo(newCallInfo)
  }

  const getOperatorTemplate = (operatorName: string) => {
    const operatorFound: any = Object.values(operatorsStore.operators).find((op: any) => {
      return op.name === operatorName
    })

    return (
      <>
        <div className='flex items-center gap-2'>
          <Avatar
            rounded='full'
            src={operatorFound?.avatarBase64}
            placeholderType='operator'
            size='small'
            status={operatorFound?.mainPresence}
            onClick={() => openShowOperatorDrawer(operatorFound)}
            className='cursor-pointer'
            star={operatorFound?.favorite}
          />
          <div
            className='cursor-pointer hover:underline'
            onClick={() => openShowOperatorDrawer(operatorFound)}
          >
            {operatorName}
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <DrawerHeader title={t('Queues.Call details')} />
      <div className={classNames(className, 'p-5')} {...props}>
        <dl>
          {/* name */}
          {config?.name && (
            <div className='py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:py-5'>
              <dt className='text-sm font-medium text-gray-500 dark:text-gray-400'>
                {t('Queues.Name')}
              </dt>
              <dd className='mt-1 text-sm sm:col-span-2 sm:mt-0 text-gray-900 dark:text-gray-100'>
                <div className='flex items-center text-sm'>
                  <FontAwesomeIcon
                    icon={faUser}
                    className='mr-2 h-4 w-4 flex-shrink-0 text-gray-400 dark:text-gray-500'
                    aria-hidden='true'
                  />
                  <span>{config?.name}</span>
                </div>
              </dd>
            </div>
          )}
          {/* company */}
          {config?.company && (
            <div className='py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:py-5'>
              <dt className='text-sm font-medium text-gray-500 dark:text-gray-400'>
                {t('Queues.Company')}
              </dt>
              <dd className='mt-1 text-sm sm:col-span-2 sm:mt-0 text-gray-900 dark:text-gray-100'>
                <div className='flex items-center text-sm'>
                  <FontAwesomeIcon
                    icon={faSuitcase}
                    className='mr-2 h-4 w-4 flex-shrink-0 text-gray-400 dark:text-gray-500'
                    aria-hidden='true'
                  />
                  <span>{config?.company}</span>
                </div>
              </dd>
            </div>
          )}
          {/* phone number */}
          {config?.cid && (
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
                  <span
                    className='truncate cursor-pointer hover:underline'
                    onClick={() =>
                      operatorsStore?.operators[authStore?.username]?.mainPresence === 'busy'
                        ? transferCallToExtension(config?.cid)
                        : callPhoneNumber(config?.cid)
                    }
                  >
                    {config?.cid}
                  </span>
                </div>
              </dd>
            </div>
          )}
        </dl>
        {/* call management */}
        <h4 className='mt-6 text-base font-medium text-gray-700 dark:text-gray-200'>
          {t('Queues.Call management')}
        </h4>
        {/* Divider */}
        <div className='mt-4 border-t border-gray-200 dark:border-gray-700'></div>
        {/* error */}
        {errorMessage && (
          <InlineNotification
            type='error'
            title={errorMessage}
            className='my-4'
          ></InlineNotification>
        )}
        {/* skeleton */}
        {!isLoaded && !errorMessage && (
          <ul role='list' className='divide-y divide-gray-200 dark:divide-gray-700'>
            {Array.from(Array(3)).map((e, index) => (
              <li key={index} className='py-4 px-5'>
                <div className='animate-pulse h-5 rounded mb-6 bg-gray-300 dark:bg-gray-600'></div>
                <div className='animate-pulse h-5 max-w-[75%] rounded bg-gray-300 dark:bg-gray-600'></div>
              </li>
            ))}
          </ul>
        )}
        {/* call information */}
        {isLoaded && !errorMessage && !!callInfo?.length && (
          <div className='text-sm overflow-hidden sm:rounded-md bg-white dark:bg-gray-900'>
            <ul role='list' className='divide-y divide-gray-200 dark:divide-gray-700'>
              {isLoaded &&
                callInfo?.length &&
                callInfo.map((call: any, index: number) => (
                  <li key={index} className='py-5'>
                    <div className='flex items-center'>
                      <div className='flex min-w-0 flex-1 items-center'>
                        <div className='min-w-0 flex-1 grid grid-cols-2 gap-4'>
                          {/* time */}
                          <CallsDate call={call} isInQueue={true} />
                          <div className='flex justify-between'>
                            {/* outcome */}
                            <div className='flex items-center'>
                              {getCallIcon(call)}
                              <span>{t(`Queues.outcome_${call?.event}`)}</span>
                            </div>
                            {/* chevron */}
                            <FontAwesomeIcon
                              icon={call?.expanded ? faChevronUp : faChevronDown}
                              className='h-3.5 w-3.5 px-2 py-2 cursor-pointer'
                              aria-hidden='true'
                              onClick={() => toggleExpandCall(index)}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                    {/* expanded details */}
                    {call.expanded && (
                      <div className='mt-5'>
                        <dl className='space-y-5'>
                          {/* queue */}
                          <div className='sm:grid sm:grid-cols-3 sm:gap-4'>
                            <dt className='font-medium text-gray-500 dark:text-gray-400'>
                              {t('Queues.Queue')}
                            </dt>
                            <dd className='mt-1 sm:col-span-2 sm:mt-0 text-gray-900 dark:text-gray-100'>
                              <div className='flex items-center'>
                                <span>{`${call?.queueName} (${call?.queueId})`}</span>
                              </div>
                            </dd>
                          </div>
                          {/* duration */}
                          <div className='sm:grid sm:grid-cols-3 sm:gap-4'>
                            <dt className='font-medium text-gray-500 dark:text-gray-400'>
                              {t('Queues.Duration')}
                            </dt>
                            <dd className='mt-1 sm:col-span-2 sm:mt-0 text-gray-900 dark:text-gray-100'>
                              <div className='flex items-center'>
                                <span>{formatCallDuration(call?.duration)}</span>
                              </div>
                            </dd>
                          </div>
                          {/* hold */}
                          <div className='sm:grid sm:grid-cols-3 sm:gap-4'>
                            <dt className='font-medium text-gray-500 dark:text-gray-400'>
                              {t('Queues.Hold')}
                            </dt>
                            <dd className='mt-1 sm:col-span-2 sm:mt-0 text-gray-900 dark:text-gray-100'>
                              <div className='flex items-center'>
                                <span>{formatCallDuration(call?.hold)}</span>
                              </div>
                            </dd>
                          </div>
                          {/* operator */}
                          {call.agent && call.agent !== 'NONE' && (
                            <div className='sm:grid sm:grid-cols-3 sm:gap-4'>
                              <dt className='font-medium text-gray-500 dark:text-gray-400'>
                                {t('Queues.Operator')}
                              </dt>
                              <dd className='mt-1 sm:col-span-2 sm:mt-0 text-gray-900 dark:text-gray-100'>
                                <div>{getOperatorTemplate(call?.agent)}</div>
                              </dd>
                            </div>
                          )}
                        </dl>
                      </div>
                    )}
                  </li>
                ))}
            </ul>
          </div>
        )}
      </div>
    </>
  )
})

ShowQueueCallDrawerContent.displayName = 'ShowQueueCallDrawerContent'
