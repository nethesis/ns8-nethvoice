// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { FC, ComponentProps, useEffect, useState, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useSelector } from 'react-redux'
import { RootState, store } from '../../../store'
import { sortByProperty, sortByFavorite } from '../../../lib/utils'
import { savePreference } from '../../../lib/storage'
import BarChartHorizontalWithTitle from '../../chart/HorizontalWithTitle'
import { debounce, isEmpty } from 'lodash'
import { Tooltip } from 'react-tooltip'
import { EmptyState, IconSwitch, TextInput } from '../../common'
import {
  addQueueToFavorites,
  removeQueueFromFavorites,
  addQueueToExpanded,
  removeQueueFromExpanded,
  searchStringInQueue,
  getExpandedRealtimeValue,
} from '../../../lib/queueManager'
import { faStar as faStarLight } from '@nethesis/nethesis-light-svg-icons'

import {
  faChevronDown,
  faChevronUp,
  faCircleXmark,
  faFilter,
  faStar as faStarSolid,
} from '@fortawesome/free-solid-svg-icons'
import { IconProp } from '@fortawesome/fontawesome-svg-core'

export interface RealTimeQueuesProps extends ComponentProps<'div'> {
  realTimeAgentCounters: any
}

function classNames(...classes: any) {
  return classes.filter(Boolean).join(' ')
}

