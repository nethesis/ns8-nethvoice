<!--
  Copyright (C) 2023 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->
<template>
  <cv-grid fullWidth>
    <cv-row>
      <cv-column class="page-title">
        <h2>{{ $t("settings.title") }}</h2>
      </cv-column>
    </cv-row>
    <cv-row v-if="error.getConfiguration">
      <cv-column>
        <NsInlineNotification
          kind="error"
          :title="$t('action.get-configuration')"
          :description="error.getConfiguration"
          :showCloseButton="false"
        />
      </cv-column>
    </cv-row>
    <cv-row>
      <cv-column>
        <cv-tile light>
          <cv-form @submit.prevent="configureModule">
            <cv-text-input
              :label="$t('settings.nethvoice_host')"
              v-model="form.nethvoice_host"
              placeholder="voice.example.com"
              :disabled="loadingState"
              :invalid-message="error.nethvoice_host"
              ref="nethvoice_host"
            />
            <cv-text-input
              :label="$t('settings.nethcti_ui_host')"
              v-model="form.nethcti_ui_host"
              placeholder="cti.example.com"
              :disabled="loadingState"
              :invalid-message="error.nethcti_ui_host"
              ref="nethcti_ui_host"
            />
            <NsComboBox
              :title="$t('settings.user_domain')"
              :options="domainList"
              :auto-highlight="true"
              :label="$t('settings.user_domain_placeholder')"
              :disabled="loadingState"
              :invalid-message="error.user_domain"
              v-model="form.user_domain"
              ref="user_domain"
            />
            <NsComboBox
              v-model.trim="form.timezone"
              :autoFilter="true"
              :autoHighlight="true"
              :title="$t('settings.timezone')"
              :label="$t('settings.timezone_placeholder')"
              :options="timezoneList"
              :userInputLabel="core.$t('settings.choose_timezone')"
              :acceptUserInput="false"
              :showItemType="true"
              :invalid-message="$t(error.timezone)"
              :disabled="
                loading.getConfiguration ||
                loading.configureModule ||
                loading.getDefaults
              "
              tooltipAlignment="start"
              tooltipDirection="top"
              ref="timezone"
            >
              <template slot="tooltip">
                {{ $t("settings.timezone_tooltip") }}
              </template>
            </NsComboBox>
            <cv-toggle
              :label="$t('settings.lets_encrypt')"
              value="lets_encrypt"
              :disabled="loadingState"
              v-model="form.lets_encrypt"
            />
            <NsTextInput
              :label="$t('settings.reports_international_prefix')"
              v-model="form.reports_international_prefix"
              placeholder="+39"
              :disabled="loadingState"
              :invalid-message="error.reports_international_prefix"
            >
              <template slot="tooltip">
                {{ $t("settings.reports_international_prefix_tooltip") }}
              </template>
            </NsTextInput>
            <cv-text-input
              :label="$t('settings.nethvoice_admin_password')"
              v-model="form.nethvoice_admin_password"
              placeholder=""
              :disabled="loadingState"
              :invalid-message="error.nethvoice_admin_password"
              ref="nethvoice_admin_password"
            />
            <cv-row v-if="error.configureModule">
              <cv-column>
                <NsInlineNotification
                  kind="error"
                  :title="$t('action.configure-module')"
                  :description="error.configureModule"
                  :showCloseButton="false"
                />
              </cv-column>
            </cv-row>
            <NsButton
              kind="primary"
              :icon="Save20"
              :loading="loading.configureModule"
              :disabled="loadingState"
            >
              {{ $t("settings.save") }}
            </NsButton>
          </cv-form>
        </cv-tile>
      </cv-column>
    </cv-row>
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

