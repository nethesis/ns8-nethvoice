<template>
  <div>
    <sui-grid class="recap">
      <div
        v-if="entry"
        :class="
          entry.expanded
            ? 'sixteen wide column'
            : [
                'five',
                'wide',
                'computer',
                'eight',
                'wide',
                'tablet',
                'sixteen',
                'wide',
                'mobile',
                'column',
              ]
        "
      >
        <sui-card class="full-width">
          <sui-card-content>
            <sui-card-header v-if="entry.type == 'IN'">
              <sui-icon name="arrow left" />
              {{ $t("recap.inbound_calls") }}
            </sui-card-header>
            <sui-card-header v-else-if="entry.type == 'LOCAL'">
              <sui-icon name="arrow down" />
              {{ $t("recap.local_calls") }}
            </sui-card-header>
            <sui-card-header v-else-if="entry.type == 'OUT'">
              <sui-icon name="arrow right" />
              {{ $t("recap.outbound_calls") }}
            </sui-card-header>
            <sui-card-header v-else>
              {{ entry.type }}
            </sui-card-header>
            <sui-card-description>
              <!-- not expanded -->
              <sui-statistics-group v-if="!entry.expanded">
                <sui-statistic in-group>
                  <sui-statistic-value v-if="entry.type == 'OUT'">{{
                    entry.totalNum/2 | formatNumber
                  }}</sui-statistic-value>
                  <sui-statistic-value v-else>{{
                    entry.totalNum | formatNumber
                  }}</sui-statistic-value>
                  <sui-statistic-label>{{
                    $t("recap.total")
                  }}</sui-statistic-label>
                </sui-statistic>
                <sui-statistic v-if="entry.totalNum" in-group>
                  <sui-button
                    type="button"
                    @click="entry.expanded = true"
                    size="tiny"
                    icon="zoom"
                    >{{ $t("command.expand") }}</sui-button
                  >
                </sui-statistic>
              </sui-statistics-group>
              <!-- expanded -->
              <template v-else>
                <sui-card
                  v-for="(detail, i) in entry.details"
                  :key="i"
                  class="full-width"
                  :class="{ 'hide-card': entry.details.length < 2 }"
                >
                  <sui-card-content>
                    <sui-card-header v-if="entry.type == 'OUT'">
                      <sui-icon name="arrow right" />
                      {{
                        detail.destination
                          ? $t(`misc.${detail.destination }`)
                          : $t("misc.unknown")
                      }}
                      <span v-if="!detail.destination">
                        <sui-popup flowing hoverable position="top center">
                          <div class="popup-md markdown">
                            <VueShowdown
                              :markdown="unknownDestinationMessage"
                            ></VueShowdown>
                          </div>
                          <sui-icon
                            name="exclamation triangle"
                            class="warning-icon"
                            slot="trigger"
                          />
                        </sui-popup>
                      </span>
                    </sui-card-header>
                    <sui-card-description>
                      <sui-statistics-group>
                        <sui-statistic in-group>
                          <sui-statistic-value>{{
                            detail.totalNum | formatNumber
                          }}</sui-statistic-value>
                          <sui-statistic-label>{{
                            $t("recap.total")
                          }}</sui-statistic-label>
                        </sui-statistic>
                        <sui-statistic in-group color="green">
                          <sui-statistic-value>{{
                            detail.answeredNum | formatNumber
                          }}</sui-statistic-value>
                          <sui-statistic-label>{{
                            $t("recap.answered")
                          }}</sui-statistic-label>
                        </sui-statistic>
                        <sui-statistic in-group color="yellow">
                          <sui-statistic-value>{{
                            detail.busyNum | formatNumber
                          }}</sui-statistic-value>
                          <sui-statistic-label>{{
                            $t("recap.busy")
                          }}</sui-statistic-label>
                        </sui-statistic>
                        <sui-statistic in-group color="orange">
                          <sui-statistic-value>{{
                            detail.noAnswerNum | formatNumber
                          }}</sui-statistic-value>
                          <sui-statistic-label>{{
                            $t("recap.unanswered")
                          }}</sui-statistic-label>
                        </sui-statistic>
                        <sui-statistic in-group color="red">
                          <sui-statistic-value>{{
                            detail.failedNum | formatNumber
                          }}</sui-statistic-value>
                          <sui-statistic-label>{{
                            $t("recap.failed")
                          }}</sui-statistic-label>
                        </sui-statistic>
                      </sui-statistics-group>
                      <sui-statistics-group>
                        <sui-statistic in-group>
                          <sui-statistic-value>{{
                            detail.totalDuration | formatTime
                          }}</sui-statistic-value>
                          <sui-statistic-label>{{
                            $t("recap.total_duration")
                          }}</sui-statistic-label>
                        </sui-statistic>
                        <sui-statistic in-group>
                          <sui-statistic-value>{{
                            detail.totalEffectiveDuration | formatTime
                          }}</sui-statistic-value>
                          <sui-statistic-label>{{
                            $t("recap.total_effective_duration")
                          }}</sui-statistic-label>
                        </sui-statistic>
                        <sui-statistic in-group>
                          <sui-statistic-value>{{
                            detail.avgDuration | formatTime
                          }}</sui-statistic-value>
                          <sui-statistic-label>{{
                            $t("recap.avg_duration")
                          }}</sui-statistic-label>
                        </sui-statistic>
                        <sui-statistic in-group>
                          <sui-statistic-value>{{
                            detail.totalWaitDuration | formatTime
                          }}</sui-statistic-value>
                          <sui-statistic-label>{{
                            $t("recap.total_wait_duration")
                          }}</sui-statistic-label>
                        </sui-statistic>
                        <sui-statistic in-group>
                          <sui-statistic-value>{{
                            detail.avgWaitDuration | formatTime
                          }}</sui-statistic-value>
                          <sui-statistic-label>{{
                            $t("recap.avg_wait_duration")
                          }}</sui-statistic-label>
                        </sui-statistic>
                        <template v-if="detail.type == 'OUT'">
                          <sui-statistic in-group color="blue">
                            <sui-statistic-value
                              >{{ detail.totalCost | formatCurrency(currency) }}
                            </sui-statistic-value>
                            <sui-statistic-label>{{
                              $t("recap.total_cost")
                            }}</sui-statistic-label>
                          </sui-statistic>
                          <sui-statistic in-group color="blue">
                            <sui-statistic-value
                              >{{ detail.avgCost | formatCurrency(currency) }}
                            </sui-statistic-value>
                            <sui-statistic-label>{{
                              $t("recap.avg_cost")
                            }}</sui-statistic-label>
                          </sui-statistic>
                        </template>
                      </sui-statistics-group>
                    </sui-card-description>
                  </sui-card-content>
                </sui-card>
                <sui-statistic in-group>
                  <sui-button
                    type="button"
                    @click="entry.expanded = false"
                    size="tiny"
                    icon="zoom-out"
                    >{{ $t("command.collapse") }}</sui-button
                  >
                </sui-statistic>
              </template>
            </sui-card-description>
          </sui-card-content>
        </sui-card>
      </div>
    </sui-grid>
  </div>
