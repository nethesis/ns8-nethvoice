<script setup lang="ts">
import { ref } from "vue";
import { useQuery } from "@tanstack/vue-query";
import {
  NeButton,
  NeDropdown,
  NeInlineNotification,
  NeModal,
  NeTable,
  NeTableBody,
  NeTableCell,
  NeTableHead,
  NeTableHeadCell,
  NeTableRow,
} from "@nethesis/vue-components";
import { faNetworkWired, faTrash } from "@fortawesome/free-solid-svg-icons";
import { useI18n } from "vue-i18n";
import { request, queryClient } from "../api";
import { useTask } from "../composables/useTask";
import PageHeader from "../components/PageHeader.vue";
import AppEmptyState from "../components/AppEmptyState.vue";
import TrunkDrawer from "../components/TrunkDrawer.vue";
import { menuIcon } from "../menuIcon";
import StatusBadge from "../components/StatusBadge.vue";
import type { Agent, Trunk } from "../types";
const { t } = useI18n(),
  task = useTask();
const query = useQuery({
  queryKey: ["trunks"],
  queryFn: () => request<{ items: Trunk[] }>("GET", "/trunks"),
});
const agents = useQuery({
  queryKey: ["agents"],
  queryFn: () => request<{ items: Agent[] }>("GET", "/profiles"),
});
const editing = ref<Trunk>();
const visible = ref(false);
function open(trunk?: Trunk) {
  editing.value = trunk;
  visible.value = true;
}
const providers: Record<string, string> = {
  openai: "OpenAI",
  grok: "Grok",
  cleverai: "CleverAI",
};
function usage(trunk: Trunk) {
  return (agents.data.value?.items || []).filter(
    (agent) => agent.draft.provider_binding_id === trunk.binding_id,
  ).length;
}
function credentials(trunk: Trunk) {
  if (trunk.provider === "cleverai") return t("credentialSource.project");
  return t("credentialSource." + (trunk.api_key_source || "stored"));
}
const removing = ref<Trunk>();
function menu(trunk: Trunk) {
  return [
    {
      id: "delete",
      label: t("delete"),
      icon: menuIcon(faTrash),
      danger: true,
      action: () => {
        task.error.value = "";
        removing.value = trunk;
      },
    },
  ];
}
async function remove() {
  const trunk = removing.value;
  if (!trunk) return;
  await task.run(
    async () => {
      await request("DELETE", "/trunks/" + trunk.binding_id, {
        expected_revision: trunk.revision,
      });
      removing.value = undefined;
      await queryClient.invalidateQueries({ queryKey: ["trunks"] });
    },
    {
      title: t("trunkDeleted"),
      description: t("trunkDeletedHelp", { name: trunk.name }),
    },
  );
}
async function synchronize() {
  await task.run(async () => {
    await request("POST", "/synchronize", { retry: true });
    await queryClient.invalidateQueries({ queryKey: ["trunks"] });
  });
}
</script>
<template>
  <PageHeader :title="t('trunks')" :description="t('trunksHelp')"
    ><NeButton
      v-if="query.data.value?.items.length"
      kind="primary"
      size="lg"
      @click="open()"
      ><template #prefix
        ><FontAwesomeIcon icon="circle-plus" aria-hidden="true" /></template
      >{{ t("newTrunk") }}</NeButton
    ></PageHeader
  >
  <NeInlineNotification
    v-if="(task.error.value && !removing) || query.isError.value"
    kind="error"
    :title="task.error.value || t('error.request_failed')"
    class="mb-6"
  />
  <AppEmptyState
    v-if="query.isSuccess.value && !query.data.value?.items.length"
    :title="t('noTrunks')"
    :description="t('noTrunksHelp')"
    :icon="faNetworkWired"
    ><NeButton kind="primary" size="lg" @click="open()"
      ><template #prefix
        ><FontAwesomeIcon icon="circle-plus" aria-hidden="true" /></template
      >{{ t("newTrunk") }}</NeButton
    ></AppEmptyState
  >
  <NeTable
    v-else-if="!query.isError.value"
    :aria-label="t('trunks')"
    :loading="query.isLoading.value"
    :skeleton-columns="6"
    :skeleton-rows="3"
    card-breakpoint="xl"
  >
    <NeTableHead>
      <NeTableHeadCell>{{ t("name") }}</NeTableHeadCell>
      <NeTableHeadCell>{{ t("provider") }}</NeTableHeadCell>
      <NeTableHeadCell>{{ t("state") }}</NeTableHeadCell>
      <NeTableHeadCell>{{ t("credentials") }}</NeTableHeadCell>
      <NeTableHeadCell>{{ t("agents") }}</NeTableHeadCell>
      <NeTableHeadCell />
    </NeTableHead>
    <NeTableBody>
      <NeTableRow
        v-for="trunk in query.data.value?.items || []"
        :key="trunk.binding_id"
      >
        <NeTableCell :data-label="t('name')"
          ><div class="justify-self-start">
            <button
              type="button"
              class="cursor-pointer text-left font-medium hover:underline"
              @click="open(trunk)"
            >
              {{ trunk.name }}
            </button>
          </div></NeTableCell
        >
        <NeTableCell :data-label="t('provider')">{{
          providers[trunk.provider] || trunk.provider
        }}</NeTableCell>
        <NeTableCell :data-label="t('state')"
          ><div class="flex flex-col items-start gap-1">
            <StatusBadge :status="trunk.sync_status" /><NeButton
              v-if="trunk.sync_status !== 'synced'"
              kind="tertiary"
              size="sm"
              class="-ml-2.5 whitespace-nowrap"
              :loading="task.pending.value"
              @click="synchronize"
              ><template #prefix
                ><FontAwesomeIcon
                  icon="rotate-right"
                  aria-hidden="true" /></template
              >{{ t("retrySync") }}</NeButton
            >
          </div></NeTableCell
        >
        <NeTableCell :data-label="t('credentials')"
          ><span
            v-if="
              trunk.provider !== 'cleverai' &&
              trunk.api_key_source === 'missing'
            "
            class="flex items-center gap-2"
            ><FontAwesomeIcon
              icon="circle-xmark"
              class="size-4 shrink-0 text-rose-700 dark:text-rose-500"
              aria-hidden="true"
            />{{ credentials(trunk) }}</span
          ><template v-else>{{ credentials(trunk) }}</template></NeTableCell
        >
        <NeTableCell :data-label="t('agents')">{{ usage(trunk) }}</NeTableCell>
        <NeTableCell :data-label="t('actions')"
          ><div class="-ml-2.5 flex gap-2 xl:ml-0 xl:justify-end">
            <NeButton kind="tertiary" @click="open(trunk)"
              ><template #prefix
                ><FontAwesomeIcon
                  icon="pen-to-square"
                  class="size-4"
                  aria-hidden="true" /></template
              >{{ t("edit") }}</NeButton
            ><NeDropdown
              :items="menu(trunk)"
              align-to-right
              :open-menu-aria-label="t('openMenu')"
            /></div
        ></NeTableCell>
      </NeTableRow>
    </NeTableBody>
  </NeTable>
  <TrunkDrawer :is-shown="visible" :trunk="editing" @close="visible = false" />
  <NeModal
    :visible="!!removing"
    kind="warning"
    :title="t('deleteTrunk')"
    :primary-label="t('delete')"
    primary-button-kind="danger"
    :primary-button-loading="task.pending.value"
    :primary-button-disabled="task.pending.value"
    :cancel-label="t('cancel')"
    :close-aria-label="t('close')"
    @primary-click="remove"
    @close="removing = undefined"
  >
    <p>{{ t("deleteTrunkHelp", { name: removing?.name }) }}</p>
    <NeInlineNotification
      v-if="task.error.value"
      kind="error"
      :title="task.error.value"
      class="mt-4"
    />
  </NeModal>
</template>
