<!--
  Copyright (C) 2025 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->
<template>
  <div>
    <div class="mg-bottom-lg">
      {{ $t("welcome.configure_nethvoice_application") }}
    </div>
    <template v-if="!isConfigureModuleValidationCompleted">
      <cv-form>
        <NsTextInput
          :label="$t('settings.nethvoice_host')"
          v-model="nethvoice_host"
          :placeholder="$t('common.eg_value', { value: 'voice.example.com' })"
          :disabled="loading.configureModule"
          :invalid-message="error.nethvoice_host"
          ref="nethvoice_host"
          data-modal-primary-focus
        />
        <NsTextInput
          :label="$t('settings.nethcti_ui_host')"
          v-model="nethcti_ui_host"
          :placeholder="$t('common.eg_value', { value: 'cti.example.com' })"
          :disabled="loading.configureModule"
          :invalid-message="error.nethcti_ui_host"
          ref="nethcti_ui_host"
        />
        <!-- let's encrypt toggle -->
        <NsToggle
          value="letsEncrypt"
          :label="core.$t('apps_lets_encrypt.request_https_certificate')"
          v-model="isLetsEncryptEnabled"
          :disabled="loading.configureModule"
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
          :title="core.$t('apps_lets_encrypt.lets_encrypt_disabled_warning')"
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
        <NsComboBox
          v-model.trim="timezone"
          :autoFilter="true"
          :autoHighlight="true"
          :title="$t('settings.timezone')"
          :label="$t('settings.timezone_placeholder')"
          :options="timezoneOptions"
          :userInputLabel="core.$t('settings.user_input_l')"
          :acceptUserInput="false"
          :showItemType="true"
          :invalid-message="error.timezone"
          :disabled="loading.configureModule"
          tooltipAlignment="start"
          tooltipDirection="top"
          light
          ref="timezone"
        >
          <template slot="tooltip">
            {{ $t("settings.timezone_tooltip") }}
          </template>
        </NsComboBox>
        <NsPasswordInput
          :newPasswordLabel="$t('settings.admin_password')"
          :confirmPasswordLabel="$t('settings.confirm_admin_password')"
          v-model="nethvoice_admin_password"
          @passwordValidation="onPasswordValidation"
          :newPasswordInvalidMessage="error.nethvoice_admin_password"
          :confirmPasswordInvalidMessage="error.confirm_admin_password"
          :passwordHideLabel="core.$t('password.hide_password')"
          :passwordShowLabel="core.$t('password.show_password')"
          :lengthLabel="core.$t('password.long_enough')"
          :lowercaseLabel="core.$t('password.lowercase_letter')"
          :uppercaseLabel="core.$t('password.uppercase_letter')"
          :numberLabel="core.$t('password.number')"
          :symbolLabel="core.$t('password.symbol')"
          :equalLabel="core.$t('password.equal')"
          :focus="focusPasswordField"
          :disabled="loading.configureModule"
          light
        />
        <div>admUserExists {{ admUserExists }} ////</div>
        <div>accountProvider {{ accountProvider }} ////</div>
        <!-- ////  -->
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
      </cv-form>
    </template>
    <template v-else>
      <!-- configuring nethvoice -->
      <NsEmptyState
        :title="$t('welcome.configuring_nethvoice')"
        :animationData="GearsLottie"
        animationTitle="gears"
        :loop="true"
      />
      <NsProgressBar
        :value="configuringNethvoiceProgress"
        :indeterminate="!configuringNethvoiceProgress"
        class="mg-bottom-md"
      />
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
import { PasswordGeneratorService } from "@/mixins/passwordGenerator";

//// review

