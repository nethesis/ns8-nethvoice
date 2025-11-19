<!--
  Copyright (C) 2025 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->
<template>
  <div>
    <div>//// internalIsProxyInstalled {{ internalIsProxyInstalled }}</div>
    <div>//// createdProxyModuleId {{ createdProxyModuleId }}</div>
    <cv-skeleton-text
      v-if="
        !instanceStatus || loadingNethvoiceDefaults || loading.getProxyConfig
      "
      :paragraph="true"
      :line-count="6"
    ></cv-skeleton-text>
    <template v-else>
      <template v-if="!internalIsProxyInstalled">
        <!-- proxy not installed -->
        <template v-if="!isInstallProxyValidationCompleted">
          <NsEmptyState :title="$t('welcome.proxy_missing_on_node')">
            <template #description>
              {{ $t("welcome.proxy_missing_on_node_description") }}
            </template>
            <template #pictogram> </template>
          </NsEmptyState>
        </template>
        <template v-else>
          <!-- installing proxy -->
          <NsEmptyState
            :title="$t('welcome.proxy.installing_nethvoice_proxy')"
            :animationData="GearsLottie"
            animationTitle="gears"
            :loop="true"
          />
          <NsProgressBar
            :value="installingProxyProgress"
            :indeterminate="!installingProxyProgress"
            class="mg-bottom-md"
          />
        </template>
      </template>
      <template v-else>
        <!-- proxy is installed -->
        <template v-if="!isConfigureProxyValidationCompleted">
          <div v-if="!isProxyConfigured">
            proxy installed but not configured ////
          </div>
          <div>
            {{ $t("welcome.configure_nethvoice_proxy") }}
          </div>
          <NsInlineNotification
            v-if="isProxyConfigured"
            kind="info"
            :title="$t('welcome.proxy.proxy_already_configured')"
            :description="
              $t('welcome.proxy.proxy_already_configured_description')
            "
            :showCloseButton="false"
            :actionLabel="$t('welcome.proxy.go_to_proxy_settings')"
            @action="goToProxySettings"
          />
          <cv-form>
            <NsTextInput
              v-model="fqdn"
              :label="$t('welcome.proxy.domain')"
              :placeholder="
                $t('common.eg_value', { value: 'proxy.example.org' })
              "
              :isProxyConfigured="isProxyConfigured || loading.configureModule"
              :invalid-message="error.fqdn"
              :helperText="$t('welcome.proxy.domain_helper')"
              ref="fqdn"
              @input="onFqdnChange"
              :disabled="loading.configureModule"
              :class="{ 'input-with-gray-bg': isProxyConfigured }"
            />
            <NsComboBox
              v-model="iface"
              :title="$t('welcome.proxy.network_interface')"
              :options="interfaces"
              :auto-highlight="true"
              :label="
                loading.getAvailableInterfaces
                  ? $t('common.loading')
                  : $t('welcome.proxy.network_interface_placeholder')
              "
              :readonly="isProxyConfigured"
              :disabled="
                loading.getAvailableInterfaces || loading.configureModule
              "
              :invalid-message="error.iface"
              :acceptUserInput="false"
              :class="{ 'input-with-gray-bg': isProxyConfigured }"
              :light="!isProxyConfigured"
              ref="iface"
            />
            <div class="flex flex-col">
              <div class="flex">
                <div class="bx--label mb-0">
                  {{
                    `${$t("welcome.proxy.address")} (${core.$t(
                      "common.optional"
                    )})`
                  }}
                  <cv-interactive-tooltip
                    v-if="!isProxyConfigured"
                    alignment="start"
                    direction="bottom"
                    class="info relative top-0.5"
                  >
                    <template slot="content">
                      {{ $t("welcome.proxy.address_tooltip") }}
                    </template>
                  </cv-interactive-tooltip>
                </div>
                <cv-loading
                  v-if="loading.resolveFqdn"
                  small
                  class="mg-left-sm"
                />
              </div>
              <cv-text-input
                v-model="address"
                :readonly="isProxyConfigured"
                :disabled="loading.configureModule"
                :class="{ 'input-with-gray-bg': isProxyConfigured }"
                :invalid-message="error.address"
                :helperText="$t('welcome.proxy.address_helper')"
                ref="address"
              />
            </div>
            <NsInlineNotification
              v-if="error.configureModule"
              kind="error"
              :title="$t('action.configure-module')"
              :description="error.configureModule"
              :showCloseButton="false"
            />
            <NsInlineNotification
              v-if="addressAndInterfaceDontMatch"
              kind="warning"
              :title="$t('welcome.proxy.address_and_iface_dont_match')"
              :description="
                $t('welcome.proxy.address_and_iface_dont_match_message')
              "
              :showCloseButton="false"
            />
            <div v-else-if="!isProxyConfigured" class="mb-12rem"></div>
          </cv-form>
        </template>
        <template v-else>
          <!-- configuring proxy -->
          <NsEmptyState
            :title="$t('welcome.proxy.configuring_nethvoice_proxy')"
            :animationData="GearsLottie"
            animationTitle="gears"
            :loop="true"
          />
          <NsProgressBar
            :value="configuringProxyProgress"
            :indeterminate="!configuringProxyProgress"
            class="mg-bottom-md"
          />
        </template>
      </template>
    </template>
  </div>
