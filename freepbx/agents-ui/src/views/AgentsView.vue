<script setup lang="ts">
import { computed } from "vue";
import { useQuery } from "@tanstack/vue-query";
import { NeButton, NeInlineNotification } from "@nethesis/vue-components";
import { useI18n } from "vue-i18n";
import { request } from "../api";
import PageHeader from "../components/PageHeader.vue";
import CatalogTable from "../components/CatalogTable.vue";
import type { Agent } from "../types";
const { t } = useI18n();
const query = useQuery({
  queryKey: ["agents"],
  queryFn: () => request<{ items: Agent[] }>("GET", "/profiles"),
});
const rows = computed(() =>
  (query.data.value?.items || []).map((a) => ({
    ...a,
    status: a.workflow_version
      ? a.routable
        ? "published"
        : "pending"
      : "draft",
  })),
);
</script>
<template>
  <PageHeader :title="t('agents')" :description="t('agentsHelp')">
    <RouterLink to="/agents/new"
      ><NeButton kind="primary">{{ t("newAgent") }}</NeButton></RouterLink
    >
    <a href="/freepbx/visualplan/" target="_blank" rel="noopener"
      ><NeButton>{{ t("openVisualplan") }}</NeButton></a
    >
  </PageHeader>
  <NeInlineNotification
    v-if="query.isError.value"
    kind="error"
    :title="t('error.request_failed')"
  />
  <div class="nv-panel">
    <CatalogTable
      :rows="rows"
      :loading="query.isLoading.value"
      row-key="agent_id"
      :columns="[
        { key: 'name', label: t('name') },
        { key: 'status', label: t('state') },
        { key: 'workflow_version', label: t('publishedVersion') },
        { key: 'actions', label: t('actions') },
      ]"
    >
      <template #name="{ row }"
        ><RouterLink
          :to="'/agents/' + row.agent_id"
          class="font-medium text-primary-700 dark:text-primary-400"
          >{{ row.name }}</RouterLink
        >
        <p v-if="row.kind === 'builtin'" class="nv-muted text-xs">
          {{ t("builtin") }}
        </p></template
      >
      <template #status="{ row }">{{ t("status." + row.status) }}</template>
      <template #workflow_version="{ row }">{{
        row.workflow_version || "—"
      }}</template>
      <template #actions="{ row }"
        ><RouterLink :to="'/agents/' + row.agent_id"
          ><NeButton kind="tertiary">{{ t("open") }} →</NeButton></RouterLink
        ></template
      >
    </CatalogTable>
  </div>
</template>
