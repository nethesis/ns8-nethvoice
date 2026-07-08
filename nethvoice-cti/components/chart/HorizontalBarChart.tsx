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
import { convertToHumanReadable } from '../../lib/queueManager'
import { GRAY_200, GRAY_700 } from '../../lib/colors'
import { useSelector } from 'react-redux'
import { RootState } from '../../store'
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

interface BarChartHorizontalProps {
  labels: string[]
  datasets: any[]
  titleText: string
  numericTooltip: boolean
}

const BarChartHorizontal: FC<BarChartHorizontalProps> = ({
  labels,
  datasets,
  titleText,
  numericTooltip,
}) => {
  const { theme } = useSelector((state: RootState) => state.darkTheme)

  const options = {
    indexAxis: 'y' as const,
    elements: {
      bar: {
        borderWidth: 1,
      },
    },
    scales: {
      y: {
        display: false,
        stacked: true,
      },
      x: {
        display: false,
      },
    },
    responsive: true,
    layout: {
      padding: {
        top: 0,
        bottom: 0,
        right: 0,
      },
    },
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          usePointStyle: true,
          color:
            theme === 'dark' ||
            (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
              ? GRAY_200
              : GRAY_700,
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
      tooltip: {
        callbacks: {
          label: (context: any) => {
            const originalValue = context.dataset.data[context.dataIndex]
            const formattedValue = numericTooltip
              ? originalValue
              : convertToHumanReadable(originalValue)
            return `${context.dataset.label}: ${formattedValue}`
          },
        },
      },
    },
  }

  const data = {
    labels,
    datasets,
  }

  return <Bar data={data} options={options} />
}

export default BarChartHorizontal
