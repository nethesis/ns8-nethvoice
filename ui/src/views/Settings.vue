<!--
  Copyright (C) 2024 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->
<template>
  <cv-grid fullWidth>
    <cv-row>
      <cv-column class="page-title">
        <h2>{{ $t("settings.title") }}</h2>
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
      <cv-row v-if="!proxy_installed && !loadingState">
        <cv-column>
          <NsInlineNotification
            kind="info"
            :title="$t('settings.proxy_not_installed')"
            :description="$t('settings.proxy_not_installed_description')"
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
                :disabled="loadingState || !proxy_installed"
                :invalid-message="error.nethvoice_host"
                ref="nethvoice_host"
              />
              <cv-text-input
                :label="$t('settings.nethcti_ui_host')"
                v-model="form.nethcti_ui_host"
                placeholder="cti.example.com"
                :disabled="loadingState || !proxy_installed"
                :invalid-message="error.nethcti_ui_host"
                ref="nethcti_ui_host"
              />
              <cv-toggle
                :label="$t('settings.lets_encrypt')"
                value="lets_encrypt"
                :disabled="loadingState || !proxy_installed"
                v-model="form.lets_encrypt"
              >
                <template slot="text-left">
                  {{ $t("common.disabled") }}
                </template>
                <template slot="text-right">
                  {{ $t("common.enabled") }}
                </template>
              </cv-toggle>
              <NsInlineNotification
                v-if="warningVisible"
                kind="warning"
                :title="$t('common.warning')"
                :description="$t('settings.change_domain_provider_warning')"
                :showCloseButton="false"
              />
              <NsComboBox
                :title="$t('settings.user_domain')"
                :options="domainList"
                :auto-highlight="true"
                :label="$t('settings.user_domain_placeholder')"
                :disabled="loadingState || !proxy_installed"
                :invalid-message="error.user_domain"
                v-model="form.user_domain"
                ref="user_domain"
                :acceptUserInput="false"
                @change="onSelectionChange($event)"
              />
              <NsComboBox
                v-model.trim="form.timezone"
                :autoFilter="true"
                :autoHighlight="true"
                :title="$t('settings.timezone')"
                :label="$t('settings.timezone_placeholder')"
                :options="timezoneList"
                :userInputLabel="core.$t('common.user_input_l')"
                :acceptUserInput="false"
                :showItemType="true"
                :invalid-message="$t(error.timezone)"
                :disabled="
                  loading.getConfiguration ||
                  loading.configureModule ||
                  loading.getDefaults ||
                  !proxy_installed
                "
                tooltipAlignment="start"
                tooltipDirection="top"
                ref="timezone"
              >
                <template slot="tooltip">
                  {{ $t("settings.timezone_tooltip") }}
                </template>
              </NsComboBox>
              <NsTextInput
                :label="$t('settings.reports_international_prefix')"
                v-model="form.reports_international_prefix"
                placeholder="+39"
                :disabled="loadingState || !proxy_installed"
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
                :disabled="loadingState || !proxy_installed"
                :invalid-message="error.nethvoice_admin_password"
                ref="nethvoice_admin_password"
                type="password"
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
              <NsInlineNotification
                v-if="error.configureModule"
                kind="error"
                :title="$t('action.configure-module')"
                :description="error.configureModule"
                :showCloseButton="false"
              />
              <NsButton
                kind="primary"
                :icon="Save20"
                :loading="loading.configureModule"
                :disabled="loadingState || !proxy_installed"
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
import { PasswordGeneratorService } from "@/mixins/passwordGenerator";

