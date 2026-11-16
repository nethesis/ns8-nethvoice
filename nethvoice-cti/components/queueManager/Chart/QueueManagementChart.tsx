// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  GREEN_200,
  GREEN_300,
  GREEN_500,
  GREEN_800,
  AMBER_200,
  AMBER_500,
  AMBER_800,
  INDIGO_100,
  INDIGO_400,
  INDIGO_700,
  INDIGO_800,
  ROSE_100,
  ROSE_400,
  ROSE_700,
  ROSE_800,
  ORANGE_300,
  AMBER_300,
  BLUE_400,
  PINK_400,
} from '../../../lib/colors'
import { FC, ComponentProps, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { RootState } from '../../../store'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useSelector } from 'react-redux'
import { getCallIcon, openShowQueueCallDrawer } from '../../../lib/queueManager'
import BarChartHorizontal from '../../chart/HorizontalBarChart'
import { EmptyState, Button } from '../../common'
import { CustomThemedTooltip } from '../../common/CustomThemedTooltip'
import { faArrowRight, faUser } from '@fortawesome/free-solid-svg-icons'
import Link from 'next/link'
import { isEmpty } from 'lodash'
import { formatDateLoc, getCallTimeToDisplay } from '../../../lib/dateTime'

export interface QueueManagementChartProps extends ComponentProps<'div'> {
  queuesList: any
  selectedValue: any
  allQueuesStats: boolean
  isLoadedQueuesNotManaged: boolean
  calls: any
}

function classNames(...classes: any) {
  return classes.filter(Boolean).join(' ')
}

const barDataset = (label: string, value: number, backgroundColor: string, borderWidth = 0) => ({
  label,
  data: [value],
  backgroundColor,
  borderRadius: 10,
  barPercentage: 0.5,
  borderWidth,
  borderSkipped: false,
})

