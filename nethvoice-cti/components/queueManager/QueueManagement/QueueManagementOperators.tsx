// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { FC, ComponentProps, useEffect, useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faChevronDown,
  faChevronUp,
  faHeadset,
  faAngleRight,
  faCircleNotch,
} from '@fortawesome/free-solid-svg-icons'
import { QueueManagementFilterOperators } from './QueueManagementFilterOperators'
import { debounce, isEmpty } from 'lodash'
import { Avatar, EmptyState } from '../../common'
import InfiniteScroll from 'react-infinite-scroll-component'
import { LoggedStatus } from '../../queues'
import { savePreference } from '../../../lib/storage'
import {
  getExpandedQueueManagamentValue,
  searchStringInQueuesMembers,
} from '../../../lib/queueManager'
import { useSelector } from 'react-redux'
import { RootState } from '../../../store'
import { getInfiniteScrollOperatorsPageSize, openShowOperatorDrawer } from '../../../lib/operators'
import { sortByBooleanProperty, sortByProperty } from '../../../lib/utils'
import { UserActionInQueue } from '../Common/UserActionInQueue'

export interface QueueManagementOperatorsProps extends ComponentProps<'div'> {
  selectedValue: any
  agentCounters: any
  allQueuesStats: boolean
}

export const QueueManagementOperators: FC<QueueManagementOperatorsProps> = ({
  selectedValue,
  agentCounters,
  allQueuesStats,
}): JSX.Element => {
  const { t } = useTranslation()
  const auth = useSelector((state: RootState) => state.authentication)
  const queueManagerStore = useSelector((state: RootState) => state.queueManagerQueues)
  const { operators } = useSelector((state: RootState) => state.operators)

  const infiniteScrollOperatorsPageSize = getInfiniteScrollOperatorsPageSize()

  const [infiniteScrollLastIndex, setInfiniteScrollLastIndex] = useState(
    infiniteScrollOperatorsPageSize,
  )
  const [infiniteScrollOperators, setInfiniteScrollOperators] = useState([])
  const [infiniteScrollHasMore, setInfiniteScrollHasMore] = useState(false)

  const [expandedQueueOperators, setExpandedQueueOperators] = useState(false)

  const toggleQueueOperators = () => {
    setExpandedQueueOperators(!expandedQueueOperators)
    let correctExpandedQueueOperators = !expandedQueueOperators
    savePreference(
      'queueManagementQueueOperatorsExpandedPreference',
      correctExpandedQueueOperators,
      auth.username,
    )
  }

  //Load expanded chevron values from local storage
  useEffect(() => {
    const expandedValues = getExpandedQueueManagamentValue(auth.username)
    setExpandedQueueOperators(expandedValues.expandedQueueOperators)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [textFilter, setTextFilter]: any = useState('')
  const updateTextFilter = (newTextFilter: string) => {
    setTextFilter(newTextFilter)
  }

  const debouncedUpdateTextFilter = useMemo(() => debounce(updateTextFilter, 400), [])

  const [statusFilter, setStatusFilter]: any = useState('')
  const updateStatusFilter = (newStatusFilter: string) => {
    setStatusFilter(newStatusFilter)
  }

  const [sortByFilter, setSortByFilter]: any = useState('')
  const updateSort = (newSortBy: string) => {
    setSortByFilter(newSortBy)
  }

  const showMoreInfiniteScrollOperators = () => {
    const lastIndex = infiniteScrollLastIndex + infiniteScrollOperatorsPageSize
    setInfiniteScrollLastIndex(lastIndex)
    setInfiniteScrollOperators(filteredAgentMembers.slice(0, lastIndex))
    const hasMore = lastIndex < filteredAgentMembers.length
    setInfiniteScrollHasMore(hasMore)
  }

  const [isApplyingFilters, setApplyingFilters]: any = useState(false)
  const [filteredAgentMembers, setFilteredAgentMembers]: any = useState([])

  // apply selected filters
  const applyFilters = (operators: any) => {
    if (!(statusFilter && sortByFilter)) {
      return
    }
    setApplyingFilters(true)
    // text filter
    let filteredAgentMembers: any = Object.values(operators).filter((op) =>
      searchStringInQueuesMembers(op, textFilter),
    )

    // status filter
    filteredAgentMembers = filteredAgentMembers.filter((member: any) => {
      return (
        statusFilter === 'all' ||
        (statusFilter === 'connected' && member.loggedIn) ||
        (statusFilter === 'disconnected' && !member.loggedIn)
      )
    })
    // sort operators
    switch (sortByFilter) {
      case 'name':
        filteredAgentMembers.sort(sortByProperty('name'))
        break
      case 'status':
        filteredAgentMembers.sort(sortByBooleanProperty('loggedIn'))
        break
    }

    setFilteredAgentMembers(filteredAgentMembers)

    setInfiniteScrollOperators(filteredAgentMembers.slice(0, infiniteScrollLastIndex))
    const hasMore = infiniteScrollLastIndex < filteredAgentMembers.length
    setInfiniteScrollHasMore(hasMore)
    setApplyingFilters(false)
  }

  // apply filters when operators data has been loaded and operator menu is opened
  useEffect(() => {
    if (
      queueManagerStore?.isLoaded &&
      queueManagerStore?.queues[selectedValue?.queue]?.allQueueOperators
    ) {
      applyFilters(queueManagerStore?.queues[selectedValue?.queue]?.allQueueOperators)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedValue, textFilter, sortByFilter, statusFilter, queueManagerStore.isLoaded])

  // stop invocation of debounced function after unmounting
  useEffect(() => {
    return () => {
      debouncedUpdateTextFilter.cancel()
    }
  }, [debouncedUpdateTextFilter])

  return (
    <>
      <div className='w-2/3 ml-8'>
        {/* Queue operators */}
        <div className='flex items-center'>
          <div className='flex items-center'>
            <FontAwesomeIcon
              icon={faHeadset}
              className='h-4 w-4 mr-2 py-2 cursor-pointer flex items-center'
              aria-hidden='true'
            />
            <h2 className='text-base font-semibold text-gray-900 dark:text-gray-100 mr-4'>
              {t('QueueManager.Queue operators')}
            </h2>
          </div>
          <div className='flex-grow'></div>
          <div className='flex items-center justify-end h-6 w-6'>
            <FontAwesomeIcon
              icon={expandedQueueOperators ? faChevronUp : faChevronDown}
              className='h-3.5 w-3.5 pl-2 py-2 cursor-pointer flex items-center'
              aria-hidden='true'
              onClick={toggleQueueOperators}
            />
          </div>
        </div>

        {/* divider */}
        <div className='flex-grow border-b border-gray-200 dark:border-gray-700 mt-1'></div>
        {expandedQueueOperators && (
          <div className='pt-6'>
            <QueueManagementFilterOperators
              updateTextFilter={debouncedUpdateTextFilter}
              updateStatusFilter={updateStatusFilter}
              updateSort={updateSort}
            ></QueueManagementFilterOperators>
            <div className='mx-auto text-center max-w-7xl 5xl:max-w-screen-2xl'>
              {/* empty state */}
              {allQueuesStats &&
                isEmpty(queueManagerStore?.queues[selectedValue?.queue]?.members) && (
                  <EmptyState
                    title={t('QueueManager.No operators') || ''}
                    description='There is no operator configured'
                    icon={
                      <FontAwesomeIcon
                        icon={faHeadset}
                        className='mx-auto h-12 w-12'
                        aria-hidden='true'
                      />
                    }
                  ></EmptyState>
                )}
              {/* skeleton */}
              {!allQueuesStats && !queueManagerStore?.isLoaded && (
                <ul
                  role='list'
                  className='mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-2 5xl:grid-cols-4 5xl:max-w-screen-2xl'
                >
                  {Array.from(Array(24)).map((e, index) => (
                    <li key={index} className='px-1'>
                      <button
                        type='button'
                        className='group flex w-full items-center justify-between space-x-3 rounded-lg p-2 text-left focus:outline-none focus:ring-2 focus:ring-offset-2 bg-cardBackgroud dark:bg-cardBackgroudDark cursor-default'
                      >
                        <div className='flex min-w-0 flex-1 items-center space-x-3'>
                          <div className='block flex-shrink-0'>
                            <div className='animate-pulse rounded-full h-10 w-10 mx-auto bg-gray-300 dark:bg-gray-600'></div>
                          </div>
                          <span className='block min-w-0 flex-1'>
                            <div className='animate-pulse h-4 rounded bg-gray-300 dark:bg-gray-600'></div>
                          </span>
                        </div>
                        <span className='inline-flex h-10 w-10 flex-shrink-0 items-center justify-center'>
                          <FontAwesomeIcon
                            icon={faAngleRight}
                            className='h-3 w-3 text-gray-400 dark:text-gray-500'
                            aria-hidden='true'
                          />
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {/* compact layout operators */}
              {allQueuesStats &&
                queueManagerStore?.queues[selectedValue?.queue]?.allQueueOperators?.length > 0 && (
                  <InfiniteScroll
                    dataLength={infiniteScrollOperators.length}
                    next={showMoreInfiniteScrollOperators}
                    hasMore={infiniteScrollHasMore}
                    scrollableTarget='main-content'
                    loader={
                      <FontAwesomeIcon
                        icon={faCircleNotch}
                        className='inline-block text-center fa-spin h-8 m-10 text-gray-400 dark:text-gray-500'
                      />
                    }
                  >
                    <ul
                      role='list'
                      className='mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-2 5xl:grid-cols-4 5xl:max-w-screen-2xl'
                    >
                      {infiniteScrollOperators.map((operator: any, index) => {
                        return (
                          <li key={index} className='px-1'>
                            <div className='group flex w-full items-center justify-between space-x-3 rounded-lg p-2 text-left focus:outline-none focus:ring-2 focus:ring-offset-2 bg-cardBackgroud dark:bg-cardBackgroudDark hover:bg-gray-200 dark:hover:bg-gray-700 focus:ring-primary dark:focus:ring-primary'>
                              <span className='flex min-w-0 flex-1 items-center space-x-3'>
                                <span className='block flex-shrink-0 cursor-pointer'>
                                  <Avatar
                                    rounded='full'
                                    src={operators[operator?.shortname]?.avatarBase64}
                                    placeholderType='operator'
                                    size='small'
                                    status={operators[operator?.shortname]?.mainPresence}
                                    onClick={() =>
                                      openShowOperatorDrawer(operators[operator?.shortname])
                                    }
                                    star={operators?.[operator?.shortname]?.favorite}
                                  />
                                </span>
                                <span className='block min-w-0 flex-1'>
                                  <span
                                    className='block truncate text-sm font-medium text-gray-900 dark:text-gray-100 cursor-pointer'
                                    onClick={() =>
                                      openShowOperatorDrawer(operators[operator?.shortname])
                                    }
                                  >
                                    {operator.name}
                                  </span>
                                  <span className='block truncate mt-1 text-sm font-medium text-gray-500 dark:text-gray-500'>
                                    <LoggedStatus
                                      loggedIn={
                                        queueManagerStore?.queues[selectedValue?.queue]?.members[
                                          operator?.member
                                        ]?.loggedIn
                                      }
                                      paused={
                                        queueManagerStore?.queues[selectedValue?.queue]?.members[
                                          operator?.member
                                        ]?.paused
                                      }
                                    />
                                  </span>
                                </span>
                              </span>
                              <UserActionInQueue
                                queue={
                                  queueManagerStore?.queues[selectedValue?.queue]?.members[
                                    operator?.member
                                  ]
                                }
                              />
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  </InfiniteScroll>
                )}
            </div>
          </div>
        )}
      </div>
    </>
  )
}

QueueManagementOperators.displayName = 'QueueManagementOperators'
