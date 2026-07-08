// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { FC, ComponentProps, useEffect, useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { debounce } from 'lodash'
import { Avatar, EmptyState } from '../../common'
import InfiniteScroll from 'react-infinite-scroll-component'
import { LoggedStatus } from '../../queues'
import { savePreference } from '../../../lib/storage'
import { getExpandedRealtimeValue, searchOperatorsInQueuesMembers } from '../../../lib/queueManager'
import { useSelector } from 'react-redux'
import { RootState } from '../../../store'
import { getInfiniteScrollOperatorsPageSize, openShowOperatorDrawer } from '../../../lib/operators'
import {
  faChevronDown,
  faChevronUp,
  faHeadset,
  faCircleNotch,
  faUser,
  faPhone,
  faAngleRight,
  faPause,
} from '@fortawesome/free-solid-svg-icons'
import { RealTimeOperatorsFilter } from './RealTimeOperatorsFilter'
import { UserActionInQueue } from '../Common/UserActionInQueue'

export interface RealTimeOperatorsProps extends ComponentProps<'div'> {
  realTimeAgentConvertedArray: any
}

export const RealTimeOperators: FC<RealTimeOperatorsProps> = ({
  realTimeAgentConvertedArray,
}): JSX.Element => {
  const { t } = useTranslation()
  const auth = useSelector((state: RootState) => state.authentication)
  const queueManagerStore = useSelector((state: RootState) => state.queueManagerQueues)

  const authStore = useSelector((state: RootState) => state.authentication)

  // load extensions information from the store
  const { operators } = useSelector((state: RootState) => state.operators) as Record<string, any>

  const infiniteScrollOperatorsPageSize = getInfiniteScrollOperatorsPageSize()
  const [infiniteScrollLastIndex, setInfiniteScrollLastIndex] = useState(
    infiniteScrollOperatorsPageSize,
  )

  const [operatorsStatisticsExpanded, setOperatorsStatisticsExpanded] = useState(false)

  const [infiniteScrollOperators, setInfiniteScrollOperators] = useState<any>([])
  const [infiniteScrollHasMore, setInfiniteScrollHasMore] = useState(false)

  const [openedCardIndexes, setOpenedCardIndexes] = useState<number[]>([])

  const toggleExpandAgentCard = (index: number) => {
    if (openedCardIndexes.includes(index)) {
      setOpenedCardIndexes(openedCardIndexes.filter((i) => i !== index))
    } else {
      setOpenedCardIndexes([...openedCardIndexes, index])
    }
  }

  //Update selected queues
  const [queuesFilter, setQueuesFilter]: any = useState([])
  const updateQueuesFilter = (newQueuesFilter: string[]) => {
    setQueuesFilter(newQueuesFilter)
    // setCallsLoaded(false)
  }

  // Operators filter section
  const [textFilterOperators, setTextFilterOperators]: any = useState('')
  const updateTextFilterOperators = (newTextFilterOperators: string) => {
    setTextFilterOperators(newTextFilterOperators)
  }

  const debouncedUpdateTextFilterOperator = useMemo(
    () => debounce(updateTextFilterOperators, 400),
    [],
  )

  // stop invocation of debounced function after unmounting
  useEffect(() => {
    return () => {
      debouncedUpdateTextFilterOperator.cancel()
    }
  }, [debouncedUpdateTextFilterOperator])

  const [filteredAgentMembers, setFilteredAgentMembers]: any = useState([])

  const applyFiltersOperators = () => {
    // text filter
    let filteredAgentMembers: any = Object.values(realTimeAgentConvertedArray).filter((op) =>
      searchOperatorsInQueuesMembers(op, textFilterOperators, queuesFilter),
    )

    setFilteredAgentMembers(filteredAgentMembers)

    setInfiniteScrollOperators(filteredAgentMembers.slice(0, infiniteScrollLastIndex))
    const hasMore = infiniteScrollLastIndex < filteredAgentMembers.length
    setInfiniteScrollHasMore(hasMore)
  }

  // filtered operators
  useEffect(() => {
    if (realTimeAgentConvertedArray) {
      applyFiltersOperators()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [realTimeAgentConvertedArray, textFilterOperators, queuesFilter])

  const showMoreInfiniteScrollOperators = () => {
    const lastIndex = infiniteScrollLastIndex + infiniteScrollOperatorsPageSize
    setInfiniteScrollLastIndex(lastIndex)
    setInfiniteScrollOperators(filteredAgentMembers.slice(0, lastIndex))
    const hasMore = lastIndex < filteredAgentMembers.length
    setInfiniteScrollHasMore(hasMore)
  }

  const toggleExpandOperatorsStatistics = () => {
    setOperatorsStatisticsExpanded(!operatorsStatisticsExpanded)
    let correctExpandOperatorsStatistics = !operatorsStatisticsExpanded
    savePreference(
      'queueManagerRealtimeOperatorPreference',
      correctExpandOperatorsStatistics,
      authStore.username,
    )
  }

  //Load expanded chevron values from local storage
  useEffect(() => {
    const expandedValues = getExpandedRealtimeValue(authStore.username)
    setOperatorsStatisticsExpanded(expandedValues.expandedOperatorsStatistics)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <>
      <div className='py-8 relative'>
        <div className='flex items-center space-x-1'>
          <div className='flex-grow'>
            <h2 className='text-lg font-semibold text-gray-900 dark:text-gray-100'>
              {t('QueueManager.Operators statistics')}
            </h2>
          </div>
          <div className='flex items-center justify-end h-6 w-6'>
            <FontAwesomeIcon
              icon={operatorsStatisticsExpanded ? faChevronUp : faChevronDown}
              className='h-4 w-4 pl-2 py-2  text-gray-600 dark:text-gray-500 cursor-pointer flex items-center'
              aria-hidden='true'
              onClick={toggleExpandOperatorsStatistics}
            />
          </div>
        </div>
        {/* divider */}
        <div className='flex-grow border-b border-gray-200 dark:border-gray-700 mt-1'></div>

        {operatorsStatisticsExpanded && (
          <>
            <div>
              <RealTimeOperatorsFilter
                updateTextFilter={debouncedUpdateTextFilterOperator}
                updateQueuesFilter={updateQueuesFilter}
                className='pt-6'
              ></RealTimeOperatorsFilter>
              <div className='mx-auto text-center 5xl:max-w-screen-2xl'>
                {/* empty state */}
                {filteredAgentMembers.length === 0 && (
                  <EmptyState
                    title={t('QueueManager.No agents') || ''}
                    description='There is no agent'
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
                {!queueManagerStore.isLoaded && (
                  <ul
                    role='list'
                    className='mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-3 5xl:grid-cols-4 5xl:max-w-screen-2xl'
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
                {filteredAgentMembers.length > 0 && (
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
                      className='grid grid-cols-1 gap-6 xl:grid-cols-2 3xl:grid-cols-3 overflow-y-hidden'
                    >
                      {infiniteScrollOperators.map((operator: any, index: number) => {
                        const isCardOpen = openedCardIndexes.includes(index)

                        return (
                          <li
                            key={index}
                            className={`col-span-1 rounded-md divide-y shadow divide-gray-200 bg-cardBackgroud dark:bg-cardBackgroudDark dark:divide-gray-700 ${
                              isCardOpen ? 'h-full' : 'h-20'
                            }`}
                          >
                            {/* card header */}
                            <div className='flex flex-col pt-3 pb-5 px-5'>
                              <div className='flex w-full items-center justify-between space-x-6'>
                                <div className='flex items-center justify-between py-1 text-gray-700 dark:text-gray-200'>
                                  <div className='flex items-center space-x-2'>
                                    <span className='block flex-shrink-0'>
                                      <Avatar
                                        rounded='full'
                                        src={operators[operator?.shortname]?.avatarBase64}
                                        placeholderType='operator'
                                        bordered
                                        size='large'
                                        star={operators[operator?.shortname]?.favorite}
                                        status={operators[operator?.shortname]?.mainPresence}
                                        onClick={() =>
                                          openShowOperatorDrawer(operators[operator?.shortname])
                                        }
                                        className='cursor-pointer'
                                      />
                                    </span>
                                    <div className='flex-1 pl-2'>
                                      <h3 className='truncate text-lg leading-6 font-medium'>
                                        {operator?.name}
                                      </h3>
                                      <span className='block truncate mt-1 text-sm text-left font-medium text-gray-500 dark:text-gray-500'>
                                        <span>{operator?.member}</span>
                                      </span>
                                    </div>
                                  </div>
                                </div>
                                <FontAwesomeIcon
                                  icon={isCardOpen ? faChevronUp : faChevronDown}
                                  className='h-4 w-4 text-gray-600 dark:text-gray-500 cursor-pointer ml-auto'
                                  aria-hidden='true'
                                  onClick={() => toggleExpandAgentCard(index)}
                                />
                              </div>
                              {/* Agent card body  */}
                              {isCardOpen && (
                                <>
                                  {/* divider */}
                                  <div className='flex-grow border-b border-gray-200 dark:border-gray-700 mt-1'></div>

                                  {/* login stats */}
                                  <div className='pt-2 h-96 overflow-auto  scrollbar-thin scrollbar-thumb-gray-400 dark:scrollbar-thumb-gray-400 scrollbar-thumb-rounded-full scrollbar-thumb-opacity-50 scrollbar-track-gray-200 dark:scrollbar-track-gray-900 scrollbar-track-rounded-full scrollbar-track-opacity-25'>
                                    {Object.values(operator?.queues).map(
                                      (queue: any, queueIndex: number) => (
                                        <div
                                          key={queueIndex}
                                          className='col-span-1 pt-2 divide-gray-200 text-gray-700 dark:divide-gray-700 dark:text-gray-200 pb-4'
                                        >
                                          {/* card header */}
                                          <div className='flex items-center justify-between py-3 px-4 bg-gray-100 dark:bg-gray-700 rounded-md'>
                                            <div className='flex flex-grow justify-between'>
                                              <div className='flex flex-col'>
                                                <div className='truncate text-base leading-6 font-medium flex items-center space-x-2'>
                                                  <span>{queue?.qname}</span>
                                                  <span>{queue?.queue}</span>
                                                </div>
                                                <div className='flex pt-1'>
                                                  <LoggedStatus
                                                    loggedIn={queue?.loggedIn}
                                                    paused={queue?.paused}
                                                  />
                                                </div>
                                              </div>
                                              <UserActionInQueue queue={queue} />
                                            </div>
                                          </div>
                                          <div className='px-3 py-4'>
                                            <h3 className='truncate text-base leading-6 font-medium flex items-center'>
                                              <FontAwesomeIcon
                                                icon={faUser}
                                                className='h-4 w-4 mr-2'
                                                aria-hidden='true'
                                              />
                                              <span>{t('Queues.Login')}</span>
                                            </h3>
                                          </div>
                                          {/* divider */}
                                          <div className='flex-grow border-b border-gray-200 dark:border-gray-700 mt-1'></div>
                                          {/* login stats */}
                                          <div className='flex flex-col divide-y divide-gray-200 dark:divide-gray-700'>
                                            {/* last login */}
                                            <div className='flex py-2 px-3'>
                                              <div className='w-1/2 flex justify-start text-gray-500 dark:text-gray-400'>
                                                {t('Queues.Last login')}
                                              </div>
                                              <div className='w-1/2 flex justify-end mr-4'>
                                                {queue?.lastLogin || '-'}
                                              </div>
                                            </div>
                                            {/* last logout */}
                                            <div className='flex py-2 px-3'>
                                              <div className='w-1/2 flex justify-start text-gray-500 dark:text-gray-400'>
                                                {t('Queues.Last logout')}
                                              </div>
                                              <div className='w-1/2 flex justify-end mr-4'>
                                                {queue?.lastLogout || '-'}
                                              </div>
                                            </div>
                                            {/* last login */}
                                          </div>

                                          {/* Pause stats */}
                                          <div className='pt-4'>
                                            <div className='col-span-1 divide-y divide-gray-200 text-gray-700 dark:divide-gray-700 dark:text-gray-200'>
                                              {/* card header */}
                                              <div className='px-3 py-4'>
                                                <h3 className='truncate text-base leading-6 font-medium flex items-center justify-start'>
                                                  <FontAwesomeIcon
                                                    icon={faPause}
                                                    className='h-4 w-4 mr-2'
                                                    aria-hidden='true'
                                                  />
                                                  <span>{t('QueueManager.Pause')}</span>
                                                </h3>
                                              </div>
                                              {/* card body */}
                                              <div className='flex flex-col divide-y divide-gray-200 dark:divide-gray-700'>
                                                {/* last pause */}
                                                <div className='flex py-2 px-3'>
                                                  <div className='w-1/2 flex justify-start text-gray-500 dark:text-gray-400'>
                                                    {t('QueueManager.Last pause')}
                                                  </div>
                                                  <div className='w-1/2 flex justify-end mr-4'>
                                                    {queue?.lastPause || '-'}
                                                  </div>
                                                </div>
                                                {/* outgoing calls */}
                                                <div className='flex py-2 px-3'>
                                                  <div className='w-1/2 flex justify-start text-gray-500 dark:text-gray-400'>
                                                    {t('QueueManager.Last end pause')}
                                                  </div>
                                                  <div className='w-1/2 flex justify-end mr-4'>
                                                    {queue?.lastEndPause || '-'}
                                                  </div>
                                                </div>
                                                {/* missed calls */}
                                                <div className='flex py-2 px-3'>
                                                  <div className='w-1/2 flex justify-start text-gray-500 dark:text-gray-400'>
                                                    {t('QueueManager.Since last pause')}
                                                  </div>
                                                  <div className='w-1/2 flex justify-end mr-4'>
                                                    {queue?.sinceLastPause || '-'}
                                                  </div>
                                                </div>
                                              </div>
                                            </div>
                                          </div>

                                          {/* call stats */}
                                          <div className='pt-4'>
                                            <div className='col-span-1 divide-y divide-gray-200 text-gray-700 dark:divide-gray-700 dark:text-gray-200'>
                                              {/* card header */}
                                              <div className='px-3 py-4'>
                                                <h3 className='truncate text-base leading-6 font-medium flex items-center justify-start'>
                                                  <FontAwesomeIcon
                                                    icon={faPhone}
                                                    className='h-4 w-4 mr-2'
                                                    aria-hidden='true'
                                                  />
                                                  <span>{t('Queues.Calls')}</span>
                                                </h3>
                                              </div>
                                              {/* card body */}
                                              <div className='flex flex-col divide-y divide-gray-200 dark:divide-gray-700'>
                                                {/* answered calls */}
                                                <div className='flex py-2 px-3'>
                                                  <div className='w-1/2 flex justify-start text-gray-500 dark:text-gray-400'>
                                                    {t('QueueManager.Answered calls')}
                                                  </div>
                                                  <div className='w-1/2 flex justify-end mr-4'>
                                                    {queue?.answeredcalls || '-'}
                                                  </div>
                                                </div>
                                                {/* outgoing calls */}
                                                <div className='flex py-2 px-3'>
                                                  <div className='w-1/2 flex justify-start text-gray-500 dark:text-gray-400'>
                                                    {t('QueueManager.Latest call')}
                                                  </div>
                                                  <div className='w-1/2 flex justify-end mr-4'>
                                                    {queue?.lastCall || '-'}
                                                  </div>
                                                </div>
                                                {/* missed calls */}
                                                <div className='flex py-2 px-3'>
                                                  <div className='w-1/2 flex justify-start text-gray-500 dark:text-gray-400'>
                                                    {t('QueueManager.Since latest call')}
                                                  </div>
                                                  <div className='w-1/2 flex justify-end mr-4'>
                                                    {queue?.sinceLastCall || '-'}
                                                  </div>
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      ),
                                    )}
                                  </div>
                                </>
                              )}
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  </InfiniteScroll>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  )
}

RealTimeOperators.displayName = 'RealTimeOperators'
