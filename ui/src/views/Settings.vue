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
      <cv-row v-if="isLoading">
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
                />
                <NsInlineNotification
                  v-if="showChangeProviderWarning"
                  kind="warning"
                  :title="$t('settings.change_domain_provider_warning_title')"
                  :description="
                    $t('settings.change_domain_provider_warning_description')
                  "
                  :showCloseButton="false"
                />
                <!-- authentication method: how users prove identity (orthogonal to
                     the account provider above, which is the source of user records) -->
                <NsComboBox
                  :title="$t('settings.authentication_method')"
                  :options="authMethodList"
                  :auto-highlight="true"
                  :label="core.$t('common.choose')"
                  :disabled="isFormDisabled"
                  :invalid-message="error.authentication_method"
                  v-model="authentication_method"
                  ref="authentication_method"
                  :acceptUserInput="false"
                >
                  <template slot="tooltip">
                    {{ $t("settings.authentication_method_tooltip") }}
                  </template>
                </NsComboBox>
                <template v-if="authentication_method === 'saml2'">
                  <NsInlineNotification
                    kind="info"
                    :title="$t('settings.saml2_info_title')"
                    :description="$t('settings.saml2_info_description')"
                    :showCloseButton="false"
                  />
                  <div
                    v-if="saml2SpMetadataUrl"
                    class="sp-metadata-field mg-bottom-md"
                  >
                    <div class="bx--label">
                      {{ $t("settings.saml2_sp_metadata_url") }}
                    </div>
                    <cv-code-snippet
                      kind="oneline"
                      :copy-feedback="$t('common.copied_to_clipboard')"
                      :feedback-aria-label="$t('common.copy_to_clipboard')"
                      >{{ saml2SpMetadataUrl }}</cv-code-snippet
                    >
                    <div class="bx--form__helper-text">
                      {{ $t("settings.saml2_sp_metadata_url_helper") }}
                    </div>
                  </div>
                  <NsTextInput
                    :label="$t('settings.saml2_idp_metadata_url')"
                    v-model.trim="saml2.idp_metadata_url"
                    placeholder="https://idp.example.com/idp/shibboleth"
                    :disabled="isFormDisabled"
                    :invalid-message="error.saml2_idp_metadata_url"
                    ref="saml2_idp_metadata_url"
                  >
                    <template slot="tooltip">
                      {{ $t("settings.saml2_idp_metadata_url_tooltip") }}
                    </template>
                  </NsTextInput>
                  <NsTextInput
                    :label="$t('settings.saml2_login_button_label')"
                    v-model.trim="saml2.login_button_label"
                    :placeholder="
                      $t('settings.saml2_login_button_label_placeholder')
                    "
                    :disabled="isFormDisabled"
                  />
                  <div class="idp-preview">
                    <div class="bx--label">
                      {{ $t("settings.saml2_login_preview") }}
                    </div>
                    <div class="idp-preview-box">
                      <cv-skeleton-text
                        v-if="loading.getIdpInfo"
                        :paragraph="true"
                        :line-count="2"
                      />
                      <template v-else-if="idpPreview && !error.getIdpInfo">
                        <div class="idp-preview-button">
                          {{
                            saml2.login_button_label ||
                            $t("settings.saml2_default_button_label")
                          }}
                        </div>
                        <div
                          v-if="idpPreview.display_name || idpPreview.logo_url"
                          class="idp-preview-idp"
                        >
                          <img
                            v-if="idpPreview.logo_url"
                            :src="idpPreview.logo_url"
                            alt=""
                          />
                          <span v-if="idpPreview.display_name">{{
                            idpPreview.display_name
                          }}</span>
                        </div>
                      </template>
                      <div v-else class="idp-preview-error">
                        {{ $t("settings.saml2_preview_not_available") }}
                      </div>
                    </div>
                  </div>
                  <NsTextInput
                    :label="$t('settings.saml2_identity_attribute')"
                    v-model.trim="saml2.identity_attribute"
                    placeholder="uid"
                    :disabled="isFormDisabled"
                    :invalid-message="error.saml2_identity_attribute"
                    ref="saml2_identity_attribute"
                  >
                    <template slot="tooltip">
                      {{ $t("settings.saml2_identity_attribute_tooltip") }}
                    </template>
                  </NsTextInput>
                </template>
                <template v-if="authentication_method === 'oidc'">
                  <NsInlineNotification
                    kind="info"
                    :title="$t('settings.oidc_info_title')"
                    :description="$t('settings.oidc_info_description')"
                    :showCloseButton="false"
                  />
                  <NsTextInput
                    :label="$t('settings.oidc_issuer_url')"
                    v-model.trim="oidc.issuer_url"
                    placeholder="https://idp.example.com"
                    :disabled="isFormDisabled"
                    :invalid-message="error.oidc_issuer_url"
                    ref="oidc_issuer_url"
                  >
                    <template slot="tooltip">
                      {{ $t("settings.oidc_issuer_url_tooltip") }}
                    </template>
                  </NsTextInput>
                  <NsTextInput
                    :label="$t('settings.oidc_client_id')"
                    v-model.trim="oidc.client_id"
                    :disabled="isFormDisabled"
                    :invalid-message="error.oidc_client_id"
                    ref="oidc_client_id"
                  />
                  <cv-text-input
                    :label="$t('settings.oidc_client_secret')"
                    type="password"
                    v-model.trim="oidc.client_secret"
                    :placeholder="
                      oidc.client_secret_set
                        ? $t('settings.oidc_client_secret_set')
                        : ''
                    "
                    :helper-text="$t('settings.oidc_client_secret_helper')"
                    :invalid-message="error.oidc_client_secret"
                    :disabled="isFormDisabled"
                    ref="oidc_client_secret"
                  />
                  <NsTextInput
                    :label="$t('settings.oidc_idp_name')"
                    v-model.trim="oidc.idp_name"
                    :placeholder="$t('settings.oidc_idp_name_placeholder')"
                    :disabled="isFormDisabled"
                  />
                  <NsTextInput
                    :label="$t('settings.saml2_login_button_label')"
                    v-model.trim="oidc.login_button_label"
                    :placeholder="
                      $t('settings.saml2_login_button_label_placeholder')
                    "
                    :disabled="isFormDisabled"
                  />
                  <div class="idp-preview">
                    <div class="bx--label">
                      {{ $t("settings.saml2_login_preview") }}
                    </div>
                    <div class="idp-preview-box">
                      <div class="idp-preview-button">
                        {{
                          oidc.login_button_label ||
                          $t("settings.saml2_default_button_label")
                        }}
                      </div>
                      <div v-if="oidc.idp_name" class="idp-preview-idp">
                        <span>{{ oidc.idp_name }}</span>
                      </div>
                    </div>
                  </div>
                </template>
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

