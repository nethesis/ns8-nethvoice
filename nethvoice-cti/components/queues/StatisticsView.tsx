// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { FC, ComponentProps, useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { retrieveQueueStats } from '../../lib/queuesLib'
import classNames from 'classnames'
import { formatDateLoc, formatDurationLoc } from '../../lib/dateTime'
import { faStopwatch, faDownload, faPhone, faUser } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Button, InlineNotification } from '../common'
import { LoggedStatus } from './LoggedStatus'
import { useSelector } from 'react-redux'
import { RootState } from '../../store'

export interface StatisticsViewProps extends ComponentProps<'div'> {}

export const StatisticsView: FC<StatisticsViewProps> = ({ className }): JSX.Element => {
  const STATS_UPDATE_INTERVAL = 30000 // 30 seconds
  const { t } = useTranslation()
  const [stats, setStats]: any = useState({})
  const [isStatsLoaded, setStatsLoaded]: any = useState(false)
  const [statsError, setStatsError] = useState('')
  const [firstRender, setFirstRender]: any = useState(true)
  const { mainextension } = useSelector((state: RootState) => state.user)
  const [lastUpdated, setLastUpdated]: any = useState(null)
  const queuesStore = useSelector((state: RootState) => state.queues)

  const fetchStats = useCallback(async () => {
    try {
      setStatsError('')
      setStatsLoaded(false)
      const res = await retrieveQueueStats()
      setStats(res)
      setLastUpdated(new Date())
    } catch (e) {
      console.error(e)
      setStatsError(t('Queues.Cannot retrieve stats') || '')
    }
    setStatsLoaded(true)
  }, [t])

  // retrieve stats
  useEffect(() => {
    if (firstRender) {
      setFirstRender(false)
      return
    }

    let intervalId: any = 0

    function fetchStatsInterval() {
      // fetch stats immediately and set interval
      fetchStats()

      intervalId = setInterval(() => {
        fetchStats()
      }, STATS_UPDATE_INTERVAL)
    }
    fetchStatsInterval()

    return () => {
      if (intervalId) {
        clearInterval(intervalId)
      }
    }
  }, [firstRender, fetchStats])

  return (
    <div className={classNames(className)}>
      {/* queues error */}
      {statsError && <InlineNotification type='error' title={statsError}></InlineNotification>}
      {!statsError && (
        <>
          <div className='flex text-sm gap-4 pb-6'>
            <div className='text-gray-500 dark:text-gray-400'>
              {t('Queues.Last update')}:{' '}
              {lastUpdated ? formatDateLoc(lastUpdated, 'HH:mm:ss') : '-'} (
              {t('Queues.every_time_interval_seconds', {
                timeInterval: STATS_UPDATE_INTERVAL / 1000,
              })}
              )
            </div>
          </div>
          <div className='mx-auto'>
            {/* operator stats */}
            <div className='flex flex-col sm:flex-row justify-between items-start sm:items-center'>
              <h3 className='truncate text-lg leading-6 font-medium mb-4 text-gray-900 dark:text-gray-100'>
                {t('Queues.Operator statistics')}
              </h3>
              {/*  //// use 'disabled={!isStatsLoaded}' when download button will be working */}
              <Button
                variant='white'
                disabled
                className='mb-4'
                title={t('Common.Coming soon') || ''}
              >
                <FontAwesomeIcon icon={faDownload} className='h-4 w-4 mr-2' />
                <span>{t('Queues.Download stats')}</span>
              </Button>
            </div>
            <ul
              role='list'
              className='grid grid-cols-1 gap-6 md:grid-cols-2 2xl:grid-cols-3 text-sm'
            >
              {/* skeleton */}
              {(!queuesStore.isLoaded || !isStatsLoaded) &&
                Array.from(Array(3)).map((e, i) => (
                  <li
                    key={i}
                    className='col-span-1 rounded-lg divide-y shadow divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900'
                  >
                    <div className='px-5 py-4'>
                      {Array.from(Array(3)).map((e, j) => (
                        <div key={j} className='space-y-4 mb-4'>
                          <div className='animate-pulse h-5 rounded bg-gray-300 dark:bg-gray-600'></div>
                          <div className='animate-pulse h-5 rounded max-w-[75%] bg-gray-300 dark:bg-gray-600'></div>
                        </div>
                      ))}
                    </div>
                  </li>
                ))}
              {queuesStore.isLoaded && isStatsLoaded && (
                <>
                  {/* login stats */}
                  <div>
                    <li className='col-span-1 rounded-lg divide-y shadow divide-gray-200 bg-cardBackgroud dark:bg-cardBackgroudDark text-gray-700 dark:divide-gray-700  dark:text-gray-200'>
                      {/* card header */}
                      <div className='px-5 py-4'>
                        <h3 className='truncate text-base leading-6 font-medium'>
                          <FontAwesomeIcon
                            icon={faUser}
                            className='mx-auto h-4 w-4 mr-2'
                            aria-hidden='true'
                          />
                          <span>{t('Queues.Login')}</span>
                        </h3>
                      </div>
                      {/* card body */}
                      <div className='flex flex-col divide-y divide-gray-200 dark:divide-gray-700'>
                        {/* last login */}
                        <div className='flex py-2 px-5'>
                          <div className='w-1/2 text-gray-500 dark:text-gray-400'>
                            {t('Queues.Last login')}
                          </div>
                          <div className='w-1/2'>{stats.lastLogin || '-'}</div>
                        </div>
                        {/* last logout */}
                        <div className='flex py-2 px-5'>
                          <div className='w-1/2 text-gray-500 dark:text-gray-400'>
                            {t('Queues.Last logout')}
                          </div>
                          <div className='w-1/2'>{stats.lastLogout || '-'}</div>
                        </div>
                      </div>
                    </li>
                  </div>
                  {/* call stats */}
                  <li className='col-span-1 rounded-lg divide-y shadow divide-gray-200 bg-cardBackgroud dark:bg-cardBackgroudDark text-gray-700 dark:divide-gray-700 dark:text-gray-200'>
                    {/* card header */}
                    <div className='px-5 py-4'>
                      <h3 className='truncate text-base leading-6 font-medium'>
                        <FontAwesomeIcon
                          icon={faPhone}
                          className='mx-auto h-4 w-4 mr-2'
                          aria-hidden='true'
                        />
                        <span>{t('Queues.Calls')}</span>
                      </h3>
                    </div>
                    {/* card body */}
                    <div className='flex flex-col divide-y divide-gray-200 dark:divide-gray-700'>
                      {/* answered calls */}
                      <div className='flex py-2 px-5'>
                        <div className='w-1/2 text-gray-500 dark:text-gray-400'>
                          {t('Queues.Answered calls')}
                        </div>
                        <div className='w-1/2'>{stats.answeredCalls || '-'}</div>
                      </div>
                      {/* outgoing calls */}
                      <div className='flex py-2 px-5'>
                        <div className='w-1/2 text-gray-500 dark:text-gray-400'>
                          {t('Queues.Outgoing calls')}
                        </div>
                        <div className='w-1/2'>{stats.outgoingCalls?.outgoing_calls || '-'}</div>
                      </div>
                      {/* missed calls */}
                      <div className='flex py-2 px-5'>
                        <div className='w-1/2 text-gray-500 dark:text-gray-400'>
                          {t('Queues.Missed calls')}
                        </div>
                        <div className='w-1/2'>{stats.missedCalls || '-'}</div>
                      </div>
                      {/* from last call */}
                      <div className='flex py-2 px-5'>
                        <div className='w-1/2 text-gray-500 dark:text-gray-400'>
                          {t('Queues.From last call')}
                        </div>
                        <div className='w-1/2'>{stats.fromLastCall || '-'}</div>
                      </div>
                      {/* time at phone */}
                      <div className='flex py-2 px-5'>
                        <div className='w-1/2 text-gray-500 dark:text-gray-400'>
                          {t('Queues.Time at phone')}
                        </div>
                        <div className='w-1/2'>{stats.timeAtPhone || '-'}</div>
                      </div>
                    </div>
                  </li>
                  {/* calls duration */}
                  <li className='col-span-1 rounded-lg divide-y shadow divide-gray-200 bg-cardBackgroud dark:bg-cardBackgroudDark text-gray-700 dark:divide-gray-700 dark:text-gray-200'>
                    {/* card header */}
                    <div className='px-5 py-4'>
                      <h3 className='truncate text-base leading-6 font-medium'>
                        <FontAwesomeIcon
                          icon={faStopwatch}
                          className='mx-auto h-4 w-4 mr-2'
                          aria-hidden='true'
                        />
                        <span>{t('Queues.Calls duration')}</span>
                      </h3>
                    </div>
                    {/* card body */}
                    <div className='flex flex-col divide-y divide-gray-200 dark:divide-gray-700'>
                      {/* minimum */}
                      <div className='flex py-2 px-5'>
                        <div className='w-1/2 text-gray-500 dark:text-gray-400'>
                          {t('Queues.Minimum')}
                        </div>
                        <div className='w-1/2'>
                          {formatDurationLoc(stats.allCalls?.min_duration) || '-'}
                        </div>
                      </div>
                      {/* maximum */}
                      <div className='flex py-2 px-5'>
                        <div className='w-1/2 text-gray-500 dark:text-gray-400'>
                          {t('Queues.Maximum')}
                        </div>
                        <div className='w-1/2'>
                          {formatDurationLoc(stats.allCalls?.max_duration) || '-'}
                        </div>
                      </div>
                      {/* average */}
                      <div className='flex py-2 px-5'>
                        <div className='w-1/2 text-gray-500 dark:text-gray-400'>
                          {t('Queues.Average')}
                        </div>
                        <div className='w-1/2'>
                          {formatDurationLoc(stats.allCalls?.avg_duration) || '-'}
                        </div>
                      </div>
                      {/* total incoming */}
                      <div className='flex py-2 px-5'>
                        <div className='w-1/2 text-gray-500 dark:text-gray-400'>
                          {t('Queues.Total incoming')}
                        </div>
                        <div className='w-1/2'>
                          {formatDurationLoc(stats.incomingCalls?.duration_incoming) || '-'}
                        </div>
                      </div>
                      {/* total outgoing */}
                      <div className='flex py-2 px-5'>
                        <div className='w-1/2 text-gray-500 dark:text-gray-400'>
                          {t('Queues.Total outgoing')}
                        </div>
                        <div className='w-1/2'>
                          {formatDurationLoc(stats.outgoingCalls?.duration_outgoing) || '-'}
                        </div>
                      </div>
                    </div>
                  </li>
                </>
              )}
            </ul>
            {/* queues statistics */}
            <div className='flex flex-col sm:flex-row justify-between items-start sm:items-center mt-8'>
              <h3 className='truncate text-lg leading-6 font-medium mb-4 text-gray-900 dark:text-gray-100'>
                {t('Queues.Queue statistics')}
              </h3>
              {/*  //// use 'disabled={!isStatsLoaded}' when download button will be working */}
              <Button
                variant='white'
                disabled
                className='mb-4'
                title={t('Common.Coming soon') || ''}
              >
                <FontAwesomeIcon icon={faDownload} className='h-4 w-4 mr-2' />
                <span>{t('Queues.Download stats')}</span>
              </Button>
            </div>
            <ul
              role='list'
              className='grid grid-cols-1 gap-6 md:grid-cols-2 2xl:grid-cols-3 text-sm'
            >
              {/* skeleton */}
              {(!queuesStore.isLoaded || !isStatsLoaded) &&
                Array.from(Array(3)).map((e, i) => (
                  <li
                    key={i}
                    className='col-span-1 rounded-lg divide-y shadow divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900'
                  >
                    <div className='px-5 py-4 space-y-4'>
                      {Array.from(Array(6)).map((e, j) => (
                        <div
                          key={j}
                          className='animate-pulse h-5 rounded bg-gray-300 dark:bg-gray-600'
                        ></div>
                      ))}
                    </div>
                  </li>
                ))}
              {queuesStore.isLoaded &&
                isStatsLoaded &&
                Object.keys(queuesStore.queues).map((key, index) => {
                  const queue = queuesStore.queues[key]
                  return (
                    <div key={index}>
                      <li className='col-span-1 rounded-lg divide-y shadow divide-gray-200 bg-cardBackgroud dark:bg-cardBackgroudDark text-gray-700 dark:divide-gray-700 dark:text-gray-200'>
                        {/* card header */}
                        <div className='flex justify-between items-center px-5 py-4 space-x-4'>
                          <div className='flex overflow-hidden items-center space-x-2'>
                            <h3 className='truncate text-base leading-6 font-medium'>
                              {queue.name}
                            </h3>
                            <span>{queue.queue}</span>
                          </div>
                          <LoggedStatus
                            loggedIn={queue.members[mainextension].loggedIn}
                            paused={queue.members[mainextension].paused}
                          />
                        </div>
                        {/* card body */}
                        <div className='flex flex-col divide-y divide-gray-200 dark:divide-gray-700'>
                          {/* logon time */}
                          <div className='flex py-2 px-5'>
                            <div className='w-1/2 text-gray-500 dark:text-gray-400'>
                              {t('Queues.Logon time')}
                            </div>
                            <div className='w-1/2'>
                              {formatDurationLoc(stats[queue.queue]?.time_in_logon) || '-'}
                            </div>
                          </div>
                          {/* pause time */}
                          <div className='flex py-2 px-5'>
                            <div className='w-1/2 text-gray-500 dark:text-gray-400'>
                              {t('Queues.Pause time')}
                            </div>
                            <div className='w-1/2'>
                              {formatDurationLoc(stats[queue.queue]?.time_in_pause) || '-'}
                            </div>
                          </div>
                          {/* pause on logon */}
                          <div className='flex py-2 px-5'>
                            <div className='w-1/2 text-gray-500 dark:text-gray-400'>
                              {t('Queues.Pause on logon')}
                            </div>
                            <div className='w-1/2'>
                              {stats[queue.queue]?.pause_percent
                                ? stats[queue.queue]?.pause_percent + '%'
                                : '-'}
                            </div>
                          </div>
                          {/* time at phone */}
                          <div className='flex py-2 px-5'>
                            <div className='w-1/2 text-gray-500 dark:text-gray-400'>
                              {t('Queues.Time at phone')}
                            </div>
                            <div className='w-1/2'>
                              {stats[queue.queue]?.conversation_percent
                                ? stats[queue.queue]?.conversation_percent + '%'
                                : '-'}
                            </div>
                          </div>
                        </div>
                      </li>
                    </div>
                  )
                })}
            </ul>
          </div>
        </>
      )}
    </div>
  )
}

StatisticsView.displayName = 'StatisticsView'
