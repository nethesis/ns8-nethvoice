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
import ChartDataLabels from 'chartjs-plugin-datalabels'
import { convertToHumanReadable } from '../../lib/queueManager'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

interface MultipleInformationChartProps {
  datasets: any[]
  // titleText: string
  failureTypes: string[]
  isTime: boolean
}

const MultipleInformationChart: FC<MultipleInformationChartProps> = ({
  datasets,
  // titleText,
  failureTypes,
  isTime,
}) => {
  const categoryColors = [
    '#fdba74',
    '#fcd34d',
    '#fca5a5',
    'rgba(8, 145, 178, 0.5)',
    'rgba(71, 85, 105, 0.5)',
    'rgba(75, 85, 99, 0.5)',
  ]

  // Delete empty category
  const filteredFailureTypes = failureTypes.filter((type) => {
    const totalValues = datasets.reduce(
      (sum, dataset) => sum + dataset.data[failureTypes.indexOf(type)],
      0,
    )
    return totalValues > 0
  })

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
          stepSize: 0.5,
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
        display: true,
        // display: false,
        position: 'top' as const,
        labels: {
          usePointStyle: true,
        },
      },
      tooltip: {
        callbacks: {
          label: function (context: any) {
            if (!isTime) {
              const value = context.raw
              return `${context.dataset.label}: ${value}`
            } else {
              const formattedValue = convertToHumanReadable(context.raw)
              return `${context.dataset.label}: ${(formattedValue)}`
            }
          },
          title: function () {
            return ''
          },
        },
      },
      title: {
        display: false,
        // text: titleText,
        font: {
          size: 16,
        },
      },
      datalabels: {
        color: 'white',
        font: {
          size: 10,
        },
        display: (context: any) => !isTime && context.raw !== 0,
      },
    },
    maxBarThickness: 50,
  }

  const data = {
    labels: datasets.map((dataset) => dataset.label),
    datasets: filteredFailureTypes.map((type, index) => ({
      label: type,
      // minBarLength:25,
      // if not empty show value else empty space
      data: datasets.map((dataset) => dataset.data[failureTypes.indexOf(type)] || ''),
      backgroundColor: categoryColors[index],
    })),
  }

  return (
    <div style={{ height: '600px' }}>
      <Bar data={data} plugins={[ChartDataLabels]} options={options} />
    </div>
  )
}

export default MultipleInformationChart
