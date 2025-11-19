<!--
  Copyright (C) 2025 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->
<template>
  <div>
    <NsInlineNotification
      v-if="error.addInternalProvider"
      kind="error"
      :title="core.$t('action.add-internal-provider')"
      :description="error.addInternalProvider"
      :showCloseButton="false"
    />
    <cv-skeleton-text
      v-if="!instanceStatus"
      :paragraph="true"
      :line-count="6"
    ></cv-skeleton-text>
    <template v-else>
      <template v-if="!createdOpenLdapId">
        <NsEmptyState
          :title="core.$t('domains.installing_account_provider')"
          :animationData="GearsLottie"
          animationTitle="gears"
          :loop="true"
        />
        <NsProgressBar
          :value="installingProviderProgress"
          :indeterminate="!installingProviderProgress"
          class="mg-bottom-md"
        />
      </template>
      <template v-else-if="!isValidationCompleted">
        <div class="mg-bottom-lg">
          {{ $t("welcome.configure_openldap_provider") }}
        </div>
        <NsInlineNotification
          v-if="error.getOpenLdapDefaults"
          kind="error"
          :title="$t('action.get-defaults')"
          :description="error.getOpenLdapDefaults"
          :showCloseButton="false"
        />
        <cv-form>
          <cv-text-input
            :label="core.$t('openldap.domain')"
            v-model.trim="domain"
            :invalid-message="core.$t(error.domain)"
            :disabled="loading.getOpenLdapDefaults || loading.configureModule"
            ref="domain"
          >
          </cv-text-input>
          <cv-text-input
            :label="core.$t('openldap.admuser')"
            v-model.trim="admuser"
            :invalid-message="core.$t(error.admuser)"
            :disabled="loading.getOpenLdapDefaults || loading.configureModule"
            ref="admuser"
          >
          </cv-text-input>
          <NsPasswordInput
            :newPasswordLabel="core.$t('openldap.admpass')"
            :confirmPasswordLabel="core.$t('openldap.admpass_confirm')"
            v-model="admpass"
            @passwordValidation="onNewOpenLdapPasswordValidation"
            :newPaswordHelperText="
              core.$t('openldap.choose_openldap_admin_password')
            "
            :newPasswordInvalidMessage="core.$t(error.admpass)"
            :confirmPasswordInvalidMessage="core.$t(error.confirmPassword)"
            :passwordHideLabel="core.$t('password.hide_password')"
            :passwordShowLabel="core.$t('password.show_password')"
            :lengthLabel="core.$t('password.long_enough')"
            :lowercaseLabel="core.$t('password.lowercase_letter')"
            :uppercaseLabel="core.$t('password.uppercase_letter')"
            :numberLabel="core.$t('password.number')"
            :symbolLabel="core.$t('password.symbol')"
            :equalLabel="core.$t('password.equal')"
            :focus="focusPasswordField"
            :disabled="loading.getOpenLdapDefaults || loading.configureModule"
            light
            class="new-provider-password"
          />
        </cv-form>
        <NsInlineNotification
          v-if="error.configureModule"
          kind="error"
          :title="core.$t('action.configure-module')"
          :description="error.configureModule"
          :showCloseButton="false"
        />
      </template>
      <template v-else>
        <NsEmptyState
          :title="core.$t('domains.configuring_account_provider')"
          :animationData="GearsLottie"
          animationTitle="gears"
          :loop="true"
        />
        <NsProgressBar
          :value="configuringProviderProgress"
          :indeterminate="!configuringProviderProgress"
          class="mg-bottom-md"
        />
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
import { mapState, mapActions } from "vuex";
import to from "await-to-js";
import { PROXY_STEP } from "./FirstConfigurationModal.vue";

//// review

