import React from 'react';
import { FC } from 'react';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Title, Tooltip, Legend } from 'chart.js';

ChartJS.register(ArcElement, Title, Tooltip, Legend);

interface DoughnutChartProps {
  datasets: any[];
  titleText: string;
  total?: number; // Campo opzionale per il valore totale
}

const DoughnutChart: FC<DoughnutChartProps> = ({ datasets, titleText, total }) => {
  // Funzione per sommare i valori di tutti i datasets
  const getTotalValue = () => {
    return datasets.reduce((total: number, dataset: any) => {
      const queueData = dataset.data;
      return total + queueData.reduce((acc: number, value: number) => acc + value, 0);
    }, 0);
  };

  const totalValue = total || getTotalValue();

  const options = {
    responsive: true,
    cutout: '50%',
    plugins: {
      legend: {
        display: false, // Nascondi la legenda
      },
      tooltip: {
        callbacks: {
          title: function (tooltipItem: any) {
            return tooltipItem[0].label;
          },
          label: function (context: any) {
            const value = context.parsed ? context.parsed : 0;
            const queueName = context.dataset.label;
            return `${queueName}: ${value.toFixed(2)}%`;
          },
        },
      },
      title: {
        display: true,
        text: titleText.includes('{total}') ? titleText.replace('{total}', totalValue.toString()) : titleText,        font: {
          size: 16,
        },
      },
    },
  };

  const data = {
    datasets: datasets,
  };

  return <Doughnut data={data} options={options} />;
};

export default DoughnutChart;
