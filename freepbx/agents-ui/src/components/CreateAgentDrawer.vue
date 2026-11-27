<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import {
  NeButton,
  NeHeading,
  NeInlineNotification,
  NeSideDrawer,
  NeSkeleton,
  NeStepper,
} from "@nethesis/vue-components";
import { faArrowLeft, faArrowRight } from "@fortawesome/free-solid-svg-icons";
import {
  auth,
  draftRecoveryKey,
  errorCode,
  queryClient,
  request,
} from "../api";
import { useUi } from "../stores/ui";
import { useAgentForm } from "../composables/useAgentForm";
import { useSessionResume } from "../composables/useSessionResume";
import { stepOf, stepsFor, firstInvalid } from "../agentForm";
import { publishHandoff } from "../handoff";
import AgentGeneralFields from "./AgentGeneralFields.vue";
import AgentConversationFields from "./AgentConversationFields.vue";
import AgentTools from "./AgentTools.vue";
import UnsavedChangesModal from "./UnsavedChangesModal.vue";
import SessionExpiredModal from "./SessionExpiredModal.vue";
import type {
  Agent,
  Catalog,
  CleverAiConfiguration,
  Draft,
  Trunk,
} from "../types";
const props = defineProps<{
  isShown: boolean;
  initialType?: string;
  catalog?: Catalog;
  trunks?: Trunk[];
  agents?: Agent[];
}>();
const emit = defineEmits<{ close: [] }>();
const { t } = useI18n();
const router = useRouter();
const ui = useUi();
const form = useAgentForm(computed(() => props.catalog));
const sipLab = computed(() => props.catalog?.sip_lab_enabled === true);
// CleverAI agents need the SIP lab, like the server requires.
const types = computed(() =>
  ["basic_voice", "consultation", "cleverai"].filter(
    (id) =>
      (id !== "cleverai" || sipLab.value) &&
      (!props.catalog?.agent_types ||
        props.catalog.agent_types.some((item) => item.id === id)),
  ),
);
const steps = computed(() => stepsFor(form.agentType.value));
const step = ref(1);
const current = computed(() => steps.value[step.value - 1]);
const last = computed(() => step.value >= steps.value.length);
const body = ref<HTMLElement>();
const saving = ref<"" | "draft" | "publish">("");
const failure = ref("");
// A create whose result is unknown: the agent may exist already.
const uncertain = ref(false);

function compatibleTrunks() {
  return (props.trunks || []).filter(
    (item) => (item.provider === "cleverai") === form.isExternal.value,
  );
}
// With exactly one compatible trunk, the agent uses it.
function preselectTrunk() {
  const candidates = compatibleTrunks();
  if (candidates.length !== 1) return;
  if (form.isExternal.value)
    form.external.value.provider_binding_id = candidates[0].binding_id;
  else form.draft.value.provider_binding_id = candidates[0].binding_id;
}
function start(type: string) {
  form.reset(types.value.includes(type) ? type : "basic_voice");
  preselectTrunk();
  form.markSaved();
  step.value = 1;
  failure.value = "";
  uncertain.value = false;
}
function changeType(type: string) {
  if (type === form.agentType.value) return;
  const name = form.name.value;
  const binding = form.configuration.value.provider_binding_id;
  const baseline = form.baseline.value;
  form.reset(type);
  form.name.value = name;
  const candidates = compatibleTrunks();
  if (candidates.some((item) => item.binding_id === binding)) {
    if (form.isExternal.value)
      form.external.value.provider_binding_id = binding;
    else form.draft.value.provider_binding_id = binding;
  } else preselectTrunk();
  form.baseline.value = baseline;
}
watch(
  () => [props.isShown, !!props.catalog, !!props.trunks] as const,
  ([shown, catalog, trunks], previous) => {
    if (!shown || !catalog || !trunks) return;
    if (previous && previous[0] && previous[1] && previous[2]) return;
    start(props.initialType || "basic_voice");
    recover();
  },
  { immediate: true },
);
// The baseline is the empty form: any change counts as unsaved.
const dirty = computed(() => form.dirty.value);

async function focusErrors() {
  const key = firstInvalid(form.errors.value);
  const target = key && stepOf(key);
  if (target && steps.value.includes(target))
    step.value = steps.value.indexOf(target) + 1;
  await nextTick();
  await form.focusFirstError(body.value);
}
// Next checks the fields of the step with the rules of Publish, so that a
// required field blocks the step it belongs to. Publish checks every step
// and goes back to the step of the first error.
async function next() {
  if (!form.validate(true, [current.value])) {
    await focusErrors();
    return;
  }
  step.value++;
  await showStep();
}
async function previous() {
  form.errors.value = {};
  if (step.value > 1) step.value--;
  await showStep();
}
// A new step starts at the top of the drawer, with the focus on its title.
const heading = ref<HTMLElement>();
async function showStep() {
  await nextTick();
  body.value?.closest(".overflow-y-auto")?.scrollTo({ top: 0 });
  heading.value?.focus({ preventScroll: true });
}
const stepTitles: Record<string, string> = {
  general: "generalSettings",
  conversation: "conversationSettings",
  tools: "tools",
};

