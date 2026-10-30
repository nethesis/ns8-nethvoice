<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { useQuery } from "@tanstack/vue-query";
import {
  NeBadgeV2,
  NeButton,
  NeDropdown,
  NeInlineNotification,
  NeModal,
  type NeDropdownItem,
} from "@nethesis/vue-components";
import { faChartLine, faTrash } from "@fortawesome/free-solid-svg-icons";
import { faAiSpark } from "../aiSpark";
import { useI18n } from "vue-i18n";
import { request, queryClient } from "../api";
import { useTask } from "../composables/useTask";
import { agentStatus } from "../agentStatus";
import PageHeader from "../components/PageHeader.vue";
import CatalogTable from "../components/CatalogTable.vue";
import AppEmptyState from "../components/AppEmptyState.vue";
import { menuIcon } from "../menuIcon";
import StatusBadge from "../components/StatusBadge.vue";
import type { Agent, JsonObject, Trunk } from "../types";
const { t } = useI18n();
const router = useRouter(),
  task = useTask();
const query = useQuery({
  queryKey: ["agents"],
  queryFn: () => request<{ items: Agent[] }>("GET", "/profiles"),
});
const trunks = useQuery({
  queryKey: ["trunks"],
  queryFn: () => request<{ items: Trunk[] }>("GET", "/trunks"),
});
const rows = computed(() =>
  (query.data.value?.items || []).map((a) => ({
    ...a,
    type: a.agent_type || "basic_voice",
    typeLabel: t("agentTypes." + (a.agent_type || "basic_voice")),
    trunk:
      trunks.data.value?.items.find(
        (item) => item.binding_id === a.draft.provider_binding_id,
      )?.name || "",
    status: agentStatus(a),
  })),
);
const filters = computed(() => [
  {
    key: "type",
    label: t("kind"),
    options: ["basic_voice", "cleverai"].map((id) => ({
      id,
      label: t("agentTypes." + id),
    })),
  },
  {
    key: "status",
    label: t("state"),
    options: ["published", "modified", "draft", "pending", "ready"].map(
      (id) => ({ id, label: t("status." + id) }),
    ),
  },
]);
function openVisualplan() {
  window.open("/freepbx/visualplan/", "_blank", "noopener");
}
const removing = ref<Agent>();
function menu(row: JsonObject): NeDropdownItem[] {
  const agent = row as unknown as Agent;
  const items: NeDropdownItem[] = [];
  if (agent.agent_type !== "cleverai")
    items.push({
      id: "activity",
      label: t("viewActivity"),
      icon: menuIcon(faChartLine),
      action: () => void router.push("/activity?agent_id=" + agent.agent_id),
    });
  if (agent.kind === "custom")
    items.push(...(items.length ? [{ id: "divider-1" }] : []), {
      id: "delete",
      label: t("delete"),
      icon: menuIcon(faTrash),
      danger: true,
      action: () => {
        task.error.value = "";
        removing.value = agent;
      },
    });
  return items;
}
async function remove() {
  const agent = removing.value;
  if (!agent) return;
  await task.run(
    async () => {
      await request(
        "DELETE",
        "/profiles/" + encodeURIComponent(agent.agent_id),
        {
          expected_revision: agent.revision,
        },
      );
      removing.value = undefined;
      await queryClient.invalidateQueries({ queryKey: ["agents"] });
    },
    {
      title: t("agentDeleted"),
      description: t("agentDeletedHelp", { name: agent.name }),
    },
  );
}
</script>
<template>
  <PageHeader :title="t('agents')" :description="t('agentsHelp')">
    <NeButton kind="secondary" size="lg" @click="openVisualplan"
      ><template #prefix
        ><FontAwesomeIcon
          icon="arrow-up-right-from-square"
          aria-hidden="true" /></template
      >{{ t("openVisualplan") }}</NeButton
    >
    <NeButton kind="primary" size="lg" @click="router.push('/agents/new')"
      ><template #prefix
        ><FontAwesomeIcon icon="circle-plus" aria-hidden="true" /></template
      >{{ t("newAgent") }}</NeButton
    >
  </PageHeader>
  <NeInlineNotification
    v-if="query.isError.value"
    kind="error"
    :title="t('error.request_failed')"
    class="mb-6"
  />
  <CatalogTable
    :rows="rows"
    :loading="query.isLoading.value"
    row-key="agent_id"
    :aria-label="t('agents')"
    :search-placeholder="t('filterAgents')"
    :filters="filters"
    :search-keys="['name', 'typeLabel', 'trunk', 'agent_id']"
    :columns="[
      { key: 'name', label: t('name') },
      { key: 'typeLabel', label: t('agentType') },
      { key: 'trunk', label: t('trunk') },
      { key: 'status', label: t('state') },
      { key: 'workflow_version', label: t('publishedVersion') },
      { key: 'actions', label: '' },
    ]"
  >
    <template #empty>
      <AppEmptyState
        v-if="!query.isError.value"
        :title="t('noAgents')"
        :description="t('noAgentsHelp')"
        :icon="faAiSpark"
      />
    </template>
    <template #name="{ row }"
      ><div class="flex flex-wrap items-center gap-2 justify-self-start">
        <RouterLink
          :to="'/agents/' + row.agent_id"
          class="text-left font-medium hover:underline"
          >{{ row.name }}</RouterLink
        ><NeBadgeV2
          v-if="row.kind === 'builtin'"
          kind="gray"
          class="whitespace-nowrap"
          >{{ t("builtin") }}</NeBadgeV2
        >
      </div></template
    >
    <template #trunk="{ row }">{{ row.trunk || t("notSelected") }}</template>
    <template #status="{ row }"
      ><StatusBadge :status="String(row.status)"
    /></template>
    <template #workflow_version="{ row }">{{
      row.workflow_version || "-"
    }}</template>
    <template #actions="{ row }"
      ><div class="-ml-2.5 flex gap-2 xl:ml-0 xl:justify-end">
        <NeButton
          kind="tertiary"
          @click="router.push('/agents/' + row.agent_id)"
          ><template #prefix
            ><FontAwesomeIcon
              icon="pen-to-square"
              class="size-4"
              aria-hidden="true" /></template
          >{{ t("edit") }}</NeButton
        ><NeDropdown
          v-if="menu(row).length"
          :items="menu(row)"
          align-to-right
          :open-menu-aria-label="t('openMenu')"
        /></div
    ></template>
  </CatalogTable>
  <NeModal
    :visible="!!removing"
    kind="warning"
    :title="t('deleteAgent')"
    :primary-label="t('delete')"
    primary-button-kind="danger"
    :primary-button-loading="task.pending.value"
    :primary-button-disabled="task.pending.value"
    :cancel-label="t('cancel')"
    :close-aria-label="t('close')"
    @primary-click="remove"
    @close="removing = undefined"
  >
    <p>{{ t("deleteAgentHelp", { name: removing?.name }) }}</p>
    <NeInlineNotification
      v-if="task.error.value"
      kind="error"
      :title="task.error.value"
      class="mt-4"
    />
  </NeModal>
</template>
