<template>
  <sui-table selectable striped>
    <sui-table-body>
      <sui-table-row v-for="(entry, index) in entries" :key="index">
        <sui-table-cell :width="1">
          <sui-label color="blue">
            {{ index + 1 }}
          </sui-label>
        </sui-table-cell>
        <sui-table-cell>
          {{ entry[0] }}
        </sui-table-cell>
        <sui-table-cell>
          <strong>
            <span v-if="format == 'num'">
              {{ entry[1] | formatNum }}
            </span>
            <span v-else-if="format == 'currency'">
              {{
                entry[1] | formatCurrency($parent.$data.adminSettings.currency)
              }}
            </span>
          </strong>
        </sui-table-cell>
      </sui-table-row>
    </sui-table-body>
  </sui-table>
</template>

<script>
import UtilService from "../services/utils";

export default {
  name: "RankChart",
  mixins: [UtilService],
  props: {
    caption: {
      type: String,
    },
    data: {
      type: Array,
    },
  },
  data() {
    return {
      entries: [],
      format: "",
    };
  },
  watch: {
    data: function () {
      if (this.data && this.data.length > 1) {
        this.format = this.data[0][1].split("£")[1];
        this.entries = this.data.slice(1);
      } else {
        this.entries = [];
      }
    },
  },
};
</script>
