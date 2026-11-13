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

// the default positioner averages every active bar: with overlapping bars the tooltip
// lands between the segments instead of on the hovered one
;(Tooltip.positioners as any).cursor = (_elements: any, eventPosition: any) => eventPosition

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
    // fixed thickness: as a percentage of the plot area, a legend wrapping on two lines
    // made the bar thinner than the others
    datasets: {
      bar: {
        barThickness: 14,
      },
    },
    scales: {
      y: {
        display: false,
        stacked: true,
      },
      x: {
        display: false,
        // the bars overlap from zero: pin the max to the longest one, otherwise every chart
        // rounds its scale up differently and the bars end at different lengths
        min: 0,
        max:
          Math.max(0, ...datasets.map((dataset: any) => Number(dataset?.data?.[0]) || 0)) || 1,
      },
    },
    responsive: true,
    maintainAspectRatio: false,
    // the bars overlap from zero: take every bar under the pointer, the tooltip then keeps
    // the visible one
    interaction: {
      mode: 'point' as const,
      intersect: true,
    },
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
        position: 'cursor' as any,
        // the visible segment is the shortest bar that still reaches the pointer
        filter: (item: any, _index: number, items: any[]) =>
          (Number(item.raw) || 0) === Math.min(...items.map((i: any) => Number(i.raw) || 0)),
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
    // a rounded bar of length zero is still drawn as a thin line: skip empty values
    datasets: datasets.map((dataset: any) => ({
      ...dataset,
      data: (dataset?.data || []).map((value: any) => (Number(value) ? value : null)),
    })),
  }

  // without an explicit height the chart keeps the default aspect ratio and the card
  // becomes as tall as half its width
  const chartHeight = Math.max(110, labels.length * 42 + 60)

  return (
    <div style={{ height: `${chartHeight}px` }}>
      <Bar data={data} options={options} />
    </div>
  )
}

export default BarChartHorizontal
