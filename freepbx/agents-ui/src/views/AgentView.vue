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
} from "@nethesis/vue-components";
import { useI18n } from "vue-i18n";
import { request, queryClient } from "../api";
import { useTask } from "../composables/useTask";
import { useUi } from "../stores/ui";
import PageHeader from "../components/PageHeader.vue";
import FieldSelect from "../components/FieldSelect.vue";
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
  conversation: { language: "en", voice: "", greeting: "", instructions: "" },
  tool_bindings: [],
  fallback_destination_id: null,
  max_call_duration_seconds: 600,
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
      JSON.stringify(published[key as keyof Draft]),
  );
});
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
const voices = useQuery({
  queryKey: [
    "provider-voices",
    computed(() => draft.value.provider_binding_id),
  ],
  enabled: computed(() => !!draft.value.provider_binding_id),
  queryFn: () =>
    request<{ items: { id: string; label: string }[] }>(
      "GET",
      "/trunks/" +
        encodeURIComponent(draft.value.provider_binding_id!) +
        "/voices",
    ),
});
watch(
  () => catalog.data.value,
  (value) => {
    if (value && creating.value) {
      const pristine = snapshot() === baseline.value;
      if (pristine) draft.value.conversation.language = value.default_language;
      if (!draft.value.tool_bindings.length)
        draft.value.tool_bindings = value.tools.map((tool) => ({
          tool_id: tool.id,
          tool_version: tool.version,
          enabled: false,
          config: JSON.parse(JSON.stringify(tool.defaults)),
        }));
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
const voiceOptions = computed(() => {
  const options = voices.data.value?.items || [];
  const selected = draft.value.conversation.voice;
  return [
    { id: "", label: t("choose") },
    ...options,
    ...(selected && !options.some((v) => v.id === selected)
      ? [{ id: selected, label: selected }]
      : []),
  ];
});
function accept(value: Agent) {
  record.value = value;
  name.value = value.name;
  draft.value = JSON.parse(JSON.stringify(value.draft));
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
    await queryClient.invalidateQueries({ queryKey: ["agents"] });
    if (creating.value) await router.replace("/agents/" + value.agent_id);
  });
}
async function action(kind: "publish" | "enabled") {
  await task.run(async () => {
    if (!record.value) return;
    const value = await request<Agent>(
      "POST",
      "/profiles/" + encodeURIComponent(id.value) + "/" + kind,
      {
        expected_revision: record.value.revision,
        ...(kind === "enabled" ? { enabled: !record.value.enabled } : {}),
      },
    );
    accept(value);
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
          @update:model-value="draft.provider_binding_id = $event || null"
        />
        <FieldSelect
          v-model="draft.conversation.language"
          :label="t('defaultLanguage')"
          :options="languageOptions"
        />
        <FieldSelect
          v-model="draft.conversation.voice"
          :label="t('voiceName')"
          :options="voiceOptions"
          :disabled="!draft.provider_binding_id || voices.isPending.value"
        />
        <NeInlineNotification
          v-if="voices.isError.value"
          kind="error"
          :title="t('voiceCatalogError')"
        />
        <NeButton
          v-if="voices.isError.value"
          kind="tertiary"
          @click="voices.refetch()"
          >{{ t("retry") }}</NeButton
        >
        <NeTextInput
          :model-value="String(draft.max_call_duration_seconds)"
          :label="t('maxDuration')"
          type="number"
          @update:model-value="draft.max_call_duration_seconds = Number($event)"
        />
      </div>
      <RouterLink to="/trunks" class="text-primary-700 dark:text-primary-400"
        >{{ t("manageTrunks") }} →</RouterLink
      >
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
        <ToolConfiguration
          v-for="(binding, index) in draft.tool_bindings"
          :key="binding.tool_id"
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
    </fieldset>
    <p v-if="record" class="nv-muted">
      {{ t("publishedVersion") }}: {{ record.workflow_version || "—" }} ·
      {{ t(record.enabled ? "status.enabled" : "status.disabled") }}
    </p>
    <div class="nv-action-bar">
      <NeButton
        type="submit"
        kind="primary"
        :disabled="record?.legacy"
        :loading="task.pending.value"
        >{{ t("saveDraft") }}</NeButton
      >
      <NeButton
        v-if="record"
        :disabled="dirty || task.pending.value || record.legacy"
        @click="action('publish')"
        >{{ t("publish") }}</NeButton
      >
      <NeButton
        v-if="record"
        :disabled="
          dirty || task.pending.value || (record.legacy && !record.enabled)
        "
        @click="action('enabled')"
        >{{ t(record.enabled ? "disable" : "activate") }}</NeButton
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
