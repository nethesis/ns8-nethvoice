<!--
  Copyright (C) 2024 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->
<template>
  <cv-grid fullWidth>
    <cv-row>
      <cv-column class="page-title">
        <h2>{{ $t("hotel.title") }}</h2>
      </cv-column>
    </cv-row>
    <cv-row>
      <cv-column>
        <ResumeConfigNotification
          v-if="!isAppConfigured && !isShownFirstConfigurationModal"
        />
      </cv-column>
    </cv-row>
    <cv-row v-if="error.getHotel">
      <cv-column>
        <NsInlineNotification
          kind="error"
          :title="$t('action.get-hotel')"
          :description="error.getHotel"
          :showCloseButton="false"
        />
      </cv-column>
    </cv-row>
    <cv-row>
      <cv-column>
        <cv-tile light>
          <cv-skeleton-text
            v-if="loading.getHotel"
            :paragraph="true"
            heading
            :line-count="5"
          ></cv-skeleton-text>
          <cv-form v-else @submit.prevent="setHotel"> </cv-form>
        </cv-tile>
      </cv-column>
    </cv-row>
  </cv-grid>
</template>

<script>
// import to from "await-to-js"; ////
import { mapState } from "vuex";
import {
  QueryParamService,
  UtilService,
  TaskService,
  IconService,
  PageTitleService,
} from "@nethserver/ns8-ui-lib";
import ResumeConfigNotification from "@/components/first-configuration/ResumeConfigNotification.vue";

//// review

export default {
  name: "Hotel",
  components: { ResumeConfigNotification },
  mixins: [
    TaskService,
    IconService,
    UtilService,
    QueryParamService,
    PageTitleService,
  ],
  pageTitle() {
    return this.$t("hotel.title") + " - " + this.appName;
  },
  data() {
    return {
      q: {
        page: "hotel",
      },
      loading: {
        getHotel: false,
        setHotel: false,
      },
      error: {
        getHotel: "",
        setHotel: "",
      },
    };
  },
  computed: {
    ...mapState([
      "instanceName",
      "core",
      "appName",
      "isAppConfigured",
      "isShownFirstConfigurationModal",
    ]),
  },
  beforeRouteEnter(to, from, next) {
    next((vm) => {
      vm.watchQueryData(vm);
      vm.urlCheckInterval = vm.initUrlBindingForApp(vm, vm.q.page);
    });
  },
  beforeRouteLeave(to, from, next) {
    clearInterval(this.urlCheckInterval);
    next();
  },
  created() {
    ////
  },
  methods: {
    setHotel() {
      ////
    },
  },
};
</script>

<style scoped lang="scss">
@import "../styles/carbon-utils";
</style>
