<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted } from "vue";
import {
  useRoute,
  useRouter,
  onBeforeRouteLeave,
  onBeforeRouteUpdate,
} from "vue-router";
import { useQuery } from "@tanstack/vue-query";
import {
  NeTextInput,
  NeTextArea,
  NeButton,
  NeInlineNotification,
  NeSkeleton,
  NeToggle,
  NeBadgeV2,
} from "@nethesis/vue-components";
import { useI18n } from "vue-i18n";
import { useLoadError } from "../composables/useLoadError";
import { request, queryClient, auth, errorCode } from "../api";
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
const loadError = useLoadError();
const route = useRoute(),
  router = useRouter(),
  task = useTask(),
  ui = useUi();
const id = computed(() => String(route.params.id || ""));
const record = ref<Agent>();
const agentId = computed(() => id.value || record.value?.agent_id || "");
const creating = computed(() => !agentId.value);
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
watch(
  agentType,
  (value) => {
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
  },
  { flush: "sync" },
);
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
const conflict = ref<Agent>();
const editKey = "nethvoice.agents.edit";
function rememberDraft() {
  if (dirty.value)
    sessionStorage.setItem(
      editKey,
      JSON.stringify({
        user: auth.user,
        path: route.path,
        revision: record.value?.revision ?? 0,
        type: agentType.value,
        name: name.value,
        draft: configuration.value,
      }),
    );
}
function recoverDraft() {
  const raw = sessionStorage.getItem(editKey);
  if (!raw) return;
  let saved;
  try {
    saved = JSON.parse(raw);
  } catch {
    sessionStorage.removeItem(editKey);
    return;
  }
  if (saved.user !== auth.user) {
    sessionStorage.removeItem(editKey);
    return;
  }
  if (saved.path !== route.path) return;
  sessionStorage.removeItem(editKey);
  if (record.value && record.value.revision !== saved.revision)
    conflict.value = record.value;
  agentType.value = saved.type;
  name.value = saved.name;
  if (external.value) externalConfig.value = saved.draft;
  else draft.value = saved.draft;
}
function warnUnload(event: BeforeUnloadEvent) {
  if (dirty.value) {
    event.preventDefault();
    event.returnValue = "";
  }
}
onMounted(() => {
  window.addEventListener("agents-auth-expired", rememberDraft);
  window.addEventListener("beforeunload", warnUnload);
});
onUnmounted(() => {
  window.removeEventListener("agents-auth-expired", rememberDraft);
  window.removeEventListener("beforeunload", warnUnload);
});
const errors = ref<Record<string, string>>({});
const agent = useQuery({
  queryKey: ["agent", id],
  enabled: computed(() => !!id.value),
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
      recoverDraft();
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
    if (
      value &&
      (!record.value ||
        (!dirty.value && value.revision > record.value.revision))
    ) {
      accept(value);
      recoverDraft();
    }
  },
  { immediate: true },
);
if (creating.value) baseline.value = snapshot();
const confirmNavigation = () => (dirty.value ? ui.confirmLeave() : true);
onBeforeRouteLeave(confirmNavigation);
onBeforeRouteUpdate((to, from) => to.path === from.path || confirmNavigation());
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
watch(
  () => draft.value.tool_bindings,
  () => {
    if (errors.value.lookback || errors.value.goodbye)
      errors.value = { ...errors.value, lookback: "", goodbye: "" };
  },
  { deep: true },
);
function validate(publishing: boolean) {
  const next: Record<string, string> = {};
  if (!name.value.trim()) next.name = t("agentForm.enterName");
  if (publishing && !configuration.value.provider_binding_id)
    next.trunk = t("agentForm.selectTrunk");
  if (!external.value) {
    const duration = draft.value.max_call_duration_seconds;
    if (!Number.isInteger(duration) || duration < 30 || duration > 3600)
      next.duration = t("durationRange");
    if (publishing && !draft.value.conversation.instructions.trim())
      next.instructions = t("requiredField");
    if (publishing && !draft.value.conversation.voice)
      next.voice = t("requiredField");
    if (publishing && !draft.value.conversation.model)
      next.model = t("requiredField");
  }
  if (!external.value && draft.value.conversation.model === "gpt-live-1") {
    const options = draft.value.conversation.options;
    const tokens = Number(options?.max_output_tokens);
    if (!Number.isInteger(tokens) || tokens < 16 || tokens > 8192)
      next.max_output_tokens = t("wholeNumberRange", { min: 16, max: 8192 });
    if (!String(options?.backend_instructions ?? "").trim())
      next.backend_instructions = t("requiredField");
  }
  for (const tool of draft.value.tool_bindings) {
    for (const [key, max] of [
      ["recent_caller_lookback_days", 90],
      ["playback_timeout_seconds", 10],
    ] as const) {
      const value = tool.config[key];
      if (
        value !== undefined &&
        (!Number.isInteger(value) || Number(value) < 1 || Number(value) > max)
      )
        next[key] = t("wholeNumberRange", { min: 1, max });
    }
  }
  const retention = draft.value.debug.retention_hours;
  if (
    !external.value &&
    draft.value.debug.transcription_enabled &&
    !(Number.isInteger(retention) && retention >= 1 && retention <= 24)
  )
    next.retention = t("agentForm.retentionRange");
  if (!external.value) {
    const range = (value: unknown, min: number, max: number) =>
      Number.isInteger(value) && Number(value) >= min && Number(value) <= max
        ? ""
        : t("agentForm.numberRange", { min, max });
    const tool = (toolId: string) =>
      draft.value.tool_bindings.find((b) => b.tool_id === toolId);
    const transfer = tool("pbx.transfer"),
      hangup = tool("telephony.hangup");
    const checks = {
      duration: range(draft.value.max_call_duration_seconds, 30, 3600),
      lookback:
        transfer?.enabled && transfer.config.recent_callers_enabled === true
          ? range(transfer.config.recent_caller_lookback_days, 1, 90)
          : "",
      goodbye: hangup?.enabled
        ? range(hangup.config.playback_timeout_seconds, 1, 10)
        : "",
    };
    for (const [key, message] of Object.entries(checks))
      if (message) next[key] = message;
  }
  errors.value = next;
  return !Object.keys(next).length;
}
const saving = ref<"" | "draft" | "publish">("");
const createUncertain = ref(false);
async function persist(): Promise<Agent> {
  if (conflict.value) throw new Error("revision_conflict");
  const wasCreating = creating.value;
  let value: Agent;
  try {
    value = await request<Agent>(
      wasCreating ? "POST" : "PUT",
      wasCreating
        ? "/profiles"
        : "/profiles/" + encodeURIComponent(agentId.value),
      {
        profile: { name: name.value.trim(), draft: configuration.value },
        expected_revision: record.value?.revision || 0,
      },
    );
  } catch (failure) {
    if (wasCreating && errorCode(failure) === "request_uncertain")
      createUncertain.value = true;
    if (errorCode(failure) === "revision_conflict" && agentId.value)
      conflict.value = await request<Agent>(
        "GET",
        "/profiles/" + encodeURIComponent(agentId.value),
      );
    throw failure;
  }
  accept(value);
  if (wasCreating) {
    ui.keepView = "/agents/" + value.agent_id;
    await router.replace(ui.keepView);
  }
  return value;
}
async function refreshLists() {
  await queryClient.invalidateQueries({ queryKey: ["destinations"] });
  await queryClient.invalidateQueries({ queryKey: ["agents"] });
}
async function save() {
  if (createUncertain.value || !validate(false)) return;
  const wasCreating = creating.value;
  saving.value = "draft";
  await task.run(
    async () => {
      await persist();
      await refreshLists();
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
  if (createUncertain.value || !canPublish.value || !validate(true)) return;
  saving.value = "publish";
  await task.run(
    async () => {
      let value = record.value;
      if (dirty.value || !value) value = await persist();
      try {
        value = await request<Agent>(
          "POST",
          "/profiles/" + encodeURIComponent(value.agent_id) + "/publish",
          { expected_revision: value.revision },
        );
      } catch (failure) {
        if (errorCode(failure) === "revision_conflict")
          conflict.value = await request<Agent>(
            "GET",
            "/profiles/" + value.agent_id,
          );
        throw failure;
      }
      accept(value);
      await refreshLists();
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
    conflict.value = undefined;
    accept(
      await request<Agent>(
        "GET",
        "/profiles/" + encodeURIComponent(agentId.value),
      ),
    );
  }, false);
}
async function synchronize() {
  await task.run(async () => {
    await request("POST", "/synchronize", { retry: true });
    accept(
      await request<Agent>(
        "GET",
        "/profiles/" + encodeURIComponent(agentId.value),
      ),
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
      :title="
        loadError(agent.error.value, catalog.error.value, trunks.error.value)
      "
      class="mb-6"
    />
    <form
      v-if="creating || record"
      class="flex max-w-2xl flex-col gap-10"
      novalidate
      @submit.prevent="save"
    >
      <section v-if="conflict" class="grid gap-3">
        <h3>{{ t("compareRevisions") }}</h3>
        <details>
          <summary>{{ t("savedRevision") }} {{ conflict.revision }}</summary>
          <pre class="overflow-auto whitespace-pre-wrap">{{
            JSON.stringify(
              { name: conflict.name, draft: conflict.draft },
              null,
              2,
            )
          }}</pre>
        </details>
        <details>
          <summary>{{ t("yourEdits") }}</summary>
          <pre class="overflow-auto whitespace-pre-wrap">{{
            JSON.stringify({ name, draft: configuration }, null, 2)
          }}</pre>
        </details>
        <NeButton
          kind="secondary"
          @click="
            record = conflict;
            conflict = undefined;
          "
          >{{ t("keepEdits") }}</NeButton
        >
      </section>
      <section
        v-if="!external && !record?.published"
        class="grid gap-1"
        :aria-label="t('publishReadiness')"
      >
        <h3>{{ t("publishReadiness") }}</h3>
        <ul class="list-inside list-disc">
          <li
            v-for="item in [
              [t('trunk'), !!draft.provider_binding_id],
              [t('voiceModel'), !!draft.conversation.model],
              [t('voiceName'), !!draft.conversation.voice],
              [t('instructions'), !!draft.conversation.instructions.trim()],
            ]"
            :key="String(item[0])"
          >
            {{ item[0] }} · {{ t(item[1] ? "status.ready" : "requiredField") }}
          </li>
        </ul>
      </section>
      <NeInlineNotification
        v-if="task.error.value || createUncertain"
        kind="error"
        :title="task.error.value || t('error.request_uncertain')"
        :description="
          creating && createUncertain
            ? t('agentForm.createUncertainHelp')
            : undefined
        "
        :primary-button-label="
          creating && createUncertain ? t('agentForm.openAgents') : undefined
        "
        @primary-click="router.push('/agents')"
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
        :kind="record.sync_status === 'error' ? 'error' : 'warning'"
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
          <div class="grid grid-cols-1 gap-6 lg:col-span-2 lg:grid-cols-2">
            <FieldCombobox
              v-if="creating"
              :model-value="agentType"
              :label="t('agentType')"
              :options="[
                { id: 'basic_voice', label: t('agentTypes.basic_voice') },
                { id: 'consultation', label: t('internalAssistant') },
                ...(catalog.data.value?.sip_lab_enabled
                  ? [{ id: 'cleverai', label: t('agentTypes.cleverai') }]
                  : []),
              ]"
              @update:model-value="agentType = $event || agentType"
            />
            <NeTextInput
              v-else
              :label="t('agentType')"
              :model-value="t('agentTypes.' + agentType)"
              readonly
              :helper-text="t('agentForm.typeLocked')"
            />
          </div>
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
              min="30"
              max="3600"
              :invalid-message="errors.duration"
              @update:model-value="
                draft.max_call_duration_seconds = Number($event);
                errors.duration = '';
              "
            />
          </template>
        </div>
      </SettingsSection>
      <template v-if="!external">
        <SettingsSection
          divider
          :title="t('conversationSettings')"
          :description="t('conversationSettingsHelp')"
        >
          <div class="grid grid-cols-1 gap-6">
            <ConversationSettings
              v-model="draft.conversation"
              :binding="selectedTrunk"
              :errors="errors"
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
              :invalid-message="errors.instructions"
              :label="t('instructions')"
              :helper-text="t('agentForm.instructionsHelp')"
              :rows="8"
              maxlength="32768"
            />
          </div>
        </SettingsSection>
        <SettingsSection
          v-if="!internal"
          divider
          :title="t('consultationSettings')"
          :description="t('consultationHelp')"
        >
          <div class="flex flex-col gap-6">
            <FieldCombobox
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
              <FieldCombobox
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
          </div>
        </SettingsSection>
        <SettingsSection
          v-else
          divider
          :title="t('internalAssistant')"
          :description="t('internalAssistantHelp')"
        >
          <NeTextInput
            :model-value="draft.chat_model || ''"
            :label="t('consultationChatModel')"
            maxlength="128"
            @update:model-value="
              draft.chat_model = String($event).trim() || null
            "
          />
          <p class="text-muted">{{ t("consultationChatModelHelp") }}</p>
        </SettingsSection>
        <SettingsSection
          v-if="!internal"
          divider
          :title="t('tools')"
          :description="t('toolGrantsHelp')"
        >
          <AgentTools v-model="draft.tool_bindings" :errors="errors" />
        </SettingsSection>
        <SettingsSection
          divider
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
          class="flex max-w-2xl flex-wrap items-center justify-between gap-4"
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
              :disabled="!!saving || createUncertain || (!dirty && !creating)"
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
              :disabled="!!saving || createUncertain || !canPublish"
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
