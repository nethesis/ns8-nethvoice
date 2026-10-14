<script setup lang="ts">
import { computed, ref } from "vue";
import { useQuery } from "@tanstack/vue-query";
import {
  NeButton,
  NeTextInput,
  NeInlineNotification,
} from "@nethesis/vue-components";
import { useI18n } from "vue-i18n";
import { request, queryClient } from "../api";
import { useTask } from "../composables/useTask";
import PageHeader from "../components/PageHeader.vue";
import FieldSelect from "../components/FieldSelect.vue";
import type { Catalog, Trunk } from "../types";
const { t } = useI18n(),
  task = useTask();
const query = useQuery({
  queryKey: ["trunks"],
  queryFn: () => request<{ items: Trunk[] }>("GET", "/trunks"),
});
const catalog = useQuery({
  queryKey: ["catalog"],
  queryFn: () => request<Catalog>("GET", "/catalog"),
});
const environmentKey = computed(
  () =>
    catalog.data.value?.provider_credentials?.[form.value.provider]
      ?.environment_available || false,
);
const editing = ref<Trunk>();
const visible = ref(false);
const form = ref({
  name: "",
  provider: "openai",
  openai_project_id: "",
  grok_phone_number: "",
  sip_auth_mode: "none",
  sip_auth_username: "",
  sip_password: "",
  api_key: "",
  webhook_secret: "",
});
const webhookUrl = computed(
  () => window.location.origin + "/satellite-webhooks/" + form.value.provider,
);
function open(trunk?: Trunk) {
  editing.value = trunk;
  visible.value = true;
  task.error.value = "";
  form.value = {
    name: trunk?.name || "",
    provider: trunk?.provider || "openai",
    openai_project_id: trunk?.openai_project_id || "",
    grok_phone_number: trunk?.grok_phone_number || "",
    sip_auth_mode: trunk?.sip_auth_mode || "none",
    sip_auth_username: trunk?.sip_auth_username || "",
    sip_password: "",
    api_key: "",
    webhook_secret: "",
  };
}
function close() {
  form.value.api_key = "";
  form.value.webhook_secret = "";
  form.value.sip_password = "";
  visible.value = false;
}
async function save() {
  await task.run(async () => {
    const trunk = {
      ...form.value,
      ...(form.value.provider === "openai" ? { sip_auth_mode: "none" } : {}),
    };
    await request<Trunk>(
      editing.value ? "PUT" : "POST",
      editing.value ? "/trunks/" + editing.value.binding_id : "/trunks",
      { trunk, expected_revision: editing.value?.revision || 0 },
    );
    close();
    await queryClient.invalidateQueries({ queryKey: ["trunks"] });
  });
}
async function remove(trunk: Trunk) {
  if (!window.confirm(t("deleteTrunkConfirm"))) return;
  await task.run(async () => {
    await request("DELETE", "/trunks/" + trunk.binding_id, {
      expected_revision: trunk.revision,
    });
    await queryClient.invalidateQueries({ queryKey: ["trunks"] });
  });
}
async function synchronize() {
  await task.run(async () => {
    await request("POST", "/synchronize", { retry: true });
    await queryClient.invalidateQueries({ queryKey: ["trunks"] });
  });
}
</script>
<template>
  <PageHeader :title="t('trunks')" :description="t('trunksHelp')"
    ><NeButton kind="primary" @click="open()">{{
      t("newTrunk")
    }}</NeButton></PageHeader
  >
  <NeInlineNotification
    v-if="task.error.value || query.isError.value"
    kind="error"
    :title="task.error.value || t('error.request_failed')"
  />
  <form
    v-if="visible"
    class="nv-panel mb-6 space-y-5 max-w-4xl"
    @submit.prevent="save"
  >
    <h2>{{ t(editing ? "editTrunk" : "newTrunk") }}</h2>
    <div class="nv-field-grid">
      <NeTextInput
        v-model="form.name"
        :label="t('name')"
        required
        maxlength="100"
      />
      <FieldSelect
        v-model="form.provider"
        :label="t('provider')"
        :disabled="!!editing"
        :options="[
          { id: 'openai', label: 'OpenAI' },
          { id: 'grok', label: 'Grok' },
        ]"
      />
      <NeTextInput
        v-if="form.provider === 'openai'"
        v-model="form.openai_project_id"
        :label="t('openaiProject')"
        required
        maxlength="128"
      />
      <NeTextInput
        v-else
        v-model="form.grok_phone_number"
        :label="t('grokNumber')"
        required
        maxlength="32"
      />
      <FieldSelect
        v-if="form.provider === 'grok'"
        v-model="form.sip_auth_mode"
        :label="t('sipAuthentication')"
        :options="[
          { id: 'none', label: t('sipAllowedAddresses') },
          { id: 'digest', label: 'Digest' },
        ]"
      />
      <NeTextInput
        v-if="form.provider === 'grok' && form.sip_auth_mode === 'digest'"
        v-model="form.sip_auth_username"
        :label="t('sipUsername')"
        required
        maxlength="128"
        autocomplete="off"
      />
      <NeTextInput
        v-if="form.provider === 'grok' && form.sip_auth_mode === 'digest'"
        v-model="form.sip_password"
        :label="t('sipPassword')"
        type="password"
        maxlength="4096"
        autocomplete="new-password"
      />
      <NeTextInput
        v-model="form.api_key"
        :label="t('providerApiKey')"
        type="password"
        maxlength="4096"
        autocomplete="new-password"
      />
      <NeTextInput
        v-model="form.webhook_secret"
        :label="t('webhookSigningSecret')"
        type="password"
        maxlength="4096"
        autocomplete="new-password"
      />
    </div>
    <p class="nv-muted">
      {{
        t(
          environmentKey
            ? "environmentKeyHelp"
            : editing
              ? "secretKeepHelp"
              : "secretRequiredHelp",
        )
      }}
    </p>
    <p class="nv-muted">{{ t("providerSetupHelp") }}</p>
    <NeTextInput
      :model-value="webhookUrl"
      :label="t('webhookEndpoint')"
      readonly
    />
    <div class="nv-action-bar">
      <NeButton type="submit" kind="primary" :loading="task.pending.value">{{
        t("saveSettings")
      }}</NeButton
      ><NeButton :disabled="task.pending.value" @click="close">{{
        t("cancel")
      }}</NeButton>
    </div>
  </form>
  <div class="grid gap-5 md:grid-cols-2">
    <article
      v-for="trunk in query.data.value?.items || []"
      :key="trunk.binding_id"
      class="nv-panel space-y-3"
    >
      <h2>{{ trunk.name }}</h2>
      <p>{{ trunk.provider }} · {{ t("sync." + trunk.sync_status) }}</p>
      <p class="nv-muted">{{ t("credentialsConfigured") }}</p>
      <div class="nv-action-bar">
        <NeButton
          v-if="trunk.sync_status !== 'synced'"
          :loading="task.pending.value"
          @click="synchronize"
          >{{ t("retrySync") }}</NeButton
        >
        <NeButton @click="open(trunk)">{{ t("edit") }}</NeButton
        ><NeButton
          kind="tertiary"
          :disabled="task.pending.value"
          @click="remove(trunk)"
          >{{ t("delete") }}</NeButton
        >
      </div>
    </article>
  </div>
</template>
