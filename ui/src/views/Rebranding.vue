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
    <cv-row>
      <cv-column>
        <ResumeConfigNotification
          v-if="!isAppConfigured && !isShownFirstConfigurationModal"
        />
      </cv-column>
    </cv-row>
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
    <cv-row>
      <cv-column>
        <cv-tile light>
          <cv-skeleton-text
            v-if="loading.getRebranding"
            :paragraph="true"
            heading
            :line-count="10"
          ></cv-skeleton-text>
          <!-- //// notification for rebranding not available -->
          <cv-form v-else @submit.prevent="setRebranding">
            <!-- //// global toggle? -->
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
              <template slot="text-left">{{ $t("common.disabled") }}</template>
              <template slot="text-right">{{ $t("common.enabled") }}</template>
            </NsToggle>

            <!-- Login page preview -->
            <div class="mb-6">
              <label class="bx--label mb-0">{{
                $t("rebranding.login_page_preview")
              }}</label>
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
      rebranding_active: false,
      rebranding_brand_name: "",
      rebranding_navbar_logo_url: "",
      rebranding_navbar_logo_dark_url: "",
      rebranding_login_background_url: "",
      rebranding_favicon_url: "",
      rebranding_login_logo_url: "",
      rebranding_login_logo_dark_url: "",
      rebranding_login_people: false,
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
      this.loading.getRebranding = false;
    },
    setLightTheme() {
      this.isDarkMode = false;
    },
    setDarkTheme() {
      this.isDarkMode = true;
    },
    async setRebranding() {
      if (this.rebranding_active) {
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
              rebranding_login_logo_dark_url:
                this.rebranding_login_logo_dark_url,
              rebranding_favicon_url: this.rebranding_favicon_url,
              rebranding_login_background_url:
                this.rebranding_login_background_url,
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
  // text-align: center; ////
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

.theme-buttons {
  position: absolute;
  top: 10px;
  right: 10px;
}

.theme-button {
  margin-left: 8px;
  padding-right: 14px;
}
</style>
