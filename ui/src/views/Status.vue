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
              <div class="card-rows">
                <div class="card-row">
                  <NsButton
                    v-if="configuration && configuration.nethvoice_host"
                    kind="ghost"
                    :icon="Launch20"
                    :disabled="!configuration || !configuration.nethvoice_host"
                    @click="goToNethvoiceWebapp"
                  >
                    {{ $t("status.open_nethvoice") }}
                  </NsButton>
                </div>
              </div>
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
              <div class="card-rows">
                <div class="card-row">
                  <NsButton
                    v-if="configuration && configuration.nethcti_ui_host"
                    kind="ghost"
                    :icon="Launch20"
                    :disabled="!configuration || !configuration.nethcti_ui_host"
                    @click="goToCtiWebapp"
                  >
                    {{ $t("status.open_nethvoice_cti") }}
                  </NsButton>
                </div>
              </div>
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
                    :loading="loading.restartModule"
                    :disabled="loading.restartModule"
                  >
                    {{ $t("status.restart_application") }}
                  </NsButton>
                </div>
              </div>
            </template>
          </NsInfoCard>
          <!-- nethvoice proxy -->
          <NsInfoCard
            light
            :title="proxyModuleId || $t('status.not_configured')"
            description="NethVoice Proxy"
            :icon="Application32"
            :loading="loading.getDefaults"
            class="min-height-card"
          >
            <template slot="content">
              <div class="card-rows">
                <div class="card-row">
                  <NsButton
                    kind="ghost"
                    :icon="ArrowRight20"
                    @click="goToAppPage(proxyModuleId, 'status')"
                  >
                    {{ $t("status.go_to_nethvoice_proxy") }}
                  </NsButton>
                </div>
              </div>
            </template>
          </NsInfoCard>
          <!-- account provider -->
          <NsInfoCard
            light
            :title="
              configuration && configuration.user_domain
                ? configuration.user_domain
                : $t('status.not_configured')
            "
            :description="$t('settings.user_domain')"
            :icon="Events32"
            :loading="!configuration"
            :wrapTitle="true"
            class="min-height-card"
          >
            <template slot="content">
              <div class="card-rows">
                <div class="card-row">
                  <NsButton
                    kind="ghost"
                    :icon="ArrowRight20"
                    @click="goToDomainsAndUsers"
                  >
                    {{ $t("status.go_to_domains_and_users") }}
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
          >
            <template slot="content">
              <div class="card-rows">
                <div class="card-row">
                  <NsButton
                    kind="ghost"
                    :icon="ArrowRight20"
                    @click="goToNodeDetails()"
                  >
                    {{ $t("status.go_to_node_details") }}
                  </NsButton>
                </div>
              </div>
            </template>
          </NsInfoCard>
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
        <h4>{{ $t("status.failed_services") }}</h4>
      </cv-column>
    </cv-row>
    <cv-row v-if="!loading.getStatus">
      <cv-column v-if="!status.services.length">
        <cv-tile light>
          <NsEmptyState :title="$t('status.no_services')"> </NsEmptyState>
        </cv-tile>
      </cv-column>
      <cv-column v-else-if="!failedServices.length">
        <cv-tile light>
          <NsEmptyState :title="$t('status.all_services_running')">
            <template #pictogram>
              <CircleCheckPictogram />
            </template>
          </NsEmptyState>
        </cv-tile>
      </cv-column>
      <cv-column v-else>
        <div
          class="
            card-grid
            grid-cols-1
            md:grid-cols-2
            xl:grid-cols-3
            3xl:grid-cols-4
          "
        >
          <NsSystemdServiceCard
            v-for="service in failedServices"
            :key="service.name"
            light
            class="min-height-card"
            :serviceName="service.name"
            :active="service.active"
            :failed="service.failed"
            :enabled="service.enabled"
            :icon="Cube32"
          />
        </div>
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
            <NsDataTable
              v-else
              :allRows="status.images"
              :columns="i18nImagesTableColumns"
              :rawColumns="imagesTableColumns"
              :sortable="true"
              :pageSizes="[5, 10, 25, 50, 100]"
              :overflow-menu="false"
              isSearchable
              :searchPlaceholder="$t('status.search_images')"
              :searchClearLabel="core.$t('common.clear_search')"
              :noSearchResultsLabel="core.$t('common.no_search_results')"
              :noSearchResultsDescription="
                core.$t('common.no_search_results_description')
              "
              :itemsPerPageLabel="core.$t('pagination.items_per_page')"
              :rangeOfTotalItemsLabel="
                core.$t('pagination.range_of_total_items')
              "
              :ofTotalPagesLabel="core.$t('pagination.of_total_pages')"
              :backwardText="core.$t('pagination.previous_page')"
              :forwardText="core.$t('pagination.next_page')"
              :pageNumberLabel="core.$t('pagination.page_number')"
              @updatePage="imagesTablePage = $event"
            >
              <template slot="data">
                <cv-data-table-row
                  v-for="(row, rowIndex) in imagesTablePage"
                  :key="`${rowIndex}`"
                  :value="`${rowIndex}`"
                >
                  <cv-data-table-cell>
                    <span>
                      {{ row.name }}
                    </span>
                  </cv-data-table-cell>
                  <cv-data-table-cell>
                    <span>{{ row.size }}</span>
                  </cv-data-table-cell>
                  <cv-data-table-cell>
                    <span>{{ row.created }}</span>
                  </cv-data-table-cell>
                </cv-data-table-row>
              </template>
            </NsDataTable>
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
            <NsDataTable
              v-else
              :allRows="status.volumes"
              :columns="i18nVolumesTableColumns"
              :rawColumns="volumesTableColumns"
              :sortable="true"
              :pageSizes="[5, 10, 25, 50, 100]"
              :overflow-menu="false"
              isSearchable
              :searchPlaceholder="$t('status.search_volumes')"
              :searchClearLabel="core.$t('common.clear_search')"
              :noSearchResultsLabel="core.$t('common.no_search_results')"
              :noSearchResultsDescription="
                core.$t('common.no_search_results_description')
              "
              :itemsPerPageLabel="core.$t('pagination.items_per_page')"
              :rangeOfTotalItemsLabel="
                core.$t('pagination.range_of_total_items')
              "
              :ofTotalPagesLabel="core.$t('pagination.of_total_pages')"
              :backwardText="core.$t('pagination.previous_page')"
              :forwardText="core.$t('pagination.next_page')"
              :pageNumberLabel="core.$t('pagination.page_number')"
              @updatePage="volumesTablePage = $event"
            >
              <template slot="data">
                <cv-data-table-row
                  v-for="(row, rowIndex) in volumesTablePage"
                  :key="`${rowIndex}`"
                  :value="`${rowIndex}`"
                >
                  <cv-data-table-cell>
                    <span>
                      {{ row.name }}
                    </span>
                  </cv-data-table-cell>
                  <cv-data-table-cell>
                    <span>{{ row.mount }}</span>
                  </cv-data-table-cell>
                  <cv-data-table-cell>
                    <span>{{ row.created }}</span>
                  </cv-data-table-cell>
                </cv-data-table-row>
              </template>
            </NsDataTable>
          </div>
          <cv-skeleton-text
            v-else
            :paragraph="true"
            :line-count="10"
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
      proxyModuleId: "",
      imagesTablePage: [],
      imagesTableColumns: ["name", "size", "created"],
      volumesTablePage: [],
      volumesTableColumns: ["name", "mount", "created"],
      loading: {
        getStatus: false,
        listBackupRepositories: false,
        listBackups: false,
        restartModule: false,
        getDefaults: false,
      },
      error: {
        getStatus: "",
        listBackupRepositories: "",
        listBackups: "",
        restartModule: "",
        getDefaults: "",
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
    i18nImagesTableColumns() {
      return this.imagesTableColumns.map((col) => {
        return this.$t(`status.${col}`);
      });
    },
    i18nVolumesTableColumns() {
      return this.volumesTableColumns.map((col) => {
        return this.$t(`status.${col}`);
      });
    },
    failedServices() {
      if (!this.status || !this.status.services) {
        return [];
      }
      return this.status.services.filter((service) => service.failed);
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
    this.getDefaults();
  },
  methods: {
    ...mapActions(["setInstanceStatusInStore", "setDefaultsInStore"]),
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
    async getDefaults() {
      this.loading.getDefaults = true;
      const taskAction = "get-defaults";
      const eventId = this.getUuid();

      // register to task error
      this.core.$root.$once(
        `${taskAction}-aborted-${eventId}`,
        this.getDefaultsAborted
      );

      // register to task completion
      this.core.$root.$once(
        `${taskAction}-completed-${eventId}`,
        this.getDefaultsCompleted
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
        this.error.getDefaults = this.getErrorMessage(err);
        this.loading.getDefaults = false;
        return;
      }
    },
    getDefaultsAborted(taskResult, taskContext) {
      console.error(`${taskContext.action} aborted`, taskResult);
      this.error.getDefaults = this.$t("error.generic_error");
      this.loading.getDefaults = false;
    },
    getDefaultsCompleted(taskContext, taskResult) {
      const defaults = taskResult.output;

      // save defaults to vuex store
      this.setDefaultsInStore(defaults);

      if (defaults.proxy_status.proxy_installed) {
        this.proxyModuleId = defaults.proxy_status.module_id;
      }
      this.loading.getDefaults = false;
    },
    goToDomainsAndUsers() {
      this.core.$router.push("/domains");
    },
    goToNodeDetails() {
      if (this.status && this.status.node) {
        this.core.$router.push(`/nodes/${this.status.node}`);
      }
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
