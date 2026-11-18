<template>
  <div :id="`container_${chartKey}`" class="table-container">
    <sui-table
      celled
      selectable
      striped
      :compact="minimal"
      :collapsing="minimal"
      class="structured sortable"
    >
      <sui-table-header>
        <!-- top header -->
        <sui-table-row>
          <template v-for="(header, index) in topHeaders">
            <sui-table-header-cell
              v-if="!(hideHeaders && hiddenHeaders.includes(header.name))"
              v-bind:key="index"
              ref="tableHeader"
              :class="[
                header.subHeaders.length ? 'not-sortable' : 'sortable',
                (header.rawColumnName == sortedBy && !header.subHeaders.length) ? 'sorted ' + sortedDirection : '',
              ]"
              @click="sortTable(header, $event)"
              :rowspan="
                singleHeader ||
                (doubleHeader && header.subHeaders.length) ||
                (tripleHeader && header.subHeaders.length)
                  ? '1'
                  : doubleHeader && !header.subHeaders.length
                  ? '2'
                  : '3'
              "
              :colspan="header.subHeaders ? header.colSpan : '1'"
            >
              {{
                $te("table." + header.name)
                  ? $t("table." + header.name)
                  : header.name
              }}
              <a
                href="#"
                v-show="header.subHeaders && header.expandible"
                @click="toggleExpandHeader(header)"
              >
                {{
                  header.expanded
                    ? "[" + $t("table.collapse") + "]"
                    : "[" + $t("table.expand") + "]"
                }}
              </a>
            </sui-table-header-cell>
          </template>
          <!-- details header for CDR -->
          <sui-table-header-cell v-if="report == 'cdr'" class="not-sortable">
            {{ $t("table.actions") }}
          </sui-table-header-cell>
        </sui-table-row>
        <!-- middle header -->
        <sui-table-row v-if="middleHeaders.length">
          <sui-table-header-cell
            v-for="(header, index) in middleHeaders"
            v-show="header.visible"
            ref="tableHeader"
            :class="[
              header.subHeaders.length ? 'not-sortable' : 'sortable',
              (header.rawColumnName == sortedBy && !header.subHeaders.length) ? 'sorted ' + sortedDirection : '',
            ]"
            @click="sortTable(header, $event)"
            v-bind:key="index"
            :rowspan="tripleHeader && !header.subHeaders.length ? '2' : '1'"
            :colspan="header.colSpan"
          >
            {{
              $te("table." + header.name)
                ? $t("table." + header.name)
                : header.name
            }}
            <a
              href="#"
              v-show="header.subHeaders && header.expandible"
              @click="toggleExpandHeader(header)"
            >
              {{
                header.expanded
                  ? "[" + $t("table.collapse") + "]"
                  : "[" + $t("table.expand") + "]"
              }}
            </a></sui-table-header-cell
          >
        </sui-table-row>

        <!-- bottom header -->
        <sui-table-row v-if="bottomHeaders.length">
          <sui-table-header-cell
            v-for="(header, index) in bottomHeaders"
            v-show="header.visible"
            ref="tableHeader"
            :class="[
              header.subHeaders.length ? 'not-sortable' : 'sortable',
              header.rawColumnName == sortedBy ? 'sorted ' + sortedDirection : '',
            ]"
            @click="sortTable(header, $event)"
            v-bind:key="index"
          >
            {{
              $te("table." + header.name)
                ? $t("table." + header.name)
                : header.name
            }}
          </sui-table-header-cell>
        </sui-table-row>
      </sui-table-header>

      <sui-table-body>
        <sui-table-row
          v-for="(row, index) in pagination.pageRows"
          v-bind:key="index"
        >
          <template v-for="(element, index) in row">
            <sui-table-cell
              v-if="
                !(
                  hideHeaders &&
                  columns[index] &&
                  hiddenHeaders.includes(columns[index].name)
                )
              "
              v-show="columns[index] && columns[index].visible"
              :key="index"
            >
              <span v-if="columns[index] && columns[index].format == 'num'">
                {{ element | formatNumber }}
              </span>
              <span
                v-else-if="columns[index] && columns[index].format == 'seconds'"
              >
                {{ element | formatTime }}
              </span>
              <span
                v-else-if="columns[index] && columns[index].format == 'percent'"
              >
                {{ element | formatPercentage }}
              </span>
              <span
                v-else-if="columns[index] && columns[index].format == 'label'"
              >
                {{ $t("table." + element) }}
                <!-- show user of call group -->
                <span v-show="columns[index].name === 'result' &&
                  $root.devices[row[colIndex('dst')]] &&
                  $root.devices[row[colIndex('dst')]].type == 'ringgroups'"
                >
                  <!-- show username if available -->
                  <span
                    v-if="$root.users[row[colIndex('peeraccount')]]"
                    v-tooltip="{
                      content: getCallGroupUserTooltip(row[colIndex('peeraccount')]),
                      autoHide: false,
                    }"
                  >
                    ({{ $root.users[row[colIndex('peeraccount')]] }}
                    <sui-icon :name="'user'" />)
                  </span>
                  <span v-else>
                    ({{ row[colIndex('peeraccount')] }})
                  </span>
                </span>
              </span>
              <span
                v-else-if="
                  columns[index] && columns[index].format == 'monthDate'
                "
              >
                {{ element | formatMonthDate }}
              </span>
              <span
                v-else-if="
                  columns[index] && columns[index].format == 'weekDate'
                "
              >
                {{ element | formatWeekDate($i18n) }}
              </span>
              <span
                v-else-if="
                  columns[index] && columns[index].format == 'phonebookName'
                "
              >
                {{ element | reversePhonebookLookup("name", $root) }}
              </span>
              <span
                v-else-if="
                  columns[index] && columns[index].format == 'phonebookCompany'
                "
              >
                {{ element | reversePhonebookLookup("company", $root) }}
              </span>
              <span
                v-else-if="
                  columns[index] && columns[index].format == 'phoneNumber'
                "
              >
                <span
                  v-if="$root.users[element]"
                  v-tooltip="{
                    content: getUserTooltip(element, index, row),
                    autoHide: false,
                  }"
                >
                  {{ $root.users[element] }}
                  <sui-icon :name="'user'" />
                </span>
                <span
                  v-else-if="$root.devices[element]"
                  v-tooltip="{
                    content: getDeviceTooltip(element),
                    autoHide: false,
                  }"
                >
                  {{ element }}
                  <sui-icon
                    :name="
                      $root.devices[element].type == 'physical'
                        ? 'phone'
                        : $root.devices[element].type == 'mobile'
                        ? 'mobile alternate'
                        : $root.devices[element].type == 'webrtc'
                        ? 'headphones'
                        : $root.devices[element].type == 'ringgroups'
                        ? 'users'
                        : $root.devices[element].type == 'meetme'
                        ? 'comment alternate outline'
                        : ''
                    "
                  />
                </span>
                <span
                  v-else-if="$root.queues[element]"
                  v-tooltip="{
                    content: getQueueTooltip(element),
                    autoHide: false,
                  }"
                >
                  {{ $root.queues[element] }}
                  <sui-icon :name="'hourglass half'" />
                </span>
                <span v-else>
                  <!-- search phone number in phonebook -->
                  <span
                    v-if="reversePhonebookSearch(element)"
                    v-tooltip="{
                      content: getContactTooltip(element),
                      autoHide: false,
                    }"
                  >
                    {{
                      $options.filters.reversePhonebookLookup(
                        element,
                        "name|company",
                        $root
                      )
                    }}
                    <sui-icon name="user" />
                  </span>
                  <span v-else>
                    <!-- phone number not found in phonebook -->
                    {{
                      isNumber(element) && element !== "1"
                        ? element
                        : $t(`table.pbx`)
                    }}
                    <country-flag
                      v-if="
                        $route.meta.view == 'outbound' &&
                        columns[index].name == 'dst' &&
                        isNumber(element) &&
                        getCountryCode(element)
                      "
                      :country="getCountryCode(element)"
                      size="small"
                      v-tooltip="{
                        content: getCountryName(element),
                        autoHide: false,
                      }"
                    />
                  </span>
                </span>
              </span>
              <span
                v-else-if="
                  columns[index] && columns[index].format == 'currency'
                "
              >
                {{
                  element | formatCurrency($parent.$data.adminSettings.currency)
                }}
              </span>
              <span
                v-else-if="
                  columns[index] && columns[index].format == 'twoDecimals'
                "
              >
                {{ element | formatTwoDecimals }}
              </span>
              <span
                v-else-if="
                  columns[index] && columns[index].format == 'commasList'
                "
              >
                {{ element | formatCommasList }}
              </span>
              <span v-else>
                {{ element }}
              </span>
            </sui-table-cell>
          </template>
          <!-- details button for CDR -->
          <sui-table-cell v-if="report == 'cdr'">
            <sui-button
              type="button"
              @click.native="$parent.showCdrDetailsModal(row)"
              size="tiny"
              icon="zoom"
              >{{ $t("command.show_details") }}</sui-button
            >
          </sui-table-cell>
        </sui-table-row>
      </sui-table-body>
      <sui-table-footer>
        <sui-table-row>
          <sui-table-header-cell
            :colspan="report == 'cdr' ? columns.length + 1 : columns.length"
          >
            <sui-menu pagination class="no-border">
              <span is="sui-menu-item" class="small-pad"
                >{{ pagination.firstRowIndex + 1 }} -
                {{ Math.min(pagination.lastRowIndex, rows.length) }}
                {{ $t("pagination.of") }} {{ rows.length | formatNumber }}</span
              >
            </sui-menu>

            <sui-menu pagination class="mg-right-xl">
              <sui-dropdown
                class="item select-rows-per-page"
                direction="upward"
              >
                <sui-dropdown-menu>
                  <sui-dropdown-item
                    v-for="(value, index) in pagination.rowsPerPageOptions"
                    v-bind:key="index"
                    @click="setRowsPerPage(value)"
                  >
                    <span class="mg-right-sm"
                      >{{ value }} {{ $t("pagination.per_page") }}</span
                    >
                    <sui-icon
                      v-if="pagination.rowsPerPage == value"
                      name="check"
                    />
                  </sui-dropdown-item>
                </sui-dropdown-menu>
              </sui-dropdown>
            </sui-menu>

            <sui-menu pagination>
              <a is="sui-menu-item" icon @click="firstPage()">
                <sui-icon name="left double angle" />
              </a>
              <a is="sui-menu-item" icon @click="previousPage()">
                <sui-icon name="left angle" />
              </a>
            </sui-menu>
            <sui-menu pagination class="no-border">
              <span is="sui-menu-item" class="small-pad">{{
                $t("pagination.page")
              }}</span>
              <sui-input
                @blur="updatePagination()"
                @keyup.enter="updatePagination()"
                class="current-page"
                v-model="pagination.currentPage"
              />
              <span is="sui-menu-item" class="small-pad"
                >{{ $t("pagination.of") }}
                {{ pagination.totalPages | formatNumber }}</span
              >
            </sui-menu>
            <sui-menu pagination>
              <a is="sui-menu-item" icon @click="nextPage()">
                <sui-icon name="right angle" />
              </a>
              <a is="sui-menu-item" icon @click="lastPage()">
                <sui-icon name="right double angle" />
              </a>
            </sui-menu>
          </sui-table-header-cell>
        </sui-table-row>
      </sui-table-footer>
    </sui-table>
    <HorizontalScrollers
      :visible="true"
      :containerId="`#container_${chartKey}`"
      :chartData="data"
    />
  </div>
