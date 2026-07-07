// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { FC, ComponentProps, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { RootState } from '../../../store'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useSelector } from 'react-redux'
import {
  initTopSparklineChartsData,
  initHourlyChartsDataPerQueues,
  groupDataByHour,
  groupDataByHourLineChart,
  getRandomColor,
  groupDataByHourLineCallsChart,
  groupDataFailedCallsHourLineChart,
  getRandomColorDark,
} from '../../../lib/queueManager'
import LineChart from '../../chart/LineChart'
import BarChart from '../../chart/BarChart'
import { Button } from '../../common'

import { faExpand } from '@fortawesome/free-solid-svg-icons'
import { isEmpty } from 'lodash'
import { formatInTimeZoneLoc } from '../../../lib/dateTime'
import { EMERALD_500, GRAY_500, RED_500 } from '../../../lib/colors'

export interface QueueManagerDashboardChartProps extends ComponentProps<'div'> {
  isLoadedQueuesHistory: any
  queuesHistory: any
  queuesList: any
  isLoadedQueues: any
  notManaged: any
}

function classNames(...classes: any) {
  return classes.filter(Boolean).join(' ')
}

export const QueueManagerDashboardChart: FC<QueueManagerDashboardChartProps> = ({
  className,
  isLoadedQueuesHistory,
  queuesHistory,
  queuesList,
  isLoadedQueues,
  notManaged,
}): JSX.Element => {
  const { t } = useTranslation()

  const [labelsOutcome, setLabelsOutcome] = useState<any>([])
  const [datasetsOutcome, setDatasetsOutcome] = useState<any>([])

  const [labelsCallsHour, setLabelsCallsHour] = useState<any>([])
  const [datasetsCallsHour, setDatasetsCallsHour] = useState<any>([])

  const [labelsNotManaged, setLabelsNotManaged] = useState<any>([])
  const [datasetsNotManaged, setDatasetsNotManaged] = useState<any>([])

  const [labelsIncomingCallsHour, setLabelsIncomingCallsHour] = useState<any>([])
  const [datasetsIncomingCallsHour, setDatasetsIncomingCallsHour] = useState<any>([])

  const [labelsFailedCallsHour, setLabelsFailedCallsHour] = useState<any>([])
  const [datasetsFailedCallsHour, setDatasetsFailedCallsHour] = useState<any>([])

  const queueManagerStore = useSelector((state: RootState) => state.queueManagerQueues)
  const { theme } = useSelector((state: RootState) => state.darkTheme)

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
      //   extractStartHourNotManaged(groupedNotManagedWithConvertedTimeState)
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
      creationLineChartCallsHour(hourlydistribution?.lineTotal)
      creationIncomingCallsHour(hourlydistribution?.stacked)
      creationFailedCallsHour(hourlydistribution?.lineFailed)
      creationBarChartNotManaged(groupedNotManagedWithConvertedTimeState)
    }
  }, [dashboardData, isLoadedQueuesHistory, queuesHistory, queuesList])

  const creationBarChart = (chartValue: any) => {
    let groupedChartInformation = groupDataByHour(chartValue)
    const labels = Object.keys(groupedChartInformation)
    setLabelsOutcome(labels)

    const datasets = [
      {
        label: 'Answered',
        data: [] as number[],
        backgroundColor:
          theme === 'dark' ||
          (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
            ? EMERALD_500
            : EMERALD_500,
        borderColor: '#b91c1c',
        borderRadius: 5,
      },
      {
        label: 'Failed',
        data: [] as number[],
        backgroundColor:
          theme === 'dark' ||
          (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
            ? GRAY_500
            : GRAY_500,
        borderRadius: 5,
      },
      {
        label: 'Invalid',
        data: [] as number[],
        backgroundColor:
          theme === 'dark' ||
          (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
            ? RED_500
            : RED_500,
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

  //   line chart hourly distribution of not managed calls
  const creationBarChartNotManaged = (chartValue: any) => {
    if (!Array.isArray(chartValue)) {
      return
    }

    const datasets: {
      label: string
      data: { label: string; value: number }[]
      backgroundColor: string
      borderRadius: number
    }[] = []

    Object.keys(queueManagerStore.queues).forEach((queue) => {
      datasets.push({
        label: queueManagerStore.queues[queue].name,
        data: [],
        backgroundColor:
          theme === 'dark' ||
          (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
            ? getRandomColor(datasets?.length)
            : getRandomColorDark(datasets?.length),
        borderRadius: 5,
      })
    })

    chartValue.forEach((entry: any) => {
      const { topic, dates } = entry

      dates.forEach((dateItem: any) => {
        const { date, value } = dateItem
        const roundedTime = date.split('-')[3] + ':30'

        const matchingDataset = datasets.find(
          (dataset) => dataset.label === queueManagerStore.queues[topic].name,
        )

        if (matchingDataset) {
          const existingIndex = matchingDataset.data.findIndex(
            (dataItem) => dataItem.label === roundedTime,
          )

          if (existingIndex === -1) {
            matchingDataset.data.push({ label: roundedTime, value })
          } else {
            matchingDataset.data[existingIndex].value += value
          }
        }
      })
    })

    datasets.forEach((dataset) => {
      dataset.data.sort((a, b) => a.label.localeCompare(b.label))
    })

    setLabelsNotManaged(datasets[0].data.map((dataItem) => dataItem.label))
    setDatasetsNotManaged(datasets)
  }

  //line chart hourly distribution of incoming calls
  const creationLineChartCallsHour = (chartValue: any) => {
    const groupedLineChartInformation = groupDataByHourLineChart(chartValue)
    const labels = Object.keys(groupedLineChartInformation)

    let hours: any

    for (const label of labels) {
      if (Object.keys(groupedLineChartInformation[label]).length > 0) {
        hours = Object.keys(groupedLineChartInformation[label])
        break
      }
    }
    setLabelsCallsHour(hours)

    const datasets = labels.map((label, index) => {
      const randomColor = getRandomColor(index)
      const data = hours.map((hour: any) => groupedLineChartInformation[label][hour])

      return {
        label: label,
        data: data,
        backgroundColor: randomColor,
        borderRadius: 5,
        tension: 0.4,
        fill: true,
      }
    })

    setDatasetsCallsHour(datasets)
  }

  //line chart incoming call hours
  const creationIncomingCallsHour = (chartValue: any) => {
    const groupedLineChartCallsHourInformation = groupDataByHourLineCallsChart(chartValue)

    const labels = Object.keys(groupedLineChartCallsHourInformation)
    //first label should keep all the hours values

    let hours: any

    for (const label of labels) {
      if (Object.keys(groupedLineChartCallsHourInformation[label]).length > 0) {
        hours = Object.keys(groupedLineChartCallsHourInformation[label])
        break
      }
    }

    setLabelsIncomingCallsHour(hours)

    const datasets = labels.map((label, index) => {
      const randomColor = getRandomColor(index)
      const data = hours.map((hour: any) => groupedLineChartCallsHourInformation[label][hour])
      return {
        label: label,
        data: data,
        backgroundColor: randomColor,
        borderRadius: 5,
        tension: 0.4,
        fill: true,
      }
    })

    setDatasetsIncomingCallsHour(datasets)
  }

  //line chart failed call hours
  const creationFailedCallsHour = (chartValue: any) => {
    const groupedLineChartInformation = groupDataFailedCallsHourLineChart(chartValue)
    const labels = Object.keys(groupedLineChartInformation)
    //first label should keep all the hours values
    let hours: any

    for (const label of labels) {
      if (Object.keys(groupedLineChartInformation[label]).length > 0) {
        hours = Object.keys(groupedLineChartInformation[label])
        break
      }
    }
    setLabelsFailedCallsHour(hours)

    const datasets = labels.map((label, index) => {
      const randomColor = getRandomColor(index)
      const data = hours.map((hour: any) => groupedLineChartInformation[label][hour])
      return {
        label: label,
        data: data,
        backgroundColor: randomColor,
        borderRadius: 5,
        tension: 0.4,
        fill: true,
      }
    })

    setDatasetsFailedCallsHour(datasets)
  }

  const [groupedNotManagedWithConvertedTimeState, setGroupedNotManagedWithConvertedTimeState] =
    useState({})

  const formatDate = (date: Date) => {
    return formatInTimeZoneLoc(date, 'dd-MMMM-yy-HH:mm', 'UTC')
  }

  useEffect(() => {
    if (!isEmpty(notManaged)) {
      const queuesMap: { [key: string]: any } = {}

      notManaged.rows.forEach((item: any) => {
        const { queuename, time } = item
        const timestampInSeconds = Number(time)
        const timestampInMilliseconds = timestampInSeconds * 1000
        const timestampWith2HoursAdded = timestampInMilliseconds + 2 * 60 * 60 * 1000

        const convertedTime = formatInTimeZoneLoc(
          new Date(timestampWith2HoursAdded),
          "yyyy-MM-dd'T'HH:mm:ss",
          'UTC',
        )

        const topicInfo = queueManagerStore.queues[queuename]
        const topicName = topicInfo ? topicInfo.name : ''

        const dateObj = new Date(convertedTime)
        const roundedTime = new Date(
          dateObj.getFullYear(),
          dateObj.getMonth(),
          dateObj.getDate(),
          dateObj.getHours(),
          Math.round(dateObj.getMinutes() / 30) * 30,
        ).toISOString()

        if (!queuesMap[queuename]) {
          queuesMap[queuename] = {
            topic: queuename,
            topicName: topicName,
            dates: {},
          }
        }

        if (!queuesMap[queuename].dates[roundedTime]) {
          queuesMap[queuename].dates[roundedTime] = {
            value: 1,
            date: formatDate(new Date(timestampWith2HoursAdded)),
            fullDate: roundedTime,
          }
        } else {
          queuesMap[queuename].dates[roundedTime].value += 1
        }
      })

      const groupedNotManagedWithConvertedTime: any[] = Object.values(queuesMap).map(
        (queueData: any) => {
          queueData.dates = Object.values(queueData.dates)
          return queueData
        },
      )

      setGroupedNotManagedWithConvertedTimeState(groupedNotManagedWithConvertedTime)
    }
  }, [notManaged, queueManagerStore.queues])

  const [notManagedStart, setNotManagedStart] = useState<any>(0)

  return (
    <>
      <div className='grid grid-cols-1 gap-4 sm:grid-cols-1 lg:grid-cols-2'>
        {/* Hourly distribution of incoming calls section*/}
        <div className={`pt-8 ${zoomedCardIndices.includes(0) ? 'col-span-2' : 'col-span-1'}`}>
          {/* title */}
          <h2 className='text-base ml-4 font-semibold mb-4'>
            {t('QueueManager.Hourly distribution of incoming calls')}
          </h2>

          <div className='border-b rounded-md shadow-md bg-cardBackgroud dark:bg-cardBackgroudDark border-gray-200 dark:border-gray-700 px-4 py-5 sm:px-6 mt-1 relative w-full min-h-full'>
            <div className='flex space-x-3 h-96'>
              <div className='min-w-0 flex-1 '>
                <LineChart labels={labelsCallsHour} datasets={datasetsCallsHour} />
              </div>
            </div>
            {/* Zoom button */}
            <div className='absolute top-2 right-2 pt-3 pr-3'>
              <Button
                className='h-10 w-10 flex items-center justify-center rounded-md'
                variant='white'
                onClick={() => handleZoom(0)}
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

        {/* Hourly distribution of call results */}
        <div
          className={`pt-8 ${zoomedCardIndices.includes(1) ? 'col-span-2 ' : 'col-span-1'} ${
            zoomedCardIndices.includes(0) ? 'mt-4' : ''
          }`}
        >
          {/* title */}
          <h2 className='text-base ml-4 font-semibold mb-4'>
            {t('QueueManager.Hourly distribution of call results')}
          </h2>

          <div className='border-b rounded-md shadow-md bg-cardBackgroud dark:bg-cardBackgroudDark border-gray-200 dark:border-gray-700 px-4 py-5 sm:px-6 mt-1 relative w-full h-full'>
            <div className='flex space-x-3 h-96'>
              <div className='flex-1 w-full'>
                {/* ... */}
                <BarChart labels={labelsCallsHour} datasets={datasetsOutcome} />
              </div>
            </div>
            {/* Zoom button */}
            <div className='absolute top-2 right-2 pt-3 pr-3'>
              <Button
                className='h-10 w-10 flex items-center justify-center rounded-md'
                variant='white'
                onClick={() => handleZoom(1)}
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

        {/* Hourly distribution of calls answered*/}
        <div className={`pt-12 ${zoomedCardIndices.includes(2) ? 'col-span-2' : 'col-span-1'}`}>
          {/* title */}
          <h2 className='text-base ml-4 font-semibold mb-4'>
            {t('QueueManager.Hourly distribution of calls answered')}
          </h2>

          <div className='border-b rounded-md shadow-md bg-cardBackgroud dark:bg-cardBackgroudDark border-gray-200 dark:border-gray-700 px-4 py-5 sm:px-6 mt-1 relative w-full h-full'>
            <div className='flex space-x-3 h-96'>
              <div className='min-w-0 flex-1 '>
                {/* ... */}
                <LineChart labels={labelsIncomingCallsHour} datasets={datasetsIncomingCallsHour} />
              </div>
            </div>
            {/* Zoom button */}
            <div className='absolute top-2 right-2 pt-3 pr-3'>
              <Button
                className='h-10 w-10 flex items-center justify-center rounded-md'
                variant='white'
                onClick={() => handleZoom(2)}
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

        {/* Hourly distribution of not answered calls*/}
        <div className={`pt-12 ${zoomedCardIndices.includes(3) ? 'col-span-2' : 'col-span-1'}`}>
          {' '}
          {/* title */}
          <h2 className='text-base ml-4 font-semibold mb-4'>
            {t('QueueManager.Hourly distribution of not answered calls')}
          </h2>
          <div className='border-b rounded-md shadow-md bg-cardBackgroud dark:bg-cardBackgroudDark border-gray-200 dark:border-gray-700 px-4 py-5 sm:px-6 mt-1 relative w-full h-full'>
            <div className='flex space-x-3 h-96'>
              <div className='min-w-0 flex-1 '>
                {/* ... */}
                <LineChart labels={labelsFailedCallsHour} datasets={datasetsFailedCallsHour} />
              </div>
            </div>
            {/* Zoom button */}
            <div className='absolute top-2 right-2 pt-3 pr-3'>
              <Button
                className='h-10 w-10 flex items-center justify-center rounded-md'
                variant='white'
                onClick={() => handleZoom(3)}
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
      </div>
    </>
  )
}

QueueManagerDashboardChart.displayName = 'QueueManagerDashboardChart'
