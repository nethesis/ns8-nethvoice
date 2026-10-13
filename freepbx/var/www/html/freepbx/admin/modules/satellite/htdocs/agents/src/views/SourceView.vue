<script setup lang="ts">
import { computed, ref, watch, onUnmounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useQuery } from "@tanstack/vue-query";
import {
  NeTextInput,
  NeCheckbox,
  NeFileInput,
  NeButton,
  NeStepper,
  NeExpandable,
  NeInlineNotification,
  NeProgressBar,
  NeModal,
} from "@nethesis/vue-components";
import { useI18n } from "vue-i18n";
import { inventory, request, workflow, refreshInventory } from "../api";
import { base64, clone, identifier } from "../model";
import { useDraftGuard } from "../composables/useDraftGuard";
import { useTask } from "../composables/useTask";
import PageHeader from "../components/PageHeader.vue";
import FieldSelect from "../components/FieldSelect.vue";
import JsonEditor from "../components/JsonEditor.vue";
import CatalogTable from "../components/CatalogTable.vue";
import StatusBadge from "../components/StatusBadge.vue";
import type { JsonObject } from "../types";
const { t } = useI18n();
const route = useRoute(),
  router = useRouter();
const task = useTask();
const query = useQuery({ queryKey: ["inventory"], queryFn: inventory });
const application = useQuery({
  queryKey: ["application"],
  queryFn: () => request("GET", "/application/inventory"),
});
const id = ref(String(route.params.id)),
  revision = ref(0),
  initialized = ref(false),
  selectedKind = ref(false);
const settings = ref<JsonObject>({
  name: "",
  kind: "table",
  format: "csv",
  columns: [],
  mapping: {},
  country_code: "39",
  decimal_separator: ".",
  header_row: 1,
  delimiter: ",",
});
const file = ref<File | File[] | null>(null),
  documentFile = ref<File | File[] | null>(null),
  documents = ref<
    { document_id: string; name: string; format: string; content: string }[]
  >([]);
const removedDocuments = ref<string[]>([]),
  preview = ref<JsonObject>(),
  job = ref<JsonObject>(),
  revoked = ref(false);