</template>

<script>
import {
  UtilService,
  TaskService,
  IconService,
  LottieService,
} from "@nethserver/ns8-ui-lib";
import { mapState } from "vuex";
import to from "await-to-js";
import { NETHVOICE_STEP } from "./FirstConfigurationModal.vue";

//// review

export default {
  name: "ProxyStep",
  mixins: [UtilService, TaskService, IconService, LottieService],
  props: {
    loadingNethvoiceDefaults: {
      type: Boolean,
      required: true,
    },
    // loadingProxyConfig: { ////
    //   type: Boolean,
    //   required: true,
    // },
    isProxyInstalled: {
      type: Boolean,
      required: true,
    },
    proxyModuleId: {
      type: String,
      required: true,
    },
    // proxyConfig: { ////
    //   type: [Object, null],
    //   default: null,
    // },
  },
  data() {
    return {
      // isProxyConfigured: false, ////
      createdProxyModuleId: "",
      fqdn: "",
      address: "",
      resolvedIp: "",
      public_address: "",
      iface: "",
      interfaces: [],
      warningVisible: false,
      fqdnTimeout: 0,
      installingProxyProgress: 0,
      configuringProxyProgress: 0,
      isInstallProxyValidationCompleted: false,
      isConfigureProxyValidationCompleted: false,
      loading: {
        getProxyConfig: false,
        getAvailableInterfaces: false,
        installProxy: false,
        configureModule: false,
        resolveFqdn: false,
      },
      error: {
        fqdn: "",
        iface: "",
        address: "",
        getProxyConfig: "",
        getAvailableInterfaces: "",
        installProxy: "",
        configureModule: "",
      },
    };
  },
  computed: {
    ...mapState(["core", "instanceStatus"]),
    addressAndInterfaceDontMatch() {
      return this.address && this.iface && this.address !== this.iface;
    },
    isProxyConfigured() {
      if (
        this.proxyConfig &&
        this.proxyConfig.fqdn &&
        !this.proxyConfig.fqdn.endsWith(".invalid")
      ) {
        return true;
      } else {
        return false;
      }
    },
  },
  watch: {
    // proxyConfig: { ////
    //   immediate: true,
    //   handler() {
    //     console.log("@@ watch proxyConfig", this.proxyConfig); ////

    //     if (this.proxyConfig) {
    //       this.updateData();
    //     }
    //   },
    // },
    proxyModuleId: {
      immediate: true,
      handler() {
        console.log("@@ watch proxyModuleId", this.proxyModuleId); ////

        if (this.proxyModuleId) {
          this.getProxyConfig();
          // this.getAvailableInterfaces(); ////
        }
      },
    },
    isProxyInstalled: {
      immediate: true,
      handler(newVal) {
        this.internalIsProxyInstalled = newVal;
      },
    },
  },
  // created() { ////
  //   // this.updateData(); ////
  //   this.getAvailableInterfaces();
  // },
  methods: {
    // updateData() { ////
    //   console.log("updateData"); ////

    //   console.log("this.proxyConfig", this.proxyConfig); ////

    //   //// switch back to computed?
    //   this.isProxyConfigured =
    //     this.proxyConfig &&
    //     this.proxyConfig.fqdn &&
    //     !this.proxyConfig.fqdn.endsWith(".invalid");

    //   console.log("this.isProxyConfigured", this.isProxyConfigured); ////
    // },
    next() {
      console.log("next, proxy step"); ////

      if (!this.internalIsProxyInstalled) {
        this.installProxy();
      } else if (!this.isProxyConfigured) {
        console.log("configureModule"); ////

        this.configureModule();
      } else {
        // go to nethvoice step
        this.$emit("set-step", NETHVOICE_STEP);
      }
    },
    onFqdnChange() {
      if (this.fqdnTimeout) {
        clearTimeout(this.fqdnTimeout);
      }

      if (this.fqdn.trim() !== "") {
        this.loading.resolveFqdn = true;

        this.fqdnTimeout = setTimeout(() => {
          this.resolveFqdn();
        }, 1000);
      } else {
        this.loading.resolveFqdn = false;
      }
    },
    resolveFqdn() {
      console.log("fetching!"); ////

      fetch(`https://dns.google/resolve?name=${this.fqdn}`)
        .then((response) => response.json())
        .then((data) => {
          if (data.Answer && data.Answer.length > 0) {
            for (let record of data.Answer) {
              if (record.type === 1) {
                this.resolvedIp = record.data;
                break;
              }
            }
            //// always set address
            // if (this.resolvedIp && !this.address) { ////
            this.address = this.resolvedIp;
            // } ////
          } else {
            this.resolvedIp = "";
          }
        })
        .catch((error) => {
          console.error("Error resolving fqdn", error);
        })
        .finally(() => {
          this.loading.resolveFqdn = false;
        });
    },
    async getAvailableInterfaces() {
      this.loading.getAvailableInterfaces = true;

      const taskAction = "get-available-interfaces";
      const eventId = this.getUuid();

      // register to task error
      this.core.$root.$once(
        `${taskAction}-aborted-${eventId}`,
        this.getAvailableInterfacesAborted
      );

      // register to task completion
      this.core.$root.$once(
        `${taskAction}-completed-${eventId}`,
        this.getAvailableInterfacesCompleted
      );

      const proxyId = this.createdProxyModuleId
        ? this.createdProxyModuleId
        : this.proxyModuleId;

      const res = await to(
        this.createModuleTaskForApp(proxyId, {
          action: taskAction,
          data: {
            excluded_interfaces: ["lo", "wg0"],
            excluded_families: ["inet6"],
          },
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
        this.error.getAvailableInterfaces = this.getErrorMessage(err);
        this.loading.getAvailableInterfaces = false;
        return;
      }
    },
    getAvailableInterfacesCompleted(taskContext, taskResult) {
      const interfaces = [];
      for (const test of taskResult.output.data) {
        const interfaceAddress = test.addresses[0].address;
        const label = `${test.name} - ${interfaceAddress}`;

        interfaces.push({
          name: test.name,
          label: label,
          value: interfaceAddress,
        });
      }
      this.interfaces = interfaces;
      this.loading.getAvailableInterfaces = false;

      // set interface from config in combobox
      this.$nextTick(() => {
        this.iface = this.proxyConfig.addresses.address;
      });
    },
    getAvailableInterfacesAborted(taskResult, taskContext) {
      console.error(`${taskContext.action} aborted`, taskResult);
      this.error.getAvailableInterfaces = this.$t("error.generic_error");
      this.loading.getAvailableInterfaces = false;
    },
    validateConfigureModule() {
      this.clearErrors();
      let isValidationOk = true;

      if (!this.fqdn) {
        this.error.fqdn = this.$t("common.required");

        if (isValidationOk) {
          this.focusElement("fqdn");
          isValidationOk = false;
        }
      } else if (this.fqdn.endsWith(".invalid")) {
        this.error.fqdn = this.$t("welcome.proxy.invalid_fqdn");

        if (isValidationOk) {
          this.focusElement("fqdn");
          isValidationOk = false;
        }
      }

      if (!this.iface) {
        this.error.iface = this.$t("common.required");
        isValidationOk = false;
      }
      return isValidationOk;
    },
    getValidationErrorField(validationError) {
      // error field could be "parameters.fieldName", let's take "fieldName" only
      const fieldTokens = validationError.field.split(".");
      return fieldTokens[fieldTokens.length - 1];
    },
    async configureModule() {
      const isValidationOk = this.validateConfigureModule();
      if (!isValidationOk) {
        console.log("validation failed"); ////

        return;
      }

      this.loading.configureModule = true;
      const taskAction = "configure-module";
      const eventId = this.getUuid();
      this.configuringProxyProgress = 0;

      // register to task error
      this.core.$root.$once(
        `${taskAction}-aborted-${eventId}`,
        this.configureModuleAborted
      );

      // register to task validation
      this.core.$root.$once(
        `${taskAction}-validation-failed-${eventId}`,
        this.configureModuleValidationFailed
      );
      this.core.$root.$once(
        `${taskAction}-validation-ok-${eventId}`,
        this.configureModuleValidationOk
      );

      // register to task progress to update progress bar
      this.core.$root.$on(
        `${taskAction}-progress-${eventId}`,
        this.configureModuleProgress
      );

      // register to task completion
      this.core.$root.$once(
        `${taskAction}-completed-${eventId}`,
        this.configureModuleCompleted
      );

      // build data payload
      let dataPayload = {
        fqdn: this.fqdn,
        addresses: {
          address: this.iface,
        },
      };

      // check if public_address exists and is different from local ip address
      if (this.address && this.address !== this.iface) {
        dataPayload.addresses.public_address = this.address;
      }

      const proxyId = this.createdProxyModuleId
        ? this.createdProxyModuleId
        : this.proxyModuleId;

      const res = await to(
        this.createModuleTaskForApp(proxyId, {
          action: taskAction,
          data: dataPayload,
          extra: {
            title: this.$t("settings.configure_instance", {
              instance: this.proxyModuleId,
            }),
            isNotificationHidden: true,
            isProgressNotified: true,
            eventId,
          },
        })
      );
      const err = res[0];

      if (err) {
        console.error(`error creating task ${taskAction}`, err);
        this.error.configureModule = this.getErrorMessage(err);
        this.loading.configureModule = false;
        return;
      }
    },
    configureModuleAborted(taskResult, taskContext) {
      console.error(`${taskContext.action} aborted`, taskResult);
      this.error.configureModule = this.$t("error.generic_error");
      this.loading.configureModule = false;
    },
    configureModuleValidationOk() {
      // show progress animation
      this.isConfigureProxyValidationCompleted = true;

      // emit to parent that validation is ok ////
      // this.$emit("configureModuleValidationOk"); //// remove
    },
    configureModuleValidationFailed(validationErrors, taskContext) {
      this.loading.configureModule = false;

      // unregister to task progress
      this.core.$root.$off(
        `${taskContext.action}-progress-${taskContext.extra.eventId}`
      );

      for (const validationError of validationErrors) {
        let field = this.getValidationErrorField(validationError);

        if (field !== "(root)") {
          // set i18n error message
          this.error[field] = this.$t("welcome.proxy." + validationError.error);
        }
      }
    },
    configureModuleProgress(progress) {
      console.log("@@ configureModuleProgress", progress); ////

      this.configuringProxyProgress = progress;

      // emit progress to parent
      // this.$emit("configureModuleProgress", progress); //// remove, assign variable
    },
    configureModuleCompleted(taskContext) {
      console.log("@@ configureModuleCompleted"); ////

      this.loading.configureModule = false;

      // unregister to task progress
      this.core.$root.$off(
        `${taskContext.action}-progress-${taskContext.extra.eventId}`
      );

      // emit to parent that proxy is configured
      // this.$emit("proxy-configured"); ////

      this.getProxyConfig();

      // go to nethvoice step
      this.$emit("set-step", NETHVOICE_STEP);
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

      //   // register to task validation
      this.core.$root.$once(
        `${taskAction}-validation-ok-${eventId}`,
        this.installProxyValidationOk
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
            //// todo fix version
            image: "ghcr.io/nethesis/nethvoice-proxy:latest",
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
    },
    installProxyValidationOk() {
      this.isInstallProxyValidationCompleted = true;
    },
    installProxyCompleted(taskContext, taskResult) {
      // unregister to task progress
      this.core.$root.$off(
        `${taskContext.action}-progress-${taskContext.extra.eventId}`
      );

      this.createdProxyModuleId = taskResult.output.module_id;
      this.internalIsProxyInstalled = true;

      console.log("@@ createdProxyModuleId", this.createdProxyModuleId); ////

      // this.setFirstConfigurationStepInStore(CONFIGURE_OR_SHOW_PROXY); ////
    },
    installProxyProgress(progress) {
      this.installingProxyProgress = progress;
    },
    goToProxySettings() {
      this.goToAppPage(this.proxyModuleId, "settings");
    },
    async getProxyConfig() {
      console.log("@@@@ getProxyConfig"); ////

      this.loading.getProxyConfig = true;
      const taskAction = "get-configuration";
      const eventId = this.getUuid();

      // register to task error
      this.core.$root.$once(
        `${taskAction}-aborted-${eventId}`,
        this.getProxyConfigAborted
      );

      // register to task completion
      this.core.$root.$once(
        `${taskAction}-completed-${eventId}`,
        this.getProxyConfigCompleted
      );

      const proxyId = this.createdProxyModuleId
        ? this.createdProxyModuleId
        : this.proxyModuleId;

      const res = await to(
        this.createModuleTaskForApp(proxyId, {
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
        this.error.getProxyConfig = this.getErrorMessage(err);
        this.loading.getProxyConfig = false;
        return;
      }
    },
    getProxyConfigAborted(taskResult, taskContext) {
      console.error(`${taskContext.action} aborted`, taskResult);
      this.error.getProxyConfig = this.$t("error.generic_error");
      this.loading.getProxyConfig = false;
    },
    getProxyConfigCompleted(taskContext, taskResult) {
      console.log("@@ getProxyConfigCompleted", taskResult.output); ////

      this.proxyConfig = taskResult.output;
      this.fqdn = this.proxyConfig.fqdn || "";

      // this.iface is set on get-available-interfaces completion

      if (this.proxyConfig.addresses.public_address) {
        this.address = this.proxyConfig.addresses.public_address;
      } else {
        this.resolveFqdn();
      }

      this.loading.getProxyConfig = false;
      this.getAvailableInterfaces();
    },
  },
};
</script>

<style scoped lang="scss">
@import "../styles/carbon-utils";
</style>
