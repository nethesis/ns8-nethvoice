<script setup lang="ts">
import { computed, ref, useTemplateRef, watch } from "vue";
import { isAxiosError } from "axios";
import { useQuery } from "@tanstack/vue-query";
import {
  NeButton,
  NeFormItemLabel,
  NeInlineNotification,
  NeRadioSelection,
  NeSideDrawer,
  NeTextInput,
  NeTooltip,
  focusElement,
} from "@nethesis/vue-components";
import { useI18n } from "vue-i18n";
import FieldCombobox from "./FieldCombobox.vue";
import { errorCode, request, queryClient } from "../api";
import { useTask } from "../composables/useTask";
import { useUi } from "../stores/ui";
import type { Catalog, Trunk } from "../types";
const props = defineProps<{ isShown: boolean; trunk?: Trunk }>();
const emit = defineEmits<{ close: []; saved: [trunk: Trunk] }>();
const { t, te } = useI18n(),
  task = useTask(),
  ui = useUi();
const catalog = useQuery({
  queryKey: ["catalog"],
  queryFn: () => request<Catalog>("GET", "/catalog"),
});
const blank = () => ({
  name: "",
  provider: "openai",
  openai_project_id: "",
  grok_phone_number: "",
  sip_auth_mode: "none",
  sip_auth_username: "",
  sip_password: "",
  credential_mode: "inherit",
  api_key: "",
  webhook_secret: "",
});
const form = ref(blank());
const errors = ref<Record<string, string>>({});
const credentialChecked = ref(false);
const verificationIssue = ref("");
const projectInput = useTemplateRef<{ focus: () => void }>("projectInput");
const keyInput = useTemplateRef<{ focus: () => void }>("keyInput");
const keySource = useTemplateRef<{ focus: () => void }>("keySource");
watch(
  () => [
    form.value.credential_mode,
    form.value.api_key,
    form.value.provider,
    form.value.openai_project_id,
  ],
  () => {
    credentialChecked.value = false;
    verificationIssue.value = "";
    errors.value.api_key = "";
    errors.value.openai_project_id = "";
  },
);
const editing = computed(() => !!props.trunk);
watch(
  () => props.isShown,
  (shown) => {
    if (!shown) return;
    credentialChecked.value = false;
    verificationIssue.value = "";
    task.error.value = "";
    errors.value = {};
    const trunk = props.trunk;
    form.value = {
      ...blank(),
      ...(trunk
        ? {
            credential_mode:
              trunk.api_key_source === "stored" ? "dedicated" : "inherit",
            name: trunk.name,
            provider: trunk.provider,
            openai_project_id: trunk.openai_project_id || "",
            grok_phone_number: trunk.grok_phone_number || "",
            sip_auth_mode: trunk.sip_auth_mode || "none",
            sip_auth_username: trunk.sip_auth_username || "",
          }
        : {}),
    };
  },
  { immediate: true },
);
const providers = computed(() =>
  [
    { id: "openai", label: "OpenAI" },
    { id: "grok", label: "Grok" },
    { id: "cleverai", label: "CleverAI" },
  ].filter(
    (item) =>
      item.id === "openai" ||
      catalog.data.value?.sip_lab_enabled ||
      props.trunk?.provider === item.id,
  ),
);
const provider = computed({
  get: () => form.value.provider,
  set: (value: string) => {
    if (value === form.value.provider) return;
    form.value.provider = value;
    form.value.api_key = "";
    form.value.webhook_secret = "";
    form.value.sip_password = "";
    errors.value = {};
  },
});
const environmentKey = computed(
  () =>
    catalog.data.value?.provider_credentials?.[form.value.provider]
      ?.environment_available || false,
);
const storedKey = computed(() => props.trunk?.api_key_source === "stored");
const apiKeyHelper = computed(() =>
  storedKey.value ? t("trunkForm.keepApiKey") : "",
);
const endpoint = computed(() =>
  form.value.provider === "openai"
    ? catalog.data.value?.openai_webhook_url || ""
    : window.location.origin + "/satellite-webhooks/" + form.value.provider,
);
async function copyEndpoint() {
  try {
    await navigator.clipboard.writeText(endpoint.value);
    ui.notify(t("trunkForm.endpointCopied"), t("trunkForm.endpointCopiedHelp"));
  } catch {
    ui.notify(t("error.request_failed"), undefined, "error");
  }
}
function validate() {
  const f = form.value,
    create = !editing.value,
    next: Record<string, string> = {};
  if (!f.name.trim()) next.name = t("trunkForm.enterName");
  if (f.provider === "cleverai" && !f.openai_project_id.trim())
    next.openai_project_id = t("trunkForm.enterProject");
  if (f.provider === "grok") {
    if (!f.grok_phone_number.trim())
      next.grok_phone_number = t("trunkForm.enterNumber");
    if (f.sip_auth_mode === "digest" && !f.sip_auth_username.trim())
      next.sip_auth_username = t("trunkForm.enterSipUsername");
    if (f.sip_auth_mode === "digest" && create && !f.sip_password)
      next.sip_password = t("trunkForm.enterSipPassword");
  }
  if (
    f.provider !== "cleverai" &&
    (f.credential_mode === "dedicated"
      ? !f.api_key && props.trunk?.api_key_source !== "stored"
      : !environmentKey.value)
  )
    next.api_key = t(
      f.credential_mode === "dedicated"
        ? "trunkForm.enterApiKey"
        : "trunkForm.integrationKeyMissing",
    );
  if (f.provider === "grok" && create && !f.webhook_secret)
    next.webhook_secret = t("trunkForm.enterSecret");
  errors.value = next;
  return !Object.keys(next).length;
}
const credentialChanged = computed(() => {
  const f = form.value;
  const trunk = props.trunk;
  if (f.provider === "cleverai") return false;
  return (
    !trunk ||
    (f.credential_mode === "dedicated"
      ? Boolean(f.api_key)
      : trunk.api_key_source !== "environment") ||
    (f.provider === "openai" &&
      f.openai_project_id !== (trunk.openai_project_id || ""))
  );
});
function showCredentialError(failure: unknown) {
  const code = errorCode(failure);
  const field = isAxiosError(failure) ? failure.response?.data?.field : null;
  if (field !== "openai_project_id" && field !== "api_key") return false;
  errors.value[field] = t(
    te("error." + code) ? "error." + code : "error.request_failed",
  );
  return true;
}
function focusCredentialError() {
  if (errors.value.openai_project_id) focusElement(projectInput);
  else if (errors.value.api_key) {
    focusElement(
      form.value.credential_mode === "dedicated" ? keyInput : keySource,
    );
  }
}
async function checkCredential() {
  const f = form.value;
  credentialChecked.value = false;
  verificationIssue.value = "";
  errors.value.api_key = "";
  errors.value.openai_project_id = "";
  try {
    const result = await request<{ credential_verified?: boolean }>(
      "POST",
      "/trunks/models",
      {
        provider: f.provider,
        credential_mode: f.credential_mode,
        test: true,
        api_key: f.credential_mode === "dedicated" ? f.api_key : "",
        ...(f.provider === "openai"
          ? { openai_project_id: f.openai_project_id }
          : {}),
        ...(props.trunk ? { binding_id: props.trunk.binding_id } : {}),
      },
    );
    credentialChecked.value = result.credential_verified === true;
    if (!credentialChecked.value)
      verificationIssue.value = "trunkForm.verificationUnavailable";
  } catch (failure) {
    const code = errorCode(failure);
    if (code === "provider_permission_denied") {
      verificationIssue.value = "trunkForm.verificationRestricted";
    } else if (
      [
        "provider_catalog_unavailable",
        "request_uncertain",
        "request_unavailable",
      ].includes(code)
    ) {
      verificationIssue.value = "trunkForm.verificationUnavailable";
    } else if (!showCredentialError(failure)) {
      throw failure;
    }
  }
  return credentialChecked.value;
}
async function testCredential() {
  await task.run(checkCredential, false);
  focusCredentialError();
}
async function save(withoutVerification = false) {
  if (
    task.pending.value ||
    (withoutVerification && !verificationIssue.value) ||
    !validate()
  )
    return;
  const f = form.value;
  const name = f.name.trim();
  const trunk =
    f.provider === "cleverai"
      ? { name, provider: "cleverai", openai_project_id: f.openai_project_id }
      : {
          ...f,
          api_key: f.credential_mode === "dedicated" ? f.api_key : "",
          name,
          ...(f.provider === "openai" ? { sip_auth_mode: "none" } : {}),
        };
  const saved = await task.run(async () => {
    if (
      credentialChanged.value &&
      !credentialChecked.value &&
      !withoutVerification &&
      !(await checkCredential())
    )
      return;
    try {
      return await request<Trunk>(
        editing.value ? "PUT" : "POST",
        editing.value ? "/trunks/" + props.trunk!.binding_id : "/trunks",
        { trunk, expected_revision: props.trunk?.revision || 0 },
      );
    } catch (failure) {
      if (!showCredentialError(failure)) throw failure;
      // A rejected save needs a fresh check before submitting this combination again.
      credentialChecked.value = false;
      verificationIssue.value = "";
    }
  }, false);
  if (!saved) {
    focusCredentialError();
    return;
  }
  const description = t(
    editing.value ? "trunkUpdatedHelp" : "trunkCreatedHelp",
    {
      name,
    },
  );
  const verified =
    credentialChecked.value &&
    !["unavailable", "scope_unavailable"].includes(
      String(saved.project_validation),
    );
  emit("saved", saved);
  close();
  ui.notify(
    t(editing.value ? "trunkUpdated" : "trunkCreated"),
    verified
      ? description + ". " + t("trunkForm.credentialCheckPassed")
      : description,
  );
  void queryClient.invalidateQueries({ queryKey: ["trunks"] });
}
function close() {
  if (task.pending.value) return;
  form.value.api_key = "";
  form.value.webhook_secret = "";
  form.value.sip_password = "";
  emit("close");
}
</script>
<template>
  <NeSideDrawer
    :is-shown="isShown"
    :title="t(editing ? 'editTrunk' : 'newTrunk')"
    :close-aria-label="t('closeDrawer')"
    @close="close"
  >
    <form class="flex flex-col gap-6" novalidate @submit.prevent="save()">
      <FieldCombobox
        :model-value="provider"
        :label="t('provider')"
        :options="providers"
        :disabled="editing || task.pending.value"
        :helper-text="editing ? t('trunkForm.providerLocked') : ''"
        @update:model-value="provider = $event || provider"
      />
      <NeInlineNotification
        v-if="form.provider === 'cleverai'"
        kind="info"
        :title="t('trunkForm.cleverAiTitle')"
        :description="t('trunkForm.cleverAiHelp')"
      />
      <NeTextInput
        v-model="form.name"
        :label="t('name')"
        :placeholder="t('trunkForm.namePlaceholder')"
        maxlength="100"
        :disabled="task.pending.value"
        :invalid-message="errors.name"
        @update:model-value="errors.name = ''"
      />
      <NeTextInput
        v-if="form.provider !== 'grok'"
        ref="projectInput"
        v-model="form.openai_project_id"
        :label="t('openaiProject')"
        :helper-text="
          t('openaiProjectHint') +
          (form.provider === 'openai'
            ? ' ' + t('trunkForm.projectOptional')
            : '')
        "
        :optional="form.provider === 'openai'"
        :optional-label="t('optional')"
        :disabled="task.pending.value"
        placeholder="proj_A1b2C3d4"
        maxlength="128"
        :invalid-message="errors.openai_project_id"
        @update:model-value="errors.openai_project_id = ''"
      />
      <template v-if="form.provider === 'grok'">
        <NeTextInput
          v-model="form.grok_phone_number"
          :label="t('grokNumber')"
          maxlength="32"
          :disabled="task.pending.value"
          :invalid-message="errors.grok_phone_number"
          @update:model-value="errors.grok_phone_number = ''"
        />
        <NeRadioSelection
          v-model="form.sip_auth_mode"
          :label="t('sipAuthentication')"
          name="sipAuth"
          :disabled="task.pending.value"
          :options="[
            { id: 'none', label: t('sipAllowedAddresses') },
            { id: 'digest', label: 'Digest' },
          ]"
        />
        <template v-if="form.sip_auth_mode === 'digest'">
          <NeTextInput
            v-model="form.sip_auth_username"
            :label="t('sipUsername')"
            maxlength="128"
            autocomplete="off"
            :disabled="task.pending.value"
            :invalid-message="errors.sip_auth_username"
            @update:model-value="errors.sip_auth_username = ''"
          />
          <NeTextInput
            v-model="form.sip_password"
            :label="t('sipPassword')"
            is-password
            :show-password-label="t('showPassword')"
            :hide-password-label="t('hidePassword')"
            maxlength="4096"
            autocomplete="new-password"
            :disabled="task.pending.value"
            :helper-text="editing ? t('trunkForm.keepPassword') : ''"
            :invalid-message="errors.sip_password"
            @update:model-value="errors.sip_password = ''"
          />
        </template>
      </template>
      <template v-if="form.provider !== 'cleverai'">
        <NeRadioSelection
          ref="keySource"
          v-model="form.credential_mode"
          name="credential-mode"
          :label="t('apiKeySource')"
          :disabled="task.pending.value"
          :invalid-message="
            form.credential_mode === 'inherit' ? errors.api_key : ''
          "
          :options="[
            { id: 'inherit', label: t('integrationKey') },
            { id: 'dedicated', label: t('dedicatedKey') },
          ]"
        />
        <NeTextInput
          v-if="form.credential_mode === 'dedicated'"
          ref="keyInput"
          v-model="form.api_key"
          :label="t('providerApiKey')"
          is-password
          :show-password-label="t('showApiKey')"
          :hide-password-label="t('hideApiKey')"
          :optional="storedKey"
          :optional-label="t('optional')"
          :helper-text="apiKeyHelper"
          maxlength="4096"
          autocomplete="new-password"
          :disabled="task.pending.value"
          :invalid-message="errors.api_key"
          @update:model-value="errors.api_key = ''"
        />
        <NeInlineNotification
          v-if="verificationIssue"
          kind="warning"
          :title="t('trunkForm.verificationIncomplete')"
          :description="t(verificationIssue)"
        />
        <NeButton
          kind="secondary"
          :loading="task.pending.value"
          @click="testCredential"
          >{{
            t(
              verificationIssue
                ? "trunkForm.retryCredentialCheck"
                : "testCredential",
            )
          }}</NeButton
        >
        <p v-if="credentialChecked" role="status">{{ t("credentialValid") }}</p>
        <NeTextInput
          v-if="catalog.data.value?.sip_lab_enabled"
          v-model="form.webhook_secret"
          :label="t('webhookSigningSecret')"
          :optional="form.provider === 'openai' || editing"
          :optional-label="t('optional')"
          is-password
          :show-password-label="t('showSecret')"
          :hide-password-label="t('hideSecret')"
          :helper-text="
            form.provider === 'openai'
              ? t('webhook.manualHelp')
              : t(
                  editing
                    ? 'trunkForm.keepSecret'
                    : 'trunkForm.secretEncrypted',
                )
          "
          maxlength="4096"
          autocomplete="new-password"
          :disabled="task.pending.value"
          :invalid-message="errors.webhook_secret"
          @update:model-value="errors.webhook_secret = ''"
        />
        <div v-if="catalog.data.value?.sip_lab_enabled">
          <NeFormItemLabel for="webhook-endpoint">{{
            t("webhookEndpoint")
          }}</NeFormItemLabel>
          <div class="flex items-center gap-2">
            <NeTextInput
              id="webhook-endpoint"
              class="flex-1"
              :model-value="endpoint"
              readonly
              aria-describedby="webhook-endpoint-help"
            />
            <NeTooltip trigger-event="mouseenter focus" placement="top">
              <template #trigger
                ><NeButton
                  kind="tertiary"
                  :aria-label="t('trunkForm.copyEndpoint')"
                  @click="copyEndpoint"
                  ><FontAwesomeIcon
                    icon="copy"
                    class="size-4"
                    aria-hidden="true" /></NeButton
              ></template>
              <template #content>{{ t("trunkForm.copyEndpoint") }}</template>
            </NeTooltip>
          </div>
          <p id="webhook-endpoint-help" class="text-muted mt-2 text-sm">
            {{
              t(
                form.provider === "grok"
                  ? "trunkForm.grokEndpointHelp"
                  : "trunkForm.openaiEndpointHelp",
              )
            }}
          </p>
        </div>
      </template>
      <NeInlineNotification
        v-if="task.error.value"
        kind="error"
        :title="task.error.value"
      />
      <div
        class="border-divider flex flex-wrap justify-end gap-4 border-t pt-6"
      >
        <NeButton
          kind="tertiary"
          :disabled="task.pending.value"
          @click="close"
          >{{ t("cancel") }}</NeButton
        ><NeButton
          v-if="verificationIssue"
          kind="secondary"
          :disabled="task.pending.value"
          @click="save(true)"
          >{{ t("trunkForm.saveWithoutVerification") }}</NeButton
        ><NeButton type="submit" kind="primary" :loading="task.pending.value">{{
          t(editing ? "saveAction" : "create")
        }}</NeButton>
      </div>
    </form>
  </NeSideDrawer>
</template>
