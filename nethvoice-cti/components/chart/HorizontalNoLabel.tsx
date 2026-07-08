import React, { FC } from 'react'
import { Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'
import { getRandomColor } from '../../lib/queueManager'
import ChartDataLabels from 'chartjs-plugin-datalabels'
import {
  GRAY_200,
  GRAY_700,
} from '../../lib/colors'
import { useSelector } from 'react-redux'
import { RootState } from '../../store'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

interface BarChartHorizontalNoLabelsProps {
  datasets: any[]
  titleText: string
  queuedata: any
}

const BarChartHorizontalNoLabels: FC<BarChartHorizontalNoLabelsProps> = ({
  datasets,
  titleText,
  queuedata,
}) => {
  const { theme } = useSelector((state: RootState) => state.darkTheme)
  const validQueueData = queuedata || []

  const queueDataMap: { [label: string]: any } = {}
  if (Array.isArray(validQueueData)) {
    validQueueData.forEach((data) => {
      queueDataMap[data.label] = data
    })
  }

  const options = {
    indexAxis: 'y' as const,
    responsive: true,
    maintainAspectRatio: false,
    elements: {
      bar: {
        borderWidth: 0,
        borderRadius: 10,
      },
    },
    scales: {
      y: {
        display: true,

        beginAtZero: true,
        grid: {
          display: false,
        },
        border: {
          display: false,
        },
        ticks: {
          stepSize: 2,
          font: {
            size: 14,
          },
          color:
          theme === 'dark' ||
          (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
            ? GRAY_200
            : GRAY_700,
        },
      },
      x: {
        display: false,
        grid: {
          display: false,
        },
      },
    },
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: function (context: any) {
            const value = context.parsed ? context.parsed : 0
            // return `${value.y}: ${value.x.toFixed(2)}%`;
            return `${value.x.toFixed(2)}%`
          },
        },
      },
      title: {
        display: true,
        text: titleText,
        font: {
          size: 16,
        },
        color:
        theme === 'dark' ||
        (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
          ? GRAY_200
          : GRAY_700,
      },
      datalabels: {
        color: 'white',
        font: {
          size: 14,
        },
        formatter: (value: any, context: any) => {
          const queueLabel = context.chart.data.labels[context.dataIndex]
          const queueData = queueDataMap[queueLabel]

          if (queueData) {
            // if not empty show value else empty space
            const originalValue = queueData.originalData[0] || ''
            return originalValue.toString()
          }

          return ''
        },
        display: 'auto',
      },
    },
    //max height for graph bars
    maxBarThickness: 50,
  }

  const data = {
    labels: datasets.map((dataset) => dataset.label),
    datasets: [
      {
        data: datasets.map((dataset) => dataset.data[0]),
        backgroundColor: datasets.map((dataset, index) => getRandomColor(index)),
      },
    ],
  }

  return <Bar data={data} plugins={[ChartDataLabels]} options={options} />
}

export default BarChartHorizontalNoLabels
