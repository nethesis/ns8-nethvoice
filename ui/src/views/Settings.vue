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
            <NsInlineNotification
              v-if="warningVisible"
              kind="warning"
              :title="$t('warning.warning_title_message')"
              :description="$t('settings.error_message_hostname')"
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
              :userInputLabel="core.$t('settings.choose_timezone')"
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
            <!-- Hotel Module Settings -->
            <NsInlineNotification
              v-if="!isSubscriptionValid"
              kind="info"
              :title="$t('settings.nethvoice_hotel_subscription_required')"
              :showCloseButton="false"
            />
            <cv-toggle
              :label="$t('settings.nethvoice_hotel')"
              value="nethvoice_hotel"
              :disabled="isHotelDisabled"
              v-model="form.nethvoice_hotel"
            >
              <template slot="text-left">
                {{ $t("common.disabled") }}
              </template>
              <template slot="text-right">
                {{ $t("common.enabled") }}
              </template>
            </cv-toggle>
            <cv-text-input
              :label="$t('settings.nethvoice_hotel_fias_address')"
              v-model="form.nethvoice_hotel_fias_address"
              placeholder="192.168.1.100"
              :disabled="isHotelDisabled || !form.nethvoice_hotel"
              :invalid-message="error.nethvoice_hotel_fias_address"
              ref="nethvoice_hotel_fias_address"
            />
            <cv-text-input
              :label="$t('settings.nethvoice_hotel_fias_port')"
              v-model="form.nethvoice_hotel_fias_port"
              placeholder="1234"
              type="number"
              :disabled="isHotelDisabled || !form.nethvoice_hotel"
              :invalid-message="error.nethvoice_hotel_fias_port"
              ref="nethvoice_hotel_fias_port"
            />
            <!-- End Hotel Module Settings -->
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
            <label
              v-if="form.rebranding_active"
              class="rebranding_section_title_style"
              >Rebranding section</label
            >
            <cv-accordion
              @change="actionChange"
              ref="acc"
              :align="align"
              :size="size"
              :disabled="loadingState || !proxy_installed"
              v-if="form.rebranding_active"
            >
              <cv-accordion-item :open="open[0]" class="test-card">
                <template slot="title">NethVoice CTI</template>
                <template slot="content">
                  <!-- Inputs -->
                  <NsTextInput
                    :label="$t('settings.rebranding_navbar_logo_url')"
                    v-model="form.rebranding_navbar_logo_url"
                    placeholder="https://.."
                    :disabled="loadingState || !proxy_installed"
                    :invalid-message="error.rebranding_navbar_logo_url"
                  >
                    <template slot="tooltip">
                      {{ $t("settings.rebranding_navbar_logo_url_tooltip") }}
                    </template>
                  </NsTextInput>

                  <NsTextInput
                    :label="$t('settings.rebranding_navbar_logo_dark_url')"
                    v-model="form.rebranding_navbar_logo_dark_url"
                    placeholder="https://.."
                    :disabled="loadingState || !proxy_installed"
                    :invalid-message="error.rebranding_navbar_logo_dark_url"
                  >
                    <template slot="tooltip">
                      {{
                        $t("settings.rebranding_navbar_logo_dark_url_tooltip")
                      }}
                    </template>
                  </NsTextInput>

                  <NsTextInput
                    :label="$t('settings.rebranding_login_background_url')"
                    v-model="form.rebranding_login_background_url"
                    placeholder="https://.."
                    :disabled="loadingState || !proxy_installed"
                    :invalid-message="error.rebranding_login_background_url"
                  >
                    <template slot="tooltip">
                      {{
                        $t("settings.rebranding_login_background_url_tooltip")
                      }}
                    </template>
                  </NsTextInput>

                  <NsTextInput
                    :label="$t('settings.rebranding_favicon_url')"
                    v-model="form.rebranding_favicon_url"
                    placeholder="https://.."
                    :disabled="loadingState || !proxy_installed"
                    :invalid-message="error.rebranding_favicon_url"
                  >
                    <template slot="tooltip">
                      {{ $t("settings.rebranding_favicon_url_tooltip") }}
                    </template>
                  </NsTextInput>

                  <NsTextInput
                    :label="$t('settings.rebranding_login_logo_url')"
                    v-model="form.rebranding_login_logo_url"
                    placeholder="https://.."
                    :disabled="loadingState || !proxy_installed"
                    :invalid-message="error.rebranding_login_logo_url"
                  >
                    <template slot="tooltip">
                      {{ $t("settings.rebranding_login_logo_url_tooltip") }}
                    </template>
                  </NsTextInput>

                  <NsTextInput
                    :label="$t('settings.rebranding_login_logo_dark_url')"
                    v-model="form.rebranding_login_logo_dark_url"
                    placeholder="https://.."
                    :disabled="loadingState || !proxy_installed"
                    :invalid-message="error.rebranding_login_logo_dark_url"
                  >
                    <template slot="tooltip">
                      {{
                        $t("settings.rebranding_login_logo_dark_url_tooltip")
                      }}
                    </template>
                  </NsTextInput>
                  <NsCheckbox
                    :label="$t('settings.rebranding_login_people')"
                    v-model="form.rebranding_login_people"
                    :disabled="loadingState || !proxy_installed"
                    :invalid-message="error.rebranding_login_people"
                  >
                    <template slot="tooltip">
                      {{ $t("settings.rebranding_login_people_tooltip") }}
                    </template>
                  </NsCheckbox>

                  <label
                    v-if="form.rebranding_active"
                    class="rebranding_section_title_style"
                    >Preview</label
                  >
                  <!-- Login page preview -->
                  <div class="login-preview">
                    <!-- Dark/Light theme buttons inside preview -->
                    <div class="theme-buttons">
                      <NsButton
                        kind="secondary"
                        @click="setLightTheme"
                        :disabled="!isDarkMode"
                        class="theme-button dark-theme-btn"
                      >
                        <Sun20 />
                      </NsButton>
                      <NsButton
                        kind="secondary"
                        @click="setDarkTheme"
                        :disabled="isDarkMode"
                        class="theme-button dark-theme-btn"
                      >
                        <Moon20 />
                      </NsButton>
                    </div>

                    <NsButton
                      kind="secondary"
                      @click.prevent="setAllClear"
                      class="clear-all-btn"
                    >
                      <TrashCan20 class="clear_all_icon" /> Clear rebranding
                    </NsButton>
                    <div
                      class="login-background"
                      :style="{
                        backgroundImage: `url(${validLoginBackgroundUrl})`,
                      }"
                    >
                      <div class="login-container">
                        <div :class="isDarkMode ? 'dark-theme' : 'light-theme'">
                          <div class="login-card">
                            <img
                              :src="validLogoUrl"
                              :alt="isDarkMode ? 'Logo Dark' : 'Logo Light'"
                              class="login-logo"
                            />
                            <div class="login-form">
                              <label for="username" class="login-label"
                                >Username</label
                              >
                              <input
                                type="text"
                                value="username"
                                disabled
                                class="login-input"
                              />
                              <label for="password" class="login-label"
                                >Password</label
                              >
                              <input
                                type="password"
                                value="*********"
                                disabled
                                class="login-input"
                              />
                              <button disabled class="login-button">
                                <span>Sign in</span>
                              </button>
                            </div>
                          </div>
                        </div>
                        <div
                          class="login-svg"
                          v-if="!form.rebranding_login_people"
                        >
                          <img
                            src="../assets/action_voice-cti.svg"
                            alt="SVG Image"
                            class="svg-image"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </template>
              </cv-accordion-item>
            </cv-accordion>

            <NsButton
              kind="primary"
              :icon="Save20"
              :loading="loading.configureModule"
              :disabled="loadingState || !proxy_installed"
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
import { Sun20, Moon20, TrashCan20 } from "@carbon/icons-vue";

