<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted, nextTick } from "vue";
import {
  useRoute,
  useRouter,
  onBeforeRouteLeave,
  onBeforeRouteUpdate,
} from "vue-router";
import { useQuery } from "@tanstack/vue-query";
import {
  NeBadgeV2,
  NeButton,
  NeInlineNotification,
  NeSkeleton,
  NeTextInput,
} from "@nethesis/vue-components";
import { faCheck, faFloppyDisk } from "@fortawesome/free-solid-svg-icons";
import { useI18n } from "vue-i18n";
import { useLoadError } from "../composables/useLoadError";
import { useAgentForm } from "../composables/useAgentForm";
import { useSessionResume } from "../composables/useSessionResume";
import {
  request,
  queryClient,
  auth,
  errorCode,
  draftRecoveryKey,
} from "../api";
import { useUi } from "../stores/ui";
import { agentStatus } from "../agentStatus";
import { clone, mergeChanges, savedState } from "../agentForm";
import { publishHandoff } from "../handoff";
import PageHeader from "../components/PageHeader.vue";
import SettingsSection from "../components/SettingsSection.vue";
import AgentGeneralFields from "../components/AgentGeneralFields.vue";
import AgentConversationFields from "../components/AgentConversationFields.vue";
import AgentTools from "../components/AgentTools.vue";
import AppToggle from "../components/AppToggle.vue";
import AppExpandable from "../components/AppExpandable.vue";
import TrunkDrawer from "../components/TrunkDrawer.vue";
import StatusBadge from "../components/StatusBadge.vue";
import UnsavedChangesModal from "../components/UnsavedChangesModal.vue";
import SessionExpiredModal from "../components/SessionExpiredModal.vue";
import ConflictModal from "../components/ConflictModal.vue";
import type {
  Agent,
  Catalog,
  CleverAiConfiguration,
  Draft,
  Trunk,
} from "../types";
const { t } = useI18n();
const loadError = useLoadError();
const route = useRoute(),
  router = useRouter(),
  ui = useUi();
const id = computed(() => String(route.params.id || ""));
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
const agents = useQuery({
  queryKey: ["agents"],
  queryFn: () => request<{ items: Agent[] }>("GET", "/profiles"),
});
const form = useAgentForm(computed(() => catalog.data.value));
const record = ref<Agent>();
const external = form.isExternal;
const internal = computed(() => form.agentType.value === "consultation");
const sipLab = computed(() => catalog.data.value?.sip_lab_enabled === true);
const root = ref<HTMLElement>();
const troubleshooting = ref(false);
// An error in the troubleshooting settings opens them.
watch(
  () => !!form.errors.value.retention,
  (value) => {
    if (value) troubleshooting.value = true;
  },
);
// An error that is not about a field, shown above the form.
const failure = ref<{ title: string; description: string }>();

function accept(value: Agent) {
  record.value = value;
  form.load(value);
  queryClient.setQueryData(["agent", value.agent_id], value);
}

