var UtilService = {
  data() {
    return {
      filterValuesCacheDuration: false,
    }
  },
  methods: {
    moment(...args) {
      return window.moment(...args);
    },
    sortByProperty(property) {
      return function (a, b) {
        if (a[property] < b[property]) {
          return -1;
        }
        if (a[property] > b[property]) {
          return 1;
        }
        return 0;
      }
    },
    isFilterInView(filter, map) {
      const report = this.$route.meta.report;
      const section = this.$route.meta.section;
      const view = this.$route.meta.view;

      if (section && view) {
        return map[report][section][view].includes(filter);
      } else {
        return false;
      }
    },
    saveToLocalStorageWithExpiry(key, item, ttlMinutes) {
      // save an object to local storage attaching its expiry date
      const expiry = new Date().getTime() + ttlMinutes * 60 * 1000;
      this.set(key, { item: item, expiry: expiry });
    },
    formatValue(value, format, currency) {
      switch (format) {
        case "num":
          return this.$options.filters.formatNumber(value);
        case "seconds":
          return this.$options.filters.formatTime(value);
        case "percent":
          return this.$options.filters.formatPercentage(value);
        case "label":
          return this.$i18n ? this.$i18n.t(value) : value;
        case "yearDate":
          // no formatting needed
          return value;
        case "monthDate":
          return this.$options.filters.formatMonthDate(value);
        case "weekDate":
          return this.$options.filters.formatWeekDate(value, this.$i18n);
        case "dayDate":
          // no formatting needed
          return value;
        case "queue":
          return this.$root.queues[value];
        case "twoDecimals":
          return this.$options.filters.formatTwoDecimals(value);
        case "currency":
          return this.$options.filters.formatCurrency(value, currency);
        case "month":
          return this.$options.filters.formatMonth(value);
        default:
          return value;
      }
    },
    watchDataLineOrBarChart(that) {
      if (!that.data || that.data.length <= 1) {
        // no data
        return;
      }

      that.labels = [];
      that.datasets = [];

      that.labelFormat = that.data[0][1].split("£")[1];
      that.valueFormat = that.data[0][2].split("£")[1];

      // remove first element (query columns)
      let rows = that.data.filter((_, i) => i !== 0);

      // if there are too many datasets, keep only most relevant ones
      rows = that.checkTooManyDataLineOrBarChart(rows, that);

      // build a data structure (datasetMap) like this:
      // {
      //   datasetName: {2018: 0, 2019: 18, 2020: 4}
      //   otherDatasetName: {2018: 0, 2019: 39, 2020: 210}
      //   yetAnotherDataset: {2018: 0, 2019: 526, 2020: 28}
      // }

      let labelSet = new Set();
      let datasetNameSet = new Set();
      let datasetMap = {};
      let officeHoursLabels = false;

      // if labels match HH:mm, generate all labels using office hours and time split
      if (/^[0-2][0-9]:[0-5][0-9]$/.test(rows[0][1])) {
        officeHoursLabels = true;
        labelSet = that.generateTimeLabelsLineOrBarChart(that.officeHours, that.filterTimeSplit, that);
      }

      rows.forEach((row) => {
        datasetNameSet.add(row[0]);

        if (!officeHoursLabels) {
          labelSet.add(row[1]);
        }
      });

      datasetNameSet.forEach((datasetName) => {
        datasetMap[datasetName] = {};
      });

      rows.forEach((row) => {
        const datasetName = row[0];
        const label = row[1];
        const value = parseFloat(row[2]);

        datasetMap[datasetName][label] = value;
      });

      that.labels = Array.from(labelSet).sort();

      // add missing data with zero values

      for (const [datasetName, data] of Object.entries(datasetMap)) {
        const labels = Object.keys(data);
        let missingLabels = that.labels.filter((l) => !labels.includes(l));

        missingLabels.forEach((missingLabel) => {
          datasetMap[datasetName][missingLabel] = 0;
        });
      }

      // initialize chart data

      Object.entries(datasetMap).forEach(([datasetName, data]) => {
        let datasetValues = [];

        that.labels.forEach((label) => {
          datasetValues.push(data[label]);
        });

        that.datasets.push({
          label: that.formatLineOrBarChartDatasetName(datasetName, that),
          data: datasetValues,
          fill: false,
        });
      });

      // format labels
      that.labels = that.labels.map(l => this.formatValue(l, that.labelFormat, that.$parent.$data.adminSettings.currency));

      // render chart

      const chartData = {
        labels: that.labels,
        datasets: that.datasets,
      };
      that.chartData = chartData;
      that.renderChart(that.chartData, that.options);
    },
    formatLineOrBarChartDatasetName(datasetName, that) {
      const format = datasetName.split("£")[1];

      if (format) {
        const datasetWithoutFormat = datasetName.split("£")[0];
        return that.formatValue(datasetWithoutFormat, format);
      } else {
        return that.$te("caption." + datasetName) ? that.$t("caption." + datasetName) : datasetName
      }
    },
    parseTableChartHeader(rawColumn) {
      const colRegex = /^([^$£#]+)(?:£([^$£#]+))?(?:\$([^$£#]+)(?:£([^$£#]+))?(#)?)?(?:\$([^$£#]+)(?:£([^$£#]+))?(#)?)?$/;
      const match = colRegex.exec(rawColumn);

      return {
        topHeaderName: match[1],
        topHeaderFormat: match[2],
        middleHeaderName: match[3],
        middleHeaderFormat: match[4],
        middleHeaderHidable: match[5],
        bottomHeaderName: match[6],
        bottomHeaderFormat: match[7],
        bottomHeaderHidable: match[8],
      };
    },
    checkTooManyDataLineOrBarChart(rows, that) {
      const datasetSet = new Set();
      let tooMany = false;

      for (let row of rows) {
        datasetSet.add(row[0]);

        if (datasetSet.size > that.$parent.MAX_CHART_ENTRIES) {
          tooMany = true;
          break;
        }
      }

      if (!tooMany) {
        // return all input rows
        return rows;
      } else {
        // too many entries, merge some of them
        return that.mergeMinorEntriesLineOrBarChart(rows, that);
      }
    },
    mergeMinorEntriesLineOrBarChart(rows, that) {
      let datasetTotalMap = {};

      rows.forEach((row) => {
        const datasetName = row[0];
        const datasetValue = Number(row[2]);

        if (datasetTotalMap[datasetName] === undefined) {
          datasetTotalMap[datasetName] = 0;
        }
        datasetTotalMap[datasetName] += datasetValue;
      });

      const datasetTotalList = Object.keys(datasetTotalMap).map((datasetName) => {
        return { name: datasetName, total: datasetTotalMap[datasetName] }
      });

      // sort
      const datasetTotalListSorted = datasetTotalList.sort(that.sortByProperty("total")).reverse();

      // extract most relevant datasets
      const topDatasetNames = datasetTotalListSorted.filter((_, i) => i < that.$parent.MAX_CHART_ENTRIES - 1).map(dataset => dataset.name);
      let topDatasetsRows = [];
      let others = {};

      rows.forEach(row => {
        const datasetName = row[0];

        if (topDatasetNames.includes(datasetName)) {
          topDatasetsRows.push(row);
        } else {
          // put data into "Others" dataset
          const label = row[1];
          const value = Number(row[2]);

          if (others[label] === undefined) {
            others[label] = 0;
          }
          others[label] += value;
        }
      });

      let othersRows = [];

      for (const [label, value] of Object.entries(others)) {
        othersRows.push([that.$i18n.t("misc.others"), label, value]);
      }

      return topDatasetsRows.concat(othersRows);
    },
    getMomentStartOfHour(timeString) {
      // returns a moment object that represents today at the start of hour specified by timeString
      // e.g. timestring: 09:35 -> 09:00
      // e.g. timestring: 10:00 -> 10:00
      let momentTime = this.moment().zone('GMT');

      // timeString is expressed in HH:mm format
      let hhmm = timeString.split(/:/);
      momentTime.hours(parseInt(hhmm[0])).startOf('hour');
      return momentTime;
    },
    getMomentNextHour(timeString) {
      // returns a moment object that represents today at the next hour specified by timeString
      // e.g. timestring: 09:25 -> 10:00
      // e.g. timestring: 10:00 -> 10:00
      let momentTime = this.moment().zone('GMT');

      // timeString is expressed in HH:mm format
      let hhmm = timeString.split(/:/);

      momentTime.hours(parseInt(hhmm[0])).minutes(parseInt(hhmm[1])).seconds(0).milliseconds(0);

      if (momentTime.minutes() == 0) {
        return momentTime;
      } else {
        return momentTime.startOf('hour').add(1, 'hour');
      }
    },
    generateTimeLabelsLineOrBarChart(officeHours, timeSplit, that) {
      let labelSet = new Set();
      const officeHoursStartString = officeHours.startHour;
      const officeHoursEndString = officeHours.endHour;
      let hourStart = that.getMomentStartOfHour(officeHoursStartString);
      let hourEnd = that.getMomentNextHour(officeHoursEndString);
      let currentTime = hourStart;

      while (currentTime.isBefore(hourEnd)) {
        labelSet.add(currentTime.format("HH:mm"));
        currentTime.add(timeSplit, "minutes");
      }
      labelSet.add(currentTime.format("HH:mm"));
      return labelSet;
    },
    generateHoursMap(officeHours, timeSplit, that) {
      const officeHoursStartString = officeHours.startHour;
      const officeHoursEndString = officeHours.endHour;

      let hourStart = that.getMomentStartOfHour(officeHoursStartString);
      let hourEnd = that.getMomentNextHour(officeHoursEndString);

      let currentHourString = hourStart.format("HH:mm");
      let hoursMap = {};
      hoursMap[currentHourString] = [currentHourString];
      let currentTime = hourStart.add(timeSplit, "minutes");

      while (currentTime.isBefore(hourEnd)) {
        let currentTimeString = currentTime.format("HH:mm");

        if (currentTime.minutes() == 0) {
          hoursMap[currentTimeString] = [currentTimeString];
          currentHourString = currentTimeString;
        } else {
          hoursMap[currentHourString].push(currentTimeString);
        }
        currentTime.add(timeSplit, "minutes");
      }
      let currentTimeString = currentTime.format("HH:mm");
      hoursMap[currentTimeString] = [currentTimeString];
      return hoursMap;
    },
    getToday() {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return today;
    },
    getYesterday(startOrEnd = "start") {
      const yesterday = this.moment().subtract(1, 'day');

      if (startOrEnd == "start") {
        return yesterday.startOf('day').toDate();
      } else {
        return yesterday.endOf('day').toDate();
      }
    },
    getLastTwoDays(startOrEnd) {
      const twoDaysAgo = this.moment().subtract(2, 'day');

      if (startOrEnd == "start") {
        return twoDaysAgo.startOf('day').toDate();
      } else {
        return twoDaysAgo.endOf('day').toDate();
      }
    },
    getCurrentWeek(startOrEnd) {
      const today = this.moment();

      if (startOrEnd == "start") {
        return today.isoWeekday(1).startOf('day').toDate();
      } else {
        return today.isoWeekday(7).endOf('day').toDate();
      }
    },
    getCurrentMonth(startOrEnd) {
      const today = this.moment();

      if (startOrEnd == "start") {
        return today.startOf('month').toDate();
      } else {
        return today.endOf('month').toDate();
      }
    },
    getLastThreeMonths(startOrEnd) {
      const threeMonthsAgo = this.moment().subtract(3, 'months');

      if (startOrEnd == "start") {
        return threeMonthsAgo.startOf('day').toDate();
      } else {
        return threeMonthsAgo.endOf('day').toDate();
      }
    },
    getCurrentYear(startOrEnd) {
      const currentYear = this.moment();

      if (startOrEnd == "start") {
        return currentYear.startOf('year').toDate();
      } else {
        return currentYear.endOf('year').toDate();
      }
    },
    getLastWeek(startOrEnd) {
      const aWeekAgo = this.moment().subtract(1, 'week');

      if (startOrEnd == "start") {
        return aWeekAgo.startOf('day').toDate();
      } else {
        return aWeekAgo.endOf('day').toDate();
      }
    },
    getLastTwoWeeks(startOrEnd) {
      const twoWeeksAgo = this.moment().subtract(2, 'weeks');

      if (startOrEnd == "start") {
        return twoWeeksAgo.startOf('day').toDate();
      } else {
        return twoWeeksAgo.endOf('day').toDate();
      }
    },
    getLastMonth(startOrEnd) {
      const aMonthAgo = this.moment().subtract(1, 'month');

      if (startOrEnd == "start") {
        return aMonthAgo.startOf('day').toDate();
      } else {
        return aMonthAgo.endOf('day').toDate();
      }
    },
    getLastTwoMonths(startOrEnd) {
      const twoMonthsAgo = this.moment().subtract(2, 'months');

      if (startOrEnd == "start") {
        return twoMonthsAgo.startOf('day').toDate();
      } else {
        return twoMonthsAgo.endOf('day').toDate();
      }
    },
    getLastSixMonths(startOrEnd) {
      const sixMonthsAgo = this.moment().subtract(6, 'months');

      if (startOrEnd == "start") {
        return sixMonthsAgo.startOf('day').toDate();
      } else {
        return sixMonthsAgo.endOf('day').toDate();
      }
    },
    getLastYear(startOrEnd) {
      const aYearAgo = this.moment().subtract(1, 'year');

      if (startOrEnd == "start") {
        return aYearAgo.startOf('day').toDate();
      } else {
        return aYearAgo.endOf('day').toDate();
      }
    },
    getLastTwoYears(startOrEnd) {
      const twoYearsAgo = this.moment().subtract(2, 'years');

      if (startOrEnd == "start") {
        return twoYearsAgo.startOf('day').toDate();
      } else {
        return twoYearsAgo.endOf('day').toDate();
      }
    },
    getLastThreeYears(startOrEnd) {
      const threeYearsAgo = this.moment().subtract(3, 'years');

      if (startOrEnd == "start") {
        return threeYearsAgo.startOf('day').toDate();
      } else {
        return threeYearsAgo.endOf('day').toDate();
      }
    },
    getPastPeriod(startOrEnd, periodName, num = 1) {
      const pastPeriod = this.moment().subtract(num, periodName);

      if (startOrEnd == "start") {
        return pastPeriod.startOf(periodName).toDate();
      } else {
        return pastPeriod.endOf(periodName).toDate();
      }
    },
    fromToday(date) {
      return date > this.getYesterday('end');
    },
    getDateFormat() {
      let dateFormat = "";
      const timeGroup = this.showFilterTimeGroup ? this.filter.time.group : "day";

      switch (timeGroup) {
        case "year":
          dateFormat = "YYYY";
          break;
        case "month":
          dateFormat = "YYYY-MM";
          break;
        case "week":
          dateFormat = "GGGG-[W]WW";
          break;
        case "day":
          if (this.showFilterTimeHour) {
            dateFormat = "YYYY-MM-DD HH:mm";
          } else {
            dateFormat = "YYYY-MM-DD";
          }
          break;
      }
      return dateFormat;
    }
  }
};
export default UtilService;
