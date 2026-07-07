<script>
import { Line } from "vue-chartjs";
import UtilService from "../services/utils";

export default {
  extends: Line,
  mixins: [UtilService],
  props: {
    type: {
      type: String,
    },
    caption: {
      type: String,
    },
    data: {
      type: Array,
    },
    officeHours: {
      type: Object,
    },
    filterTimeSplit: {
      type: Number,
    },
    styles: {
      type: Object,
      default: function () {
        return {
          height: `22rem`,
          position: "relative",
        };
      },
    },
  },
  data() {
    return {
      labels: [],
      datasets: [],
      chartData: {},
      options: {
        responsive: true,
        maintainAspectRatio: false,
        legend: {
          position: "right",
        },
        plugins: {
          colorschemes: {
            scheme: this.$root.colorScheme,
          },
        },
        scales: {
          yAxes: [
            {
              ticks: {
                callback: (value) => {
                  return this.formatter(value);
                },
              },
            },
          ],
        },
        tooltips: {
          callbacks: {
            label: (tooltipItem, data) => {
              return (
                data.datasets[tooltipItem.datasetIndex].label +
                ": " +
                this.formatter(tooltipItem.value)
              );
            },
          },
        },
      },
    };
  },
  methods: {
    formatter(value) {
      let valuesInfo =
        this.data[0] && this.data[0][2] ? this.data[0][2].split("£") : "";
      let format = valuesInfo[1] ? valuesInfo[1] : "";
      return this.formatValue(value, format, this.$parent.$data.adminSettings.currency);
    },
  },
  watch: {
    data: function () {
      this.watchDataLineOrBarChart(this);
    },
    "$root.colorScheme": function () {
      this.options.plugins.colorschemes.scheme = this.$root.colorScheme;
      this.renderChart(this.chartData, this.options);
    },
  },
};
</script>
