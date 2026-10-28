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
} from "@nethesis/vue-components";
import { useI18n } from "vue-i18n";
import { request, queryClient } from "../api";
import { useTask } from "../composables/useTask";
import { useUi } from "../stores/ui";
import PageHeader from "../components/PageHeader.vue";
import FieldSelect from "../components/FieldSelect.vue";
import ConversationSettings from "../components/ConversationSettings.vue";
import ToolConfiguration from "../components/ToolConfiguration.vue";
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
const internal = computed(() => agentType.value === "consultation");
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
watch(agentType, (value) => {
  if (
    creating.value &&
    catalog.data.value &&
    (value === "consultation"
      ? catalog.data.value.consultation_defaults
      : catalog.data.value.draft_defaults)
  ) {
    draft.value = JSON.parse(
      JSON.stringify(
        value === "consultation"
          ? catalog.data.value.consultation_defaults
          : catalog.data.value.draft_defaults,
      ),
    );
    draft.value.conversation.language = catalog.data.value.default_language;
  }
});
function transferMode(mode: string) {
  if ((draft.value.consultation?.mode || "direct") === mode) return;
  draft.value.contract_version = 9;
  draft.value.role = "public";
  draft.value.chat_model = null;
  draft.value.consultation = {
    mode: mode === "attended" ? "attended" : "direct",
    phone: mode === "attended",
    chat: false,
    assistant_id: null,
  };
  for (const binding of draft.value.tool_bindings)
    if (binding.tool_id === "pbx.transfer") binding.tool_version = 3;
}
const snapshot = () =>
  JSON.stringify({ name: name.value, draft: configuration.value });