const errorText = (error: unknown) => form.errorMessage(error);
let creating = false;
async function create(): Promise<Agent> {
  creating = true;
  try {
    return await request<Agent>("POST", "/profiles", {
      profile: {
        name: form.name.value.trim(),
        draft: form.configuration.value,
      },
      expected_revision: 0,
    });
  } catch (error) {
    if (errorCode(error) === "request_uncertain") uncertain.value = true;
    throw error;
  } finally {
    creating = false;
  }
}
async function handleFailure(error: unknown, retry: () => unknown) {
  // A rejected session ends the authorization, whatever the error code.
  if (errorCode(error) === "authentication_required" || !auth.authorized) {
    if (!uncertain.value) session.interrupted(retry);
    else failure.value = t("error.request_uncertain");
    return;
  }
  if (form.serverError(error)) {
    await focusErrors();
    return;
  }
  failure.value = errorText(error);
}
function finish() {
  form.markSaved();
  emit("close");
}
/**
 * Saves the agent as a draft (or saves a CleverAI agent) and closes the
 * drawer, unless the Unsaved changes dialog closes it.
 */
async function saveDraft(fromDialog = false): Promise<boolean> {
  if (saving.value || uncertain.value) return false;
  failure.value = "";
  if (!form.validate(false)) {
    await focusErrors();
    return false;
  }
  saving.value = "draft";
  try {
    const agent = await create();
    await queryClient.invalidateQueries({ queryKey: ["agents"] });
    const external = form.isExternal.value;
    ui.notify(
      t(external ? "agentCreated" : "createWizard.savedAsDraft"),
      t(external ? "agentCreatedHelp" : "createWizard.savedAsDraftHelp", {
        name: agent.name,
      }),
    );
    form.markSaved();
    if (!fromDialog) emit("close");
    return true;
  } catch (error) {
    await handleFailure(error, () => saveDraft());
    return false;
  } finally {
    saving.value = "";
  }
}
/** Validates every step, creates the agent and publishes it. */
async function publish() {
  if (saving.value || uncertain.value) return;
  failure.value = "";
  if (form.isExternal.value) {
    await saveDraft();
    return;
  }
  if (!form.validate(true)) {
    await focusErrors();
    return;
  }
  saving.value = "publish";
  let agent: Agent;
  try {
    agent = await create();
  } catch (error) {
    saving.value = "";
    await handleFailure(error, publish);
    return;
  }
  try {
    const value = await request<Agent>(
      "POST",
      "/profiles/" + encodeURIComponent(agent.agent_id) + "/publish",
      { expected_revision: agent.revision },
    );
    await queryClient.invalidateQueries({ queryKey: ["agents"] });
    await queryClient.invalidateQueries({ queryKey: ["catalog"] });
    ui.notify(
      t("agentPublished"),
      t("agentPublishedHelp", { name: value.name }),
    );
    finish();
  } catch (error) {
    // The draft exists: its page shows the error, so that the user fixes it
    // there instead of creating the agent again.
    await queryClient.invalidateQueries({ queryKey: ["agents"] });
    publishHandoff.value = { agentId: agent.agent_id, error };
    queryClient.setQueryData(["agent", agent.agent_id], agent);
    form.markSaved();
    ui.notify(
      t("createWizard.savedAsDraft"),
      t("createWizard.publishRejectedHelp", { name: agent.name }),
    );
    ui.keepView = "";
    await router.replace("/agents/" + agent.agent_id);
  } finally {
    saving.value = "";
  }
}

// Cancel or close with changes: Cancel, Don't save, Save draft.
const leaving = ref(false);
let leaveResolve: ((value: boolean) => void) | undefined;
/** Asks before discarding the changes. Resolves true to close. */
function confirmClose(): Promise<boolean> | boolean {
  if (!props.isShown || !dirty.value || uncertain.value) return true;
  leaving.value = true;
  return new Promise<boolean>((resolve) => {
    leaveResolve = resolve;
  });
}
function resolveLeave(value: boolean) {
  leaving.value = false;
  leaveResolve?.(value);
  leaveResolve = undefined;
}
async function close() {
  if (saving.value) return;
  if (await confirmClose()) {
    form.markSaved();
    emit("close");
  }
}
function discard() {
  form.markSaved();
  resolveLeave(true);
}
async function saveFromDialog() {
  leaving.value = false;
  resolveLeave(await saveDraft(true));
}
defineExpose({ confirmClose });

