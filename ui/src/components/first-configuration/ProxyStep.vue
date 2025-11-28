<!--
  Copyright (C) 2025 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->
<template>
  <div>
    <div>iface {{ iface }} ////</div>
    <div>internalProxyModuleId {{ internalProxyModuleId }} ////</div>
    <NsInlineNotification
      v-if="error.getProxyConfig"
      kind="error"
      :title="$t('action.get-configuration')"
      :description="error.getProxyConfig"
      :showCloseButton="false"
    />
    <NsInlineNotification
      v-if="error.getAvailableInterfaces"
      kind="error"
      :title="$t('action.get-available-interfaces')"
      :description="error.getAvailableInterfaces"
      :showCloseButton="false"
    />
    <NsInlineNotification
      v-if="error.listModules"
      kind="error"
      :title="core.$t('action.list-modules')"
      :description="error.listModules"
      :showCloseButton="false"
    />
    <cv-skeleton-text
      v-if="
        !instanceStatus || loadingNethvoiceDefaults || loading.getProxyConfig
      "
      :paragraph="true"
      heading
      :line-count="7"
    ></cv-skeleton-text>
    <template v-else>
      <template v-if="!internalIsProxyInstalled">
        <!-- proxy not installed -->
        <template v-if="!isInstallProxyValidationCompleted">
          <NsEmptyState
            :title="
              $t('welcome.proxy_missing_on_node', { node: this.nodeLabel })
            "
          >
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
          <div class="mg-bottom-lg">
            {{ $t("welcome.configure_nethvoice_proxy") }}
          </div>
          <NsInlineNotification
            v-if="isProxyConfigured"
            kind="info"
            :title="
              $t('welcome.proxy.proxy_already_configured', {
                node: this.nodeLabel,
              })
            "
            :description="
              $t('welcome.proxy.proxy_already_configured_description', {
                proxyModule: this.internalProxyModuleId,
              })
            "
            :showCloseButton="false"
            :actionLabel="$t('welcome.proxy.go_to_proxy_settings')"
            @action="goToProxySettings"
          />
          <cv-form>
            <!-- fqdn -->
            <NsTextInput
              v-model="fqdn"
              :label="$t('welcome.proxy.domain')"
              :placeholder="
                $t('common.eg_value', { value: 'proxy.example.org' })
              "
              :invalid-message="error.fqdn"
              :helperText="$t('welcome.proxy.domain_helper')"
              ref="fqdn"
              @input="onFqdnChange"
              :disabled="loading.configureModule"
              :readonly="isProxyConfigured"
              :class="{ 'input-with-gray-bg': isProxyConfigured }"
            />
            <!-- let's encrypt toggle -->
            <NsToggle
              value="letsEncrypt"
              :label="core.$t('apps_lets_encrypt.request_https_certificate')"
              v-model="isLetsEncryptEnabled"
              :disabled="loading.configureModule"
              :readonly="isProxyConfigured"
            >
              <template #tooltip>
                <div class="mg-bottom-sm">
                  {{ core.$t("apps_lets_encrypt.lets_encrypt_tips") }}
                </div>
                <div class="mg-bottom-sm">
                  <cv-link @click="goToCertificates">
                    {{ core.$t("apps_lets_encrypt.go_to_tls_certificates") }}
                  </cv-link>
                </div>
              </template>
              <template slot="text-left">{{ $t("common.disabled") }}</template>
              <template slot="text-right">{{ $t("common.enabled") }}</template>
            </NsToggle>
            <!-- disabling let's encrypt warning -->
            <NsInlineNotification
              v-if="isLetsEncryptCurrentlyEnabled && !isLetsEncryptEnabled"
              kind="warning"
              :title="
                core.$t('apps_lets_encrypt.lets_encrypt_disabled_warning')
              "
              :description="
                core.$t(
                  'apps_lets_encrypt.lets_encrypt_disabled_warning_description',
                  {
                    node: this.instanceStatus.node_ui_name
                      ? this.instanceStatus.node_ui_name
                      : this.instanceStatus.node,
                  }
                )
              "
              :showCloseButton="false"
            />
            <!-- network interface -->
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
            <!-- public address -->
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
                :invalid-message="error.public_address"
                :helperText="$t('welcome.proxy.address_helper')"
                ref="public_address"
              />
            </div>
            <NsInlineNotification
              v-if="addressAndInterfaceDontMatch"
              kind="warning"
              :title="$t('welcome.proxy.address_and_iface_dont_match')"
              :description="
                $t('welcome.proxy.address_and_iface_dont_match_message')
              "
              :showCloseButton="false"
            />
            <NsInlineNotification
              v-if="validationErrorDetails.length"
              kind="error"
              :title="core.$t('apps_lets_encrypt.cannot_obtain_certificate')"
              :showCloseButton="false"
            >
              <template #description>
                <div class="flex flex-col gap-2">
                  <div
                    v-for="(detail, index) in validationErrorDetails"
                    :key="index"
                  >
                    {{ detail }}
                  </div>
                </div>
              </template>
            </NsInlineNotification>
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
    <NsInlineNotification
      v-if="error.installProxy"
      kind="error"
      :title="$t('action.add-module')"
      :description="error.installProxy"
      :showCloseButton="false"
    />
    <NsInlineNotification
      v-if="error.configureModule"
      kind="error"
      :title="$t('action.configure-module')"
      :description="error.configureModule"
      :showCloseButton="false"
    />
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

