<!--
  Copyright (C) 2025 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->
<template>
  <cv-form>
    <cv-text-input
      v-model="fqdn"
      :label="$t('welcome.proxy.domain')"
      :placeholder="$t('common.eg_value', { value: 'proxy.example.org' })"
      :disabled="disabled || loading.configureModule"
      :invalid-message="error.fqdn"
      :helperText="$t('welcome.proxy.domain_helper')"
      ref="fqdn"
      @input="onFqdnChange"
    ></cv-text-input>
    <div class="flex flex-col">
      <div class="flex items-center">
        <div
          :class="[
            'bx--label',
            'mb-0',
            {
              'bx--label--disabled': disabled,
            },
          ]"
        >
          {{ $t("welcome.proxy.address") }}
          <cv-interactive-tooltip
            alignment="start"
            direction="bottom"
            class="info relative top-0.5"
          >
            <template slot="content">
              {{ $t("welcome.proxy.address_tooltip") }}
            </template>
          </cv-interactive-tooltip>
        </div>
        <cv-loading v-if="loading.resolveFqdn" small class="mg-left-sm" />
      </div>
      <cv-text-input
        v-model="address"
        :disabled="disabled || loading.configureModule"
        :invalid-message="error.address"
        :helperText="$t('welcome.proxy.address_helper')"
        ref="address"
      />
    </div>
    <NsComboBox
      v-model="iface"
      :title="$t('welcome.proxy.network_interface')"
      :options="interfaces"
      :auto-highlight="true"
      :label="$t('welcome.proxy.network_interface_placeholder')"
      :disabled="disabled || loading.configureModule"
      :invalid-message="error.iface"
      :acceptUserInput="false"
      light
      ref="iface"
    />
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
    <NsInlineNotification
      v-if="addressAndInterfaceDontMatch"
      kind="warning"
      :title="$t('welcome.proxy.address_and_iface_dont_match')"
      :description="$t('welcome.proxy.address_and_iface_dont_match_message')"
      :showCloseButton="false"
    />
    <div v-else class="mb-10rem"></div>
  </cv-form>
</template>

<script>
import { UtilService, TaskService, IconService } from "@nethserver/ns8-ui-lib";
import { mapState } from "vuex";
import to from "await-to-js";

export default {
  name: "ProxyConfigurationForm",
  mixins: [UtilService, TaskService, IconService],
  props: {
    config: {
      type: Object,
      required: true,
    },
    disabled: {
      type: Boolean,
      default: false,
    },
    proxyModuleId: {
      type: String,
      required: true,
    },
  },
  data() {
    return {
      fqdn: "",
      address: "",
      resolvedIp: "",
      public_address: "",
      iface: "",
      interfaces: [],
      warningVisible: false,
      fqdnTimeout: 0,
      loading: {
        getAvailableInterfaces: false,
        configureModule: false,
        resolveFqdn: false,
      },
      error: {
        fqdn: "",
        iface: "",
        address: "",
        getAvailableInterfaces: "",
        configureModule: "",
      },
    };
  },
  computed: {
    ...mapState(["core"]),
    addressAndInterfaceDontMatch() {
      return this.address && this.iface && this.address !== this.iface;
    },
  },
  watch: {
    config: function () {
      console.log("watch config"); ////

      this.updateData();
    },
  },
  created() {
    this.getAvailableInterfaces();
    this.updateData();
  },
  methods: {
    updateData() {
      console.log("updateData"); ////

      this.fqdn = this.config.fqdn || "";

      // this.iface is set on get-available-interfaces completion

      if (this.config.addresses.public_address) {
        this.address = this.config.addresses.public_address;
      } else {
        this.resolveFqdn();
      }
    },
    onFqdnChange() {
      if (this.fqdnTimeout) {
        clearTimeout(this.fqdnTimeout);
      }

      if (this.fqdn.trim() !== "") {
        this.loading.resolveFqdn = true;

        this.fqdnTimeout = setTimeout(() => {
          this.resolveFqdn();
        }, 1000);
      } else {
        this.loading.resolveFqdn = false;
      }
    },
    resolveFqdn() {
      console.log("fetching!"); ////

      fetch(`https://dns.google/resolve?name=${this.fqdn}`)
        .then((response) => response.json())
        .then((data) => {
          if (data.Answer && data.Answer.length > 0) {
            for (let record of data.Answer) {
              if (record.type === 1) {
                this.resolvedIp = record.data;
                break;
              }
            }
            //// always set address
            // if (this.resolvedIp && !this.address) { ////
            this.address = this.resolvedIp;
            // } ////
          } else {
            this.resolvedIp = "";
          }
        })
        .catch((error) => {
          console.error("Error resolving fqdn", error);
        })
        .finally(() => {
          this.loading.resolveFqdn = false;
        });
    },
    async getAvailableInterfaces() {
      this.loading.getAvailableInterfaces = true;

      const taskAction = "get-available-interfaces";
      const eventId = this.getUuid();

      // register to task error
      this.core.$root.$once(
        `${taskAction}-aborted-${eventId}`,
        this.getAvailableInterfacesAborted
      );

      // register to task completion
      this.core.$root.$once(
        `${taskAction}-completed-${eventId}`,
        this.getAvailableInterfacesCompleted
      );

      const res = await to(
        this.createModuleTaskForApp(this.proxyModuleId, {
          action: taskAction,
          data: {
            excluded_interfaces: ["lo", "wg0"],
            excluded_families: ["inet6"],
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
        this.error.getAvailableInterfaces = this.getErrorMessage(err);
        this.loading.getAvailableInterfaces = false;
        return;
      }
    },
    getAvailableInterfacesCompleted(taskContext, taskResult) {
      const interfaces = [];
      for (const test of taskResult.output.data) {
        const interfaceAddress = test.addresses[0].address;
        const label = `${test.name} - ${interfaceAddress}`;

        interfaces.push({
          name: test.name,
          label: label,
          value: interfaceAddress,
        });
      }
      this.interfaces = interfaces;
      this.loading.getAvailableInterfaces = false;

      // set interface from config in combobox
      this.$nextTick(() => {
        this.iface = this.config.addresses.address;
      });
    },
    getAvailableInterfacesAborted(taskResult, taskContext) {
      console.error(`${taskContext.action} aborted`, taskResult);
      this.error.getAvailableInterfaces = this.$t("error.generic_error");
      this.loading.getAvailableInterfaces = false;
    },
  },
};
</script>

<style scoped lang="scss">
@import "../styles/carbon-utils";
</style>
