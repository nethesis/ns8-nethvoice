<!--
  Copyright (C) 2023 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->
<template>
  <div id="ns8-app">
    <cv-content id="main-content" class="app-content">
      <AppSideMenu />
      <AppMobileSideMenu />
      <router-view />
      <FirstConfigurationModal
        :isShown="isShownFirstConfigurationModal"
        @configured="onConfigured"
        @hide="setShownFirstConfigurationModalInStore(false)"
      />
    </cv-content>
  </div>
</template>

<script>
import AppSideMenu from "./components/AppSideMenu";
import AppMobileSideMenu from "./components/AppMobileSideMenu";
import { mapState, mapActions } from "vuex";
import {
  QueryParamService,
  TaskService,
  UtilService,
} from "@nethserver/ns8-ui-lib";
import to from "await-to-js";
import FirstConfigurationModal from "./components/first-configuration/FirstConfigurationModal";

export default {
  name: "App",
  components: { AppSideMenu, AppMobileSideMenu, FirstConfigurationModal },
  mixins: [QueryParamService, TaskService, UtilService],
  computed: {
    ...mapState([
      "instanceName",
      "instanceLabel",
      "core",
      "isAppConfigured",
      "isShownFirstConfigurationModal",
    ]),
  },
  created() {
    const core = window.parent.core;
    this.setCoreInStore(core);
    const instanceName = /#\/apps\/([a-zA-Z0-9_-]+)/.exec(
      window.parent.location.hash
    )[1];
    this.setInstanceNameInStore(instanceName);
    this.getInstanceLabel();
    this.setAppName();

    // listen to change route events
    const context = this;
    window.addEventListener(
      "changeRoute",
      function (e) {
        const requestedPage = e.detail;
        context.$router.replace(requestedPage);
      },
      false
    );

    // configure global shortcuts
    core.$root.$emit("configureKeyboardShortcuts", window);

    const queryParams = this.getQueryParamsForApp();
    const requestedPage = queryParams.page || "status";

    if (requestedPage != "status") {
      this.$router.replace(requestedPage);
    }

    // check if module has been configured
    this.getConfiguration();
  },
  methods: {
    ...mapActions([
      "setInstanceNameInStore",
      "setInstanceLabelInStore",
      "setCoreInStore",
      "setAppNameInStore",
      "setAppConfiguredInStore",
      "setConfigurationInStore",
      "setShownFirstConfigurationModalInStore",
    ]),
    async getInstanceLabel() {
      const taskAction = "get-name";
      const eventId = this.getUuid();

      // register to task error
      this.core.$root.$once(
        `${taskAction}-aborted-${eventId}`,
        this.getInstanceLabelAborted
      );

      // register to task completion
      this.core.$root.$once(
        `${taskAction}-completed-${eventId}`,
        this.getInstanceLabelCompleted
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
        this.createErrorNotificationForApp(
          err,
          this.$t("task.cannot_create_task", { action: taskAction })
        );
        return;
      }
    },
    getInstanceLabelAborted(taskResult, taskContext) {
      console.error(`${taskContext.action} aborted`, taskResult);
    },
    getInstanceLabelCompleted(taskContext, taskResult) {
      this.setInstanceLabelInStore(taskResult.output.name);
    },
    setAppName() {
      const metadata = require("../public/metadata.json");
      const appName = metadata.name;
      this.setAppNameInStore(appName);
    },
    async getConfiguration() {
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
        this.createErrorNotificationForApp(
          `error creating task ${taskAction}`,
          this.$t("task.cannot_create_task", { action: taskAction })
        );
        return;
      }
    },
    getConfigurationAborted(taskResult, taskContext) {
      console.error(`${taskContext.action} aborted`, taskResult);
    },
    getConfigurationCompleted(taskContext, taskResult) {
      const config = taskResult.output;
      this.setConfigurationInStore(config);

      if (config.nethvoice_host) {
        // this.setAppConfiguredInStore(true); //// uncomment
        this.setAppConfiguredInStore(false); //// remove mock
        this.setShownFirstConfigurationModalInStore(true); //// remove mock
      } else {
        this.setAppConfiguredInStore(false);
        this.setShownFirstConfigurationModalInStore(true);
      }
    },
    onConfigured() {
      this.setAppConfiguredInStore(true);
      this.setShownFirstConfigurationModalInStore(false);
      this.getConfiguration();
    },
  },
};
</script>

<style lang="scss">
@import "styles/carbon-utils";

.mb-0 {
  margin-bottom: 0 !important;
}

.mb-8rem {
  margin-bottom: 8rem !important;
}

.mb-12rem {
  margin-bottom: 12rem !important;
}

.top-0\.5 {
  top: 2px;
}

.relative {
  position: relative;
}

//// remove when NsTextInput handles light prop correctly
.bx--modal .input-with-gray-bg .bx--text-input {
  background-color: #f4f4f4;
}
</style>