export default {
  name: "Settings",
  mixins: [
    TaskService,
    IconService,
    UtilService,
    QueryParamService,
    PageTitleService,
  ],
  pageTitle() {
    return this.$t("settings.title") + " - " + this.appName;
  },
  data() {
    return {
      q: {
        page: "settings",
      },
      urlCheckInterval: null,
      form: {
        nethvoice_host: "",
        nethvoice_admin_password: "",
        nethcti_ui_host: "",
        lets_encrypt: false,
        user_domain: "",
        reports_international_prefix: "+39",
        timezone: "",
      },
      loading: {
        getConfiguration: false,
        configureModule: false,
        userDomains: false,
        getDefaults: false,
      },
      domainList: [],
      timezoneList: [],
      error: {
        getConfiguration: "",
        getDefaults: "",
        configureModule: "",
        nethvoice_host: "",
        nethvoice_admin_password: "",
        nethcti_ui_host: "",
        lets_encrypt: "",
        user_domain: "",
        reports_international_prefix: "",
        timezone: "",
      },
    };
  },
  computed: {
    ...mapState(["instanceName", "core", "appName"]),
    loadingState() {
      return Object.values(this.loading).some(
        (loadingState) => loadingState === true
      );
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
    this.getUserDomains();
    this.getDefaults();
  },
  methods: {
    async getConfiguration() {
      this.loading.getConfiguration = true;
      this.error.getConfiguration = "";
      const taskAction = "get-configuration";
      const eventId = this.getUuid();

      // register to task error
      this.core.$root.$once(
        `${taskAction}-aborted-${eventId}`,
        this.getConfigurationAborted
      );

      // register to task completion
      this.core.$root.$once(
        `${taskAction}-completed-${eventId}`,
        this.getConfigurationCompleted
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
        this.error.getConfiguration = this.getErrorMessage(err);
        this.loading.getConfiguration = false;
        return;
      }
    },
    getConfigurationAborted(taskResult, taskContext) {
      console.error(`${taskContext.action} aborted`, taskResult);
      this.error.getConfiguration = this.$t("error.generic_error");
      this.loading.getConfiguration = false;
    },
    getConfigurationCompleted(taskContext, taskResult) {
      this.loading.getConfiguration = false;
      const config = taskResult.output;

      this.form.nethvoice_host = config.nethvoice_host;
      this.form.nethcti_ui_host = config.nethcti_ui_host;
      this.form.nethvoice_admin_password = "";
      this.form.lets_encrypt = config.lets_encrypt;
      this.form.user_domain = config.user_domain;
      if (config.reports_international_prefix !== "") {
        this.form.reports_international_prefix =
          config.reports_international_prefix;
      }
      this.form.timezone = config.timezone;

      this.focusElement("nethvoice_host");
    },
    validateConfigureModule() {
      this.clearErrors(this);
      let isValidationOk = true;

      if (!this.form.nethvoice_host) {
        this.error.nethvoice_host = this.$t("error.required");
        isValidationOk = false;
      }

      if (!this.form.nethcti_ui_host) {
        this.error.nethcti_ui_host = this.$t("error.required");
        isValidationOk = false;
      }

      if (!this.form.user_domain) {
        this.error.user_domain = this.$t("error.required");
        isValidationOk = false;
      }

      if (!this.form.timezone) {
        this.error.timezone = this.$t("error.required");
        isValidationOk = false;
      }

      const reportsPrefixRegex = /^(00\d{2}|\+\d{2})$/;
      if (!reportsPrefixRegex.test(this.form.reports_international_prefix)) {
        this.error.reports_international_prefix = this.$t(
          "error.reports_prefix_invalid"
        );
        isValidationOk = false;
      }

      if (
        this.form.nethvoice_host === this.form.nethcti_ui_host &&
        this.form.nethvoice_host !== ""
      ) {
        this.error.nethvoice_host = this.$t("error.same_host");
        this.error.nethcti_ui_host = this.$t("error.same_host");
        isValidationOk = false;
      }

      return isValidationOk;
    },
    configureModuleValidationFailed(validationErrors) {
      this.loading.configureModule = false;

      for (const validationError of validationErrors) {
        const param = validationError.parameter;

        // set i18n error message
        this.error[param] = this.$t("settings." + validationError.error);
      }
    },
    async configureModule() {
      const isValidationOk = this.validateConfigureModule();
      if (!isValidationOk) {
        return;
      }

      this.loading.configureModule = true;
      const taskAction = "configure-module";
      const eventId = this.getUuid();

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

      // register to task completion
      this.core.$root.$once(
        `${taskAction}-completed-${eventId}`,
        this.configureModuleCompleted
      );

      const res = await to(
        this.createModuleTaskForApp(this.instanceName, {
          action: taskAction,
          data: {
            nethvoice_host: this.form.nethvoice_host,
            nethcti_ui_host: this.form.nethcti_ui_host,
            lets_encrypt: this.form.lets_encrypt,
            user_domain: this.form.user_domain,
            reports_international_prefix:
              this.form.reports_international_prefix,
            timezone: this.form.timezone,
          },
          extra: {
            title: this.$t("settings.configure_instance", {
              instance: this.instanceName,
            }),
            description: this.$t("common.processing"),
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

      // execute set password
      const taskActionPass = "set-nethvoice-admin-password";
      const eventIdPass = this.getUuid();

      // register to task error
      this.core.$root.$once(
        `${taskActionPass}-aborted-${eventIdPass}`,
        this.configureModuleAborted
      );

      // register to task validation
      this.core.$root.$once(
        `${taskActionPass}-validation-failed-${eventIdPass}`,
        this.configureModuleValidationFailed
      );

      // register to task completion
      this.core.$root.$once(
        `${taskActionPass}-completed-${eventIdPass}`,
        this.configureModuleCompleted
      );

      const resPass = await to(
        this.createModuleTaskForApp(this.instanceName, {
          action: taskActionPass,
          data: {
            nethvoice_admin_password: this.form.nethvoice_admin_password,
          },
          extra: {
            title: this.$t("settings.set_password"),
            description: this.$t("common.processing"),
            eventId,
          },
        })
      );
      const errPass = resPass[0];

      if (errPass) {
        console.error(`error creating task ${taskAction}`, errPass);
        this.error.configureModule = this.getErrorMessage(errPass);
        this.loading.configureModule = false;
        return;
      }
    },
    configureModuleAborted(taskResult, taskContext) {
      console.error(`${taskContext.action} aborted`, taskResult);
      this.error.configureModule = this.$t("error.generic_error");
      this.loading.configureModule = false;
    },
    configureModuleCompleted() {
      this.loading.configureModule = false;

      // reload configuration
      this.getConfiguration();
    },
    async getUserDomains() {
      this.loading.userDomains = true;

      const taskAction = "list-user-domains";
      const eventId = this.getUuid();

      // register to task error
      this.core.$root.$once(
        `${taskAction}-aborted-${eventId}`,
        this.getUserDomainsAborted
      );

      // register to task completion
      this.core.$root.$once(
        `${taskAction}-completed-${eventId}`,
        this.getUserDomainsCompleted
      );

      const res = await to(
        this.createClusterTaskForApp({
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
        this.error.getConfiguration = this.getErrorMessage(err);
        this.loading.userDomains = false;
        return;
      }
    },
    getUserDomainsAborted(taskResult, taskContext) {
      console.error(`${taskContext.action} aborted`, taskResult);
      this.error.getConfiguration = this.$t("error.generic_error");
      this.loading.userDomains = false;
      this.getConfiguration();
    },
    getUserDomainsCompleted(taskContext, taskResult) {
      taskResult.output.domains.forEach((value) =>
        this.domainList.push({
          name: value.name,
          label: value.name,
          value: value.name,
        })
      );
      this.loading.userDomains = false;
      this.getConfiguration();
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
        this.error.getConfiguration = this.getErrorMessage(err);
        this.loading.getDefaults = false;
        return;
      }
    },
    getDefaultsAborted(taskResult, taskContext) {
      console.error(`${taskContext.action} aborted`, taskResult);
      this.error.getConfiguration = this.$t("error.generic_error");
      this.loading.getDefaults = false;
      this.getConfiguration();
    },
    getDefaultsCompleted(taskContext, taskResult) {
      taskResult.output.accepted_timezone_list.forEach((value) =>
        this.timezoneList.push({
          name: value,
          label: value,
          value: value,
        })
      );
      this.loading.getDefaults = false;
      this.getConfiguration();
    },
  },
};
</script>

<style scoped lang="scss">
@import "../styles/carbon-utils";
</style>
