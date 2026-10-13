<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute, useRouter, onBeforeRouteLeave } from "vue-router";
import { useQuery } from "@tanstack/vue-query";
import {
  NeTextInput,
  NeTextArea,
  NeButton,
  NeToggle,
  NeInlineNotification,
  NeSkeleton,
} from "@nethesis/vue-components";
import { useI18n } from "vue-i18n";
import { request, queryClient } from "../api";
import { useTask } from "../composables/useTask";
import { useUi } from "../stores/ui";
import PageHeader from "../components/PageHeader.vue";
import FieldSelect from "../components/FieldSelect.vue";
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
  enabled_tools: [],
  approved_destination_ids: [],
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
const unavailableTargets = computed(() =>
  catalog.data.value
    ? draft.value.approved_destination_ids.filter(
        (id) =>
          !catalog.data.value!.extensions.some(
            (extension) => extension.id === id,
          ),
      )
    : [],
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
function toggle(list: string[], key: string, enabled: boolean) {
  return enabled ? [...new Set([...list, key])] : list.filter((v) => v !== key);
}
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
    <div class="nv-field-grid">
      <NeTextInput v-model="name" :label="t('name')" required maxlength="100" />
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
      <NeTextInput
        v-model="draft.conversation.language"
        :label="t('language')"
        maxlength="5"
      />
      <NeTextInput
        v-model="draft.conversation.voice"
        :label="t('voiceName')"
        maxlength="128"
      />
      <FieldSelect
        :model-value="draft.fallback_destination_id || ''"
        :label="t('fallback')"
        :options="[
          { id: '', label: t('choose') },
          ...(catalog.data.value?.extensions || []).map((v) => ({
            id: v.id,
            label: v.name + ' (' + v.id.split(':')[1] + ')',
          })),
        ]"
        @update:model-value="draft.fallback_destination_id = $event || null"
      />
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
      <NeToggle
        v-for="tool in catalog.data.value?.tools || []"
        :key="tool.id"
        :model-value="draft.enabled_tools.includes(tool.id)"
        :label="t('toolNames.' + tool.id.replaceAll('.', '_'))"
        @update:model-value="
          draft.enabled_tools = toggle(draft.enabled_tools, tool.id, $event)
        "
      />
    </section>
    <section class="space-y-4">
      <h2>{{ t("approvedExtensions") }}</h2>
      <p class="nv-muted">{{ t("approvedExtensionsHelp") }}</p>
      <div
        v-for="target in unavailableTargets"
        :key="target"
        class="flex items-center gap-3"
      >
        <span>{{ target }} · {{ t("destinationUnavailable") }}</span>
        <NeButton
          kind="tertiary"
          @click="
            draft.approved_destination_ids = toggle(
              draft.approved_destination_ids,
              target,
              false,
            )
          "
          >{{ t("removeGrant") }}</NeButton
        >
      </div>
      <NeToggle
        v-for="extension in catalog.data.value?.extensions || []"
        :key="extension.id"
        :model-value="draft.approved_destination_ids.includes(extension.id)"
        :label="extension.name + ' (' + extension.id.split(':')[1] + ')'"
        @update:model-value="
          draft.approved_destination_ids = toggle(
            draft.approved_destination_ids,
            extension.id,
            $event,
          )
        "
      />
    </section>
    <p v-if="record" class="nv-muted">
      {{ t("publishedVersion") }}: {{ record.workflow_version || "—" }} ·
      {{ t(record.enabled ? "status.enabled" : "status.disabled") }}
    </p>
    <div class="nv-action-bar">
      <NeButton type="submit" kind="primary" :loading="task.pending.value">{{
        t("saveDraft")
      }}</NeButton>
      <NeButton
        v-if="record"
        :disabled="dirty || task.pending.value"
        @click="action('publish')"
        >{{ t("publish") }}</NeButton
      >
      <NeButton
        v-if="record"
        :disabled="dirty || task.pending.value"
        @click="action('enabled')"
        >{{ t(record.enabled ? "disable" : "activate") }}</NeButton
      >
      <RouterLink v-if="record" :to="'/activity?agent_id=' + record.agent_id"
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
