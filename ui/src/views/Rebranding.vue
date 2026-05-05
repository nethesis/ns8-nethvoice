<!--
  Copyright (C) 2024 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->
<template>
  <cv-grid fullWidth>
    <cv-row>
      <cv-column class="page-title">
        <h2>
          {{ $t("rebranding.title") }}
          <cv-interactive-tooltip
            alignment="center"
            direction="right"
            class="info"
          >
            <template slot="trigger">
              <Information16 />
            </template>
            <template slot="content">
              {{ $t("rebranding.rebranding_tooltip") }}
            </template>
          </cv-interactive-tooltip>
        </h2>
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
      <cv-row v-if="error.getRebranding">
        <cv-column>
          <NsInlineNotification
            kind="error"
            :title="$t('action.get-rebranding')"
            :description="error.getRebranding"
            :showCloseButton="false"
          />
        </cv-column>
      </cv-row>
      <cv-row v-if="!rebranding_active && !loading.getRebranding">
        <cv-column>
          <NsInlineNotification
            kind="info"
            :title="$t('rebranding.rebranding_not_activated_yet')"
            :description="
              $t('rebranding.rebranding_not_activated_yet_description')
            "
            :actionLabel="$t('rebranding.contact_sales')"
            @action="openMailtoLink"
          />
        </cv-column>
      </cv-row>
      <cv-row v-if="loading.getRebranding">
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
      <cv-row v-if="rebranding_active && !loading.getRebranding">
        <cv-column>
          <cv-tile light>
            <cv-form @submit.prevent="setRebranding">
              <!-- product name -->
              <h3 class="section-title">{{ $t("rebranding.cti_section") }}</h3>
              <NsTextInput
                :label="
                  $t('rebranding.rebranding_brand_name') +
                  ' (' +
                  $t('common.optional') +
                  ')'
                "
                v-model="rebranding_brand_name"
                placeholder="NethVoice"
                :disabled="loading.setRebranding"
                :invalid-message="error.rebranding_brand_name"
                :helper-text="$t('rebranding.name_to_replace_nethvoice')"
              />
              <!-- light theme logo -->
              <NsTextInput
                :label="
                  $t('rebranding.rebranding_login_logo_url') +
                  ' (' +
                  $t('common.optional') +
                  ')'
                "
                v-model="rebranding_login_logo_url"
                :placeholder="
                  $t('common.eg_value', {
                    value: 'https://mydomain.com/path/to/image.svg',
                  })
                "
                :disabled="loading.setRebranding"
                :invalid-message="error.rebranding_login_logo_url"
                :helper-text="$t('rebranding.public_url_image_helper')"
              />
              <!-- dark theme logo -->
              <NsTextInput
                :label="
                  $t('rebranding.rebranding_login_logo_dark_url') +
                  ' (' +
                  $t('common.optional') +
                  ')'
                "
                v-model="rebranding_login_logo_dark_url"
                :placeholder="
                  $t('common.eg_value', {
                    value: 'https://mydomain.com/path/to/image.svg',
                  })
                "
                :disabled="loading.setRebranding"
                :invalid-message="error.rebranding_login_logo_dark_url"
                :helper-text="$t('rebranding.public_url_image_helper')"
              />
              <!-- light theme square logo -->
              <NsTextInput
                :label="
                  $t('rebranding.rebranding_navbar_logo_url') +
                  ' (' +
                  $t('common.optional') +
                  ')'
                "
                v-model="rebranding_navbar_logo_url"
                :placeholder="
                  $t('common.eg_value', {
                    value: 'https://mydomain.com/path/to/image.svg',
                  })
                "
                :disabled="loading.setRebranding"
                :invalid-message="error.rebranding_navbar_logo_url"
                :helper-text="$t('rebranding.public_url_image_helper')"
              />
              <!-- dark theme square logo -->
              <NsTextInput
                :label="
                  $t('rebranding.rebranding_navbar_logo_dark_url') +
                  ' (' +
                  $t('common.optional') +
                  ')'
                "
                v-model="rebranding_navbar_logo_dark_url"
                :placeholder="
                  $t('common.eg_value', {
                    value: 'https://mydomain.com/path/to/image.svg',
                  })
                "
                :disabled="loading.setRebranding"
                :invalid-message="error.rebranding_navbar_logo_dark_url"
                :helper-text="$t('rebranding.public_url_image_helper')"
              />
              <!-- favicon -->
              <NsTextInput
                :label="
                  $t('rebranding.rebranding_favicon_url') +
                  ' (' +
                  $t('common.optional') +
                  ')'
                "
                v-model="rebranding_favicon_url"
                :placeholder="
                  $t('common.eg_value', {
                    value: 'https://mydomain.com/favicon.ico',
                  })
                "
                :disabled="loading.setRebranding"
                :invalid-message="error.rebranding_favicon_url"
                :helper-text="$t('rebranding.public_url_image_helper')"
              >
                <template slot="tooltip">
                  {{ $t("rebranding.rebranding_favicon_url_tooltip") }}
                </template></NsTextInput
              >
              <!-- login background image -->
              <NsTextInput
                :label="
                  $t('rebranding.rebranding_login_background_url') +
                  ' (' +
                  $t('common.optional') +
                  ')'
                "
                v-model="rebranding_login_background_url"
                :placeholder="
                  $t('common.eg_value', {
                    value: 'https://mydomain.com/path/to/image.svg',
                  })
                "
                :disabled="loading.setRebranding"
                :invalid-message="error.rebranding_login_background_url"
                :helper-text="$t('rebranding.public_url_image_helper')"
              />
              <!-- login illustration -->
              <NsToggle
                :label="$t('rebranding.login_illustration')"
                value="loginIllustration"
                :form-item="true"
                v-model="rebranding_login_people"
                :disabled="loading.setRebranding"
              >
                <template slot="tooltip">
                  {{ $t("rebranding.login_illustration_tooltip") }}
                </template>
                <template slot="text-left">{{
                  $t("common.disabled")
                }}</template>
                <template slot="text-right">{{
                  $t("common.enabled")
                }}</template>
              </NsToggle>
              <!-- login page preview -->
              <div class="mb-6">
                <label class="bx--label mb-0">{{
                  $t("rebranding.login_page_preview")
                }}</label>
                <div class="login-preview">
                  <!-- dark/light theme buttons inside preview -->
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
                  <div
                    class="login-background"
                    :style="{
                      backgroundImage: `url(${loginBackgroundUrl})`,
                    }"
                  >
                    <div class="login-container">
                      <div :class="isDarkMode ? 'dark-theme' : 'light-theme'">
                        <div class="login-card">
                          <img
                            :src="logoUrl"
                            :alt="isDarkMode ? 'Logo Dark' : 'Logo Light'"
                            class="login-logo"
                          />
                          <div class="login-form">
                            <label for="username" class="login-label">
                              {{ $t("rebranding.username") }}
                            </label>
                            <input
                              type="text"
                              value="username"
                              disabled
                              class="login-input"
                            />
                            <label for="password" class="login-label">
                              {{ $t("rebranding.password") }}
                            </label>
                            <input
                              type="password"
                              value="*********"
                              disabled
                              class="login-input"
                            />
                            <button disabled class="login-button">
                              <span>{{ $t("rebranding.sign_in") }}</span>
                            </button>
                          </div>
                        </div>
                      </div>
                      <div class="login-svg" v-if="rebranding_login_people">
                        <img
                          src="../assets/action_voice-cti.svg"
                          alt="Login illustration"
                          class="svg-image"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <hr class="section-separator" />
              <h3 class="section-title">{{ $t("rebranding.reports_section") }}</h3>
              <NsTextInput
                :label="
                  $t('rebranding.rebranding_brand_name') +
                  ' (' +
                  $t('common.optional') +
                  ')'
                "
                v-model="rebranding_reports_brand_name"
                placeholder="NethVoice"
                :disabled="loading.setRebranding"
                :invalid-message="error.rebranding_reports_brand_name"
                :helper-text="$t('rebranding.name_to_replace_nethvoice')"
              />
              <NsTextInput
                :label="
                  $t('rebranding.rebranding_login_logo_url') +
                  ' (' +
                  $t('common.optional') +
                  ')'
                "
                v-model="rebranding_reports_login_logo_url"
                :placeholder="
                  $t('common.eg_value', {
                    value: 'https://mydomain.com/path/to/image.svg',
                  })
                "
                :disabled="loading.setRebranding"
                :invalid-message="error.rebranding_reports_login_logo_url"
                :helper-text="$t('rebranding.public_url_image_helper')"
              />
              <NsTextInput
                :label="
                  $t('rebranding.rebranding_favicon_url') +
                  ' (' +
                  $t('common.optional') +
                  ')'
                "
                v-model="rebranding_reports_favicon_url"
                :placeholder="
                  $t('common.eg_value', {
                    value: 'https://mydomain.com/favicon.ico',
                  })
                "
                :disabled="loading.setRebranding"
                :invalid-message="error.rebranding_reports_favicon_url"
                :helper-text="$t('rebranding.public_url_image_helper')"
              >
                <template slot="tooltip">
                  {{ $t("rebranding.rebranding_favicon_url_tooltip") }}
                </template></NsTextInput
              >
              <NsTextInput
                :label="
                  $t('rebranding.rebranding_login_background_url') +
                  ' (' +
                  $t('common.optional') +
                  ')'
                "
                v-model="rebranding_reports_login_background_url"
                :placeholder="
                  $t('common.eg_value', {
                    value: 'https://mydomain.com/path/to/image.svg',
                  })
                "
                :disabled="loading.setRebranding"
                :invalid-message="error.rebranding_reports_login_background_url"
                :helper-text="$t('rebranding.public_url_image_helper')"
              />
              <NsToggle
                :label="$t('rebranding.login_illustration')"
                value="reportsLoginIllustration"
                :form-item="true"
                v-model="rebranding_reports_login_people"
                :disabled="loading.setRebranding"
              >
                <template slot="tooltip">
                  {{ $t("rebranding.login_illustration_tooltip") }}
                </template>
                <template slot="text-left">{{
                  $t("common.disabled")
                }}</template>
                <template slot="text-right">{{
                  $t("common.enabled")
                }}</template>
              </NsToggle>
              <div class="mb-6">
                <label class="bx--label mb-0">{{
                  $t("rebranding.login_page_preview")
                }}</label>
                <div class="reports-login-preview">
                  <div class="reports-preview-browser-bar">
                    <div class="reports-preview-dots">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                    <div class="reports-preview-tab">
                      <img
                        v-if="reportsFaviconUrl"
                        :src="reportsFaviconUrl"
                        alt="Reports favicon"
                        class="reports-preview-favicon"
                      />
                      <div
                        v-else
                        class="reports-preview-favicon reports-preview-favicon-fallback"
                      >
                        {{ reportsBrandInitial }}
                      </div>
                      <span class="reports-preview-tab-label">
                        {{ reportsPreviewTitle }}
                      </span>
                    </div>
                  </div>
                  <div class="reports-login-shell">
                    <div class="reports-login-panel">
                      <div class="reports-login-brand">
                        <img
                          v-if="reportsLogoUrl"
                          :src="reportsLogoUrl"
                          alt="Reports logo"
                          class="reports-login-logo"
                        />
                        <div v-else class="reports-login-logo-fallback">
                          {{ reportsBrandName }}
                        </div>
                        <div class="reports-login-subtitle">
                          <i class="bar chart icon"></i>
                          {{ reportsPreviewTitle }}
                        </div>
                      </div>
                      <div class="reports-login-form">
                        <label class="reports-login-label">
                          {{ $t("rebranding.username") }}
                        </label>
                        <div class="reports-login-input"></div>
                        <label class="reports-login-label">
                          {{ $t("rebranding.password") }}
                        </label>
                        <div class="reports-login-input"></div>
                        <div class="reports-login-button">
                          {{ $t("rebranding.sign_in") }}
                        </div>
                      </div>
                    </div>
                    <div
                      v-if="rebranding_reports_login_people"
                      class="reports-login-side"
                      :style="reportsBackgroundStyle"
                    >
                      <div class="reports-login-side-overlay">
                        <div class="reports-login-side-chip">
                          {{ reportsPreviewTitle }}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <NsInlineNotification
                v-if="error.setRebranding"
                kind="error"
                :title="$t('action.set-rebranding')"
                :description="error.setRebranding"
                :showCloseButton="false"
              />
              <NsButton
                kind="primary"
                :icon="Save20"
                :loading="loading.setRebranding"
                :disabled="loading.setRebranding"
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
import { Sun20, Moon20 } from "@carbon/icons-vue";
import Information16 from "@carbon/icons-vue/es/information/16";

