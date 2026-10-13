<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useQuery } from "@tanstack/vue-query";
import {
  NeButton,
  NeTextInput,
  NeTextArea,
  NeInlineNotification,
  NeModal,
  NeStepper,
  NeExpandable,
  NeMultiselectCombobox,
} from "@nethesis/vue-components";
import { useI18n } from "vue-i18n";
import { inventory, request, workflow, refreshInventory } from "../api";
import { clone, identifier, objectSchema, operationKey } from "../model";
import { useDraftGuard } from "../composables/useDraftGuard";
import { useTask } from "../composables/useTask";
import PageHeader from "../components/PageHeader.vue";
import FieldSelect from "../components/FieldSelect.vue";
import JsonEditor from "../components/JsonEditor.vue";
import ParameterEditor from "../components/ParameterEditor.vue";
import type { ToolDefinition, JsonObject } from "../types";
const { t } = useI18n(),
  route = useRoute(),
  router = useRouter();
const task = useTask();
const query = useQuery({ queryKey: ["inventory"], queryFn: inventory });
const application = useQuery({
  queryKey: ["application"],
  queryFn: () => request("GET", "/application/inventory"),
});
const native = useQuery({
  queryKey: ["native"],
  queryFn: () => request("GET", "/native/inventory"),
});
const isNew = computed(() => route.params.id === "new"),
  id = ref(String(route.params.id)),
  revision = ref(0),
  started = ref(false),
  revoke = ref(false);
const draft = ref<ToolDefinition>({
  name: "",
  description: "",
  kind: "api",
  config: { operation: {} },
  input_schema: objectSchema(),
  output_schema: objectSchema(),
  execution_policy: "read_only",
  timeout_seconds: 10,
});
const args = ref<JsonObject>({}),
  fixture = ref<JsonObject>({}),
  mockRows = ref<JsonObject[]>([]),
  mockIdentity = ref<JsonObject>({}),
  testResult = ref<JsonObject>();
const operation = ref(""),
  operationDraft = ref<JsonObject>(),
  operationBaseline = ref("");
const sourceId = ref(""),
  subflowId = ref(""),
  builtinId = ref("");