let timer: ReturnType<typeof setTimeout> | undefined;
let alive = true;
onUnmounted(() => {
  alive = false;
  if (timer) clearTimeout(timer);
});
const guard = useDraftGuard(() => settings.value);
const row = computed(() =>
  query.data.value?.data_sources.find((s) => s.resource_id === id.value),
);
const isNew = computed(() => route.params.id === "new");
const isSheets = computed(() =>
  ["google_sheets", "google_csv"].includes(settings.value.format),
);
const existingDocuments = computed(
  () => preview.value?.metadata?.documents || [],
);
watch(
  row,
  (value) => {
    if (value && !initialized.value) {
      settings.value = clone(value.settings);
      guard.saved();
      revision.value = value.revision;
      initialized.value = true;
      selectedKind.value = true;
      if (value.published_version) void loadPreview();
    }
  },
  { immediate: true },
);
function choose(kind: string, format: string) {
  settings.value.kind = kind;
  settings.value.format = format;
  selectedKind.value = true;
  if (kind === "documents") settings.value.columns = undefined;
}
async function rawFile() {
  const selected = Array.isArray(file.value) ? file.value[0] : file.value;
  if (!selected) throw new Error("file_required");
  return base64(selected);
}
async function inspect() {
  await task.run(async () => {
    const payload = isSheets.value
      ? { settings: settings.value }
      : { settings: settings.value, content: await rawFile() };
    const inspected = await workflow("POST", "/data/inspect", payload);
    if (settings.value.kind === "table")
      settings.value.columns = inspected.columns;
    else {
      const names: Record<string, string[]> = {
        resident_id: ["residentid", "idresidente"],
        name: ["name", "nome"],
        period: ["period", "periodo", "mese"],
        amount: ["amount", "importo"],
        currency: ["currency", "valuta"],
        verification_code: ["verificationcode", "codicediverifica", "codice"],
        phone: ["phone", "telefono"],
        building: ["building", "edificio"],
        unit: ["unit", "interno"],
        customer_id: ["customerid", "idcliente"],
      };
      const mapping: JsonObject = {};
      for (const [key, aliases] of Object.entries(names)) {
        const matched = inspected.headers.find((h: string) =>
          aliases.includes(h.toLowerCase().replace(/[^a-z0-9]/g, "")),
        );
        if (matched) mapping[key] = matched;
      }
      settings.value.mapping = mapping;
    }
  }, false);
}
watch(file, (value) => {
  if (value) void inspect();
});
async function addDocument() {
  const selected = Array.isArray(documentFile.value)
    ? documentFile.value
    : documentFile.value
      ? [documentFile.value]
      : [];
  await task.run(async () => {
    for (const f of selected) {
      const existing = existingDocuments.value.find(
        (d: JsonObject) => d.name === f.name,
      );
      const document_id = existing?.document_id || identifier(f.name);
      const item = {
        document_id,
        name: f.name,
        format: f.name.toLowerCase().endsWith(".pdf") ? "pdf" : "txt",
        content: await base64(f),
      };
      documents.value = documents.value
        .filter((d) => d.document_id !== document_id && d.name !== f.name)
        .concat(item);
    }
    documentFile.value = null;
  }, false);
}
async function saveDraft(navigate = true) {
  if (isNew.value && id.value === "new")
    id.value = identifier(settings.value.name);
  if (settings.value.format === "google_sheets") {
    const url = String(settings.value.spreadsheet_id || "");
    settings.value.spreadsheet_id =
      url.match(/\/spreadsheets\/d\/([A-Za-z0-9_-]+)/)?.[1] || url;
  }
  const saved = await workflow("PUT", "/data/" + id.value, {
    settings: settings.value,
    expected_revision: revision.value,
  });
  revision.value = saved.revision;
  guard.saved();
  await refreshInventory();
  if (navigate && isNew.value) await router.replace("/sources/" + id.value);
}
async function previewFile() {
  await task.run(async () => {
    preview.value = await workflow("POST", "/data/preview", {
      settings: settings.value,
      ...(isSheets.value ? {} : { content: await rawFile() }),
    });
  }, false);
}
async function loadPreview() {
  if (!row.value?.published_version) return;
  await task.run(async () => {
    preview.value = await workflow(
      "GET",
      `/data/${id.value}/versions/${row.value!.published_version}/preview`,
    );
  }, false);
}
async function poll() {
  if (!alive || !job.value) return;
  try {
    const current = await workflow("GET", "/jobs/" + job.value.job_id);
    job.value = current;
    if (["queued", "processing"].includes(current.state))
      timer = setTimeout(() => {
        void poll();
      }, 1500);
    else {
      await refreshInventory();
      revision.value = row.value?.revision || revision.value;
      if (current.state === "ready") {
        await loadPreview();
        if (isNew.value) await router.replace("/sources/" + id.value);
      } else task.error.value = current.error_code || t("error.request_failed");
    }
  } catch {
    task.error.value = t("error.request_failed");
  }
}
async function publish() {
  await task.run(async () => {
    await saveDraft(false);
    job.value =
      settings.value.kind === "documents"
        ? await workflow("POST", "/documents/" + id.value + "/publish", {
            expected_revision: revision.value,
            files: documents.value,
            remove: removedDocuments.value,
          })
        : await workflow(
            "POST",
            "/data/" + id.value + (isSheets.value ? "/refresh" : "/publish"),
            {
              expected_revision: revision.value,
              ...(isSheets.value ? {} : { content: await rawFile() }),
            },
          );
    documents.value = [];
    removedDocuments.value = [];
    void poll();
  });
}
async function revokeVersion() {
  await task.run(async () => {
    await workflow(
      "DELETE",
      `/data/${id.value}/versions/${row.value?.published_version}`,
    );
    revoked.value = false;
    await refreshInventory();
  });
}
function addColumn() {
  settings.value.columns.push({
    name: "field_" + (settings.value.columns.length + 1),
    source: "",
    type: "string",
    required: false,
    sensitive: false,
  });
}
const busy = computed(
  () =>
    task.pending.value ||
    ["queued", "processing"].includes(job.value?.state || ""),
);
</script>
<template>
  <PageHeader :title="isNew ? t('newSource') : settings.name"
    ><RouterLink to="/sources"
      ><NeButton>{{ t("back") }}</NeButton></RouterLink
    ><StatusBadge
      v-if="row"
      :status="row.status"
      :version="row.published_version"
  /></PageHeader>
  <NeInlineNotification
    v-if="task.error.value"
    kind="error"
    :title="task.error.value"
    class="mb-6"
  />
  <div v-if="isNew && !selectedKind" class="grid gap-6 md:grid-cols-2">
    <div class="nv-panel space-y-4">
      <h2>{{ t("table") }}</h2>
      <p class="nv-muted">CSV · Excel · Google Sheets</p>
      <div class="nv-action-bar">
        <NeButton kind="primary" @click="choose('table', 'csv')">{{
          t("upload")
        }}</NeButton
        ><NeButton @click="choose('table', 'google_sheets')"
          >Google Sheets</NeButton
        >
      </div>
    </div>
    <div class="nv-panel space-y-4">
      <h2>{{ t("documents") }}</h2>
      <p class="nv-muted">{{ t("localSearch") }}</p>
      <NeButton kind="primary" @click="choose('documents', 'documents')">{{
        t("upload")
      }}</NeButton>
    </div>
  </div>
  <template v-else
    ><section class="nv-panel space-y-6">
      <NeStepper
        :total-steps="3"
        :current-step="preview ? 3 : 2"
        :step-label="t('source')"
      />
      <fieldset :disabled="busy" class="space-y-6">
        <NeTextInput v-model="settings.name" :label="t('name')" />
        <template v-if="settings.kind !== 'documents'"
          ><div class="nv-field-grid">
            <FieldSelect
              :model-value="settings.kind || 'payment'"
              :label="t('template')"
              :options="[
                { id: 'table', label: t('table') },
                { id: 'payment', label: t('payment') },
              ]"
              @update:model-value="settings.kind = $event"
            /><FieldSelect
              v-model="settings.format"
              :label="t('format')"
              :options="
                ['csv', 'xlsx', 'text', 'google_sheets', 'google_csv'].map(
                  (id) => ({
                    id,
                    label:
                      id === 'google_sheets'
                        ? 'Google Sheets'
                        : id === 'google_csv'
                          ? 'Google CSV'
                          : id.toUpperCase(),
                  }),
                )
              "
            />
          </div>
          <div v-if="isSheets" class="nv-field-grid">
            <template v-if="settings.format === 'google_sheets'"
              ><NeTextInput
                v-model="settings.spreadsheet_id"
                :label="t('spreadsheet')" /><NeTextInput
                v-model="settings.range"
                :label="t('range')" /><FieldSelect
                :model-value="settings.secret_ref || ''"
                :label="t('credential')"
                :options="
                  (application.data.value?.secrets || [])
                    .filter((s: any) => !s.revoked)
                    .map((s: any) => ({ id: s.secret_id, label: s.secret_id }))
                "
                @update:model-value="settings.secret_ref = $event" /></template
            ><NeTextInput
              v-else
              v-model="settings.published_url"
              label="Google published CSV URL"
            /><NeTextInput
              :model-value="String(settings.refresh_seconds || 0)"
              :label="t('refreshSeconds')"
              type="number"
              @update:model-value="settings.refresh_seconds = Number($event)"
            /><NeButton @click="inspect">{{ t("testConnection") }}</NeButton>
          </div>
          <NeFileInput
            v-else
            v-model="file"
            :label="t('upload')"
            :dropzone-label="t('dropzone')"
            :accept="settings.format === 'xlsx' ? '.xlsx' : '.csv,.txt'"
          />
          <div class="nv-field-grid">
            <NeTextInput
              :model-value="String(settings.header_row)"
              :label="t('headerRow')"
              type="number"
              @update:model-value="settings.header_row = Number($event)"
            /><NeTextInput
              v-model="settings.decimal_separator"
              :label="t('decimal')"
            /><NeTextInput
              v-model="settings.delimiter"
              :label="t('delimiter')"
            /><NeTextInput
              v-if="settings.format === 'xlsx'"
              v-model="settings.sheet"
              :label="t('sheet')"
            />
          </div>
          <h2>{{ t("mapping") }}</h2>
          <template v-if="settings.kind === 'table'"
            ><div
              v-for="(column, index) in settings.columns"
              :key="index"
              class="grid items-end gap-4 rounded-md border border-gray-200 p-4 dark:border-gray-600 md:grid-cols-3"
            >
              <NeTextInput
                v-model="column.source"
                :label="t('sourceColumn')"
              /><NeTextInput
                v-model="column.name"
                :label="t('field')"
              /><FieldSelect
                v-model="column.type"
                :label="t('type')"
                :options="
                  [
                    'string',
                    'integer',
                    'number',
                    'boolean',
                    'date',
                    'month',
                  ].map((id) => ({ id, label: id }))
                "
              /><NeCheckbox
                v-model="column.required"
                :label="t('required')"
              /><NeCheckbox
                v-model="column.sensitive"
                :label="t('sensitive')"
              /><NeButton
                kind="tertiary"
                @click="settings.columns.splice(index, 1)"
                >{{ t("remove") }}</NeButton
              >
            </div>
            <NeButton @click="addColumn">{{
              t("addColumn")
            }}</NeButton></template
          >
          <template v-else
            ><div class="nv-field-grid">
              <NeTextInput
                v-for="field in [
                  'resident_id',
                  'name',
                  'period',
                  'amount',
                  'currency',
                  'verification_code',
                ]"
                :key="field"
                :model-value="settings.mapping[field] || ''"
                :label="field"
                @update:model-value="settings.mapping[field] = $event"
              />
            </div>
            <NeExpandable :label="t('advanced')"
              ><JsonEditor
                v-model="settings.mapping"
                :label="t('mapping')"
                shape="object" /></NeExpandable
          ></template>
          <NeButton :loading="task.pending.value" @click="previewFile">{{
            t("preview")
          }}</NeButton>
        </template>
        <template v-else
          ><p class="nv-muted">{{ t("filesHelp") }}</p>
          <NeFileInput
            v-model="documentFile"
            :label="t('upload')"
            :dropzone-label="t('dropzone')"
            accept=".pdf,.txt"
          /><NeButton :disabled="!documentFile" @click="addDocument">{{
            t("upload")
          }}</NeButton>
          <div
            v-for="document in existingDocuments"
            :key="document.document_id"
            class="flex items-center justify-between gap-4 border-b border-gray-200 py-3 dark:border-gray-600"
          >
            <span>{{ document.name }}</span
            ><StatusBadge :status="document.state" /><NeButton
              kind="tertiary"
              @click="removedDocuments.push(document.document_id)"
              >{{
                removedDocuments.includes(document.document_id)
                  ? t("removed")
                  : t("remove")
              }}</NeButton
            >
          </div>
          <div
            v-for="document in documents"
            :key="document.document_id"
            class="flex items-center justify-between py-3"
          >
            <span>{{ document.name }}</span
            ><NeButton
              kind="tertiary"
              @click="
                documents = documents.filter(
                  (d) => d.document_id !== document.document_id,
                )
              "
              >{{ t("remove") }}</NeButton
            >
          </div>
        </template>
      </fieldset>
    </section>
    <section
      v-if="preview && settings.kind !== 'documents'"
      class="nv-panel mt-6 space-y-5"
    >
      <h2>{{ t("preview") }}</h2>
      <p>
        {{ t("rowCount") }}:
        {{ preview.row_count || preview.metadata?.row_count }}
      </p>
      <NeInlineNotification
        v-if="preview.errors?.length"
        kind="error"
        :title="t('errors')"
        :description="
          preview.errors.map((e: any) => e.row + ': ' + e.error).join(' · ')
        "
      /><CatalogTable
        :rows="preview.rows || []"
        row-key="source_row"
        :columns="
          Object.keys(preview.rows?.[0] || {}).map((key) => ({
            key,
            label: key,
          }))
        "
      />
    </section>
    <section v-if="job" class="nv-panel mt-6 space-y-4">
      <StatusBadge :status="job.state" /><NeProgressBar
        v-if="['queued', 'processing'].includes(job.state)"
        :progress="0"
        :indeterminate="true"
        :label="t('loading')"
      />
    </section>
    <section class="nv-panel mt-6">
      <h2 class="mb-4">{{ t("dependencies") }}</h2>
      <div
        v-for="d in query.data.value?.dependencies.filter(
          (d) => d.kind === 'source' && d.resource_id === id,
        ) || []"
        :key="JSON.stringify(d)"
        class="py-2"
      >
        <RouterLink
          :to="
            d.tool_id
              ? '/tools/' + d.tool_id
              : '/agents/' + d.agent_id + '/workflow'
          "
          class="text-primary-700 dark:text-primary-400"
          >{{ d.tool_id || d.agent_id }} · v{{ d.version }}</RouterLink
        >
      </div>
    </section>
    <div class="nv-action-bar mt-6">
      <NeButton :disabled="busy" @click="task.run(saveDraft)">{{
        t("save")
      }}</NeButton
      ><NeButton
        kind="primary"
        :disabled="busy || Boolean(preview?.errors?.length)"
        @click="publish"
        >{{ t(isSheets ? "refreshSource" : "publishSource") }}</NeButton
      ><NeButton
        v-if="row?.published_version"
        kind="danger"
        :disabled="busy"
        @click="revoked = true"
        >{{ t("revoke") }}</NeButton
      >
    </div></template
  >
  <NeModal
    :visible="revoked"
    :title="t('revoke')"
    :primary-label="t('revoke')"
    :cancel-label="t('cancel')"
    primary-button-kind="danger"
    :close-aria-label="t('close')"
    @close="revoked = false"
    @primary-click="revokeVersion"
    ><p>
      {{ t("dependencies") }}:
      {{
        query.data.value?.dependencies.filter(
          (d) => d.kind === "source" && d.resource_id === id,
        ).length || 0
      }}
    </p></NeModal
  >
</template>
