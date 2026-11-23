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
import {
  GRAY_200,
  GRAY_300,
  GRAY_600,
  GRAY_700,
} from '../../lib/colors'
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

interface BarChartHorizontalWithTitleProps {
  labels: string[]
  datasets: any[]
  titleText?: string
}

const BarChartHorizontalWithTitle: FC<BarChartHorizontalWithTitleProps> = ({
  labels,
  datasets,
  titleText,
}) => {
  const { theme } = useSelector((state: RootState) => state.darkTheme)
  const options = {
    indexAxis: 'y' as const,
    responsive: true,
    maintainAspectRatio: false,
    elements: {
      bar: {
        borderWidth: 0,
      },
    },
    scales: {
      y: {
        beginAtZero: true,

        grid: {
          display: false,
        },
        border: {
          display: false,
        },
        ticks: {
          stepSize: 2,
          color:
            theme === 'dark' ||
            (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
              ? GRAY_200
              : GRAY_700,
          font: {
            size: 14,
          },
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
        position: 'bottom' as const,
        display: false,
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
        text: titleText,
        font: {
          size: 16,
        },
        color:
            theme === 'dark' ||
            (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
              ? GRAY_300
              : GRAY_600,
        padding: {
          top: 0,
          bottom: 4,
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

export default BarChartHorizontalWithTitle
