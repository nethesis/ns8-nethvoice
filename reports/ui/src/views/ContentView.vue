<template lang="html">
<div>
  <div v-show="!((dataAvailable && $route.meta.report == 'queue') || (cdrDataAvailable && $route.meta.report == 'cdr'))" class="ui placeholder segment report-data-not-available">
    <div class="ui icon header">
      <i class="frown outline icon mg-bottom-sm"></i>
      {{ $t("message.come_back_tomorrow") }}
    </div>
    <div class="inline">
      {{ $t("message.come_back_tomorrow_desc") }}
    </div>
  </div>
  <div v-show="(dataAvailable && $route.meta.report == 'queue') || (cdrDataAvailable && $route.meta.report == 'cdr')">
    <div v-if="!$root.filtersReady">
      <sui-loader active centered inline class="loading-filters" />
      <div>{{ $t("message.loading_filters") }}...</div>
    </div>
    <div class="chart-container">
      <div
        v-for="(chart, index) in charts" v-bind:key="index"
        :id="`export_${index}`"
        :class="{'table-chart': chart.type == 'table', 'line-chart': chart.type == 'line', 'pie-chart': chart.type == 'pie', 'bar-chart': chart.type == 'bar', 'recap-chart': chart.type == 'recap', 'rank-chart': chart.type == 'rank'}"
      >
        <div class="align-center h-20">
          <h4 is="sui-header" class="chart-caption">
            {{ $t("caption." + chart.caption) }}
          </h4>
          <span v-if="chart.doc">
            <sui-popup flowing hoverable position="top center">
              <div class="doc-info markdown">
                <VueShowdown :markdown="chart.doc"></VueShowdown>
              </div>
              <sui-icon name="info circle" class="doc-info-icon" slot="trigger" />
            </sui-popup>
          </span>
          <span v-if="chart.queryLimitHit">
            <sui-popup flowing hoverable position="top center">
              <div class="chart-query-limit markdown">
                <VueShowdown :markdown="queryLimitMessage"></VueShowdown>
              </div>
              <sui-icon name="exclamation triangle" class="chart-query-limit-icon" slot="trigger" />
            </sui-popup>
          </span>
        </div>
        <div class="export-container">
          <ExportData
            :data="chart.data"
            :filename="$t(`caption.${chart.caption}`)"
            :pdfElementContainerId="`#export_${index}`"
            pdfElementHeaderClass=".header"
            :type="chart.type"
          />
        </div>
        <div v-show="!chart.data">
            <div v-if="chart.error">
              <sui-message error>
                <i class="circle times icon"></i>{{ $t("message.chart_error") }}
              </sui-message>
            </div>
            <div v-else-if="chart.message">
              <sui-message warning>
                <i class="exclamation triangle icon"></i>{{ $t("message." + chart.message) }}
              </sui-message>
            </div>
            <div v-else class="loader-height">
              <sui-loader active centered inline class="mg-bottom-sm" />
              <sui-message v-if="chart.slowQuery" warning>
                <i class="exclamation triangle icon"></i>{{ $t("message.slow_query") }}
              </sui-message>
            </div>
        </div>
        <div v-show="chart.data">
          <div v-show="chart.data && chart.data.length < 2">
            <!-- no data, only query header is present -->
            <sui-message warning>
              <i class="exclamation triangle icon"></i>{{ $t("message.no_data_for_current_filter") }}
            </sui-message>
          </div>
          <div v-show="chart.data && chart.data.length > 1">
            <!-- table chart -->
            <div v-if="chart.type == 'table'">
              <TableChart :caption="chart.caption" :data="chart.data" :chartKey="`${index}`" :officeHours="adminSettings.officeHours" :filterTimeSplit="filterTimeSplit" :report="$route.meta.report" :hideHeaders="true"/>
            </div>
            <!-- line chart -->
            <div v-if="chart.type == 'line'">
              <line-chart :data="chart.data" :caption="chart.caption" :officeHours="adminSettings.officeHours" :filterTimeSplit="filterTimeSplit"></line-chart>
            </div>
            <!-- bar chart -->
            <div v-if="chart.type == 'bar'">
              <bar-chart :data="chart.data" :caption="chart.caption" :type="chart.type" :officeHours="adminSettings.officeHours" :filterTimeSplit="filterTimeSplit"></bar-chart>
            </div>
            <!-- pie chart -->
            <div v-if="chart.type == 'pie'">
              <div v-show="chart.data && chart.data.filter(function(entry, index) { return index > 0 && Number(entry[1])}).length">
                <pie-chart :data="chart.data" :caption="chart.caption"></pie-chart>
              </div>
              <div v-show="chart.data && !chart.data.filter(function(entry, index) { return index > 0 && Number(entry[1])}).length">
                <!-- pie chart contains only datasets with zero value -->
                <sui-message warning>
                  <i class="exclamation triangle icon"></i>{{ $t("message.no_data_for_current_filter") }}
                </sui-message>
              </div>
            </div>
            <!-- recap chart -->
            <div v-if="chart.type == 'recap'">
              <RecapChart :data="chart.data" :caption="chart.caption" :currency="adminSettings.currency"></RecapChart>
            </div>
            <!-- rank chart -->
            <div v-if="chart.type == 'rank'">
              <RankChart :data="chart.data" :caption="chart.caption"/>
            </div>
          </div>
        </div>
        <div v-show="chart.details" class="show-details">
          <sui-button type="button" size="tiny" icon="zoom" @click.native="showDetailsModal(chart)">
            {{ $t("command.show_details") }}
          </sui-button>
        </div>
      </div>
    </div>
    <!-- show details modal -->
    <sui-form @submit.prevent="hideDetailsModal()">
      <sui-modal v-if="chartDetails" v-model="openDetailsModal" size="small">
        <sui-modal-header>{{ $t("caption." + chartDetails.caption) }}</sui-modal-header>
        <sui-modal-content scrolling ref="chartDetailsContent">
          <TableChart :minimal="true" :caption="chartDetails.caption" :data="chartDetails.data" class="chart-details"/>
        </sui-modal-content>
        <sui-modal-actions>
          <sui-button type="submit" primary>
            {{ $t("command.close") }}
          </sui-button>
        </sui-modal-actions>
      </sui-modal>
    </sui-form>
    <!-- CDR call details modal -->
    <sui-form @submit.prevent="hideCdrDetailsModal()" warning>
      <sui-modal v-model="cdr.openDetailsModal" class="cdr-details">
        <sui-modal-header>{{ $t("misc.call_details") }}</sui-modal-header>
        <sui-modal-content scrolling>
          <sui-statistics-group class="mg-bottom-sm">
            <sui-statistic in-group>
              <sui-statistic-value>
                {{ $t('table.' + cdr.details.callType) }}
              </sui-statistic-value>
              <sui-statistic-label>{{
                $t("table.call_type")
              }}</sui-statistic-label>
            </sui-statistic>
            <sui-statistic in-group :color="cdr.details.result == 'ANSWERED' ? 'green' : cdr.details.result == 'BUSY' ? 'yellow' : cdr.details.result == 'NO ANSWER' ? 'orange' : cdr.details.result == 'FAILED' ? 'red' : 'black'">
              <sui-statistic-value>
                {{ $t('table.' + cdr.details.result) }}
              </sui-statistic-value>
              <sui-statistic-label>{{
                $t("table.result")
              }}</sui-statistic-label>
            </sui-statistic>
            <sui-statistic in-group>
              <sui-statistic-value>{{
                cdr.details.totalDuration | formatTime
              }}</sui-statistic-value>
              <sui-statistic-label>{{
                $t("table.totalDuration")
              }}</sui-statistic-label>
            </sui-statistic>
            <sui-statistic in-group>
              <sui-statistic-value>{{
                cdr.details.actualDuration | formatTime
              }}</sui-statistic-value>
              <sui-statistic-label>{{
                $t("table.billsec")
              }}</sui-statistic-label>
            </sui-statistic>
            <sui-statistic v-if="cdr.details.callType == 'OUT'" in-group :color="'blue'">
              <sui-statistic-value>{{
                cdr.details.cost | formatCurrency(adminSettings.currency) }}</sui-statistic-value>
              <sui-statistic-label>{{
                $t("table.cost")
              }}</sui-statistic-label>
            </sui-statistic>
          </sui-statistics-group>
          <TableChart v-if="cdr.details.data.length" :minimal="true" :caption="$t('misc.details')" :data="cdr.details.data" :hideHeaders="true" class="cdr-details"/>
          <div v-else>
            <sui-loader active centered inline class="mg-bottom-sm fix" />
            <sui-message warning class="align-center">
              <i class="exclamation triangle icon"></i>{{ $t("message.cdr_details_wait") }}
            </sui-message>
          </div>
        </sui-modal-content>
        <sui-modal-actions>
          <sui-button type="submit" primary>
            {{ $t("command.close") }}
          </sui-button>
        </sui-modal-actions>
      </sui-modal>
    </sui-form>
  </div>
