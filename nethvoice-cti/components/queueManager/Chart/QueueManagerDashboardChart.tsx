// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { FC, ComponentProps, ReactNode, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  initTopSparklineChartsData,
  initHourlyChartsDataPerQueues,
  groupDataByHour,
  groupDataByHourLineChart,
  getRandomColor,
  groupDataByHourLineCallsChart,
} from '../../../lib/queueManager'
import LineChart from '../../chart/LineChart'
import BarChart from '../../chart/BarChart'
import { Button } from '../../common'

import { faExpand } from '@fortawesome/free-solid-svg-icons'
import { EMERALD_500, GRAY_500, RED_500, RED_700 } from '../../../lib/colors'

export interface QueueManagerDashboardChartProps extends ComponentProps<'div'> {
  isLoadedQueuesHistory: any
  queuesHistory: any
  queuesList: any
  isLoadedQueues: any
}

const buildLineChart = (groupedLineChartInformation: any) => {
  const labels = Object.keys(groupedLineChartInformation)

  let hours: any

  for (const label of labels) {
    if (Object.keys(groupedLineChartInformation[label]).length > 0) {
      hours = Object.keys(groupedLineChartInformation[label])
      break
    }
  }

  const datasets = labels.map((label, index) => ({
    label: label,
    data: hours.map((hour: any) => groupedLineChartInformation[label][hour]),
    backgroundColor: getRandomColor(index),
    borderRadius: 5,
    tension: 0.4,
    fill: true,
  }))

  return { hours, datasets }
}

interface ZoomableChartCardProps {
  title: string
  isZoomed: boolean
  onZoom: () => void
  className: string
  cardHeightClassName: string
  chartClassName: string
  children: ReactNode
}

const ZoomableChartCard: FC<ZoomableChartCardProps> = ({
  title,
  isZoomed,
  onZoom,
  className,
  cardHeightClassName,
  chartClassName,
  children,
}) => (
  <div className={`${className} ${isZoomed ? 'col-span-2' : 'col-span-1'}`}>
    <h2 className='text-base ml-4 font-semibold mb-4'>{title}</h2>

    <div
      className={`border-b rounded-md shadow-md bg-cardBackgroud dark:bg-cardBackgroudDark border-gray-200 dark:border-gray-700 px-4 py-5 sm:px-6 mt-1 relative w-full ${cardHeightClassName}`}
    >
      <div className='flex space-x-3 h-96'>
        <div className={chartClassName}>{children}</div>
      </div>
      <div className='absolute top-2 right-2 pt-3 pr-3'>
        <Button
          className='h-10 w-10 flex items-center justify-center rounded-md'
          variant='white'
          onClick={onZoom}
        >
          <FontAwesomeIcon
            icon={faExpand}
            className='h-6 w-6 cursor-pointer text-gray-500 dark:text-gray-400'
            aria-hidden='true'
          />
        </Button>
      </div>
    </div>
  </div>
)

