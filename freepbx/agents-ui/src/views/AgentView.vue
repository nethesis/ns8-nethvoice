<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute, useRouter, onBeforeRouteLeave } from "vue-router";
import { useQuery } from "@tanstack/vue-query";
import {
  NeTextInput,
  NeTextArea,
  NeButton,
  NeInlineNotification,
  NeSkeleton,
  NeToggle,
  NeBadgeV2,
  NeRadioSelection,
} from "@nethesis/vue-components";
import { useI18n } from "vue-i18n";
import { request, queryClient } from "../api";
import { useTask } from "../composables/useTask";
import { useUi } from "../stores/ui";
import { agentStatus } from "../agentStatus";
import PageHeader from "../components/PageHeader.vue";
import SettingsSection from "../components/SettingsSection.vue";
import FieldCombobox from "../components/FieldCombobox.vue";
import ConversationSettings from "../components/ConversationSettings.vue";
import AgentTools from "../components/AgentTools.vue";
import TrunkDrawer from "../components/TrunkDrawer.vue";
import StatusBadge from "../components/StatusBadge.vue";
import type {
  Agent,
  Catalog,
  Draft,
  Trunk,
  CleverAiConfiguration,
} from "../types";
const { t } = useI18n();
const route = useRoute(),
  router = useRouter(),
  task = useTask(),
  ui = useUi();
const id = computed(() => String(route.params.id || ""));
const creating = computed(() => !id.value);
const record = ref<Agent>();
const name = ref("");
const agentType = ref("basic_voice");
const external = computed(() => agentType.value === "cleverai");
const externalConfig = ref<CleverAiConfiguration>({
  execution: "cleverai",
  provider_binding_id: null,
  fallback_destination_id: "hangup",
});
const configuration = computed(() =>
  external.value ? externalConfig.value : draft.value,
);
const draft = ref<Draft>({
  contract_version: 8,
  provider_binding_id: null,
  conversation: {
    language: "en",
    voice: "",
    greeting: "",
    instructions: "",
    model: null,
    options: null,
  },
  tool_bindings: [],
  fallback_destination_id: null,
  max_call_duration_seconds: 600,
  debug: { transcription_enabled: false, retention_hours: 24 },
});
const baseline = ref("");
const snapshot = () =>
  JSON.stringify({ name: name.value, draft: configuration.value });
