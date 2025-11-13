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
    :isPreviousDisabled="isPreviousButtonDisabled"
    :isNextDisabled="isLoadingData || isSavingData"
    :isNextLoading="isSavingData"
    @modal-hidden="$emit('hide')"
    @cancel="$emit('hide')"
    @previousStep="previousStep"
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
              :invalid-message="error.accountProvider"
              :label="$t('welcome.account_provider_placeholder')"
              :title="$t('welcome.account_provider')"
              :auto-filter="true"
              :auto-highlight="true"
              :options="accountProviderOptions"
              show-item-description
              ref="accountProvider"
            />
            <cv-inline-loading
              v-if="isLoadingData"
              :loading-text="$t('welcome.loading_data_next_steps')"
              state="loading"
            />
            <div v-else>&nbsp;</div>
            <div class="mb-10rem"></div>
          </template>
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
            {{ $t("welcome.configure_openldap_provider") }}
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
              :disabled="loading.openldap.configureModule"
              ref="domain"
            >
            </cv-text-input>
            <cv-text-input
              :label="core.$t('openldap.admuser')"
              v-model.trim="openldap.admuser"
              :invalid-message="core.$t(error.openldap.admuser)"
              :disabled="loading.openldap.configureModule"
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
              :disabled="loading.openldap.configureModule"
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
        <!-- step: need to install proxy -->
        <template v-else-if="step == 'needToInstallProxy'">
          <div>isProxyInstalled {{ isProxyInstalled }}////</div>
          <template v-if="!isProxyInstalled">
            <!-- proxy not installed -->
            <NsEmptyState :title="$t('welcome.proxy_missing_on_node')">
              <template #description>
                {{ $t("welcome.proxy_missing_on_node_description") }}
              </template>
              <template #pictogram>
                <!-- <GroupPictogram /> //// -->
              </template>
            </NsEmptyState>
          </template>
          <template v-else-if="!isProxyConfigured">
            <!-- proxy installed but not configured -->
            <div>proxy installed but not configured ////</div>
            <ProxyConfigurationForm
              :config="proxyConfig"
              :disabled="isProxyConfigured"
              :proxyModuleId="proxyModuleId"
              ref="proxyConfigForm"
            />
          </template>
          <template v-else>
            <!-- proxy installed and configured -->
            <div>proxy installed and configured ////</div>
          </template>
        </template>
        <!-- step: installing proxy -->
        <template v-else-if="step == 'installingProxy'"> //// </template>
        <!-- step: input proxy configuration -->
        <template v-else-if="step == 'inputProxyConfig'">
          <ProxyConfigurationForm
            :config="proxyConfig"
            :disabled="isProxyConfigured"
            :proxyModuleId="proxyModuleId"
            ref="proxyConfigForm"
          />
        </template>
        <!-- step: configuring proxy -->
        <template v-else-if="step == 'configuringProxy'"> //// </template>
        <!-- step: input nethvoice configuration -->
        <template v-else-if="step == 'inputNethvoiceConfig'">
          <div class="mg-bottom-lg">
            {{ $t("welcome.configure_nethvoice_application") }}
          </div>
          <cv-form @submit.prevent="nextStep">
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
              :disabled="loading.nethvoice.configureModule"
              tooltipAlignment="start"
              tooltipDirection="top"
              ref="timezone"
            >
              <template slot="tooltip">
                {{ $t("settings.timezone_tooltip") }}
              </template>
            </NsComboBox>
            <cv-text-input
              :label="$t('settings.nethvoice_admin_password')"
              v-model="form.nethvoice_admin_password"
              placeholder=""
              :disabled="loadingState || !proxy_installed"
              :invalid-message="error.nethvoice_admin_password"
              ref="nethvoice_admin_password"
              type="password"
            />
            <!-- //// todo confirm password field -->
          </cv-form>
        </template>
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
import ProxyConfigurationForm from "./ProxyConfigurationForm.vue";

//// review