export const QueueManagerDashboardChart: FC<QueueManagerDashboardChartProps> = ({
  className,
  isLoadedQueuesHistory,
  queuesHistory,
  queuesList,
  isLoadedQueues,
}): JSX.Element => {
  const { t } = useTranslation()

  const [datasetsOutcome, setDatasetsOutcome] = useState<any>([])

  const [labelsCallsHour, setLabelsCallsHour] = useState<any>([])
  const [datasetsCallsHour, setDatasetsCallsHour] = useState<any>([])

  const [labelsIncomingCallsHour, setLabelsIncomingCallsHour] = useState<any>([])
  const [datasetsIncomingCallsHour, setDatasetsIncomingCallsHour] = useState<any>([])

  const [labelsFailedCallsHour, setLabelsFailedCallsHour] = useState<any>([])
  const [datasetsFailedCallsHour, setDatasetsFailedCallsHour] = useState<any>([])

  //zoom sections
  const [zoomedCardIndices, setZoomedCardIndices] = useState<number[]>([])

  const handleZoom = (index: number) => {
    if (zoomedCardIndices.includes(index)) {
      // Remove index if the card is already zoomed
      setZoomedCardIndices(zoomedCardIndices.filter((i) => i !== index))
    } else {
      // Add index if the card is not zoomed
      setZoomedCardIndices([...zoomedCardIndices, index])
    }
  }

  const [dashboardData, setDashboardData] = useState<any>(0)

  //Get start hours for graphs

  const extractStartHour = (totalizedData: any) => {
    let beginTime = 0
    for (var h in totalizedData.total) {
      if (totalizedData.total[h].value > 0) {
        beginTime = new Date(totalizedData.total[h].fullDate).getTime() - 3600000

        setDashboardData(beginTime)
        break
      }
    }

    for (var c in totalizedData) {
      for (var h in totalizedData[c]) {
        if (new Date(totalizedData[c][h].fullDate).getTime() < beginTime) {
          delete totalizedData[c][h]
        }
      }
    }

    return totalizedData
  }

  useEffect(() => {
    if (isLoadedQueuesHistory && queuesHistory && queuesList) {
      let totalChartsData = initTopSparklineChartsData(queuesHistory)
      extractStartHour(totalChartsData)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoadedQueuesHistory, queuesHistory, queuesList, isLoadedQueues])

  useEffect(() => {
    if (isLoadedQueuesHistory && queuesHistory && queuesList && dashboardData !== 0) {
      let hourlydistribution = initHourlyChartsDataPerQueues(
        queuesHistory,
        dashboardData,
        queuesList,
      )

      creationBarChart(hourlydistribution?.stackedBarComparison)

      const callsHour = buildLineChart(groupDataByHourLineChart(hourlydistribution?.lineTotal))
      setLabelsCallsHour(callsHour.hours)
      setDatasetsCallsHour(callsHour.datasets)

      const incomingCallsHour = buildLineChart(
        groupDataByHourLineCallsChart(hourlydistribution?.stacked),
      )
      setLabelsIncomingCallsHour(incomingCallsHour.hours)
      setDatasetsIncomingCallsHour(incomingCallsHour.datasets)

      const failedCallsHour = buildLineChart(
        groupDataByHourLineChart(hourlydistribution?.lineFailed),
      )
      setLabelsFailedCallsHour(failedCallsHour.hours)
      setDatasetsFailedCallsHour(failedCallsHour.datasets)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dashboardData, isLoadedQueuesHistory, queuesHistory, queuesList])

  const creationBarChart = (chartValue: any) => {
    let groupedChartInformation = groupDataByHour(chartValue)
    const labels = Object.keys(groupedChartInformation)

    const datasets = [
      {
        label: 'Answered',
        data: [] as number[],
        backgroundColor: EMERALD_500,
        borderColor: RED_700,
        borderRadius: 5,
      },
      {
        label: 'Failed',
        data: [] as number[],
        backgroundColor: GRAY_500,
        borderRadius: 5,
      },
      {
        label: 'Invalid',
        data: [] as number[],
        backgroundColor: RED_500,
        borderRadius: 5,
      },
    ]

    labels.forEach((label) => {
      const data = groupedChartInformation[label]
      datasets[0].data.push(data.answered)
      datasets[1].data.push(data.failed)
      datasets[2].data.push(data.invalid)
    })

    setDatasetsOutcome(datasets)
  }

  return (
    <>
      <div className='grid grid-cols-1 gap-4 sm:grid-cols-1 lg:grid-cols-2'>
        <ZoomableChartCard
          title={t('QueueManager.Hourly distribution of incoming calls')}
          isZoomed={zoomedCardIndices.includes(0)}
          onZoom={() => handleZoom(0)}
          className='pt-8'
          cardHeightClassName='min-h-full'
          chartClassName='min-w-0 flex-1 '
        >
          <LineChart labels={labelsCallsHour} datasets={datasetsCallsHour} />
        </ZoomableChartCard>

        <ZoomableChartCard
          title={t('QueueManager.Hourly distribution of call results')}
          isZoomed={zoomedCardIndices.includes(1)}
          onZoom={() => handleZoom(1)}
          className={`pt-8${zoomedCardIndices.includes(0) ? ' mt-4' : ''}`}
          cardHeightClassName='h-full'
          chartClassName='flex-1 w-full'
        >
          <BarChart labels={labelsCallsHour} datasets={datasetsOutcome} />
        </ZoomableChartCard>

        <ZoomableChartCard
          title={t('QueueManager.Hourly distribution of calls answered')}
          isZoomed={zoomedCardIndices.includes(2)}
          onZoom={() => handleZoom(2)}
          className='pt-12'
          cardHeightClassName='h-full'
          chartClassName='min-w-0 flex-1 '
        >
          <LineChart labels={labelsIncomingCallsHour} datasets={datasetsIncomingCallsHour} />
        </ZoomableChartCard>

        <ZoomableChartCard
          title={t('QueueManager.Hourly distribution of not answered calls')}
          isZoomed={zoomedCardIndices.includes(3)}
          onZoom={() => handleZoom(3)}
          className='pt-12'
          cardHeightClassName='h-full'
          chartClassName='min-w-0 flex-1 '
        >
          <LineChart labels={labelsFailedCallsHour} datasets={datasetsFailedCallsHour} />
        </ZoomableChartCard>
      </div>
    </>
  )
}

QueueManagerDashboardChart.displayName = 'QueueManagerDashboardChart'
