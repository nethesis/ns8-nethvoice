<script setup lang="ts">
import { computed } from "vue";
import { useQuery } from "@tanstack/vue-query";
import {
  NeButton,
  NeEmptyState,
  NeInlineNotification,
} from "@nethesis/vue-components";
import { useI18n } from "vue-i18n";
import { inventory } from "../api";
import PageHeader from "../components/PageHeader.vue";
import CatalogTable from "../components/CatalogTable.vue";
import StatusBadge from "../components/StatusBadge.vue";
const { t } = useI18n();
const query = useQuery({ queryKey: ["inventory"], queryFn: inventory });
const rows = computed(() =>
  (query.data.value?.agents || []).filter((a) => a.kind !== "subflow"),
);
</script>
<template>
  <PageHeader :title="t('agents')" :description="t('agentsHelp')"
    ><RouterLink to="/agents/new"
      ><NeButton kind="primary">{{ t("newAgent") }}</NeButton></RouterLink
    ><a href="/freepbx/visualplan/" target="_blank" rel="noopener"
      ><NeButton>{{ t("openVisualplan") }}</NeButton></a
    ></PageHeader
  >
  <NeInlineNotification
    v-if="query.isError.value"
    kind="error"
    :title="t('error.request_failed')"
    class="mb-6"
  />
  <div v-if="!query.isLoading.value && !rows.length" class="nv-panel">
    <NeEmptyState :title="t('noAgents')" :description="t('noAgentsHelp')"
      ><RouterLink to="/agents/new"
        ><NeButton kind="primary">{{ t("firstAgent") }}</NeButton></RouterLink
      ></NeEmptyState
    >
  </div>
  <div v-else class="nv-panel">
    <CatalogTable
      :rows="rows"
      :loading="query.isLoading.value"
      row-key="agent_id"
      :columns="[
        { key: 'name', label: t('name') },
        { key: 'entrypoints', label: t('channel') },
        { key: 'status', label: t('state') },
        { key: 'use', label: t('use') },
        { key: 'actions', label: t('actions') },
      ]"
    >
      <template #name="{ row }"
        ><RouterLink
          :to="'/agents/' + row.agent_id + '/general'"
          class="font-medium text-primary-700 dark:text-primary-400"
          >{{ row.name }}</RouterLink
        >
        <p v-if="row.kind === 'builtin'" class="nv-muted mt-1 text-xs">
          {{ t("builtin") }}
        </p></template
      >
      <template #entrypoints="{ row }">{{
        (row.entrypoints || []).map((channel: string) => t(channel)).join(" · ")
      }}</template>
      <template #status="{ row }"
        ><StatusBadge :status="row.status" :version="row.version"
      /></template>
      <template #use="{ row }">{{
        row.routing_usage?.length
          ? row.routing_usage.map((r: any) => r.name).join(" · ")
          : row.entrypoints.includes("api")
            ? t("apiAccess")
            : "—"
      }}</template>
      <template #actions="{ row }"
        ><RouterLink :to="'/agents/' + row.agent_id + '/general'"
          ><NeButton kind="tertiary">{{ t("open") }} →</NeButton></RouterLink
        ></template
      >
    </CatalogTable>
  </div>
</template>