</template>

<script>
import StorageService from "../services/storage";

export default {
  name: "RecapChart",
  props: {
    caption: {
      type: String,
    },
    data: {
      type: Array,
    },
    currency: {
      type: String,
    },
  },
  mixins: [StorageService],
  data() {
    return {
      rows: [],
      columns: [],
      entries: {},
      unknownDestinationMessage: null,
    };
  },
  computed: {
    entry: function () {
      switch (this.$route.meta.view) {
        case "inbound":
          return this.entries["IN"];
        case "outbound":
          return this.entries["OUT"];
        case "local":
          return this.entries["LOCAL"];
      }
      return null;
    },
  },
  mounted() {
    if (this.data) {
      this.dataUpdated();
    }

    // check admin user
    if (this.get("loggedUser") && this.get("loggedUser").username == "admin") {
      this.isAdmin = true;
    } else {
      this.isAdmin = false;
    }

    // load message for unknown destination
    this.retrieveUnknownDestinationMessage();
  },
  watch: {
    data: function () {
      this.dataUpdated();
    },
  },
  methods: {
    dataUpdated() {
      if (this.data && this.data.length) {
        this.columns = this.data[0];

        if (this.data.length > 1) {
          this.rows = this.data.slice(1);
          this.parseData();
        } else {
          this.rows = [];
        }
      } else {
        this.rows = [];
      }
    },
    retrieveUnknownDestinationMessage() {
      try {
        const userType = this.isAdmin ? "admin" : "user";
        let message = require("../doc-inline/" +
          this.$root.currentLocale +
          "/unknown_destination_" +
          userType +
          ".md");
        this.unknownDestinationMessage = message.default;
      } catch (error) {
        this.unknownDestinationMessage = "";
      }
    },
    parseData() {
      const entries = {
        IN: { type: "IN", totalNum: 0, details: [], expanded: false },
        LOCAL: { type: "LOCAL", totalNum: 0, details: [], expanded: false },
        OUT: { type: "OUT", totalNum: 0, details: [], expanded: false },
      };

      for (const row of this.rows) {
        const type = row[0];

        const entry = {
          type: type,
          destination: row[1],
          totalNum: row[2],
          answeredNum: row[3],
          noAnswerNum: row[4],
          busyNum: row[5],
          failedNum: row[6],
          totalDuration: row[7],
          avgDuration: row[8],
          totalCost: row[9],
          avgCost: row[10],
          totalWaitDuration: row[11],
          avgWaitDuration: row[12],
          totalEffectiveDuration: row[13]
        };

        if (entries[type]) {
          entries[type].totalNum += Number(row[2]);
          entries[type].details.push(entry);
        }
      }
      this.entries = entries;
    },
  },
};
</script>

<style lang="scss" scoped>
.ui.grid.recap {
  width: 100%;
  margin-left: 0;
  justify-content: center;
}

.warning-icon {
  color: #f2711c;
  margin-left: 0.3rem;
}

.popup-md {
  text-align: left !important;
  max-width: 35rem !important;
  max-height: 14rem;
  overflow-y: auto;
}

.ui.statistics {
  justify-content: center;
  align-items: center;
}

.ui.statistic > .value,
.ui.statistics .statistic > .value {
  font-size: 1.7rem !important;
}

.title {
  font-weight: bold;
}

.ui.card > .content > .header + .description,
.ui.card > .content > .meta + .description,
.ui.cards > .card > .content > .header + .description,
.ui.cards > .card > .content > .meta + .description {
  margin-top: 1.2em;
}

.hide-card {
  box-shadow: none !important;
}

.hide-card .content {
  padding: 0 !important;
}
</style>
