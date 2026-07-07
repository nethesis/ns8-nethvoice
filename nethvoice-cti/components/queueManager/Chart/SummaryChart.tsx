// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { FC, ComponentProps, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Tooltip } from 'react-tooltip'
import { getQueueStats } from '../../../lib/queueManager'

import { faCircleInfo } from '@fortawesome/free-solid-svg-icons'
import BarChartHorizontalNoLabels from '../../chart/HorizontalNoLabel'
import MultipleInformationChart from '../../chart/MultipleInformationBarChart'

export interface SummaryChartProps extends ComponentProps<'div'> {
  selectedQueues: any
}

function classNames(...classes: any) {
  return classes.filter(Boolean).join(' ')
}

export const SummaryChart: FC<SummaryChartProps> = ({ className, selectedQueues }): JSX.Element => {
  const { t } = useTranslation()

  const [firstRenderQueuesStats, setFirstRenderQueuesStats]: any = useState(true)
  const [isLoadedQueuesStats, setLoadedQueuesStats] = useState(false)
  const [allQueuesStats, setAllQueuesStats] = useState(false)

  const [queuesStatus, setQueuesStatus] = useState<any>({})

  //get queues status information
  useEffect(() => {
    // Avoid api double calling
    if (firstRenderQueuesStats) {
      setFirstRenderQueuesStats(false)
      return
    }
    async function getQueuesStats() {
      setLoadedQueuesStats(false)
      try {
        setAllQueuesStats(false)
        //get list of queues from queuesList
        const queuesName = selectedQueues
        //get number of queues
        const queuesLength = queuesName.length
        let status = {} as Record<string, any>

        // Get statuses for each queue
        for (let i = 0; i < queuesLength; i++) {
          const key = queuesName[i]
          const res = await getQueueStats(key)
          status[key] = res
        }
        setAllQueuesStats(true)
        setQueuesStatus(status)
      } catch (err) {
        console.error(err)
      }
    }
    if (!isLoadedQueuesStats) {
      getQueuesStats()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstRenderQueuesStats, selectedQueues])

  // selected queues alphabetically ordered
  selectedQueues.sort((a: any, b: any) => parseInt(a) - parseInt(b))

  // Total calls section
  const [datasetsQueues, setDatasetsQueues] = useState<any[]>([])
  const [totalCalls, setTotalCalls] = useState(0)
  const [queueData, setQueueData] = useState<any>(null)

  useEffect(() => {
    const createChartData = () => {
      const newData = []
      let totalValue = 0

      if (queuesStatus) {
        totalValue = selectedQueues.reduce((total: any, queueKey: any) => {
          const queue = queuesStatus[queueKey]
          if (queue) {
            return total + (queue.tot || 0)
          }
          return total
        }, 0)

        for (const queueKey of selectedQueues) {
          const queue = queuesStatus[queueKey]
          if (queue) {
            const queueData = [((queue.tot || 0) / totalValue) * 100]
            const originalData = [queue.tot || 0]
            const colors = ['#059669', '#064E3B', '#E5E7EB']
            const label = `${queue.queueman}`

            newData.push({
              label,
              data: queueData,
              backgroundColor: colors,
              originalData: originalData,
            })
          }
        }

        setDatasetsQueues(newData)
        setTotalCalls(totalValue)

        setQueueData(newData)
      }
    }

    createChartData()
  }, [queuesStatus, selectedQueues])

  // Calls before sla section
  const [datasetsQueuesLessSla, setDatasetsQueuesLessSla] = useState<any[]>([])
  const [totalCallsBeforeLevel, setTotalCallsBeforeLevel] = useState(0)
  const [queueDataBeforeLevel, setQueueDataBeforeLevel] = useState<any>(null)

  useEffect(() => {
    const createChartData = () => {
      const newData = []
      let totalValue = 0

      if (queuesStatus) {
        totalValue = selectedQueues.reduce((total: any, queueKey: any) => {
          const queue = queuesStatus[queueKey]
          if (queue) {
            return total + (queue.processed_less_sla || 0)
          }
          return total
        }, 0)

        for (const queueKey of selectedQueues) {
          const queue = queuesStatus[queueKey]
          if (queue) {
            const queueData = [((queue.processed_less_sla || 0) / totalValue) * 100]
            const originalData = [queue.processed_less_sla || 0]
            const colors = ['#059669', '#064E3B', '#E5E7EB']
            const label = `${queue.queueman}`

            newData.push({
              label,
              data: queueData,
              backgroundColor: colors,
              originalData: originalData,
            })
          }
        }

        setDatasetsQueuesLessSla(newData)
        setTotalCallsBeforeLevel(totalValue)

        setQueueDataBeforeLevel(newData)
      }
    }

    createChartData()
  }, [queuesStatus, selectedQueues])

  // Total calls failed section
  const [datasetsQueuesFailed, setDatasetsQueuesFailed] = useState<any[]>([])
  const [totalCallsFailed, setTotalCallsFailed] = useState(0)
  const [queueDataFailed, setQueueDataFailed] = useState<any>(null)

  useEffect(() => {
    const createChartData = () => {
      const newData = []
      let totalValueFailed = 0

      if (queuesStatus) {
        totalValueFailed = selectedQueues.reduce((total: any, queueKey: any) => {
          const queue = queuesStatus[queueKey]
          if (queue) {
            return total + (queue.tot_failed || 0)
          }
          return total
        }, 0)

        for (const queueKey of selectedQueues) {
          const queue = queuesStatus[queueKey]
          if (queue) {
            const queueData = [((queue.tot_failed || 0) / totalValueFailed) * 100]
            const originalData = [queue.tot_failed || 0]
            const colors = ['#059669', '#064E3B', '#E5E7EB']
            const label = `${queue.queueman}`

            newData.push({
              label,
              data: queueData,
              backgroundColor: colors,
              originalData: originalData,
            })
          }
        }

        setDatasetsQueuesFailed(newData)
        setTotalCallsFailed(totalValueFailed)

        setQueueDataFailed(newData)
      }
    }

    createChartData()
  }, [queuesStatus, selectedQueues])

  // Call back time section
  const [datasetsCallBack, setDatasetsCallBack] = useState<any[]>([])
  const [totalCallBack, setTotalCallBack] = useState(0)
  const [callBack, setCallBack] = useState<any>(null)

  useEffect(() => {
    const createChartData = () => {
      const newData = []
      let totalCallBack = 0

      if (queuesStatus) {
        totalCallBack = selectedQueues.reduce((total: any, queueKey: any) => {
          const queue = queuesStatus[queueKey]
          if (queue) {
            return total + (queue.avg_recall_time || 0)
          }
          return total
        }, 0)

        for (const queueKey of selectedQueues) {
          const queue = queuesStatus[queueKey]
          if (queue) {
            const queueData = [((queue.avg_recall_time || 0) / totalCallBack) * 100]
            const originalData = [queue.avg_recall_time || 0]
            const colors = ['#059669', '#064E3B', '#E5E7EB']
            const label = `${queue.queueman}`

            newData.push({
              label,
              data: queueData,
              backgroundColor: colors,
              originalData: originalData,
            })
          }
        }

        setDatasetsCallBack(newData)
        setTotalCallBack(totalCallBack)

        setCallBack(newData)
      }
    }

    createChartData()
  }, [queuesStatus, selectedQueues])

  // Invalid call section
  const [datasetsInvalidCalls, setDatasetsInvalidCalls] = useState<any[]>([])
  const [totalInvalidCalls, setTotalInvalidCalls] = useState(0)
  const [invalidCalls, setInvalidCalls] = useState<any>(null)

  useEffect(() => {
    const createChartData = () => {
      const newData = []
      let totalInvalid = 0

      if (queuesStatus) {
        totalInvalid = selectedQueues.reduce((total: any, queueKey: any) => {
          const queue = queuesStatus[queueKey]
          if (queue) {
            return total + (queue.tot_null || 0)
          }
          return total
        }, 0)

        for (const queueKey of selectedQueues) {
          const queue = queuesStatus[queueKey]
          if (queue) {
            const queueData = [((queue.tot_null || 0) / totalInvalid) * 100]
            const originalData = [queue.tot_null || 0]
            const colors = ['#059669', '#064E3B', '#E5E7EB']
            const label = `${queue.queueman}`

            newData.push({
              label,
              data: queueData,
              backgroundColor: colors,
              originalData: originalData,
            })
          }
        }

        setDatasetsInvalidCalls(newData)
        setTotalInvalidCalls(totalInvalid)

        setInvalidCalls(newData)
      }
    }

    createChartData()
  }, [queuesStatus, selectedQueues])

  // Failed call section
  const [datasetsFailedCalls, setDatasetsFailedCalls] = useState<any[]>([])
  // const [totalFailedCalls, setTotalFailedCalls] = useState(0)

  useEffect(() => {
    const createChartData = () => {
      const newData = []
      const failureTypes = [
        'failed_inqueue_noagents',
        'failed_withkey',
        'failed_timeout',
        'failed_abandon',
        'failed_full',
        'failed_outqueue_noagents',
      ]

      if (queuesStatus) {
        for (const queueKey of selectedQueues) {
          const queue = queuesStatus[queueKey]
          if (queue) {
            const totalFailedInQueue = failureTypes.reduce(
              (sum, type) => sum + (queue[type] || 0),
              0,
            )
            const queueData = failureTypes.map((type) => queue[type] || 0)
            const colors = ['#059669', '#064E3B', '#E5E7EB']
            const label = queue.queueman

            newData.push({
              label,
              data: queueData,
              backgroundColor: colors,
              originalData: queueData,
              totalFailedInQueue,
            })
          }
        }

        setDatasetsFailedCalls(newData)
      }
    }

    createChartData()
  }, [queuesStatus, selectedQueues])

  // Waiting call section
  const [waitingCalls, setWaitingCalls] = useState<any[]>([])

  useEffect(() => {
    const createChartData = () => {
      const newData = []
      const waitTypes = ['min_wait', 'avg_wait', 'max_wait']

      if (queuesStatus) {
        for (const queueKey of selectedQueues) {
          const queue = queuesStatus[queueKey]
          if (queue) {
            const totalFailedInQueue = waitTypes.reduce((sum, type) => sum + (queue[type] || 0), 0)
            const queueData = waitTypes.map((type) => queue[type] || 0)
            const colors = ['#059669', '#064E3B', '#E5E7EB']
            const label = queue.queueman

            newData.push({
              label,
              data: queueData,
              backgroundColor: colors,
              originalData: queueData,
              totalFailedInQueue,
            })
          }
        }

        setWaitingCalls(newData)
      }
    }

    createChartData()
  }, [queuesStatus, selectedQueues])

  // Duration call section
  const [durationCalls, setDurationCalls] = useState<any[]>([])

  useEffect(() => {
    const createChartData = () => {
      const newData = []
      const durationTypes = ['min_duration', 'avg_duration', 'max_duration']

      if (queuesStatus) {
        for (const queueKey of selectedQueues) {
          const queue = queuesStatus[queueKey]
          if (queue) {
            const totalFailedInQueue = durationTypes.reduce(
              (sum, type) => sum + (queue[type] || 0),
              0,
            )
            const queueData = durationTypes.map((type) => queue[type] || 0)
            const colors = ['#059669', '#064E3B', '#E5E7EB']
            const label = queue.queueman

            newData.push({
              label,
              data: queueData,
              backgroundColor: colors,
              originalData: queueData,
              totalFailedInQueue,
            })
          }
        }

        setDurationCalls(newData)
      }
    }

    createChartData()
  }, [queuesStatus, selectedQueues])

  return (
    <>
      {/* Queues summary */}
      <div className='relative'>
        {/* Dashboard queue active section */}
        <div>
          <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3'>
            {/* Total calls */}
            <div className='pt-8'>
              <div className='flex flex-col border-b rounded-lg shadow-md border-gray-200 dark:border-gray-700 bg-cardBackgroud dark:bg-cardBackgroudDark px-5 py-3 sm:mt-1 relative items-center h-auto w-full'>
                <div className='flex items-center'>
                  <span className='text-sm font-medium leading-6 text-gray-700 dark:text-gray-100'>
                    {t('QueueManager.Total calls')}
                  </span>
                  <div className='flex items-center'>
                    <FontAwesomeIcon
                      icon={faCircleInfo}
                      className='h-5 w-5 pl-2 py-2 flex items-center tooltip-total-calls'
                      aria-hidden='true'
                    />
                    <Tooltip anchorSelect='.tooltip-total-calls' place='right'>
                      {t('QueueManager.SummaryTotalCallChartDescription') || ''}
                    </Tooltip>
                  </div>
                </div>
                <div className='mt-3 mx-auto h-80 w-full overflow-auto  scrollbar-thin scrollbar-thumb-gray-400 dark:scrollbar-thumb-gray-400 scrollbar-thumb-rounded-full scrollbar-thumb-opacity-50 scrollbar-track-gray-200 dark:scrollbar-track-gray-900 scrollbar-track-rounded-full scrollbar-track-opacity-25'>
                  <BarChartHorizontalNoLabels
                    datasets={datasetsQueues}
                    titleText={`${t('QueueManager.Total')}: ${totalCalls}`}
                    queuedata={queueData}
                  />
                </div>
              </div>
            </div>

            {/* Calls answered before service level */}
            <div className='pt-8'>
              <div className='flex flex-col border-b rounded-lg shadow-md border-gray-200 dark:border-gray-700 bg-cardBackgroud dark:bg-cardBackgroudDark px-5 py-3 sm:mt-1 relative items-center h-auto w-full'>
                <div className='flex items-center'>
                  <span className='text-sm font-medium leading-6 text-gray-700 dark:text-gray-100'>
                    {t('QueueManager.Calls answered before service level')}
                  </span>
                  <div className='flex items-center'>
                    <FontAwesomeIcon
                      icon={faCircleInfo}
                      className='h-5 w-5 pl-2 py-2 flex items-center tooltip-answered-before-service'
                      aria-hidden='true'
                    />
                    <Tooltip anchorSelect='.tooltip-answered-before-service' place='left'>
                      {t('QueueManager.SummaryAnsweredBeforeServiceChartDescription') || ''}
                    </Tooltip>
                  </div>
                </div>
                <div className='mt-3 mx-auto h-80 w-full overflow-auto  scrollbar-thin scrollbar-thumb-gray-400 dark:scrollbar-thumb-gray-400 scrollbar-thumb-rounded-full scrollbar-thumb-opacity-50 scrollbar-track-gray-200 dark:scrollbar-track-gray-900 scrollbar-track-rounded-full scrollbar-track-opacity-25'>
                  <BarChartHorizontalNoLabels
                    datasets={datasetsQueuesLessSla}
                    titleText={`${t('QueueManager.Total')}: ${totalCallsBeforeLevel}`}
                    queuedata={queueDataBeforeLevel}
                  />
                </div>
              </div>
            </div>

            {/* Unanswered calls */}
            <div className='pt-8'>
              <div className='flex flex-col border-b rounded-lg shadow-md border-gray-200 dark:border-gray-700 bg-cardBackgroud dark:bg-cardBackgroudDark px-5 py-3 sm:mt-1 relative items-center h-auto w-full'>
                <div className='flex items-center'>
                  <span className='text-sm font-medium leading-6 text-gray-700 dark:text-gray-100'>
                    {t('QueueManager.Unanswered calls')}
                  </span>
                  <div className='flex items-center'>
                    <FontAwesomeIcon
                      icon={faCircleInfo}
                      className='h-5 w-5 pl-2 py-2 cursor-pointer flex items-center tooltip-unanswered'
                      aria-hidden='true'
                    />
                    <Tooltip anchorSelect='.tooltip-unanswered' place='left'>
                      {t('QueueManager.SummaryUnansweredChartDescription') || ''}
                    </Tooltip>
                  </div>
                </div>
                <div className='mt-3 mx-auto h-80 w-full overflow-auto'>
                  <BarChartHorizontalNoLabels
                    datasets={datasetsQueuesFailed}
                    titleText={`${t('QueueManager.Total')}: ${totalCallsFailed}`}
                    queuedata={queueDataFailed}
                  />
                </div>
              </div>
            </div>

            {/* Reasons for unanswered calls */}
            <div className='pt-8'>
              <div className='flex flex-col border-b rounded-lg shadow-md border-gray-200 dark:border-gray-700 bg-cardBackgroud dark:bg-cardBackgroudDark px-5 py-3 sm:mt-1 relative items-center h-auto w-full'>
                <div className='flex items-center'>
                  <span className='text-sm font-medium leading-6 text-gray-700 dark:text-gray-100'>
                    {t('QueueManager.Reasons for unanswered calls')}
                  </span>
                  <div className='flex items-center'>
                    <FontAwesomeIcon
                      icon={faCircleInfo}
                      className='h-5 w-5 pl-2 py-2 cursor-pointer flex items-center tooltip-unanswered-for_reasons'
                      aria-hidden='true'
                    />
                    <Tooltip anchorSelect='.tooltip-unanswered-for_reasons' place='left'>
                      {t('QueueManager.SummaryUnansweredForReasonsChartDescription') || ''}
                    </Tooltip>
                  </div>
                </div>
                <div className='mt-3 mx-auto w-full h-80 overflow-auto  scrollbar-thin scrollbar-thumb-gray-400 dark:scrollbar-thumb-gray-400 scrollbar-thumb-rounded-full scrollbar-thumb-opacity-50 scrollbar-track-gray-200 dark:scrollbar-track-gray-900 scrollbar-track-rounded-full scrollbar-track-opacity-25'>
                  <MultipleInformationChart
                    datasets={datasetsFailedCalls}
                    // titleText={`Total: ${totalFailedCalls}`}
                    failureTypes={[
                      `${t('QueueManager.failed_inqueue_noagents')}`,
                      `${t('QueueManager.failed_withkey')}`,
                      `${t('QueueManager.failed_timeout')}`,
                      `${t('QueueManager.failed_abandon')}`,
                      `${t('QueueManager.failed_full')}`,
                      `${t('QueueManager.failed_outqueue_noagents')}`,
                    ]}
                    isTime={false}
                  />
                </div>
              </div>
            </div>

            {/* Callback time */}
            <div className='pt-8'>
              <div className='flex flex-col border-b rounded-lg shadow-md border-gray-200 dark:border-gray-700 bg-cardBackgroud dark:bg-cardBackgroudDark px-5 py-3 sm:mt-1 relative items-center h-auto w-full'>
                <div className='flex items-center'>
                  <span className='text-sm font-medium leading-6 text-gray-700 dark:text-gray-100'>
                    {t('QueueManager.Callback time')}
                  </span>
                  <div className='flex items-center'>
                    <FontAwesomeIcon
                      icon={faCircleInfo}
                      className='h-5 w-5 pl-2 py-2 cursor-pointer flex items-center tooltip-callback'
                      aria-hidden='true'
                    />
                    <Tooltip anchorSelect='.tooltip-callback' place='left'>
                      {t('QueueManager.Callback time') || ''}
                    </Tooltip>
                  </div>
                </div>
                <div className='mt-3 mx-auto h-80 w-full overflow-auto scrollbar-thin scrollbar-thumb-gray-400 dark:scrollbar-thumb-gray-400 scrollbar-thumb-rounded-full scrollbar-thumb-opacity-50 scrollbar-track-gray-200 dark:scrollbar-track-gray-900 scrollbar-track-rounded-full scrollbar-track-opacity-25'>
                  <BarChartHorizontalNoLabels
                    datasets={datasetsCallBack}
                    titleText={`${t('QueueManager.Total')}: ${totalCallBack}`}
                    queuedata={callBack}
                  />
                </div>
              </div>
            </div>

            {/* Invalid calls */}
            <div className='pt-8'>
              <div className='flex flex-col border-b rounded-lg shadow-md border-gray-200 dark:border-gray-700 bg-cardBackgroud dark:bg-cardBackgroudDark px-5 py-3 sm:mt-1 relative items-center h-auto w-full'>
                <div className='flex items-center'>
                  <span className='text-sm font-medium leading-6 text-gray-700 dark:text-gray-100'>
                    {t('QueueManager.Invalid calls')}
                  </span>
                  <div className='flex items-center'>
                    <FontAwesomeIcon
                      icon={faCircleInfo}
                      className='h-5 w-5 pl-2 py-2 cursor-pointer flex items-center tooltip-invalid-calls'
                      aria-hidden='true'
                    />
                    <Tooltip anchorSelect='.tooltip-invalid-calls' place='left'>
                      {t('QueueManager.SummaryInvalidCallsChartDescription') || ''}
                    </Tooltip>
                  </div>
                </div>
                <div className='mt-3 mx-auto h-80 w-full overflow-auto scrollbar-thin scrollbar-thumb-gray-400 dark:scrollbar-thumb-gray-400 scrollbar-thumb-rounded-full scrollbar-thumb-opacity-50 scrollbar-track-gray-200 dark:scrollbar-track-gray-900 scrollbar-track-rounded-full scrollbar-track-opacity-25'>
                  <BarChartHorizontalNoLabels
                    datasets={datasetsInvalidCalls}
                    titleText={`${t('QueueManager.Total')}: ${totalInvalidCalls}`}
                    queuedata={invalidCalls}
                  />
                </div>
              </div>
            </div>

            {/* Waiting times duration */}
            <div className='pt-8'>
              <div className='flex flex-col border-b rounded-lg shadow-md border-gray-200 dark:border-gray-700 bg-cardBackgroud dark:bg-cardBackgroudDark px-5 py-3 sm:mt-1 relative items-center h-auto w-full'>
                <div className='flex items-center'>
                  <span className='text-sm font-medium leading-6 text-gray-700 dark:text-gray-100'>
                    {t('QueueManager.Waiting times')}
                  </span>
                  <div className='flex items-center'>
                    <FontAwesomeIcon
                      icon={faCircleInfo}
                      className='h-5 w-5 pl-2 py-2 cursor-pointer flex items-center tooltip-waiting-times'
                      aria-hidden='true'
                    />
                    <Tooltip anchorSelect='.tooltip-waiting-times' place='left'>
                      {t('QueueManager.SummaryWaitingTimesChartDescription') || ''}
                    </Tooltip>
                  </div>
                </div>
                <div className='mt-3 mx-auto w-full h-80 overflow-auto scrollbar-thin scrollbar-thumb-gray-400 dark:scrollbar-thumb-gray-400 scrollbar-thumb-rounded-full scrollbar-thumb-opacity-50 scrollbar-track-gray-200 dark:scrollbar-track-gray-900 scrollbar-track-rounded-full scrollbar-track-opacity-25'>
                  <MultipleInformationChart
                    datasets={waitingCalls}
                    failureTypes={[
                      `${t('QueueManager.min_wait')}`,
                      `${t('QueueManager.avg_wait')}`,
                      `${t('QueueManager.max_wait')}`,
                    ]}
                    isTime={true}
                  />
                </div>
              </div>
            </div>

            {/* Calls duration */}
            <div className='pt-8'>
              <div className='flex flex-col border-b rounded-lg shadow-md border-gray-200 dark:border-gray-700 bg-cardBackgroud dark:bg-cardBackgroudDark px-5 py-3 sm:mt-1 relative items-center h-auto w-full'>
                <div className='flex items-center'>
                  <span className='text-sm font-medium leading-6 text-gray-700 dark:text-gray-100'>
                    {t('QueueManager.Calls duration')}
                  </span>
                  <div className='flex items-center'>
                    <FontAwesomeIcon
                      icon={faCircleInfo}
                      className='h-5 w-5 pl-2 py-2 cursor-pointer flex items-center tooltip-calls-duration'
                      aria-hidden='true'
                    />
                    <Tooltip anchorSelect='.tooltip-calls-duration' place='left'>
                      {t('QueueManager.SummaryCallsDurationChartDescription') || ''}
                    </Tooltip>
                  </div>
                </div>
                <div className='mt-3 mx-auto w-full h-80 overflow-auto scrollbar-thin scrollbar-thumb-gray-400 dark:scrollbar-thumb-gray-400 scrollbar-thumb-rounded-full scrollbar-thumb-opacity-50 scrollbar-track-gray-200 dark:scrollbar-track-gray-900 scrollbar-track-rounded-full scrollbar-track-opacity-25'>
                  <MultipleInformationChart
                    datasets={durationCalls}
                    failureTypes={[
                      `${t('QueueManager.min_duration')}`,
                      `${t('QueueManager.avg_duration')}`,
                      `${t('QueueManager.max_duration')}`,
                    ]}
                    isTime={true}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

SummaryChart.displayName = 'SummaryChart'
