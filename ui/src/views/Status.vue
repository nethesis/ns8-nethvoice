<!--
  Copyright (C) 2023 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->
<template>
  <cv-grid fullWidth>
    <cv-row>
      <cv-column class="page-title">
        <h2>{{ $t("status.title") }}</h2>
      </cv-column>
    </cv-row>
    <cv-row v-if="!isAppConfigured">
      <cv-column>
        <ResumeConfigNotification />
      </cv-column>
    </cv-row>
    <cv-row v-if="error.getStatus">
      <cv-column>
        <NsInlineNotification
          kind="error"
          :title="$t('action.get-status')"
          :description="error.getStatus"
          :showCloseButton="false"
        />
      </cv-column>
    </cv-row>
    <cv-row v-if="error.listBackupRepositories">
      <cv-column>
        <NsInlineNotification
          kind="error"
          :title="$t('action.list-backup-repositories')"
          :description="error.listBackupRepositories"
          :showCloseButton="false"
        />
      </cv-column>
    </cv-row>
    <cv-row v-if="error.listBackups">
      <cv-column>
        <NsInlineNotification
          kind="error"
          :title="$t('action.list-backups')"
          :description="error.listBackups"
          :showCloseButton="false"
        />
      </cv-column>
    </cv-row>
    <cv-row>
      <cv-column>
        <!-- card grid -->
        <div
          class="
            card-grid
            grid-cols-1
            md:grid-cols-2
            xl:grid-cols-3
            3xl:grid-cols-4
          "
        >
          <!-- nethvoice host -->
          <NsInfoCard
            light
            :title="$t('status.nethvoice_host')"
            :description="
              configuration && configuration.nethvoice_host
                ? configuration.nethvoice_host
                : $t('status.not_configured')
            "
            :icon="Wikis32"
            :loading="!configuration || !configuration.nethvoice_host"
            class="min-height-card"
          >
            <template slot="content">
              <NsButton
                v-if="configuration && configuration.nethvoice_host"
                kind="ghost"
                :icon="Launch20"
                :disabled="!configuration || !configuration.nethvoice_host"
                @click="goToNethvoiceWebapp"
              >
                {{ $t("status.open_nethvoice") }}
              </NsButton>
              <NsButton
                v-else
                kind="ghost"
                :disabled="loading.getConfiguration"
                :icon="ArrowRight20"
                @click="goToAppPage(instanceName, 'settings')"
              >
                {{ $t("status.configure") }}
              </NsButton>
            </template>
          </NsInfoCard>
          <!-- nethcti host -->
          <NsInfoCard
            light
            :title="$t('status.nethvoice_cti_host')"
            :description="
              configuration && configuration.nethcti_ui_host
                ? configuration.nethcti_ui_host
                : $t('status.not_configured')
            "
            :icon="Wikis32"
            :loading="!configuration || !configuration.nethcti_ui_host"
            class="min-height-card"
          >
            <template slot="content">
              <NsButton
                v-if="configuration && configuration.nethcti_ui_host"
                kind="ghost"
                :icon="Launch20"
                :disabled="!configuration || !configuration.nethcti_ui_host"
                @click="goToCtiWebapp"
              >
                {{ $t("status.open_nethvoice_cti") }}
              </NsButton>
              <NsButton
                v-else
                kind="ghost"
                :disabled="loading.getConfiguration"
                :icon="ArrowRight20"
                @click="goToAppPage(instanceName, 'settings')"
              >
                {{ $t("status.configure") }}
              </NsButton>
            </template>
          </NsInfoCard>
          <!-- application -->
          <NsInfoCard
            light
            :title="status.instance || '-'"
            :description="$t('status.application')"
            :icon="Application32"
            :loading="loading.getStatus"
            class="min-height-card"
          >
            <template slot="content">
              <div class="card-rows">
                <div class="card-row">
                  <NsButton
                    kind="ghost"
                    :icon="Restart20"
                    @click="restartModule"
                  >
                    {{ $t("status.restart_application") }}
                  </NsButton>
                </div>
              </div>
            </template>
          </NsInfoCard>
          <!-- installation node -->
          <NsInfoCard
            light
            :title="installationNodeTitle"
            :titleTooltip="installationNodeTitleTooltip"
            :description="$t('status.installation_node')"
            :icon="Chip32"
            :loading="loading.getStatus"
            class="min-height-card"
          />
          <!-- backup -->
          <NsBackupCard
            :title="core.$t('backup.title')"
            :noBackupMessage="core.$t('backup.no_backup_configured')"
            :goToBackupLabel="core.$t('backup.go_to_backup')"
            :repositoryLabel="core.$t('backup.repository')"
            :statusLabel="core.$t('common.status')"
            :statusSuccessLabel="core.$t('common.success')"
            :statusNotRunLabel="core.$t('backup.backup_has_not_run_yet')"
            :statusErrorLabel="core.$t('error.error')"
            :completedLabel="core.$t('backup.completed')"
            :durationLabel="core.$t('backup.duration')"
            :totalSizeLabel="core.$t('backup.total_size')"
            :totalFileCountLabel="core.$t('backup.total_file_count')"
            :backupDisabledLabel="core.$t('common.disabled')"
            :showMoreLabel="core.$t('common.show_more')"
            :multipleUncertainStatusLabel="
              core.$t('backup.some_backups_failed_or_are_pending')
            "
            :moduleId="instanceName"
            :moduleUiName="instanceLabel"
            :repositories="backupRepositories"
            :backups="backups"
            :loading="loading.listBackupRepositories || loading.listBackups"
            :coreContext="core"
            light
          />
          <!-- system logs -->
          <NsSystemLogsCard
            :title="core.$t('system_logs.card_title')"
            :description="
              core.$t('system_logs.card_description', {
                name: instanceLabel || instanceName,
              })
            "
            :buttonLabel="core.$t('system_logs.card_button_label')"
            :router="core.$router"
            context="module"
            :moduleId="instanceName"
            light
          />
        </div>
      </cv-column>
    </cv-row>
    <!-- services -->
    <cv-row>
      <cv-column class="page-subtitle">
        <h4>{{ $tc("status.services", 2) }}</h4>
      </cv-column>
    </cv-row>
    <cv-row v-if="!loading.getStatus">
      <cv-column v-if="!status.services.length">
        <cv-tile light>
          <NsEmptyState :title="$t('status.no_services')"> </NsEmptyState>
        </cv-tile>
      </cv-column>
      <cv-column
        v-else
        v-for="(service, index) in status.services"
        :key="index"
        :md="4"
        :max="4"
      >
        <NsSystemdServiceCard
          light
          class="min-height-card"
          :serviceName="service.name"
          :active="service.active"
          :failed="service.failed"
          :enabled="service.enabled"
          :icon="Cube32"
        />
      </cv-column>
    </cv-row>
    <cv-row v-else>
      <cv-column :md="4" :max="4">
        <cv-tile light>
          <cv-skeleton-text
            :paragraph="true"
            :line-count="4"
          ></cv-skeleton-text>
        </cv-tile>
      </cv-column>
    </cv-row>
    <!-- images -->
    <cv-row>
      <cv-column class="page-subtitle">
        <h4>{{ $tc("status.app_images", 2) }}</h4>
      </cv-column>
    </cv-row>
    <cv-row>
      <cv-column>
        <cv-tile light>
          <div v-if="!loading.getStatus">
            <NsEmptyState
              v-if="!status.images.length"
              :title="$t('status.no_images')"
            >
            </NsEmptyState>
            <cv-structured-list v-else>
              <template slot="headings">
                <cv-structured-list-heading>{{
                  $t("status.name")
                }}</cv-structured-list-heading>
                <cv-structured-list-heading>{{
                  $t("status.size")
                }}</cv-structured-list-heading>
                <cv-structured-list-heading>{{
                  $t("status.created")
                }}</cv-structured-list-heading>
              </template>
              <template slot="items">
                <cv-structured-list-item
                  v-for="(image, index) in status.images"
                  :key="index"
                >
                  <cv-structured-list-data class="break-word">{{
                    image.name
                  }}</cv-structured-list-data>
                  <cv-structured-list-data>{{
                    image.size
                  }}</cv-structured-list-data>
                  <cv-structured-list-data class="break-word">{{
                    image.created
                  }}</cv-structured-list-data>
                </cv-structured-list-item>
              </template>
            </cv-structured-list>
          </div>
          <cv-skeleton-text
            v-else
            :paragraph="true"
            :line-count="5"
          ></cv-skeleton-text>
        </cv-tile>
      </cv-column>
    </cv-row>
    <!-- volumes -->
    <cv-row>
      <cv-column class="page-subtitle">
        <h4>{{ $tc("status.app_volumes", 2) }}</h4>
      </cv-column>
    </cv-row>
    <cv-row>
      <cv-column>
        <cv-tile light>
          <div v-if="!loading.getStatus">
            <NsEmptyState
              v-if="!status.volumes.length"
              :title="$t('status.no_volumes')"
            >
            </NsEmptyState>
            <cv-structured-list v-else>
              <template slot="headings">
                <cv-structured-list-heading>{{
                  $t("status.name")
                }}</cv-structured-list-heading>
                <cv-structured-list-heading>{{
                  $t("status.mount")
                }}</cv-structured-list-heading>
                <cv-structured-list-heading>{{
                  $t("status.created")
                }}</cv-structured-list-heading>
              </template>
              <template slot="items">
                <cv-structured-list-item
                  v-for="(volume, index) in status.volumes"
                  :key="index"
                >
                  <cv-structured-list-data>{{
                    volume.name
                  }}</cv-structured-list-data>
                  <cv-structured-list-data class="break-word">{{
                    volume.mount
                  }}</cv-structured-list-data>
                  <cv-structured-list-data>{{
                    volume.created
                  }}</cv-structured-list-data>
                </cv-structured-list-item>
              </template>
            </cv-structured-list>
          </div>
          <cv-skeleton-text
            v-else
            :paragraph="true"
            :line-count="5"
          ></cv-skeleton-text>
        </cv-tile>
      </cv-column>
    </cv-row>
  </cv-grid>
