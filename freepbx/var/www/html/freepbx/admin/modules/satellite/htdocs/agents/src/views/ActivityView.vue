<script setup lang="ts">
import { computed, ref } from "vue";
import { useQuery } from "@tanstack/vue-query";
import {
  NeButton,
  NeInlineNotification,
  NeCard,
} from "@nethesis/vue-components";
import { useI18n } from "vue-i18n";
import { inventory, workflow } from "../api";
import { useTask } from "../composables/useTask";
import PageHeader from "../components/PageHeader.vue";
import FieldSelect from "../components/FieldSelect.vue";
import CatalogTable from "../components/CatalogTable.vue";
import StatusBadge from "../components/StatusBadge.vue";
import type { JsonObject } from "../types";
const { t, locale } = useI18n();
const task = useTask();
const period = ref("1"),
  agent = ref(""),
  kind = ref(""),
  status = ref(""),
  additional = ref<JsonObject[]>([]);
const agents = useQuery({ queryKey: ["inventory"], queryFn: inventory });
function body(before?: string) {
  const now = Date.now() / 1000;
  return {
    since: now - Number(period.value) * 86400,
    until: now,
    agent_id: agent.value,
    kind: kind.value,
    status: status.value,
    before: before || "",
    limit: 50,
  };
}
const query = useQuery({
  queryKey: computed(() => [
    "activity",
    period.value,
    agent.value,
    kind.value,
    status.value,
  ]),
  queryFn: async () => {
    additional.value = [];
    next.value = "";
    return workflow("POST", "/activity", body());
  },
});
const rows = computed(() => [
  ...(query.data.value?.runs || []),
  ...additional.value,
]);
const next = ref("");
async function more() {
  await task.run(async () => {
    const result = await workflow(
      "POST",
      "/activity",
      body(next.value || query.data.value?.next_cursor),
    );
    additional.value.push(...result.runs);
    next.value = result.next_cursor || "";
  }, false);
}
const counts = computed(() => query.data.value?.counts || []);
const completed = computed(() =>
  counts.value
    .filter((r: JsonObject) => r.status === "completed")
    .reduce((sum: number, r: JsonObject) => sum + Number(r.count), 0),
);
const handedOff = computed(() =>
  counts.value
    .filter((r: JsonObject) => r.status === "handed_off")
    .reduce((sum: number, r: JsonObject) => sum + Number(r.count), 0),
);
const running = computed(() =>
  counts.value
    .filter((r: JsonObject) =>
      ["active", "running", "accepted"].includes(r.status),
    )
    .reduce((sum: number, r: JsonObject) => sum + Number(r.count), 0),
);
const columns = computed(() => [
  { key: "execution_kind", label: t("kind") },
  { key: "agent_id", label: t("agents") },
  { key: "status", label: t("outcome") },
  { key: "started", label: t("started") },
  { key: "actions", label: t("actions") },
]);
</script>
<template>
  <PageHeader :title="t('activity')" />
  <div class="nv-panel mb-6 grid gap-5 md:grid-cols-4">
    <FieldSelect
      v-model="period"
      :label="t('period')"
      :options="[
        { id: '1', label: t('day') },
        { id: '7', label: t('week') },
        { id: '30', label: t('month') },
      ]"
    /><FieldSelect
      v-model="agent"
      :label="t('agents')"
      :options="[
        { id: '', label: t('all') },
        ...(agents.data.value?.agents || []).map((a) => ({
          id: a.agent_id,
          label: a.name,
        })),
      ]"
    /><FieldSelect
      v-model="kind"
      :label="t('kind')"
      :options="[
        { id: '', label: t('all') },
        ...['voice', 'api', 'mock'].map((id) => ({ id, label: t(id) })),
      ]"
    /><FieldSelect
      v-model="status"
      :label="t('outcome')"
      :options="[
        { id: '', label: t('all') },
        ...[
          'completed',
          'handed_off',
          'failed',
          'fallback',
          'running',
          'interrupted',
        ].map((id) => ({ id, label: t('status.' + id) })),
      ]"
    />
  </div>
  <NeInlineNotification
    v-if="query.data.value?.history_available === false"
    kind="warning"
    :title="t('incompleteHistory')"
    class="mb-6"
  /><NeInlineNotification
    v-if="query.isError.value || task.error.value"
    kind="error"
    :title="task.error.value || t('error.request_failed')"
    class="mb-6"
  />
  <div v-if="query.data.value" class="mb-6 grid gap-6 md:grid-cols-3">
    <NeCard class="p-6"
      ><p class="text-3xl font-medium">{{ completed }}</p>
      <p class="nv-muted mt-2">{{ t("status.completed") }}</p></NeCard
    ><NeCard class="p-6"
      ><p class="text-3xl font-medium">{{ handedOff }}</p>
      <p class="nv-muted mt-2">{{ t("status.handed_off") }}</p></NeCard
    ><NeCard class="p-6"
      ><p class="text-3xl font-medium">{{ running }}</p>
      <p class="nv-muted mt-2">{{ t("status.active") }}</p></NeCard
    >
  </div>
  <div class="nv-panel">
    <CatalogTable
      :rows="rows"
      row-key="run_id"
      :loading="query.isLoading.value"
      :columns="columns"
      :search-keys="['agent_id', 'execution_kind', 'status']"
      ><template #execution_kind="{ row }">{{ t(row.execution_kind) }}</template
      ><template #agent_id="{ row }">{{
        agents.data.value?.agents.find((a) => a.agent_id === row.agent_id)
          ?.name || row.agent_id
      }}</template
      ><template #status="{ row }"
        ><StatusBadge :status="row.status" /></template
      ><template #started="{ row }">{{
        new Date(row.started * 1000).toLocaleString(locale)
      }}</template
      ><template #actions="{ row }"
        ><RouterLink
          :to="
            '/activity/' +
            row.run_id +
            '?kind=' +
            row.execution_kind +
            '&agent=' +
            row.agent_id
          "
          ><NeButton kind="tertiary">{{ t("open") }} →</NeButton></RouterLink
        ></template
      ></CatalogTable
    ><NeButton
      v-if="query.data.value?.next_cursor && (!additional.length || next)"
      class="mt-5"
      :loading="task.pending.value"
      @click="more"
      >{{ t("nextPage") }}</NeButton
    >
  </div>
</template>