export const RealTimeQueues: FC<RealTimeQueuesProps> = ({
  className,
  realTimeAgentCounters,
}): JSX.Element => {
  const { t } = useTranslation()
  const queueManagerStore = useSelector((state: RootState) => state.queueManagerQueues)
  const authStore = useSelector((state: RootState) => state.authentication)
  const [queuesStatisticsExpanded, setQueuesStatisticsExpanded] = useState(false)

  const toggleFavoriteQueue = (queue: any) => {
    const queueId = queue.queue
    const isFavorite = !queue.favorite
    store.dispatch.queueManagerQueues.setQueueFavorite(queueId, isFavorite)

    if (isFavorite) {
      addQueueToFavorites(queueId, authStore.username)
    } else {
      removeQueueFromFavorites(queueId, authStore.username)
    }
  }

  //Load expanded chevron values from local storage
  useEffect(() => {
    const expandedValues = getExpandedRealtimeValue(authStore.username)
    setQueuesStatisticsExpanded(expandedValues.expandedQueuesStatistics)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggleExpandQueuesStatistics = () => {
    setQueuesStatisticsExpanded(!queuesStatisticsExpanded)
    let correctExpandQueuesStatistics = !queuesStatisticsExpanded
    savePreference(
      'queueManagerRealtimeQueuesPreference',
      correctExpandQueuesStatistics,
      authStore.username,
    )
  }

  // Queues filter section
  const [textFilter, setTextFilter]: any = useState('')
  const [debouncedTextFilter, setDebouncedTextFilter] = useState(false)

  const toggleDebouncedTextFilter = () => {
    setDebouncedTextFilter(!debouncedTextFilter)
  }

  const changeTextFilter = (event: any) => {
    const newTextFilter = event.target.value
    setTextFilter(newTextFilter)
    debouncedUpdateTextFilter()
  }

  const debouncedUpdateTextFilter = useMemo(
    () => debounce(toggleDebouncedTextFilter, 400),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [debouncedTextFilter],
  )

  // stop invocation of debounced function after unmounting
  useEffect(() => {
    return () => {
      debouncedUpdateTextFilter.cancel()
    }
  }, [debouncedUpdateTextFilter])

  const textFilterRef = useRef() as React.MutableRefObject<HTMLInputElement>
  const clearTextFilter = () => {
    setTextFilter('')
    debouncedUpdateTextFilter()
    textFilterRef.current.focus()
  }

  // Labels for queues chart
  const labelsCalls = ['Waiting calls', 'Connected calls', 'Total']
  const labelsOperators = ['Online', 'On a break', 'Offline', 'Busy', 'Free']

  const [filteredQueues, setFilteredQueues]: any = useState({})

  const [isApplyingFilters, setApplyingFilters]: any = useState(false)

  //declaration of apply filter
  const applyFiltersQueues = () => {
    setApplyingFilters(true)

    // text filter
    let filteredQueues = Object.values(queueManagerStore.queues).filter((queue) =>
      searchStringInQueue(queue, textFilter),
    )

    // sort queues
    filteredQueues.sort(sortByProperty('name'))
    filteredQueues.sort(sortByProperty('queue'))
    filteredQueues.sort(sortByFavorite)

    setFilteredQueues(filteredQueues)
    setApplyingFilters(false)
  }

  // filtered queues
  useEffect(() => {
    applyFiltersQueues()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queueManagerStore, textFilter])

  const toggleExpandQueue = (queue: any) => {
    const queueId = queue.queue
    const isExpanded = !queue.expanded
    store.dispatch.queueManagerQueues.setQueueExpanded(queueId, isExpanded)

    if (isExpanded) {
      addQueueToExpanded(queueId, authStore.username)
    } else {
      removeQueueFromExpanded(queueId, authStore.username)
    }
    applyFiltersQueues()
  }

  return (
    <>
      <div className='pt-8 relative mt-4'>
        <div className='flex items-center space-x-1'>
          <div className='flex-grow'>
            <h2 className='text-lg font-semibold text-gray-900 dark:text-gray-100'>
              {t('QueueManager.Queues statistics')}
            </h2>
          </div>
          <div className='flex items-center justify-end h-6 w-6'>
            <FontAwesomeIcon
              icon={queuesStatisticsExpanded ? faChevronUp : faChevronDown}
              className='h-4 w-4 text-gray-600 dark:text-gray-500 pl-2 py-2 flex items-center'
              aria-hidden='true'
              onClick={toggleExpandQueuesStatistics}
            />
          </div>
        </div>
        {/* divider */}
        <div className='flex-grow border-b border-gray-200 dark:border-gray-700 mt-1'></div>

        {queuesStatisticsExpanded && (
          <div className='mx-auto text-center'>
            <TextInput
              placeholder={t('Queues.Filter queues') || ''}
              value={textFilter}
              onChange={changeTextFilter}
              ref={textFilterRef}
              icon={textFilter.length ? faCircleXmark : undefined}
              onIconClick={() => clearTextFilter()}
              trailingIcon={true}
              className='max-w-xs mb-6 mt-8'
            />
            {/* no search results */}
            {queueManagerStore.isLoaded && isEmpty(filteredQueues) && (
              <EmptyState
                title={t('Queues.No queues')}
                description={t('Common.Try changing your search filters') || ''}
                icon={
                  <FontAwesomeIcon
                    icon={faFilter}
                    className='mx-auto h-12 w-12'
                    aria-hidden='true'
                  />
                }
              />
            )}

            <ul role='list' className='grid grid-cols-1 gap-6 xl:grid-cols-2 3xl:grid-cols-3'>
              {/* skeleton */}
              {(!queueManagerStore.isLoaded || isApplyingFilters) &&
                Array.from(Array(3)).map((e, i) => (
                  <li
                    key={i}
                    className='col-span-1 rounded-md divide-y shadow divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900'
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
              {/* queues */}
              {queueManagerStore.isLoaded &&
                Object.keys(filteredQueues).map((key) => {
                  const queue = filteredQueues[key]
                  let realtimeAgentCountersChartData = realTimeAgentCounters.counters[queue.queue]
                  const datasetsQueues = [
                    {
                      label: 'Calls',
                      data: [
                        queue.waitingCallersList.length || 0,
                        realtimeAgentCountersChartData.connected || 0,
                        queue.waitingCallersList.length +
                          realtimeAgentCountersChartData.connected || 0,
                      ],
                      backgroundColor: [
                        '#059669', // Lost calls
                        '#064E3B', // Expired time
                        '#E5E7EB', // Total
                      ],
                      borderRadius: 10,
                      barPercentage: 1,
                      borderWidth: 0,
                      borderSkipped: false,
                      categorySpacing: 6,
                      barThickness: 25,
                    },
                  ]
                  const datasetsOperators = [
                    {
                      label: 'Operators',
                      data: [
                        queue.onlineOperators || 0,
                        queue.numPausedOperators || 0,
                        realtimeAgentCountersChartData.offline || 0,
                        realtimeAgentCountersChartData.busy || 0,
                        queue.onlineOperators -
                          realtimeAgentCountersChartData.busy -
                          queue.numPausedOperators || 0,
                      ],
                      backgroundColor: [
                        '#059669', // Online
                        '#eab308', // On a break
                        '#E5E7EB', // Offline
                        '#4b5563', // Busy
                        '#4ade80', // Free
                      ],
                      borderRadius: 10,
                      barPercentage: 1,
                      borderWidth: 0,
                      borderSkipped: false,
                      categorySpacing: 6,
                      barThickness: 10,
                    },
                  ]
                  return (
                    <div key={queue.queue}>
                      <li className='col-span-1 rounded-md shadow divide-gray-200 bg-cardBackgroud dark:bg-cardBackgroudDark dark:divide-gray-700'>
                        {/* card header */}
                        <div className='flex flex-col pt-3 pb-5 px-5'>
                          <div className='flex w-full items-center justify-between space-x-6'>
                            <div className='flex-1 truncate'>
                              <div className='flex items-center space-x-2 py-1 text-gray-700 dark:text-gray-200'>
                                <h3 className='truncate text-lg leading-6 font-medium'>
                                  {queue.name}
                                </h3>
                                <span>{queue.queue}</span>
                                <IconSwitch
                                  on={queue.favorite}
                                  size='large'
                                  onIcon={<FontAwesomeIcon icon={faStarSolid} />}
                                  offIcon={<FontAwesomeIcon icon={faStarLight as IconProp} />}
                                  changed={() => toggleFavoriteQueue(queue)}
                                  key={queue.queue}
                                  className={`tooltip-favorite-${queue.queue}`}
                                >
                                  <span className='sr-only'>
                                    {t('Queues.Toggle favorite queue')}
                                  </span>
                                </IconSwitch>
                                <Tooltip
                                  anchorSelect={`.tooltip-favorite-${queue.queue}`}
                                  place='top'
                                >
                                  {queue.favorite
                                    ? t('Common.Remove from favorites') || ''
                                    : t('Common.Add to favorites') || ''}
                                </Tooltip>
                              </div>
                            </div>
                            <FontAwesomeIcon
                              icon={queue.expanded ? faChevronUp : faChevronDown}
                              className='h-4 w-4 text-gray-600 dark:text-gray-500 pl-2 py-2 cursor-pointer'
                              aria-hidden='true'
                              onClick={() => toggleExpandQueue(queue)}
                            />
                          </div>
                        </div>
                        {/* card body */}
                        {queue.expanded && (
                          <>
                            {/* divider */}
                            {/* <div className='flex-grow border-b border-gray-200 dark:border-gray-700 mt-1'></div> */}
                            <div className='w-full px-8 pt-1'>
                              <BarChartHorizontalWithTitle
                                labels={labelsCalls}
                                datasets={datasetsQueues}
                                titleText='Calls'
                              />
                            </div>
                            <div className='w-full px-8 pt-1 pb-6'>
                              <BarChartHorizontalWithTitle
                                labels={labelsOperators}
                                datasets={datasetsOperators}
                                titleText='Operators'
                              />
                            </div>
                          </>
                        )}
                      </li>
                    </div>
                  )
                })}
            </ul>
          </div>
        )}
      </div>
    </>
  )
}

RealTimeQueues.displayName = 'RealTimeQueues'
