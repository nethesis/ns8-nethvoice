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
    <template v-if="!isAppConfigured">
      <cv-row>
        <cv-column>
          <ResumeConfigNotification />
        </cv-column>
      </cv-row>
    </template>
    <template v-else>
      <cv-row v-if="error.getHotel">
        <cv-column>
          <NsInlineNotification
            kind="error"
            :title="$t('action.get-nethvoice-hotel')"
            :description="error.getHotel"
            :showCloseButton="false"
          />
        </cv-column>
      </cv-row>
      <cv-row
        v-if="!isSubscriptionEnabled && !loading.getHotel && !!configuration"
      >
        <cv-column>
          <NsInlineNotification
            kind="info"
            :title="$t('hotel.hotel_is_disabled')"
            :description="$t('hotel.subscription_required')"
            :showCloseButton="false"
            :actionLabel="$t('hotel.go_to_subscription')"
            @action="goToSubscription"
          />
        </cv-column>
      </cv-row>
      <cv-row v-else>
        <cv-column>
          <cv-tile light>
            <cv-skeleton-text
              v-if="loading.getHotel || !configuration"
              :paragraph="true"
              heading
              :line-count="8"
            ></cv-skeleton-text>
            <cv-form v-else @submit.prevent="setHotel">
              <!-- status -->
              <NsToggle
                :label="$t('common.status')"
                value="isHotelEnabled"
                v-model="isHotelEnabled"
                :disabled="loading.setHotel"
              >
                <template slot="text-left">
                  {{ $t("common.disabled") }}
                </template>
                <template slot="text-right">
                  {{ $t("common.enabled") }}
                </template>
              </NsToggle>
              <!-- fias host -->
              <NsTextInput
                v-if="isHotelEnabled"
                :label="
                  $t('hotel.fias_host') + ' (' + $t('common.optional') + ')'
                "
                v-model.trim="fiasHost"
                :helper-text="$t('hotel.fias_host_helper')"
                :invalid-message="error.nethvoice_hotel_fias_address"
                :disabled="loading.setHotel"
                ref="nethvoice_hotel_fias_address"
              />
              <!-- fias port -->
              <NsTextInput
                v-if="isHotelEnabled"
                :label="
                  $t('hotel.fias_port') + ' (' + $t('common.optional') + ')'
                "
                v-model="fiasPort"
                type="number"
                :invalid-message="error.nethvoice_hotel_fias_port"
                :disabled="loading.setHotel"
                ref="nethvoice_hotel_fias_port"
              />
              <NsInlineNotification
                v-if="error.setHotel"
                kind="error"
                :title="$t('action.set-nethvoice-hotel')"
                :description="error.setHotel"
                :showCloseButton="false"
              />
              <NsButton
                kind="primary"
                :icon="Save20"
                :loading="loading.setHotel"
                :disabled="loading.setHotel"
              >
                {{ $t("common.save") }}
              </NsButton>
            </cv-form>
          </cv-tile>
        </cv-column>
      </cv-row>
    </template>
  </cv-grid>
</template>

<script>
import to from "await-to-js";
import { mapState } from "vuex";
import {
  QueryParamService,
  UtilService,
  TaskService,
  IconService,
  PageTitleService,
} from "@nethserver/ns8-ui-lib";
import ResumeConfigNotification from "@/components/first-configuration/ResumeConfigNotification.vue";

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
      isHotelEnabled: false,
      fiasHost: "",
      fiasPort: "",
      urlCheckInterval: null,
      loading: {
        getHotel: true,
        setHotel: false,
      },
      error: {
        getHotel: "",
        setHotel: "",
        nethvoice_hotel_fias_address: "",
        nethvoice_hotel_fias_port: "",
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
      "configuration",
    ]),
    isSubscriptionEnabled() {
      return this.configuration && this.configuration.subscription_systemid;
    },
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
    this.getHotel();
  },
  methods: {
    async getHotel() {
      this.loading.getHotel = true;
      this.error.getHotel = "";
      const taskAction = "get-nethvoice-hotel";
      const eventId = this.getUuid();

      // register to task error
      this.core.$root.$once(
        `${taskAction}-aborted-${eventId}`,
        this.getHotelAborted
      );

      // register to task completion
      this.core.$root.$once(
        `${taskAction}-completed-${eventId}`,
        this.getHotelCompleted
      );

      const res = await to(
        this.createModuleTaskForApp(this.instanceName, {
          action: taskAction,
          extra: {
            title: this.$t("action." + taskAction),
            isNotificationHidden: true,
            eventId,
          },
        })
      );
      const err = res[0];

      if (err) {
        console.error(`error creating task ${taskAction}`, err);
        this.error.getHotel = this.getErrorMessage(err);
        this.loading.getHotel = false;
        return;
      }
    },
    getHotelAborted(taskResult, taskContext) {
      console.error(`${taskContext.action} aborted`, taskResult);
      this.error.getHotel = this.$t("error.generic_error");
      this.loading.getHotel = false;
    },
    getHotelCompleted(taskContext, taskResult) {
      const hotelConfig = taskResult.output;
      this.isHotelEnabled = hotelConfig.nethvoice_hotel;
      this.fiasHost = hotelConfig.nethvoice_hotel_fias_address;
      this.fiasPort = hotelConfig.nethvoice_hotel_fias_port.toString();
      this.loading.getHotel = false;
    },

    async setHotel() {
      this.error.setHotel = "";
      this.error.nethvoice_hotel_fias_address = "";
      this.error.nethvoice_hotel_fias_port = "";
      this.loading.setHotel = true;
      const taskAction = "set-nethvoice-hotel";
      const eventId = this.getUuid();

      // register to task error
      this.core.$root.$once(
        `${taskAction}-aborted-${eventId}`,
        this.setHotelAborted
      );

      // register to task validation
      this.core.$root.$once(
        `${taskAction}-validation-failed-${eventId}`,
        this.setHotelValidationFailed
      );

      // register to task completion
      this.core.$root.$once(
        `${taskAction}-completed-${eventId}`,
        this.setHotelCompleted
      );

      const res = await to(
        this.createModuleTaskForApp(this.instanceName, {
          action: taskAction,
          data: {
            nethvoice_hotel: this.isHotelEnabled,
            nethvoice_hotel_fias_address: this.isHotelEnabled
              ? this.fiasHost
              : "",
            nethvoice_hotel_fias_port:
              this.isHotelEnabled && this.fiasPort
                ? parseInt(this.fiasPort)
                : "",
          },
          extra: {
            title: this.$t("action." + taskAction),
            description: this.$t("common.processing"),
            eventId,
          },
        })
      );
      const err = res[0];

      if (err) {
        console.error(`error creating task ${taskAction}`, err);
        this.error.setHotel = this.getErrorMessage(err);
        this.loading.setHotel = false;
        return;
      }
    },
    setHotelAborted(taskResult, taskContext) {
      console.error(`${taskContext.action} aborted`, taskResult);
      this.error.setHotel = this.$t("error.generic_error");
      this.loading.setHotel = false;
    },
    setHotelValidationFailed(validationErrors) {
      this.loading.setHotel = false;

      for (const validationError of validationErrors) {
        const param = validationError.parameter;

        // set i18n error message
        this.error[param] = this.$t("settings." + validationError.error);
      }
    },
    setHotelCompleted() {
      this.getHotel();
      this.loading.setHotel = false;
    },
    goToSubscription() {
      this.core.$router.push("/settings/subscription");
    },
  },
};
</script>

<style scoped lang="scss">
@import "../styles/carbon-utils";
</style>
