<script setup lang="ts">
import { computed } from "vue";
import { useQuery } from "@tanstack/vue-query";
import {
  NeButton,
  NeBadgeV2,
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
  (query.data.value?.tools || []).map((tool) => ({
    ...tool,
    name: tool.draft.name,
    kind: tool.draft.kind,
    status: tool.published_version ? "ready" : "draft",
    used: [
      ...new Set(
        (query.data.value?.dependencies || [])
          .filter((d) => d.kind === "tool" && d.resource_id === tool.tool_id)
          .map((d) => d.agent_id),
      ),
    ].length,
  })),
);
</script>
<template>
  <PageHeader :title="t('tools')" :description="t('toolsHelp')"
    ><RouterLink to="/tools/new"
      ><NeButton kind="primary">{{ t("newTool") }}</NeButton></RouterLink
    ><RouterLink to="/settings/connections"
      ><NeButton>{{ t("manageConnections") }}</NeButton></RouterLink
    ></PageHeader
  >
  <NeInlineNotification
    v-if="query.isError.value"
    kind="error"
    :title="t('error.request_failed')"
    class="mb-6"
  />
  <div class="nv-panel">
    <CatalogTable
      :rows="rows"
      row-key="tool_id"
      :loading="query.isLoading.value"
      :columns="[
        { key: 'name', label: t('name') },
        { key: 'kind', label: t('kind') },
        { key: 'status', label: t('state') },
        { key: 'used', label: t('use') },
        { key: 'actions', label: t('actions') },
      ]"
    >
      <template #name="{ row }"
        ><RouterLink
          :to="'/tools/' + row.tool_id"
          class="font-medium text-primary-700 dark:text-primary-400"
          >{{ row.name }}</RouterLink
        ></template
      >
      <template #kind="{ row }">{{ t(row.kind + "Tool") }}</template
      ><template #status="{ row }"
        ><StatusBadge :status="row.status" :version="row.published_version"
      /></template>
      <template #used="{ row }"
        ><NeBadgeV2 kind="gray"
          >{{ row.used }} {{ t("agents") }}</NeBadgeV2
        ></template
      >
      <template #actions="{ row }"
        ><RouterLink :to="'/tools/' + row.tool_id"
          ><NeButton kind="tertiary">{{ t("open") }} →</NeButton></RouterLink
        ></template
      >
    </CatalogTable>
    <div class="mt-6 border-t border-gray-200 pt-5 dark:border-gray-600">
      <RouterLink to="/workflows/new"
        ><NeButton>{{ t("newWorkflow") }}</NeButton></RouterLink
      >
      <div class="mt-4 flex flex-wrap gap-3">
        <RouterLink
          v-for="row in query.data.value?.agents.filter(
            (a) => a.kind === 'subflow',
          ) || []"
          :key="row.agent_id"
          :to="'/workflows/' + row.agent_id + '/workflow'"
          class="text-primary-700 dark:text-primary-400"
          >{{ row.name }} →</RouterLink
        >
      </div>
    </div>
  </div>
</template>