</div>
</template>

<script>
import TableChart from "../components/TableChart.vue";
import LineChart from "../components/LineChart.vue";
import BarChart from "../components/BarChart.vue";
import PieChart from "../components/PieChart.vue";
import ExportData from "../components/ExportData.vue";
import RecapChart from "../components/RecapChart.vue";
import RankChart from "../components/RankChart.vue";

import QueriesService from "../services/queries";
import StorageService from "../services/storage";
import UtilService from "../services/utils";
import SettingsService from "../services/settings";
import CdrDetailsService from "../services/cdr_details";

export default {
  name: "ContentView",
  components: {
    TableChart,
    LineChart,
    BarChart,
    ExportData,
    PieChart,
    RecapChart,
    RankChart,
  },
  mixins: [
    StorageService,
    QueriesService,
    UtilService,
    SettingsService,
    CdrDetailsService,
  ],
  data() {
    return {
      SLOW_QUERY_TIMEOUT: 5000,
      queryTree: null,
      queryNames: [],
      charts: [],
      MAX_CHART_ENTRIES: 8,
      openDetailsModal: false,
      chartDetails: null,
      dataAvailable: true,
      cdrDataAvailable: true,
      adminSettings: {
        officeHours: {
          start_hour: null,
          end_hour: null,
        },
        queryLimit: 0,
        currency: "",
        costs: [],
      },
      costsConfigured: false,
      filterTimeSplit: 0,
      isAdmin: false,
      queryLimitMessage: "",
      currentReport: "",
      cdr: {
        openDetailsModal: false,
        details: {
          linkedId: "",
          callType: "",
          result: "",
          totalDuration: "",
          actualDuration: "",
          cost: "",
          data: [],
        },
      },
    };
  },
  mounted() {
    // event "dataNotAvailable" is triggered by $http interceptor if queue report tables don't exist yet
    this.$root.$on("dataNotAvailable", this.onDataNotAvailable);

    // event "cdrDataNotAvailable" is triggered by $http interceptor if cdr report tables don't exist yet
    this.$root.$on("cdrDataNotAvailable", this.onCdrDataNotAvailable);

    // event "reloadAdminSettings" is triggered by TopBar when configuring costs
    this.$root.$on("reloadAdminSettings", this.getAdminSettings);

    this.$root.$on("applyFilters", this.applyFilters);

    // get office hours
    this.getAdminSettings();

    // $root.filtersReady is set to true when filters have been loaded
    if (this.$root.filtersReady) {
      this.retrieveQueryTree();
    }

    // check admin user
    if (this.get("loggedUser") && this.get("loggedUser").username == "admin") {
      this.isAdmin = true;
    } else {
      this.isAdmin = false;
    }

    this.currentReport = this.$route.meta.report;

    // load message for query limit hit
    this.retrieveQueryLimitMessage();
  },
  watch: {
    $route: function () {
      if (this.currentReport == this.$route.meta.report) {
        this.initCharts();
      } else {
        this.currentReport = this.$route.meta.report;
        this.retrieveQueryTree();
      }

      if (this.isAdmin && this.$route.meta.report == "cdr") {
        this.checkCostsConfiguration();
      }
    },
    "$root.filtersReady": function () {
      // $root.filtersReady is set to true when filters have been loaded
      if (this.$root.filtersReady) {
        this.retrieveQueryTree();
      }
    },
  },
  beforeRouteLeave(to, from, next) {
    // clear all slow query timeouts
    for (let chart of this.charts) {
      clearTimeout(chart.slowQueryTimeout);
    }
    next();
  },
  methods: {
    onDataNotAvailable() {
      this.dataAvailable = false;
    },
    onCdrDataNotAvailable() {
      this.cdrDataAvailable = false;
    },
    retrieveQueryTree() {
      this.getQueryTree(
        this.$route.meta.report,
        (success) => {
          let queryTree = success.body.query_tree;

          for (const section of Object.keys(queryTree)) {
            for (const view of Object.keys(queryTree[section])) {
              queryTree[section][view].forEach(function (query, index) {
                const tokens = query.split(".");
                const queryName = tokens[0];
                const queryType = tokens[1];
                this[index] = { name: queryName, type: queryType };
              }, queryTree[section][view]);
            }
          }
          this.queryTree = queryTree;
          this.initCharts();
        },
        (error) => {
          console.error(error.body);
        }
      );
    },
    initCharts() {
      if (!this.queryTree) return
      if ((this.dataAvailable && this.$route.meta.report == 'queue') || (this.cdrDataAvailable && this.$route.meta.report == 'cdr')) {
        let charts = [];

        this.queries = this.queryTree[this.$route.meta.section][
          this.$route.meta.view
        ];

        if (this.queries) {
          this.queries.forEach((query) => {
            const queryName = query.name;
            const queryType = query.type;
            const tokens = queryName.split("_");
            const position = parseInt(tokens[0]);
            const chartType = tokens[1];
            const caption = tokens[2];
            const doc = this.retrieveDoc(queryName);
            charts.push({
              name: queryName,
              position: position,
              type: chartType,
              queryType: queryType,
              caption: caption,
              data: null,
              message: null,
              details: null,
              error: false,
              doc: doc,
              queryLimitHit: false,
              slowQuery: false,
              slowQueryTimeout: 0,
            });
          });
          this.charts = charts.sort(this.sortByProperty("position"));
          this.$root.$emit("requestApplyFilter");
        } else {
          this.charts = [];
        }
      }
    },
    applyFilters(filter) {
      this.filterTimeSplit = Number(filter.time.division);

      for (let chart of this.charts) {
        chart.data = null;
        chart.message = null;
        chart.details = null;
        chart.error = false;
        chart.queryLimitHit = false;

        chart.slowQuery = false;
        chart.slowQueryTimeout = setTimeout(() => {
          chart.slowQuery = true;
        }, this.SLOW_QUERY_TIMEOUT);

        this.execQuery(
          filter,
          this.$route.meta.report,
          this.$route.meta.section,
          this.$route.meta.view,
          chart.name,
          chart.queryType,
          (success) => {
            const result = success.body;

            // check warning message
            if (
              result.length == 2 &&
              result[0].length == 1 &&
              result[0][0] == "!message"
            ) {
              chart.message = result[1][0].replace(/ /g, "_");
            } else {
              chart.data = result;

              // show details button for pie chart with a lot of entries
              if (this.tooMuchData(chart)) {
                chart.details = true;
              }

              // check if query limit has been hit
              if (
                chart.data.length &&
                chart.data.length - 1 == this.adminSettings.queryLimit
              ) {
                chart.queryLimitHit = true;
              }

              clearTimeout(chart.slowQueryTimeout);
            }
          },
          (error) => {
            console.error(error);
            chart.error = true;
          }
        );
      }
    },
    tooMuchData(chart) {
      if (chart.type == "pie") {
        return chart.data.length > this.MAX_CHART_ENTRIES;
      } else if (chart.type == "line" || chart.type == "bar") {
        // remove first element (query columns)
        const rows = chart.data.filter((_, i) => i !== 0);
        const datasetSet = new Set();

        for (let row of rows) {
          datasetSet.add(row[0]);

          if (datasetSet.size > this.MAX_CHART_ENTRIES) {
            return true;
          }
        }
      } else {
        return false;
      }
    },
    showDetailsModal(chart) {
      this.chartDetails = chart;
      this.openDetailsModal = true;

      // scroll modal to top
      this.$nextTick(() => {
        this.$refs.chartDetailsContent.$el.scrollTop = 0;
      });
    },
    hideDetailsModal() {
      this.openDetailsModal = false;
    },
    getAdminSettings() {
      this.getSettings(
        (success) => {
          const settings = success.body.settings;
          this.adminSettings.officeHours = {
            startHour: settings.start_hour,
            endHour: settings.end_hour,
          };
          this.adminSettings.queryLimit = Number(settings.query_limit);
          this.adminSettings.currency = settings.currency;

          // costs
          this.adminSettings.costs = settings.costs;

          // check if costs configuration modal has already been shown
          this.costsConfigured = this.get("costsConfigured");
          if (this.isAdmin && this.$route.meta.report == "cdr") {
            this.checkCostsConfiguration();
          }
        },
        (error) => {
          console.error(error.body);
        }
      );
    },
    retrieveDoc(queryName) {
      try {
        let mdDoc = require("../doc-inline/" +
          this.$root.currentLocale +
          "/" +
          this.$route.meta.report +
          "/" +
          this.$route.meta.section +
          "_" +
          this.$route.meta.view +
          "_" +
          queryName +
          ".md");
        return mdDoc.default;
      } catch (error) {
        return null;
      }
    },
    retrieveQueryLimitMessage() {
      try {
        const userType = this.isAdmin ? "admin" : "user";
        let message = require("../doc-inline/" +
          this.$root.currentLocale +
          "/query_limit_hit_" +
          userType +
          ".md");
        this.queryLimitMessage = message.default;
      } catch (error) {
        this.queryLimitMessage = "";
      }
    },
    showCdrDetailsModal(row) {
      this.cdr.details.linkedId = row[0];
      this.cdr.details.callType = row[6];
      this.cdr.details.result = row[7];
      this.cdr.details.totalDuration = row[8];
      this.cdr.details.actualDuration = row[9];
      this.cdr.details.cost = row[10];
      this.cdr.details.data = [];
      this.cdr.openDetailsModal = true;
      const linkedId = this.cdr.details.linkedId;

      this.getCdrDetails(
        linkedId,
        (success) => {
          // ensure user hansn't opened details for another call while processing
          if (linkedId == this.cdr.details.linkedId) {
            this.cdr.details.data = success.body;
          }
        },
        (error) => {
          console.error(error.body);
        }
      );
    },
    hideCdrDetailsModal() {
      this.cdr.openDetailsModal = false;
    },
    checkCostsConfiguration() {
      // need to show costs configuration modal?
      if (
        !this.costsConfigured &&
        (!this.adminSettings.costs || !this.adminSettings.costs.length)
      ) {
        this.$root.$emit("showCostsConfigModal");
      }
    },
  },
};
</script>

<style lang="scss" scoped>
.table-container {
  overflow-y: hidden;
  overflow-x: auto;
}

.export-container {
  position: relative;
  height: 12px;
}

.chart-caption {
  display: inline-block;
  margin-bottom: 1rem !important;
}

.ui.table.chart-details,
.ui.table.cdr-details {
  margin: 0 auto;
}

.chart-query-limit-icon {
  color: #f2711c;
  margin-left: 0.3rem;
}

.chart-query-limit {
  text-align: left !important;
  max-width: 35rem !important;
  max-height: 14rem;
  overflow-y: auto;
}

.ui.statistic > .value,
.ui.statistics .statistic > .value {
  font-size: 1.7rem !important;
}
</style>