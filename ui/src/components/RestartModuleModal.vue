<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->
<template>
  <NsModal
    size="default"
    :visible="visible"
    :isLoading="loading.restartModule"
    @modal-hidden="onModalHidden"
    @primary-click="restartModule"
    kind="danger"
    :primary-button-disabled="loading.restartModule"
  >
    <template slot="title">
      {{ $t("status.restart_application") }}
    </template>
    <template slot="content">
      <p>
        {{ $t("status.restart_module_warning", { name: appName }) }}
      </p>
      <div v-if="error.restartModule">
        <NsInlineNotification
          kind="error"
          :title="$t('action.restart-module')"
          :description="error.restartModule"
          :showCloseButton="false"
        />
      </div>
    </template>
    <template slot="secondary-button">{{ core.$t("common.cancel") }}</template>
    <template slot="primary-button">{{
      $t("status.restart_application")
    }}</template>
  </NsModal>
</template>

<script>
import { UtilService, TaskService, IconService } from "@nethserver/ns8-ui-lib";
import to from "await-to-js";
import { mapState } from "vuex";

export default {
  name: "RestartModuleModal",
  mixins: [UtilService, TaskService, IconService],
  props: {
    visible: {
      type: Boolean,
      required: true,
    },
    node: {
      type: String,
      default: "",
    },
  },
  data() {
    return {
      error: { restartModule: "" },
      loading: { restartModule: false },
    };
  },
  computed: {
    ...mapState(["instanceName", "instanceLabel", "core"]),
    appName() {
      return this.instanceLabel
        ? this.instanceLabel + " (" + this.instanceName + ")"
        : this.instanceName;
    },
  },
  methods: {
    async restartModule() {
      this.error.restartModule = "";
      this.loading.restartModule = true;
      const taskAction = "restart-module";
      const eventId = this.getUuid();

      // register to task error
      this.core.$root.$once(
        `${taskAction}-aborted-${eventId}`,
        this.restartModuleAborted
      );

      // register to task completion
      this.core.$root.$once(
        `${taskAction}-completed-${eventId}`,
        this.restartModuleCompleted
      );

      const res = await to(
        this.createNodeTaskForApp(this.node, {
          action: taskAction,
          data: {
            module_id: this.instanceName,
          },
          extra: {
            title: this.core.$t("applications.restart_instance_name", {
              instance: this.instanceLabel
                ? this.instanceLabel
                : this.instanceName,
            }),
            description: this.core.$t("applications.restarting"),
            eventId,
          },
        })
      );
      const err = res[0];

      if (err) {
        console.error(`error creating task ${taskAction}`, err);
        this.error.restartModule = this.getErrorMessage(err);
        this.loading.restartModule = false;
        return;
      }
      this.$emit("hide");
    },
    restartModuleAborted(taskResult, taskContext) {
      console.error(`${taskContext.action} aborted`, taskResult);
      this.error.restartModule = this.$t("error.generic_error");
      this.loading.restartModule = false;
    },
    restartModuleCompleted() {
      this.loading.restartModule = false;
      this.$emit("hide");
    },
    onModalHidden() {
      this.clearErrors();
      this.$emit("hide");
    },
  },
};
</script>