// Recovery of unsaved changes when the page is reloaded while the session is
// expired.
function rememberDraft() {
  if (form.dirty.value)
    sessionStorage.setItem(
      draftRecoveryKey,
      JSON.stringify({
        user: auth.user,
        path: route.path,
        revision: record.value?.revision ?? 0,
        type: form.agentType.value,
        name: form.name.value,
        draft: form.configuration.value,
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
  form.name.value = saved.name;
  if (form.isExternal.value)
    form.external.value = saved.draft as CleverAiConfiguration;
  else form.draft.value = saved.draft as Draft;
}
function warnUnload(event: BeforeUnloadEvent) {
  if (form.dirty.value) {
    event.preventDefault();
    event.returnValue = "";
  }
}
const session = useSessionResume(() => form.dirty.value || !!saving.value);
onMounted(() => {
  window.addEventListener("agents-auth-expired", rememberDraft);
  window.addEventListener("beforeunload", warnUnload);
});
onUnmounted(() => {
  window.removeEventListener("agents-auth-expired", rememberDraft);
  window.removeEventListener("beforeunload", warnUnload);
});
watch(
  () => auth.authorized,
  (value) => {
    if (value) {
      const raw = sessionStorage.getItem(draftRecoveryKey);
      if (raw?.includes('"path":"' + route.path + '"'))
        sessionStorage.removeItem(draftRecoveryKey);
    }
  },
);
watch(
  () => agent.data.value,
  (value) => {
    if (
      value &&
      (!record.value ||
        (!form.dirty.value && value.revision > record.value.revision))
    ) {
      accept(value);
      recoverDraft();
      showHandoff();
    }
  },
  { immediate: true },
);

const status = computed(() =>
  record.value ? agentStatus(record.value) : "draft",
);
const published = computed(() => record.value?.workflow_version || 0);
const draftVersion = computed(
  () => record.value?.draft_version ?? published.value + 1,
);
const subtitle = computed(() => {
  if (external.value) return t("agentEditor.cleverAiHelp");
  if (status.value === "draft")
    return t("agentForm.notPublished", { draft: draftVersion.value });
  if (status.value === "modified")
    return t("agentForm.modified", {
      published: published.value,
      draft: draftVersion.value,
    });
  if (!published.value)
    return t("agentForm.notPublished", { draft: draftVersion.value });
  return t("agentForm.published", { published: published.value });
});
const footer = computed(() => {
  if (form.dirty.value) return t("unsavedHint");
  if (external.value || !record.value) return "";
  const parts: string[] = [];
  if (status.value !== "published" && status.value !== "pending")
    parts.push(t("agentForm.draftVersion", { draft: draftVersion.value }));
  parts.push(
    published.value
      ? t("agentForm.publishedVersion", { published: published.value })
      : t("agentForm.unpublished"),
  );
  return parts.join(" · ");
});
const saving = ref<"" | "draft" | "publish">("");
const canPublish = computed(
  () =>
    !external.value &&
    !saving.value &&
    (form.dirty.value ||
      !record.value?.workflow_version ||
      (record.value.draft_version != null &&
        record.value.draft_version !== record.value.workflow_version)),
);

const errorText = (error: unknown) => form.errorMessage(error);
async function showFieldErrors() {
  await form.focusFirstError(root.value);
}
/** Shows a failed request where it belongs: a field, a dialog or a notice. */
async function handleFailure(
  error: unknown,
  action: "draft" | "publish",
  retry: () => unknown,
) {
  const code = errorCode(error);
  // A rejected session ends the authorization, whatever the error code.
  if (code === "authentication_required" || !auth.authorized) {
    session.interrupted(retry);
    return;
  }
  if (code === "revision_conflict") {
    try {
      conflict.value = await request<Agent>(
        "GET",
        "/profiles/" + encodeURIComponent(id.value),
      );
      conflictAction = action;
    } catch (reload) {
      failure.value = {
        title: t("agentEditor.cannotSave"),
        description: errorText(reload),
      };
    }
    return;
  }
  if (form.serverError(error)) {
    await showFieldErrors();
    return;
  }
  failure.value = {
    title: t(
      action === "publish"
        ? "agentEditor.cannotPublish"
        : "agentEditor.cannotSave",
    ),
    description: errorText(error),
  };
  await nextTick();
  root.value?.scrollIntoView({ block: "start" });
}
async function persist(): Promise<Agent> {
  const sent = form.snapshot();
  const value = await request<Agent>(
    "PUT",
    "/profiles/" + encodeURIComponent(id.value),
    {
      profile: {
        name: form.name.value.trim(),
        draft: form.configuration.value,
      },
      expected_revision: record.value?.revision || 0,
    },
  );
  // Changes typed while the request was running stay on the page, unsaved.
  const edited = form.snapshot() !== sent;
  const name = form.name.value;
  const configuration = clone(form.configuration.value);
  accept(value);
  if (edited) {
    form.name.value = name;
    if (form.isExternal.value)
      form.external.value = configuration as CleverAiConfiguration;
    else form.draft.value = configuration as Draft;
  }
  return value;
}
async function refreshLists() {
  await queryClient.invalidateQueries({ queryKey: ["destinations"] });
  await queryClient.invalidateQueries({ queryKey: ["agents"] });
  await queryClient.invalidateQueries({ queryKey: ["catalog"] });
}
/** Saves the draft. Returns true when it was saved. */
async function save(): Promise<boolean> {
  if (saving.value) return false;
  failure.value = undefined;
  if (!form.validate(false)) {
    await showFieldErrors();
    return false;
  }
  saving.value = "draft";
  try {
    await persist();
    await refreshLists();
    ui.notify(
      t(external.value ? "agentSaved" : "draftSaved"),
      t(external.value ? "agentSavedHelp" : "agentEditor.draftSavedHelp", {
        name: form.name.value.trim(),
      }),
    );
    return true;
  } catch (error) {
    await handleFailure(error, "draft", save);
    return false;
  } finally {
    saving.value = "";
  }
}
async function publish() {
  if (saving.value || !canPublish.value) return;
  failure.value = undefined;
  if (!form.validate(true)) {
    await showFieldErrors();
    return;
  }
  saving.value = "publish";
  try {
    let value = record.value!;
    if (form.dirty.value) value = await persist();
    value = await request<Agent>(
      "POST",
      "/profiles/" + encodeURIComponent(value.agent_id) + "/publish",
      { expected_revision: value.revision },
    );
    accept(value);
    await refreshLists();
    ui.notify(
      t("agentPublished"),
      t("agentPublishedHelp", { name: form.name.value.trim() }),
    );
    await router.push("/agents");
  } catch (error) {
    await handleFailure(error, "publish", publish);
  } finally {
    saving.value = "";
  }
}

// Agent changed elsewhere.
const conflict = ref<Agent>();
let conflictAction: "draft" | "publish" = "draft";
async function keepMine() {
  const theirs = conflict.value;
  if (!theirs || !record.value) return;
  // Apply only the values changed on this page to the version saved
  // elsewhere, so that its other changes are kept.
  const merged = mergeChanges(
    savedState(record.value),
    { name: form.name.value, draft: clone(form.configuration.value) },
    savedState(theirs),
  ) as { name: string; draft: Draft | CleverAiConfiguration };
  conflict.value = undefined;
  accept(theirs);
  form.name.value = merged.name;
  if (form.isExternal.value)
    form.external.value = merged.draft as CleverAiConfiguration;
  else form.draft.value = merged.draft as Draft;
  if (conflictAction === "publish") await publish();
  else await save();
}
function discardMine() {
  const theirs = conflict.value;
  conflict.value = undefined;
  if (!theirs) return;
  accept(theirs);
  form.errors.value = {};
  ui.notify(t("conflictDialog.loaded"), t("conflictDialog.loadedHelp"));
}

// Leaving with unsaved changes.
const leaving = ref(false);
let leaveResolve: ((value: boolean) => void) | undefined;
function confirmLeave(): Promise<boolean> | boolean {
  if (!form.dirty.value) return true;
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
async function saveAndLeave() {
  leaving.value = false;
  const saved = await save();
  resolveLeave(saved);
}
onBeforeRouteLeave(() => confirmLeave());
onBeforeRouteUpdate((to, from) => to.path === from.path || confirmLeave());

function showHandoff() {
  const handoff = publishHandoff.value;
  if (!handoff || handoff.agentId !== record.value?.agent_id) return;
  publishHandoff.value = null;
  if (form.serverError(handoff.error)) void showFieldErrors();
  else
    failure.value = {
      title: t("agentEditor.cannotPublish"),
      description:
        errorText(handoff.error) + " " + t("agentEditor.savedAsDraft"),
    };
}

async function synchronize() {
  try {
    await request("POST", "/synchronize", { retry: true });
    accept(
      await request<Agent>("GET", "/profiles/" + encodeURIComponent(id.value)),
    );
  } catch (error) {
    failure.value = {
      title: t("agentEditor.cannotSynchronize"),
      description: errorText(error),
    };
  }
}
const trunkDrawer = ref(false);
function trunkCreated(trunk: Trunk) {
  if ((trunk.provider === "cleverai") === external.value) {
    if (external.value)
      form.external.value.provider_binding_id = trunk.binding_id;
    else form.draft.value.provider_binding_id = trunk.binding_id;
  }
}
const debug = computed(() => form.draft.value.debug);
</script>
<template>
  <div ref="root" class="pb-24">
    <PageHeader
      :title="record ? record.name : ''"
      :description="record ? subtitle : undefined"
      back="/agents"
    >
      <template v-if="record" #badges
        ><NeBadgeV2 v-if="record.kind === 'builtin'" kind="gray">{{
          t("builtin")
        }}</NeBadgeV2
        ><StatusBadge :status="status"
      /></template>
    </PageHeader>
    <NeSkeleton v-if="agent.isLoading.value" :lines="10" />
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
      v-if="record"
      class="flex max-w-2xl flex-col gap-10"
      novalidate
      @submit.prevent="save"
    >
      <NeInlineNotification
        v-if="failure"
        kind="error"
        :title="failure.title"
        :description="failure.description"
      />
      <NeInlineNotification
        v-if="
          record.sync_status !== 'synced' &&
          (record.workflow_version || external)
        "
        :kind="record.sync_status === 'error' ? 'error' : 'warning'"
        :title="t('sync.' + record.sync_status)"
        :primary-button-label="t('retrySync')"
        @primary-click="synchronize"
      />
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
        <AgentGeneralFields
          :form="form"
          mode="edit"
          :trunks="trunks.data.value?.items"
          :catalog="catalog.data.value"
          @create-trunk="trunkDrawer = true"
        />
      </SettingsSection>
      <SettingsSection
        v-if="!external"
        divider
        :title="t('conversationSettings')"
        :description="
          t(
            internal
              ? 'agentEditor.consultationConversationHelp'
              : 'conversationSettingsHelp',
          )
        "
      >
        <AgentConversationFields
          :form="form"
          :trunks="trunks.data.value?.items"
          :sip-lab="sipLab"
        />
      </SettingsSection>
      <SettingsSection
        v-if="form.agentType.value === 'basic_voice'"
        divider
        :title="t('tools')"
        :description="t('agentEditor.toolsHelp')"
      >
        <AgentTools
          :form="form"
          mode="edit"
          :catalog="catalog.data.value"
          :agents="agents.data.value?.items"
        />
      </SettingsSection>
      <section
        v-if="!external"
        class="border-divider border-t pt-10"
        data-section="troubleshooting"
      >
        <AppExpandable
          v-model="troubleshooting"
          :label="t('agentEditor.troubleshooting')"
        >
          <div class="flex flex-col gap-6 pt-2">
            <p class="text-muted">{{ t("agentEditor.troubleshootingHelp") }}</p>
            <AppToggle
              v-model="debug.transcription_enabled"
              :label="t('debugTranscription')"
              :tip="t('agentEditor.transcriptionTip')"
            />
            <div
              v-if="debug.transcription_enabled"
              data-field="retention"
              class="max-w-xs"
            >
              <NeTextInput
                :model-value="String(debug.retention_hours)"
                :label="t('transcriptRetention')"
                :placeholder="t('agentEditor.retentionPlaceholder')"
                :helper-text="t('agentForm.retentionHelp')"
                type="number"
                min="1"
                max="24"
                :invalid-message="form.errors.value.retention"
                @update:model-value="
                  debug.retention_hours = Number($event);
                  form.clearError('retention');
                "
              />
            </div>
          </div>
        </AppExpandable>
      </section>
      <div
        class="bg-elevation-0 border-divider fixed right-0 bottom-0 left-0 z-10 border-t px-4 py-4 sm:px-8 lg:left-75"
      >
        <div
          class="flex max-w-2xl flex-wrap items-center justify-between gap-4"
        >
          <span class="text-muted" data-testid="agent-footer">{{
            footer
          }}</span>
          <div class="flex flex-wrap gap-3">
            <NeButton
              kind="tertiary"
              :disabled="!!saving"
              @click="router.push('/agents')"
              >{{ t("cancel") }}</NeButton
            >
            <NeButton
              type="submit"
              :kind="external ? 'primary' : 'secondary'"
              :loading="saving === 'draft'"
              :disabled="!!saving || !form.dirty.value"
              ><template #prefix
                ><FontAwesomeIcon
                  :icon="external ? faCheck : faFloppyDisk"
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
                ><FontAwesomeIcon
                  :icon="faCheck"
                  aria-hidden="true" /></template
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
    <UnsavedChangesModal
      :visible="leaving"
      :description="t('unsavedDialog.pageHelp')"
      :saving="saving === 'draft'"
      :no-draft="external"
      @cancel="resolveLeave(false)"
      @discard="resolveLeave(true)"
      @save="saveAndLeave"
    />
    <SessionExpiredModal
      :visible="session.dialog.value"
      @cancel="session.cancel"
      @sign-in="session.signInAgain"
    />
    <ConflictModal
      :visible="!!conflict"
      :name="record?.name || ''"
      :saving="!!saving"
      @cancel="conflict = undefined"
      @discard="discardMine"
      @keep="keepMine"
    />
  </div>
</template>
