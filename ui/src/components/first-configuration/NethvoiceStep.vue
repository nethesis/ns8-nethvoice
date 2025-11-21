<!--
  Copyright (C) 2025 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->
<template>
  <div>
    <div class="mg-bottom-lg">
      {{ $t("welcome.configure_nethvoice_application") }}
    </div>
    <cv-form>
      <NsTextInput
        :label="$t('settings.nethvoice_host')"
        v-model="nethvoice_host"
        :placeholder="$t('common.eg_value', { value: 'voice.example.com' })"
        :disabled="loading.configureModule"
        :invalid-message="error.nethvoice_host"
        ref="nethvoice_host"
      />
      <NsTextInput
        :label="$t('settings.nethcti_ui_host')"
        v-model="nethcti_ui_host"
        :placeholder="$t('common.eg_value', { value: 'cti.example.com' })"
        :disabled="loading.configureModule"
        :invalid-message="error.nethcti_ui_host"
        ref="nethcti_ui_host"
      />
      <!-- let's encrypt toggle -->
      <NsToggle
        value="letsEncrypt"
        :label="core.$t('apps_lets_encrypt.request_https_certificate')"
        v-model="isLetsEncryptEnabled"
        :disabled="loading.configureModule"
      >
        <template #tooltip>
          <div class="mg-bottom-sm">
            {{ core.$t("apps_lets_encrypt.lets_encrypt_tips") }}
          </div>
          <div class="mg-bottom-sm">
            <cv-link @click="goToCertificates">
              {{ core.$t("apps_lets_encrypt.go_to_tls_certificates") }}
            </cv-link>
          </div>
        </template>
        <template slot="text-left">{{ $t("common.disabled") }}</template>
        <template slot="text-right">{{ $t("common.enabled") }}</template>
      </NsToggle>
      <!-- disabling let's encrypt warning -->
      <NsInlineNotification
        v-if="isLetsEncryptCurrentlyEnabled && !isLetsEncryptEnabled"
        kind="warning"
        :title="core.$t('apps_lets_encrypt.lets_encrypt_disabled_warning')"
        :description="
          core.$t(
            'apps_lets_encrypt.lets_encrypt_disabled_warning_description',
            {
              node: this.instanceStatus.node_ui_name
                ? this.instanceStatus.node_ui_name
                : this.instanceStatus.node,
            }
          )
        "
        :showCloseButton="false"
      />
      <NsComboBox
        v-model.trim="timezone"
        :autoFilter="true"
        :autoHighlight="true"
        :title="$t('settings.timezone')"
        :label="$t('settings.timezone_placeholder')"
        :options="timezoneOptions"
        :userInputLabel="core.$t('settings.user_input_l')"
        :acceptUserInput="false"
        :showItemType="true"
        :invalid-message="error.timezone"
        :disabled="loading.configureModule"
        tooltipAlignment="start"
        tooltipDirection="top"
        light
        ref="timezone"
      >
        <template slot="tooltip">
          {{ $t("settings.timezone_tooltip") }}
        </template>
      </NsComboBox>
      <NsPasswordInput
        :newPasswordLabel="$t('settings.admin_password')"
        :confirmPasswordLabel="$t('settings.confirm_admin_password')"
        v-model="nethvoice_admin_password"
        @passwordValidation="onPasswordValidation"
        :newPasswordInvalidMessage="error.nethvoice_admin_password"
        :confirmPasswordInvalidMessage="error.confirm_admin_password"
        :passwordHideLabel="core.$t('password.hide_password')"
        :passwordShowLabel="core.$t('password.show_password')"
        :lengthLabel="core.$t('password.long_enough')"
        :lowercaseLabel="core.$t('password.lowercase_letter')"
        :uppercaseLabel="core.$t('password.uppercase_letter')"
        :numberLabel="core.$t('password.number')"
        :symbolLabel="core.$t('password.symbol')"
        :equalLabel="core.$t('password.equal')"
        :focus="focusPasswordField"
        :disabled="loading.configureModule"
        light
        class="new-password"
      />
      <!-- ////  -->
      <NsInlineNotification
        v-if="validationErrorDetails.length"
        kind="error"
        :title="core.$t('apps_lets_encrypt.cannot_obtain_certificate')"
        :showCloseButton="false"
      >
        <template #description>
          <div class="flex flex-col gap-2">
            <div v-for="(detail, index) in validationErrorDetails" :key="index">
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
    </cv-form>
  </div>
</template>

<script>
import {
  UtilService,
  TaskService,
  IconService,
  LottieService,
} from "@nethserver/ns8-ui-lib";
import { mapState } from "vuex";
// import to from "await-to-js"; ////

//// review

export default {
  name: "NethvoiceStep",
  mixins: [UtilService, TaskService, IconService, LottieService],
  data() {
    return {
      nethvoice_host: "",
      nethcti_ui_host: "",
      isLetsEncryptEnabled: false,
      isLetsEncryptCurrentlyEnabled: false,
      validationErrorDetails: [],
      timezone: "",
      timezoneOptions: [],
      nethvoice_admin_password: "",
      passwordValidation: null,
      focusPasswordField: { element: "" },
      loading: {
        configureModule: false,
      },
      error: {
        nethvoice_host: "",
        nethcti_ui_host: "",
        timezone: "",
        nethvoice_admin_password: "",
        configureModule: "",
      },
    };
  },
  computed: {
    ...mapState(["core", "instanceStatus", "defaults"]),
  },
  watch: {
    ////
  },
  created() {
    this.timezoneOptions = this.defaults.accepted_timezone_list.map((tz) => {
      return {
        name: tz,
        value: tz,
        label: tz,
      };
    });

    this.$nextTick(() => {
      this.timezone = this.defaults.local_timezone;
    });
  },
  methods: {
    validateConfigureModule() {
      this.clearErrors();
      this.validationErrorDetails = [];
      // let isValidationOk = true; ////
    },
    configureModuleValidationFailed(validationErrors, taskContext) {
      this.loading.configureModule = false;

      // unregister to task progress
      this.core.$root.$off(
        `${taskContext.action}-progress-${taskContext.extra.eventId}`
      );

      for (const validationError of validationErrors) {
        const param = validationError.parameter;

        if (validationError.details) {
          // show inline error notification with details
          this.validationErrorDetails = validationError.details
            .split("\n")
            .filter((detail) => detail.trim() !== "");
        } else {
          // set i18n error message
          this.error[param] = this.$t("settings." + validationError.error);
        }
      }
    },
    goToCertificates() {
      this.core.$router.push("/settings/tls-certificates");
    },
    onPasswordValidation(passwordValidation) {
      this.passwordValidation = passwordValidation;
    },
  },
};
</script>

<style scoped lang="scss">
@import "../../styles/carbon-utils";
</style>
