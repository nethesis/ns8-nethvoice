<!--
  Copyright (C) 2025 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->
<template>
  <NsWizard
    size="default"
    :visible="isShown"
    :cancelLabel="core.$t('common.cancel')"
    :previousLabel="core.$t('common.previous')"
    :nextLabel="nextButtonLabel || core.$t('common.next')"
    :isPreviousDisabled="!isPreviousEnabled"
    :isNextDisabled="!isNextEnabled"
    :isNextLoading="isNextLoading"
    @modal-hidden="$emit('hide')"
    @cancel="$emit('hide')"
    @previousStep="previousStep"
    @nextStep="next"
  >
    <template slot="title">{{ $t("welcome.configure_nethvoice") }}</template>
    <template slot="content">
      <NsInlineNotification
        v-if="error.getDefaults"
        kind="error"
        :title="$t('action.get-defaults')"
        :description="error.getDefaults"
        :showCloseButton="false"
      />
      <NsInlineNotification
        v-if="error.getStatus"
        kind="error"
        :title="$t('action.get-status')"
        :description="error.getStatus"
        :showCloseButton="false"
      />
      <NsProgress :stepId="step" :steps="progressSteps" class="progress" />
      <AccountProviderStep
        v-if="step == ACCOUNT_PROVIDER_STEP"
        :nodeLabel="nodeLabel"
        :accountProvider="accountProvider"
        @set-step="step = $event"
        @set-account-provider="accountProvider = $event"
        @set-previous-enabled="isPreviousEnabled = $event"
        @set-next-enabled="isNextEnabled = $event"
        @set-next-loading="isNextLoading = $event"
        @set-next-label="nextButtonLabel = $event"
        @change-account-provider-type="accountProviderType = $event"
        ref="accountProviderStep"
      />
      <OpenldapStep
        v-if="step == OPENLDAP_STEP"
        @set-step="step = $event"
        @set-account-provider="accountProvider = $event"
        @set-previous-enabled="isPreviousEnabled = $event"
        @set-next-enabled="isNextEnabled = $event"
        @set-next-loading="isNextLoading = $event"
        @set-next-label="nextButtonLabel = $event"
        ref="openldapStep"
      />
      <ProxyStep
        v-if="step == PROXY_STEP"
        :isProxyInstalled="isProxyInstalled"
        :proxyModuleId="proxyModuleId"
        :loadingNethvoiceDefaults="loading.getDefaults"
        :nodeLabel="nodeLabel"
        @set-proxy-module-id="proxyModuleId = $event"
        @set-proxy-installed="isProxyInstalled = $event"
        @set-step="step = $event"
        @set-previous-enabled="isPreviousEnabled = $event"
        @set-next-enabled="isNextEnabled = $event"
        @set-next-loading="isNextLoading = $event"
        @set-next-label="nextButtonLabel = $event"
        ref="proxyStep"
      />
      <NethvoiceStep
        v-if="step == NETHVOICE_STEP"
        :accountProvider="accountProvider"
        ref="nethvoiceStep"
        @set-previous-enabled="isPreviousEnabled = $event"
        @set-next-enabled="isNextEnabled = $event"
        @set-next-loading="isNextLoading = $event"
        @set-next-label="nextButtonLabel = $event"
        @finish="$emit('configured')"
      />
    </template>
  </NsWizard>
</template>

<script>
import { UtilService, TaskService, IconService } from "@nethserver/ns8-ui-lib";
import to from "await-to-js";
import { mapState, mapActions } from "vuex";
import AccountProviderStep from "./AccountProviderStep.vue";
import OpenldapStep from "./OpenldapStep.vue";
import ProxyStep from "./ProxyStep.vue";
import NethvoiceStep from "./NethvoiceStep.vue";

// steps:
export const ACCOUNT_PROVIDER_STEP = "accountProvider";
export const OPENLDAP_STEP = "openldap";
export const PROXY_STEP = "proxy";
export const NETHVOICE_STEP = "nethvoice";

