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
import {
  GRAY_200,
  GRAY_300,
  GRAY_600,
  GRAY_700,
} from '../../lib/colors'
import { useSelector } from 'react-redux'
import { RootState } from '../../store'
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

interface BarChartHorizontalNotStackedProps {
  labels: string[]
  datasets: any[]
  tickColor?: string
  titleText?: string
}

const BarChartHorizontalNotStacked: FC<BarChartHorizontalNotStackedProps> = ({
  labels,
  datasets,
  tickColor,
  titleText
}) => {
  const { theme } = useSelector((state: RootState) => state.darkTheme)
  const options = {
    indexAxis: 'y' as const,
    responsive: true,
    maintainAspectRatio: false,
    elements: {
      bar: {
        borderWidth: 1,
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
          stepSize: 1,
          color:
            theme === 'dark' ||
            (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
              ? GRAY_200
              : GRAY_700,
          font:{
            size:14,
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
    layout: {
      padding: {
        right: 0,
      },
    },
    plugins: {
      legend: {
        position: 'bottom' as const,
        display: false,
      },
      title: {
        display: false,
        text: titleText,
        font: {
          size: 16,
        },
        color:
            theme === 'dark' ||
            (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
              ? GRAY_300
              : GRAY_600,
      },
    },
  }

  const data = {
    labels,
    datasets,
  }

  return <Bar data={data} options={options} />
}

export default BarChartHorizontalNotStacked
