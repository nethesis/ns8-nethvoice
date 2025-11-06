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
    :nextLabel="nextButtonLabel"
    :isPreviousDisabled="true"
    :isNextDisabled="isNextButtonDisabled"
    :isNextLoading="loading.configureModule"
    @modal-hidden="$emit('hide')"
    @cancel="$emit('hide')"
    @nextStep="nextStep"
  >
    <template slot="title">{{ $t("welcome.configure_nethvoice") }}</template>
    <template slot="content">
      step {{ step }} ////
      <cv-form>
        <!-- <NsInlineNotification //// 
          v-if="error.getDefaults"
          kind="error"
          :title="$t('action.get-defaults')"
          :description="error.getDefaults"
          :showCloseButton="false"
        /> -->
        <NsInlineNotification
          v-if="error.listUserDomains"
          kind="error"
          :title="core.$t('action.list-user-domains')"
          :description="error.listUserDomains"
          :showCloseButton="false"
        />
        <!-- step: select account provider -->
        <template v-if="step == 'selectAccountProvider'">
          <cv-skeleton-text
            v-if="loading.listUserDomains"
            :paragraph="true"
            :line-count="6"
          ></cv-skeleton-text>
          <!-- no user domain configured -->
          <template v-else-if="!domains.length">
            <NsEmptyState :title="$t('welcome.no_domain_configured')">
              <template #pictogram>
                <GroupPictogram />
              </template>
              <template #description>
                <div>
                  <i18n
                    path="welcome.no_domain_configured_description"
                    tag="span"
                  >
                    <template v-slot:domainsAndUsers>
                      <cv-link @click="goToDomainsAndUsers">
                        {{ core.$t("domains.title") }}
                      </cv-link>
                    </template>
                  </i18n>
                </div>
                <!-- <NsButton ////
                  kind="ghost"
                  :icon="Events20"
                  class="empty-state-button"
                >
                  {{ $t("welcome.go_to_domains_and_users") }}
                </NsButton> -->
              </template>
            </NsEmptyState>
          </template>
          <!-- there are user domains configured -->
          <template v-else>
            <div class="mg-bottom-lg">
              {{ $t("welcome.account_provider_step_description") }}
            </div>
            <label class="bx--label">
              {{ $t("welcome.account_provider_type") }}
            </label>
            <cv-radio-group :vertical="true">
              <cv-radio-button
                ref="radioVal"
                :label="$t('welcome.use_existing_provider')"
                value="use_existing_provider"
                v-model="accountProviderType"
              />
              <cv-radio-button
                ref="radioVal"
                :label="$t('welcome.create_openldap_provider')"
                value="create_openldap"
                v-model="accountProviderType"
              />
            </cv-radio-group>
            <NsComboBox
              v-if="accountProviderType == 'use_existing_provider'"
              v-model="accountProviderId"
              :label="core.$t('common.choose')"
              :title="$t('welcome.account_provider')"
              :auto-filter="true"
              :auto-highlight="true"
              :options="accountProviderOptions"
              show-item-description
            />
          </template>
          domains {{ domains }} ////
        </template>
        <!-- step: installing openldap -->
        <template v-else-if="step == 'installingOpenldap'">
          <NsInlineNotification
            v-if="error.addInternalProvider"
            kind="error"
            :title="core.$t('action.add-internal-provider')"
            :description="error.addInternalProvider"
            :showCloseButton="false"
          />
          <NsEmptyState
            :title="core.$t('domains.installing_account_provider')"
            :animationData="GearsLottie"
            animationTitle="gears"
            :loop="true"
          />
          <NsProgressBar
            :value="installProviderProgress"
            :indeterminate="!installProviderProgress"
            class="mg-bottom-md"
          />
        </template>
        <!-- step: input openldap configuration -->
        <template v-else-if="step == 'inputOpenldapConfig'">
          <div class="mg-bottom-lg">
            {{ $t("welcome.openldap_step_description") }}
          </div>
          <NsInlineNotification
            v-if="error.openldap.getDefaults"
            kind="error"
            :title="$t('action.get-defaults')"
            :description="error.openldap.getDefaults"
            :showCloseButton="false"
          />
          <cv-form>
            <cv-text-input
              :label="core.$t('openldap.domain')"
              v-model.trim="openldap.domain"
              :invalid-message="core.$t(error.openldap.domain)"
              :disabled="
                loading.openldap.configureModule || loading.openldap.getDefaults
              "
              ref="domain"
            >
            </cv-text-input>
            <cv-text-input
              :label="core.$t('openldap.admuser')"
              v-model.trim="openldap.admuser"
              :invalid-message="core.$t(error.openldap.admuser)"
              :disabled="
                loading.openldap.configureModule || loading.openldap.getDefaults
              "
              ref="admuser"
            >
            </cv-text-input>
            <NsPasswordInput
              :newPasswordLabel="core.$t('openldap.admpass')"
              :confirmPasswordLabel="core.$t('openldap.admpass_confirm')"
              v-model="openldap.admpass"
              @passwordValidation="onNewOpenLdapPasswordValidation"
              :newPaswordHelperText="
                core.$t('openldap.choose_openldap_admin_password')
              "
              :newPasswordInvalidMessage="core.$t(error.openldap.admpass)"
              :confirmPasswordInvalidMessage="
                core.$t(error.openldap.confirmPassword)
              "
              :passwordHideLabel="core.$t('password.hide_password')"
              :passwordShowLabel="core.$t('password.show_password')"
              :lengthLabel="core.$t('password.long_enough')"
              :lowercaseLabel="core.$t('password.lowercase_letter')"
              :uppercaseLabel="core.$t('password.uppercase_letter')"
              :numberLabel="core.$t('password.number')"
              :symbolLabel="core.$t('password.symbol')"
              :equalLabel="core.$t('password.equal')"
              :focus="openldap.focusPasswordField"
              :disabled="
                loading.openldap.configureModule || loading.openldap.getDefaults
              "
              light
              class="new-provider-password"
            />
          </cv-form>
          <NsInlineNotification
            v-if="error.openldap.configureModule"
            kind="error"
            :title="core.$t('action.configure-module')"
            :description="error.openldap.configureModule"
            :showCloseButton="false"
          />
        </template>
        <!-- step: configuring openldap -->
        <template v-else-if="step == 'configuringOpenldap'">
          <NsEmptyState
            :title="core.$t('openldap.configuring_openldap')"
            :animationData="GearsLottie"
            animationTitle="gears"
            :loop="true"
          />
          <NsProgressBar
            :value="configureProviderProgress"
            :indeterminate="!configureProviderProgress"
            class="mg-bottom-md"
          />
        </template>
        <!-- step: check proxy -->
        <template v-else-if="step == 'checkProxy'">
          proxy status {{ proxyStatus }} ////
        </template>
        <!-- step: installing proxy -->
        <template v-else-if="step == 'installingProxy'"> //// </template>
        <!-- step: input proxy configuration -->
        <template v-else-if="step == 'inputProxyConfig'"> //// </template>
        <!-- step: configuring proxy -->
        <template v-else-if="step == 'configuringProxy'"> //// </template>
        <!-- step: input nethvoice configuration -->
        <template v-else-if="step == 'inputNethvoiceConfig'"> //// </template>
        <!-- step: configuring nethvoice -->
        <template v-else-if="step == 'configuringNethvoice'"> //// </template>
      </cv-form>
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

