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
      <!-- <cv-progress //// 
        :initialStep="1"
        :steps="[
          $t('welcome.account_provider'),
          $t('welcome.nethvoice_proxy'),
          $t('welcome.nethvoice_application'),
        ]"
      /> -->
      <div class="mb-6">step {{ step }} ////</div>
      <NsInlineNotification
        v-if="error.getDefaults"
        kind="error"
        :title="$t('action.get-defaults')"
        :description="error.getDefaults"
        :showCloseButton="false"
      />
      <AccountProviderStep
        v-if="step == ACCOUNT_PROVIDER_STEP"
        :nodeLabel="nodeLabel"
        @set-step="step = $event"
        @set-account-provider="accountProvider = $event"
        @set-previous-enabled="isPreviousEnabled = $event"
        @set-next-enabled="isNextEnabled = $event"
        @set-next-loading="isNextLoading = $event"
        @set-next-label="nextButtonLabel = $event"
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
import {
  UtilService,
  TaskService,
  IconService,
  LottieService,
} from "@nethserver/ns8-ui-lib";
import to from "await-to-js";
import { mapState, mapActions } from "vuex";
import AccountProviderStep from "./AccountProviderStep.vue";
import OpenldapStep from "./OpenldapStep.vue";
import ProxyStep from "./ProxyStep.vue";
import NethvoiceStep from "./NethvoiceStep.vue";

//// review

// steps:
export const ACCOUNT_PROVIDER_STEP = "accountProvider";
export const OPENLDAP_STEP = "openldap";
export const PROXY_STEP = "proxy";
export const NETHVOICE_STEP = "nethvoice";

