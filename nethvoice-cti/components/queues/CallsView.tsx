// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { FC, ComponentProps, useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { InlineNotification } from '../common'
import { Pagination } from '../common/Pagination'
import { isEmpty, debounce } from 'lodash'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  DEFAULT_CALLS_REFRESH_INTERVAL,
  getQueuesCallsLoadPeriod,
  getCallIcon,
  openShowQueueCallDrawer,
  PAGE_SIZE,
  retrieveAndFilterQueueCalls,
} from '../../lib/queuesLib'
import { faAngleRight, faPhone } from '@fortawesome/free-solid-svg-icons'
import classNames from 'classnames'
import { formatDateLoc } from '../../lib/dateTime'
import { CallsViewFilter } from './CallsViewFilter'
import { useSelector } from 'react-redux'
import { RootState } from '../../store'
import { loadPreference } from '../../lib/storage'
import Link from 'next/link'
import { CallsDate } from '../history/CallsDate'
import { Table } from '../common/Table'

export interface CallsViewProps extends ComponentProps<'div'> {}

export const CallsView: FC<CallsViewProps> = ({ className }): JSX.Element => {
  const { t } = useTranslation()
  const [calls, setCalls]: any = useState({})
  const [isCallsLoaded, setCallsLoaded]: any = useState(false)
  const [callsError, setCallsError] = useState('')
  const [pageNum, setPageNum]: any = useState(1)
  const [firstRender, setFirstRender]: any = useState(true)
  const [lastUpdated, setLastUpdated]: any = useState(null)
  const [intervalId, setIntervalId]: any = useState(0)
  const [callsRefreshInterval, setCallsRefreshInterval]: any = useState(
    DEFAULT_CALLS_REFRESH_INTERVAL,
  )
  const queuesStore = useSelector((state: RootState) => state.queues)
  const authStore = useSelector((state: RootState) => state.authentication)

  const [textFilter, setTextFilter]: any = useState('')
  const updateTextFilter = (newTextFilter: string) => {
    setTextFilter(newTextFilter)
    setPageNum(1)
  }

  const debouncedUpdateTextFilter = useMemo(() => debounce(updateTextFilter, 400), [])

  // stop invocation of debounced function after unmounting
  useEffect(() => {
    return () => {
      debouncedUpdateTextFilter.cancel()
    }
  }, [debouncedUpdateTextFilter])

  const [outcomeFilter, setOutcomeFilter]: any = useState('')
  const updateOutcomeFilter = (newOutcomeFilter: string) => {
    setOutcomeFilter(newOutcomeFilter)
    setPageNum(1)
  }

  const [queuesFilter, setQueuesFilter]: any = useState([])
  const [emptyQueueFilter, setEmptyQueueFilter]: any = useState(false)

  const updateQueuesFilter = (newQueuesFilter: string[]) => {
    setQueuesFilter(newQueuesFilter)
    setPageNum(1)
    setCallsLoaded(false)
  }

  const fetchCalls = async (numHours: number) => {
    let selectedQueues = queuesFilter

    //avoid fetching calls if no queues are selected
    if (!isEmpty(selectedQueues)) {
      setEmptyQueueFilter(false)
      try {
        setCallsError('')
        setCallsLoaded(false)

        const res = await retrieveAndFilterQueueCalls(
          pageNum,
          textFilter.trim(),
          outcomeFilter,
          selectedQueues,
          numHours,
        )

        res.rows = res.rows.map((call: any) => {
          call.queueId = call.queuename
          call.queueName = queuesStore.queues[call.queuename]?.name

          // queuename attribute name is misleading
          delete call.queuename

          return call
        })
        setCalls(res)
        setLastUpdated(new Date())
      } catch (e) {
        console.error(e)
        setCallsError(t('Queues.Cannot retrieve calls') || '')
      }
      setCallsLoaded(true)
    } else {
      setCallsLoaded(true)
      setEmptyQueueFilter(true)
    }
  }

  // retrieve calls
  useEffect(() => {
    if (firstRender) {
      setFirstRender(false)
      return
    }

    let newIntervalId: any = 0

    async function fetchCallsInterval() {
      const numHours = getQueuesCallsLoadPeriod(authStore?.username || '')

      // fetch stats immediately and set interval
      fetchCalls(numHours)

      // clear previous interval (if exists)
      if (intervalId) {
        clearInterval(intervalId)
      }

      const refreshInterval =
        loadPreference('queuesCallsRefreshInterval', authStore?.username) ||
        DEFAULT_CALLS_REFRESH_INTERVAL

      setCallsRefreshInterval(refreshInterval)

      newIntervalId = setInterval(() => {
        fetchCalls(numHours)
      }, refreshInterval * 1000)

      setIntervalId(newIntervalId)
    }

    fetchCallsInterval()

    return () => {
      if (newIntervalId) {
        clearInterval(newIntervalId)
      }
    }
  }, [firstRender, pageNum, textFilter, outcomeFilter, queuesFilter])

  function goToPreviousPage() {
    if (pageNum > 1) {
      setPageNum(pageNum - 1)
    }
  }

  function goToNextPage() {
    if (pageNum < calls.totalPages) {
      setPageNum(pageNum + 1)
    }
  }

  function isPreviousPageButtonDisabled() {
    return !isCallsLoaded || pageNum <= 1
  }

  function isNextPageButtonDisabled() {
    return !isCallsLoaded || pageNum >= calls?.totalPages
  }

  const columns = [
    {
      header: t('Queues.Time'),
      cell: (call: any) => <CallsDate call={call} isInQueue={true} />,
      className:
        'py-3.5 pl-4 pr-3 text-left text-sm font-semibold sm:pl-6 text-gray-700 dark:text-gray-200',
    },
    {
      header: t('Queues.Queue'),
      cell: (call: any) => (
        <div>
          <div>{call?.queueName}</div>
          <div className='text-gray-500 dark:text-gray-500'>{call?.queueId}</div>
        </div>
      ),
      className: 'px-3 py-3.5 text-left text-sm font-semibold text-gray-700 dark:text-gray-200',
    },
    {
      header: t('Queues.Name'),
      cell: (call: any) => (
        <>
          {call?.name && (
            <div onClick={() => openShowQueueCallDrawer(call, queuesStore?.queues)}>
              <span className={classNames(call.cid && 'cursor-pointer hover:underline')}>
                {call?.name}
              </span>
            </div>
          )}
          <div
            onClick={() => openShowQueueCallDrawer(call, queuesStore?.queues)}
            className={classNames(call?.name && 'text-gray-500 dark:text-gray-500')}
          >
            <span className='cursor-pointer hover:underline'>{call?.cid}</span>
          </div>
        </>
      ),
      className: 'px-3 py-3.5 text-left text-sm font-semibold text-gray-700 dark:text-gray-200',
    },
    {
      header: t('Queues.Company'),
      cell: (call: any) => call?.company || '-',
      className: 'px-3 py-3.5 text-left text-sm font-semibold text-gray-700 dark:text-gray-200',
    },
    {
      header: t('Queues.Outcome'),
      cell: (call: any) => (
        <div className='flex items-center'>
          <span>{getCallIcon(call)}</span>
          <span>{t(`Queues.outcome_${call?.event}`)}</span>
        </div>
      ),
      className: 'px-3 py-3.5 text-left text-sm font-semibold text-gray-700 dark:text-gray-200',
    },
    {
      header: '',
      cell: (call: any) => (
        <div className='text-right'>
          <FontAwesomeIcon
            icon={faAngleRight}
            className='h-3 w-3 cursor-pointer text-gray-500 dark:text-gray-500'
            aria-hidden='true'
            onClick={() => openShowQueueCallDrawer(call, queuesStore?.queues)}
          />
        </div>
      ),
      className: 'relative py-3.5 pl-3 pr-4 sm:pr-6',
    },
  ]

  return (
    <div className={classNames(className)}>
      <div className='flex flex-col flex-wrap xl:flex-row justify-between gap-x-4 xl:items-end'>
        <CallsViewFilter
          updateTextFilter={debouncedUpdateTextFilter}
          updateOutcomeFilter={updateOutcomeFilter}
          updateQueuesFilter={updateQueuesFilter}
        />
        <div className='flex text-sm gap-4 text-right pb-4 xl:pb-7'>
          <div className='text-gray-500 dark:text-gray-500'>
            {t('Queues.Last update')}: {lastUpdated ? formatDateLoc(new Date(), 'HH:mm:ss') : '-'} (
            {t('Queues.every_time_interval_seconds', { timeInterval: callsRefreshInterval })})
          </div>
          <Link href={{ pathname: '/settings', query: { section: 'Queues' } }}>
            <span className='hover:underline text-gray-900 dark:text-gray-100'>
              {t('Queues.Settings')}
            </span>
          </Link>
        </div>
      </div>
      {callsError && <InlineNotification type='error' title={callsError}></InlineNotification>}
      {!callsError && (
        <div className='mx-auto'>
          <div className='flex flex-col'>
            <div className='-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8'>
              <div className='inline-block min-w-full py-2 align-middle px-2 md:px-6 lg:px-8'>
                <Table
                  columns={columns}
                  data={isCallsLoaded ? calls?.rows || [] : []}
                  isLoading={!isCallsLoaded}
                  emptyState={{
                    title: t('Queues.No queue calls'),
                    description: t('Queues.There are no recent calls with current filters') || '',
                    icon: (
                      <FontAwesomeIcon
                        icon={faPhone}
                        className='mx-auto h-12 w-12'
                        aria-hidden='true'
                      />
                    ),
                  }}
                  rowKey={(call) => call.id || call.uniqueid || call.cid + call.time}
                  trClassName='h-[84px]'
                  scrollable={true}
                  maxHeight='calc(100vh - 480px)'
                  theadClassName='sticky top-0 bg-gray-100 dark:bg-gray-800 z-[1]'
                  tbodyClassName='text-sm bg-white dark:bg-gray-950 text-gray-700 dark:text-gray-200'
                />
              </div>
            </div>
          </div>

          {/* pagination */}
          {!callsError && !!calls?.rows?.length && (
            <Pagination
              currentPage={pageNum}
              totalPages={calls.totalPages}
              totalItems={calls?.count || 0}
              pageSize={PAGE_SIZE}
              onPreviousPage={goToPreviousPage}
              onNextPage={goToNextPage}
              isLoading={!isCallsLoaded}
              itemsName={t('Queues.calls') || ''}
            />
          )}
        </div>
      )}
    </div>
  )
}

CallsView.displayName = 'CallsView'
