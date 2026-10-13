<script setup lang="ts">
import { computed } from "vue";
import { useQuery } from "@tanstack/vue-query";
import { NeButton, NeInlineNotification } from "@nethesis/vue-components";
import { useI18n } from "vue-i18n";
import { inventory } from "../api";
import PageHeader from "../components/PageHeader.vue";
import CatalogTable from "../components/CatalogTable.vue";
import StatusBadge from "../components/StatusBadge.vue";
const { t, locale } = useI18n();
const query = useQuery({ queryKey: ["inventory"], queryFn: inventory });
const rows = computed(() =>
  (query.data.value?.data_sources || []).map((s) => ({
    ...s,
    name: s.settings.name,
    format:
      s.settings.kind === "documents" ? t("documents") : s.settings.format,
    status: s.status || "draft",
  })),
);
function date(value: number) {
  return value ? new Date(value * 1000).toLocaleString(locale.value) : "—";
}
</script>
<template>
  <PageHeader :title="t('sources')" :description="t('sourceHelp')"
    ><RouterLink to="/sources/new"
      ><NeButton kind="primary">{{ t("newSource") }}</NeButton></RouterLink
    ></PageHeader
  ><NeInlineNotification
    v-if="query.isError.value"
    kind="error"
    :title="t('error.request_failed')"
    class="mb-6"
  />
  <div class="nv-panel">
    <CatalogTable
      :rows="rows"
      :loading="query.isLoading.value"
      row-key="resource_id"
      :columns="[
        { key: 'name', label: t('name') },
        { key: 'format', label: t('format') },
        { key: 'status', label: t('state') },
        { key: 'last_refresh', label: t('lastRefresh') },
        { key: 'actions', label: t('actions') },
      ]"
    >
      <template #name="{ row }"
        ><RouterLink
          :to="'/sources/' + row.resource_id"
          class="font-medium text-primary-700 dark:text-primary-400"
          >{{ row.name }}</RouterLink
        ></template
      ><template #status="{ row }"
        ><StatusBadge
          :status="row.status"
          :version="row.published_version" /></template
      ><template #last_refresh="{ row }">{{ date(row.last_refresh) }}</template
      ><template #actions="{ row }"
        ><RouterLink :to="'/sources/' + row.resource_id"
          ><NeButton kind="tertiary">{{ t("open") }} →</NeButton></RouterLink
        ></template
      >
    </CatalogTable>
  </div>
</template>