</template>

<script>
import to from "await-to-js";
import { mapState, mapActions } from "vuex";
import {
  QueryParamService,
  TaskService,
  IconService,
  UtilService,
  PageTitleService,
} from "@nethserver/ns8-ui-lib";
import ResumeConfigNotification from "@/components/first-configuration/ResumeConfigNotification.vue";
import Restart20 from "@carbon/icons-vue/es/restart/20";

export default {
  name: "Status",
  components: { ResumeConfigNotification },
  mixins: [
    TaskService,
    QueryParamService,
    IconService,
    UtilService,
    PageTitleService,
  ],
  pageTitle() {
    return this.$t("status.title") + " - " + this.appName;
  },
  data() {
    return {
      q: {
        page: "status",
      },
      urlCheckInterval: null,
      isRedirectChecked: false,
      redirectTimeout: 0,
      status: {
        instance: "",
        services: [],
        images: [],
        volumes: [],
      },
      backupRepositories: [],
      backups: [],
      Restart20,
      loading: {
        getStatus: false,
        listBackupRepositories: false,
        listBackups: false,
        restartModule: false,
      },
      error: {
        getStatus: "",
        listBackupRepositories: "",
        listBackups: "",
        restartModule: "",
      },
    };
  },
  computed: {
    ...mapState([
      "instanceName",
      "instanceLabel",
      "core",
      "appName",
      "configuration",
      "isAppConfigured",
      "isShownFirstConfigurationModal",
    ]),
    installationNodeTitle() {
      if (this.status && this.status.node) {
        if (this.status.node_ui_name) {
          return this.status.node_ui_name;
        } else {
          return this.$t("status.node") + " " + this.status.node;
        }
      } else {
        return "-";
      }
    },
    installationNodeTitleTooltip() {
      if (this.status && this.status.node_ui_name) {
        return this.$t("status.node") + " " + this.status.node;
      } else {
        return "";
      }
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
  mounted() {
    this.redirectTimeout = setTimeout(
      () => (this.isRedirectChecked = true),
      200
    );
  },
  beforeUnmount() {
    clearTimeout(this.redirectTimeout);
  },
  created() {
    this.getStatus();
    this.listBackupRepositories();
  },
  methods: {
    ...mapActions(["setInstanceStatusInStore"]),
    async getStatus() {
      this.loading.getStatus = true;
      this.error.getStatus = "";
      const taskAction = "get-status";
      const eventId = this.getUuid();

      // register to task error
      this.core.$root.$once(
        `${taskAction}-aborted-${eventId}`,
        this.getStatusAborted
      );

      // register to task completion
      this.core.$root.$once(
        `${taskAction}-completed-${eventId}`,
        this.getStatusCompleted
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
        this.error.getStatus = this.getErrorMessage(err);
        this.loading.getStatus = false;
        return;
      }
    },
    getStatusAborted(taskResult, taskContext) {
      console.error(`${taskContext.action} aborted`, taskResult);
      this.error.getStatus = this.$t("error.generic_error");
      this.loading.getStatus = false;
    },
    getStatusCompleted(taskContext, taskResult) {
      this.status = taskResult.output;
      // save status to vuex store: useful for first configuration modal
      this.setInstanceStatusInStore(this.status);
      this.loading.getStatus = false;
    },
    async listBackupRepositories() {
      this.loading.listBackupRepositories = true;
      this.error.listBackupRepositories = "";
      const taskAction = "list-backup-repositories";
      const eventId = this.getUuid();

      // register to task error
      this.core.$root.$once(
        `${taskAction}-aborted-${eventId}`,
        this.listBackupRepositoriesAborted
      );

      // register to task completion
      this.core.$root.$once(
        `${taskAction}-completed-${eventId}`,
        this.listBackupRepositoriesCompleted
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
        this.error.listBackupRepositories = this.getErrorMessage(err);
        this.loading.listBackupRepositories = false;
        return;
      }
    },
    listBackupRepositoriesAborted(taskResult, taskContext) {
      console.error(`${taskContext.action} aborted`, taskResult);
      this.error.listBackupRepositories = this.$t("error.generic_error");
      this.loading.listBackupRepositories = false;
    },
    listBackupRepositoriesCompleted(taskContext, taskResult) {
      let backupRepositories = taskResult.output.repositories.sort(
        this.sortByProperty("name")
      );
      this.backupRepositories = backupRepositories;
      this.loading.listBackupRepositories = false;
      this.listBackups();
    },
    async listBackups() {
      this.loading.listBackups = true;
      this.error.listBackups = "";
      const taskAction = "list-backups";
      const eventId = this.getUuid();

      // register to task error
      this.core.$root.$once(
        `${taskAction}-aborted-${eventId}`,
        this.listBackupsAborted
      );

      // register to task completion
      this.core.$root.$once(
        `${taskAction}-completed-${eventId}`,
        this.listBackupsCompleted
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
        this.error.listBackups = this.getErrorMessage(err);
        this.loading.listBackups = false;
        return;
      }
    },
    listBackupsAborted(taskResult, taskContext) {
      console.error(`${taskContext.action} aborted`, taskResult);
      this.error.listBackups = this.$t("error.generic_error");
      this.loading.listBackups = false;
    },
    listBackupsCompleted(taskContext, taskResult) {
      let backups = taskResult.output.backups;
      backups.sort(this.sortByProperty("name"));

      // get repository name
      for (const backup of backups) {
        const repo = this.backupRepositories.find(
          (r) => r.id == backup.repository
        );

        if (repo) {
          backup.repoName = repo.name;
        }
      }
      this.backups = backups;
      this.loading.listBackups = false;
    },
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
        this.createNodeTaskForApp(this.status.node, {
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
    },
    restartModuleAborted(taskResult, taskContext) {
      console.error(`${taskContext.action} aborted`, taskResult);
      this.error.restartModule = this.$t("error.generic_error");
      this.loading.restartModule = false;
    },
    restartModuleCompleted() {
      this.loading.restartModule = false;
    },
    goToNethvoiceWebapp() {
      window.open(`https://${this.configuration.nethvoice_host}`, "_blank");
    },
    goToCtiWebapp() {
      window.open(`https://${this.configuration.nethcti_ui_host}`, "_blank");
    },
  },
};
</script>

<style scoped lang="scss">
@import "../styles/carbon-utils";

.break-word {
  word-wrap: break-word;
  max-width: 30vw;
}
</style>