export default {
  components: {
    AccountProviderStep,
    OpenldapStep,
    ProxyStep,
    NethvoiceStep,
  },
  name: "FirstConfigurationModal",
  mixins: [UtilService, TaskService, IconService],
  props: {
    isShown: {
      type: Boolean,
      default: true,
    },
  },
  data() {
    return {
      step: "",
      accountProvider: null,
      proxyModuleId: "",
      isProxyInstalled: false,
      installingProxyProgress: 0,
      configuringProxyProgress: 0,
      isPreviousEnabled: false,
      isNextEnabled: false,
      isNextLoading: false,
      nextButtonLabel: "",
      accountProviderType: "",
      // Expose constants for template use
      ACCOUNT_PROVIDER_STEP,
      OPENLDAP_STEP,
      PROXY_STEP,
      NETHVOICE_STEP,
      loading: {
        getDefaults: false,
        getStatus: false,
      },
      error: {
        getDefaults: "",
        getStatus: "",
      },
    };
  },
  computed: {
    ...mapState(["core", "instanceName", "instanceStatus"]),
    nodeLabel() {
      if (this.instanceStatus && this.instanceStatus.node_ui_name) {
        return this.instanceStatus.node_ui_name;
      } else if (this.instanceStatus) {
        return `${this.$t("common.node_id", { id: this.instanceStatus.node })}`;
      } else {
        return "";
      }
    },
    progressSteps() {
      const accountProviderProgressStep = {
        id: ACCOUNT_PROVIDER_STEP,
        label: this.$t("welcome.account_provider"),
      };

      const openldapProgressStep = {
        id: OPENLDAP_STEP,
        label: this.$t("welcome.openldap"),
      };

      const proxyProgressStep = {
        id: PROXY_STEP,
        label: "NethVoice Proxy",
      };

      const nethvoiceProgressStep = {
        id: NETHVOICE_STEP,
        label: this.$t("welcome.nethvoice_application"),
      };

      if (this.accountProviderType === "create_openldap") {
        return [
          accountProviderProgressStep,
          openldapProgressStep,
          proxyProgressStep,
          nethvoiceProgressStep,
        ];
      } else {
        return [
          accountProviderProgressStep,
          proxyProgressStep,
          nethvoiceProgressStep,
        ];
      }
    },
  },
  watch: {
    isShown: function () {
      if (this.isShown) {
        this.getDefaults();

        if (!this.instanceStatus) {
          // retrieve installation node, needed for openldap and proxy installation
          this.getStatus();
        }

        // show first step
        this.step = ACCOUNT_PROVIDER_STEP;
      }
    },
  },
  methods: {
    ...mapActions(["setInstanceStatusInStore", "setDefaultsInStore"]),
    previousStep() {
      switch (this.step) {
        case OPENLDAP_STEP:
        case PROXY_STEP:
          this.step = ACCOUNT_PROVIDER_STEP;
          break;
        case NETHVOICE_STEP:
          this.step = PROXY_STEP;
          break;
      }
    },
    next() {
      if (this.isNextButtonDisabled) {
        return;
      }

      switch (this.step) {
        case ACCOUNT_PROVIDER_STEP:
          this.$refs.accountProviderStep.next();
          break;
        case OPENLDAP_STEP:
          this.$refs.openldapStep.next();
          break;
        case PROXY_STEP:
          this.$refs.proxyStep.next();
          break;
        case NETHVOICE_STEP:
          this.$refs.nethvoiceStep.next();
          break;
      }
    },
    async getStatus() {
      this.loading.getStatus = true;
      this.error.getStatus = "";
      const taskAction = "get-status";
      const eventId = this.getUuid();

      // register to task error
      this.core.$root.$once(
        `${taskAction}-aborted-${eventId}`,
        this.getStatusAborted
      );

      // register to task completion
      this.core.$root.$once(
        `${taskAction}-completed-${eventId}`,
        this.getStatusCompleted
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
        this.error.getStatus = this.getErrorMessage(err);
        this.loading.getStatus = false;
        return;
      }
    },
    getStatusAborted(taskResult, taskContext) {
      console.error(`${taskContext.action} aborted`, taskResult);
      this.error.getStatus = this.$t("error.generic_error");
      this.loading.getStatus = false;
    },
    getStatusCompleted(taskContext, taskResult) {
      this.status = taskResult.output;

      // save status to vuex store
      this.setInstanceStatusInStore(this.status);
      this.loading.getStatus = false;
    },
    async getDefaults() {
      this.loading.getDefaults = true;
      const taskAction = "get-defaults";
      const eventId = this.getUuid();

      // register to task error
      this.core.$root.$once(
        `${taskAction}-aborted-${eventId}`,
        this.getDefaultsAborted
      );

      // register to task completion
      this.core.$root.$once(
        `${taskAction}-completed-${eventId}`,
        this.getDefaultsCompleted
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
        this.error.getDefaults = this.getErrorMessage(err);
        this.loading.getDefaults = false;
        return;
      }
    },
    getDefaultsAborted(taskResult, taskContext) {
      console.error(`${taskContext.action} aborted`, taskResult);
      this.error.getDefaults = this.$t("error.generic_error");
      this.loading.getDefaults = false;
    },
    getDefaultsCompleted(taskContext, taskResult) {
      const defaults = taskResult.output;

      // save defaults to vuex store
      this.setDefaultsInStore(defaults);

      this.isProxyInstalled = defaults.proxy_status.proxy_installed;

      if (this.isProxyInstalled) {
        this.proxyModuleId = defaults.proxy_status.module_id;
      }

      this.timezoneList = [];
      defaults.accepted_timezone_list.forEach((value) =>
        this.timezoneList.push({
          name: value,
          label: value,
          value: value,
        })
      );
      this.loading.getDefaults = false;
    },
  },
};
</script>

<style scoped lang="scss">
@import "../../styles/carbon-utils";

.progress {
  margin-top: 1rem;
  margin-bottom: 3rem;
}
</style>