export default {
  name: "NethvoiceStep",
  mixins: [
    UtilService,
    TaskService,
    IconService,
    LottieService,
    PasswordGeneratorService,
  ],
  props: {
    accountProvider: {
      type: [Object, null],
      required: true,
    },
  },
  data() {
    return {
      nethvoice_host: "",
      nethcti_ui_host: "",
      isLetsEncryptEnabled: false,
      isLetsEncryptCurrentlyEnabled: false,
      validationErrorDetails: [],
      timezone: "",
      timezoneOptions: [],
      nethvoice_admin_password: "",
      // randomly generated password for nethvoice-adm user
      admUserPassword: "",
      domainUsers: [],
      passwordValidation: null,
      configuringNethvoiceProgress: 0,
      focusPasswordField: { element: "" },
      isConfigureModuleValidationCompleted: false,
      loading: {
        getUsers: false,
        addUser: false,
        configureModule: false,
        setAdminPassword: false,
      },
      error: {
        nethvoice_host: "",
        nethcti_ui_host: "",
        timezone: "",
        nethvoice_admin_password: "",
        getUsers: "",
        addUser: "",
        configureModule: "",
        setAdminPassword: "",
      },
    };
  },
  computed: {
    ...mapState(["core", "instanceName", "instanceStatus", "defaults"]),
    admUsername() {
      return `${this.instanceName}-adm`;
    },
    admUserExists() {
      return this.domainUsers.some((user) => user.user === this.admUsername);
    },
  },
  watch: {
    ////
  },
  created() {
    this.timezoneOptions = this.defaults.accepted_timezone_list.map((tz) => {
      return {
        name: tz,
        value: tz,
        label: tz,
      };
    });

    this.$nextTick(() => {
      this.timezone = this.defaults.local_timezone;
    });

    // load domain users to check if nethvoice-adm user exists
    this.getUsers();
  },
  methods: {
    validateConfigureModule() {
      this.clearErrors();
      this.validationErrorDetails = [];
      let isValidationOk = true;

      if (!this.nethvoice_host) {
        this.error.nethvoice_host = this.$t("error.required");

        if (isValidationOk) {
          this.focusElement("nethvoice_host");
          isValidationOk = false;
        }
      }

      if (!this.nethcti_ui_host) {
        this.error.nethcti_ui_host = this.$t("error.required");

        if (isValidationOk) {
          this.focusElement("nethcti_ui_host");
          isValidationOk = false;
        }
      }

      if (!this.timezone) {
        this.error.timezone = this.$t("error.required");
        isValidationOk = false;
      }

      if (this.nethvoice_host && this.nethvoice_host === this.nethcti_ui_host) {
        this.error.nethvoice_host = this.$t("error.same_host");
        this.error.nethcti_ui_host = this.$t("error.same_host");

        if (isValidationOk) {
          this.focusElement("nethvoice_host");
          isValidationOk = false;
        }
      }

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

          if (!this.error.confirm_admin_password) {
            this.error.confirm_admin_password = this.core.$t(
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
    configureModuleValidationFailed(validationErrors, taskContext) {
      this.loading.configureModule = false;

      // unregister to task progress
      this.core.$root.$off(
        `${taskContext.action}-progress-${taskContext.extra.eventId}`
      );

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
    goToCertificates() {
      this.core.$router.push("/settings/tls-certificates");
    },
    onPasswordValidation(passwordValidation) {
      this.passwordValidation = passwordValidation;
    },
    next() {
      console.log("next, nvoice step"); ////

      this.startConfiguration();
    },
    async getUsers() {
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
            domain: this.accountProvider.id,
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
    },
    getUsersCompleted(taskContext, taskResult) {
      this.domainUsers = taskResult.output.users;
      this.loading.getUsers = false;
    },
    startConfiguration() {
      const isValidationOk = this.validateConfigureModule();
      if (!isValidationOk) {
        return;
      }

      if (this.accountProvider.internal && !this.admUserExists) {
        this.addAdmUser();
      }
      this.configureModule();
      this.setAdminPassword();
    },
    async addAdmUser() {
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
      // this.core.$root.$once( ////
      //   `${taskAction}-completed-${eventId}`,
      //   this.addAdmUserCompleted
      // );

      const admDisplayName = `${this.instanceName} Administrator`;
      this.admUserPassword = this.generateAdmPassword();

      const res = await to(
        this.createClusterTaskForApp(this.instanceName, {
          action: taskAction,
          data: {
            user: this.admUsername,
            display_name: admDisplayName,
            password: this.admUserPassword,
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
        return;
      }
    },
    addAdmUserAborted(taskResult, taskContext) {
      console.error(`${taskContext.action} aborted`, taskResult);
      this.error.addUser = this.$t("error.generic_error");
      this.loading.addUser = false;
    },
    async setAdminPassword() {
      this.error.setAdminPassword = "";
      this.loading.setAdminPassword = true;
      const taskAction = "set-nethvoice-admin-password";
      const eventId = this.getUuid();

      // register to task error
      this.core.$root.$once(
        `${taskAction}-aborted-${eventId}`,
        this.setAdminPasswordAborted
      );

      const res = await to(
        this.createModuleTaskForApp(this.instanceName, {
          action: taskAction,
          data: {
            nethvoice_admin_password: this.nethvoice_admin_password,
          },
          extra: {
            title: this.$t("settings.set_password"),
            description: this.$t("common.processing"),
            eventId,
            isNotificationHidden: true,
          },
        })
      );
      const err = res[0];

      if (err) {
        console.error(`error creating task ${taskAction}`, err);
        this.error.setAdminPassword = this.getErrorMessage(err);
        return;
      }
    },
    setAdminPasswordAborted(taskResult, taskContext) {
      console.error(`${taskContext.action} aborted`, taskResult);
      this.error.setAdminPassword = this.$t("error.generic_error");
      this.loading.setAdminPassword = false;
    },
    async configureModule() {
      this.error.configureModule = "";
      this.loading.configureModule = true;
      const taskAction = "configure-module";
      const eventId = this.getUuid();
      this.configuringNethvoiceProgress = 0;

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

      // register to task completion
      this.core.$root.$once(
        `${taskAction}-completed-${eventId}`,
        this.configureModuleCompleted
      );

      // register to task progress to update progress bar
      this.core.$root.$on(
        `${taskAction}-progress-${eventId}`,
        this.configureModuleProgress
      );

      const res = await to(
        this.createModuleTaskForApp(this.instanceName, {
          action: taskAction,
          data: {
            nethvoice_host: this.nethvoice_host,
            nethcti_ui_host: this.nethcti_ui_host,
            lets_encrypt: this.isLetsEncryptEnabled,
            user_domain: this.accountProvider.id,
            reports_international_prefix: "+39",
            timezone: this.timezone,
            nethvoice_adm_username: this.admUsername,
            nethvoice_adm_password: this.admUserPassword,
          },
          extra: {
            title: this.$t("settings.configure_instance", {
              instance: this.instanceName,
            }),
            description: this.$t("common.processing"),
            eventId,
            isProgressNotified: true,
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

      // unregister to task progress
      this.core.$root.$off(
        `${taskContext.action}-progress-${taskContext.extra.eventId}`
      );
    },
    configureModuleValidationOk() {
      // show progress animation
      this.isConfigureModuleValidationCompleted = true;

      // emit to parent that validation is ok ////
      // this.$emit("configureModuleValidationOk"); //// remove
    },
    configureModuleProgress(progress) {
      this.configuringNethvoiceProgress = progress;
    },
    configureModuleCompleted(taskContext) {
      console.log("@@ configureModuleCompleted"); ////

      // emit to parent that configuration is finished
      this.$emit("finish");

      // unregister to task progress
      this.core.$root.$off(
        `${taskContext.action}-progress-${taskContext.extra.eventId}`
      );
    },
  },
};
</script>

<style scoped lang="scss">
@import "../../styles/carbon-utils";
</style>
