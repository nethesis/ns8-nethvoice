<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useQuery } from "@tanstack/vue-query";
import {
  NeButton,
  NeTextInput,
  NeTextArea,
  NeToggle,
  NeCheckbox,
  NeInlineNotification,
  NeSideDrawer,
  NeExpandable,
  NeModal,
  NeMultiselectCombobox,
} from "@nethesis/vue-components";
import { useI18n } from "vue-i18n";
import { request, workflow, inventory, refreshInventory } from "../api";
import { clone, identifier, objectSchema } from "../model";
import { useTask } from "../composables/useTask";
import PageHeader from "../components/PageHeader.vue";
import AccessibleTabs from "../components/AccessibleTabs.vue";
import FieldSelect from "../components/FieldSelect.vue";
import JsonEditor from "../components/JsonEditor.vue";
import CatalogTable from "../components/CatalogTable.vue";
import PresetEditor from "../components/PresetEditor.vue";
import type { JsonObject } from "../types";
const { t } = useI18n(),
  route = useRoute(),
  router = useRouter();
const task = useTask();
const tab = computed(() => String(route.params.tab || "connections"));
const tabs = computed(() =>
  ["connections", "native", "history", "api-access"].map((name) => ({
    name,
    label: t(name === "api-access" ? "apiAccess" : name),
  })),
);
const app = useQuery({
  queryKey: ["application"],
  queryFn: () => request("GET", "/application/inventory"),
});
const native = useQuery({
  queryKey: ["native"],
  queryFn: () => request("GET", "/native/inventory"),
});
const agents = useQuery({ queryKey: ["inventory"], queryFn: inventory });
const policyQuery = useQuery({
  queryKey: ["policy"],
  queryFn: () => request("GET", "/policy"),
});
const policy = ref<JsonObject>(),
  policyRevision = ref(0);
watch(
  () => policyQuery.data.value,
  (value) => {
    if (value && !policy.value) {
      policy.value = clone(value.policy);
      policyRevision.value = value.sync.desired_revision;
    }
  },
  { immediate: true },
);
const connection = ref<JsonObject>(),
  connectionId = ref(""),
  connectionRevision = ref(0);
const trunk = ref<JsonObject>(),
  secret = ref({ secret_id: "", value: "" }),
  replaceId = ref(""),
  token = ref("");
const testOperation = ref(""),
  testArgs = ref<JsonObject>({}),
  showTest = ref(false);
const revokeClient = ref("");
const revokeSecret = ref("");
async function removeSecret() {
  await task.run(async () => {
    await request("DELETE", "/application/secrets/" + revokeSecret.value);
    revokeSecret.value = "";
    replaceId.value = "";
    await refreshInventory();
  });
}
const client = ref({
  client_id: "",
  presets: "",
  customer_ids: "",
  days: "30",
  scopes: {
    "runs:create": true,
    "runs:read": true,
    "runs:cancel": false,
    "operations:write": false,
  } as Record<string, boolean>,
});
const selectedOperations = ref<
  { id: string; label: string; rawObj: JsonObject }[]
