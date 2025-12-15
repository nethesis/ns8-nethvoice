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
    <cv-row v-if="!isAppConfigured">
      <cv-column>
        <ResumeConfigNotification />
      </cv-column>
    </cv-row>
    <cv-row v-else-if="!isProxyInstalled && !isLoading && !isErrorState">
      <cv-column>
        <NsInlineNotification
          kind="warning"
          :title="$t('settings.proxy_not_installed')"
          :description="$t('settings.proxy_not_installed_description')"
          :showCloseButton="false"
          :actionLabel="$t('settings.go_to_software_center')"
          @action="goToSoftwareCenter"
        />
      </cv-column>
    </cv-row>
    <template v-else>
      <!-- show settings page -->
      <cv-row v-if="error.userDomains">
        <cv-column>
          <NsInlineNotification
            kind="error"
            :title="core.$t('action.list-user-domains')"
            :description="error.userDomains"
            :showCloseButton="false"
          />
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
      <cv-row v-if="error.getDefaults">
        <cv-column>
          <NsInlineNotification
            kind="error"
            :title="$t('action.get-defaults')"
            :description="error.getDefaults"
            :showCloseButton="false"
          />
        </cv-column>
      </cv-row>
      <!-- skeleton -->
      <template v-if="isLoading">
        <cv-row>
          <cv-column>
            <cv-tile light>
              <cv-skeleton-text
                :paragraph="true"
                heading
                :line-count="10"
              ></cv-skeleton-text>
            </cv-tile>
          </cv-column>
        </cv-row>
        <cv-row>
          <cv-column>
            <cv-tile light>
              <cv-skeleton-text
                :paragraph="true"
                heading
                :line-count="5"
              ></cv-skeleton-text>
            </cv-tile>
          </cv-column>
        </cv-row>
      </template>
      <template v-else>
        <!-- settings form -->
        <cv-row>
          <cv-column>
            <cv-tile light>
              <h4 class="mb-4">{{ $t("settings.general") }}</h4>
              <cv-form @submit.prevent="startConfiguration">
                <cv-text-input
                  :label="$t('settings.nethvoice_host')"
                  v-model="nethvoice_host"
                  placeholder="voice.example.com"
                  :disabled="isFormDisabled"
                  :invalid-message="error.nethvoice_host"
                  ref="nethvoice_host"
                />
                <cv-text-input
                  :label="$t('settings.nethcti_ui_host')"
                  v-model="nethcti_ui_host"
                  placeholder="cti.example.com"
                  :disabled="isFormDisabled"
                  :invalid-message="error.nethcti_ui_host"
                  ref="nethcti_ui_host"
                />
                <!-- let's encrypt toggle -->
                <NsToggle
                  value="letsEncrypt"
                  :label="$t('settings.request_le_certificates')"
                  v-model="lets_encrypt"
                  :disabled="isFormDisabled"
                >
                  <template #tooltip>
                    <div class="mg-bottom-sm">
                      {{ $t("settings.request_le_certificates_tooltip") }}
                    </div>
                    <div class="mg-bottom-sm">
                      <cv-link @click="goToCertificates">
                        {{
                          core.$t("apps_lets_encrypt.go_to_tls_certificates")
                        }}
                      </cv-link>
                    </div>
                  </template>
                  <template slot="text-left">{{
                    $t("common.disabled")
                  }}</template>
                  <template slot="text-right">{{
                    $t("common.enabled")
                  }}</template>
                </NsToggle>
                <!-- disabling let's encrypt warning -->
                <NsInlineNotification
                  v-if="
                    isLetsEncryptCurrentlyEnabled &&
                    !lets_encrypt &&
                    instanceStatus
                  "
                  kind="warning"
                  :title="
                    core.$t('apps_lets_encrypt.lets_encrypt_disabled_warning')
                  "
                  :description="
                    core.$t(
                      'apps_lets_encrypt.lets_encrypt_disabled_warning_description',
                      {
                        node: instanceStatus.node_ui_name
                          ? instanceStatus.node_ui_name
                          : instanceStatus.node,
                      }
                    )
                  "
                  :showCloseButton="false"
                />
                <NsComboBox
                  :title="$t('settings.user_domain')"
                  :options="domainList"
                  :auto-highlight="true"
                  :label="core.$t('common.choose')"
                  :disabled="isFormDisabled"
                  :invalid-message="error.user_domain"
                  v-model="user_domain"
                  ref="user_domain"
                  :acceptUserInput="false"
                  @change="onSelectionChange($event)"
                />
                <NsInlineNotification
                  v-if="changeProviderWarning"
                  kind="warning"
                  :title="$t('settings.change_domain_provider_warning_title')"
                  :description="
                    $t('settings.change_domain_provider_warning_description')
                  "
                  :showCloseButton="false"
                />
                <NsComboBox
                  v-model.trim="timezone"
                  :autoFilter="true"
                  :autoHighlight="true"
                  :title="$t('settings.timezone')"
                  :label="$t('settings.timezone_placeholder')"
                  :options="timezoneList"
                  :userInputLabel="core.$t('common.user_input_l')"
                  :acceptUserInput="false"
                  :showItemType="true"
                  :invalid-message="$t(error.timezone)"
                  :disabled="isFormDisabled"
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
                  v-model="reports_international_prefix"
                  placeholder="+39"
                  :disabled="isFormDisabled"
                  :invalid-message="error.reports_international_prefix"
                >
                  <template slot="tooltip">
                    {{ $t("settings.reports_international_prefix_tooltip") }}
                  </template>
                </NsTextInput>
                <NsInlineNotification
                  v-if="validationErrorDetails.length"
                  kind="error"
                  :title="
                    core.$t('apps_lets_encrypt.cannot_obtain_certificate')
                  "
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
                  v-if="error.getUsers"
                  kind="error"
                  :title="$t('action.list-domain-users')"
                  :description="error.getUsers"
                  :showCloseButton="false"
                />
                <NsInlineNotification
                  v-if="error.addUser"
                  kind="error"
                  :title="core.$t('action.add-user')"
                  :description="error.addUser"
                  :showCloseButton="false"
                />
                <NsInlineNotification
                  v-if="error.alterUser"
                  kind="error"
                  :title="core.$t('action.alter-user')"
                  :description="error.alterUser"
                  :showCloseButton="false"
                />
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
                  :disabled="isFormDisabled || isErrorState"
                >
                  {{ $t("common.save") }}
                </NsButton>
              </cv-form>
            </cv-tile>
          </cv-column>
        </cv-row>
        <!-- change admin password form -->
        <cv-row>
          <cv-column>
            <cv-tile light>
              <h4 class="mb-4">
                {{ $t("settings.change_nethvoice_admin_password") }}
              </h4>
              <cv-form @submit.prevent="changeAdminPassword">
                <NsPasswordInput
                  :newPasswordLabel="$t('settings.new_admin_password')"
                  :confirmPasswordLabel="
                    $t('settings.confirm_new_admin_password')
                  "
                  v-model="nethvoice_admin_password"
                  @passwordValidation="onPasswordValidation"
                  :newPasswordInvalidMessage="
                    $t(error.nethvoice_admin_password)
                  "
                  :confirmPasswordInvalidMessage="$t(error.confirmPassword)"
                  :passwordHideLabel="core.$t('password.hide_password')"
                  :passwordShowLabel="core.$t('password.show_password')"
                  :lengthLabel="core.$t('password.long_enough')"
                  :lowercaseLabel="core.$t('password.lowercase_letter')"
                  :uppercaseLabel="core.$t('password.uppercase_letter')"
                  :numberLabel="core.$t('password.number')"
                  :symbolLabel="core.$t('password.symbol')"
                  :equalLabel="core.$t('password.equal')"
                  :focus="focusPasswordField"
                  :clearConfirmPasswordCommand="clearConfirmPasswordCommand"
                  :disabled="isFormDisabled"
                />
                <NsInlineNotification
                  v-if="error.setAdminPassword"
                  kind="error"
                  :title="$t('action.set-nethvoice-admin-password')"
                  :description="error.setAdminPassword"
                  :showCloseButton="false"
                />
                <NsButton
                  kind="secondary"
                  :icon="Password20"
                  :loading="loading.setAdminPassword"
                  :disabled="isFormDisabled || isErrorState"
                >
                  {{ $t("settings.change_password") }}
                </NsButton>
              </cv-form>
            </cv-tile>
          </cv-column>
        </cv-row>
      </template>
    </template>
  </cv-grid>
