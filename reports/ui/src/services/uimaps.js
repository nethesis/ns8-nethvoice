var UiMaps = {
  data() {
    return {
      filtersMap: {
        "queue": {
          "dashboard": {
            "default": ["time", "queue", "agent", "ivr", "choice"],
          },
          "data": {
            "summary": ["timeGroup", "time", "queue", "agent"],
            "agent": ["timeGroup", "time", "queue", "agent"],
            "session": ["time", "hour", "queue", "reason", "agent"],
            "caller": ["timeGroup", "time", "queue", "caller", "contactName"],
            "call": ["time", "hour", "queue", "caller", "contactName", "agent", "result"],
            "lost_call": ["timeGroup", "time", "queue", "caller", "contactName", "reason"],
            "ivr": ["timeGroup", "time", "ivr", "choice"]
          },
          "performance": {
            "default": ["timeGroup", "time", "queue"]
          },
          "distribution": {
            "hourly": ["timeGroup", "time", "queue", "timeSplit", "agent", "ivr"],
            "geographic": ["timeGroup", "time", "queue", "origin", "geoGroup"],
          },
          "graphs": {
            "load": ["timeGroup", "time", "queue", "origin"],
            "hour": ["time", "queue", "agent", "ivr", "choice"],
            "agent": ["timeGroup", "time", "queue", "agent"],
            "area": ["timeGroup", "time", "queue"],
            "queue_position": ["time", "queue", "timeSplit"],
            "avg_duration": ["time", "queue", "timeSplit"],
            "avg_wait": ["time", "queue", "timeSplit"],
            "recall": ["time", "queue", "agent"],
          }
        },
        "cdr": {
          "dashboard": {
            "default": ["cdr_dashboardTimeRange", "hour", "cdr_did", "cdr_trunk"],
          },
          "pbx": {
            "inbound": ["cdr_timeRange", "hour", "cdr_caller", "cdr_callee", "cdr_did", "cdr_callType", "cdr_callDuration", "cdr_trunk", "cdr_callDestination"],
            "outbound": ["cdr_timeRange", "hour", "cdr_caller", "cdr_callee", "cdr_did", "cdr_callType", "cdr_callDuration", "cdr_trunk", "cdr_destination"],
            "local": ["cdr_timeRange", "hour", "cdr_caller", "cdr_callee", "cdr_did", "cdr_callType", "cdr_callDuration"],
          },
          "personal": {
            "inbound": ["cdr_timeRange", "hour", "cdr_caller", "cdr_did", "cdr_callType", "cdr_callDuration", "cdr_trunk", "cdr_callDestination"],
            "outbound": ["cdr_timeRange", "hour", "cdr_callee", "cdr_did", "cdr_callType", "cdr_callDuration", "cdr_trunk", "cdr_destination"],
            "local": ["cdr_timeRange", "hour", "cdr_did", "cdr_callType", "cdr_callDuration"],
          },
        }
      },
      groupByTimeValuesMap: [
        { value: "day", text: this.$i18n.t('filter.day') },
        { value: "week", text: this.$i18n.t('filter.week') },
        { value: "month", text: this.$i18n.t('filter.month') },
        { value: "year", text: this.$i18n.t('filter.year') },
      ],
      splitByTimeValuesMap: [
        { value: "60", text: "1 hour" },
        { value: "30", text: "30 minutes" },
        { value: "15", text: "15 minutes" },
        { value: "10", text: "10 minutes" },
      ],
      geoGroupValuesMap: [
        { value: "regione", text: this.$i18n.t('filter.region') },
        { value: "provincia", text: this.$i18n.t('filter.province') },
        { value: "comune", text: this.$i18n.t('filter.district') },
        { value: "prefisso", text: this.$i18n.t('filter.area_code') },
      ],
      cdrTimeRangeValues: [
        "yesterday", "last_two_days", "last_week", "last_month", "last_two_months", "last_three_months", "last_six_months",  "last_year", "current_week", "past_week", "current_month", "past_month", "current_year", "past_year"
      ],
      cdrCallDurationMap: [
        { value: "60", title: this.$i18n.t('filter.one_minute') },
        { value: "300", title: this.$i18n.t('filter.five_minutes') },
        { value: "900", title: this.$i18n.t('filter.fifteen_minutes') },
        { value: "1800", title: this.$i18n.t('filter.thirty_minutes') },
        { value: "3600", title: this.$i18n.t('filter.one_hour') },
        { value: "7200", title: this.$i18n.t('filter.two_hours') }
      ],
      cdrCallTypeMap: [
        { value: "ANSWERED", text: this.$i18n.t('filter.answered') },
        { value: "NO ANSWER", text: this.$i18n.t('filter.no_answer') },
        { value: "BUSY", text: this.$i18n.t('filter.busy') },
        { value: "FAILED", text: this.$i18n.t('filter.failed') }
      ],
      callDestinationsMap: [
        { value: "dcontext,ext-group", text: this.$i18n.t('filter.call_groups') },
        { value: "lastapp,VoiceMail", text: this.$i18n.t('filter.voicemails') },
        { value: "lastapp,queue", text: this.$i18n.t('filter.queues') },
      ],
      calleeTypeMap: [
        { value: "mobile", text: this.$i18n.t('filter.mobile') },
        { value: "international", text: this.$i18n.t('filter.international') },
        { value: "fixed", text: this.$i18n.t('filter.fixed') },
      ]
    }
  },
  methods: {
    moment(...args) {
      return window.moment(...args);
    },
    cdrDashboardTimeRangeValuesMap() {
      const timeRangeOptions = [
        { value: "past_week", text: this.$i18n.t('filter.past_week') },
        { value: "past_month", text: this.$i18n.t('filter.past_month') },
        { value: "past_quarter", text: this.$i18n.t('filter.past_quarter') },
        { value: "past_semester", text: this.$i18n.t('filter.past_semester') },
        { value: "past_year", text: this.$i18n.t('filter.past_year') },
      ];

      // current_week: only if today is not Monday

      if (this.moment().isoWeekday() !== 1) {
        const currentWeek = { value: "current_week", text: this.$i18n.t('filter.current_week') };
        timeRangeOptions.push(currentWeek);
      }

      // current_month: only if today is not the first day of month

      if (this.moment().date() !== 1) {
        const currentMonth = { value: "current_month", text: this.$i18n.t('filter.current_month') };
        timeRangeOptions.push(currentMonth);
      }

      // current_year: only if today is not the first day of year

      if (this.moment().dayOfYear() !== 1) {
        const currentYear = { value: "current_year", text: this.$i18n.t('filter.current_year') };
        timeRangeOptions.push(currentYear);
      }
      return timeRangeOptions;
    },
  },
}
export default UiMaps;
