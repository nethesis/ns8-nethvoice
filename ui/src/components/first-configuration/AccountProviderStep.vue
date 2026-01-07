<!--
  Copyright (C) 2025 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->
<template>
  <div>
    <NsInlineNotification
      v-if="error.listUserDomains"
      kind="error"
      :title="core.$t('action.list-user-domains')"
      :description="error.listUserDomains"
      :showCloseButton="false"
    />
    <cv-skeleton-text
      v-if="loading.listUserDomains"
      :paragraph="true"
      heading
      :line-count="7"
    ></cv-skeleton-text>
    <template v-else-if="!domains.length">
      <!-- no user domain configured -->
      <NsEmptyState :title="$t('welcome.no_domain_configured')">
        <template #pictogram>
          <GroupPictogram />
        </template>
        <template #description>
          <div>
            <i18n path="welcome.no_domain_configured_description" tag="span">
              <template v-slot:domainsAndUsers>
                <cv-link @click="goToDomainsAndUsers">
                  {{ core.$t("domains.title") }}
                </cv-link>
              </template>
            </i18n>
          </div>
        </template>
      </NsEmptyState>
    </template>
    <template v-else>
      <!-- there are user domains configured -->
      <div class="flex flex-col gap-4">
        <div>
          <i18n path="welcome.account_provider_step_description" tag="span">
            <template v-slot:domainsAndUsers>
              <cv-link @click="goToDomainsAndUsers">
                {{ core.$t("domains.title") }}
              </cv-link>
            </template>
            <template v-slot:node>
              {{ nodeLabel }}
            </template>
          </i18n>
        </div>
        <div>
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
              :label="
                $t('welcome.create_openldap_provider', { node: this.nodeLabel })
              "
              value="create_openldap"
              v-model="accountProviderType"
            />
          </cv-radio-group>
        </div>
        <NsComboBox
          v-if="accountProviderType == 'use_existing_provider'"
          v-model="domainName"
          :invalid-message="error.accountProvider"
          :label="
            loading.listUserDomains
              ? $t('common.loading')
              : $t('welcome.account_provider_placeholder')
          "
          :title="$t('welcome.account_provider')"
          :auto-filter="true"
          :auto-highlight="true"
          :options="accountProviderOptions"
          :disabled="loading.listUserDomains"
          show-item-description
          light
          ref="accountProvider"
        />
      </div>
      <div class="mb-12rem"></div>
    </template>
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
import to from "await-to-js";
import { OPENLDAP_STEP, PROXY_STEP } from "./FirstConfigurationModal.vue";

export default {
  name: "AccountProviderStep",
  mixins: [UtilService, TaskService, IconService, LottieService],
  props: {
    nodeLabel: {
      type: String,
      required: true,
    },
    // this prop has a value only when coming back from ProxyStep
    accountProvider: {
      type: Object,
      default: null,
    },
  },
  data() {
    return {
      domains: [],
      accountProviderType: "",
      domainName: "",
      loading: {
        listUserDomains: false,
      },
      error: {
        accountProvider: "",
        listUserDomains: "",
      },
    };
  },
  computed: {
    ...mapState(["core"]),
    accountProviderOptions() {
      return this.domains.map((domain) => {
        return {
          name: domain.name,
          value: domain.name,
          label: `${domain.name} - ${this.getDomainType(domain)}`,
        };
      });
    },
    selectedAccountProvider() {
      return this.domains.find((domain) => domain.name === this.domainName);
    },
  },
  watch: {
    "loading.listUserDomains": {
      immediate: true,
      handler(newVal) {
        this.$emit("set-next-enabled", !newVal);
      },
    },
    domains: {
      immediate: true,
      handler() {
        this.updateNextButtonLabel();
      },
    },
    accountProviderType: {
      immediate: true,
      handler() {
        this.updateNextButtonLabel();
        this.$emit("change-account-provider-type", this.accountProviderType);
      },
    },
  },
  created() {
    this.listUserDomains();
    this.$emit("set-previous-enabled", false);
    this.$emit("set-next-loading", false);
  },
  methods: {
    updateNextButtonLabel() {
      if (
        !this.domains.length ||
        this.accountProviderType == "create_openldap"
      ) {
        this.$emit("set-next-label", this.$t("welcome.install_openldap"));
      } else {
        this.$emit("set-next-label", this.core.$t("common.next"));
      }
    },
    goToDomainsAndUsers() {
      this.core.$router.push("/domains");
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
            this.domainName = this.accountProviderOptions[0].value;
          });
        } else if (this.accountProvider) {
          // coming back from ProxyStep, restore previous selection
          this.domainName = this.accountProvider.domain;
        }
      } else {
        this.accountProviderType = "create_openldap";
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
    next() {
      if (!this.validateSelectAccountProvider()) {
        return;
      }

      if (
        !this.domains.length ||
        this.accountProviderType == "create_openldap"
      ) {
        this.$emit("set-step", OPENLDAP_STEP);
      } else {
        this.$emit("set-account-provider", {
          id: this.selectedAccountProvider.providers[0].id,
          domain: this.domainName,
          internal: this.selectedAccountProvider.location === "internal",
        });
        this.$emit("set-step", PROXY_STEP);
      }
    },
    validateSelectAccountProvider() {
      this.error.accountProvider = "";
      let isValidationOk = true;

      if (
        this.accountProviderType == "use_existing_provider" &&
        !this.domainName
      ) {
        this.error.accountProvider = this.$t("common.required");
        isValidationOk = false;
      }
      return isValidationOk;
    },
  },
};
</script>

<style scoped lang="scss">
@import "../../styles/carbon-utils";
</style>
