<script setup lang="ts">
import { computed, ref } from "vue";
import { useRoute } from "vue-router";
import { useQuery } from "@tanstack/vue-query";
import { NeButton, NeInlineNotification } from "@nethesis/vue-components";
import { useI18n } from "vue-i18n";
import { request } from "../api";
import PageHeader from "../components/PageHeader.vue";
import CatalogTable from "../components/CatalogTable.vue";
import type { Run } from "../types";
const { t } = useI18n(),
  route = useRoute(),
  page = ref(1);
const agentId = computed(() =>
  typeof route.query.agent_id === "string" ? route.query.agent_id : undefined,
);
const query = useQuery({
  queryKey: ["runs", page, agentId],
  queryFn: () =>
    request<{ items: Run[]; has_more: boolean }>("GET", "/runs", undefined, {
      page: page.value,
      ...(agentId.value ? { agent_id: agentId.value } : {}),
    }),
});
</script>
<template>
  <PageHeader :title="t('activity')" :description="t('activityHelp')"
    ><NeButton @click="query.refetch()">{{
      t("refresh")
    }}</NeButton></PageHeader
  >
  <NeInlineNotification
    v-if="query.isError.value"
    kind="error"
    :title="t('error.request_failed')"
  />
  <div class="nv-panel">
    <CatalogTable
      :rows="query.data.value?.items || []"
      :loading="query.isLoading.value"
      row-key="run_id"
      :search-keys="['agent_name', 'agent_id', 'run_id']"
      :columns="[
        { key: 'agent_name', label: t('agents') },
        { key: 'workflow_version', label: t('publishedVersion') },
        { key: 'started_at', label: t('startedAt') },
        { key: 'outcome', label: t('outcome') },
        { key: 'actions', label: t('actions') },
      ]"
    >
      <template #outcome="{ row }">{{
        t("runOutcomes." + row.outcome)
      }}</template>
      <template #actions="{ row }"
        ><RouterLink :to="'/activity/' + row.run_id"
          ><NeButton kind="tertiary">{{ t("open") }}</NeButton></RouterLink
        ></template
      >
    </CatalogTable>
    <div class="nv-action-bar mt-5">
      <NeButton :disabled="page === 1" @click="page--">{{
        t("previous")
      }}</NeButton
      ><span>{{ page }}</span
      ><NeButton :disabled="!query.data.value?.has_more" @click="page++">{{
        t("next")
      }}</NeButton>
    </div>
  </div>
</template>