import {
  QueryParamService,
  UtilService,
  TaskService,
  IconService,
  PageTitleService,
} from "@nethserver/ns8-ui-lib";
import { GeneratePassword } from "generate-password-lite";

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
      warningVisible: false,
      open: [false, false],
      align: "end",
      size: "medium",
      form: {
        nethvoice_host: "",
        nethvoice_admin_password: "",
        nethcti_ui_host: "",
        lets_encrypt: false,
        user_domain: "",
        reports_international_prefix: "+39",
        timezone: "",
        rebranding_active: "",
        rebranding_navbar_logo_url: "",
        rebranding_navbar_logo_dark_url: "",
        rebranding_login_background_url: "",
        rebranding_favicon_url: "",
        rebranding_login_logo_url: "",
        rebranding_login_logo_dark_url: "",
        rebranding_login_people: false,
        nethvoice_adm: {},
        nethcti_privacy_numbers: "",
        nethvoice_hotel: false,
        nethvoice_hotel_fias_address: "",
        nethvoice_hotel_fias_port: "",
      },
      isDarkMode: false,
      proxy_installed: false,
      config: {},
      subscription_systemid: "",
      loading: {
        getConfiguration: false,
        getRebranding: false,
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
        rebranding_navbar_logo_url: "",
        rebranding_navbar_logo_dark_url: "",
        rebranding_login_background_url: "",
        rebranding_favicon_url: "",
        rebranding_login_logo_url: "",
        rebranding_login_logo_dark_url: "",
        nethcti_privacy_numbers: "",
        nethvoice_hotel: "",
        nethvoice_hotel_fias_address: "",
        nethvoice_hotel_fias_port: "",
      },
      warning: {
        user_domain: "",
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
    validLoginBackgroundUrl() {
      return (
        this.form.rebranding_login_background_url ||
        require("../assets/background_voice.svg")
      );
    },
    validLogoUrl() {
      return this.isDarkMode
        ? this.form.rebranding_login_logo_dark_url ||
            require("../assets/login_logo_dark.svg")
        : this.form.rebranding_login_logo_url ||
            require("../assets/login_logo.svg");
    },
    isSubscriptionValid() {
      return this.subscription_systemid && this.subscription_systemid.trim() !== "";
    },
    isHotelDisabled() {
      return this.loadingState || !this.proxy_installed || !this.isSubscriptionValid;
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
    this.getRebranding();
  },
  components: {
    Sun20,
    Moon20,
    TrashCan20,
  },
  methods: {
    generatePassword() {
      const forbiddenSpecialChars = "!#$&()*,-/;<=>[\\]`{|}~";
      const password = GeneratePassword({
        length: 16,
        symbols: true,
        numbers: true,
        uppercase: true,
        minLengthUppercase: 1,
        minLengthNumbers: 1,
        minLengthSymbols: 1,
        exclude: forbiddenSpecialChars,
      });
      return password;
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
      this.form.nethcti_privacy_numbers = config.nethcti_privacy_numbers;

      // Hotel module settings - disable if subscription not valid
      if (config.nethvoice_hotel == 'True' && this.isSubscriptionValid) {
        this.form.nethvoice_hotel = true;
      } else {
        this.form.nethvoice_hotel = false;
      }
      this.form.nethvoice_hotel_fias_address = config.nethvoice_hotel_fias_address || "";
      this.form.nethvoice_hotel_fias_port = config.nethvoice_hotel_fias_port || "";

      this.focusElement("nethvoice_host");
    },
    async getRebranding() {
      this.loading.getRebranding = true;

      const taskAction = "get-rebranding";
      const eventId = this.getUuid();

      // register to task error
      this.core.$root.$once(
        `${taskAction}-aborted-${eventId}`,
        this.getRebrandingAborted
      );

      // register to task completion
      this.core.$root.$once(
        `${taskAction}-completed-${eventId}`,
        this.getRebrandingCompleted
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
        this.loading.getRebranding = false;
        return;
      }
    },
    getRebrandingAborted(taskAction, taskContextGetRebranding) {
      console.error(`${taskContextGetRebranding.action} aborted`, taskAction);
      this.error.getConfiguration = this.$t("error.generic_error");
      this.loading.getRebranding = false;
      this.getConfiguration();
    },
    getRebrandingCompleted(taskContextGetRebranding, taskAction) {
      const config = taskAction.output;

      this.form.rebranding_active = config.rebranding_active;
      this.form.rebranding_navbar_logo_url = config.rebranding_navbar_logo_url;
      this.form.rebranding_navbar_logo_dark_url =
        config.rebranding_navbar_logo_dark_url;
      this.form.rebranding_login_background_url =
        config.rebranding_login_background_url;
      this.form.rebranding_favicon_url = config.rebranding_favicon_url;
      this.form.rebranding_login_logo_url = config.rebranding_login_logo_url;
      this.form.rebranding_login_logo_dark_url =
        config.rebranding_login_logo_dark_url;
      this.form.rebranding_login_people = config.rebranding_login_people;
      if (this.form.rebranding_login_people === "hide") {
        this.form.rebranding_login_people = true;
      } else {
        this.form.rebranding_login_people = false;
      }
      this.loading.getRebranding = false;
      this.getConfiguration();
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
          this.form.nethvoice_adm.password = this.generatePassword();

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
            nethcti_privacy_numbers: this.form.nethcti_privacy_numbers,
            nethvoice_hotel: this.form.nethvoice_hotel ? "True" : "False",
            nethvoice_hotel_fias_address: this.form.nethvoice_hotel ? this.form.nethvoice_hotel_fias_address : "",
            nethvoice_hotel_fias_port: this.form.nethvoice_hotel ? this.form.nethvoice_hotel_fias_port : ""
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

      if (this.form.rebranding_active) {
        // execute set rebranding
        const taskActionRebranding = "set-rebranding";
        const eventIdRebranding = this.getUuid();

        // register to task error
        this.core.$root.$once(
          `${taskActionRebranding}-aborted-${eventIdRebranding}`,
          this.configureModuleAborted
        );

        // register to task validation
        this.core.$root.$once(
          `${taskActionRebranding}-validation-failed-${eventIdRebranding}`,
          this.configureModuleValidationFailed
        );

        // register to task completion
        this.core.$root.$once(
          `${taskActionRebranding}-completed-${eventIdRebranding}`,
          this.configureModuleCompleted
        );

        // Convert true/false to 'show'/'hide' for rebranding_login_people
        let rebrandingLoginPeople = this.form.rebranding_login_people
          ? "hide"
          : "show";

        const setRebranding = await to(
          this.createModuleTaskForApp(this.instanceName, {
            action: taskActionRebranding,
            data: {
              rebranding_login_people: rebrandingLoginPeople,
              rebranding_navbar_logo_url: this.form.rebranding_navbar_logo_url,
              rebranding_navbar_logo_dark_url:
                this.form.rebranding_navbar_logo_dark_url,
              rebranding_login_logo_url: this.form.rebranding_login_logo_url,
              rebranding_login_logo_dark_url:
                this.form.rebranding_login_logo_dark_url,
              rebranding_favicon_url: this.form.rebranding_favicon_url,
              rebranding_login_background_url:
                this.form.rebranding_login_background_url,
            },
            extra: {
              title: this.$t("settings.set_rebranding"),
              description: this.$t("common.processing"),
              eventId,
            },
          })
        );
        const errRebranding = setRebranding[0];

        if (errRebranding) {
          console.error(
            `error creating task ${taskActionRebranding}`,
            errRebranding
          );
          this.error.configureModule = this.getErrorMessage(errRebranding);
          this.loading.configureModule = false;
          return;
        }
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
      this.getRebranding();
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
      this.getProxyStatus();
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
        this.error.getConfiguration = this.getErrorMessage(err);
        this.loading.getProxyStatus = false;
        return;
      }
    },
    getProxyStatusAborted(taskResult, taskContext) {
      console.error(`${taskContext.action} aborted`, taskResult);
      this.error.getConfiguration = this.$t("error.generic_error");
      this.loading.getProxyStatus = false;
      this.getConfiguration();
    },
    getProxyStatusCompleted(taskContext, taskResult) {
      const config = taskResult.output;
      this.proxy_installed = config.proxy_installed;
      this.loading.getProxyStatus = false;
      this.getConfiguration();
    },
    async getUsers(domain) {
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
    toggleTheme() {},
    setLightTheme() {
      this.isDarkMode = false;
    },
    setDarkTheme() {
      this.isDarkMode = true;
    },
    setAllClear() {
      this.form.rebranding_navbar_logo_url = "";
      this.form.rebranding_navbar_logo_dark_url = "";
      this.form.rebranding_login_background_url = "";
      this.form.rebranding_favicon_url = "";
      this.form.rebranding_login_logo_url = "";
      this.form.rebranding_login_logo_dark_url = "";
      this.form.rebranding_login_people = false;
    },
  },
};
</script>

<style scoped lang="scss">
@import "../styles/carbon-utils";

.test-card {
  padding-top: 6px;
  padding-bottom: 2rem;
  width: 620px;
}

.login-preview {
  position: relative;
  width: 100%;
  height: 400px;
  border: 1px solid #ccc;
  margin-top: 8px;
}

.login-background {
  background-size: cover;
  background-position: center;
  width: 100%;
  height: 100%;
}

.login-container {
  display: flex;
  justify-content: flex-start;
  align-items: center;
  height: 100%;
  margin-left: 2rem;
}

.login-card {
  background-color: #111827;
  padding: 20px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  color: white;
  margin-right: 70px;
  border-radius: 4px;
}

.login-svg {
  width: 40%;
}

.svg-image {
  width: 100%;
  height: auto;
  margin-left: -24px;
}

.login-logo {
  height: 20px;
}

.login-form {
  display: flex;
  flex-direction: column;
  margin-top: 24px;
  width: 100%;
  align-items: center;
}

.login-input {
  width: 80%;
  padding: 10px;
  height: 10px;
  margin-bottom: 15px;
  background-color: #030712;
  color: #fff;
  border: none;
  text-align: center;
  border-radius: 4px;
  border-color: #e5e7eb;
  border-width: 2px;
}

.login-button {
  width: 80%;
  padding: 10px;
  background-color: #15803d;
  color: white;
  border: none;
  cursor: not-allowed;
  border-radius: 4px;
  height: 20px;
  display: flex;
  justify-content: center;
  align-items: center;
  text-align: center;
}

.login-button span {
  margin: 0;
}

.login-label {
  width: 80%;
  text-align: left;
  margin-bottom: 4px;
}

.login-button-span {
  position: absolute;
  left: 96px;
  top: 269px;
}

.bx--accordion__item {
  border-top: none !important;
}

.bx--accordion__item:last-child {
  border-bottom: none !important;
}

/* Light theme */
.light-theme .login-card {
  background-color: #f9fafb;
  color: #111827;
}

.light-theme .login-input {
  background-color: #ffffff;
  color: #111827;
  border-color: #e5e7eb;
}

.light-theme .login-button {
  background-color: #34d399;
  color: white;
}

/* Dark theme */
.dark-theme .login-card {
  background-color: #111827;
  color: white;
}

.dark-theme .login-input {
  background-color: #030712;
  color: white;
  border-color: #374151;
}

.dark-theme .login-button {
  background-color: #15803d;
  color: white;
}

.rebranding_section_title_style {
  color: #525252;
  font-size: 12px !important;
}

.theme-buttons {
  position: absolute;
  top: 10px;
  right: 10px;
}

.theme-button {
  margin-left: 8px;
  padding-right: 14px;
}

.clear-all-btn {
  position: absolute;
  bottom: 10px;
  right: 10px;
  padding-right: 20px;
}

.clear_all_icon {
  margin-right: 8px;
}
</style>