const dirty = computed(() => !!baseline.value && snapshot() !== baseline.value);
const errors = ref<Record<string, string>>({});
const agent = useQuery({
  queryKey: ["agent", id],
  enabled: computed(() => !creating.value),
  queryFn: () =>
    request<Agent>("GET", "/profiles/" + encodeURIComponent(id.value)),
  refetchOnWindowFocus: false,
});
const catalog = useQuery({
  queryKey: ["catalog"],
  queryFn: () => request<Catalog>("GET", "/catalog"),
});
const trunks = useQuery({
  queryKey: ["trunks"],
  queryFn: () => request<{ items: Trunk[] }>("GET", "/trunks"),
});
watch(
  () => catalog.data.value,
  (value) => {
    if (value && creating.value) {
      const pristine = snapshot() === baseline.value;
      if (pristine) draft.value.conversation.language = value.default_language;
      if (!draft.value.tool_bindings.length && value.draft_defaults) {
        const defaults = JSON.parse(
          JSON.stringify(value.draft_defaults),
        ) as Draft;
        draft.value.tool_bindings = defaults.tool_bindings;
        draft.value.contract_version = defaults.contract_version;
      }
      if (pristine) baseline.value = snapshot();
    }
  },
  { immediate: true },
);
const languageOptions = computed(() => {
  const options = catalog.data.value?.languages || [];
  const selected = draft.value.conversation.language;
  return options.some((v) => v.id === selected)
    ? options
    : [...options, { id: selected, label: selected }];
});
const providers: Record<string, string> = {
  openai: "OpenAI",
  grok: "Grok",
  cleverai: "CleverAI",
};
const compatibleTrunks = computed(() =>
  (trunks.data.value?.items || []).filter(
    (v) => (v.provider === "cleverai") === external.value,
  ),
);
const trunkOptions = computed(() =>
  compatibleTrunks.value.map((v) => ({
    id: v.binding_id,
    label: v.name,
    description: providers[v.provider] || v.provider,
  })),
);
const selectedTrunk = computed(() =>
  trunks.data.value?.items.find(
    (item) => item.binding_id === draft.value.provider_binding_id,
  ),
);
function changeBinding(value: string) {
  errors.value.trunk = "";
  const binding = value || null;
  if (external.value) {
    externalConfig.value.provider_binding_id = binding;
    return;
  }
  if (binding === draft.value.provider_binding_id) return;
  draft.value.provider_binding_id = binding;
  draft.value.conversation.model = null;
  draft.value.conversation.options = null;
  draft.value.conversation.voice = "";
}
const trunkDrawer = ref(false);
function trunkCreated(trunk: Trunk) {
  if ((trunk.provider === "cleverai") === external.value)
    changeBinding(trunk.binding_id);
}
function accept(value: Agent) {
  record.value = value;
  name.value = value.name;
  agentType.value = value.agent_type || "basic_voice";
  if ("execution" in value.draft)
    externalConfig.value = JSON.parse(JSON.stringify(value.draft));
  else draft.value = JSON.parse(JSON.stringify(value.draft));
  baseline.value = snapshot();
  queryClient.setQueryData(["agent", value.agent_id], value);
}
watch(
  () => agent.data.value,
  (value) => {
    if (value && !record.value) accept(value);
  },
  { immediate: true },
);
if (creating.value) baseline.value = snapshot();
onBeforeRouteLeave(() => (dirty.value ? ui.confirmLeave() : true));
const status = computed(() =>
  record.value ? agentStatus(record.value) : "draft",
);
const published = computed(() => record.value?.workflow_version || 0);
const draftVersion = computed(
  () => record.value?.draft_version ?? published.value + 1,
);
const subtitle = computed(() => {
  if (external.value) return t("cleverAiAgentHelp");
  if (!record.value) return t("agentForm.createHelp");
  if (status.value === "draft")
    return t("agentForm.notPublished", { draft: draftVersion.value });
  if (status.value === "modified")
    return t("agentForm.modified", {
      published: published.value,
      draft: draftVersion.value,
    });
  return t("agentForm.published", { published: published.value });
});
const footer = computed(() => {
  const parts: string[] = [];
  if (!record.value) parts.push(t("agentForm.notSaved"));
  else if (!external.value) {
    if (status.value !== "published" && status.value !== "pending")
      parts.push(t("agentForm.draftVersion", { draft: draftVersion.value }));
    parts.push(
      published.value
        ? t("agentForm.publishedVersion", { published: published.value })
        : t("agentForm.unpublished"),
    );
  }
  if (record.value && dirty.value) parts.push(t("unsavedHint"));
  return parts.join(" · ");
});
const canPublish = computed(
  () =>
    !external.value &&
    !task.pending.value &&
    (dirty.value ||
      !record.value ||
      !record.value.workflow_version ||
      (record.value.draft_version != null &&
        record.value.draft_version !== record.value.workflow_version)),
);
function validate(publishing: boolean) {
  const next: Record<string, string> = {};
  if (!name.value.trim()) next.name = t("agentForm.enterName");
  if (publishing && !configuration.value.provider_binding_id)
    next.trunk = t("agentForm.selectTrunk");
  const retention = draft.value.debug.retention_hours;
  if (
    !external.value &&
    draft.value.debug.transcription_enabled &&
    !(retention >= 1 && retention <= 24)
  )
    next.retention = t("agentForm.retentionRange");
  errors.value = next;
  return !Object.keys(next).length;
}
const saving = ref<"" | "draft" | "publish">("");
async function persist(): Promise<Agent> {
  const value = await request<Agent>(
    creating.value ? "POST" : "PUT",
    creating.value ? "/profiles" : "/profiles/" + encodeURIComponent(id.value),
    {
      profile: { name: name.value.trim(), draft: configuration.value },
      expected_revision: record.value?.revision || 0,
    },
  );
  accept(value);
  return value;
}
async function refreshLists() {
  await queryClient.invalidateQueries({ queryKey: ["destinations"] });
  await queryClient.invalidateQueries({ queryKey: ["agents"] });
}
async function save() {
  if (!validate(false)) return;
  const wasCreating = creating.value;
  saving.value = "draft";
  await task.run(
    async () => {
      const value = await persist();
      await refreshLists();
      if (wasCreating) await router.replace("/agents/" + value.agent_id);
    },
    {
      title: t(
        wasCreating
          ? "agentCreated"
          : external.value
            ? "agentSaved"
            : "draftSaved",
      ),
      description: t(
        wasCreating
          ? "agentCreatedHelp"
          : external.value
            ? "agentSavedHelp"
            : "draftSavedHelp",
        { name: name.value.trim() },
      ),
    },
  );
  saving.value = "";
}
async function publish() {
  if (!canPublish.value || !validate(true)) return;
  const wasCreating = creating.value;
  saving.value = "publish";
  await task.run(
    async () => {
      let value = record.value;
      if (dirty.value || !value) value = await persist();
      value = await request<Agent>(
        "POST",
        "/profiles/" + encodeURIComponent(value.agent_id) + "/publish",
        { expected_revision: value.revision },
      );
      accept(value);
      await refreshLists();
      if (wasCreating) await router.replace("/agents/" + value.agent_id);
    },
    {
      title: t("agentPublished"),
      description: t("agentPublishedHelp", { name: name.value.trim() }),
    },
  );
  saving.value = "";
}
async function reload() {
  await task.run(async () => {
    accept(
      await request<Agent>("GET", "/profiles/" + encodeURIComponent(id.value)),
    );
  }, false);
}
async function synchronize() {
  await task.run(async () => {
    await request("POST", "/synchronize", { retry: true });
    accept(
      await request<Agent>("GET", "/profiles/" + encodeURIComponent(id.value)),
    );
  });
}
</script>
<template>
  <div class="pb-24">
    <PageHeader
      :title="creating ? t('newAgent') : name"
      :description="subtitle"
      back="/agents"
    >
      <template v-if="record" #badges
        ><NeBadgeV2 v-if="record.kind === 'builtin'" kind="gray">{{
          t("builtin")
        }}</NeBadgeV2
        ><StatusBadge :status="status"
      /></template>
      <template
        v-if="trunks.isSuccess.value && !compatibleTrunks.length"
        #notice
      >
        <NeInlineNotification
          kind="info"
          :title="t('agentForm.noTrunks')"
          :description="t('agentForm.noTrunksHelp')"
          :primary-button-label="t('newTrunk')"
          @primary-click="trunkDrawer = true"
        />
      </template>
    </PageHeader>
    <NeSkeleton v-if="!creating && agent.isLoading.value" :lines="10" />
    <NeInlineNotification
      v-if="
        agent.isError.value || catalog.isError.value || trunks.isError.value
      "
      kind="error"
      :title="t('error.request_failed')"
      class="mb-6"
    />
    <form
      v-if="creating || record"
      class="flex max-w-6xl flex-col gap-10"
      novalidate
      @submit.prevent="save"
    >
      <NeInlineNotification
        v-if="task.error.value"
        kind="error"
        :title="task.error.value"
        ><template v-if="!creating" #description
          ><NeButton
            kind="tertiary"
            size="sm"
            class="-ml-2.5"
            @click="reload"
            >{{ t("reloadSaved") }}</NeButton
          ></template
        ></NeInlineNotification
      >
      <NeInlineNotification
        v-if="
          record &&
          record.sync_status !== 'synced' &&
          (record.workflow_version || external)
        "
        kind="warning"
        :title="t('sync.' + record.sync_status)"
        ><template #description
          ><NeButton
            kind="tertiary"
            size="sm"
            class="-ml-2.5"
            :loading="task.pending.value"
            @click="synchronize"
            >{{ t("retrySync") }}</NeButton
          ></template
        ></NeInlineNotification
      >
      <NeInlineNotification
        v-if="status === 'modified'"
        kind="info"
        :title="t('agentForm.draftNotPublished')"
        :description="
          t('agentForm.draftNotPublishedHelp', { published: published })
        "
      />
      <SettingsSection
        :title="t('generalSettings')"
        :description="t('generalSettingsHelp')"
      >
        <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <NeRadioSelection
            v-if="creating"
            v-model="agentType"
            class="lg:col-span-2"
            :label="t('agentType')"
            name="agentType"
            :options="[
              { id: 'basic_voice', label: t('agentTypes.basic_voice') },
              { id: 'cleverai', label: t('agentTypes.cleverai') },
            ]"
          />
          <NeTextInput
            v-else
            class="lg:col-span-2"
            :label="t('agentType')"
            :model-value="t('agentTypes.' + agentType)"
            readonly
            :helper-text="t('agentForm.typeLocked')"
          />
          <NeTextInput
            v-model="name"
            :label="t('name')"
            :placeholder="t('agentForm.namePlaceholder')"
            maxlength="100"
            :invalid-message="errors.name"
            @update:model-value="errors.name = ''"
          />
          <FieldCombobox
            :model-value="configuration.provider_binding_id || ''"
            :label="t('trunk')"
            :options="trunkOptions"
            :placeholder="t('agentForm.trunkPlaceholder')"
            :disabled="!compatibleTrunks.length"
            :helper-text="t('agentForm.trunkHelp')"
            :invalid-message="errors.trunk"
            @update:model-value="changeBinding"
          />
          <template v-if="!external">
            <FieldCombobox
              v-model="draft.conversation.language"
              :label="t('defaultLanguage')"
              :options="languageOptions"
              :helper-text="t('agentForm.languageHelp')"
            />
            <NeTextInput
              :model-value="String(draft.max_call_duration_seconds)"
              :label="t('maxDuration')"
              :helper-text="t('agentForm.durationHelp')"
              type="number"
              @update:model-value="
                draft.max_call_duration_seconds = Number($event)
              "
            />
          </template>
        </div>
      </SettingsSection>
      <template v-if="!external">
        <SettingsSection
          :title="t('conversationSettings')"
          :description="t('conversationSettingsHelp')"
        >
          <div class="grid grid-cols-1 gap-6">
            <ConversationSettings
              v-model="draft.conversation"
              :binding="selectedTrunk"
            />
            <NeTextArea
              v-model="draft.conversation.greeting"
              :label="t('greeting')"
              :helper-text="t('agentForm.greetingHelp')"
              :rows="3"
              maxlength="4096"
            />
            <NeTextArea
              v-model="draft.conversation.instructions"
              :label="t('instructions')"
              :helper-text="t('agentForm.instructionsHelp')"
              :rows="8"
              maxlength="32768"
            />
          </div>
        </SettingsSection>
        <SettingsSection :title="t('tools')" :description="t('toolGrantsHelp')">
          <AgentTools v-model="draft.tool_bindings" />
        </SettingsSection>
        <SettingsSection
          :title="t('debugSettings')"
          :description="t('agentForm.debugHelp')"
        >
          <div class="flex flex-col gap-4">
            <div>
              <NeToggle
                v-model="draft.debug.transcription_enabled"
                :label="t('debugTranscription')"
              />
              <p class="text-muted mt-1 ml-14">
                {{ t("debugTranscriptionHelp") }}
              </p>
            </div>
            <div
              v-if="draft.debug.transcription_enabled"
              class="ml-14 max-w-xs"
            >
              <NeTextInput
                :model-value="String(draft.debug.retention_hours)"
                :label="t('transcriptRetention')"
                :helper-text="t('agentForm.retentionHelp')"
                type="number"
                min="1"
                max="24"
                :invalid-message="errors.retention"
                @update:model-value="
                  draft.debug.retention_hours = Number($event);
                  errors.retention = '';
                "
              />
            </div>
          </div>
        </SettingsSection>
      </template>
      <div
        class="bg-elevation-0 border-divider fixed right-0 bottom-0 left-0 z-10 border-t px-4 py-4 sm:px-8 lg:left-75"
      >
        <div
          class="flex max-w-6xl flex-wrap items-center justify-between gap-4"
        >
          <span class="text-muted">{{ footer }}</span>
          <div class="flex flex-wrap gap-3">
            <NeButton kind="tertiary" @click="router.push('/agents')">{{
              t("cancel")
            }}</NeButton>
            <NeButton
              type="submit"
              :kind="external ? 'primary' : 'secondary'"
              :loading="saving === 'draft'"
              :disabled="!!saving || (!dirty && !creating)"
              ><template #prefix
                ><FontAwesomeIcon
                  :icon="external ? 'check' : 'floppy-disk'"
                  aria-hidden="true" /></template
              >{{ t(external ? "saveExternal" : "saveDraft") }}</NeButton
            >
            <NeButton
              v-if="!external"
              kind="primary"
              :loading="saving === 'publish'"
              :disabled="!!saving || !canPublish"
              @click="publish"
              ><template #prefix
                ><FontAwesomeIcon icon="check" aria-hidden="true" /></template
              >{{ t("publish") }}</NeButton
            >
          </div>
        </div>
      </div>
    </form>
    <TrunkDrawer
      :is-shown="trunkDrawer"
      @close="trunkDrawer = false"
      @saved="trunkCreated"
    />
  </div>
</template>
