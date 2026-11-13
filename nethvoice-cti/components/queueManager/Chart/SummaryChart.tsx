// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { FC, ComponentProps, ReactNode, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { getQueueStats } from '../../../lib/queueManager'
import { QUEUE_CALLS_CHART_COLORS } from '../../../lib/colors'

import { faCircleInfo, faUsers } from '@fortawesome/free-solid-svg-icons'
import { EmptyState } from '../../common'
import { CustomThemedTooltip } from '../../common/CustomThemedTooltip'
import BarChartHorizontalNoLabels from '../../chart/HorizontalNoLabel'
import MultipleInformationChart from '../../chart/MultipleInformationBarChart'

export interface SummaryChartProps extends ComponentProps<'div'> {
  selectedQueues: any
}

const FAILURE_TYPES = [
  'failed_inqueue_noagents',
  'failed_withkey',
  'failed_timeout',
  'failed_abandon',
  'failed_full',
  'failed_outqueue_noagents',
]
const WAIT_TYPES = ['min_wait', 'avg_wait', 'max_wait']
const DURATION_TYPES = ['min_duration', 'avg_duration', 'max_duration']

const buildShareDatasets = (queuesStatus: any, selectedQueues: any, field: string) => {
  const datasets: any[] = []
  const total = selectedQueues.reduce((sum: any, queueKey: any) => {
    const queue = queuesStatus[queueKey]
    return queue ? sum + (queue[field] || 0) : sum
  }, 0)

  for (const queueKey of selectedQueues) {
    const queue = queuesStatus[queueKey]
    if (queue) {
      datasets.push({
        label: `${queue.queueman}`,
        data: [((queue[field] || 0) / total) * 100],
        backgroundColor: [...QUEUE_CALLS_CHART_COLORS],
        originalData: [queue[field] || 0],
      })
    }
  }
  return { datasets, total }
}

const buildBreakdownDatasets = (queuesStatus: any, selectedQueues: any, types: string[]) => {
  const datasets: any[] = []
  for (const queueKey of selectedQueues) {
    const queue = queuesStatus[queueKey]
    if (queue) {
      const values = types.map((type) => queue[type] || 0)
      datasets.push({
        label: queue.queueman,
        data: values,
        backgroundColor: [...QUEUE_CALLS_CHART_COLORS],
        originalData: values,
        totalFailedInQueue: types.reduce((sum, type) => sum + (queue[type] || 0), 0),
      })
    }
  }
  return datasets
}

interface SummaryChartCardProps {
  title: string
  tooltipId: string
  tooltipText: string
  tooltipPlace: 'left' | 'right'
  isIconPointer?: boolean
  children: ReactNode
}

const SummaryChartCard: FC<SummaryChartCardProps> = ({
  title,
  tooltipId,
  tooltipText,
  tooltipPlace,
  isIconPointer = true,
  children,
}) => (
  <div className='pt-8'>
    <div className='flex flex-col border-b rounded-lg shadow-md border-gray-200 dark:border-gray-700 bg-cardBackgroud dark:bg-cardBackgroudDark px-5 py-3 sm:mt-1 relative items-center h-auto w-full'>
      <div className='flex items-center'>
        <span className='text-sm font-medium leading-6 text-gray-700 dark:text-gray-100'>
          {title}
        </span>
        <div className='flex items-center'>
          <FontAwesomeIcon
            icon={faCircleInfo}
            className={`h-5 w-5 pl-2 py-2 ${
              isIconPointer ? 'cursor-pointer ' : ''
            }flex items-center`}
            aria-hidden='true'
            data-tooltip-id={tooltipId}
            data-tooltip-content={tooltipText}
          />
          <CustomThemedTooltip id={tooltipId} place={tooltipPlace} />
        </div>
      </div>
      <div className='mt-3 mx-auto h-80 w-full overflow-auto scrollbar-thin scrollbar-thumb-gray-400 dark:scrollbar-thumb-gray-400 scrollbar-thumb-rounded-full scrollbar-thumb-opacity-50 scrollbar-track-gray-200 dark:scrollbar-track-gray-900 scrollbar-track-rounded-full scrollbar-track-opacity-25'>
        {children}
      </div>
    </div>
  </div>
)