export default {
  name: "OpenldapStep",
  mixins: [UtilService, TaskService, IconService, LottieService],
  data() {
    return {
      createdOpenLdapId: "",
      installingProviderProgress: 0,
      configuringProviderProgress: 0,
      domain: "",
      admuser: "",
      admpass: "",
      passwordValidation: null,
      isValidationCompleted: false,
      focusPasswordField: { element: "" },
      loading: {
        addInternalProvider: false,
        getStatus: false,
        getOpenLdapDefaults: false,
        configureModule: false,
      },
      error: {
        domain: "",
        admuser: "",
        admpass: "",
        confirmPassword: "",
        addInternalProvider: "",
        getStatus: "",
        getOpenLdapDefaults: "",
        configureModule: "",
      },
    };
  },
  computed: {
    ...mapState(["core", "instanceStatus"]),
  },
  watch: {
    instanceStatus: {
      //// test!
      immediate: true,
      handler(newVal) {
        console.log(
          "@@ openldap step, watch instanceStatus",
          this.instanceStatus
        ); ////

        if (newVal) {
          this.installOpenldapProvider();
        }
      },
    },
  },
  // created() { ////
  //   console.log("created OpenldapStep"); ////

  //   if (!this.instanceStatus) {
  //     // retrieve installation node and then install openldap
  //     this.getStatus();
  //   } else {
  //     this.installOpenldapProvider();
  //   }
  // },
  methods: {
    ...mapActions(["setInstanceStatusInStore"]),
    next() {
      console.log("next, openldap step"); ////

      if (this.createdOpenLdapId) {
        this.configureOpenLdap();
      }
    },
    async installOpenldapProvider() {
      this.error.addInternalProvider = "";
      const taskAction = "add-internal-provider";
      const eventId = this.getUuid();
      this.installingProviderProgress = 0;

      // register to task error
      this.core.$root.$once(
        `${taskAction}-aborted-${eventId}`,
        this.addInternalProviderAborted
      );

      // register to task completion
      this.core.$root.$once(
        `${taskAction}-completed-${eventId}`,
        this.addInternalProviderCompleted
      );

      // register to task progress to update progress bar
      this.core.$root.$on(
        `${taskAction}-progress-${eventId}`,
        this.addInternalProviderProgress
      );

      console.log("this.instanceStatus", this.instanceStatus); ////
      console.log("this.instanceStatus.node", this.instanceStatus.node); ////

      const nodeId = parseInt(this.instanceStatus.node);

      console.log("nodeId", nodeId); ////

      const res = await to(
        this.createClusterTaskForApp({
          action: taskAction,
          data: {
            image: "openldap",
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
        this.error.addInternalProvider = this.getErrorMessage(err);
        return;
      }
    },
    addInternalProviderAborted(taskResult, taskContext) {
      console.error(`${taskContext.action} aborted`, taskResult);

      // unregister to task progress
      this.core.$root.$off(
        `${taskContext.action}-progress-${taskContext.extra.eventId}`
      );
    },
    addInternalProviderCompleted(taskContext, taskResult) {
      // unregister to task progress
      this.core.$root.$off(
        `${taskContext.action}-progress-${taskContext.extra.eventId}`
      );

      this.createdOpenLdapId = taskResult.output.module_id;
      this.getOpenLdapDefaults();
    },
    addInternalProviderProgress(progress) {
      this.installingProviderProgress = progress;
    },
    // async getStatus() { ////
    //   this.loading.getStatus = true;
    //   this.error.getStatus = "";
    //   const taskAction = "get-status";
    //   const eventId = this.getUuid();

    //   // register to task error
    //   this.core.$root.$once(
    //     `${taskAction}-aborted-${eventId}`,
    //     this.getStatusAborted
    //   );

    //   // register to task completion
    //   this.core.$root.$once(
    //     `${taskAction}-completed-${eventId}`,
    //     this.getStatusCompleted
    //   );

    //   const res = await to(
    //     this.createModuleTaskForApp(this.instanceName, {
    //       action: taskAction,
    //       extra: {
    //         title: this.$t("action." + taskAction),
    //         isNotificationHidden: true,
    //         eventId,
    //       },
    //     })
    //   );
    //   const err = res[0];

    //   if (err) {
    //     console.error(`error creating task ${taskAction}`, err);
    //     this.error.getStatus = this.getErrorMessage(err);
    //     this.loading.getStatus = false;
    //     return;
    //   }
    // },
    // getStatusAborted(taskResult, taskContext) {
    //   console.error(`${taskContext.action} aborted`, taskResult);
    //   this.error.getStatus = this.$t("error.generic_error");
    //   this.loading.getStatus = false;
    // },
    // getStatusCompleted(taskContext, taskResult) {
    //   this.status = taskResult.output;

    //   console.log("@@ status", this.status); ////

    //   // save status to vuex store
    //   this.setInstanceStatusInStore(this.status);
    //   this.loading.getStatus = false;
    //   // install openldap provider
    //   this.installOpenldapProvider();
    // },
    async getOpenLdapDefaults() {
      this.loading.getOpenLdapDefaults = true;
      this.error.getOpenLdapDefaults = "";
      const taskAction = "get-defaults";
      const eventId = this.getUuid();

      // register to task error
      this.core.$root.$once(
        `${taskAction}-aborted-${eventId}`,
        this.getOpenLdapDefaultsAborted
      );

      // register to task completion
      this.core.$root.$once(
        `${taskAction}-completed-${eventId}`,
        this.getOpenLdapDefaultsCompleted
      );

      const res = await to(
        this.createModuleTaskForApp(this.createdOpenLdapId, {
          action: taskAction,
          data: {
            provision: "new-domain",
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
        this.error.getOpenLdapDefaults = this.getErrorMessage(err);
        return;
      }
    },
    getOpenLdapDefaultsAborted(taskResult, taskContext) {
      console.error(`${taskContext.action} aborted`, taskResult);
      this.loading.getOpenLdapDefaults = false;
      this.error.getOpenLdapDefaults = this.$t("error.generic_error");
    },
    getOpenLdapDefaultsCompleted(taskContext, taskResult) {
      this.loading.getOpenLdapDefaults = false;
      const defaults = taskResult.output;
      this.domain = defaults.domain;
      this.admuser = defaults.admuser;

      // clear password
      this.admpass = "";

      // focus on first field
      this.$nextTick(() => {
        this.focusElement("domain");
      });
    },
    onNewOpenLdapPasswordValidation(passwordValidation) {
      this.passwordValidation = passwordValidation;
    },
    clearOpenLdapErrors() {
      this.error.domain = "";
      this.error.admuser = "";
      this.error.admpass = "";
      this.error.confirmPassword = "";
      this.error.getOpenLdapDefaults = "";
    },
    validateConfigureOpenLdap() {
      this.clearOpenLdapErrors();
      let isValidationOk = true;

      // openldap domain

      if (!this.domain) {
        this.error.domain = "common.required";

        if (isValidationOk) {
          this.focusElement("domain");
          isValidationOk = false;
        }
      }

      // openldap admin user

      if (!this.admuser) {
        this.error.admuser = "common.required";

        if (isValidationOk) {
          this.focusElement("admuser");
          isValidationOk = false;
        }
      }

      // openldap admin password

      if (!this.admpass) {
        this.error.admpass = "common.required";

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
          if (!this.error.admpass) {
            this.error.admpass = "password.password_not_secure";
          }

          if (isValidationOk) {
            this.focusPasswordField = { element: "newPassword" };
            isValidationOk = false;
          }
        }

        if (!this.passwordValidation.isEqualOk) {
          if (!this.error.admpass) {
            this.error.admpass = "password.passwords_do_not_match";
          }

          if (!this.error.confirmPassword) {
            this.error.confirmPassword = "password.passwords_do_not_match";
          }

          if (isValidationOk) {
            this.focusPasswordField = { element: "confirmPassword" };
            isValidationOk = false;
          }
        }
      }
      return isValidationOk;
    },
    async configureOpenLdap() {
      const isValidationOk = this.validateConfigureOpenLdap();
      if (!isValidationOk) {
        return;
      }

      this.loading.configureModule = true;
      const taskAction = "configure-module";
      const eventId = this.getUuid();
      this.configuringProviderProgress = 0;

      // register to task error
      this.core.$root.$once(
        `${taskAction}-aborted-${eventId}`,
        this.configureOpenLdapAborted
      );

      // register to task validation
      this.core.$root.$once(
        `${taskAction}-validation-failed-${eventId}`,
        this.configureOpenLdapValidationFailed
      );
      this.core.$root.$once(
        `${taskAction}-validation-ok-${eventId}`,
        this.configureOpenLdapValidationOk
      );

      // register to task progress to update progress bar
      this.core.$root.$on(
        `${taskAction}-progress-${eventId}`,
        this.configureOpenLdapProgress
      );

      // register to task completion
      this.core.$root.$once(
        `${taskAction}-completed-${eventId}`,
        this.configureOpenLdapCompleted
      );

      const res = await to(
        this.createModuleTaskForApp(this.createdOpenLdapId, {
          action: taskAction,
          data: {
            domain: this.domain,
            admuser: this.admuser,
            admpass: this.admpass,
            provision: "new-domain",
          },
          extra: {
            title: this.core.$t("openldap.openldap_configuration"),
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
    configureOpenLdapValidationOk() {
      // this.step = "configuringOpenldap"; ////

      this.isValidationCompleted = true;
    },
    configureOpenLdapValidationFailed(validationErrors, taskContext) {
      this.loading.configureModule = false;

      // unregister to task progress
      this.core.$root.$off(
        `${taskContext.action}-progress-${taskContext.extra.eventId}`
      );

      let focusAlreadySet = false;

      for (const validationError of validationErrors) {
        const param = validationError.parameter;
        // set i18n error message
        this.error[param] = "domains." + validationError.error;

        if (!focusAlreadySet) {
          this.focusElement(param);
          focusAlreadySet = true;
        }
      }
    },
    configureOpenLdapProgress(progress) {
      this.configuringProviderProgress = progress;
    },
    configureOpenLdapCompleted(taskContext) {
      this.loading.configureModule = false;

      // this.accountProviderId = this.createdOpenLdapId; ////

      // unregister to task progress
      this.core.$root.$off(
        `${taskContext.action}-progress-${taskContext.extra.eventId}`
      );

      this.$emit("set-account-provider", this.createdOpenLdapId);

      // go to proxy step
      this.$emit("set-step", PROXY_STEP);
    },
  },
};
</script>

<style scoped lang="scss">
@import "../styles/carbon-utils";
</style>
