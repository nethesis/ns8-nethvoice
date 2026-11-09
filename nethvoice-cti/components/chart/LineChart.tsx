import React from 'react'
import { FC } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import { useSelector } from 'react-redux'
import { RootState } from '../../store'
import {
  GRAY_200,
  GRAY_300,
  GRAY_600,
  GRAY_700,
  GRAY_800,
} from '../../lib/colors'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
)

interface LineChartProps {
  labels: string[]
  datasets: any[]
}

const LineChart: FC<LineChartProps> = ({ labels, datasets }) => {
  const { theme } = useSelector((state: RootState) => state.darkTheme)

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: true,
        //Add space at the top of the chart
        grace: '5%',
        ticks: {
          color:
            theme === 'dark' ||
            (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
              ? GRAY_200
              : GRAY_700,
        },
        grid: {
          color:
            theme === 'dark' ||
            (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
              ? GRAY_800
              : GRAY_300,
          z: -1,
        },
      },
      x: {
        ticks: {
          color:
            theme === 'dark' ||
            (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
              ? GRAY_200
              : GRAY_700,
        },
        grid: {
          color:
            theme === 'dark' ||
            (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
              ? GRAY_800
              : GRAY_300,
          z: -1,
        },
      },
    },
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          color:
            theme === 'dark' ||
            (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
              ? GRAY_300
              : GRAY_600,
        },
      },
      title: {
        display: true,
      },
    },
  }

  const data = {
    labels,
    datasets,
  }

  return <Line data={data} options={options} />
}

export default LineChart