export const SummaryChart: FC<SummaryChartProps> = ({ className, selectedQueues }): JSX.Element => {
  const { t } = useTranslation()

  const [firstRenderQueuesStats, setFirstRenderQueuesStats]: any = useState(true)
  const [isLoadedQueuesStats, setLoadedQueuesStats] = useState(false)

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

  const totalCalls = useMemo(
    () => buildShareDatasets(queuesStatus, selectedQueues, 'tot'),
    [queuesStatus, selectedQueues],
  )
  const callsBeforeLevel = useMemo(
    () => buildShareDatasets(queuesStatus, selectedQueues, 'processed_less_sla'),
    [queuesStatus, selectedQueues],
  )
  const failedCalls = useMemo(
    () => buildShareDatasets(queuesStatus, selectedQueues, 'tot_failed'),
    [queuesStatus, selectedQueues],
  )
  const callBack = useMemo(
    () => buildShareDatasets(queuesStatus, selectedQueues, 'avg_recall_time'),
    [queuesStatus, selectedQueues],
  )
  const invalidCalls = useMemo(
    () => buildShareDatasets(queuesStatus, selectedQueues, 'tot_null'),
    [queuesStatus, selectedQueues],
  )
  const failedReasons = useMemo(
    () => buildBreakdownDatasets(queuesStatus, selectedQueues, FAILURE_TYPES),
    [queuesStatus, selectedQueues],
  )
  const waitingCalls = useMemo(
    () => buildBreakdownDatasets(queuesStatus, selectedQueues, WAIT_TYPES),
    [queuesStatus, selectedQueues],
  )
  const durationCalls = useMemo(
    () => buildBreakdownDatasets(queuesStatus, selectedQueues, DURATION_TYPES),
    [queuesStatus, selectedQueues],
  )

  // without a selected queue there is nothing to chart: eight empty cards would be shown
  if (!selectedQueues?.length) {
    return (
      <div className='pt-8'>
        <EmptyState
          title={t('QueueManager.No queue selected') || ''}
          description={t('QueueManager.Select queue') || ''}
          icon={<FontAwesomeIcon icon={faUsers} className='mx-auto h-12 w-12' aria-hidden='true' />}
        />
      </div>
    )
  }

  const shareCharts = [
    {
      key: 'total-calls',
      title: t('QueueManager.Total calls'),
      tooltip: t('QueueManager.SummaryTotalCallChartDescription'),
      place: 'right' as const,
      isIconPointer: false,
      data: totalCalls,
    },
    {
      key: 'answered-before-service',
      title: t('QueueManager.Calls answered before service level'),
      tooltip: t('QueueManager.SummaryAnsweredBeforeServiceChartDescription'),
      place: 'left' as const,
      isIconPointer: false,
      data: callsBeforeLevel,
    },
    {
      key: 'unanswered',
      title: t('QueueManager.Unanswered calls'),
      tooltip: t('QueueManager.SummaryUnansweredChartDescription'),
      place: 'left' as const,
      data: failedCalls,
    },
  ]

  return (
    <>
      {/* Queues summary */}
      <div className='relative'>
        {/* Dashboard queue active section */}
        <div>
          <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3'>
            {shareCharts.map((chart) => (
              <SummaryChartCard
                key={chart.key}
                title={chart.title}
                tooltipId={`tooltip-summary-${chart.key}`}
                tooltipText={chart.tooltip || ''}
                tooltipPlace={chart.place}
                isIconPointer={chart.isIconPointer}
              >
                <BarChartHorizontalNoLabels
                  datasets={chart.data.datasets}
                  titleText={`${t('QueueManager.Total')}: ${chart.data.total}`}
                  queuedata={chart.data.datasets}
                />
              </SummaryChartCard>
            ))}

            <SummaryChartCard
              title={t('QueueManager.Reasons for unanswered calls')}
              tooltipId='tooltip-summary-unanswered-for-reasons'
              tooltipText={t('QueueManager.SummaryUnansweredForReasonsChartDescription') || ''}
              tooltipPlace='left'
            >
              <MultipleInformationChart
                datasets={failedReasons}
                failureTypes={FAILURE_TYPES.map((type) => `${t(`QueueManager.${type}`)}`)}
                isTime={false}
              />
            </SummaryChartCard>

            <SummaryChartCard
              title={t('QueueManager.Callback time')}
              tooltipId='tooltip-summary-callback'
              tooltipText={t('QueueManager.Callback time') || ''}
              tooltipPlace='left'
            >
              <BarChartHorizontalNoLabels
                datasets={callBack.datasets}
                titleText={`${t('QueueManager.Total')}: ${callBack.total}`}
                queuedata={callBack.datasets}
              />
            </SummaryChartCard>

            <SummaryChartCard
              title={t('QueueManager.Invalid calls')}
              tooltipId='tooltip-summary-invalid-calls'
              tooltipText={t('QueueManager.SummaryInvalidCallsChartDescription') || ''}
              tooltipPlace='left'
            >
              <BarChartHorizontalNoLabels
                datasets={invalidCalls.datasets}
                titleText={`${t('QueueManager.Total')}: ${invalidCalls.total}`}
                queuedata={invalidCalls.datasets}
              />
            </SummaryChartCard>

            <SummaryChartCard
              title={t('QueueManager.Waiting times')}
              tooltipId='tooltip-summary-waiting-times'
              tooltipText={t('QueueManager.SummaryWaitingTimesChartDescription') || ''}
              tooltipPlace='left'
            >
              <MultipleInformationChart
                datasets={waitingCalls}
                failureTypes={WAIT_TYPES.map((type) => `${t(`QueueManager.${type}`)}`)}
                isTime={true}
              />
            </SummaryChartCard>

            <SummaryChartCard
              title={t('QueueManager.Calls duration')}
              tooltipId='tooltip-summary-calls-duration'
              tooltipText={t('QueueManager.SummaryCallsDurationChartDescription') || ''}
              tooltipPlace='left'
            >
              <MultipleInformationChart
                datasets={durationCalls}
                failureTypes={DURATION_TYPES.map((type) => `${t(`QueueManager.${type}`)}`)}
                isTime={true}
              />
            </SummaryChartCard>
          </div>
        </div>
      </div>
    </>
  )
}

SummaryChart.displayName = 'SummaryChart'
