<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute, useRouter, onBeforeRouteLeave } from "vue-router";
import { useQuery } from "@tanstack/vue-query";
import {
  NeButton,
  NeTextInput,
  NeTextArea,
  NeToggle,
  NeExpandable,
  NeInlineNotification,
  NeModal,
  NeSideDrawer,
  NeMultiselectCombobox,
  NeBadgeV2,
} from "@nethesis/vue-components";
import { useI18n } from "vue-i18n";
import { inventory, workflow, request, refreshInventory } from "../api";
import { upgrade, clone, toolKey, removeBinding, graphErrors } from "../model";
import { useTask } from "../composables/useTask";
import PageHeader from "../components/PageHeader.vue";
import AccessibleTabs from "../components/AccessibleTabs.vue";
import FieldSelect from "../components/FieldSelect.vue";
import JsonEditor from "../components/JsonEditor.vue";
import StatusBadge from "../components/StatusBadge.vue";
import WorkflowCanvas from "../components/WorkflowCanvas.vue";
import NativeProfile from "../components/NativeProfile.vue";
import PresetEditor from "../components/PresetEditor.vue";
import type { Graph, ToolBinding, JsonObject } from "../types";
const { t } = useI18n();
const route = useRoute(),
  router = useRouter();
const task = useTask();
const query = useQuery({ queryKey: ["inventory"], queryFn: inventory });
const native = useQuery({
  queryKey: ["native"],
  queryFn: () => request("GET", "/native/inventory"),
});
const application = useQuery({
  queryKey: ["application"],
  queryFn: () => request("GET", "/application/inventory"),
});
const id = computed(() => String(route.params.id)),
  kind = computed(() => (route.meta.kind === "subflow" ? "subflow" : "agent"));
const row = computed(
  () =>
    query.data.value?.agents.find(
      (r) => r.agent_id === id.value && r.kind === kind.value,
    ) || query.data.value?.agents.find((r) => r.agent_id === id.value),
);
const graph = ref<Graph>(),
  revision = ref(0),
  baseline = ref(""),
  validated = ref(false),
  errorNode = ref("");
const showPublish = ref(false),
  showAdd = ref(false),
  removeKey = ref(""),
  editingKey = ref(""),
  versionNote = ref("");
const discard = ref(false);
let leaveResolve: ((yes: boolean) => void) | undefined;
const dirty = computed(() =>
  Boolean(graph.value && JSON.stringify(graph.value) !== baseline.value),
);
const tab = computed(() => String(route.params.tab || "general"));
const tabs = computed(() =>
  ["general", "workflow", "tools", "test"].map((name) => ({
    name,
    label: t(name),
  })),
);
const publishedTools = computed(() =>
  (query.data.value?.tool_versions || [])
    .filter((v) => !v.revoked)
    .map((v) => ({
      id: toolKey(v),
      label: `${v.definition.name} · v${v.version}`,
      rawObj: v,
    })),
);
const additions = ref<typeof publishedTools.value>([]);
const binding = computed(() =>
  graph.value?.tool_bindings?.find((b) => toolKey(b) === editingKey.value),
);
const blockingNodes = computed(() =>
  graph.value && query.data.value
    ? graphErrors(graph.value, query.data.value.blocks)
    : [],
);
const fixtures = ref<JsonObject>({}),
  inputs = ref<JsonObject>({}),
  tables = ref<JsonObject>({}),
  subflows = ref<JsonObject>({});
const caller = ref({ phone: "", name: "", origin: "external" });
const message = ref(""),
  scriptedReply = ref("");
const messages = ref<{ role: string; text: string }[]>([]),
  testResult = ref<JsonObject>();