</template>

<script>
import UtilService from "../services/utils";
import StorageService from "../services/storage";
import HorizontalScrollers from "../components/HorizontalScrollers.vue";
import parsePhoneNumber from "libphonenumber-js";
import CountryFlag from "vue-country-flag";

let countries = require("i18n-iso-countries");
countries.registerLocale(require("i18n-iso-countries/langs/en.json"));
countries.registerLocale(require("i18n-iso-countries/langs/it.json"));

export default {
  name: "TableChart",
  props: {
    caption: {
      type: String,
    },
    data: {
      type: Array,
    },
    minimal: {
      type: Boolean,
      default: function () {
        return false;
      },
    },
    chartKey: {
      type: String,
    },
    officeHours: {
      type: Object,
    },
    filterTimeSplit: {
      type: Number,
    },
    report: {
      type: String,
    },
    hideHeaders: {
      type: Boolean,
      default: function () {
        return false;
      },
    },
  },
  mixins: [UtilService, StorageService],
  components: { HorizontalScrollers, CountryFlag },
  data() {
    return {
      ROWS_PER_PAGE_KEY: "tableChartRowsPerPage",
      columns: [],
      rows: [],
      topHeaders: [],
      middleHeaders: [],
      bottomHeaders: [],
      pagination: {
        rowsPerPage: 25,
        rowsPerPageOptions: [10, 25, 50, 100],
        currentPage: 1,
        pageRows: [],
        totalPages: 0,
        firstRowIndex: 0,
        lastRowIndex: 0,
      },
      sortedBy: "period",
      sortedDirection: "ascending",
      hiddenHeaders: ["linkedid", "call_type", "accountcode", "peeraccount"],
    };
  },
  mounted() {
    // get number of rows per page from local storage
    const rowsPerPage = this.get(this.ROWS_PER_PAGE_KEY);

    if (rowsPerPage) {
      this.pagination.rowsPerPage = rowsPerPage;
    }

    if (this.data) {
      this.dataUpdated();
    }
    // reset table's sorted by variables
    this.$root.$on("applyFilters", this.onApplyFilters);
  },
  watch: {
    data: function () {
      this.dataUpdated();
    },
  },
  computed: {
    singleHeader: function () {
      return !this.middleHeaders.length && !this.bottomHeaders.length;
    },
    doubleHeader: function () {
      return this.middleHeaders.length && !this.bottomHeaders.length;
    },
    tripleHeader: function () {
      return !!(this.middleHeaders.length && this.bottomHeaders.length);
    },
  },
  methods: {
    getCountryCode(number) {
      if (!number) return null;
      // adapt number for libphonenumber
      number = number.replace(/^00/g, "+");
      // parse number
      const parsedNumber = parsePhoneNumber(number);

      // return country
      return parsedNumber ? parsedNumber.country : null;
    },
    getCountryName(number) {
      if (!number) return null;
      // adapt number for libphonenumber
      number = number.replace(/^00/g, "+");
      // parse number
      const parsedNumber = parsePhoneNumber(number);

      // return country
      return parsedNumber
        ? countries.getName(parsedNumber.country, this.$root.currentLocale, {
            select: "official",
          })
        : null;
    },
    isNumber(value) {
      return value.includes('X') ? true: !Number.isNaN(Number(value)) ? true : false;
    },
    onApplyFilters() {
      this.sortedBy = "period";
      this.sortedDirection = "ascending";
    },
    dataUpdated() {
      let tableData = this.data;

      if (tableData && tableData.length) {
        // pre-process table data if it's a pivot table
        const isPivotTable = tableData[0].some((h) => {
          return h.includes("^pivot");
        });

        if (isPivotTable && tableData.length > 1) {
          tableData = this.processPivotTable();
        }

        let rawColumns = tableData[0];

        if (tableData.length > 1) {
          this.rows = tableData.slice(1);
          this.pagination.currentPage = 1;
          this.updatePagination();
        } else {
          this.rows = [];
        }
        this.parseColumns(rawColumns);
      } else {
        this.columns = [];
        this.rows = [];
      }
    },
    parseColumns(rawColumns) {
      let columns = [];
      let topHeaders = [];
      let middleHeaders = [];
      let bottomHeaders = [];

      rawColumns.forEach((rawColumn, index) => {
        let topHeader;
        let middleHeader;
        let bottomHeader;

        // examples of valid column names:
        // "queueName" -> simple column
        // "total£num" -> column with numeric format
        // "processed$total" -> "total" is a sub-header of "processed"
        // "processed$failed#" -> "failed" is a sub-header of "processed", but it is initially hidden; it will be shown when "processed" is expanded
        // "09:00-18:00$09:00-10:00$09:15" -> "09:15" ia a sub-header of "09:00-10:00", that is a sub-header of "09:00-18:00"

        const column = this.parseTableChartHeader(rawColumn);

        topHeader = topHeaders.find((header) => {
          return header.name == column.topHeaderName;
        });

        if (!topHeader) {
          // create top header
          topHeader = {
            name: column.topHeaderName,
            rawColumnName: rawColumn,
            format: column.topHeaderFormat,
            expanded: false,
            expandible: false,
            subHeaders: [],
            subSubHeaders: [],
            colNumber: index,
            colSpan: 0,
            hidable: false,
            visible: true,
          };
          topHeaders.push(topHeader);
        }

        if (column.middleHeaderName) {
          middleHeader = middleHeaders.find((header) => {
            return (
              header.name == column.middleHeaderName &&
              header.superHeader.name == column.topHeaderName
            );
          });

          if (!middleHeader) {
            // create middle header
            middleHeader = {
              name: column.middleHeaderName,
              rawColumnName: rawColumn,
              format: column.middleHeaderFormat,
              expanded: false,
              expandible: false,
              subHeaders: [],
              superHeader: topHeader,
              colNumber: index,
              colSpan: 0,
              hidable: false,
              visible: true,
            };
            middleHeaders.push(middleHeader);
          }
          topHeader.subHeaders.push(middleHeader);

          if (column.middleHeaderHidable) {
            middleHeader.hidable = true;
            middleHeader.visible = false;
            topHeader.expandible = true;
          } else {
            topHeader.colSpan++;
          }
        }

        if (column.bottomHeaderName) {
          // create bottom header
          bottomHeader = {
            name: column.bottomHeaderName,
            rawColumnName: rawColumn,
            format: column.bottomHeaderFormat,
            superHeader: middleHeader,
            superSuperHeader: topHeader,
            hidable: false,
            visible: middleHeader.visible,
            colNumber: index,
          };
          bottomHeaders.push(bottomHeader);
          middleHeader.subHeaders.push(bottomHeader);
          topHeader.subSubHeaders.push(bottomHeader);

          if (column.bottomHeaderHidable) {
            bottomHeader.hidable = true;
            bottomHeader.visible = false;
            middleHeader.expandible = true;
          } else {
            middleHeader.colSpan++;
          }
        }

        // add header to table columns

        if (bottomHeader) {
          columns.push(bottomHeader);
        } else if (middleHeader) {
          columns.push(middleHeader);
        } else {
          columns.push(topHeader);
        }
      });
      this.columns = columns;
      this.topHeaders = topHeaders;
      this.middleHeaders = middleHeaders;
      this.bottomHeaders = bottomHeaders;
    },
    expandHeader(header) {
      // set col span
      header.colSpan = header.subHeaders.length;

      if (header.subSubHeaders && header.subSubHeaders.length) {
        header.colSpan += header.subSubHeaders.length;
      }

      // set sub headers visible
      header.subHeaders.forEach((subHeader) => {
        subHeader.visible = true;
        this.columns[subHeader.colNumber].visible = true;
      });
    },
    collapseHeader(header) {
      let colSpan = 0;

      // set sub headers not visible
      header.subHeaders.forEach((subHeader) => {
        if (subHeader.hidable) {
          subHeader.visible = false;
          this.columns[subHeader.colNumber].visible = false;
        } else {
          colSpan++;
        }

        // recursively collapse sub header
        if (subHeader.expandible) {
          subHeader.expanded = false;
          this.collapseHeader(subHeader);
        }
      });

      // set col span
      header.colSpan = colSpan;
    },
    toggleExpandHeader(header) {
      header.expanded = !header.expanded;
      this.$root.$emit("expandTable", `#container_${this.chartKey}`);
      if (header.expanded) {
        this.expandHeader(header);
      } else {
        this.collapseHeader(header);
      }
    },
    processPivotTable() {
      let pivotColIndex = -1;
      let groupedColIndex = -1;
      let pivotMatch;
      let sumMatch;
      let pivotFormat;
      let superHeader;
      let totalSubHeader;
      let hoursHeader = false;
      let data = JSON.parse(JSON.stringify(this.data));
      const originalColumns = data[0];
      const originalRows = data.splice(1);

      // look for pivot and sum column indexes

      // e.g. double header
      // "time£num^pivot" -> pivot column. Every pivot value in original table will become a column
      // "09:00-18:00^sum_total£num" -> group column. A double header will be created, with "09:00-18:00" as super-header, and "total£num" and pivot values as sub-headers

      // e.g. triple header (additional hours header)
      // "time£num^pivot*" -> pivot column. Every pivot value in original table will become a column. "*" means that pivot values must be time intervals organized in sub-headers, e.g. "11:00-12:00" as super-header, and "11:00-11:15", "11:15-11:30", "11:30-11:45", "11:45-12:00" as sub-headers
      // "09:00-18:00^sum_total£num" -> group column. An additional hours header will be created, with "09:00-18:00" as super-header, and "total£num" and pivot hours (e.g. "11:00-12:00", "12:00-13:00") as sub-headers

      for (const [index, rawColumn] of originalColumns.entries()) {
        pivotMatch = /^[^£#]+(£[^#]+)?\^pivot(Group)?$/.exec(rawColumn);
        if (pivotMatch) {
          pivotColIndex = index;

          if (pivotMatch[1]) {
            pivotFormat = pivotMatch[1];
          } else {
            pivotFormat = "";
          }

          if (pivotMatch[2]) {
            hoursHeader = true;
          }
          continue;
        }

        sumMatch = /([^^]+)\^sum_(.+)/.exec(rawColumn);
        if (sumMatch) {
          groupedColIndex = index;
          superHeader = sumMatch[1];
          totalSubHeader = sumMatch[2];
          continue;
        }
      }

      if (hoursHeader) {
        return this.processPivotTableWithHoursHeader(
          originalColumns,
          originalRows,
          pivotColIndex,
          groupedColIndex,
          pivotFormat,
          superHeader,
          totalSubHeader
        );
      }

      // read pivot data from rows

      // contains pivotGroup -> pivotColumn -> number (e.g. 2019QueueNameQueueDescription -> hour -> numberOfCalls)
      let pivotMap = {};

      // contains totals for all hours grouped
      let totalsMap = {};

      // contains the list of non pivot columns, organized by pivot group
      // e.g:
      // {
      //   2019FirstQueueNameFirstQueueDescription: [ "2019", "FirstQueueName", "FirstQueueDescription"],
      //   2019SecondQueueNameSecondQueueDescription: [ "2019", "SecondQueueName", "SecondQueueDescription"],
      //   ...
      // }
      let nonPivotColumnsMap = {};

      for (const row of originalRows) {
        // detect when pivot group changes, i.e. when a non-pivot related column changes

        let pivotGroup = "";
        let nonPivotColumns = [];

        for (const [colIndex, value] of row.entries()) {
          if (colIndex >= pivotColIndex) {
            nonPivotColumnsMap[pivotGroup] = nonPivotColumns;
            break;
          } else {
            pivotGroup += value;
            nonPivotColumns.push(value);
          }
        }

        const pivotColumn = row[pivotColIndex]; // e.g. "09:15"
        const pivotValue = parseInt(row[groupedColIndex]); // e.g. 147

        // add pivot value to pivotMap

        if (!pivotMap[pivotGroup]) {
          pivotMap[pivotGroup] = {};
        }

        pivotMap[pivotGroup][pivotColumn] = pivotValue;

        // add pivot value to totalsMap

        if (totalsMap[pivotGroup] === undefined) {
          totalsMap[pivotGroup] = 0;
        }
        totalsMap[pivotGroup] += pivotValue;
      }
      const pivotColumnsList = this.generateTimeLabelsLineOrBarChart(
        this.officeHours,
        this.filterTimeSplit,
        this
      );

      // process column headers

      let processedColumns = [];
      originalColumns.forEach((rawColumn, index) => {
        if (index < pivotColIndex) {
          processedColumns.push(rawColumn);
        } else if (index == pivotColIndex) {
          // add sum column
          processedColumns.push(superHeader + "$" + totalSubHeader);

          // add pivot columns
          for (let pivotColumn of pivotColumnsList) {
            processedColumns.push(
              superHeader + "$" + pivotColumn + pivotFormat + "#"
            );
          }
        }
      });

      // process rows

      let processedRows = [];
      const pivotGroupsList = Object.keys(pivotMap).sort();

      pivotGroupsList.forEach((pivotGroup) => {
        let processedRow = [];

        // non-pivot columns
        processedRow.push(...nonPivotColumnsMap[pivotGroup]);

        // total
        processedRow.push(totalsMap[pivotGroup] || 0);

        pivotColumnsList.forEach((pivotColumn) => {
          processedRow.push(pivotMap[pivotGroup][pivotColumn] || 0);
        });
        processedRows.push(processedRow);
      });
      return [processedColumns].concat(processedRows);
    },
    processPivotTableWithHoursHeader(
      originalColumns,
      originalRows,
      pivotColIndex,
      groupedColIndex,
      pivotFormat,
      superHeader,
      totalSubHeader
    ) {
      // e.g: [ 09:00, 10:00, 11:00, ... ]
      let hoursList;

      // e.g:
      // {
      //   "09:00": [ "09:00", "09:15", "09:30", "09:45" ],
      //   "10:00": [ "10:00", "10:15", "10:30", "10:45" ],
      //   "11:00": [ "11:00", "11:15", "11:30", "11:45" ],
      //   ...
      // }
      let hoursMap = this.generateHoursMap(
        this.officeHours,
        this.filterTimeSplit,
        this
      );

      // contains pivotGroup -> hour -> pivotColumn -> number (e.g. 2019QueueNameQueueDescription -> 09:00 -> 09:45 -> 2345)
      let pivotMap = {};

      // contains totals for every hour and for all hours grouped
      let totalsMap = {};

      // contains the list of non pivot columns, organized by pivot group
      // e.g:
      // {
      //   2019FirstQueueNameFirstQueueDescription: [ "2019", "FirstQueueName", "FirstQueueDescription"],
      //   2019SecondQueueNameSecondQueueDescription: [ "2019", "SecondQueueName", "SecondQueueDescription"],
      //   ...
      // }
      let nonPivotColumnsMap = {};

      // read pivot data from rows

      for (const row of originalRows) {
        // detect when pivot group changes, i.e. when a non-pivot related column changes

        let pivotGroup = "";
        let nonPivotColumns = [];

        for (const [colIndex, value] of row.entries()) {
          if (colIndex >= pivotColIndex) {
            nonPivotColumnsMap[pivotGroup] = nonPivotColumns;
            break;
          } else {
            pivotGroup += value;
            nonPivotColumns.push(value);
          }
        }

        const pivotColumn = row[pivotColIndex]; // e.g. "09:45"
        const pivotValue = parseInt(row[groupedColIndex]); // e.g. 2345

        // organize pivot columns by hour (e.g. "09:00", "09:15", "09:30", "09:45" go under the header "09:00")

        const hour = pivotColumn.slice(0, 2) + ":00";

        // add pivot value to pivotMap

        if (!pivotMap[pivotGroup]) {
          pivotMap[pivotGroup] = {};
        }

        if (!pivotMap[pivotGroup][hour]) {
          pivotMap[pivotGroup][hour] = {};
        }
        pivotMap[pivotGroup][hour][pivotColumn] = pivotValue;

        // add pivot value to totalsMap (all hours and single hour)

        if (!totalsMap[pivotGroup]) {
          totalsMap[pivotGroup] = {};
          totalsMap[pivotGroup][superHeader] = 0;
        }
        totalsMap[pivotGroup][superHeader] += pivotValue;

        if (!totalsMap[pivotGroup][hour]) {
          totalsMap[pivotGroup][hour] = 0;
        }
        totalsMap[pivotGroup][hour] += pivotValue;
      }

      hoursList = Object.keys(hoursMap).sort();

      // process column headers

      let processedColumns = [];

      originalColumns.forEach((rawColumn, index) => {
        if (index < pivotColIndex) {
          processedColumns.push(rawColumn);
        } else if (index == pivotColIndex) {
          // add sum column
          processedColumns.push(superHeader + "$" + totalSubHeader);

          // add pivot hours header
          for (let hour of hoursList) {
            processedColumns.push(
              superHeader + "$" + hour + "#$" + totalSubHeader
            );

            hoursMap[hour].forEach((pivotColumn) => {
              processedColumns.push(
                superHeader +
                  "$" +
                  hour +
                  "#$" +
                  pivotColumn +
                  pivotFormat +
                  "#"
              );
            });
          }
        }
      });

      // process rows

      let processedRows = [];

      const pivotGroupsList = Object.keys(pivotMap).sort();

      pivotGroupsList.forEach((pivotGroup) => {
        let processedRow = [];

        // non-pivot columns
        processedRow.push(...nonPivotColumnsMap[pivotGroup]);

        // all hours total
        processedRow.push(totalsMap[pivotGroup][superHeader] || 0);

        hoursList.forEach((hour) => {
          // hour total
          processedRow.push(totalsMap[pivotGroup][hour] || 0);

          hoursMap[hour].forEach((pivotColumn) => {
            // pivotColumn e.g. "09:45"
            if (
              pivotMap[pivotGroup][hour] &&
              pivotMap[pivotGroup][hour][pivotColumn]
            ) {
              processedRow.push(pivotMap[pivotGroup][hour][pivotColumn]);
            } else {
              // missing data
              processedRow.push(0);
            }
          });
        });
        processedRows.push(processedRow);
      });

      return [processedColumns].concat(processedRows);
    },
    setRowsPerPage(value) {
      this.pagination.rowsPerPage = value;
      this.updatePagination();

      // save number of rows per page to local storage
      this.set(this.ROWS_PER_PAGE_KEY, this.pagination.rowsPerPage);
    },
    previousPage() {
      if (this.pagination.currentPage > 1) {
        this.pagination.currentPage--;
        this.updatePagination();
      }
    },
    nextPage() {
      if (this.pagination.currentPage < this.pagination.totalPages) {
        this.pagination.currentPage++;
        this.updatePagination();
      }
    },
    firstPage() {
      this.pagination.currentPage = 1;
      this.updatePagination();
    },
    lastPage() {
      this.pagination.currentPage = this.pagination.totalPages;
      this.updatePagination();
    },
    updatePagination() {
      this.pagination.totalPages = Math.ceil(
        this.rows.length / this.pagination.rowsPerPage
      );

      // validate currentPage
      if (
        isNaN(this.pagination.currentPage) ||
        this.pagination.currentPage < 1
      ) {
        this.pagination.currentPage = 1;
      } else if (this.pagination.currentPage > this.pagination.totalPages) {
        this.pagination.currentPage = this.pagination.totalPages;
      }

      this.pagination.firstRowIndex =
        (this.pagination.currentPage - 1) * this.pagination.rowsPerPage;
      this.pagination.lastRowIndex =
        this.pagination.firstRowIndex + this.pagination.rowsPerPage;
      this.pagination.pageRows = this.rows.slice(
        this.pagination.firstRowIndex,
        this.pagination.lastRowIndex
      );
    },
    sortTable(header, event) {
      // check if the header is sortable
      if (event.target.classList.contains("not-sortable")) return;
      // switch the ordering direction in the header currently sorted by
      this.sortedDirection == "ascending" && this.sortedBy == header.rawColumnName
        ? (this.sortedDirection = "descending")
        : (this.sortedDirection = "ascending");
      // set the header currently sorted by
      this.sortedBy = header.rawColumnName;
      // get the header's column position in the rows array
      let columnKey = this.columns.indexOf(
        this.columns.find((obj) => obj.rawColumnName === header.rawColumnName)
      );
      // sort table considering direction and column data type
      this.rows.sort((a, b) => {
        let rule;
        // check if is date
        if (header.format && header.format.toLowerCase().includes("date")) {
          rule =
            this.sortedDirection == "ascending"
              ? Date.parse(a[columnKey]) - Date.parse(b[columnKey])
              : Date.parse(b[columnKey]) - Date.parse(a[columnKey]);
        } else {
          // check if is a number
          if (!Number.isNaN(Number(a[columnKey]))) {
            rule =
              this.sortedDirection == "ascending"
                ? a[columnKey] - b[columnKey]
                : b[columnKey] - a[columnKey];
          } else {
            // if is a string
            this.sortedDirection == "ascending"
              ? (rule =
                  a[columnKey] < b[columnKey]
                    ? -1
                    : a[columnKey] > b[columnKey]
                    ? 1
                    : 0)
              : (rule =
                  b[columnKey] < a[columnKey]
                    ? -1
                    : b[columnKey] > a[columnKey]
                    ? 1
                    : 0);
          }
        }
        return rule;
      });
      this.updatePagination();
    },
    getQueueTooltip(queueNum) {
      let tooltipContent =
        '<div><b class="mg-right-xs">' +
        this.$t("misc.queue") +
        "</b>" +
        queueNum;
      ("</div>");
      return tooltipContent;
    },
    getContactTooltip(value) {
      return (
        "<div><b class='mg-right-xs'>" +
        this.$t("misc.contact") +
        "</b>" +
        value +
        "</div>"
      );
    },
    getCallGroupUserTooltip(extension) {
      let tooltipContent =
        '<div><b class="mg-right-xs">' +
        this.$t("misc.extension") +
        "</b>" +
        extension +
        "</div>";

      // device
      if (this.$root.devices[extension]) {
        tooltipContent += this.getDeviceTooltip(extension);
      } else {
        tooltipContent +=
          '<div><b class="mg-right-xs">' +
          this.$t("device.type") +
          "</b> - </div>";
      }
      return tooltipContent;
    },
    getUserTooltip(extension, rowIndex, row) {
      let mainExtension = "-";

      // find main extension

      if (
        this.columns[rowIndex].name == "src" &&
        (this.$route.meta.view == "outbound" ||
          this.$route.meta.view == "local") &&
        row[this.colIndex("accountcode")]
      ) {
        // for outbound calls, main extension of src is accountcode value
        mainExtension = row[this.colIndex("accountcode")];
      } else if (
        this.columns[rowIndex].name == "dst" &&
        this.$route.meta.view == "inbound" &&
        row[this.colIndex("peeraccount")]
      ) {
        // for inbound calls, main extension of dst is peeraccount value
        mainExtension = row[this.colIndex("peeraccount")];
      }

      // main extension
      let tooltipContent =
        '<div><b class="mg-right-xs">' +
        this.$t("misc.main_extension") +
        "</b>" +
        mainExtension +
        "</div>";

      // actual extension
      tooltipContent +=
        '<div><b class="mg-right-xs">' +
        this.$t("misc.actual_extension") +
        "</b>" +
        extension +
        "</div>";

      // device
      if (this.$root.devices[extension]) {
        tooltipContent += this.getDeviceTooltip(extension);
      } else {
        tooltipContent +=
          '<div><b class="mg-right-xs">' +
          this.$t("device.type") +
          "</b> - </div>";
      }

      return tooltipContent;
    },
    colIndex(columnName) {
      return this.columns.findIndex((col) => col.name == columnName);
    },
    getDeviceTooltip(extension) {
      let tooltipContent =
        '<div><b class="mg-right-xs">' +
        this.$t("device.type") +
        "</b>" +
        this.$t("device." + this.$root.devices[extension].type) +
        "</div>";

      if (this.$root.devices[extension].model) {
        tooltipContent +=
          '<div><b class="mg-right-xs">' +
          this.$t("device.model") +
          "</b>" +
          this.$root.devices[extension].vendor +
          " " +
          this.$root.devices[extension].model +
          "</div>";
      }
      return tooltipContent;
    },
    reversePhonebookSearch(element) {
      const found = this.$options.filters.reversePhonebookLookup(
        element,
        "name",
        this.$root
      );
      return found !== "-";
    },
  },
};
</script>

<style lang="scss" scoped>
.table-container {
  position: relative;
  .ui.pagination .select-rows-per-page .menu {
    margin-bottom: 5px;
    margin-left: -1px;
  }
  .table {
    margin-bottom: 0px;
    margin-top: 0px;
  }
  .not-sortable {
    background: #f9fafb !important;
    cursor: default !important;
  }
}
</style>