export default {
  name: "Settings",
  components: { ResumeConfigNotification },
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
      validationErrorDetails: [],
      nethvoice_host: "",
      nethvoice_admin_password: "",
      nethcti_ui_host: "",
      lets_encrypt: false,
      isLetsEncryptCurrentlyEnabled: false,
      user_domain: "",
      currentUserDomain: "",
      authentication_method: "password",
      saml2: {
        idp_metadata_url: "",
        identity_attribute: "uid",
        login_button_label: "",
      },
      oidc: {
        issuer_url: "",
        client_id: "",
        client_secret: "",
        client_secret_set: false,
        idp_name: "",
        login_button_label: "",
      },
      authMethodList: [],
      reports_international_prefix: "+39",
      timezone: "",
      isProxyInstalled: false,
      subscription_systemid: "",
      passwordValidation: null,
      focusPasswordField: { element: "" },
      clearConfirmPasswordCommand: 0,
      idpPreview: undefined,
      idpPreviewTimer: null,
      loading: {
        getConfiguration: false,
        getIdpInfo: false,
        configureModule: false,
        userDomains: false,
        getDefaults: false,
        setAdminPassword: false,
        getStatus: false,
      },
      domainList: [],
      timezoneList: [],
      error: {
        getConfiguration: "",
        getIdpInfo: "",
        configureModule: "",
        userDomains: "",
        getDefaults: "",
        setAdminPassword: "",
        getStatus: "",
        nethvoice_host: "",
        nethvoice_admin_password: "",
        nethcti_ui_host: "",
        lets_encrypt: "",
        user_domain: "",
        authentication_method: "",
        saml2_idp_metadata_url: "",
        saml2_identity_attribute: "",
        oidc_issuer_url: "",
        oidc_client_id: "",
        oidc_client_secret: "",
        reports_international_prefix: "",
        timezone: "",
      },
    };
  },
  watch: {
    "saml2.idp_metadata_url"() {
      clearTimeout(this.idpPreviewTimer);
      this.idpPreview = undefined;
      this.error.getIdpInfo = "";
      if (this.saml2.idp_metadata_url.startsWith("https://")) {
        this.idpPreviewTimer = setTimeout(this.getIdpInfo, 800);
      }
    },
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
    saml2SpMetadataUrl() {
      return this.nethcti_ui_host
        ? "https://" + this.nethcti_ui_host + "/Shibboleth.sso/Metadata"
        : "";
    },
    isFormDisabled() {
      return (
        this.loading.getConfiguration ||
        this.loading.configureModule ||
        this.loading.userDomains ||
        this.loading.getDefaults ||
        this.loading.setAdminPassword
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
    isErrorState() {
      return !!(
        this.error.getConfiguration ||
        this.error.configureModule ||
        this.error.userDomains ||
        this.error.getDefaults ||
        this.error.setAdminPassword
      );
    },
    showChangeProviderWarning() {
      return (
        this.currentUserDomain && this.user_domain !== this.currentUserDomain
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
    this.loadConfig();

    if (!this.instanceStatus) {
      // retrieve installation node, needed for traefik certificate warning
      this.getStatus();
    }

    // register to events
    this.$root.$on("reloadConfig", this.loadConfig);
  },
  beforeDestroy() {
    // remove only the specific event listener registered by this component
    this.$root.$off("reloadConfig", this.loadConfig);
  },
  methods: {
    ...mapActions(["setInstanceStatusInStore"]),
    loadConfig() {
      this.getUserDomains();
      this.getDefaults();
    },
    async getIdpInfo() {
      this.loading.getIdpInfo = true;
      this.error.getIdpInfo = "";
      const taskAction = "get-idp-info";
      const eventId = this.getUuid();

      this.core.$root.$once(`${taskAction}-aborted-${eventId}`, () => {
        this.loading.getIdpInfo = false;
        this.error.getIdpInfo = "unreachable";
      });

      this.core.$root.$once(
        `${taskAction}-completed-${eventId}`,
        (taskContext, taskResult) => {
          this.loading.getIdpInfo = false;
          this.idpPreview = taskResult.output;
        }
      );

      const res = await to(
        this.createModuleTaskForApp(this.instanceName, {
          action: taskAction,
          data: {
            url: this.saml2.idp_metadata_url,
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
        this.loading.getIdpInfo = false;
        this.error.getIdpInfo = "unreachable";
      }
    },
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

      this.subscription_systemid = config.subscription_systemid || "";

      this.nethvoice_host = config.nethvoice_host;
      this.nethcti_ui_host = config.nethcti_ui_host;
      this.nethvoice_admin_password = "";
      this.lets_encrypt = config.lets_encrypt;
      this.isLetsEncryptCurrentlyEnabled = config.lets_encrypt;

      this.user_domain = config.user_domain;
      this.currentUserDomain = config.user_domain;

      this.authentication_method = config.authentication_method || "password";
      if (config.saml2) {
        this.saml2 = {
          idp_metadata_url: config.saml2.idp_metadata_url || "",
          identity_attribute: config.saml2.identity_attribute || "uid",
          login_button_label: config.saml2.login_button_label || "",
        };
      }
      if (config.oidc) {
        this.oidc = {
          issuer_url: config.oidc.issuer_url || "",
          client_id: config.oidc.client_id || "",
          client_secret: "",
          client_secret_set: !!config.oidc.client_secret_set,
          idp_name: config.oidc.idp_name || "",
          login_button_label: config.oidc.login_button_label || "",
        };
      }

      if (config.reports_international_prefix !== "") {
        this.reports_international_prefix = config.reports_international_prefix;
      }
      this.timezone = config.timezone;

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

      // SAML2 SSO requires the IdP metadata and the identity attribute
      if (this.authentication_method === "saml2") {
        if (!this.saml2.idp_metadata_url) {
          this.error.saml2_idp_metadata_url = this.$t("error.required");
          isValidationOk = false;
        }
        if (!this.saml2.identity_attribute) {
          this.error.saml2_identity_attribute = this.$t("error.required");
          isValidationOk = false;
        }
      }

      if (this.authentication_method === "oidc") {
        if (!this.oidc.issuer_url) {
          this.error.oidc_issuer_url = this.$t("error.required");
          isValidationOk = false;
        }
        if (!this.oidc.client_id) {
          this.error.oidc_client_id = this.$t("error.required");
          isValidationOk = false;
        }
        // the secret is required only when none is stored yet
        if (!this.oidc.client_secret && !this.oidc.client_secret_set) {
          this.error.oidc_client_secret = this.$t("error.required");
          isValidationOk = false;
        }
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
      this.configureModule();
    },
    async configureModule() {
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
            authentication_method: this.authentication_method,
            saml2: this.saml2,
            oidc: {
              issuer_url: this.oidc.issuer_url,
              client_id: this.oidc.client_id,
              idp_name: this.oidc.idp_name,
              login_button_label: this.oidc.login_button_label,
              // sent only when the admin typed a new one, so a re-save does
              // not wipe the stored secret
              ...(this.oidc.client_secret
                ? { client_secret: this.oidc.client_secret }
                : {}),
            },
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
      this.error.userDomains = "";

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
      }
      this.loading.userDomains = false;
      this.getConfiguration();
    },
    async getDefaults() {
      this.loading.getDefaults = true;
      this.error.getDefaults = "";
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

      // build the authentication method options from the module-provided registry
      // (extensible: a new method appears here without changing this view)
      const methods = taskResult.output.available_authentication_methods || [
        { id: "password" },
        { id: "saml2" },
      ];
      this.authMethodList = methods.map((m) => ({
        name: m.id,
        value: m.id,
        label: this.$t("settings.authentication_method_" + m.id),
      }));
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
      const isValidationOk = this.validateChangeAdminPassword();

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

.idp-preview {
  max-width: 38rem;
  margin-top: 0.5rem;
  margin-bottom: 2rem;
}
.idp-preview-box {
  border: 1px solid $ui-03;
  border-radius: 6px;
  padding: 1rem;
  min-height: 7.5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
}
.idp-preview-button {
  background: $interactive-01;
  color: #fff;
  border-radius: 4px;
  padding: 0.5rem 0;
  width: 100%;
  max-width: 20rem;
  text-align: center;
  font-size: 0.875rem;
  font-weight: 500;
}
.idp-preview-idp {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: $text-02;
  font-size: 0.875rem;
}
.idp-preview-idp img {
  height: 1.25rem;
  width: auto;
}
.idp-preview-error {
  color: $text-02;
  font-size: 0.875rem;
}

// align the SP metadata snippet with the width of the other form inputs
.sp-metadata-field,
.sp-metadata-field ::v-deep .bx--snippet--single {
  max-width: 38rem;
}
</style>