export default {
  name: "Rebranding",
  components: { Sun20, Moon20, ResumeConfigNotification, Information16 },
  mixins: [
    TaskService,
    IconService,
    UtilService,
    QueryParamService,
    PageTitleService,
  ],
  pageTitle() {
    return this.$t("rebranding.title") + " - " + this.appName;
  },
  data() {
    return {
      q: {
        page: "rebranding",
      },
      urlCheckInterval: null,
      rebranding_active: false,
      rebranding_brand_name: "",
      rebranding_navbar_logo_url: "",
      rebranding_navbar_logo_dark_url: "",
      rebranding_login_background_url: "",
      rebranding_favicon_url: "",
      rebranding_login_logo_url: "",
      rebranding_login_logo_dark_url: "",
      rebranding_login_people: false,
      rebranding_reports_brand_name: "",
      rebranding_reports_login_background_url: "",
      rebranding_reports_favicon_url: "",
      rebranding_reports_login_logo_url: "",
      rebranding_reports_login_people: true,
      isDarkMode: false,
      loading: {
        getRebranding: false,
        setRebranding: false,
      },
      error: {
        getRebranding: "",
        setRebranding: "",
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
    logoUrl() {
      return this.isDarkMode
        ? this.rebranding_login_logo_dark_url ||
            require("../assets/login_logo_dark.svg")
        : this.rebranding_login_logo_url || require("../assets/login_logo.svg");
    },
    loginBackgroundUrl() {
      return (
        this.rebranding_login_background_url ||
        require("../assets/background_voice.svg")
      );
    },
    reportsLogoUrl() {
      return this.rebranding_reports_login_logo_url || "";
    },
    reportsFaviconUrl() {
      return this.rebranding_reports_favicon_url || "";
    },
    reportsBrandName() {
      return this.rebranding_reports_brand_name || "NethVoice";
    },
    reportsBrandInitial() {
      return this.reportsBrandName.charAt(0).toUpperCase();
    },
    reportsPreviewTitle() {
      return `${this.reportsBrandName} Reports`;
    },
    reportsBackgroundStyle() {
      if (this.rebranding_reports_login_background_url) {
        return {
          backgroundImage: `url(${this.rebranding_reports_login_background_url})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        };
      }

      return {
        background:
          "linear-gradient(135deg, rgba(229, 247, 239, 1) 0%, rgba(209, 250, 229, 1) 45%, rgba(243, 244, 246, 1) 100%)",
      };
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
    this.getRebranding();
  },
  methods: {
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
        this.error.getRebranding = this.getErrorMessage(err);
        this.loading.getRebranding = false;
        return;
      }
    },
    getRebrandingAborted(taskAction, taskContextGetRebranding) {
      console.error(`${taskContextGetRebranding.action} aborted`, taskAction);
      this.error.getRebranding = this.$t("error.generic_error");
      this.loading.getRebranding = false;
    },
    getRebrandingCompleted(taskContext, taskAction) {
      const config = taskAction.output;
      this.rebranding_active = config.rebranding_active;
      this.rebranding_brand_name = config.rebranding_brand_name;
      this.rebranding_navbar_logo_url = config.rebranding_navbar_logo_url;
      this.rebranding_navbar_logo_dark_url =
        config.rebranding_navbar_logo_dark_url;
      this.rebranding_login_background_url =
        config.rebranding_login_background_url;
      this.rebranding_favicon_url = config.rebranding_favicon_url;
      this.rebranding_login_logo_url = config.rebranding_login_logo_url;
      this.rebranding_login_logo_dark_url =
        config.rebranding_login_logo_dark_url;
      this.rebranding_login_people = config.rebranding_login_people !== "hide";
      this.rebranding_reports_brand_name = config.rebranding_reports_brand_name;
      this.rebranding_reports_login_background_url =
        config.rebranding_reports_login_background_url;
      this.rebranding_reports_favicon_url =
        config.rebranding_reports_favicon_url;
      this.rebranding_reports_login_logo_url =
        config.rebranding_reports_login_logo_url;
      this.rebranding_reports_login_people =
        config.rebranding_reports_login_people !== "hide";
      this.loading.getRebranding = false;
    },
    setLightTheme() {
      this.isDarkMode = false;
    },
    setDarkTheme() {
      this.isDarkMode = true;
    },
    async setRebranding() {
      this.loading.setRebranding = true;
      const taskAction = "set-rebranding";
      const eventId = this.getUuid();

      // register to task error
      this.core.$root.$once(
        `${taskAction}-aborted-${eventId}`,
        this.setRebrandingAborted
      );

      // register to task validation
      this.core.$root.$once(
        `${taskAction}-validation-failed-${eventId}`,
        this.setRebrandingValidationFailed
      );

      // register to task completion
      this.core.$root.$once(
        `${taskAction}-completed-${eventId}`,
        this.setRebrandingCompleted
      );

      // Convert true/false to 'show'/'hide' for rebranding_login_people
      let rebrandingLoginPeople = this.rebranding_login_people
        ? "show"
        : "hide";
      let rebrandingReportsLoginPeople = this.rebranding_reports_login_people
        ? "show"
        : "hide";

      const res = await to(
        this.createModuleTaskForApp(this.instanceName, {
          action: taskAction,
          data: {
            rebranding_login_people: rebrandingLoginPeople,
            rebranding_brand_name: this.rebranding_brand_name,
            rebranding_navbar_logo_url: this.rebranding_navbar_logo_url,
            rebranding_navbar_logo_dark_url:
              this.rebranding_navbar_logo_dark_url,
            rebranding_login_logo_url: this.rebranding_login_logo_url,
            rebranding_login_logo_dark_url: this.rebranding_login_logo_dark_url,
            rebranding_favicon_url: this.rebranding_favicon_url,
            rebranding_login_background_url:
              this.rebranding_login_background_url,
            rebranding_reports_brand_name: this.rebranding_reports_brand_name,
            rebranding_reports_login_people: rebrandingReportsLoginPeople,
            rebranding_reports_login_logo_url:
              this.rebranding_reports_login_logo_url,
            rebranding_reports_favicon_url:
              this.rebranding_reports_favicon_url,
            rebranding_reports_login_background_url:
              this.rebranding_reports_login_background_url,
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
        this.error.setRebranding = this.getErrorMessage(err);
        this.loading.setRebranding = false;
        return;
      }
    },
    setRebrandingAborted(taskAction, taskContext) {
      console.error(`${taskContext.action} aborted`, taskAction);
      this.error.setRebranding = this.$t("error.generic_error");
      this.loading.setRebranding = false;
    },
    setRebrandingValidationFailed(validationErrors) {
      this.loading.setRebranding = false;

      for (const validationError of validationErrors) {
        const param = validationError.parameter;

        // set i18n error message
        this.error[param] = this.$t("settings." + validationError.error);
      }
    },
    setRebrandingCompleted() {
      this.getRebranding();
      this.loading.setRebranding = false;
    },
    openMailtoLink() {
      const encodedSubject = encodeURIComponent(
        this.$t("rebranding.mailto_sales_subject")
      );
      const encodedBody = encodeURIComponent(
        this.$t("rebranding.mailto_sales_body")
      );
      const recipient = "sales@nethesis.it";
      let mailtoUrl = `mailto:${recipient}`;
      const params = [];
      params.push(`subject=${encodedSubject}`);
      params.push(`body=${encodedBody}`);
      mailtoUrl += `?${params.join("&")}`;
      const link = document.createElement("a");
      link.href = mailtoUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    },
  },
};
</script>

<style scoped lang="scss">
@import "../styles/carbon-utils";

.login-preview {
  position: relative;
  max-width: 38rem;
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

/* Light theme */
.light-theme .login-card {
  background-color: #f3f4f6;
  color: #111827;
}

.light-theme .login-input {
  background-color: #ffffff;
  color: #111827;
  border-color: #e5e7eb;
}

.light-theme .login-button {
  background-color: #047857;
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
  background-color: #10b981;
  color: #111827;
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

.section-title {
  margin-bottom: 1rem;
}

.section-separator {
  margin: 2rem 0;
}

.reports-login-preview {
  margin-top: 0.5rem;
  border: 1px solid #d5dbe1;
  border-radius: 4px;
  overflow: hidden;
  background: #111827;
}

.reports-preview-browser-bar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background: #0f172a;
  border-bottom: 1px solid rgba(148, 163, 184, 0.2);
}

.reports-preview-dots {
  display: flex;
  gap: 0.35rem;
}

.reports-preview-dots span {
  width: 0.65rem;
  height: 0.65rem;
  border-radius: 999px;
  background: rgba(248, 250, 252, 0.35);
}

.reports-preview-tab {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0.7rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  color: #e5e7eb;
}

.reports-preview-favicon {
  width: 16px;
  height: 16px;
  border-radius: 4px;
  object-fit: cover;
  flex: 0 0 auto;
}

.reports-preview-favicon-fallback {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #059669;
  color: #fff;
  font-size: 0.75rem;
  font-weight: 600;
}

.reports-preview-tab-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.875rem;
}

.reports-login-shell {
  display: flex;
  min-height: 320px;
}

.reports-login-panel {
  width: 360px;
  padding: 2rem;
  background: #111827;
  color: #f9fafb;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.reports-login-brand {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
}

.reports-login-logo {
  max-width: 220px;
  max-height: 48px;
}

.reports-login-logo-fallback {
  font-size: 1.5rem;
  font-weight: 600;
}

.reports-login-subtitle {
  color: #10b981;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.reports-login-form {
  margin-top: 2rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.reports-login-label {
  text-align: left;
  font-size: 0.875rem;
}

.reports-login-input {
  height: 2.5rem;
  border-radius: 4px;
  background: #030712;
  border: 1px solid #374151;
}

.reports-login-button {
  margin-top: 1rem;
  border-radius: 4px;
  background: #059669;
  color: #fff;
  text-align: center;
  padding: 0.75rem 1rem;
  font-weight: 600;
}

.reports-login-side {
  flex: 1;
  min-width: 240px;
}

.reports-login-side-overlay {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: flex-end;
  justify-content: flex-end;
  padding: 1.5rem;
  background: linear-gradient(180deg, rgba(17, 24, 39, 0.05) 0%, rgba(17, 24, 39, 0.2) 100%);
}

.reports-login-side-chip {
  background: rgba(17, 24, 39, 0.8);
  color: #f9fafb;
  border-radius: 999px;
  padding: 0.5rem 0.9rem;
  font-size: 0.875rem;
}

@media (max-width: 960px) {
  .reports-login-shell {
    flex-direction: column;
  }

  .reports-login-panel {
    width: 100%;
  }

  .reports-login-side {
    min-height: 180px;
  }
}
</style>