export default {
  name: "ProxyStep",
  mixins: [UtilService, TaskService, IconService, LottieService],
  props: {
    loadingNethvoiceDefaults: {
      type: Boolean,
      required: true,
    },
    isProxyInstalled: {
      type: Boolean,
      required: true,
    },
    proxyModuleId: {
      type: String,
      required: true,
    },
    nodeLabel: {
      type: String,
      required: true,
    },
  },
  data() {
    return {
      internalProxyModuleId: false,
      internalIsProxyInstalled: false,
      fqdn: "",
      isLetsEncryptEnabled: false,
      isLetsEncryptCurrentlyEnabled: false,
      validationErrorDetails: [],
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
      apps: [],
      loading: {
        getProxyConfig: false,
        getAvailableInterfaces: false,
        installProxy: false,
        configureModule: false,
        listModules: false,
        resolveFqdn: false,
      },
      error: {
        fqdn: "",
        iface: "",
        public_address: "",
        getProxyConfig: "",
        getAvailableInterfaces: "",
        installProxy: "",
        configureModule: "",
        listModules: false,
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
    proxyVersion() {
      if (!this.apps) {
        return "";
      }

      const proxyApp = this.apps.find((app) => app.id === "nethvoice-proxy");

      if (
        proxyApp &&
        proxyApp.versions &&
        proxyApp.versions.length > 0 &&
        proxyApp.versions[0].tag
      ) {
        return proxyApp.versions[0].tag;
      } else {
        return "";
      }
    },
  },
  watch: {
    proxyModuleId: {
      immediate: true,
      handler() {
        this.internalProxyModuleId = this.proxyModuleId;
      },
    },
    internalProxyModuleId: {
      immediate: true,
      handler() {
        if (this.internalProxyModuleId) {
          this.getProxyConfig();
        }
      },
    },
    isProxyInstalled: {
      immediate: true,
      handler(newVal) {
        this.internalIsProxyInstalled = newVal;

        if (!newVal) {
          // if proxy is not installed, retrieve modules to obtain proxy version
          this.listModules();
          this.$emit("set-next-label", this.$t("welcome.proxy.install_proxy"));
        } else {
          this.$emit("set-next-label", this.core.$t("common.next"));
        }
      },
    },
    "loading.installProxy": {
      immediate: true,
      handler(newVal) {
        this.$emit("set-next-loading", newVal);
        this.$emit("set-next-enabled", !newVal);
        this.$emit("set-previous-enabled", !newVal);
      },
    },
    "loading.configureModule": {
      immediate: true,
      handler(newVal) {
        this.$emit("set-next-loading", newVal);
        this.$emit("set-next-enabled", !newVal);
        this.$emit("set-previous-enabled", !newVal);
      },
    },
    "loading.listModules": {
      immediate: true,
      handler(newVal) {
        this.$emit("set-next-enabled", !newVal);
      },
    },
  },
  created() {
    this.listModules();
  },
  methods: {
    next() {
      if (!this.internalIsProxyInstalled) {
        this.installProxy();
      } else if (!this.isProxyConfigured) {
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
            this.address = this.resolvedIp;
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
      this.error.getAvailableInterfaces = "";
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
        this.createModuleTaskForApp(this.internalProxyModuleId, {
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
        //// is this if correct?
        if (this.proxyConfig.addresses.address != "127.0.0.1") {
          this.iface = this.proxyConfig.addresses.address;
        }
      });
    },
    getAvailableInterfacesAborted(taskResult, taskContext) {
      console.error(`${taskContext.action} aborted`, taskResult);
      this.error.getAvailableInterfaces = this.$t("error.generic_error");
      this.loading.getAvailableInterfaces = false;
    },
    validateConfigureModule() {
      this.clearErrors();
      this.validationErrorDetails = [];
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
        lets_encrypt: this.isLetsEncryptEnabled,
        addresses: {
          address: this.iface,
        },
      };

      // check if public_address exists and is different from local ip address
      if (this.address && this.address !== this.iface) {
        dataPayload.addresses.public_address = this.address;
      }

      const res = await to(
        this.createModuleTaskForApp(this.internalProxyModuleId, {
          action: taskAction,
          data: dataPayload,
          extra: {
            title: this.$t("settings.configure_instance", {
              instance: this.internalProxyModuleId,
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
    },
    configureModuleValidationFailed(validationErrors, taskContext) {
      this.loading.configureModule = false;

      // unregister to task progress
      this.core.$root.$off(
        `${taskContext.action}-progress-${taskContext.extra.eventId}`
      );

      for (const validationError of validationErrors) {
        console.log("## validationError", validationError); ////

        let field = this.getValidationErrorField(validationError);

        console.log("field", field); ////

        if (validationError.details) {
          // show inline error notification with details
          this.validationErrorDetails = validationError.details
            .split("\n")
            .filter((detail) => detail.trim() !== "");
        } else {
          if (field !== "(root)") {
            // set i18n error message
            this.error[field] = this.$t(
              "welcome.proxy." + validationError.error
            );
          }
        }
      }
    },
    configureModuleProgress(progress) {
      this.configuringProxyProgress = progress;
    },
    configureModuleCompleted(taskContext) {
      this.loading.configureModule = false;

      // unregister to task progress
      this.core.$root.$off(
        `${taskContext.action}-progress-${taskContext.extra.eventId}`
      );

      // go to nethvoice step
      this.$emit("set-step", NETHVOICE_STEP);
    },
    async installProxy() {
      this.error.installProxy = "";
      this.loading.installProxy = true;
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

      const nodeId = parseInt(this.instanceStatus.node);

      const res = await to(
        this.createClusterTaskForApp({
          action: taskAction,
          data: {
            image: `ghcr.io/nethesis/nethvoice-proxy:latest`, //// remove
            // image: `ghcr.io/nethesis/nethvoice-proxy:${this.proxyVersion}`, //// uncomment
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
        this.loading.installProxy = false;
        return;
      }
    },
    installProxyAborted(taskResult, taskContext) {
      console.error(`${taskContext.action} aborted`, taskResult);
      this.loading.installProxy = false;
      this.error.installProxy = this.$t("error.generic_error");

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

      // this.internalProxyModuleId = taskResult.output.module_id; ////
      this.$emit("set-proxy-module-id", taskResult.output.module_id);
      this.$emit("set-proxy-installed", true);
      this.$emit("set-next-label", this.core.$t("common.next"));
      this.loading.installProxy = false;
    },
    installProxyProgress(progress) {
      this.installingProxyProgress = progress;
    },
    goToProxySettings() {
      this.goToAppPage(this.internalProxyModuleId, "settings");
    },
    async getProxyConfig() {
      this.error.getProxyConfig = "";
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

      const res = await to(
        this.createModuleTaskForApp(this.internalProxyModuleId, {
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
      this.proxyConfig = taskResult.output;
      this.fqdn = this.proxyConfig.fqdn || "";

      this.isLetsEncryptEnabled = this.proxyConfig.lets_encrypt;
      this.isLetsEncryptCurrentlyEnabled = this.proxyConfig.lets_encrypt;

      // this.iface is set on get-available-interfaces completion

      if (this.proxyConfig.addresses.public_address) {
        this.address = this.proxyConfig.addresses.public_address;
      } else {
        this.resolveFqdn();
      }

      this.loading.getProxyConfig = false;
      this.getAvailableInterfaces();

      if (!this.isProxyConfigured) {
        this.focusElement("fqdn");
      }
    },
    goToCertificates() {
      this.core.$router.push("/settings/tls-certificates");
    },
    async listModules() {
      this.loading.listModules = true;
      this.error.listModules = "";
      const taskAction = "list-modules";
      const eventId = this.getUuid();

      // register to task error
      this.core.$root.$once(
        `${taskAction}-aborted-${eventId}`,
        this.listModulesAborted
      );

      // register to task completion
      this.core.$root.$once(
        `${taskAction}-completed-${eventId}`,
        this.listModulesCompleted
      );

      const res = await to(
        this.createClusterTaskForApp({
          action: taskAction,
          extra: {
            title: this.core.$t("action." + taskAction),
            isNotificationHidden: true,
            eventId,
          },
        })
      );
      const err = res[0];

      if (err) {
        console.error(`error creating task ${taskAction}`, err);
        this.error.listModules = this.getErrorMessage(err);
        this.loading.listModules = false;
        return;
      }
    },
    listModulesAborted(taskResult, taskContext) {
      console.error(`${taskContext.action} aborted`, taskResult);
      this.error.listModules = this.$t("error.generic_error");
      this.loading.listModules = false;
    },
    listModulesCompleted(taskContext, taskResult) {
      let apps = taskResult.output;
      apps.sort(this.sortByProperty("name"));
      this.apps = apps;
      this.loading.listModules = false;
    },
  },
};
</script>

<style scoped lang="scss">
@import "../../styles/carbon-utils";
</style>
