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
              <NsToggle
                :label="$t('integrations.call_transcription')"
                value="isCallTranscriptionEnabled"
                :disabled="!deepgramApiKey || loading.setIntegrations"
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
                kind="warning"
                :title="$t('integrations.call_transcription_warning_title')"
                :description="
                  $t('integrations.call_transcription_warning_description')
                "
                :showCloseButton="false"
              />
              <NsToggle
                :label="$t('integrations.voicemail_transcription_enabled')"
                value="isVoicemailTranscriptionEnabled"
                :disabled="!deepgramApiKey || loading.setIntegrations"
                v-model="isVoicemailTranscriptionEnabled"
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
      isCallTranscriptionEnabled: false,
      isVoicemailTranscriptionEnabled: false,
      loading: {
        getIntegrations: false,
        setIntegrations: false,
      },
      error: {
        getIntegrations: "",
        setIntegrations: "",
        deepgram_api_key: "",
        openai_api_key: "",
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
    async getIntegrations() {
      this.loading.getIntegrations = true;
      this.error.getIntegrations = "";
      const taskAction = "get-integrations";
      const eventId = this.getUuid();

      // register to task error
      this.core.$root.$once(
        `${taskAction}-aborted-${eventId}`,
        this.getIntegrationsAborted
      );

      // register to task completion
      this.core.$root.$once(
        `${taskAction}-completed-${eventId}`,
        this.getIntegrationsCompleted
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
        this.loading.getIntegrations = false;
        return;
      }
    },
    getIntegrationsAborted(taskResult, taskContext) {
      console.error(`${taskContext.action} aborted`, taskResult);
      this.error.getIntegrations = this.$t("error.generic_error");
      this.loading.getIntegrations = false;
    },
    getIntegrationsCompleted(taskContext, taskResult) {
      const integrations = taskResult.output;
      this.deepgramApiKey = integrations.deepgram_api_key || "";
      this.openaiApiKey = integrations.openai_api_key || "";
      this.isCallTranscriptionEnabled =
        integrations.satellite_call_transcription_enabled || false;
      this.isVoicemailTranscriptionEnabled =
        integrations.satellite_voicemail_transcription_enabled || false;
      this.loading.getIntegrations = false;
    },
    async setIntegrations() {
      this.error.setIntegrations = "";
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
            deepgram_api_key: this.deepgramApiKey,
            openai_api_key: this.openaiApiKey,
            satellite_call_transcription_enabled: this.deepgramApiKey
              ? this.isCallTranscriptionEnabled
              : false,
            satellite_voicemail_transcription_enabled: this.deepgramApiKey
              ? this.isVoicemailTranscriptionEnabled
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
};
</script>

<style scoped lang="scss">
@import "../styles/carbon-utils";
</style>