const guard = useDraftGuard(() => ({
  draft: draft.value,
  operationModified: Boolean(
    operationDraft.value &&
    JSON.stringify(operationDraft.value) !== operationBaseline.value,
  ),
}));
watch(
  () => query.data.value,
  (value) => {
    if (value && !isNew.value && !started.value) {
      const row = value.tools.find((r) => r.tool_id === id.value);
      if (row) {
        draft.value = clone(row.draft);
        revision.value = row.revision;
        started.value = true;
        guard.saved();
        sourceId.value = draft.value.config.resource?.resource_id || "";
        operation.value =
          value.connector_operations.find(
            (o) =>
              operationKey(o.reference) ===
              operationKey(draft.value.config.operation),
          )?.id || "";
        subflowId.value = draft.value.config.resource?.resource_id || "";
        builtinId.value = draft.value.config.tool_id || "";
      }
    }
  },
  { immediate: true },
);
const source = computed(() =>
  query.data.value?.data_sources.find((r) => r.resource_id === sourceId.value),
);
const sourceColumns = computed(
  () =>
    source.value?.settings.columns ||
    Object.keys(source.value?.settings.mapping || {}).map((name) => ({
      name,
      type: "string",
      sensitive: name === "verification_code",
    })),
);
const fieldOptions = computed(() =>
  sourceColumns.value
    .filter(
      (c: JsonObject) =>
        !c.sensitive && !["verification_code", "phone"].includes(c.name),
    )
    .map((c: JsonObject) => ({ id: c.name, label: c.name })),
);
const selectedFields = computed({
  get: () =>
    fieldOptions.value.filter((f: JsonObject) =>
      (draft.value.config.fields || []).includes(f.id),
    ),
  set: (value) => {
    draft.value.config.fields = value.map((f: JsonObject) => f.id);
  },
});
function chooseKind(kind: ToolDefinition["kind"]) {
  draft.value.kind = kind;
  started.value = true;
  draft.value.execution_policy = "read_only";
  draft.value.config =
    kind === "api"
      ? { operation: {} }
      : kind === "query"
        ? {
            resource: { resource_id: "", version: "latest" },
            fields: [],
            filters: [],
            limit: 10,
            max_age_seconds: 86400,
          }
        : kind === "documents"
          ? {
              resource: { resource_id: "", version: "latest" },
              limit: 5,
              max_age_seconds: 31536000,
            }
          : kind === "telephony"
            ? { tool_id: "" }
            : { resource: { resource_id: "", version: 1 } };
  if (kind === "query")
    draft.value.output_schema = {
      type: "object",
      additionalProperties: false,
      properties: {
        rows: { type: "array", items: { type: "object" } },
        count: { type: "integer" },
        value: { type: ["number", "null"] },
        source_rows: { type: "array", items: { type: "integer" } },
        source: { type: "object" },
      },
      required: ["rows", "count", "source_rows", "source"],
    };
  if (kind === "documents") {
    draft.value.input_schema = {
      type: "object",
      additionalProperties: false,
      properties: { query: { type: "string", maxLength: 1024 } },
      required: ["query"],
    };
    draft.value.output_schema = {
      type: "object",
      additionalProperties: false,
      properties: {
        status: { type: "string" },
        passages: { type: "array", items: { type: "object" } },
        source: { type: "object" },
      },
      required: ["status", "passages", "source"],
    };
  }
}
function chooseOperation(value: string) {
  operation.value = value;
  const item = query.data.value?.connector_operations.find(
    (o) => o.id === value,
  );
  if (!item) return;
  draft.value.config.operation = clone(item.reference);
  draft.value.input_schema = clone(item.input_schema);
  draft.value.output_schema = clone(item.output_schema);
  draft.value.execution_policy = item.read_only ? "read_only" : "direct";
  const published = application.data.value?.versions.find(
    (v: JsonObject) =>
      v.kind === "connector" &&
      v.resource_id === item.reference.connector_id &&
      v.version === item.reference.version,
  );
  operationDraft.value = clone(
    published?.definition.operations.find(
      (o: JsonObject) => o.id === item.reference.operation_id,
    ) || {},
  );
  operationBaseline.value = JSON.stringify(operationDraft.value);
}
watch(
  () => application.data.value,
  () => {
    if (operation.value && !operationDraft.value)
      chooseOperation(operation.value);
  },
);
function chooseSource(value: string) {
  sourceId.value = value;
  draft.value.config.resource = { resource_id: value, version: "latest" };
}
async function chooseSubflow(value: string) {
  await task.run(async () => {
    subflowId.value = value;
    const row = query.data.value?.definitions.find(
      (r) => r.kind === "subflow" && r.agent_id === value,
    );
    if (!row) return;
    const published = await workflow(
      "GET",
      `/definitions/subflow/${value}/versions/${row.active_version}`,
    );
    draft.value.config.resource = {
      resource_id: value,
      version: row.active_version,
    };
    draft.value.input_schema = clone(published.definition.input_schema);
    draft.value.output_schema = clone(published.definition.output_schema);
    draft.value.execution_policy = "direct";
  }, false);
}
function chooseBuiltin(value: string) {
  builtinId.value = value;
  const row = native.data.value?.tools.find((r: JsonObject) => r.id === value);
  if (!row) return;
  draft.value.config.tool_id = value;
  draft.value.input_schema = clone(row.input_schema);
  draft.value.output_schema = clone(row.output_schema);
  draft.value.execution_policy = row.read_only ? "read_only" : "direct";
}
async function saveDraft() {
  if (draft.value.kind === "api" && operationDraft.value) {
    operationDraft.value.identity_field ||= null;
    operationDraft.value.idempotency_header ||= null;
    operationDraft.value.input_schema = clone(draft.value.input_schema);
    operationDraft.value.output_schema = clone(draft.value.output_schema);
    if (JSON.stringify(operationDraft.value) !== operationBaseline.value) {
      const ref = draft.value.config.operation,
        connection = application.data.value?.resources.find(
          (c: JsonObject) =>
            c.kind === "connector" && c.resource_id === ref.connector_id,
        );
      if (!connection) throw new Error("connection_required");
      const config = clone(connection.draft);
      config.schema_version = 2;
      config.operations = config.operations.map((o: JsonObject) =>
        o.id === ref.operation_id ? clone(operationDraft.value) : o,
      );
      const saved = await request(
        "PUT",
        "/application/resources/connector/" + ref.connector_id,
        { definition: config, expected_revision: connection.revision },
      );
      const published = await request(
        "POST",
        "/application/resources/connector/" + ref.connector_id + "/publish",
        { expected_revision: saved.revision },
      );
      draft.value.config.operation.version = published.version;
      draft.value.execution_policy = operationDraft.value.read_only
        ? "read_only"
        : "direct";
      operationBaseline.value = JSON.stringify(operationDraft.value);
    }
  }
  if (isNew.value && id.value === "new")
    id.value = identifier(draft.value.name);
  const saved = await workflow("PUT", "/tools/" + id.value, {
    definition: draft.value,
    expected_revision: revision.value,
  });
  revision.value = saved.revision;
  guard.saved();
  await refreshInventory();
  if (isNew.value) await router.replace("/tools/" + id.value);
}
async function publish() {
  await task.run(async () => {
    await saveDraft();
    const result = await workflow("POST", "/tools/" + id.value + "/publish", {
      expected_revision: revision.value,
    });
    revision.value = result.revision;
    await refreshInventory();
  });
}
async function runMock() {
  await task.run(async () => {
    testResult.value = await workflow("POST", "/tools/test", {
      definition: draft.value,
      arguments: args.value,
      fixture: fixture.value,
      rows: mockRows.value,
      columns: sourceColumns.value,
      identity: mockIdentity.value,
    });
  }, false);
}
async function revokeVersion() {
  await task.run(async () => {
    const row = query.data.value?.tools.find((r) => r.tool_id === id.value);
    await workflow(
      "DELETE",
      `/tools/${id.value}/versions/${row?.published_version}`,
    );
    revoke.value = false;
    await refreshInventory();
  });
}
</script>
<template>
  <PageHeader :title="isNew ? t('newTool') : draft.name"
    ><RouterLink to="/tools"
      ><NeButton>{{ t("back") }}</NeButton></RouterLink
    ></PageHeader
  >
  <NeInlineNotification
    v-if="task.error.value"
    kind="error"
    :title="task.error.value"
    class="mb-6"
  />
  <div v-if="isNew && !started" class="grid gap-6 md:grid-cols-2">
    <div
      v-for="kind in ['api', 'query', 'documents', 'telephony', 'subflow']"
      :key="kind"
      class="nv-panel space-y-4"
    >
      <h2>{{ t(kind + "Tool") }}</h2>
      <p class="nv-muted">
        {{
          kind === "documents"
            ? t("localSearch")
            : kind === "query"
              ? t("queryHelp")
              : t("toolsHelp")
        }}
      </p>
      <NeButton
        kind="primary"
        @click="chooseKind(kind as ToolDefinition['kind'])"
        >{{ t("config") }}</NeButton
      >
    </div>
  </div>
  <div v-else class="nv-stack">
    <section class="nv-panel space-y-6">
      <NeStepper :total-steps="3" :current-step="1" :step-label="t('config')" />
      <div class="nv-field-grid">
        <NeTextInput v-model="draft.name" :label="t('name')" /><NeTextArea
          v-model="draft.description"
          :label="t('toolInstructions')"
          :rows="3"
        />
      </div>
      <template v-if="draft.kind === 'api'"
        ><FieldSelect
          :model-value="operation"
          :label="t('apiTool')"
          :options="
            (query.data.value?.connector_operations || []).map((o) => ({
              id: o.id,
              label: o.name,
            }))
          "
          @update:model-value="chooseOperation"
        /><RouterLink to="/settings/connections"
          ><NeButton kind="tertiary">{{
            t("manageConnections")
          }}</NeButton></RouterLink
        >
        <div v-if="operationDraft" class="nv-stack">
          <div class="nv-field-grid">
            <FieldSelect
              v-model="operationDraft.method"
              label="HTTP method"
              :options="
                ['GET', 'POST', 'PUT', 'PATCH'].map((id) => ({ id, label: id }))
              "
            /><NeTextInput v-model="operationDraft.path" label="HTTP path" />
          </div>
          <FieldSelect
            :model-value="operationDraft.read_only ? 'read_only' : 'direct'"
            :label="t('permissions')"
            :options="[
              { id: 'read_only', label: t('readOnly') },
              { id: 'direct', label: t('directWrite') },
            ]"
            @update:model-value="
              operationDraft.read_only = $event === 'read_only';
              operationDraft.public_voice =
                operationDraft.read_only && !operationDraft.identity_field;
              draft.execution_policy = $event as 'read_only' | 'direct';
            "
          /><NeExpandable :label="t('advanced')"
            ><JsonEditor
              v-model="operationDraft.body"
              label="Body mapping"
              shape="object" /><JsonEditor
              v-model="operationDraft.query"
              label="Query mapping"
              shape="object" /><JsonEditor
              v-model="operationDraft.projection"
              :label="t('result')"
              shape="object" /><NeTextInput
              v-model="operationDraft.identity_field"
              :label="t('identityField')" /><NeTextInput
              v-model="operationDraft.idempotency_header"
              label="Idempotency header"
          /></NeExpandable>
        </div>
      </template>
      <template v-if="['query', 'documents'].includes(draft.kind)"
        ><FieldSelect
          :model-value="sourceId"
          :label="t('source')"
          :options="
            (query.data.value?.data_sources || [])
              .filter(
                (s) =>
                  s.published_version &&
                  (draft.kind === 'documents') ===
                    (s.settings.kind === 'documents'),
              )
              .map((s) => ({ id: s.resource_id, label: s.settings.name }))
          "
          @update:model-value="chooseSource"
        />
        <div class="nv-field-grid">
          <FieldSelect
            :model-value="String(draft.config.resource.version)"
            :label="t('version')"
            :options="[
              { id: 'latest', label: t('versionLatest') },
              ...Array.from(
                { length: source?.published_version || 0 },
                (_, i) => ({ id: String(i + 1), label: 'v' + (i + 1) }),
              ),
            ]"
            @update:model-value="
              draft.config.resource.version =
                $event === 'latest' ? 'latest' : Number($event)
            "
          /><NeTextInput
            :model-value="String(draft.config.max_age_seconds)"
            :label="t('freshness')"
            type="number"
            @update:model-value="draft.config.max_age_seconds = Number($event)"
          />
        </div>
        <template v-if="draft.kind === 'query'"
          ><NeMultiselectCombobox
            v-model="selectedFields"
            :options="fieldOptions"
            :label="t('returnedFields')"
            :no-results-label="t('noResults')"
            :no-options-label="t('noOptions')"
            :optional-label="t('optional')"
            :user-input-label="t('choose')"
            :limited-options-label="t('returnedFields')" /><JsonEditor
            v-model="draft.config.filters"
            :label="t('queryFilters')"
            shape="array" />
          <p class="nv-muted">{{ t("queryHelp") }}</p>
          <NeExpandable :label="t('advanced')"
            ><JsonEditor
              :model-value="draft.config.sort || {}"
              :label="t('sort')"
              shape="object"
              @update:model-value="
                Object.keys($event).length
                  ? (draft.config.sort = $event)
                  : delete draft.config.sort
              " /><JsonEditor
              :model-value="draft.config.aggregate || {}"
              :label="t('aggregate')"
              shape="object"
              @update:model-value="
                Object.keys($event).length
                  ? (draft.config.aggregate = $event)
                  : delete draft.config.aggregate
              " /></NeExpandable
        ></template>
        <NeTextInput
          :model-value="String(draft.config.limit)"
          :label="t('limit')"
          type="number"
          @update:model-value="draft.config.limit = Number($event)"
        />
      </template>
      <FieldSelect
        v-if="draft.kind === 'subflow'"
        :model-value="subflowId"
        :label="t('subflowTool')"
        :options="
          (query.data.value?.definitions || [])
            .filter(
              (d) => d.kind === 'subflow' && d.enabled && d.active_version,
            )
            .map((d) => ({ id: d.agent_id, label: d.draft.name }))
        "
        @update:model-value="chooseSubflow"
      />
      <FieldSelect
        v-if="draft.kind === 'telephony'"
        :model-value="builtinId"
        :label="t('telephonyTool')"
        :options="
          (native.data.value?.tools || []).map((d: any) => ({
            id: d.id,
            label: d.description,
          }))
        "
        @update:model-value="chooseBuiltin"
      />
      <p v-if="draft.execution_policy === 'direct'" class="nv-muted">
        {{ t("directHelp") }}
      </p>
      <NeTextInput
        :model-value="String(draft.timeout_seconds)"
        :label="t('timeout')"
        type="number"
        @update:model-value="draft.timeout_seconds = Number($event)"
      />
    </section>
    <section class="nv-panel space-y-6">
      <h2>{{ t("parameters") }}</h2>
      <ParameterEditor
        v-model="draft.input_schema"
        :readonly="['telephony', 'subflow'].includes(draft.kind)"
        :label="t('inputs')"
      /><ParameterEditor
        v-model="draft.output_schema"
        :readonly="['telephony', 'subflow'].includes(draft.kind)"
        :label="t('outputs')"
      />
    </section>
    <section class="nv-panel space-y-5">
      <h2>{{ t("simulation") }}</h2>
      <p class="nv-muted">{{ t("simulationHelp") }}</p>
      <JsonEditor
        v-model="args"
        :label="t('arguments')"
        shape="object"
      /><JsonEditor
        v-if="!['query', 'documents'].includes(draft.kind)"
        v-model="fixture"
        :label="t('fixture')"
        shape="object"
      /><template v-else
        ><JsonEditor
          v-model="mockRows"
          :label="t('mockTables')"
          shape="array" /><JsonEditor
          v-model="mockIdentity"
          :label="t('identity')"
          shape="object" /></template
      ><NeButton :loading="task.pending.value" @click="runMock">{{
        t("runMock")
      }}</NeButton>
      <pre
        v-if="testResult"
        class="overflow-auto whitespace-pre-wrap rounded-md bg-gray-100 p-4 text-xs dark:bg-gray-900"
        >{{ JSON.stringify(testResult.result, null, 2) }}</pre>
    </section>
    <section class="nv-panel">
      <h2 class="mb-4">{{ t("dependencies") }}</h2>
      <div
        v-for="d in query.data.value?.dependencies.filter(
          (d) => d.kind === 'tool' && d.resource_id === id,
        ) || []"
        :key="JSON.stringify(d)"
        class="py-2"
      >
        <RouterLink
          :to="'/agents/' + d.agent_id + '/tools'"
          class="text-primary-700 dark:text-primary-400"
          >{{ d.agent_id }} ·
          {{ d.version ? "v" + d.version : t("draft") }}</RouterLink
        >
      </div>
    </section>
    <div class="nv-action-bar">
      <NeButton :loading="task.pending.value" @click="task.run(saveDraft)">{{
        t("save")
      }}</NeButton
      ><NeButton
        kind="primary"
        :loading="task.pending.value"
        @click="publish"
        >{{ t("publish") }}</NeButton
      ><NeButton v-if="!isNew" kind="danger" @click="revoke = true">{{
        t("revoke")
      }}</NeButton>
    </div>
  </div>
  <NeModal
    :visible="revoke"
    :title="t('revoke')"
    :primary-label="t('revoke')"
    :cancel-label="t('cancel')"
    primary-button-kind="danger"
    :close-aria-label="t('close')"
    @close="revoke = false"
    @primary-click="revokeVersion"
    ><p>{{ t("removeToolHelp") }}</p></NeModal
  >
</template>