export const QueueManagementChart: FC<QueueManagementChartProps> = ({
  className,
  queuesList,
  selectedValue,
  allQueuesStats,
  isLoadedQueuesNotManaged,
  calls,
}): JSX.Element => {
  const { t } = useTranslation()
  const queueManagerStore = useSelector((state: RootState) => state.queueManagerQueues)

  // Chart functions section

  // Connected calls
  const [mininumConnectedCallsDatasets, setMininumConnectedCallsDatasets] = useState(0)
  const [averageConnectedCallsDatasets, setAverageConnectedCallsDatasets] = useState(0)
  const [maximumConnectedCallsDatasets, setMaximumConnectedCallsDatasets] = useState(0)

  // Waiting calls
  const [mininumWaitingCallsDatasets, setMininumWaitingCallsDatasets] = useState(0)
  const [averageWaitingCallsDatasets, setAverageWaitingCallsDatasets] = useState(0)
  const [maximumWaitingCallsDatasets, setMaximumWaitingCallsDatasets] = useState(0)

  // Calls status

  //Totals
  const [totalCallsStatus, setTotalCallsStatus] = useState(0)
  const [totalCallsAnsweredStatus, setTotalCallsAnsweredStatus] = useState(0)
  const [totalCallsMissedStatus, setTotalCallsMissedStatus] = useState(0)
  const [totalNullCalls, setTotalNullCalls] = useState(0)
  const [inProgress, setInProgress] = useState(0)

  //Details answered
  const [answeredBeforeSeconds, setAnsweredBeforeSeconds] = useState(0)
  const [answeredAfterSeconds, setAnsweredAfterSeconds] = useState(0)

  //Details failed
  const [expiredTime, setExpiredTime] = useState(0)
  const [abandonedCalls, setAbandonedCalls] = useState(0)
  const [failedNoagentsOutqueue, setFailedNoagentsOutqueue] = useState(0)
  const [failedNoagentsInqueue, setFailedNoagentsInqueue] = useState(0)

  useEffect(() => {
    //check if queue list is already loaded and queue is selected
    if (queuesList && selectedValue?.queue && allQueuesStats) {
      const qstats = queuesList[selectedValue.queue]?.qstats || {}
      if (!isEmpty(qstats)) {
        const connectedCallsStats = calculateConnectedCallsStats(qstats)
        const waitingCallsStats = calculateWaitingCallsStats(qstats)
        const callStatus = calculateCallsStats(qstats)

        // Calls duration charts status

        // Connected calls
        setMininumConnectedCallsDatasets(connectedCallsStats.minimum)
        setAverageConnectedCallsDatasets(connectedCallsStats.average)
        setMaximumConnectedCallsDatasets(connectedCallsStats.maximum)

        // Waiting calls
        setMininumWaitingCallsDatasets(waitingCallsStats.minimum)
        setAverageWaitingCallsDatasets(waitingCallsStats.average)
        setMaximumWaitingCallsDatasets(waitingCallsStats.maximum)

        // Calls chart status

        // Total calls section
        // Total calls
        setTotalCallsStatus(callStatus.total)
        // Answered calls
        setTotalCallsAnsweredStatus(callStatus.answered)
        // Lost calls
        setTotalCallsMissedStatus(callStatus.notAnswerCalls)
        // Null calls
        setTotalNullCalls(callStatus.totNull)
        // In progress call
        let inProgressValue =
          callStatus.total - callStatus.answered - callStatus.notAnswerCalls - callStatus.totNull
        setInProgress(inProgressValue)

        // Answred calls details
        // Answered before seconds
        setAnsweredBeforeSeconds(callStatus.beforeSecondsCalls)
        setAnsweredAfterSeconds(callStatus.afterSecondsCalls)

        // Failed section details
        setExpiredTime(callStatus.expiredTime)
        setAbandonedCalls(callStatus.abandon)
        setFailedNoagentsOutqueue(callStatus.outqueueNoAgents)
        setFailedNoagentsInqueue(callStatus.inqueueNoAgents)
      }
    }
  }, [queuesList, selectedValue, allQueuesStats])

  function processCallData(callData: any) {
    const eventMappings: any = {
      ABANDON: 'ABANDON',
      FAILED: 'FAILED',
      NO_ANSWER: 'NO_ANSWER',
      EXITWITHTIMEOUT: 'EXITWITHTIMEOUT',
    }

    const rows = callData?.rows || []

    const processedData: any = {
      queueman: rows[0]?.queuename || '',
      tot: callData?.count || 0,
      ABANDON: 0,
      FAILED: 0,
      NO_ANSWER: 0,
      EXITWITHTIMEOUT: 0,
    }

    rows.forEach((call: any) => {
      if (eventMappings.hasOwnProperty(call.event)) {
        const eventProperty = eventMappings[call.event]
        processedData[eventProperty]++
      }
    })

    return processedData
  }

  // Not managed customers
  const [abandonedNotManaged, setAbandonedNotManaged] = useState(0)
  const [failedNotManaged, setFailedNotManaged] = useState(0)
  const [noAnswereNotManaged, setNoAnswereNotManaged] = useState(0)
  const [exitWithTimeoutNotManaged, setExitWithTimeoutNotManaged] = useState(0)
  const [totalNotManaged, setTotalNotManaged] = useState(0)

  useEffect(() => {
    if (calls && isLoadedQueuesNotManaged) {
      const eventsGrouped = processCallData(calls)
      if (!isEmpty(eventsGrouped)) {
        const abandonedNotManagedChart = eventsGrouped.ABANDON || 0
        const failedNotManagedChart = eventsGrouped.FAILED || 0
        const noAnswereNotManagedChart = eventsGrouped.NO_ANSWER || 0
        const exitWithTimeoutNotManagedChart = eventsGrouped.EXITWITHTIMEOUT || 0
        const totNotManaged = eventsGrouped.tot || 0

        setFailedNotManaged(failedNotManagedChart)
        setAbandonedNotManaged(abandonedNotManagedChart)
        setNoAnswereNotManaged(noAnswereNotManagedChart)
        setExitWithTimeoutNotManaged(exitWithTimeoutNotManagedChart)
        setTotalNotManaged(totNotManaged)
      }
    }
  }, [calls, isLoadedQueuesNotManaged])

  const notManagedCustomersLabels = [t('QueueManager.Not managed customers details')]

  const notManagedCustomersDataset = [
    barDataset(t('Queues.outcome_ABANDON'), abandonedNotManaged, ORANGE_300),
    barDataset(t('Queues.outcome_FAILED'), failedNotManaged, AMBER_300),
    barDataset(t('Queues.outcome_NO ANSWER'), noAnswereNotManaged, BLUE_400),
    barDataset(t('Queues.outcome_EXITWITHTIMEOUT'), exitWithTimeoutNotManaged, PINK_400),
  ]

  //Connected calls chart values
  function calculateConnectedCallsStats(qstats: any) {
    const minDurationConnected = qstats.min_duration || 0
    const avgDurationConnected = qstats.avg_duration || 0
    const maxDurationConnected = qstats.max_duration || 0

    return {
      minimum: minDurationConnected,
      average: avgDurationConnected,
      maximum: maxDurationConnected,
    }
  }

  //Connected calls chart values
  function calculateWaitingCallsStats(qstats: any) {
    const minDurationWaiting = qstats.min_wait || 0
    const avgDurationWaiting = qstats.avg_wait || 0
    const maxDurationWaiting = qstats.max_wait || 0

    return {
      minimum: minDurationWaiting,
      average: avgDurationWaiting,
      maximum: maxDurationWaiting,
    }
  }

  //Customers to manage calls values
  function calculateCallsStats(qstats: any) {
    //total sections
    const totalCalls = qstats.tot || 0
    const notAnswerCalls = qstats.tot_failed || 0
    const answeredCalls = qstats.tot_processed || 0
    const totNull = qstats.tot_null || 0

    //details answered section
    const beforeSecondsCalls = qstats.processed_less_sla || 0
    const afterSecondsCalls = qstats.processed_greater_sla || 0

    //details failed section
    const expiredTime = qstats.failed_timeout || 0
    const abandon = qstats.failed_abandon || 0
    const outqueueNoAgents = qstats.failed_outqueue_noagents || 0
    const inqueueNoAgents = qstats.failed_inqueue_noagents || 0

    return {
      //total sections
      total: totalCalls,
      answered: answeredCalls,
      notAnswerCalls: notAnswerCalls,
      totNull: totNull,

      //details answered section
      beforeSecondsCalls: beforeSecondsCalls,
      afterSecondsCalls: afterSecondsCalls,

      //details failed section
      expiredTime: expiredTime,
      abandon: abandon,
      outqueueNoAgents: outqueueNoAgents,
      inqueueNoAgents: inqueueNoAgents,
    }
  }
  //Connected calls chart functions section
  const connectedCallsLabels = [t('QueueManager.Connected calls')]

  const ConnectedCallsDatasets = [
    barDataset(t('Queues.Minimum'), mininumConnectedCallsDatasets, GREEN_200),
    barDataset(t('Queues.Average'), averageConnectedCallsDatasets, GREEN_500),
    barDataset(t('Queues.Maximum'), maximumConnectedCallsDatasets, GREEN_800),
  ]

  //Waiting calls chart functions section
  const waitingCallsLabels = [t('QueueManager.Waiting calls')]

  const WaitingCallsDatasets = [
    barDataset(t('Queues.Minimum'), mininumWaitingCallsDatasets, AMBER_200),
    barDataset(t('Queues.Average'), averageWaitingCallsDatasets, AMBER_500),
    barDataset(t('Queues.Maximum'), maximumWaitingCallsDatasets, AMBER_800),
  ]

  //total calls chart functions section
  const totalCallsLabels = [t('QueueManager.Total calls')]

  const totalCallsDatasets = [
    barDataset(t('QueueManager.Null'), totalNullCalls, INDIGO_100),
    barDataset(t('QueueManager.Failed'), totalCallsMissedStatus, INDIGO_400),
    barDataset(t('QueueManager.Answered'), totalCallsAnsweredStatus, INDIGO_700),
    barDataset(t('QueueManager.In progress'), inProgress, INDIGO_800),
  ]

  const AnsweredCallsLabels = [t('QueueManager.Answered details')]

  const AnsweredCallsDatasets = [
    barDataset(t('QueueManager.Before 60s'), answeredBeforeSeconds, GREEN_300),
    barDataset(t('QueueManager.After 60s'), answeredAfterSeconds, GREEN_800),
  ]

  const failedCallsLabels = [t('QueueManager.Failed details')]

  const failedCallsDatasets = [
    barDataset(t('QueueManager.Expired'), expiredTime, ROSE_100),
    barDataset(t('QueueManager.Abandoned'), abandonedCalls, ROSE_400),
    barDataset(t('QueueManager.No agents outqueue'), failedNoagentsOutqueue, ROSE_700, 0.5),
    barDataset(t('QueueManager.No agents inqueue'), failedNoagentsInqueue, ROSE_800, 0.5),
  ]

  return (
    <>
      <div className='grid grid-cols-1 gap-4 sm:grid-cols-1 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3'>
        {/* Calls duration */}

        <div className='pt-8'>
          <div className='border-b rounded-lg shadow-md border-gray-200 dark:border-gray-700 bg-cardBackgroud dark:bg-cardBackgroudDark px-5 py-1 mt-1 relative h-full'>
            <div className='pt-3'>
              <span className='text-lg font-semibold leading-6 text-center text-gray-700 dark:text-gray-100'>
                {t('QueueManager.Calls duration')}
              </span>
            </div>
            <div className='flex justify-center pt-2'>
              <div className='w-full h-full'>
                <BarChartHorizontal
                  labels={connectedCallsLabels}
                  datasets={ConnectedCallsDatasets}
                  titleText={t('QueueManager.Connected calls')}
                  numericTooltip={false}
                />
                <BarChartHorizontal
                  labels={waitingCallsLabels}
                  datasets={WaitingCallsDatasets}
                  titleText={t('QueueManager.Waiting calls')}
                  numericTooltip={false}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Calls */}
        <div className='pt-8'>
          <div className='border-b rounded-lg shadow-md border-gray-200 dark:border-gray-700 bg-cardBackgroud dark:bg-cardBackgroudDark px-5 py-1 sm:mt-1 relative w-full h-full'>
            <div className='flex'>
              <div className='pt-3'>
                <span className='text-lg font-semibold leading-6 text-center text-gray-700 dark:text-gray-100'>
                  {t('QueueManager.Calls')}
                </span>
              </div>
            </div>
            <div className='flex justify-center items-center px-3 pt-2'>
              <div className='w-full h-full flex flex-col space-y-4'>
                <BarChartHorizontal
                  labels={totalCallsLabels}
                  datasets={totalCallsDatasets}
                  titleText={`${t('QueueManager.Total calls')}: ${totalCallsStatus}`}
                  numericTooltip={true}
                />
                <BarChartHorizontal
                  labels={AnsweredCallsLabels}
                  datasets={AnsweredCallsDatasets}
                  titleText={`${t('QueueManager.Answered calls')}: ${totalCallsAnsweredStatus}`}
                  numericTooltip={true}
                />
                <BarChartHorizontal
                  labels={failedCallsLabels}
                  datasets={failedCallsDatasets}
                  titleText={`${t('QueueManager.Failed calls')}: ${totalCallsMissedStatus}`}
                  numericTooltip={true}
                />
              </div>
            </div>
            <div className='w-full h-full flex '></div>
          </div>
        </div>

        {/* Customers to manage */}
        <div className='pt-8'>
          <div className='border-b rounded-lg shadow-md border-gray-200 dark:border-gray-700 bg-cardBackgroud dark:bg-cardBackgroudDark px-5 py-1 mt-1 relative h-full'>
            <div className='flex'>
              <div className='pt-3'>
                <span className='text-lg font-semibold leading-6 text-center text-gray-700 dark:text-gray-100'>
                  {t('QueueManager.Customers to manage')}
                </span>
              </div>
            </div>
            <div className='flex flex-col justify-center items-center px-4 mt-2'>
              <div className='w-full h-full'>
                <BarChartHorizontal
                  labels={notManagedCustomersLabels}
                  datasets={notManagedCustomersDataset}
                  titleText={`${t('QueueManager.Total not managed')}: ${totalNotManaged}`}
                  numericTooltip={true}
                />
              </div>
              <div className='overflow-auto  scrollbar-thin scrollbar-thumb-gray-400 dark:scrollbar-thumb-gray-400 scrollbar-thumb-rounded-full scrollbar-thumb-opacity-50 scrollbar-track-gray-200 dark:scrollbar-track-gray-900 scrollbar-track-rounded-full scrollbar-track-opacity-25 mt-4 max-h-56 w-full'>
                <ul
                  role='list'
                  className='bg-cardBackgroud dark:bg-cardBackgroudDark text-sm'
                >
                  <li className='sticky top-0 z-10 grid grid-cols-3 items-center gap-x-4 rounded-md bg-gray-100 dark:bg-gray-700 px-4 py-3 font-semibold'>
                    <div>{t('QueueManager.Date')}</div>
                    <div>{t('QueueManager.Caller')}</div>
                    <div className='text-right'>{t('QueueManager.Outcome')}</div>
                  </li>
                  {isLoadedQueuesNotManaged && calls.count === 0 && (
                    <EmptyState
                      title={t('QueueManager.No customers to manage')}
                      description={t('QueueManager.There are no customers to manage') || ''}
                      icon={
                        <FontAwesomeIcon
                          icon={faUser}
                          className='mx-auto h-12 w-12'
                          aria-hidden='true'
                        />
                      }
                    ></EmptyState>
                  )}
                  {/* skeleton */}
                  {!isLoadedQueuesNotManaged &&
                    Array.from(Array(6)).map((e, index) => (
                      <li key={index}>
                        <div className='flex items-center py-4'>
                          {/* avatar skeleton */}
                          <div className='min-w-0 flex-1 px-2 py-2'>
                            <div className='flex flex-col justify-center'>
                              {/* line skeleton */}
                              <div className='animate-pulse h-3 rounded bg-gray-300 dark:bg-gray-600'></div>
                            </div>
                          </div>
                        </div>
                      </li>
                    ))}
                  {isLoadedQueuesNotManaged &&
                    calls?.rows?.map((call: any, index: number) => (
                      <li
                        key={index}
                        className={classNames(
                          'grid grid-cols-3 items-center gap-x-4 px-4 py-3',
                          // divider between rows, not between the header and the first one
                          index > 0 && 'border-t border-gray-200 dark:border-gray-700',
                        )}
                      >
                        {/* time */}
                        <div>
                          <div className='flex flex-col'>
                            <div>{formatDateLoc(call.time * 1000, 'PP')}</div>
                            <div className='text-gray-500 dark:text-gray-500'>
                              {getCallTimeToDisplay(call.time * 1000)}
                            </div>
                          </div>
                        </div>

                        {/* name / number */}
                        <div className='min-w-0 truncate'>
                          {call.name && (
                            <div
                              onClick={() =>
                                openShowQueueCallDrawer(call, queueManagerStore.queues)
                              }
                            >
                              <span
                                className={classNames(call.cid && 'cursor-pointer hover:underline')}
                              >
                                {call.name}
                              </span>
                            </div>
                          )}
                          <div
                            onClick={() => openShowQueueCallDrawer(call, queueManagerStore.queues)}
                            className={classNames(call.name && 'text-gray-500 dark:text-gray-500')}
                          >
                            <span className='cursor-pointer hover:underline'>{call.cid}</span>
                          </div>
                        </div>

                        {/* outcome */}
                        <div className='whitespace-nowrap'>
                          <div className='flex items-center justify-end'>
                            <span
                              data-tooltip-id='tooltip-outcome-value'
                              data-tooltip-content={t(`Queues.outcome_${call.event}`) || ''}
                            >
                              {getCallIcon(call)}
                            </span>
                          </div>
                        </div>
                      </li>
                    ))}
                </ul>
                <CustomThemedTooltip id='tooltip-outcome-value' place='left' />
              </div>
            </div>
            <div className='pt-6 pb-4 px-2'>
              <Link
                href={{
                  pathname: '/queuemanager',
                  query: { section: 'Customers management' },
                }}
              >
                <Button variant='ghost'>
                  <span>{t('QueueManager.Go to not managed customers')}</span>
                  <FontAwesomeIcon icon={faArrowRight} className='h-4 w-4 ml-2' aria-hidden='true' />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

QueueManagementChart.displayName = 'QueueManagementChart'
