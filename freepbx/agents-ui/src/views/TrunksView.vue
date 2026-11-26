<script setup lang="ts">
import { computed, ref } from "vue";
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
import {
  faCirclePlus,
  faNetworkWired,
  faPenToSquare,
  faRotateRight,
  faTrash,
} from "@fortawesome/free-solid-svg-icons";
import { useI18n } from "vue-i18n";
import { useLoadError } from "../composables/useLoadError";
import { request, queryClient } from "../api";
import { useTask } from "../composables/useTask";
import PageHeader from "../components/PageHeader.vue";
import AppEmptyState from "../components/AppEmptyState.vue";
import TrunkDrawer from "../components/TrunkDrawer.vue";
import { menuIcon } from "../menuIcon";
import StatusBadge from "../components/StatusBadge.vue";
import type { Agent, Catalog, Trunk } from "../types";
const { t, te } = useI18n(),
  loadError = useLoadError(),
  task = useTask(),
  webhookTask = useTask();
const query = useQuery({
  queryKey: ["trunks"],
  queryFn: () => request<{ items: Trunk[] }>("GET", "/trunks"),
});
const catalog = useQuery({
  queryKey: ["catalog"],
  queryFn: () => request<Catalog>("GET", "/catalog"),
});
const agents = useQuery({
  queryKey: ["agents"],
  queryFn: () => request<{ items: Agent[] }>("GET", "/profiles"),
});
const removing = ref<Trunk>();
// Providers other than OpenAI and the SIP webhook exist only in the SIP lab.
const lab = computed(() => !!catalog.data.value?.sip_lab_enabled);
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
function supportsWebhook(trunk: Trunk) {
  if (!catalog.data.value?.sip_lab_enabled || trunk.provider !== "openai")
    return false;
  const snapshots = (agents.data.value?.items || [])
    .flatMap((agent) => [agent.draft, agent.published])
    .filter(
      (snapshot) =>
        snapshot?.provider_binding_id === trunk.binding_id &&
        "conversation" in snapshot &&
        snapshot.conversation.model !== null,
    );
  return (
    agents.isSuccess.value &&
    (!snapshots.length ||
      snapshots.some(
        (snapshot) =>
          snapshot &&
          "conversation" in snapshot &&
          snapshot.conversation.model !== "gpt-live-1",
      ))
  );
}
function webhookState(trunk: Trunk) {
  return (
    trunk.webhook_status ||
    (trunk.webhook_secret_configured ? "manual" : "not_configured")
  );
}
type WebhookCell = { label: string; status?: string; help?: string };
const webhookStatuses: Record<string, string> = {
  configured: "completed",
  verified: "completed",
  manual: "fallback",
  not_configured: "fallback",
  needs_setup: "fallback",
  recovery_required: "failed",
};
function webhookCell(trunk: Trunk): WebhookCell {
  if (trunk.provider === "grok")
    return { label: t("trunksPage.webhook.manualSetup") };
  if (trunk.provider === "cleverai")
    return { label: t("trunksPage.webhook.externalSetup") };
  // GPT-Live trunks without a project do not use the SIP webhook.
  if (!trunk.openai_project_id || !supportsWebhook(trunk))
    return { label: t("trunksPage.webhook.notRequired") };
  const state = webhookState(trunk);
  return {
    label: te("trunksPage.webhook." + state)
      ? t("trunksPage.webhook." + state)
      : state,
    status: webhookStatuses[state] || "unknown",
    help:
      state === "manual"
        ? t("trunksPage.webhook.manualHelp")
        : state === "recovery_required"
          ? t("error.webhook_secret_recovery_required")
          : "",
  };
}
const configuring = ref("");
function canConfigureWebhook(trunk: Trunk) {
  return (
    trunk.api_key_source !== "missing" &&
    ["not_configured", "needs_setup"].includes(webhookState(trunk))
  );
}
async function configureWebhook(trunk: Trunk) {
  configuring.value = trunk.binding_id;
  await webhookTask.run(
    async () => {
      try {
        await request(
          "POST",
          "/trunks/" + trunk.binding_id + "/configure-webhook",
          {
            expected_revision: trunk.revision,
          },
        );
      } finally {
        await queryClient.invalidateQueries({ queryKey: ["trunks"] });
      }
    },
    {
      title: t("webhook.configuredTitle"),
      description: t("webhook.configuredHelp", { name: trunk.name }),
    },
  );
  configuring.value = "";
}
function users(trunk: Trunk) {
  return (agents.data.value?.items || []).filter(
    (agent) =>
      agent.draft?.provider_binding_id === trunk.binding_id ||
      agent.published?.provider_binding_id === trunk.binding_id,
  );
}
const removingUsers = computed(() =>
  removing.value ? users(removing.value) : [],
);
function credentials(trunk: Trunk) {
  if (trunk.provider === "cleverai") return t("credentialSource.project");
  return t("credentialSource." + (trunk.api_key_source || "stored"));
}

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
  <PageHeader
    :title="t('trunks')"
    :description="lab ? t('trunksHelp') : t('trunksPage.descriptionOpenAi')"
    ><NeButton
      v-if="query.data.value?.items.length"
      kind="primary"
      size="lg"
      @click="open()"
      ><template #prefix
        ><FontAwesomeIcon :icon="faCirclePlus" aria-hidden="true" /></template
      >{{ t("newTrunk") }}</NeButton
    ></PageHeader
  >
  <NeInlineNotification
    v-if="(task.error.value && !removing) || query.isError.value"
    kind="error"
    :title="task.error.value || loadError(query.error.value)"
    class="mb-6 max-w-3xl"
  />
  <NeInlineNotification
    v-if="webhookTask.error.value"
    kind="error"
    :title="t('webhook.failedTitle')"
    :description="webhookTask.error.value"
    class="mb-6 max-w-3xl"
  />
  <AppEmptyState
    v-if="query.isSuccess.value && !query.data.value?.items.length"
    :title="t('noTrunks')"
    :description="lab ? t('noTrunksHelp') : t('trunksPage.emptyOpenAi')"
    :icon="faNetworkWired"
    ><NeButton kind="primary" size="lg" @click="open()"
      ><template #prefix
        ><FontAwesomeIcon :icon="faCirclePlus" aria-hidden="true" /></template
      >{{ t("newTrunk") }}</NeButton
    ></AppEmptyState
  >
  <NeTable
    v-else-if="!query.isError.value"
    :aria-label="t('trunks')"
    :loading="query.isLoading.value"
    :skeleton-columns="lab ? 7 : 6"
    :skeleton-rows="3"
    card-breakpoint="xl"
  >
    <NeTableHead>
      <NeTableHeadCell class="whitespace-nowrap">{{
        t("name")
      }}</NeTableHeadCell>
      <NeTableHeadCell class="whitespace-nowrap">{{
        t("provider")
      }}</NeTableHeadCell>
      <NeTableHeadCell class="whitespace-nowrap">{{
        t("state")
      }}</NeTableHeadCell>
      <NeTableHeadCell class="whitespace-nowrap">{{
        t("credentials")
      }}</NeTableHeadCell>
      <NeTableHeadCell v-if="lab" class="whitespace-nowrap">{{
        t("webhook.label")
      }}</NeTableHeadCell>
      <NeTableHeadCell class="whitespace-nowrap">{{
        t("agents")
      }}</NeTableHeadCell>
      <NeTableHeadCell
        ><span class="sr-only">{{ t("actions") }}</span></NeTableHeadCell
      >
    </NeTableHead>
    <NeTableBody>
      <NeTableRow
        v-for="trunk in query.data.value?.items || []"
        :key="trunk.binding_id"
      >
        <NeTableCell :data-label="t('name')"
          ><span class="text-primary-neutral">{{
            trunk.name
          }}</span></NeTableCell
        >
        <NeTableCell :data-label="t('provider')"
          ><span class="whitespace-nowrap">{{
            providers[trunk.provider] || trunk.provider
          }}</span></NeTableCell
        >
        <NeTableCell :data-label="t('state')"
          ><div class="flex flex-col items-start gap-1">
            <StatusBadge :status="trunk.sync_status" /><NeButton
              v-if="trunk.sync_status !== 'synced'"
              kind="tertiary"
              size="sm"
              class="-ml-2.5 text-left"
              :loading="task.pending.value"
              @click="synchronize"
              ><template #prefix
                ><FontAwesomeIcon
                  :icon="faRotateRight"
                  aria-hidden="true" /></template
              >{{ t("retrySync") }}</NeButton
            >
          </div></NeTableCell
        >
        <NeTableCell :data-label="t('credentials')"
          ><StatusBadge
            v-if="
              trunk.provider !== 'cleverai' &&
              trunk.api_key_source === 'missing'
            "
            status="failed"
            :label="credentials(trunk)"
          /><span v-else>{{ credentials(trunk) }}</span></NeTableCell
        >
        <NeTableCell v-if="lab" :data-label="t('webhook.label')">
          <div class="flex flex-col items-start gap-1">
            <StatusBadge
              v-if="webhookCell(trunk).status"
              :status="webhookCell(trunk).status!"
              :label="webhookCell(trunk).label"
            /><span v-else>{{ webhookCell(trunk).label }}</span>
            <span
              v-if="webhookCell(trunk).help"
              class="text-tertiary-neutral max-w-xs text-sm"
              >{{ webhookCell(trunk).help }}</span
            >
            <NeButton
              v-if="webhookCell(trunk).status && canConfigureWebhook(trunk)"
              kind="tertiary"
              size="sm"
              class="-ml-2.5 whitespace-nowrap"
              :loading="configuring === trunk.binding_id"
              :disabled="webhookTask.pending.value"
              @click="configureWebhook(trunk)"
            >
              {{ t("webhook.configure") }}
            </NeButton>
          </div>
        </NeTableCell>
        <NeTableCell :data-label="t('agents')">{{
          users(trunk).length
        }}</NeTableCell>
        <NeTableCell :data-label="t('actions')"
          ><div class="-ml-2.5 flex gap-2 xl:ml-0 xl:justify-end">
            <NeButton kind="tertiary" @click="open(trunk)"
              ><template #prefix
                ><FontAwesomeIcon
                  :icon="faPenToSquare"
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
    :primary-button-disabled="task.pending.value || !!removingUsers.length"
    :cancel-label="t('cancel')"
    :close-aria-label="t('close')"
    @primary-click="remove"
    @close="removing = undefined"
  >
    <p>{{ t("trunksPage.deleteHelp", { name: removing?.name }) }}</p>
    <NeInlineNotification
      v-if="removingUsers.length"
      data-testid="trunk-in-use"
      kind="warning"
      :description="
        t(
          'trunksPage.inUse',
          { names: removingUsers.map((agent) => agent.name).join(', ') },
          removingUsers.length,
        )
      "
      class="mt-4"
    />
    <NeInlineNotification
      v-if="task.error.value"
      kind="error"
      :title="task.error.value"
      class="mt-4"
    />
  </NeModal>
</template>