const dirty = computed(() => !!baseline.value && snapshot() !== baseline.value);
const unpublished = computed(() => {
  if (external.value || !record.value?.published) return false;
  const published = record.value.published;
  return Object.keys(draft.value).some(
    (key) =>
      JSON.stringify(draft.value[key as keyof Draft]) !==
      JSON.stringify(
        published[key as keyof Draft] ??
          (key === "debug"
            ? { transcription_enabled: false, retention_hours: 24 }
            : undefined),
      ),
  );
});
const canPublish = computed(
  () =>
    !!record.value &&
    !external.value &&
    !dirty.value &&
    !task.pending.value &&
    (!record.value.published ||
      (record.value.draft_version !== undefined
        ? record.value.draft_version !== record.value.workflow_version
        : unpublished.value)),
);
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
          JSON.stringify(
            internal.value ? value.consultation_defaults : value.draft_defaults,
          ),
        ) as Draft;
        draft.value = defaults;
        draft.value.conversation.language = value.default_language;
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
const selectedTrunk = computed(() =>
  trunks.data.value?.items.find(
    (item) => item.binding_id === draft.value.provider_binding_id,
  ),
);
function changeBinding(value: string) {
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
async function save() {
  await task.run(async () => {
    const value = await request<Agent>(
      creating.value ? "POST" : "PUT",
      creating.value
        ? "/profiles"
        : "/profiles/" + encodeURIComponent(id.value),
      {
        profile: { name: name.value, draft: configuration.value },
        expected_revision: record.value?.revision || 0,
      },
    );
    accept(value);
    await queryClient.invalidateQueries({ queryKey: ["destinations"] });
    await queryClient.invalidateQueries({ queryKey: ["agents"] });
    if (creating.value) await router.replace("/agents/" + value.agent_id);
  });
}
async function publish() {
  if (!canPublish.value) return;
  await task.run(async () => {
    if (!record.value) return;
    const value = await request<Agent>(
      "POST",
      "/profiles/" + encodeURIComponent(id.value) + "/publish",
      {
        expected_revision: record.value.revision,
      },
    );
    accept(value);
    await queryClient.invalidateQueries({ queryKey: ["destinations"] });
    await queryClient.invalidateQueries({ queryKey: ["agents"] });
  });
}
async function reload() {
  await task.run(async () => {
    accept(
      await request<Agent>("GET", "/profiles/" + encodeURIComponent(id.value)),
    );
  });
}
async function remove() {
  if (!record.value || !window.confirm(t("deleteAgentConfirm"))) return;
  await task.run(async () => {
    await request("DELETE", "/profiles/" + encodeURIComponent(id.value), {
      expected_revision: record.value!.revision,
    });
    baseline.value = snapshot();
    await queryClient.invalidateQueries({ queryKey: ["agents"] });
    await router.push("/agents");
  });
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
  <PageHeader
    :title="creating ? t('newAgent') : name"
    :description="t(external ? 'cleverAiAgentHelp' : 'basicVoiceHelp')"
    ><RouterLink to="/agents"
      ><NeButton>{{ t("back") }}</NeButton></RouterLink
    ></PageHeader
  >
  <NeSkeleton v-if="!creating && agent.isLoading.value" class="h-48" />
  <NeInlineNotification
    v-if="agent.isError.value || catalog.isError.value || trunks.isError.value"
    kind="error"
    :title="t('error.request_failed')"
  />
  <form
    v-if="creating || record"
    class="nv-panel space-y-6 max-w-5xl"
    @submit.prevent="save"
  >
    <p v-if="record?.kind === 'builtin'" class="nv-muted">{{ t("builtin") }}</p>
    <NeInlineNotification
      v-if="unpublished"
      kind="info"
      :title="t('unpublishedChanges')"
    />
    <NeInlineNotification
      v-if="task.error.value"
      kind="error"
      :title="task.error.value"
    />
    <NeButton v-if="task.error.value && !creating" @click="reload">{{
      t("reloadSaved")
    }}</NeButton>
    <NeInlineNotification
      v-if="
        record &&
        record.sync_status !== 'synced' &&
        (record.workflow_version || external)
      "
      kind="warning"
      :title="t('sync.' + record.sync_status)"
    />
    <NeButton
      v-if="
        record &&
        record.sync_status !== 'synced' &&
        (record.workflow_version || external)
      "
      :loading="task.pending.value"
      @click="synchronize"
      >{{ t("retrySync") }}</NeButton
    >
    <fieldset class="space-y-6">
      <FieldSelect
        v-model="agentType"
        :label="t('agentType')"
        :disabled="!!record"
        :options="[
          { id: 'basic_voice', label: 'Basic Voice' },
          { id: 'consultation', label: t('internalAssistant') },
          { id: 'cleverai', label: 'CleverAI' },
        ]"
      />
      <div class="nv-field-grid">
        <NeTextInput
          v-model="name"
          :label="t('name')"
          required
          maxlength="100"
        />
        <FieldSelect
          :model-value="configuration.provider_binding_id || ''"
          :label="t('trunk')"
          :options="[
            { id: '', label: t('choose') },
            ...(trunks.data.value?.items || [])
              .filter((v) => (v.provider === 'cleverai') === external)
              .map((v) => ({
                id: v.binding_id,
                label: v.name + ' (' + v.provider + ')',
              })),
          ]"
          @update:model-value="changeBinding"
        />
        <FieldSelect
          v-if="!external"
          v-model="draft.conversation.language"
          :label="t('defaultLanguage')"
          :options="languageOptions"
        />
        <NeTextInput
          v-if="!external"
          :model-value="String(draft.max_call_duration_seconds)"
          :label="t('maxDuration')"
          type="number"
          @update:model-value="draft.max_call_duration_seconds = Number($event)"
        />
      </div>
      <template v-if="!external">
        <ConversationSettings
          v-model="draft.conversation"
          :binding="selectedTrunk"
        />
        <NeTextArea
          v-model="draft.conversation.greeting"
          :label="t('greeting')"
          :rows="3"
          maxlength="4096"
        />
        <NeTextArea
          v-model="draft.conversation.instructions"
          :label="t('instructions')"
          :rows="6"
          maxlength="32768"
        />
        <section v-if="!internal" class="space-y-4">
          <h2>{{ t("consultationSettings") }}</h2>
          <p class="nv-muted">{{ t("consultationHelp") }}</p>
          <FieldSelect
            :model-value="draft.consultation?.mode || 'direct'"
            :label="t('peopleTransferMode')"
            :options="[
              { id: 'direct', label: t('directTransfer') },
              { id: 'attended', label: t('attendedTransfer') },
            ]"
            @update:model-value="transferMode"
          />
          <template v-if="draft.consultation?.mode === 'attended'">
            <NeToggle
              v-model="draft.consultation.phone"
              :label="t('allowPhoneConsultation')"
            />
            <NeToggle
              v-model="draft.consultation.chat"
              :label="t('allowChatConsultation')"
            />
            <FieldSelect
              :model-value="draft.consultation.assistant_id || ''"
              :label="t('internalAssistant')"
              :options="[
                { id: '', label: t('choose') },
                ...(catalog.data.value?.consultation_assistants || []).map(
                  (a) => ({ id: a.agent_id, label: a.name }),
                ),
              ]"
              @update:model-value="
                draft.consultation.assistant_id = $event || null
              "
            />
          </template>
        </section>
        <section v-else class="space-y-4">
          <p class="nv-muted">{{ t("internalAssistantHelp") }}</p>
          <NeTextInput
            :model-value="draft.chat_model || ''"
            :label="t('consultationChatModel')"
            maxlength="128"
            @update:model-value="
              draft.chat_model = String($event).trim() || null
            "
          />
          <p class="nv-muted">{{ t("consultationChatModelHelp") }}</p>
        </section>
        <section v-if="!internal" class="space-y-4">
          <h2>{{ t("tools") }}</h2>
          <p class="nv-muted">{{ t("toolGrantsHelp") }}</p>
          <p class="nv-muted">
            {{ t("routingPolicyHelp") }}
          </p>
          <p class="nv-muted">
            {{ t("recentCallbacksHelp") }}
          </p>
          <p class="nv-muted">
            {{ t("hangupToolHelp") }}
          </p>
          <ToolConfiguration
            v-for="(binding, index) in draft.tool_bindings"
            :key="binding.tool_id"
            :agent-id="record?.agent_id"
            :model-value="binding"
            :definition="
              catalog.data.value?.tools.find(
                (tool) =>
                  tool.id === binding.tool_id &&
                  tool.version === binding.tool_version,
              )
            "
            :extensions="catalog.data.value?.extensions || []"
            @update:model-value="draft.tool_bindings[index] = $event"
          />
        </section>
        <section class="space-y-4">
          <h2>{{ t("debugSettings") }}</h2>
          <NeToggle
            v-model="draft.debug.transcription_enabled"
            :label="t('debugTranscription')"
          />
          <p class="nv-muted">{{ t("debugTranscriptionHelp") }}</p>
          <NeTextInput
            v-if="draft.debug.transcription_enabled"
            :model-value="String(draft.debug.retention_hours)"
            :label="t('transcriptRetention')"
            type="number"
            min="1"
            max="24"
            @update:model-value="draft.debug.retention_hours = Number($event)"
          />
        </section>
      </template>
    </fieldset>
    <p v-if="record && !external" class="nv-muted">
      {{ t("publishedVersion") }}: {{ record.workflow_version || "—" }}<br />
      {{ t("draftVersion") }}:
      {{ record.draft_version ?? (record.workflow_version || 0) + 1 }}
    </p>
    <div class="nv-action-bar">
      <NeButton
        type="submit"
        :kind="dirty || creating ? 'primary' : 'secondary'"
        :disabled="!dirty || task.pending.value"
        :loading="task.pending.value"
        >{{ t(external ? "saveExternal" : "saveDraft") }}</NeButton
      >
      <NeButton
        v-if="record && !external"
        :disabled="!canPublish"
        :kind="canPublish ? 'primary' : 'secondary'"
        @click="publish"
        >{{ t("publish") }}</NeButton
      >
      <RouterLink
        v-if="record && !external"
        :to="'/activity?agent_id=' + record.agent_id"
        ><NeButton>{{ t("activity") }}</NeButton></RouterLink
      >
      <NeButton
        v-if="record?.kind === 'custom'"
        kind="tertiary"
        :disabled="task.pending.value"
        @click="remove"
        >{{ t("delete") }}</NeButton
      >
    </div>
  </form>
</template>