//// review

export default {
  name: "FirstConfigurationModal",
  mixins: [UtilService, TaskService, IconService, LottieService],
  props: {
    isShown: {
      type: Boolean,
      default: true,
    },
  },
  data() {
    return {
      step: "",
      accountProviderType: "",
      domains: [],
      accountProviderId: "",
      installProviderProgress: 0,
      configureProviderProgress: 0,
      proxyStatus: null,
      openldap: {
        domain: "",
        admuser: "",
        admpass: "",
        passwordValidation: null,
        focusPasswordField: { element: "" },
      },
      //   domains: [ //// remove mock
      //     {
      //       name: "first",
      //       schema: "rfc2307",
      //       location: "location",
      //     },
      //     {
      //       name: "second",
      //       schema: "ad",
      //       location: "location",
      //     },
      //   ],
      loading: {
        configureModule: false,
        listUserDomains: false,
        getConfiguration: false,
        addInternalProvider: false,
        getStatus: false,
        getProxyStatus: false,
        openldap: {
          getDefaults: false,
          configureModule: false,
        },
      },
      error: {
        configureModule: "",
        listUserDomains: "",
        getConfiguration: "",
        addInternalProvider: "",
        getStatus: "",
        getProxyStatus: "",
        openldap: {
          getDefaults: "",
          domain: "",
          admuser: "",
          admpass: "",
          confirmPassword: "",
        },
      },
    };
  },
  computed: {
    ...mapState(["core", "instanceName", "instanceStatus"]),
    // stepIndex() { ////
    //   return this.steps.indexOf(this.step);
    // },
    // isFirstStep() {
    //   return this.stepIndex == 0;
    // },
    // isLastStep() {
    //   return this.stepIndex == this.steps.length - 1;
    // },
    // selectedUserDomain() { ////
    //   return this.userDomains.find((domain) => domain.selected);
    // },
    isNextButtonDisabled() {
      return (
        this.loading.listUserDomains ||
        this.loading.getStatus ||
        this.loading.configureModule ||
        this.step == "installingOpenldap" ||
        this.step == "installingProxy"
      );
    },
    nextButtonLabel() {
      if (this.step == "selectAccountProvider") {
        if (!this.domains.length && !this.loading.listUserDomains) {
          return this.$t("welcome.install_openldap");
        }
        ////
      }
      return this.core.$t("common.next");
    },
    accountProviderOptions() {
      return this.domains.map((domain) => {
        return {
          name: domain.name,
          value: domain.name,
          label: domain.name,
          description: this.getDomainType(domain),
        };
      });
    },
    // steps() { ////
    //   if (this.accountProviderType == "create_openldap") {
    //     return [
    //     ];
    //   } else {
    //     return [
    //     ];
    //   }
    // },
  },
  watch: {
    isShown: function () {
      if (this.isShown) {
        // show first step
        this.step = "selectAccountProvider";
      }
    },
    step: function () {
      if (this.step == "selectAccountProvider") {
        this.listUserDomains();
      } else if (this.step == "installingOpenldap") {
        if (!this.instanceStatus) {
          // retrieve installation node and then install openldap
          this.getStatus();
        } else {
          this.openldapInstallationProvider();
        }
      } else if (this.step == "inputOpenldapConfig") {
        this.getOpenLdapDefaults();
      } else if (this.step == "configuringOpenldap") {
        //// load openldap defaults?
      } else if (this.step == "checkProxy") {
        this.getProxyStatus();
      } else if (this.step == "installingProxy") {
        //// install proxy
      } else if (this.step == "inputProxyConfig") {
        //// load proxy defaults?
      } else if (this.step == "configuringProxy") {
        ////
      }
    },
  },
  //   created() { ////
  //   },
  //   mounted() {
  //     if (this.isShown) {
  //       this.step = this.steps[0];
  //       this.listUserDomains();
  //       //   this.listUserDomains(); ////
  //     }
  //   },
  methods: {
    ...mapActions(["setAppConfiguredInStore", "setInstanceStatusInStore"]),
    nextStep() {
      if (this.isNextButtonDisabled) {
        return;
      }

      // Steps:
      //
      // "selectAccountProvider",
      // "installingOpenldap",
      // "inputOpenldapConfig",
      // "configuringOpenldap",
      // "checkProxy"
      // "installingProxy",
      // "inputProxyConfig",
      // "configuringProxy",
      // "inputNethvoiceConfig",
      // "configuringNethvoice",

      switch (this.step) {
        case "selectAccountProvider":
          if (this.accountProviderType == "create_openldap") {
            this.step = "installingOpenldap";
          } else {
            this.step = "checkProxy";
          }
          break;
        case "inputOpenldapConfig":
          this.configureOpenLdapModule();
          //   this.step = "configuringOpenldap"; ////
          break;
        case "checkProxy":
          //// todo check proxy installation and configuration
          this.step = "installingProxy";
          break;
        case "inputProxyConfig":
          this.step = "configuringProxy";
          break;
        case "inputNethvoiceConfig":
          this.step = "configuringNethvoice";
          break;
      }

      //   if (this.isLastStep) {
      //     this.configureModule();
      //   } else {

      //   this.step = this.steps[this.stepIndex + 1]; ////
    },
    // previousStep() { ////
    //   if (!this.isFirstStep) {
    //     if (this.step == "inputOpenldapConfig") {
    //       this.step = "selectAccountProvider";
    //     } else if (this.step == "inputProxyConfig") {
    //       this.step = "";
    //     } else {
    //       this.step = this.steps[this.stepIndex - 1];
    //     }
    //   }
    // },
    getDomainType(domain) {
      if (domain.location == "internal") {
        if (domain.schema == "rfc2307") {
          return this.$t("welcome.internal_openldap");
        } else if (domain.schema == "ad") {
          return this.$t("welcome.internal_samba");
        }
      } else {
        return this.$t("welcome.external_ldap");
      }
    },
    async listUserDomains() {
      this.loading.listUserDomains = true;
      this.error.listUserDomains = "";
      const taskAction = "list-user-domains";
      const eventId = this.getUuid();

      // register to task error
      this.core.$root.$once(
        `${taskAction}-aborted-${eventId}`,
        this.listUserDomainsAborted
      );

      // register to task completion
      this.core.$root.$once(
        `${taskAction}-completed-${eventId}`,
        this.listUserDomainsCompleted
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
        this.error.listUserDomains = this.getErrorMessage(err);
        this.loading.listUserDomains = false;
        return;
      }
    },
    listUserDomainsAborted(taskResult, taskContext) {
      console.error(`${taskContext.action} aborted`, taskResult);
      this.error.listUserDomains = this.$t("error.generic_error");
      this.loading.listUserDomains = false;
    },
    listUserDomainsCompleted(taskContext, taskResult) {
      this.loading.listUserDomains = false;
      this.domains = taskResult.output.domains;

      if (this.domains.length) {
        this.accountProviderType = "use_existing_provider";
      } else {
        this.accountProviderType = "create_openldap";
      }
    },
    async configureModule() {
      this.loading.configureModule = true;
      this.error.configureModule = "";
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

      //   const res = await to( ////
      //     this.createModuleTaskForApp(this.instanceName, {
      //       action: taskAction,
      //       data: {
      //         hostname: this.hostname,
      //         mail_domain: this.mail_domain,
      //         user_domain: this.domain.name,
      //       },
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
      //     this.error.configureModule = this.getErrorMessage(err);
      //     this.loading.configureModule = false;
      //     return;
      //   }
    },
    configureModuleAborted(taskResult, taskContext) {
      console.error(`${taskContext.action} aborted`, taskResult);
      this.loading.configureModule = false;
    },
    configureModuleValidationFailed(validationErrors) {
      this.loading.configureModule = false;
      let focusAlreadySet = false;

      for (const validationError of validationErrors) {
        const param = validationError.parameter;

        // set i18n error message
        this.error[param] = this.getI18nStringWithFallback(
          "welcome." + validationError.error,
          "error." + validationError.error
        );

        if (param === "mail_domain") {
          this.step = "mailHostname";
        }

        if (!focusAlreadySet) {
          this.focusElement(param);
          focusAlreadySet = true;
        }
      }
    },
    configureModuleCompleted() {
      this.loading.configureModule = false;

      // close first configuration wizard
      this.setAppConfiguredInStore(true);

      // go to domains page
      this.goToAppPage(this.instanceName, "domains");

      this.$nextTick(() => {
        this.core.$root.$emit("reloadDomains");

        // reload configuration
        this.$emit("configured");
      });
    },
    onChangeMailHostname() {
      const match = /[^.]+\.(.+)/.exec(this.hostname);

      if (match && match.length > 1) {
        this.mail_domain = match[1];
      }
    },
    deselectOtherDomains(domain) {
      //// remove?
      for (let d of this.userDomains) {
        if (d.name !== domain.name) {
          d.selected = false;
        }
      }
    },
    goToDomainsAndUsers() {
      this.core.$router.push("/domains");
    },
    async openldapInstallationProvider() {
      this.error.addInternalProvider = "";
      const taskAction = "add-internal-provider";
      const eventId = this.getUuid();
      this.installProviderProgress = 0;

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

      // hide modal so that user can see error notification
      this.$emit("hide");
    },
    addInternalProviderCompleted(taskContext, taskResult) {
      console.log("@@@ addInternalProviderCompleted"); ////

      // unregister to task progress
      this.core.$root.$off(
        `${taskContext.action}-progress-${taskContext.extra.eventId}`
      );

      this.accountProviderId = taskResult.output.module_id;
      this.step = "inputOpenldapConfig";
    },
    addInternalProviderProgress(progress) {
      this.installProviderProgress = progress;
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
      // install openldap provider
      this.openldapInstallationProvider();
    },
    async getOpenLdapDefaults() {
      this.loading.openldap.getDefaults = true;
      this.error.openldap.getDefaults = "";
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
        this.createModuleTaskForApp(this.accountProviderId, {
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
        this.error.openldap.getDefaults = this.getErrorMessage(err);
        return;
      }
    },
    getOpenLdapDefaultsAborted(taskResult, taskContext) {
      console.error(`${taskContext.action} aborted`, taskResult);
      this.loading.openldap.getDefaults = false;

      // hide modal so that user can see error notification
      this.$emit("hide");
    },
    getOpenLdapDefaultsCompleted(taskContext, taskResult) {
      this.loading.openldap.getDefaults = false;
      const defaults = taskResult.output;
      this.openldap.domain = defaults.domain;
      this.openldap.admuser = defaults.admuser;

      // clear password
      this.openldap.admpass = "";

      // focus on first field
      this.$nextTick(() => {
        this.focusElement("domain");
      });
    },
    onNewOpenLdapPasswordValidation(passwordValidation) {
      this.openldap.passwordValidation = passwordValidation;
    },
    clearOpenLdapErrors() {
      this.error.openldap.domain = "";
      this.error.openldap.admuser = "";
      this.error.openldap.admpass = "";
      this.error.openldap.confirmPassword = "";
      this.error.openldap.getDefaults = "";
    },
    validateConfigureOpenLdapModule() {
      this.clearOpenLdapErrors();
      let isValidationOk = true;

      // openldap domain

      if (!this.openldap.domain) {
        this.error.openldap.domain = "common.required";

        if (isValidationOk) {
          this.focusElement("domain");
          isValidationOk = false;
        }
      }

      // openldap admin user

      if (!this.openldap.admuser) {
        this.error.openldap.admuser = "common.required";

        if (isValidationOk) {
          this.focusElement("admuser");
          isValidationOk = false;
        }
      }

      // openldap admin password

      if (!this.openldap.admpass) {
        this.error.openldap.admpass = "common.required";

        if (isValidationOk) {
          this.openldap.focusPasswordField = { element: "newPassword" };
          isValidationOk = false;
        }
      } else {
        if (
          !this.openldap.passwordValidation.isLengthOk ||
          !this.openldap.passwordValidation.isLowercaseOk ||
          !this.openldap.passwordValidation.isUppercaseOk ||
          !this.openldap.passwordValidation.isNumberOk ||
          !this.openldap.passwordValidation.isSymbolOk
        ) {
          if (!this.error.openldap.admpass) {
            this.error.openldap.admpass = "password.password_not_secure";
          }

          if (isValidationOk) {
            this.openldap.focusPasswordField = { element: "newPassword" };
            isValidationOk = false;
          }
        }

        if (!this.openldap.passwordValidation.isEqualOk) {
          if (!this.error.openldap.admpass) {
            this.error.openldap.admpass = "password.passwords_do_not_match";
          }

          if (!this.error.openldap.confirmPassword) {
            this.error.openldap.confirmPassword =
              "password.passwords_do_not_match";
          }

          if (isValidationOk) {
            this.openldap.focusPasswordField = { element: "confirmPassword" };
            isValidationOk = false;
          }
        }
      }
      return isValidationOk;
    },
    async configureOpenLdapModule() {
      const isValidationOk = this.validateConfigureOpenLdapModule();
      if (!isValidationOk) {
        return;
      }

      this.loading.openldap.configureModule = true;
      const taskAction = "configure-module";
      const eventId = this.getUuid();
      this.configureProviderProgress = 0;

      // register to task error
      this.core.$root.$once(
        `${taskAction}-aborted-${eventId}`,
        this.configureOpenLdapModuleAborted
      );

      // register to task validation
      this.core.$root.$once(
        `${taskAction}-validation-failed-${eventId}`,
        this.configureOpenLdapModuleValidationFailed
      );
      this.core.$root.$once(
        `${taskAction}-validation-ok-${eventId}`,
        this.configureOpenLdapModuleValidationOk
      );

      // register to task progress to update progress bar
      this.core.$root.$on(
        `${taskAction}-progress-${eventId}`,
        this.configureOpenLdapModuleProgress
      );

      // register to task completion
      this.core.$root.$once(
        `${taskAction}-completed-${eventId}`,
        this.configureOpenLdapModuleCompleted
      );

      const res = await to(
        this.createModuleTaskForApp(this.accountProviderId, {
          action: taskAction,
          data: {
            domain: this.openldap.domain,
            admuser: this.openldap.admuser,
            admpass: this.openldap.admpass,
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
        this.error.openldap.configureModule = this.getErrorMessage(err);
        this.loading.openldap.configureModule = false;
        return;
      }
    },
    configureOpenLdapModuleValidationOk() {
      this.step = "configuringProvider";
    },
    configureOpenLdapModuleValidationFailed(validationErrors, taskContext) {
      this.loading.openldap.configureModule = false;

      // unregister to task progress
      this.core.$root.$off(
        `${taskContext.action}-progress-${taskContext.extra.eventId}`
      );

      let focusAlreadySet = false;

      for (const validationError of validationErrors) {
        const param = validationError.parameter;
        // set i18n error message
        this.error.openldap[param] = "domains." + validationError.error;

        if (!focusAlreadySet) {
          this.focusElement(param);
          focusAlreadySet = true;
        }
      }
    },
    configureOpenLdapModuleProgress(progress) {
      this.configureProviderProgress = progress;
    },
    configureOpenLdapModuleCompleted(taskContext) {
      this.loading.openldap.configureModule = false;
      this.step = "checkProxy";

      // unregister to task progress
      this.core.$root.$off(
        `${taskContext.action}-progress-${taskContext.extra.eventId}`
      );
    },
    async getProxyStatus() {
      this.loading.getProxyStatus = true;

      const taskAction = "get-proxy-status";
      const eventId = this.getUuid();

      // register to task error
      this.core.$root.$once(
        `${taskAction}-aborted-${eventId}`,
        this.getProxyStatusAborted
      );

      // register to task completion
      this.core.$root.$once(
        `${taskAction}-completed-${eventId}`,
        this.getProxyStatusCompleted
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
        this.error.getProxyStatus = this.getErrorMessage(err);
        this.loading.getProxyStatus = false;
        return;
      }
    },
    getProxyStatusAborted(taskResult, taskContext) {
      console.error(`${taskContext.action} aborted`, taskResult);
      this.error.getProxyStatus = this.$t("error.generic_error");
      this.loading.getProxyStatus = false;
    },
    getProxyStatusCompleted(taskContext, taskResult) {
      this.proxyStatus = taskResult.output;

      console.log("proxyStatus", this.proxyStatus); ////

      this.loading.getProxyStatus = false;
    },
  },
};
</script>

<style scoped lang="scss">
@import "../styles/carbon-utils";
</style>