</template>

<script>
import to from "await-to-js";
import { mapState, mapActions } from "vuex";
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
      changeProviderWarning: false,
      validationErrorDetails: [],
      nethvoice_host: "",
      nethvoice_admin_password: "",
      nethcti_ui_host: "",
      lets_encrypt: false,
      isLetsEncryptCurrentlyEnabled: false,
      user_domain: "",
      reports_international_prefix: "+39",
      timezone: "",
      nethvoice_adm: {},
      isProxyInstalled: false,
      config: {},
      subscription_systemid: "",
      passwordValidation: null,
      focusPasswordField: { element: "" },
      clearConfirmPasswordCommand: 0,
      loading: {
        getConfiguration: false,
        configureModule: false,
        userDomains: false,
        getDefaults: false,
        getUsers: false,
        setAdminPassword: false,
        addUser: false,
        alterUser: false,
        getStatus: false,
      },
      domainList: [],
      timezoneList: [],
      providers: {},
      initialUserDomainSet: false, //// ?
      // users: {}, //// remove?
      domainUsers: [],
      error: {
        getConfiguration: "",
        configureModule: "",
        userDomains: "",
        getDefaults: "",
        getUsers: "",
        setAdminPassword: "",
        addUser: "",
        alterUser: "",
        getStatus: "",
        nethvoice_host: "",
        nethvoice_admin_password: "",
        nethcti_ui_host: "",
        lets_encrypt: "",
        user_domain: "",
        reports_international_prefix: "",
        timezone: "",
      },
      // warning: { ////
      //   user_domain: "",
      // },
    };
  },
  computed: {
    ...mapState([
      "instanceName",
      "core",
      "appName",
      "isAppConfigured",
      "isShownFirstConfigurationModal",
      "instanceStatus",
    ]),
    isFormDisabled() {
      return (
        this.loading.getConfiguration ||
        this.loading.configureModule ||
        this.loading.userDomains ||
        this.loading.getDefaults ||
        this.loading.getUsers ||
        this.loading.setAdminPassword ||
        this.loading.addUser ||
        this.loading.alterUser
      );
    },
    isLoading() {
      return (
        this.loading.getConfiguration ||
        this.loading.userDomains ||
        this.loading.getDefaults
      );
    },
    isSubscriptionValid() {
      return (
        this.subscription_systemid && this.subscription_systemid.trim() !== ""
      );
    },
    isSelectedDomainInternal() {
      const selectedDomain = this.domainList.find(
        (domain) => domain.name === this.user_domain
      );
      return !!selectedDomain && selectedDomain.location === "internal";
    },
    isErrorState() {
      return !!(
        this.error.getConfiguration ||
        this.error.configureModule ||
        this.error.userDomains ||
        this.error.getDefaults ||
        this.error.getUsers ||
        this.error.setAdminPassword ||
        this.error.addUser ||
        this.error.alterUser
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

    if (!this.instanceStatus) {
      // retrieve installation node, needed for traefik certificate warning
      this.getStatus();
    }

    // register to events
    this.$root.$on("reloadConfig", this.getConfiguration);
  },
  beforeDestroy() {
    // remove only the specific event listener registered by this component
    this.$root.$off("reloadConfig", this.getConfiguration);
  },
  methods: {
    ...mapActions(["setInstanceStatusInStore"]),
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

      this.nethvoice_host = config.nethvoice_host;
      this.nethcti_ui_host = config.nethcti_ui_host;
      this.nethvoice_admin_password = "";
      this.lets_encrypt = config.lets_encrypt;
      this.isLetsEncryptCurrentlyEnabled = config.lets_encrypt;

      this.user_domain = config.user_domain;
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
        this.reports_international_prefix = config.reports_international_prefix;
      }
      this.timezone = config.timezone;
      this.nethvoice_adm.username = config.nethvoice_adm_username;
      this.nethvoice_adm.password = config.nethvoice_adm_password;

      if (this.isAppConfigured) {
        this.focusElement("nethvoice_host");
      }
    },
    validateConfigureModule() {
      this.clearErrors();
      this.validationErrorDetails = [];
      let isValidationOk = true;

      if (!this.nethvoice_host) {
        this.error.nethvoice_host = this.$t("error.required");
        isValidationOk = false;
      }

      if (!this.nethcti_ui_host) {
        this.error.nethcti_ui_host = this.$t("error.required");
        isValidationOk = false;
      }

      if (!this.user_domain) {
        this.error.user_domain = this.$t("error.required");
        isValidationOk = false;
      }

      if (!this.timezone) {
        this.error.timezone = this.$t("error.required");
        isValidationOk = false;
      }

      const reportsPrefixRegex = /^(00\d{1,4}|\+\d{1,4})$/;
      if (!reportsPrefixRegex.test(this.reports_international_prefix)) {
        this.error.reports_international_prefix = this.$t(
          "error.reports_prefix_invalid"
        );
        isValidationOk = false;
      }

      if (
        this.nethvoice_host === this.nethcti_ui_host &&
        this.nethvoice_host !== ""
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
    startConfiguration() {
      const isValidationOk = this.validateConfigureModule();
      if (!isValidationOk) {
        return;
      }

      console.log("@@ validation ok"); ////

      this.getUsers();
    },
    async addAdmUser() {
      console.log("@@ addAdmUser"); ////

      this.error.addUser = "";
      this.loading.addUser = true;
      const taskAction = "add-user";
      const eventId = this.getUuid();

      // register to task error
      this.core.$root.$once(
        `${taskAction}-aborted-${eventId}`,
        this.addAdmUserAborted
      );

      // register to task completion
      this.core.$root.$once(
        `${taskAction}-completed-${eventId}`,
        this.addAdmUserCompleted
      );

      this.nethvoice_adm.username = this.instanceName + "-adm";
      this.nethvoice_adm.password = this.generateAdmPassword();

      const res = await to(
        this.createModuleTaskForApp(this.providers[this.user_domain], {
          action: taskAction,
          data: {
            user: this.nethvoice_adm.username,
            display_name: `${this.instanceName} Administrator`,
            password: this.nethvoice_adm.password,
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
      const err = res[0];

      if (err) {
        console.error(`error creating task ${taskAction}`, err);
        this.error.addUser = this.getErrorMessage(err);
        this.loading.addUser = false;
        return;
      }
    },
    addAdmUserAborted(taskResult, taskContext) {
      console.error(`${taskContext.action} aborted`, taskResult);
      this.error.addUser = this.$t("error.generic_error");
      this.loading.addUser = false;
    },
    addAdmUserCompleted() {
      this.loading.addUser = false;

      // proceed with module configuration
      this.configureModule();
    },
    async changeAdmUserPassword() {
      console.log("@@ changeAdmUserPassword"); ////

      this.error.alterUser = "";
      this.loading.alterUser = true;
      const taskAction = "alter-user";
      const eventId = this.getUuid();

      // register to task error
      this.core.$root.$once(
        `${taskAction}-aborted-${eventId}`,
        this.changeAdmUserPasswordAborted
      );

      // register to task completion
      this.core.$root.$once(
        `${taskAction}-completed-${eventId}`,
        this.changeAdmUserPasswordCompleted
      );

      const res = await to(
        this.createModuleTaskForApp(this.providers[this.user_domain], {
          action: "alter-user",
          data: {
            user: this.nethvoice_adm.username,
            password: this.nethvoice_adm.password,
          },
          extra: {
            title: this.$t("settings.set_nethvoice_adm_password"),
            description: this.$t("common.processing"),
            eventId,
            isNotificationHidden: true,
          },
        })
      );
      const err = res[0];

      if (err) {
        console.error(`error creating task ${taskAction}`, err);
        this.error.alterUser = this.getErrorMessage(err);
        this.loading.alterUser = false;
        return;
      }
    },
    changeAdmUserPasswordAborted(taskResult, taskContext) {
      console.error(`${taskContext.action} aborted`, taskResult);
      this.error.alterUser = this.$t("error.generic_error");
      this.loading.alterUser = false;
    },
    changeAdmUserPasswordCompleted() {
      this.loading.alterUser = false;

      // proceed with module configuration
      this.configureModule();
    },
    async configureModule() {
      console.log("@@ configureModule"); ////

      ////
      // const isValidationOk = this.validateConfigureModule();
      // if (!isValidationOk) {
      //   return;
      // }

      //// remove stuff

      // check if nethvoice adm exists ////
      // var exists = this.users[this.user_domain].filter((user) => { ////
      //   return user.user === this.instanceName + "-adm";
      // });

      // check if domain is internal ////
      // var internal = ////
      //   this.domainList.filter((domain) => {
      //     return domain.name == this.user_domain;
      //   })[0].location == "internal";

      // create nethvoice adm user, if not exists and if domain is internal
      // if (internal) { ////
      //   if (exists.length == 0) {
      //     // compose credentials
      //     this.nethvoice_adm.username = this.instanceName + "-adm";
      //     this.nethvoice_adm.password = this.generateAdmPassword();

      //     // execute task
      //     const resAdm = await to(
      //       this.createModuleTaskForApp(this.providers[this.user_domain], {
      //         action: "add-user",
      //         data: {
      //           user: this.nethvoice_adm.username,
      //           display_name: this.instanceName + " Administrator",
      //           password: this.nethvoice_adm.password,
      //           locked: false,
      //           groups: ["domain admins"],
      //         },
      //         extra: {
      //           title: this.$t("settings.create_nethvoice_adm"),
      //           description: this.$t("common.processing"),
      //           eventId,
      //           isNotificationHidden: true,
      //         },
      //       })
      //     );
      //     const errAdm = resAdm[0];

      //     // check error
      //     if (errAdm) {
      //       console.error(`error creating task ${taskAction}`, errAdm);
      //       this.error.configureModule = this.getErrorMessage(errAdm);
      //       this.loading.configureModule = false;
      //       return;
      //     }
      //   } else {
      //     // if domain changed
      //     if (this.config.user_domain != this.user_domain) {
      //       // change password
      //       const resAdm = await to(
      //         this.createModuleTaskForApp(this.providers[this.user_domain], {
      //           action: "alter-user",
      //           data: {
      //             user: this.nethvoice_adm.username,
      //             password: this.nethvoice_adm.password,
      //           },
      //           extra: {
      //             title: this.$t("settings.set_nethvoice_adm_password"),
      //             description: this.$t("common.processing"),
      //             eventId,
      //             isNotificationHidden: true,
      //           },
      //         })
      //       );
      //       const errAdm = resAdm[0];

      //       // check error
      //       if (errAdm) {
      //         console.error(`error creating task ${taskAction}`, errAdm);
      //         this.error.configureModule = this.getErrorMessage(errAdm);
      //         this.loading.configureModule = false;
      //         return;
      //       }
      //     }
      //   }
      // }

      this.changeProviderWarning = false;
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
            nethvoice_host: this.nethvoice_host,
            nethcti_ui_host: this.nethcti_ui_host,
            lets_encrypt: this.lets_encrypt,
            user_domain: this.user_domain,
            reports_international_prefix: this.reports_international_prefix,
            timezone: this.timezone,
            nethvoice_adm_username: this.nethvoice_adm.username,
            nethvoice_adm_password: this.nethvoice_adm.password,
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

      //// remove:

      // execute set password ////
      // const taskActionPass = "set-nethvoice-admin-password";
      // const eventIdPass = this.getUuid();

      // // register to task error
      // this.core.$root.$once(
      //   `${taskActionPass}-aborted-${eventIdPass}`,
      //   this.configureModuleAborted
      // );

      // // register to task validation
      // this.core.$root.$once(
      //   `${taskActionPass}-validation-failed-${eventIdPass}`,
      //   this.configureModuleValidationFailed
      // );

      // // register to task completion
      // this.core.$root.$once(
      //   `${taskActionPass}-completed-${eventIdPass}`,
      //   this.configureModuleCompleted
      // );

      // const resPass = await to(
      //   this.createModuleTaskForApp(this.instanceName, {
      //     action: taskActionPass,
      //     data: {
      //       nethvoice_admin_password: this.nethvoice_admin_password,
      //     },
      //     extra: {
      //       title: this.$t("action." + taskAction),
      //       description: this.$t("common.processing"),
      //       eventId,
      //     },
      //   })
      // );
      // const errPass = resPass[0];

      // if (errPass) {
      //   console.error(`error creating task ${taskAction}`, errPass);
      //   this.error.configureModule = this.getErrorMessage(errPass);
      //   this.loading.configureModule = false;
      //   return;
      // }
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
      // this.getUserDomains(); ////
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
        this.error.userDomains = this.getErrorMessage(err);
        this.loading.userDomains = false;
        return;
      }
    },
    getUserDomainsAborted(taskResult, taskContext) {
      console.error(`${taskContext.action} aborted`, taskResult);
      this.error.userDomains = this.$t("error.generic_error");
      this.loading.userDomains = false;
      // this.getConfiguration(); ////
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

        // get users for this domain ////
        // this.getUsers(domain.name); ////
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
      this.timezoneList = [];
      taskResult.output.accepted_timezone_list.forEach((value) =>
        this.timezoneList.push({
          name: value,
          label: value,
          value: value,
        })
      );
      this.loading.getDefaults = false;
      this.isProxyInstalled = taskResult.output.proxy_status.proxy_installed;
    },
    async getUsers() {
      // console.log("@@@ getUsers for", domain); ////
      this.error.getUsers = "";
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
            domain: this.user_domain,
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
        this.error.getUsers = this.getErrorMessage(err);
        this.loading.getUsers = false;
        return;
      }
    },
    getUsersAborted(taskResult, taskContext) {
      console.error(`${taskContext.action} aborted`, taskResult);
      this.error.getUsers = this.$t("error.generic_error");
      this.loading.getUsers = false;
      // this.getConfiguration(); ////
    },
    getUsersCompleted(taskContext, taskResult) {
      // this.users[taskContext.data.domain] = taskResult.output.users; ////
      this.domainUsers = taskResult.output.users;
      this.loading.getUsers = false;

      if (!this.isSelectedDomainInternal) {
        // if selected domain is not internal, proceed with configuration
        this.configureModule();
      } else {
        // check if nethvoice-adm user exists in the domain
        const admUserExists = this.domainUsers.some((user) => {
          return user.user === `${this.instanceName}-adm`;
        });

        if (admUserExists) {
          // check if domain changed
          if (this.config.user_domain != this.user_domain) {
            // change adm user password, then proceed with configuration
            this.changeAdmUserPassword();
          } else {
            // if exists and domain not changed, proceed with configuration
            this.configureModule();
          }
        } else {
          // if not exists, create nethvoice-adm user in the domain, then proceed with configuration
          this.addAdmUser();
        }
      }
    },
    onSelectionChange(newValue) {
      if (!this.initialUserDomainSet && newValue !== this.obtainedUserDomain) {
        this.changeProviderWarning = true;
      } else {
        this.changeProviderWarning = false;
      }
    },
    goToCertificates() {
      this.core.$router.push("/settings/tls-certificates");
    },
    validateChangeAdminPassword() {
      this.clearErrors();
      let isValidationOk = true;

      // password validation

      if (!this.nethvoice_admin_password) {
        this.error.nethvoice_admin_password = this.$t("common.required");

        if (isValidationOk) {
          this.focusPasswordField = { element: "newPassword" };
          isValidationOk = false;
        }
      } else {
        if (
          !this.passwordValidation.isLengthOk ||
          !this.passwordValidation.isLowercaseOk ||
          !this.passwordValidation.isUppercaseOk ||
          !this.passwordValidation.isNumberOk ||
          !this.passwordValidation.isSymbolOk
        ) {
          if (!this.error.nethvoice_admin_password) {
            this.error.nethvoice_admin_password = this.core.$t(
              "password.password_not_secure"
            );
          }

          if (isValidationOk) {
            this.focusPasswordField = { element: "newPassword" };
            isValidationOk = false;
          }
        }

        if (!this.passwordValidation.isEqualOk) {
          if (!this.error.nethvoice_admin_password) {
            this.error.nethvoice_admin_password = this.core.$t(
              "password.passwords_do_not_match"
            );
          }

          if (!this.error.confirmPassword) {
            this.error.confirmPassword = this.core.$t(
              "password.passwords_do_not_match"
            );
          }

          if (isValidationOk) {
            this.focusPasswordField = { element: "confirmPassword" };
            isValidationOk = false;
          }
        }
      }
      return isValidationOk;
    },
    async changeAdminPassword() {
      console.log("@@ changeAdminPassword"); ////

      const isValidationOk = this.validateChangeAdminPassword();

      console.log("isValidationOk", isValidationOk); ////

      if (!isValidationOk) {
        return;
      }
      this.loading.setAdminPassword = true;
      const taskAction = "set-nethvoice-admin-password";
      const eventId = this.getUuid();

      // register to task error
      this.core.$root.$once(
        `${taskAction}-aborted-${eventId}`,
        this.setAdminPasswordAborted
      );

      // register to task validation
      this.core.$root.$once(
        `${taskAction}-validation-failed-${eventId}`,
        this.setAdminPasswordValidationFailed
      );

      // register to task completion
      this.core.$root.$once(
        `${taskAction}-completed-${eventId}`,
        this.setAdminPasswordCompleted
      );

      const res = await to(
        this.createModuleTaskForApp(this.instanceName, {
          action: taskAction,
          data: {
            nethvoice_admin_password: this.nethvoice_admin_password,
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
        this.error.setAdminPassword = this.getErrorMessage(err);
        this.loading.setAdminPassword = false;
        return;
      }
    },
    setAdminPasswordValidationFailed(validationErrors) {
      this.loading.setAdminPassword = false;

      for (const validationError of validationErrors) {
        const param = validationError.parameter;

        // set i18n error message
        this.error[param] = this.$t("settings." + validationError.error);
      }
    },
    setAdminPasswordAborted(taskResult, taskContext) {
      console.error(`${taskContext.action} aborted`, taskResult);
      this.error.setAdminPassword = this.$t("error.generic_error");
      this.loading.setAdminPassword = false;
    },
    setAdminPasswordCompleted() {
      this.nethvoice_admin_password = "";
      this.clearConfirmPasswordCommand++;
      this.loading.setAdminPassword = false;
    },
    onPasswordValidation(passwordValidation) {
      this.passwordValidation = passwordValidation;
    },
    goToSoftwareCenter() {
      this.core.$router.push("/software-center");
    },
    async getStatus() {
      console.log("@@ getStatus"); ////

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
  },
};
</script>

<style scoped lang="scss">
@import "../styles/carbon-utils";
</style>