export default {
  name: "Settings",
  components: { ResumeConfigNotification },
  mixins: [
    TaskService,
    IconService,
    UtilService,
    QueryParamService,
    PageTitleService,
    PasswordGeneratorService,
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
      warningVisible: false,
      open: [false, false],
      align: "end",
      size: "medium",
      validationErrorDetails: [],
      form: {
        nethvoice_host: "",
        nethvoice_admin_password: "",
        nethcti_ui_host: "",
        lets_encrypt: true,
        user_domain: "",
        reports_international_prefix: "+39",
        timezone: "",
        nethvoice_adm: {},
      },
      isDarkMode: false, //// remove
      proxy_installed: false,
      config: {},
      subscription_systemid: "",
      loading: {
        getConfiguration: false,
        configureModule: false,
        userDomains: false,
        getDefaults: false,
        getUsers: false,
        getProxyStatus: false,
      },
      domainList: [],
      timezoneList: [],
      providers: {},
      initialUserDomainSet: false,
      passwordFieldType: "password",
      users: {},
      error: {
        getConfiguration: "",
        getDefaults: "",
        getUsers: "",
        configureModule: "",
        nethvoice_host: "",
        nethvoice_admin_password: "",
        nethcti_ui_host: "",
        lets_encrypt: "",
        user_domain: "",
        reports_international_prefix: "",
        timezone: "",
      },
      warning: {
        user_domain: "",
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
    loadingState() {
      return Object.values(this.loading).some(
        (loadingState) => loadingState === true
      );
    },
    isSubscriptionValid() {
      return (
        this.subscription_systemid && this.subscription_systemid.trim() !== ""
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

    // register to events
    this.$root.$on("reloadConfig", this.getConfiguration);
  },
  beforeDestroy() {
    // remove only the specific event listener registered by this component
    this.$root.$off("reloadConfig", this.getConfiguration);
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

      this.config = taskResult.output;
      this.subscription_systemid = config.subscription_systemid || "";

      this.form.nethvoice_host = config.nethvoice_host;
      this.form.nethcti_ui_host = config.nethcti_ui_host;
      this.form.nethvoice_admin_password = "";
      this.form.lets_encrypt = config.lets_encrypt;
      this.form.user_domain = config.user_domain;
      this.obtainedUserDomain = config.user_domain;
      if (
        config.user_domain === "" ||
        config.user_domain === undefined ||
        config.user_domain === null
      ) {
        this.initialUserDomainSet = true;
      } else {
        this.initialUserDomainSet = false;
      }
      if (config.reports_international_prefix !== "") {
        this.form.reports_international_prefix =
          config.reports_international_prefix;
      }
      this.form.timezone = config.timezone;
      this.form.nethvoice_adm.username = config.nethvoice_adm_username;
      this.form.nethvoice_adm.password = config.nethvoice_adm_password;
      this.focusElement("nethvoice_host");
    },
    validateConfigureModule() {
      this.clearErrors();
      this.validationErrorDetails = [];
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

      const reportsPrefixRegex = /^(00\d{1,4}|\+\d{1,4})$/;
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
        if (validationError.details) {
          // show inline error notification with details
          this.validationErrorDetails = validationError.details
            .split("\n")
            .filter((detail) => detail.trim() !== "");
        } else {
          const param = validationError.parameter;

          // set i18n error message
          this.error[param] = this.$t("settings." + validationError.error);
        }
      }
    },
    async configureModule() {
      const isValidationOk = this.validateConfigureModule();
      if (!isValidationOk) {
        return;
      }
      this.warningVisible = false;

      // check if nethvoice adm exists
      var exists = this.users[this.form.user_domain].filter((user) => {
        return user.user === this.instanceName + "-adm";
      });

      // check if domain is internal
      var internal =
        this.domainList.filter((domain) => {
          return domain.name == this.form.user_domain;
        })[0].location == "internal";

      // create nethvoice adm user, if not exists and if domain is internal
      if (internal) {
        if (exists.length == 0) {
          // compose credentials
          this.form.nethvoice_adm.username = this.instanceName + "-adm";
          this.form.nethvoice_adm.password = this.generateAdmPassword();

          // execute task
          const resAdm = await to(
            this.createModuleTaskForApp(this.providers[this.form.user_domain], {
              action: "add-user",
              data: {
                user: this.form.nethvoice_adm.username,
                display_name: this.instanceName + " Administrator",
                password: this.form.nethvoice_adm.password,
                locked: false,
                groups: ["domain admins"],
              },
              extra: {
                title: this.$t("settings.create_nethvoice_adm"),
                description: this.$t("common.processing"),
                eventId,
                isNotificationHidden: true,
              },
            })
          );
          const errAdm = resAdm[0];

          // check error
          if (errAdm) {
            console.error(`error creating task ${taskAction}`, errAdm);
            this.error.configureModule = this.getErrorMessage(errAdm);
            this.loading.configureModule = false;
            return;
          }
        } else {
          // if domain changed
          if (this.config.user_domain != this.form.user_domain) {
            // change password
            const resAdm = await to(
              this.createModuleTaskForApp(
                this.providers[this.form.user_domain],
                {
                  action: "alter-user",
                  data: {
                    user: this.form.nethvoice_adm.username,
                    password: this.form.nethvoice_adm.password,
                  },
                  extra: {
                    title: this.$t("settings.set_nethvoice_adm_password"),
                    description: this.$t("common.processing"),
                    eventId,
                    isNotificationHidden: true,
                  },
                }
              )
            );
            const errAdm = resAdm[0];

            // check error
            if (errAdm) {
              console.error(`error creating task ${taskAction}`, errAdm);
              this.error.configureModule = this.getErrorMessage(errAdm);
              this.loading.configureModule = false;
              return;
            }
          }
        }
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
            nethvoice_adm_username: this.form.nethvoice_adm.username,
            nethvoice_adm_password: this.form.nethvoice_adm.password,
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
      this.getUserDomains();
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
      this.domainList = [];
      for (var d in taskResult.output.domains) {
        var domain = taskResult.output.domains[d];

        this.domainList.push({
          name: domain.name,
          label: domain.name,
          value: domain.name,
          location: domain.location,
        });
        this.providers[domain.name] = domain.providers[0].id;

        // get users for this domain
        this.getUsers(domain.name);
      }
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
      this.timezoneList = [];
      taskResult.output.accepted_timezone_list.forEach((value) =>
        this.timezoneList.push({
          name: value,
          label: value,
          value: value,
        })
      );
      this.loading.getDefaults = false;
      this.proxy_installed = taskResult.output.proxy_status.proxy_installed;
    },
    async getUsers(domain) {
      console.log("@@@ getUsers for", domain); ////

      this.loading.getUsers = true;

      const taskAction = "list-domain-users";
      const eventId = this.getUuid();

      // register to task error
      this.core.$root.$once(
        `${taskAction}-aborted-${eventId}`,
        this.getUsersAborted
      );

      // register to task completion
      this.core.$root.$once(
        `${taskAction}-completed-${eventId}`,
        this.getUsersCompleted
      );

      const res = await to(
        this.createClusterTaskForApp({
          action: taskAction,
          data: {
            domain: domain,
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
        this.error.getConfiguration = this.getErrorMessage(err);
        this.loading.getUsers = false;
        return;
      }
    },
    getUsersAborted(taskResult, taskContext) {
      console.error(`${taskContext.action} aborted`, taskResult);
      this.error.getConfiguration = this.$t("error.generic_error");
      this.loading.getUsers = false;
      this.getConfiguration();
    },
    getUsersCompleted(taskContext, taskResult) {
      this.users[taskContext.data.domain] = taskResult.output.users;
      this.loading.getUsers = false;
    },
    onSelectionChange(newValue) {
      if (!this.initialUserDomainSet && newValue !== this.obtainedUserDomain) {
        this.warningVisible = true;
      } else {
        this.warningVisible = false;
      }
    },
    toggleTheme() {}, ////
    ////
    setLightTheme() {
      this.isDarkMode = false;
    },
    ////
    setDarkTheme() {
      this.isDarkMode = true;
    },
  },
};
</script>

<style scoped lang="scss">
@import "../styles/carbon-utils";
</style>
