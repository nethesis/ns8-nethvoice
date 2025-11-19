<!--
  Copyright (C) 2025 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->
<template>
  <div>
    <template v-if="isValidationCompleted">
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
    <cv-form v-else>
      <NsTextInput
        v-model="fqdn"
        :label="$t('welcome.proxy.domain')"
        :placeholder="$t('common.eg_value', { value: 'proxy.example.org' })"
        :readonly="readonly || loading.configureModule"
        :invalid-message="error.fqdn"
        :helperText="$t('welcome.proxy.domain_helper')"
        ref="fqdn"
        @input="onFqdnChange"
        :disabled="loading.configureModule"
        :class="{ 'input-with-gray-bg': readonly }"
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
        :readonly="readonly"
        :disabled="loading.configureModule"
        :invalid-message="error.iface"
        :acceptUserInput="false"
        :class="{ 'input-with-gray-bg': readonly }"
        :light="!readonly"
        ref="iface"
      />
      <div class="flex flex-col">
        <div class="flex">
          <div class="bx--label mb-0">
            {{
              `${$t("welcome.proxy.address")} (${core.$t("common.optional")})`
            }}
            <cv-interactive-tooltip
              v-if="!readonly"
              alignment="start"
              direction="bottom"
              class="info relative top-0.5"
            >
              <template slot="content">
                {{ $t("welcome.proxy.address_tooltip") }}
              </template>
            </cv-interactive-tooltip>
          </div>
          <cv-loading v-if="loading.resolveFqdn" small class="mg-left-sm" />
        </div>
        <cv-text-input
          v-model="address"
          :readonly="readonly"
          :disabled="loading.configureModule"
          :class="{ 'input-with-gray-bg': readonly }"
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
        :description="$t('welcome.proxy.address_and_iface_dont_match_message')"
        :showCloseButton="false"
      />
      <div v-else class="mb-12rem"></div>
    </cv-form>
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

//// remove component

export default {
  name: "ConfigureOrShowProxyStep",
  mixins: [UtilService, TaskService, IconService, LottieService],
  props: {
    config: {
      type: Object,
      required: true,
    },
    readonly: {
      type: Boolean,
      default: false,
    },
    proxyModuleId: {
      type: String,
      required: true,
    },
  },
  data() {
    return {
      fqdn: "",
      address: "",
      resolvedIp: "",
      public_address: "",
      iface: "",
      interfaces: [],
      warningVisible: false,
      fqdnTimeout: 0,
      configuringModuleProgress: 0,
      isValidationCompleted: false,
      loading: {
        getAvailableInterfaces: false,
        configureModule: false,
        resolveFqdn: false,
      },
      error: {
        fqdn: "",
        iface: "",
        address: "",
        getAvailableInterfaces: "",
        configureModule: "",
      },
    };
  },
  //// readonly fields if already configured
  computed: {
    ...mapState(["core"]),
    addressAndInterfaceDontMatch() {
      return this.address && this.iface && this.address !== this.iface;
    },
  },
  watch: {
    config: function () {
      console.log("watch config"); ////

      this.updateData();
    },
  },
  created() {
    this.getAvailableInterfaces();
    this.updateData();
  },
  methods: {
    updateData() {
      console.log("updateData"); ////

      this.fqdn = this.config.fqdn || "";

      // this.iface is set on get-available-interfaces completion

      if (this.config.addresses.public_address) {
        this.address = this.config.addresses.public_address;
      } else {
        this.resolveFqdn();
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

      const res = await to(
        this.createModuleTaskForApp(this.proxyModuleId, {
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
        this.iface = this.config.addresses.address;
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
        return;
      }

      this.loading.configureModule = true;
      const taskAction = "configure-module";
      const eventId = this.getUuid();
      this.configuringModuleProgress = 0;

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

      const res = await to(
        this.createModuleTaskForApp(this.proxyModuleId, {
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
      this.isValidationCompleted = true;

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

      this.configuringModuleProgress = progress;

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

      // emit to parent that configuration is completed
      // this.$emit("configureModuleCompleted"); ////
    },
  },
};
</script>

<style scoped lang="scss">
@import "../styles/carbon-utils";
</style>
