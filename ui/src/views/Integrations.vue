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
    <cv-row>
      <cv-column>
        <ResumeConfigNotification
          v-if="!isAppConfigured && !isShownFirstConfigurationModal"
        />
      </cv-column>
    </cv-row>
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
            :line-count="5"
          ></cv-skeleton-text>
          <cv-form v-else @submit.prevent="setIntegrations">
            <NsTextInput
              :label="$t('integrations.deepgram_api_key')"
              v-model.trim="deepgram_api_key"
              :placeholder="
                $t('common.eg_value', {
                  value: 'g7id86rxn5cns0umkvx6klo9rm0b0vjzrljg064k',
                })
              "
              :disabled="loading.setIntegrations"
              :invalid-message="error.deepgram_api_key"
              ref="deepgram_api_key"
            />
            <!-- //// check disabled condition -->
            <NsToggle
              :label="$t('integrations.satellite_call_transcription_enabled')"
              value="satellite_call_transcription_enabled"
              :disabled="!deepgram_api_key || loading.setIntegrations"
              v-model="satellite_call_transcription_enabled"
            >
              <template slot="text-left">
                {{ $t("common.disabled") }}
              </template>
              <template slot="text-right">
                {{ $t("common.enabled") }}
              </template>
            </NsToggle>
            <NsInlineNotification
              v-if="satellite_call_transcription_enabled"
              kind="warning"
              :title="
                $t(
                  'integrations.satellite_call_transcription_enabled_warning_title'
                )
              "
              :description="
                $t(
                  'integrations.satellite_call_transcription_enabled_warning_description'
                )
              "
              :showCloseButton="false"
            />
            <NsToggle
              :label="
                $t('integrations.satellite_voicemail_transcription_enabled')
              "
              value="satellite_voicemail_transcription_enabled"
              :disabled="!deepgram_api_key || loading.setIntegrations"
              v-model="satellite_voicemail_transcription_enabled"
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
  </cv-grid>
</template>

<script>
// import to from "await-to-js"; ////
import { mapState } from "vuex";
import {
  QueryParamService,
  UtilService,
  TaskService,
  IconService,
  PageTitleService,
} from "@nethserver/ns8-ui-lib";
import ResumeConfigNotification from "@/components/first-configuration/ResumeConfigNotification.vue";

//// review

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
      satellite_call_transcription_enabled: false,
      satellite_voicemail_transcription_enabled: false,
      deepgram_api_key: "",
      loading: {
        getIntegrations: false,
        setIntegrations: false,
      },
      error: {
        getIntegrations: "",
        setIntegrations: "",
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
    ////
  },
  methods: {
    setIntegrations() {
      ////
    },
  },
};
</script>

<style scoped lang="scss">
@import "../styles/carbon-utils";
</style>
