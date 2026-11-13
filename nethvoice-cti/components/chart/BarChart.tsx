// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { FC } from 'react'
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
import { useSelector } from 'react-redux'
import { RootState } from '../../store'
import { GRAY_200, GRAY_300, GRAY_600, GRAY_700, GRAY_800 } from '../../lib/colors'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

interface BarChartProps {
  labels: string[]
  datasets: any[]
}

const BarChart: FC<BarChartProps> = ({ labels, datasets }) => {
  const { theme } = useSelector((state: RootState) => state.darkTheme)

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: true,
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
        // text: 'Chart.js Bar Chart',
      },
    },
  }

  const data = {
    labels,
    datasets,
  }

  return <Bar data={data} options={options} />
}

export default BarChart