// Session expiry keeps the drawer and its input.
const session = useSessionResume(
  () => props.isShown && (dirty.value || !!saving.value),
);
function remember(event: Event) {
  const rejected = (event as CustomEvent<{ createRejected: boolean }>).detail
    ?.createRejected;
  if (props.isShown && dirty.value)
    sessionStorage.setItem(
      draftRecoveryKey,
      JSON.stringify({
        user: auth.user,
        path: "/agents/new",
        revision: 0,
        type: form.agentType.value,
        name: form.name.value,
        draft: form.configuration.value,
        step: step.value,
        createUncertain: uncertain.value || (creating && !rejected),
      }),
    );
  if (creating && !rejected) uncertain.value = true;
}
function recover() {
  const raw = sessionStorage.getItem(draftRecoveryKey);
  if (!raw) return;
  let saved;
  try {
    saved = JSON.parse(raw);
  } catch {
    sessionStorage.removeItem(draftRecoveryKey);
    return;
  }
  if (saved.user !== auth.user || saved.path !== "/agents/new") return;
  sessionStorage.removeItem(draftRecoveryKey);
  form.reset(saved.type);
  form.name.value = saved.name;
  if (form.isExternal.value)
    form.external.value = saved.draft as CleverAiConfiguration;
  else form.draft.value = saved.draft as Draft;
  step.value = Math.min(Number(saved.step) || 1, steps.value.length);
  uncertain.value = saved.createUncertain === true;
}
watch(
  () => auth.authorized,
  (value) => {
    const raw = value && sessionStorage.getItem(draftRecoveryKey);
    if (raw && raw.includes('"path":"/agents/new"'))
      sessionStorage.removeItem(draftRecoveryKey);
  },
);
function warnUnload(event: BeforeUnloadEvent) {
  if (props.isShown && dirty.value) {
    event.preventDefault();
    event.returnValue = "";
  }
}
onMounted(() => {
  window.addEventListener("agents-auth-expired", remember);
  window.addEventListener("beforeunload", warnUnload);
});
onUnmounted(() => {
  window.removeEventListener("agents-auth-expired", remember);
  window.removeEventListener("beforeunload", warnUnload);
});
function openAgents() {
  form.markSaved();
  uncertain.value = false;
  emit("close");
  void queryClient.invalidateQueries({ queryKey: ["agents"] });
}
</script>
<template>
  <NeSideDrawer
    :is-shown="isShown"
    :title="t('newAgent')"
    :close-aria-label="t('closeDrawer')"
    @close="close"
  >
    <div ref="body" class="flex flex-col gap-8">
      <NeStepper
        v-if="steps.length > 1"
        :total-steps="steps.length"
        :current-step="step"
        :step-label="t('createWizard.step')"
      />
      <div
        v-if="steps.length > 1"
        ref="heading"
        tabindex="-1"
        data-testid="step-heading"
        class="-mb-2 outline-none"
      >
        <NeHeading tag="h5">{{ t(stepTitles[current]) }}</NeHeading>
      </div>
      <NeInlineNotification
        v-if="uncertain"
        kind="error"
        :title="t('error.request_uncertain')"
        :description="t('agentForm.createUncertainHelp')"
        :primary-button-label="t('createWizard.checkAgents')"
        @primary-click="openAgents"
      />
      <NeInlineNotification
        v-else-if="failure"
        kind="error"
        :title="
          t(
            form.isExternal.value
              ? 'createWizard.cannotCreate'
              : 'agentEditor.cannotPublish',
          )
        "
        :description="failure"
      />
      <!-- The form starts from the catalog and the trunks: input typed
           before they load would be reset. -->
      <NeSkeleton v-if="!catalog || !trunks" :lines="8" />
      <AgentGeneralFields
        v-else-if="current === 'general'"
        :form="form"
        mode="create"
        :trunks="trunks"
        :catalog="catalog"
        :types="types"
        @type="changeType"
      />
      <AgentConversationFields
        v-else-if="current === 'conversation'"
        :form="form"
        :trunks="trunks"
        :sip-lab="sipLab"
      />
      <AgentTools
        v-else-if="current === 'tools'"
        :form="form"
        mode="create"
        :catalog="catalog"
        :agents="agents"
      />
      <div
        class="border-divider flex flex-wrap justify-end gap-4 border-t pt-6"
      >
        <NeButton kind="tertiary" :disabled="!!saving" @click="close">{{
          t("cancel")
        }}</NeButton>
        <NeButton
          v-if="step > 1"
          kind="secondary"
          :disabled="!!saving"
          @click="previous"
          ><template #prefix
            ><FontAwesomeIcon
              :icon="faArrowLeft"
              aria-hidden="true" /></template
          >{{ t("createWizard.previous") }}</NeButton
        >
        <NeButton v-if="!last" kind="primary" :disabled="!!saving" @click="next"
          >{{ t("createWizard.next")
          }}<template #suffix
            ><FontAwesomeIcon
              :icon="faArrowRight"
              aria-hidden="true" /></template
        ></NeButton>
        <NeButton
          v-else
          kind="primary"
          :loading="!!saving"
          :disabled="!!saving || uncertain"
          @click="publish"
          >{{ t(form.isExternal.value ? "create" : "publish") }}</NeButton
        >
      </div>
    </div>
  </NeSideDrawer>
  <UnsavedChangesModal
    :visible="leaving"
    :description="t('unsavedDialog.createHelp')"
    :saving="saving === 'draft'"
    :no-draft="form.isExternal.value"
    @cancel="resolveLeave(false)"
    @discard="discard"
    @save="saveFromDialog"
  />
  <SessionExpiredModal
    :visible="session.dialog.value"
    @cancel="session.cancel"
    @sign-in="session.signInAgain"
  />
</template>