>([]);
const operationOptions = computed(() =>
  (agents.data.value?.connector_operations || []).map((o) => ({
    id: o.id,
    label: o.name,
    rawObj: o.reference,
  })),
);
const connections = computed(() =>
  (app.data.value?.resources || [])
    .filter((r: JsonObject) => r.kind === "connector")
    .map((r: JsonObject) => ({
      ...r,
      name: r.draft.name,
      origin: r.draft.origin,
      status: r.published_version ? "ready" : "draft",
    })),
);
function editConnection(row?: JsonObject) {
  connectionId.value = row?.resource_id || "";
  connectionRevision.value = row?.revision || 0;
  connection.value = row
    ? clone(row.draft)
    : {
        schema_version: 2,
        name: "",
        origin: "",
        secret_ref: "",
        auth: { type: "bearer" },
        private_networks: [],
        operations: [
          {
            id: "read",
            description: "Read service information",
            method: "GET",
            path: "/",
            input_schema: objectSchema(),
            output_schema: objectSchema(),
            query: {},
            body: {},
            projection: {},
            read_only: true,
            public_voice: true,
            timeout_seconds: 10,
            identity_field: null,
          },
        ],
      };
}
async function saveConnection(publish: boolean) {
  await task.run(async () => {
    if (!connection.value) return;
    if (!connectionId.value)
      connectionId.value = identifier(connection.value.name);
    const result = await request(
      "PUT",
      "/application/resources/connector/" + connectionId.value,
      {
        definition: connection.value,
        expected_revision: connectionRevision.value,
      },
    );
    connectionRevision.value = result.revision;
    if (publish) {
      const version = await request(
        "POST",
        "/application/resources/connector/" + connectionId.value + "/publish",
        { expected_revision: connectionRevision.value },
      );
      connectionRevision.value = version.revision || connectionRevision.value;
    }
    await refreshInventory();
    connection.value = undefined;
  });
}
async function saveSecret() {
  await task.run(async () => {
    if (replaceId.value)
      await workflow("PUT", "/credentials/" + replaceId.value, {
        value: secret.value.value,
      });
    else await request("POST", "/application/secrets", secret.value);
    secret.value = { secret_id: "", value: "" };
    replaceId.value = "";
    await refreshInventory();
  });
}
function editTrunk(row?: JsonObject) {
  trunk.value = row
    ? {
        ...clone(row),
        enabled: Boolean(row.enabled),
        api_key: "",
        sip_auth_password: "",
        webhook_signing_secret: "",
      }
    : {
        name: "",
        provider: "openai",
        runtime_owner: "builtin",
        openai_project_id: "",
        grok_phone_number: "",
        sip_auth_mode: "none",
        sip_auth_username: "",
        api_key: "",
        sip_auth_password: "",
        webhook_signing_secret: "",
        enabled: true,
      };
}
async function saveTrunk() {
  await task.run(async () => {
    if (!trunk.value) return;
    const fields = [
      "name",
      "provider",
      "runtime_owner",
      "openai_project_id",
      "grok_phone_number",
      "sip_auth_mode",
      "sip_auth_username",
      "api_key",
      "sip_auth_password",
      "webhook_signing_secret",
    ];
    const binding = Object.fromEntries(
      fields.map((name) => [name, trunk.value![name]]),
    );
    await request(
      trunk.value.id ? "PUT" : "POST",
      "/native/bindings" + (trunk.value.id ? "/" + trunk.value.id : ""),
      { binding },
    );
    trunk.value = undefined;
    await refreshInventory();
  });
}
async function savePolicy() {
  await task.run(async () => {
    const result = await request("PUT", "/policy", {
      metadata_retention_days: policy.value?.metadata_retention_days,
      transcript_retention_days: policy.value?.transcript_retention_days,
      transcripts: policy.value?.transcripts,
      expected_revision: policyRevision.value,
    });
    policy.value = result.policy;
    policyRevision.value = result.revision;
  });
}
async function enabled(value: boolean) {
  await task.run(async () => {
    await request("PUT", "/application/settings", { enabled: value });
    await refreshInventory();
  });
}
async function createClient() {
  await task.run(async () => {
    const result = await request("POST", "/application/clients", {
      client_id: client.value.client_id,
      presets: client.value.presets
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      customer_ids: client.value.customer_ids
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      operations: selectedOperations.value.map((o) => o.rawObj),
      scopes: Object.keys(client.value.scopes).filter(
        (s) => client.value.scopes[s],
      ),
      expires:
        Math.floor(Date.now() / 1000) + Number(client.value.days) * 86400,
    });
    token.value = result.token;
    await refreshInventory();
  });
}
async function revoke() {
  await task.run(async () => {
    await request("DELETE", "/application/clients/" + revokeClient.value);
    revokeClient.value = "";
    await refreshInventory();
  });
}
async function probe() {
  await task.run(async () => {
    const op = agents.data.value?.connector_operations.find(
      (o) => o.id === testOperation.value,
    );
    if (!op) return;
    await workflow("POST", "/connections/test", {
      operation: op.reference,
      arguments: testArgs.value,
    });
    showTest.value = false;
  });
}
</script>
<template>
  <PageHeader
    :title="t('settings')"
    :description="t('settingsHelp')"
  /><AccessibleTabs
    :sr-tabs-label="t('settings')"
    :tabs="tabs"
    :selected="tab"
    @select-tab="router.push('/settings/' + $event)"
  /><NeInlineNotification
    v-if="task.error.value"
    kind="error"
    :title="task.error.value"
    class="mt-6"
  />
  <div v-if="tab === 'connections'" class="nv-stack mt-6">
    <section class="nv-panel space-y-6">
      <NeToggle
        :model-value="Boolean(app.data.value?.enabled)"
        :label="t('enabled')"
        @update:model-value="enabled"
      />
      <div class="nv-action-bar">
        <NeButton kind="primary" @click="editConnection()"
          >{{ t("connection") }} +</NeButton
        ><NeButton @click="showTest = true">{{ t("testConnection") }}</NeButton>
      </div>
      <CatalogTable
        :rows="connections"
        row-key="resource_id"
        :columns="[
          { key: 'name', label: t('name') },
          { key: 'origin', label: t('origin') },
          { key: 'status', label: t('state') },
          { key: 'actions', label: t('actions') },
        ]"
        ><template #actions="{ row }"
          ><NeButton kind="tertiary" @click="editConnection(row)">{{
            t("open")
          }}</NeButton></template
        ></CatalogTable
      >
    </section>
    <section class="nv-panel space-y-5">
      <h2>{{ t("credential") }}</h2>
      <div class="nv-field-grid">
        <FieldSelect
          v-model="replaceId"
          :label="t('replaceSecret')"
          :options="[
            { id: '', label: t('addSecret') },
            ...(app.data.value?.secrets || []).map((s: any) => ({
              id: s.secret_id,
              label: s.secret_id,
            })),
          ]"
        /><NeTextInput
          v-if="!replaceId"
          v-model="secret.secret_id"
          :label="t('secretId')"
        /><NeTextArea
          v-model="secret.value"
          :label="t('secretValue')"
          :rows="3"
          autocomplete="off"
        />
      </div>
      <NeButton
        :disabled="!secret.value || (!replaceId && !secret.secret_id)"
        :loading="task.pending.value"
        @click="saveSecret"
        >{{ t(replaceId ? "replaceSecret" : "addSecret") }}</NeButton
      >
      <NeButton
        v-if="replaceId"
        kind="danger"
        @click="revokeSecret = replaceId"
        >{{ t("revokeCredential") }}</NeButton
      >
    </section>
  </div>
  <div v-else-if="tab === 'native'" class="nv-panel mt-6 space-y-6">
    <NeButton kind="primary" @click="editTrunk()"
      >{{ t("provider") }} +</NeButton
    ><CatalogTable
      :rows="native.data.value?.trunks || []"
      row-key="id"
      :columns="[
        { key: 'name', label: t('name') },
        { key: 'provider', label: t('provider') },
        { key: 'status', label: t('state') },
        { key: 'actions', label: t('actions') },
      ]"
      ><template #actions="{ row }"
        ><NeButton kind="tertiary" @click="editTrunk(row)">{{
          t("open")
        }}</NeButton></template
      ></CatalogTable
    ><a
      :href="native.data.value?.webhook_url"
      class="text-primary-700 dark:text-primary-400"
      >{{ native.data.value?.webhook_url }}</a
    >
  </div>
  <div v-else-if="tab === 'history' && policy" class="nv-panel mt-6 space-y-6">
    <div class="nv-field-grid">
      <NeTextInput
        :model-value="String(policy.metadata_retention_days)"
        :label="t('metadataDays')"
        type="number"
        @update:model-value="policy.metadata_retention_days = Number($event)"
      /><NeTextInput
        :model-value="String(policy.transcript_retention_days)"
        :label="t('transcriptDays')"
        type="number"
        @update:model-value="policy.transcript_retention_days = Number($event)"
      />
    </div>
    <NeToggle
      v-for="id in ['internal', 'external']"
      :key="id"
      v-model="policy.transcripts[id]"
      :label="t('transcripts') + ' · ' + id"
    /><NeButton
      kind="primary"
      :loading="task.pending.value"
      @click="savePolicy"
      >{{ t("saveSettings") }}</NeButton
    >
  </div>
  <div v-else-if="tab === 'api-access'" class="nv-stack mt-6">
    <PresetEditor />
    <section class="nv-panel space-y-6">
      <h2>{{ t("apiAccess") }}</h2>
      <div class="nv-field-grid">
        <NeTextInput
          v-model="client.client_id"
          :label="t('clientId')"
        /><NeTextInput
          v-model="client.presets"
          :label="t('workflowIds')"
        /><NeTextInput
          v-model="client.customer_ids"
          :label="t('customers')"
        /><NeTextInput
          v-model="client.days"
          :label="t('expiry')"
          type="number"
        />
      </div>
      <div class="flex flex-wrap gap-5">
        <NeCheckbox
          v-for="scope in Object.keys(client.scopes)"
          :key="scope"
          v-model="client.scopes[scope]"
          :label="scope"
        />
      </div>
      <NeMultiselectCombobox
        v-model="selectedOperations"
        :options="operationOptions"
        :label="t('scopes')"
        :no-results-label="t('noResults')"
        :no-options-label="t('noOptions')"
        :optional-label="t('optional')"
        :user-input-label="t('choose')"
        :limited-options-label="t('scopes')"
      /><NeButton
        kind="primary"
        :loading="task.pending.value"
        @click="createClient"
        >{{ t("createClient") }}</NeButton
      ><NeInlineNotification v-if="token" kind="info" :title="t('tokenOnce')"
        ><template #description
          ><code class="break-all">{{ token }}</code
          ><NeButton class="mt-4" @click="token = ''">{{
            t("hideToken")
          }}</NeButton></template
        ></NeInlineNotification
      >
    </section>
    <section class="nv-panel">
      <div
        v-for="row in app.data.value?.clients || []"
        :key="row.client_id"
        class="flex items-center justify-between py-3"
      >
        <span>{{ row.client_id }}</span
        ><NeButton
          v-if="!row.revoked"
          kind="danger"
          @click="revokeClient = row.client_id"
          >{{ t("revoke") }}</NeButton
        >
      </div>
    </section>
  </div>
  <NeSideDrawer
    :visible="Boolean(connection)"
    :title="t('connection')"
    :close-aria-label="t('close')"
    @close="connection = undefined"
    ><div v-if="connection" class="space-y-6 p-6">
      <NeTextInput v-model="connection.name" :label="t('name')" /><NeTextInput
        v-model="connection.origin"
        :label="t('origin')"
      /><FieldSelect
        v-model="connection.secret_ref"
        :label="t('credential')"
        :options="
          (app.data.value?.secrets || [])
            .filter((s: any) => !s.revoked)
            .map((s: any) => ({ id: s.secret_id, label: s.secret_id }))
        "
      /><FieldSelect
        v-model="connection.auth.type"
        :label="t('authType')"
        :options="
          ['bearer', 'api_key', 'basic_api_key'].map((id) => ({
            id,
            label: id,
          }))
        "
      /><NeTextInput
        v-if="connection.auth.type === 'api_key'"
        v-model="connection.auth.header"
        label="Header"
      /><JsonEditor
        v-model="connection.operations"
        :label="t('apiTool')"
        shape="array"
      /><NeExpandable :label="t('advanced')"
        ><JsonEditor
          v-model="connection.private_networks"
          label="Private networks"
          shape="array" /></NeExpandable
      ><NeButton :loading="task.pending.value" @click="saveConnection(false)">{{
        t("save")
      }}</NeButton
      ><NeButton
        kind="primary"
        :loading="task.pending.value"
        @click="saveConnection(true)"
        >{{ t("publish") }}</NeButton
      >
    </div></NeSideDrawer
  >
  <NeSideDrawer
    :visible="Boolean(trunk)"
    :title="t('provider')"
    :close-aria-label="t('close')"
    @close="trunk = undefined"
    ><div v-if="trunk" class="space-y-5 p-6">
      <NeTextInput v-model="trunk.name" :label="t('name')" /><FieldSelect
        v-model="trunk.provider"
        :label="t('provider')"
        :options="[
          { id: 'openai', label: 'OpenAI' },
          { id: 'grok', label: 'Grok' },
        ]"
      /><FieldSelect
        v-model="trunk.runtime_owner"
        label="Runtime"
        :disabled="Boolean(trunk.id)"
        :options="[
          { id: 'builtin', label: 'Satellite' },
          { id: 'cleverai', label: 'CleverAI' },
        ]"
      /><NeTextInput
        v-if="trunk.provider === 'openai'"
        v-model="trunk.openai_project_id"
        label="OpenAI project ID"
      /><NeTextInput
        v-else
        v-model="trunk.grok_phone_number"
        :label="t('phone')"
      /><NeTextInput
        v-model="trunk.api_key"
        :label="t('secretValue')"
        type="password"
        autocomplete="new-password"
      /><NeTextInput
        v-model="trunk.webhook_signing_secret"
        label="Webhook signing secret"
        type="password"
        autocomplete="new-password"
      /><FieldSelect
        v-model="trunk.sip_auth_mode"
        label="SIP authentication"
        :options="[
          { id: 'none', label: 'None' },
          { id: 'digest', label: 'Digest' },
        ]"
      /><template v-if="trunk.sip_auth_mode === 'digest'"
        ><NeTextInput
          v-model="trunk.sip_auth_username"
          label="SIP user" /><NeTextInput
          v-model="trunk.sip_auth_password"
          label="SIP password"
          type="password"
          autocomplete="new-password" /></template
      ><NeButton
        kind="primary"
        :loading="task.pending.value"
        @click="saveTrunk"
        >{{ t("saveSettings") }}</NeButton
      >
    </div></NeSideDrawer
  >
  <NeModal
    :visible="showTest"
    :title="t('testConnection')"
    :primary-label="t('testConnection')"
    :cancel-label="t('cancel')"
    :close-aria-label="t('close')"
    @close="showTest = false"
    @primary-click="probe"
    ><div class="space-y-5">
      <p>{{ t("connectionTestHelp") }}</p>
      <FieldSelect
        v-model="testOperation"
        :label="t('apiTool')"
        :options="
          (agents.data.value?.connector_operations || [])
            .filter((op) => op.read_only)
            .map((op) => ({ id: op.id, label: op.name }))
        "
      /><JsonEditor
        v-model="testArgs"
        :label="t('arguments')"
        shape="object"
      /><NeInlineNotification
        v-if="task.error.value"
        kind="error"
        :title="task.error.value"
      /></div
  ></NeModal>
  <NeModal
    :visible="Boolean(revokeClient)"
    :title="t('revoke')"
    :primary-label="t('revoke')"
    :cancel-label="t('cancel')"
    primary-button-kind="danger"
    :close-aria-label="t('close')"
    @close="revokeClient = ''"
    @primary-click="revoke"
    ><p>{{ revokeClient }}</p></NeModal
  >
  <NeModal
    :visible="Boolean(revokeSecret)"
    :title="t('revokeCredential')"
    :primary-label="t('revokeCredential')"
    :cancel-label="t('cancel')"
    primary-button-kind="danger"
    :close-aria-label="t('close')"
    @close="revokeSecret = ''"
    @primary-click="removeSecret"
    ><p>{{ revokeSecret }}</p>
    <p class="nv-muted mt-3">{{ t("credentialImpact") }}</p></NeModal
  >
</template>
