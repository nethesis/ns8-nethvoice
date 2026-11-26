<!--
  Copyright (C) 2024 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->
<template>
  <cv-grid fullWidth>
    <cv-row>
      <cv-column class="page-title">
        <h2>{{ $t("integrations.title") }}</h2>
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
      <cv-row v-if="error.getIntegrations">
        <cv-column>
          <NsInlineNotification
            kind="error"
            :title="$t('action.get-integrations')"
            :description="error.getIntegrations"
            :showCloseButton="false"
          />
        </cv-column>
      </cv-row>
      <cv-row>
        <cv-column>
          <cv-tile light>
            <cv-skeleton-text
              v-if="loading.getIntegrations"
              :paragraph="true"
              heading
              :line-count="8"
            ></cv-skeleton-text>
            <cv-form v-else @submit.prevent="setIntegrations">
              <h4 class="mb-4">{{ $t("integrations.chat") }}</h4>
              <NsToggle
                :label="$t('integrations.chat_toggle')"
                value="isChatEnabled"
                :disabled="loading.setIntegrations"
                v-model="isChatEnabled"
              >
                <template #tooltip>{{
                  $t("integrations.chat_tooltip")
                }}</template>
                <template slot="text-left">{{
                  $t("common.disabled")
                }}</template>
                <template slot="text-right">{{
                  $t("common.enabled")
                }}</template>
              </NsToggle>
              <!-- chat settings, only while the chat is enabled -->
              <template v-if="isChatEnabled">
                <NsTextInput
                  :label="$t('integrations.chat_retention')"
                  v-model="chatRetentionDays"
                  type="number"
                  :helper-text="$t('integrations.chat_retention_helper')"
                  :invalid-message="error.chat_retention_days"
                  :disabled="loading.setIntegrations"
                  ref="chat_retention_days"
                />
                <NsTextInput
                  :label="$t('integrations.chat_upload_quota')"
                  v-model="chatUploadQuotaMb"
                  type="number"
                  :helper-text="$t('integrations.chat_upload_quota_helper')"
                  :invalid-message="error.chat_upload_quota_mb"
                  :disabled="loading.setIntegrations"
                  ref="chat_upload_quota_mb"
                />
                <NsTextInput
                  :label="$t('integrations.chat_upload_max_file')"
                  v-model="chatUploadMaxFileMb"
                  type="number"
                  :invalid-message="error.chat_upload_max_file_mb"
                  :disabled="loading.setIntegrations"
                  ref="chat_upload_max_file_mb"
                />
              </template>
              <h4 class="mb-4 section-title">
                {{ $t("integrations.transcription_and_ai") }}
              </h4>
              <NsToggle
                :label="$t('integrations.voice_agent_preview')"
                value="voiceAgentEnabled"
                :disabled="loading.setIntegrations"
                v-model="voiceAgentEnabled"
              >
                <template slot="text-left">{{
                  $t("common.disabled")
                }}</template>
                <template slot="text-right">{{
                  $t("common.enabled")
                }}</template>
              </NsToggle>
              <NsInlineNotification
                v-if="applyStatus !== 'applied'"
                :kind="applyStatus === 'failed' ? 'error' : 'info'"
                :title="$t('integrations.apply_' + applyStatus)"
                :description="applyErrorDescription"
                :showCloseButton="false"
              />
              <NsButton
                v-if="applyStatus === 'pending'"
                kind="ghost"
                type="button"
                :loading="loading.refreshApplyStatus"
                :disabled="
                  loading.refreshApplyStatus || loading.setIntegrations
                "
                @click="getIntegrations(true)"
              >
                {{ $t("integrations.refresh_apply_status") }}
              </NsButton>
              <h5 class="mb-4">{{ $t("integrations.deepgram_section") }}</h5>
              <NsTextInput
                :label="$t('integrations.deepgram_api_key')"
                v-model.trim="deepgramApiKey"
                :placeholder="
                  $t('common.eg_value', {
                    value: 'g8id86rxn5cns0umkvx6klo9rm0b0vjzrljg064k',
                  })
                "
                :disabled="loading.setIntegrations"
                :invalid-message="error.deepgram_api_key"
                type="password"
                :passwordHideLabel="core.$t('password.hide_password')"
                :passwordShowLabel="core.$t('password.show_password')"
                tooltipAlignment="end"
                tooltipDirection="right"
                ref="deepgram_api_key"
              >
                <template slot="tooltip">
                  <i18n path="integrations.deepgram_api_key_tooltip" tag="span">
                    <template #deepgramLink>
                      <cv-link
                        href="https://deepgram.com/"
                        target="_blank"
                        rel="noreferrer"
                      >
                        deepgram.com
                      </cv-link>
                    </template>
                  </i18n>
                </template>
              </NsTextInput>
              <NsToggle
                :label="$t('integrations.call_transcription')"
                value="isCallTranscriptionEnabled"
                :disabled="!hasDeepgramApiKey || loading.setIntegrations"
                v-model="isCallTranscriptionEnabled"
              >
                <template slot="text-left">
                  {{ $t("common.disabled") }}
                </template>
                <template slot="text-right">
                  {{ $t("common.enabled") }}
                </template>
              </NsToggle>
              <NsInlineNotification
                v-if="isCallTranscriptionEnabled"
                kind="info"
                class="call-transcription-notification"
                :title="$t('integrations.call_transcription_warning_title')"
                :description="
                  $t('integrations.call_transcription_warning_description')
                "
                :showCloseButton="false"
              />
              <NsToggle
                :label="$t('integrations.voicemail_transcription_enabled')"
                value="isVoicemailTranscriptionEnabled"
                :disabled="!hasDeepgramApiKey || loading.setIntegrations"
                v-model="isVoicemailTranscriptionEnabled"
              >
                <template slot="text-left">
                  {{ $t("common.disabled") }}
                </template>
                <template slot="text-right">
                  {{ $t("common.enabled") }}
                </template>
              </NsToggle>
              <h5 class="mb-4 subsection-title">
                {{ $t("integrations.openai_section") }}
              </h5>
              <NsTextInput
                :label="$t('integrations.openai_api_key')"
                v-model.trim="openaiApiKey"
                :placeholder="
                  $t('common.eg_value', {
                    value: 'sk-proj-1234567890abcdef',
                  })
                "
                :disabled="loading.setIntegrations"
                :invalid-message="error.openai_api_key"
                type="password"
                :passwordHideLabel="core.$t('password.hide_password')"
                :passwordShowLabel="core.$t('password.show_password')"
                tooltipAlignment="end"
                tooltipDirection="right"
                ref="openai_api_key"
              >
                <template slot="tooltip">
                  <i18n path="integrations.openai_api_key_tooltip" tag="span">
                    <template #openaiLink>
                      <cv-link
                        href="https://platform.openai.com/api-keys"
                        target="_blank"
                        rel="noreferrer"
                      >
                        platform.openai.com
                      </cv-link>
                    </template>
                  </i18n>
                </template>
              </NsTextInput>
              <NsInlineNotification
                v-if="
                  savedOpenaiKey &&
                  !openaiApiKey &&
                  (inheritedAgents === null || inheritedAgents.length)
                "
                kind="warning"
                :title="$t('integrations.key_removal')"
                :description="
                  inheritedAgents === null
                    ? $t('integrations.inventory_unavailable')
                    : inheritedAgents.join(', ')
                "
                :showCloseButton="false"
              />
              <NsToggle
                :label="$t('integrations.call_summary')"
                value="isCallSummaryEnabled"
                :disabled="
                  !hasOpenaiApiKey ||
                  !isCallTranscriptionEnabled ||
                  loading.setIntegrations
                "
                v-model="isCallSummaryEnabled"
              >
                <template slot="text-left">
                  {{ $t("common.disabled") }}
                </template>
                <template slot="text-right">
                  {{ $t("common.enabled") }}
                </template>
              </NsToggle>
              <NsInlineNotification
                v-if="error.setIntegrations"
                kind="error"
                :title="$t('action.set-integrations')"
                :description="error.setIntegrations"
                :showCloseButton="false"
              />
              <NsButton
                kind="primary"
                :icon="Save20"
                :loading="loading.setIntegrations"
                :disabled="loading.setIntegrations"
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