export default {
  components: { AccountProviderStep, OpenldapStep, ProxyStep, NethvoiceStep },
  name: "FirstConfigurationModal",
  mixins: [UtilService, TaskService, IconService, LottieService],
  props: {
    isShown: {
      type: Boolean,
      default: true,
    },
  },
  data() {
    //// remove unnecessary variables
    return {
      step: "", //// ?
      accountProvider: "",
      proxyModuleId: "",
      isProxyInstalled: false,
      installingProxyProgress: 0,
      configuringProxyProgress: 0,
      isPreviousEnabled: false,
      isNextEnabled: false,
      isNextLoading: false,
      nextButtonLabel: "",
      // Expose constants for template use
      ACCOUNT_PROVIDER_STEP,
      OPENLDAP_STEP,
      PROXY_STEP,
      NETHVOICE_STEP,
      nethvoice: {
        nethvoice_host: "",
        nethcti_ui_host: "",
        lets_encrypt: true,
        timezone: "",
        timezoneList: [],
        nethvoice_admin_password: "",
        reports_international_prefix: "+39",
      },
      loading: {
        getDefaults: false,
        getStatus: false,
        ////
        listUserDomains: false, //// remove
        listModules: false, ////
        addInternalProvider: false, ////
        installProxy: false,
        openldap: {
          getDefaults: false,
          configureModule: false,
        },
        proxy: {
          configureModule: false,
        },
        nethvoice: {
          getDefaults: false,
          configureModule: false,
        },
      },
      error: {
        getDefaults: "",
        getStatus: "",
        // getProxyConfig: "", ////
        ////
        accountProvider: "",
        configureModule: "",
        listModules: "",
        listUserDomains: "",
        getConfiguration: "",
        addInternalProvider: "",
        installProxy: false,
        openldap: {
          getDefaults: "",
          domain: "",
          admuser: "",
          admpass: "",
          confirmPassword: "",
          configureModule: "",
        },
        proxy: {
          configureModule: "",
        },
        nethvoice: {
          nethvoice_host: "",
          nethcti_ui_host: "",
          timezone: "",
          nethvoice_admin_password: "",
          reports_international_prefix: "+39",
          getDefaults: "",
          configureModule: "",
        },
      },
    };
  },
  computed: {
    ...mapState(["core", "instanceName", "instanceStatus"]),
    // ...mapState("firstConfiguration", ["firstConfigurationStep"]), ////
    nodeLabel() {
      if (this.instanceStatus && this.instanceStatus.node_ui_name) {
        return this.instanceStatus.node_ui_name;
      } else if (this.instanceStatus) {
        return `${this.$t("status.node", { node: this.instanceStatus.node })}`;
      } else {
        return "";
      }
    },
    // isPreviousButtonDisabled() { ////
    //   return this.step == ACCOUNT_PROVIDER_STEP;
    //   // return [  ////
    //   //   ACCOUNT_PROVIDER_STEP,
    //   //   "installingOpenldap",
    //   //   "configuringOpenldap",
    //   //   "installingProxy",
    //   //   "configuringProxy",
    //   //   "configuringNethvoice",
    //   // ].includes(this.step);
    // },
    // nextButtonLabel() { ////
    //   // if (this.firstConfigurationStep == "selectAccountProvider") {
    //   //   if (!this.domains.length && !this.loading.listUserDomains) {
    //   //     return this.$t("welcome.install_openldap");
    //   //   }
    //   //   //// todo
    //   // }

    //   //// user children event
    //   return this.core.$t("common.next");
    // },
  },
  watch: {
    isShown: function () {
      if (this.isShown) {
        console.log("watch isShown"); ////

        this.getDefaults();

        if (!this.instanceStatus) {
          // retrieve installation node, needed for openldap and proxy installation
          this.getStatus();
        }

        // show first step
        this.step = ACCOUNT_PROVIDER_STEP;

        // this.setFirstConfigurationStepInStore(SELECT_ACCOUNT_PROVIDER); ////
      }
    },
  },
  methods: {
    ...mapActions(["setInstanceStatusInStore", "setDefaultsInStore"]),
    // ...mapActions("firstConfiguration", ["setFirstConfigurationStepInStore"]), ////
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

      console.log("next"); ////

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
    goToDomainsAndUsers() {
      this.core.$router.push("/domains");
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

        //// remove
        // retrieve proxy configuration
        // this.getProxyConfig(); ////
      }

      this.timezoneList = [];
      defaults.accepted_timezone_list.forEach((value) =>
        this.timezoneList.push({
          name: value,
          label: value,
          value: value,
        })
      );

      //// todo: set default timezone
      this.loading.getDefaults = false;
    },
    async installProxy() {
      this.error.installProxy = "";
      const taskAction = "add-module";
      const eventId = this.getUuid();
      this.installingProxyProgress = 0;

      // register to task error
      this.core.$root.$once(
        `${taskAction}-aborted-${eventId}`,
        this.installProxyAborted
      );

      // register to task completion
      this.core.$root.$once(
        `${taskAction}-completed-${eventId}`,
        this.installProxyCompleted
      );

      // register to task progress to update progress bar
      this.core.$root.$on(
        `${taskAction}-progress-${eventId}`,
        this.installProxyProgress
      );

      console.log("@@ this.instanceStatus", this.instanceStatus); ////
      console.log("@@ this.instanceStatus.node", this.instanceStatus.node); ////

      const nodeId = parseInt(this.instanceStatus.node);

      console.log("nodeId", nodeId); ////

      const res = await to(
        this.createClusterTaskForApp({
          action: taskAction,
          data: {
            image: "todo",
            node: nodeId,
          },
          extra: {
            title: this.core.$t("action." + taskAction),
            node: nodeId,
            isNotificationHidden: true,
            isProgressNotified: true,
            eventId,
          },
        })
      );
      const err = res[0];

      if (err) {
        console.error(`error creating task ${taskAction}`, err);
        this.error.installProxy = this.getErrorMessage(err);
        return;
      }
    },
    installProxyAborted(taskResult, taskContext) {
      console.error(`${taskContext.action} aborted`, taskResult);

      // unregister to task progress
      this.core.$root.$off(
        `${taskContext.action}-progress-${taskContext.extra.eventId}`
      );

      // hide modal so that user can see error notification
      this.$emit("hide");
    },
    installProxyCompleted(taskContext, taskResult) {
      // unregister to task progress
      this.core.$root.$off(
        `${taskContext.action}-progress-${taskContext.extra.eventId}`
      );

      this.proxyModuleId = taskResult.output.module_id;

      console.log("@@ proxyModuleId", this.proxyModuleId); ////

      // this.setFirstConfigurationStepInStore(CONFIGURE_OR_SHOW_PROXY); ////
    },
    installProxyProgress(progress) {
      this.installingProxyProgress = progress;
    },
  },
};
</script>

<style scoped lang="scss">
@import "../../styles/carbon-utils";
</style>