export default {
  components: { ProxyConfigurationForm },
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
      createdOpenLdapId: "",
      accountProviderId: "",
      proxyModuleId: "",
      isProxyInstalled: false,
      installProviderProgress: 0,
      configureProviderProgress: 0,
      installingProxyProgress: 0,
      openldap: {
        domain: "",
        admuser: "",
        admpass: "",
        passwordValidation: null,
        focusPasswordField: { element: "" },
      },
      // proxyStatus: { ////
      //   module_id: "",
      //   proxy_installed: false,
      // },
      proxyConfig: {},
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
        listUserDomains: false,
        listModules: false,
        addInternalProvider: false,
        getStatus: false,
        getProxyConfig: false,
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
        accountProvider: "",
        configureModule: "",
        listModules: "",
        listUserDomains: "",
        getConfiguration: "",
        addInternalProvider: "",
        getStatus: "",
        getProxyConfig: "",
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
    isPreviousButtonDisabled() {
      return [
        "selectAccountProvider",
        "installingOpenldap",
        "configuringOpenldap",
        "installingProxy",
        "configuringProxy",
        "configuringNethvoice",
      ].includes(this.step);
    },
    isLoadingData() {
      return (
        this.loading.listUserDomains ||
        this.loading.getStatus ||
        this.loading.openldap.getDefaults ||
        this.loading.nethvoice.getDefaults ||
        this.loading.getProxyConfig
      );
    },
    isSavingData() {
      // return ( ////
      //   this.step == "installingOpenldap" ||
      //   this.step == "configuringOpenldap" ||
      //   this.step == "installingProxy" ||
      //   this.step == "configuringProxy" ||
      //   this.step == "configuringNethvoice"
      // );
      return (
        this.addInternalProvider ||
        this.loading.openldap.configureModule ||
        this.loading.proxy.configureModule ||
        this.loading.nethvoice.configureModule
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
    isProxyConfigured() {
      if (
        this.proxy &&
        this.proxy.fqdn &&
        !this.proxy.fqdn.endsWith(".invalid")
      ) {
        return true;
      } else {
        return false;
      }
    },
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
        this.getDefaults();
      } else if (this.step == "installingOpenldap") {
        if (!this.instanceStatus) {
          // retrieve installation node and then install openldap
          this.getStatus();
        } else {
          this.installOpenldapProvider();
        }
      } else if (this.step == "inputOpenldapConfig") {
        this.getOpenLdapDefaults();
      } else if (this.step == "configuringOpenldap") {
        // no action needed, wait for configuration to complete
      } else if (this.step == "needToInstallProxy") {
        // if (this.isProxyInstalled) { ////
        //   this.getProxyConfig();
        // }
      } else if (this.step == "installingProxy") {
        this.installProxy();
      } else if (this.step == "inputProxyConfig") {
        //// load proxy defaults?
      } else if (this.step == "configuringProxy") {
        ////
      } else if (this.step == "inputNethvoiceConfig") {
        // this.getDefaults(); ////
      } else if (this.step == "configuringNethvoice") {
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
    previousStep() {
      switch (this.step) {
        case "inputOpenldapConfig":
        case "configuringOpenldap":
        case "needToInstallProxy":
        case "proxyAlreadyConfigured":
        case "installingProxy":
        case "inputProxyConfig":
        case "configuringProxy":
          this.step = "selectAccountProvider";
          break;
        case "inputNethvoiceConfig":
          if (!this.isProxyInstalled) {
            this.step = "needToInstallProxy";
          } else if (!this.isProxyConfigured) {
            this.step = "inputProxyConfig";
          } else {
            this.step = "proxyAlreadyConfigured";
          }
      }
    },
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
      // "needToInstallProxy"
      // "proxyAlreadyConfigured"
      // "installingProxy",
      // "inputProxyConfig",
      // "configuringProxy",
      // "inputNethvoiceConfig",
      // "configuringNethvoice",

      switch (this.step) {
        case "selectAccountProvider":
          if (!this.validateSelectAccountProvider()) {
            return;
          }

          if (this.accountProviderType == "create_openldap") {
            this.step = "installingOpenldap";
          } else {
            // go to proxy step
            if (!this.isProxyInstalled) {
              this.step = "needToInstallProxy";
            } else if (!this.isProxyConfigured) {
              this.step = "inputProxyConfig";
            } else {
              this.step = "proxyAlreadyConfigured";
            }
          }
          break;
        case "inputOpenldapConfig":
          // validate and configure openldap
          this.configureOpenLdap();
          break;
        case "needToInstallProxy": {
          this.step = "installingProxy";
          break;
        }
        case "inputProxyConfig":
          //// call child method to validate and configure proxy
          this.$refs.proxyConfigForm.configureModule();
          break;
        case "proxyAlreadyConfigured":
        case "inputNethvoiceConfig":
          //// call child method to validate and configure proxy
          this.$refs.nethvoiceConfigForm.configureModule();
          // this.step = "configuringNethvoice"; ////
          break;
      }
    },
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

        if (this.domains.length == 1) {
          // auto select the only available domain
          this.$nextTick(() => {
            this.accountProviderId = this.accountProviderOptions[0].value;
          });
        }
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
    async installOpenldapProvider() {
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
      // unregister to task progress
      this.core.$root.$off(
        `${taskContext.action}-progress-${taskContext.extra.eventId}`
      );

      this.createdOpenLdapId = taskResult.output.module_id;
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

      console.log("@@ status", this.status); ////

      // save status to vuex store
      this.setInstanceStatusInStore(this.status);
      this.loading.getStatus = false;
      // install openldap provider
      this.installOpenldapProvider();
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
    validateConfigureOpenLdap() {
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
    async configureOpenLdap() {
      const isValidationOk = this.validateConfigureOpenLdap();
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
    configureOpenLdapValidationOk() {
      this.step = "configuringOpenldap";
    },
    configureOpenLdapValidationFailed(validationErrors, taskContext) {
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
    configureOpenLdapProgress(progress) {
      this.configureProviderProgress = progress;
    },
    configureOpenLdapCompleted(taskContext) {
      this.loading.openldap.configureModule = false;
      this.accountProviderId = this.createdOpenLdapId;

      // unregister to task progress
      this.core.$root.$off(
        `${taskContext.action}-progress-${taskContext.extra.eventId}`
      );

      // go to proxy step
      if (!this.isProxyInstalled) {
        this.step = "needToInstallProxy";
      } else if (!this.isProxyConfigured) {
        this.step = "inputProxyConfig";
      } else {
        this.step = "proxyAlreadyConfigured";
      }
    },
    // async getProxyStatus() { ////
    //   this.loading.getProxyStatus = true;

    //   const taskAction = "get-proxy-status";
    //   const eventId = this.getUuid();

    //   // register to task error
    //   this.core.$root.$once(
    //     `${taskAction}-aborted-${eventId}`,
    //     this.getProxyStatusAborted
    //   );

    //   // register to task completion
    //   this.core.$root.$once(
    //     `${taskAction}-completed-${eventId}`,
    //     this.getProxyStatusCompleted
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
    //     this.error.getProxyStatus = this.getErrorMessage(err);
    //     this.loading.getProxyStatus = false;
    //     return;
    //   }
    // },
    // getProxyStatusAborted(taskResult, taskContext) {
    //   console.error(`${taskContext.action} aborted`, taskResult);
    //   this.error.getProxyStatus = this.$t("error.generic_error");
    //   this.loading.getProxyStatus = false;
    // },
    // getProxyStatusCompleted(taskContext, taskResult) {
    //   //// remove mock
    //   taskResult.output.proxy_configured = true; ////
    //   // taskResult.output.proxy_installed = false; ////

    //   this.proxyStatus = taskResult.output;

    //   console.log("proxyStatus", this.proxyStatus); ////
    //   console.log("module_id", this.proxyStatus.module_id); ////
    //   console.log("proxy_installed", this.proxyStatus.proxy_installed); ////

    //   this.loading.getProxyStatus = false;
    // },
    validateSelectAccountProvider() {
      this.error.accountProvider = "";
      let isValidationOk = true;

      if (
        this.accountProviderType == "use_existing_provider" &&
        !this.accountProviderId
      ) {
        this.error.accountProvider = this.$t("common.required");
        isValidationOk = false;
        // this.focusElement("accountProvider"); ////
      }
      return isValidationOk;
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
      this.isProxyInstalled = defaults.proxy_status.proxy_installed;

      if (this.isProxyInstalled) {
        this.proxyModuleId = defaults.proxy_status.module_id;

        // retrieve proxy configuration
        this.getProxyConfig();
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
    async getProxyConfig() {
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
        this.createModuleTaskForApp(this.proxyModuleId, {
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
      this.loading.getProxyConfig = false;
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
      this.step = "inputProxyConfig";
    },
    installProxyProgress(progress) {
      this.installingProxyProgress = progress;
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

      // let updates = []; ////

      // for (const app of apps) {
      //   const hasStableUpdate = app.updates.some((update) => update.update);

      //   if (hasStableUpdate) {
      //     updates.push(app);
      //   }

      //   // sort installed instances
      //   app.installed.sort(this.sortModuleInstances());
      // }
      // this.updates = updates;

      this.apps = apps;
      this.loading.listModules = false;

      console.log("@@ apps", this.apps); ////
    },
  },
};
</script>

<style scoped lang="scss">
@import "../styles/carbon-utils";
</style>