export default {
  name: "Integrations",
  components: { ResumeConfigNotification },
  mixins: [
    TaskService,
    IconService,
    UtilService,
    QueryParamService,
    PageTitleService,
  ],
  pageTitle() {
    return this.$t("integrations.title") + " - " + this.appName;
  },
  data() {
    return {
      q: {
        page: "integrations",
      },
      urlCheckInterval: null,
      deepgramApiKey: "",
      openaiApiKey: "",
      savedOpenaiKey: false,
      voiceAgentEnabled: false,
      applyStatus: "applied",
      applyError: null,
      inheritedAgents: [],
      isCallTranscriptionEnabled: false,
      isVoicemailTranscriptionEnabled: false,
      isCallSummaryEnabled: false,
      isChatEnabled: false,
      chatRetentionDays: "365",
      chatUploadQuotaMb: "200",
      chatUploadMaxFileMb: "25",
      loading: {
        getIntegrations: false,
        refreshApplyStatus: false,
        setIntegrations: false,
      },
      error: {
        getIntegrations: "",
        setIntegrations: "",
        deepgram_api_key: "",
        openai_api_key: "",
        chat_retention_days: "",
        chat_upload_quota_mb: "",
        chat_upload_max_file_mb: "",
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
    hasDeepgramApiKey() {
      return !!this.deepgramApiKey;
    },
    hasOpenaiApiKey() {
      return !!this.openaiApiKey;
    },
    applyErrorDescription() {
      if (this.applyStatus !== "failed") {
        return "";
      }
      const key = "integrations.apply_error_" + this.applyError;
      return this.$te(key)
        ? this.$t(key)
        : this.$t("integrations.apply_error_apply_failed");
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
    this.getIntegrations();
  },
  methods: {
    async getIntegrations(statusOnly = false) {
      const loadingField = statusOnly
        ? "refreshApplyStatus"
        : "getIntegrations";
      this.loading[loadingField] = true;
      this.error.getIntegrations = "";
      const taskAction = "get-integrations";
      const eventId = this.getUuid();

      // register to task error
      this.core.$root.$once(
        `${taskAction}-aborted-${eventId}`,
        (result, context) =>
          this.getIntegrationsAborted(result, context, loadingField)
      );

      // register to task completion
      this.core.$root.$once(
        `${taskAction}-completed-${eventId}`,
        (context, result) =>
          this.getIntegrationsCompleted(context, result, loadingField)
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
        this.error.getIntegrations = this.getErrorMessage(err);
        this.loading[loadingField] = false;
        return;
      }
    },
    getIntegrationsAborted(taskResult, taskContext, loadingField) {
      console.error(`${taskContext.action} aborted`, taskResult);
      this.error.getIntegrations = this.$t("error.generic_error");
      this.loading[loadingField] = false;
    },
    getIntegrationsCompleted(taskContext, taskResult, loadingField) {
      const integrations = taskResult.output;
      this.loading[loadingField] = false;
      this.applyStatus = integrations.satellite_apply_status || "applied";
      this.applyError = integrations.satellite_apply_error || null;
      if (loadingField === "refreshApplyStatus") {
        return;
      }
      this.deepgramApiKey = integrations.deepgram_api_key || "";
      this.openaiApiKey = integrations.openai_api_key || "";
      this.isCallTranscriptionEnabled =
        integrations.satellite_call_transcription_enabled || false;
      this.isVoicemailTranscriptionEnabled =
        integrations.satellite_voicemail_transcription_enabled || false;
      this.isCallSummaryEnabled =
        integrations.satellite_call_summary_enabled || false;
      this.savedOpenaiKey = !!integrations.openai_api_key;
      this.voiceAgentEnabled = !!integrations.voice_agent_enabled;
      this.inheritedAgents =
        integrations.inherited_agents === undefined
          ? []
          : integrations.inherited_agents;
      this.isChatEnabled = integrations.chat_enabled || false;
      this.chatRetentionDays = String(integrations.chat_retention_days || 365);
      this.chatUploadQuotaMb = String(integrations.chat_upload_quota_mb || 200);
      this.chatUploadMaxFileMb = String(
        integrations.chat_upload_max_file_mb || 25
      );
    },
    validateChat() {
      this.error.chat_retention_days = "";
      this.error.chat_upload_quota_mb = "";
      this.error.chat_upload_max_file_mb = "";
      if (!this.isChatEnabled) {
        return true;
      }
      const days = Number(this.chatRetentionDays);
      const quota = Number(this.chatUploadQuotaMb);
      const maxFile = Number(this.chatUploadMaxFileMb);
      if (!Number.isInteger(days) || days < 1 || days > 3650) {
        this.error.chat_retention_days = this.$t(
          "integrations.chat_retention_invalid"
        );
      } else if (!Number.isInteger(quota) || quota < 10 || quota > 100000) {
        this.error.chat_upload_quota_mb = this.$t(
          "integrations.chat_upload_quota_invalid"
        );
      } else if (!Number.isInteger(maxFile) || maxFile < 1 || maxFile > 1024) {
        this.error.chat_upload_max_file_mb = this.$t(
          "integrations.chat_upload_max_file_invalid"
        );
      } else if (maxFile > quota) {
        this.error.chat_upload_max_file_mb = this.$t(
          "integrations.chat_upload_max_file_over_quota"
        );
      }
      for (const field of [
        "chat_retention_days",
        "chat_upload_quota_mb",
        "chat_upload_max_file_mb",
      ]) {
        if (this.error[field]) {
          this.focusElement(field);
          return false;
        }
      }
      return true;
    },
    async setIntegrations() {
      if (!this.validateChat()) {
        return;
      }
      const hasDeepgramApiKey = this.hasDeepgramApiKey;
      const hasOpenaiApiKey =
        this.hasOpenaiApiKey && this.isCallTranscriptionEnabled;
      this.error.setIntegrations = "";
      this.error.deepgram_api_key = "";
      this.error.openai_api_key = "";
      this.loading.setIntegrations = true;
      const taskAction = "set-integrations";
      const eventId = this.getUuid();

      // register to task error
      this.core.$root.$once(
        `${taskAction}-aborted-${eventId}`,
        this.setIntegrationsAborted
      );

      // register to task validation
      this.core.$root.$once(
        `${taskAction}-validation-failed-${eventId}`,
        this.setIntegrationsValidationFailed
      );

      // register to task completion
      this.core.$root.$once(
        `${taskAction}-completed-${eventId}`,
        this.setIntegrationsCompleted
      );

      const res = await to(
        this.createModuleTaskForApp(this.instanceName, {
          action: taskAction,
          data: {
            voice_agent_enabled: this.voiceAgentEnabled,
            chat_enabled: this.isChatEnabled,
            ...(this.isChatEnabled && {
              chat_retention_days: Number(this.chatRetentionDays),
              chat_upload_quota_mb: Number(this.chatUploadQuotaMb),
              chat_upload_max_file_mb: Number(this.chatUploadMaxFileMb),
            }),
            deepgram_api_key: this.deepgramApiKey,
            openai_api_key: this.openaiApiKey,
            satellite_call_transcription_enabled: hasDeepgramApiKey
              ? this.isCallTranscriptionEnabled
              : false,
            satellite_voicemail_transcription_enabled: hasDeepgramApiKey
              ? this.isVoicemailTranscriptionEnabled
              : false,
            satellite_call_summary_enabled: hasOpenaiApiKey
              ? this.isCallSummaryEnabled
              : false,
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
        this.error.setIntegrations = this.getErrorMessage(err);
        this.loading.setIntegrations = false;
        return;
      }
    },
    setIntegrationsAborted(taskResult, taskContext) {
      console.error(`${taskContext.action} aborted`, taskResult);
      this.error.setIntegrations = this.$t("error.generic_error");
      this.loading.setIntegrations = false;
    },
    setIntegrationsValidationFailed(validationErrors) {
      this.loading.setIntegrations = false;

      for (const validationError of validationErrors) {
        const param = validationError.parameter;

        // set i18n error message
        this.error[param] = this.$t("settings." + validationError.error);
      }
    },
    setIntegrationsCompleted() {
      this.getIntegrations();
      this.loading.setIntegrations = false;
    },
  },
  watch: {
    deepgramApiKey(value) {
      if (value) {
        return;
      }
      this.isCallTranscriptionEnabled = false;
      this.isVoicemailTranscriptionEnabled = false;
      this.isCallSummaryEnabled = false;
    },
    openaiApiKey(value) {
      if (value) {
        return;
      }
      this.isCallSummaryEnabled = false;
    },
    isCallTranscriptionEnabled(value) {
      if (value) {
        return;
      }
      this.isCallSummaryEnabled = false;
    },
  },
};
</script>

<style scoped lang="scss">
@import "../styles/carbon-utils";

// a line and some room between the chat and the transcription sections
.section-title {
  margin-top: $spacing-07;
  padding-top: $spacing-07;
  border-top: 1px solid $ui-03;
}

.subsection-title {
  margin-top: $spacing-07;
}

// align the notification width to the text inputs above/below it
.call-transcription-notification {
  max-width: 38rem;
}
</style>
