<script setup lang="ts">
import { computed, nextTick, ref, watch, onMounted, onUnmounted } from "vue";
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
  NeModal,
  NeSideDrawer,
} from "@nethesis/vue-components";
import { useI18n } from "vue-i18n";
import { useLoadError } from "../composables/useLoadError";
import {
  request,
  queryClient,
  auth,
  errorCode,
  errorDetails,
  draftRecoveryKey,
} from "../api";
import { useTask } from "../composables/useTask";
import { useUi } from "../stores/ui";
import { mergeAgentEdits, type AgentEdits } from "../agentEdits";
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
const { t, te } = useI18n();
const loadError = useLoadError();
const route = useRoute(),
  router = useRouter(),
  task = useTask(),
  ui = useUi();
const id = computed(() => String(route.params.id || ""));
const record = ref<Agent>();
const agentId = computed(() => id.value || record.value?.agent_id || "");
const creating = computed(() => !agentId.value);
const step = ref(0);
const cancelDialog = ref(false);
const name = ref("");
const agentType = ref("basic_voice");
const external = computed(() => agentType.value === "cleverai");
const internal = computed(() => agentType.value === "consultation");
const stepped = computed(
  () => creating.value && !external.value && !internal.value,
);
const steps = ["agentForm.stepGeneral", "agentForm.stepConversation", "tools"];
const drawerProps = computed(() =>
  stepped.value
    ? {
        isShown: true,
        title: t("newAgent"),
        closeAriaLabel: t("closeDrawer"),
        closeOnClickOutside: false,
      }
    : {},
);
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
if (creating.value) baseline.value = snapshot();
const dirty = computed(() => !!baseline.value && snapshot() !== baseline.value);
const conflict = ref<Agent>();
const createUncertain = ref(false);
let creatingRequest = false;
function rememberDraft(event: Event) {
  const rejected = (event as CustomEvent<{ createRejected: boolean }>).detail
    ?.createRejected;
  if (dirty.value)
    sessionStorage.setItem(
      draftRecoveryKey,
      JSON.stringify({
        user: auth.user,
        path: route.path,
        revision: record.value?.revision ?? 0,
        baseline: baseline.value,
        step: step.value,
        type: agentType.value,
        name: name.value,
        draft: configuration.value,
        createUncertain:
          createUncertain.value || (creatingRequest && !rejected),
      }),
    );
}
function recoverDraft() {
  const raw = sessionStorage.getItem(draftRecoveryKey);
  if (!raw) return;
  let saved;
  try {
    saved = JSON.parse(raw);
  } catch {
    sessionStorage.removeItem(draftRecoveryKey);
    return;
  }
  if (saved.user !== auth.user) {
    sessionStorage.removeItem(draftRecoveryKey);
    return;
  }
  if (saved.path !== route.path) return;
  sessionStorage.removeItem(draftRecoveryKey);
  bindingTouched.value = true;
  step.value =
    Number.isInteger(saved.step) && saved.step >= 0 && saved.step < steps.length
      ? saved.step
      : 0;
  createUncertain.value = saved.createUncertain === true;
  if (record.value && record.value.revision !== saved.revision) {
    conflict.value = record.value;
    if (typeof saved.baseline === "string") baseline.value = saved.baseline;
  }
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
const bindingTouched = ref(false);
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
  bindingTouched.value = true;
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
watch(
  [() => catalog.data.value, compatibleTrunks, stepped],
  () => {
    if (
      !stepped.value ||
      !catalog.data.value ||
      bindingTouched.value ||
      !trunks.data.value
    )
      return;
    const ready = compatibleTrunks.value.filter(
      (trunk) =>
        trunk.sync_status === "synced" &&
        trunk.native_ready !== false &&
        (trunk.api_key_configured ||
          catalog.data.value?.provider_credentials?.[trunk.provider]
            ?.environment_available),
    );
    if (ready.length !== 1 || draft.value.provider_binding_id) return;
    const original = JSON.parse(baseline.value) as AgentEdits;
    changeBinding(ready[0].binding_id);
    original.draft.provider_binding_id = ready[0].binding_id;
    baseline.value = JSON.stringify(original);
  },
  { immediate: true },
);
function applyDefaultModel(value: Draft["conversation"]) {
  const pristine = stepped.value && !dirty.value;
  draft.value.conversation = value;
  if (pristine) baseline.value = snapshot();
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
function validate(publishing: boolean, currentStep?: number) {
  const next: Record<string, string> = {};
  if (!name.value.trim()) next.name = t("agentForm.enterName");
  if (publishing && !configuration.value.provider_binding_id)
    next.trunk = t("agentForm.selectTrunk");
  else if (publishing && stepped.value && trunks.isSuccess.value) {
    const trunk = selectedTrunk.value;
    if (
      !trunk ||
      trunk.sync_status !== "synced" ||
      trunk.native_ready === false
    )
      next.trunk = t("error.trunk_not_ready");
    else if (
      !trunk.api_key_configured &&
      !catalog.data.value?.provider_credentials?.[trunk.provider]
        ?.environment_available
    )
      next.trunk = t("error.provider_credentials_unavailable");
  }
  if (!external.value) {
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
  errors.value = Object.fromEntries(
    Object.entries(next).filter(
      ([field]) =>
        currentStep === undefined || fieldStep(field) === currentStep,
    ),
  );
  if (Object.keys(errors.value).length) {
    revealErrors();
    return false;
  }
  return true;
}
function fieldStep(field: string) {
  if (["name", "trunk", "language", "duration"].includes(field)) return 0;
  if (["lookback", "goodbye", "assistant", "chatModel"].includes(field))
    return 2;
  return 1;
}
function revealErrors() {
  if (stepped.value) {
    const first = Math.min(...Object.keys(errors.value).map(fieldStep));
    step.value = first;
  }
  void nextTick(() => {
    const first = Array.from(
      document.querySelectorAll<HTMLElement>(
        "#agent-editor :is(input[aria-invalid='true'], textarea[aria-invalid='true'], [data-invalid-combobox] input)",
      ),
    ).find(
      (element) =>
        element.getClientRects().length && !element.matches(":disabled"),
    );
    first?.focus();
  });
}
const fields: Record<string, string> = {
  name: "name",
  "draft.provider_binding_id": "trunk",
  "draft.conversation.language": "language",
  "draft.conversation.model": "model",
  "draft.conversation.voice": "voice",
  "draft.conversation.instructions": "instructions",
  "draft.conversation.greeting": "greeting",
  "draft.consultation.assistant_id": "assistant",
  "draft.chat_model": "chatModel",
  "draft.max_call_duration_seconds": "duration",
  "draft.debug.retention_hours": "retention",
};
const optionFields = [
  "backend_model",
  "backend_instructions",
  "reasoning_effort",
  "verbosity",
  "service_tier",
  "max_output_tokens",
];
function showFieldError(error: unknown) {
  const { field } = errorDetails(error);
  const code = errorCode(error);
  if (typeof field !== "string" || code === "revision_conflict") return;
  const option = field.replace(/^draft\.conversation\.options\./, "");
  const control =
    fields[field] ||
    (field !== option && optionFields.includes(option) ? option : "");
  if (!control) return;
  errors.value = {
    [control]: te("error." + code)
      ? t("error." + code)
      : t("invalidAgentField"),
  };
  task.error.value = "";
  revealErrors();
}
function continueStep() {
  task.error.value = "";
  if (validate(true, step.value)) step.value++;
}
const saving = ref<"" | "draft" | "publish">("");
function mergeWith(latest: Agent) {
  const merged = mergeAgentEdits(
    JSON.parse(baseline.value) as AgentEdits,
    JSON.parse(snapshot()) as AgentEdits,
    latest,
  );
  accept(latest);
  name.value = merged.name;
  if ("execution" in merged.draft) externalConfig.value = merged.draft;
  else draft.value = merged.draft;
}
async function withRevision(
  operation: () => Promise<Agent>,
  retry = true,
): Promise<Agent> {
  try {
    return await operation();
  } catch (error) {
    if (errorCode(error) !== "revision_conflict" || !agentId.value) throw error;
    const latest = await request<Agent>(
      "GET",
      "/profiles/" + encodeURIComponent(agentId.value),
    );
    const details = errorDetails(error);
    if (
      retry &&
      details.current_revision === latest.revision &&
      details.field === "draft.fallback_destination_id"
    ) {
      mergeWith(latest);
      return withRevision(operation, false);
    }
    conflict.value = latest;
    throw error;
  }
}
async function persist(): Promise<Agent> {
  if (conflict.value) throw new Error("revision_conflict");
  const wasCreating = creating.value;
  let value: Agent;
  creatingRequest = wasCreating;
  try {
    value = await withRevision(() =>
      request<Agent>(
        wasCreating ? "POST" : "PUT",
        wasCreating
          ? "/profiles"
          : "/profiles/" + encodeURIComponent(agentId.value),
        {
          profile: { name: name.value.trim(), draft: configuration.value },
          expected_revision: record.value?.revision || 0,
        },
      ),
    );
  } catch (error) {
    if (wasCreating && errorCode(error) === "request_uncertain")
      createUncertain.value = true;
    throw error;
  } finally {
    creatingRequest = false;
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
  if (
    saving.value ||
    createUncertain.value ||
    conflict.value ||
    !validate(false)
  )
    return;
  const wasCreating = creating.value;
  saving.value = "draft";
  let failure: unknown;
  await task.run(
    async () => {
      try {
        await persist();
        await refreshLists();
      } catch (error) {
        failure = error;
        throw error;
      }
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
  showFieldError(failure);
}
async function publish() {
  if (
    saving.value ||
    createUncertain.value ||
    conflict.value ||
    !canPublish.value ||
    !validate(true)
  )
    return;
  saving.value = "publish";
  let failure: unknown;
  const value = await task.run(async () => {
    try {
      if (dirty.value || !record.value) await persist();
      const publishedAgent = await withRevision(() =>
        request<Agent>(
          "POST",
          "/profiles/" + encodeURIComponent(agentId.value) + "/publish",
          {
            expected_revision: record.value!.revision,
          },
        ),
      );
      accept(publishedAgent);
      await refreshLists();
      return publishedAgent;
    } catch (error) {
      failure = error;
      throw error;
    }
  }, false);
  saving.value = "";
  showFieldError(failure);
  if (!value || value.sync_status !== "synced") return;
  ui.notify(t("agentPublished"), t("agentPublishedHelp", { name: value.name }));
  await router.push("/agents");
}
async function saveMyChanges() {
  const latest = conflict.value;
  if (!latest || saving.value) return;
  mergeWith(latest);
  conflict.value = undefined;
  if (dirty.value) await save();
  else task.error.value = "";
}
function discardMyChanges() {
  if (!conflict.value) return;
  accept(conflict.value);
  conflict.value = undefined;
  errors.value = {};
  task.error.value = "";
}
function cancel() {
  if (saving.value) return;
  if (stepped.value && dirty.value && !createUncertain.value)
    cancelDialog.value = true;
  else void router.push("/agents");
}
function discardCreate() {
  cancelDialog.value = false;
  baseline.value = snapshot();
  void router.push("/agents");
}
async function saveFromCancel() {
  cancelDialog.value = false;
  await save();
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
      v-if="!stepped"
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
    <component
      :is="stepped ? NeSideDrawer : 'div'"
      v-bind="drawerProps"
      @close="cancel"
    >
      <form
        v-if="creating || record"
        id="agent-editor"
        class="flex max-w-2xl flex-col gap-10"
        novalidate
        @submit.prevent="
          stepped ? (step < 2 ? continueStep() : publish()) : save()
        "
      >
        <NeInlineNotification
          v-if="conflict"
          kind="warning"
          :title="t('error.revision_conflict')"
          :description="t('agentForm.conflictHelp')"
          :primary-button-label="t('agentForm.saveMyChanges')"
          :secondary-button-label="t('agentForm.discardMyChanges')"
          @primary-click="saveMyChanges"
          @secondary-click="discardMyChanges"
        />
        <nav v-if="stepped" :aria-label="t('agentForm.createSteps')">
          <ol class="flex flex-wrap gap-3 text-sm">
            <li
              v-for="(title, index) in steps"
              :key="title"
              :aria-current="step === index ? 'step' : undefined"
              :class="step === index ? 'font-medium' : 'text-muted'"
            >
              {{ t(title) }}
            </li>
          </ol>
        </nav>
        <NeInlineNotification
          v-if="
            stepped &&
            trunks.isSuccess.value &&
            !compatibleTrunks.length &&
            step === 0
          "
          kind="info"
          :title="t('agentForm.noTrunks')"
          :description="t('agentForm.noTrunksHelp')"
          :primary-button-label="t('newTrunk')"
          @primary-click="trunkDrawer = true"
        />
        <NeInlineNotification
          v-if="(!conflict && task.error.value) || createUncertain"
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
        />
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
        <fieldset :disabled="!!saving" class="contents">
          <SettingsSection
            v-show="!stepped || step === 0"
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
                :aria-invalid="errors.name ? true : undefined"
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
                  :invalid-message="errors.language"
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
                  :aria-invalid="errors.duration ? true : undefined"
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
              v-show="!stepped || step === 1"
              divider
              :title="t('conversationSettings')"
              :description="t('conversationSettingsHelp')"
            >
              <div class="grid grid-cols-1 gap-6">
                <ConversationSettings
                  v-model="draft.conversation"
                  :binding="selectedTrunk"
                  :errors="errors"
                  @default-model="applyDefaultModel"
                />
                <NeTextArea
                  v-model="draft.conversation.greeting"
                  :label="t('greeting')"
                  optional
                  :optional-label="t('optional')"
                  :invalid-message="errors.greeting"
                  :aria-invalid="errors.greeting ? true : undefined"
                  :helper-text="t('agentForm.greetingHelp')"
                  :rows="3"
                  maxlength="4096"
                />
                <NeTextArea
                  v-model="draft.conversation.instructions"
                  :invalid-message="errors.instructions"
                  :aria-invalid="errors.instructions ? true : undefined"
                  :label="t('instructions')"
                  :helper-text="t('agentForm.instructionsHelp')"
                  :rows="8"
                  maxlength="32768"
                />
              </div>
            </SettingsSection>
            <SettingsSection
              v-if="!internal"
              v-show="!stepped || step === 2"
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
                    :invalid-message="errors.assistant"
                    :options="[
                      { id: '', label: t('choose') },
                      ...(
                        catalog.data.value?.consultation_assistants || []
                      ).map((a) => ({ id: a.agent_id, label: a.name })),
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
                :invalid-message="errors.chatModel"
                :aria-invalid="errors.chatModel ? true : undefined"
                maxlength="128"
                @update:model-value="
                  draft.chat_model = String($event).trim() || null
                "
              />
              <p class="text-muted">{{ t("consultationChatModelHelp") }}</p>
            </SettingsSection>
            <SettingsSection
              v-if="!internal"
              v-show="!stepped || step === 2"
              divider
              :title="t('tools')"
              :description="t('toolGrantsHelp')"
            >
              <AgentTools v-model="draft.tool_bindings" :errors="errors" />
            </SettingsSection>
            <details
              v-if="!stepped"
              :open="errors.retention ? true : undefined"
              class="border-divider rounded-lg border p-4"
            >
              <summary class="cursor-pointer font-medium">
                {{ t("debugSettings") }}
              </summary>
              <p class="text-muted my-3">{{ t("agentForm.debugHelp") }}</p>
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
                    :aria-invalid="errors.retention ? true : undefined"
                    @update:model-value="
                      draft.debug.retention_hours = Number($event);
                      errors.retention = '';
                    "
                  />
                </div>
              </div>
            </details>
          </template>
        </fieldset>
        <div
          v-if="!stepped"
          class="bg-elevation-0 border-divider fixed right-0 bottom-0 left-0 z-10 border-t px-4 py-4 sm:px-8 lg:left-75"
        >
          <div
            class="flex max-w-2xl flex-wrap items-center justify-between gap-4"
          >
            <span class="text-muted">{{ footer }}</span>
            <div class="flex flex-wrap gap-3">
              <NeButton kind="tertiary" @click="cancel">{{
                t("cancel")
              }}</NeButton>
              <NeButton
                type="submit"
                :kind="external ? 'primary' : 'secondary'"
                :loading="saving === 'draft'"
                :disabled="
                  !!saving ||
                  !!conflict ||
                  createUncertain ||
                  (!dirty && !creating)
                "
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
                :disabled="
                  !!saving || !!conflict || createUncertain || !canPublish
                "
                @click="publish"
                ><template #prefix
                  ><FontAwesomeIcon icon="check" aria-hidden="true" /></template
                >{{ t("publish") }}</NeButton
              >
            </div>
          </div>
        </div>
        <div
          v-else
          class="border-divider flex flex-wrap justify-end gap-3 border-t pt-6"
        >
          <NeButton kind="tertiary" :disabled="!!saving" @click="cancel">{{
            t("cancel")
          }}</NeButton>
          <NeButton
            v-if="step > 0"
            kind="secondary"
            :disabled="!!saving"
            @click="step--"
            >{{ t("agentForm.previousStep") }}</NeButton
          >
          <NeButton
            type="submit"
            kind="primary"
            :loading="saving === 'publish'"
            :disabled="!!saving || createUncertain"
            >{{ t(step < 2 ? "agentForm.nextStep" : "publish") }}</NeButton
          >
        </div>
      </form>
    </component>
    <NeModal
      v-if="cancelDialog"
      visible
      kind="warning"
      :title="t('unsavedHint')"
      :primary-label="t('saveDraft')"
      :secondary-label="t('agentForm.discardChanges')"
      :cancel-label="t('agentForm.keepEditing')"
      :close-aria-label="t('close')"
      @primary-click="saveFromCancel"
      @secondary-click="discardCreate"
      @close="cancelDialog = false"
      ><p>{{ t("agentForm.unsavedCreateHelp") }}</p></NeModal
    >
    <TrunkDrawer
      :is-shown="trunkDrawer"
      @close="trunkDrawer = false"
      @saved="trunkCreated"
    />
  </div>
</template>