watch(
  row,
  (value) => {
    if (value?.draft && !graph.value) {
      graph.value = upgrade(value.draft);
      revision.value = value.revision;
      baseline.value = JSON.stringify(graph.value);
    }
  },
  { immediate: true },
);
watch(
  graph,
  () => {
    validated.value = false;
  },
  { deep: true },
);
onBeforeRouteLeave(() =>
  !dirty.value
    ? true
    : new Promise<boolean>((resolve) => {
        leaveResolve = resolve;
        discard.value = true;
      }),
);
function leave(yes: boolean) {
  discard.value = false;
  leaveResolve?.(yes);
  leaveResolve = undefined;
}
async function saveDraft() {
  if (!graph.value) return;
  const result = await workflow(
    "PUT",
    `/definitions/${kind.value}/${id.value}`,
    { definition: graph.value, expected_revision: revision.value },
  );
  revision.value = result.revision;
  baseline.value = JSON.stringify(graph.value);
  await refreshInventory();
}
async function validateDraft() {
  if (!graph.value) return;
  try {
    await workflow("POST", "/validate", { definition: graph.value });
    validated.value = true;
    errorNode.value = "";
  } catch (error: any) {
    errorNode.value = error.response?.data?.node_id || "";
    throw error;
  }
}
async function publish() {
  await task.run(async () => {
    await validateDraft();
    await saveDraft();
    const result = await workflow(
      "POST",
      `/definitions/${kind.value}/${id.value}/publish`,
      {
        expected_revision: revision.value,
        ...(versionNote.value ? { note: versionNote.value } : {}),
      },
    );
    revision.value = result.revision;
    showPublish.value = false;
    if (result.pbx_sync?.pending) task.error.value = t("syncPending");
    await refreshInventory();
  });
}
async function activate(enabled: boolean) {
  await task.run(async () => {
    const result = await workflow(
      "POST",
      `/definitions/${kind.value}/${id.value}/activate`,
      {
        version: row.value?.version,
        enabled,
        expected_revision: revision.value,
      },
    );
    revision.value = result.revision;
    await refreshInventory();
  });
}
function addBindings() {
  if (!graph.value) return;
  const existing = new Set(graph.value.tool_bindings?.map(toolKey));
  const additionsToSave: ToolBinding[] = additions.value
    .filter((o) => !existing.has(o.id))
    .map(({ rawObj }) => ({
      tool_id: rawObj.tool_id,
      version: rawObj.version,
      conversation: true,
      workflow: true,
      scope: {},
      instructions: "",
      origins: ["internal", "external"],
    }));
  graph.value.tool_bindings = [
    ...(graph.value.tool_bindings || []),
    ...additionsToSave,
  ];
  additions.value = [];
  showAdd.value = false;
}
function removeTool() {
  if (graph.value) graph.value = removeBinding(graph.value, removeKey.value);
  removeKey.value = "";
  editingKey.value = "";
}
function bindingName(b: ToolBinding) {
  return (
    query.data.value?.tool_versions.find(
      (v) => v.tool_id === b.tool_id && v.version === b.version,
    )?.definition.name || b.tool_id
  );
}
function addMessage() {
  if (message.value.trim())
    messages.value.push({ role: "caller", text: message.value });
  if (scriptedReply.value.trim())
    messages.value.push({ role: "agent", text: scriptedReply.value });
  message.value = "";
  scriptedReply.value = "";
}
async function runMock() {
  await task.run(async () => {
    testResult.value = await workflow("POST", "/simulations", {
      definition: graph.value,
      fixtures: fixtures.value,
      input: inputs.value,
      caller: caller.value,
      tables: tables.value,
      subflows: subflows.value,
      messages: messages.value,
    });
  }, false);
}
function reload() {
  graph.value = undefined;
  void query.refetch();
}
</script>
<template>
  <PageHeader :title="graph?.name || row?.name || t('agents')"
    ><RouterLink :to="kind === 'agent' ? '/agents' : '/tools'"
      ><NeButton>{{ t("back") }}</NeButton></RouterLink
    ><StatusBadge
      v-if="row"
      :status="row.status"
      :version="row.version"
    /><NeBadgeV2 v-if="dirty" kind="amber">{{
      t("dirty")
    }}</NeBadgeV2></PageHeader
  >
  <NeInlineNotification
    v-if="task.error.value || query.isError.value"
    kind="error"
    :title="task.error.value || t('error.request_failed')"
    class="mb-6"
    ><template #details
      ><NeButton @click="reload">{{ t("retry") }}</NeButton></template
    ></NeInlineNotification
  >
  <NativeProfile v-if="row?.kind === 'builtin'" :id="id" />
  <PresetEditor v-else-if="row?.kind === 'preset'" />
  <template v-else-if="graph && query.data.value">
    <AccessibleTabs
      :tabs="tabs"
      :selected="tab"
      :sr-tabs-label="t('agents')"
      @select-tab="
        router.push(
          `/${kind === 'agent' ? 'agents' : 'workflows'}/${id}/${$event}`,
        )
      "
    />
    <section v-if="tab === 'general'" class="nv-panel mt-6 space-y-6">
      <h2>{{ t("identity") }}</h2>
      <div class="nv-field-grid">
        <NeTextInput
          v-model="graph.name"
          :label="t('name')"
          maxlength="128"
        /><NeTextArea
          v-model="graph.description"
          :label="t('description')"
          :rows="2"
          maxlength="1024"
        />
        <FieldSelect
          v-if="graph.entrypoints.includes('voice')"
          :model-value="graph.provider_binding_ref || ''"
          :label="t('provider')"
          :options="
            [
              { id: '', label: t('optional') },
              ...query.data.value.bindings,
            ].map((b) => ({
              id: b.id,
              label: 'label' in b ? String(b.label) : String(b.name),
            }))
          "
          @update:model-value="graph.provider_binding_ref = $event || null"
        />
        <FieldSelect
          :model-value="graph.fallback || ''"
          :label="t('fallback')"
          :options="[
            { id: '', label: t('optional') },
            ...query.data.value.routing_objects.map((r) => ({
              id: r.id,
              label: r.name,
            })),
          ]"
          @update:model-value="graph.fallback = $event || null"
        />
      </div>
      <NeTextArea
        v-model="graph.goal"
        :label="t('goal')"
        :rows="3"
      /><NeTextArea
        v-model="graph.instructions"
        :label="t('instructions')"
        :rows="5"
      />
      <div v-if="graph.entrypoints.includes('voice')" class="nv-field-grid">
        <NeTextInput
          :model-value="graph.voice_settings?.language || ''"
          :label="t('language')"
          @update:model-value="
            graph.voice_settings = { ...graph.voice_settings, language: $event }
          "
        /><NeTextInput
          :model-value="graph.voice_settings?.voice || ''"
          :label="t('voiceName')"
          @update:model-value="
            graph.voice_settings = { ...graph.voice_settings, voice: $event }
          "
        /><NeTextInput
          :model-value="graph.voice_settings?.model || ''"
          :label="t('model')"
          @update:model-value="
            graph.voice_settings = { ...graph.voice_settings, model: $event }
          "
        />
      </div>
      <div v-if="graph.entrypoints.includes('api')" class="nv-field-grid">
        <NeTextInput
          :model-value="graph.text_provider?.model || ''"
          :label="t('model')"
          @update:model-value="
            graph.text_provider = {
              model: $event,
              secret_ref: graph.text_provider?.secret_ref || '',
            }
          "
        /><FieldSelect
          :model-value="graph.text_provider?.secret_ref || ''"
          :label="t('credential')"
          :options="
            (application.data.value?.secrets || [])
              .filter((s: any) => !s.revoked)
              .map((s: any) => ({ id: s.secret_id, label: s.secret_id }))
          "
          @update:model-value="
            graph.text_provider = {
              model: graph.text_provider?.model || '',
              secret_ref: $event,
            }
          "
        />
      </div>
      <NeToggle
        v-model="graph.capture_tool_content"
        :label="t('captureTools')"
        :helper-text="t('captureHelp')"
      />
      <NeExpandable :label="t('permissions')"
        ><div class="mt-4 grid gap-4 md:grid-cols-2">
          <NeToggle
            v-for="permission in native.data.value?.permissions || []"
            :key="permission"
            :model-value="graph.permissions[permission] === 'allow'"
            :label="t('permissionNames.' + permission.replaceAll('.', '_'))"
            @update:model-value="
              graph.permissions[permission] = $event ? 'allow' : 'deny'
            "
          /></div
      ></NeExpandable>
      <NeExpandable :label="t('advanced')"
        ><div class="nv-stack mt-4">
          <JsonEditor
            v-model="graph.permissions"
            :label="t('permissions')"
            shape="object"
          /><JsonEditor
            v-model="graph.limits"
            :label="t('config')"
            shape="object"
          /><JsonEditor
            v-model="graph.input_schema"
            :label="t('inputs')"
            shape="object"
          /><JsonEditor
            v-model="graph.output_schema"
            :label="t('outputs')"
            shape="object"
          /><JsonEditor
            v-model="graph.tool_grants"
            :label="t('scopes')"
            shape="array"
          /></div
      ></NeExpandable>
    </section>
    <section v-else-if="tab === 'workflow'" class="mt-6">
      <WorkflowCanvas
        v-model="graph"
        :inventory="query.data.value"
        :errors="[...blockingNodes, errorNode]"
      />
    </section>
    <section v-else-if="tab === 'tools'" class="nv-panel mt-6 space-y-6">
      <div class="nv-action-bar">
        <NeButton kind="primary" @click="showAdd = true">{{
          t("addTools")
        }}</NeButton
        ><RouterLink to="/tools"
          ><NeButton>{{ t("catalog") }}</NeButton></RouterLink
        >
      </div>
      <div
        v-for="b in graph.tool_bindings"
        :key="toolKey(b)"
        class="flex flex-wrap items-center justify-between gap-4 border-b border-gray-200 py-4 dark:border-gray-600"
      >
        <div>
          <button
            class="font-medium text-primary-700 dark:text-primary-400"
            @click="editingKey = toolKey(b)"
          >
            {{ bindingName(b) }} · v{{ b.version }}
          </button>
          <p class="nv-muted mt-2 text-xs">
            {{
              [
                b.conversation ? t("autonomous") : "",
                b.workflow ? t("explicit") : "",
              ]
                .filter(Boolean)
                .join(" · ")
            }}
          </p>
        </div>
        <div class="nv-action-bar">
          <NeButton @click="editingKey = toolKey(b)">{{ t("config") }}</NeButton
          ><NeButton kind="tertiary" @click="removeKey = toolKey(b)">{{
            t("remove")
          }}</NeButton>
        </div>
      </div>
      <NeInlineNotification
        v-if="blockingNodes.length"
        kind="warning"
        :title="t('blockedReference')"
        :description="blockingNodes.join(', ')"
      />
      <p class="nv-muted">{{ t("directHelp") }}</p>
    </section>
    <section v-else class="mt-6 space-y-6">
      <NeInlineNotification
        kind="info"
        :title="t('simulation')"
        :description="t('simulationHelp')"
      />
      <div class="grid gap-6 xl:grid-cols-2">
        <div class="nv-panel space-y-5">
          <h2>{{ t("simulation") }}</h2>
          <div class="nv-field-grid">
            <NeTextInput
              v-model="caller.phone"
              :label="t('phone')"
            /><FieldSelect
              v-model="caller.origin"
              :label="t('caller')"
              :options="[
                { id: 'external', label: 'External' },
                { id: 'internal', label: 'Internal' },
              ]"
            />
          </div>
          <div class="max-h-64 space-y-3 overflow-y-auto">
            <div
              v-for="(m, index) in messages"
              :key="index"
              :class="[
                'rounded-md p-3',
                m.role === 'agent'
                  ? 'bg-primary-50 dark:bg-primary-950'
                  : 'bg-gray-100 dark:bg-gray-700',
              ]"
            >
              <p class="nv-muted text-xs">
                {{ m.role === "agent" ? t("agents") : t("caller") }}
              </p>
              <p class="mt-1 whitespace-pre-wrap">{{ m.text }}</p>
            </div>
          </div>
          <NeTextArea
            v-model="message"
            :label="t('message')"
            :rows="2"
          /><NeTextArea
            v-model="scriptedReply"
            :label="t('mockMessages')"
            :helper-text="t('fixtureHelp')"
            :rows="2"
          /><NeButton :disabled="!message.trim()" @click="addMessage">{{
            t("send")
          }}</NeButton>
          <JsonEditor
            v-model="fixtures"
            :label="t('fixtures')"
            shape="object"
          /><NeExpandable :label="t('advanced')"
            ><JsonEditor
              v-model="inputs"
              :label="t('inputs')"
              shape="object" /><JsonEditor
              v-model="tables"
              :label="t('mockTables')"
              shape="object" /><JsonEditor
              v-model="subflows"
              :label="t('subflowTool')"
              shape="object"
          /></NeExpandable>
          <NeButton
            kind="primary"
            :loading="task.pending.value"
            @click="runMock"
            >{{ t("runMock") }}</NeButton
          >
        </div>
        <div class="nv-panel space-y-5">
          <h2>{{ t("trace") }}</h2>
          <StatusBadge v-if="testResult" :status="testResult.status" />
          <ol class="space-y-3">
            <li
              v-for="(step, index) in testResult?.trace || []"
              :key="index"
              class="rounded-md bg-gray-100 p-3 dark:bg-gray-700"
            >
              <span class="font-medium">{{
                graph.nodes.find((n) => n.id === (step.node_id || step.node))
                  ?.name || step.node
              }}</span>
              · {{ step.outcome }}
              <p v-if="step.error" class="text-rose-500">{{ step.error }}</p>
            </li>
          </ol>
          <RouterLink
            v-if="testResult?.run_id"
            :to="'/activity/' + testResult.run_id + '?kind=mock'"
            ><NeButton>{{ t("runDetail") }}</NeButton></RouterLink
          >
        </div>
      </div>
    </section>
    <div class="nv-action-bar mt-6">
      <NeButton :loading="task.pending.value" @click="task.run(saveDraft)">{{
        t("save")
      }}</NeButton
      ><NeButton @click="task.run(validateDraft)">{{ t("validate") }}</NeButton
      ><NeBadgeV2 v-if="validated" kind="green">{{ t("valid") }}</NeBadgeV2
      ><NeButton
        kind="primary"
        :disabled="blockingNodes.length > 0"
        @click="showPublish = true"
        >{{ t("publish") }}</NeButton
      ><NeButton
        v-if="row?.version"
        :disabled="dirty"
        @click="activate(!row.enabled)"
        >{{ t(row.enabled ? "disable" : "activate") }}</NeButton
      >
    </div>
  </template>
  <NeModal
    :visible="showPublish"
    :title="t('publishTitle')"
    :primary-label="t('publish')"
    :cancel-label="t('cancel')"
    :close-aria-label="t('close')"
    :primary-button-loading="task.pending.value"
    :primary-button-disabled="blockingNodes.length > 0"
    @close="showPublish = false"
    @primary-click="publish"
    ><div class="space-y-5">
      <p>{{ t("publishHelp") }}</p>
      <p class="nv-muted">{{ t("publishedHelp") }}</p>
      <NeTextArea v-model="versionNote" :label="t('releaseNote')" :rows="2" />
      <p>{{ graph?.tool_bindings?.map(bindingName).join(" · ") }}</p>
      <NeInlineNotification
        v-if="task.error.value"
        kind="error"
        :title="task.error.value"
      /></div
  ></NeModal>
  <NeModal
    :visible="showAdd"
    :title="t('addTools')"
    :primary-label="t('addTools')"
    :cancel-label="t('cancel')"
    :close-aria-label="t('close')"
    @close="showAdd = false"
    @primary-click="addBindings"
    ><NeMultiselectCombobox
      v-model="additions"
      :options="
        publishedTools.filter(
          (o) => !graph?.tool_bindings?.some((b) => toolKey(b) === o.id),
        )
      "
      :label="t('tools')"
      :no-results-label="t('noResults')"
      :no-options-label="t('noOptions')"
      :optional-label="t('optional')"
      :user-input-label="t('choose')"
      :limited-options-label="t('tools')"
    /><RouterLink to="/tools/new"
      ><NeButton class="mt-5">{{ t("newTool") }}</NeButton></RouterLink
    ></NeModal
  >
  <NeSideDrawer
    :visible="Boolean(binding)"
    :title="binding ? bindingName(binding) : ''"
    :close-aria-label="t('close')"
    @close="editingKey = ''"
    ><div v-if="binding" class="space-y-6 p-6">
      <NeToggle
        v-model="binding.conversation"
        :label="t('autonomous')"
      /><NeToggle
        v-model="binding.workflow"
        :label="t('explicit')"
      /><NeTextArea
        v-model="binding.instructions"
        :label="t('toolInstructions')"
        :rows="4"
      /><NeTextInput
        v-model="binding.scope.identity_field"
        :label="t('identityField')"
      /><JsonEditor
        :model-value="binding.scope.filters || {}"
        :label="t('scopeFilters')"
        shape="object"
        @update:model-value="binding.scope.filters = $event"
      /><RouterLink :to="'/tools/' + binding.tool_id"
        ><NeButton>{{ t("open") }} {{ t("tools") }}</NeButton></RouterLink
      ><NeButton kind="danger" @click="removeKey = editingKey">{{
        t("remove")
      }}</NeButton>
    </div></NeSideDrawer
  >
  <NeModal
    :visible="Boolean(removeKey)"
    :title="t('removeToolTitle')"
    :primary-label="t('remove')"
    :cancel-label="t('cancel')"
    primary-button-kind="danger"
    :close-aria-label="t('close')"
    @close="removeKey = ''"
    @primary-click="removeTool"
    ><p>{{ t("removeToolHelp") }}</p></NeModal
  >
  <NeModal
    :visible="discard"
    :title="t('unsavedTitle')"
    :primary-label="t('leave')"
    :cancel-label="t('cancel')"
    primary-button-kind="danger"
    :close-aria-label="t('close')"
    @primary-click="leave(true)"
    @close="leave(false)"
    ><p>{{ t("unsavedHelp") }}</p></NeModal
  >
</template>
