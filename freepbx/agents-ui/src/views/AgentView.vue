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
import type { Agent, Catalog, Draft, Trunk } from "../types";
const { t } = useI18n();
const route = useRoute(),
  router = useRouter(),
  task = useTask(),
  ui = useUi();
const id = computed(() => String(route.params.id || ""));
const creating = computed(() => !id.value);
const record = ref<Agent>();
const name = ref("");
const draft = ref<Draft>({
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
const snapshot = () => JSON.stringify({ name: name.value, draft: draft.value });
const dirty = computed(() => !!baseline.value && snapshot() !== baseline.value);
const unpublished = computed(() => {
  if (!record.value?.published) return false;
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
    !dirty.value &&
    !task.pending.value &&
    !record.value.legacy &&
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
const selectedTrunk = computed(() =>
  trunks.data.value?.items.find(
    (item) => item.binding_id === draft.value.provider_binding_id,
  ),
);
function addRecentCallbacks() {
  const defaults = catalog.data.value?.draft_defaults;
  if (draft.value.contract_version !== 6 || defaults?.contract_version !== 7)
    return;
  const transfer = draft.value.tool_bindings.find(
    (b) => b.tool_id === "pbx.transfer",
  );
  const latest = defaults.tool_bindings.find(
    (b) => b.tool_id === "pbx.transfer",
  );
  const lookup = defaults.tool_bindings.find(
    (b) => b.tool_id === "pbx.find_recent_callers",
  );
  if (!transfer || !latest || !lookup) return;
  transfer.tool_version = latest.tool_version;
  transfer.config = {
    ...JSON.parse(JSON.stringify(latest.config)),
    ...transfer.config,
  };
  draft.value.tool_bindings.push(JSON.parse(JSON.stringify(lookup)));
  draft.value.contract_version = 7;
}
function changeBinding(value: string) {
  const binding = value || null;
  if (binding === draft.value.provider_binding_id) return;
  draft.value.provider_binding_id = binding;
  draft.value.conversation.model = null;
  draft.value.conversation.options = null;
  draft.value.conversation.voice = "";
}
function accept(value: Agent) {
  record.value = value;
  name.value = value.name;
  draft.value = JSON.parse(JSON.stringify(value.draft));
  draft.value.debug ??= { transcription_enabled: false, retention_hours: 24 };
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
        profile: { name: name.value, draft: draft.value },
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
    :description="t('basicVoiceHelp')"
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
      v-if="record?.legacy"
      kind="warning"
      :title="t('legacyAgentHelp')"
    />
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
        record && record.sync_status !== 'synced' && record.workflow_version
      "
      kind="warning"
      :title="t('sync.' + record.sync_status)"
    />
    <NeButton
      v-if="
        record && record.sync_status !== 'synced' && record.workflow_version
      "
      :loading="task.pending.value"
      @click="synchronize"
      >{{ t("retrySync") }}</NeButton
    >
    <fieldset :disabled="record?.legacy" class="space-y-6">
      <div class="nv-field-grid">
        <NeTextInput
          v-model="name"
          :label="t('name')"
          required
          maxlength="100"
        />
        <FieldSelect
          :model-value="draft.provider_binding_id || ''"
          :label="t('trunk')"
          :options="[
            { id: '', label: t('choose') },
            ...(trunks.data.value?.items || []).map((v) => ({
              id: v.binding_id,
              label: v.name + ' (' + v.provider + ')',
            })),
          ]"
          @update:model-value="changeBinding"
        />
        <FieldSelect
          v-model="draft.conversation.language"
          :label="t('defaultLanguage')"
          :options="languageOptions"
        />
        <NeTextInput
          :model-value="String(draft.max_call_duration_seconds)"
          :label="t('maxDuration')"
          type="number"
          @update:model-value="draft.max_call_duration_seconds = Number($event)"
        />
      </div>
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
      <section class="space-y-4">
        <h2>{{ t("tools") }}</h2>
        <p class="nv-muted">{{ t("toolGrantsHelp") }}</p>
        <p v-if="(draft.contract_version || 0) >= 6" class="nv-muted">
          {{ t("routingPolicyHelp") }}
        </p>
        <NeButton
          v-if="
            draft.contract_version === 6 &&
            catalog.data.value?.draft_defaults.contract_version === 7
          "
          kind="secondary"
          @click="addRecentCallbacks"
          >{{ t("addRecentCallbacks") }}</NeButton
        >
        <p v-if="draft.contract_version === 7" class="nv-muted">
          {{ t("recentCallbacksHelp") }}
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
    </fieldset>
    <p v-if="record" class="nv-muted">
      {{ t("publishedVersion") }}: {{ record.workflow_version || "—" }}<br />
      {{ t("draftVersion") }}:
      {{ record.draft_version ?? (record.workflow_version || 0) + 1 }}
    </p>
    <div class="nv-action-bar">
      <NeButton
        type="submit"
        :kind="dirty || creating ? 'primary' : 'secondary'"
        :disabled="!dirty || task.pending.value || record?.legacy"
        :loading="task.pending.value"
        >{{ t("saveDraft") }}</NeButton
      >
      <NeButton
        v-if="record"
        :disabled="!canPublish"
        :kind="canPublish ? 'primary' : 'secondary'"
        @click="publish"
        >{{ t("publish") }}</NeButton
      >
      <RouterLink v-if="record" :to="'/activity?agent_id=' + record.agent_id"
        ><NeButton>{{ t("activity") }}</NeButton></RouterLink
      >
      <NeButton
        v-if="record?.kind === 'custom' || record?.legacy"
        kind="tertiary"
        :disabled="task.pending.value"
        @click="remove"
        >{{ t("delete") }}</NeButton
      >
    </div>
  </form>
</template>
