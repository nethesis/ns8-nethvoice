<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useQuery } from "@tanstack/vue-query";
import {
  NeButton,
  NeFormItemLabel,
  NeInlineNotification,
  NeRadioSelection,
  NeSideDrawer,
  NeTextInput,
  NeTooltip,
} from "@nethesis/vue-components";
import { faCopy } from "@fortawesome/free-solid-svg-icons";
import { useI18n } from "vue-i18n";
import FieldCombobox from "./FieldCombobox.vue";
import StatusBadge from "./StatusBadge.vue";
import { errorCode, errorDetails, request, queryClient } from "../api";
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
// Grok, CleverAI, the project ID and the SIP webhook exist only in the SIP
// lab: without it a trunk is an OpenAI key for GPT-Live.
const lab = computed(() => !!catalog.data.value?.sip_lab_enabled);
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
type TestResult = { ok: boolean; message: string; webhook: string };
const testResult = ref<TestResult | null>(null);
const testing = ref(false);
watch(
  () => [
    form.value.credential_mode,
    form.value.api_key,
    form.value.provider,
    form.value.openai_project_id,
    form.value.webhook_secret,
  ],
  () => {
    testResult.value = null;
  },
);
const editing = computed(() => !!props.trunk);
watch(
  () => props.isShown,
  (shown) => {
    if (!shown) return;
    testResult.value = null;
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
const providerNames: Record<string, string> = {
  openai: "OpenAI",
  grok: "Grok",
  cleverai: "CleverAI",
};
const providers = computed(() =>
  Object.entries(providerNames)
    .map(([id, label]) => ({ id, label }))
    .filter(
      (item) =>
        item.id === "openai" || lab.value || props.trunk?.provider === item.id,
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
const showProject = computed(
  () =>
    form.value.provider === "cleverai" ||
    (form.value.provider === "openai" && lab.value),
);
const showWebhook = computed(
  () => lab.value && form.value.provider !== "cleverai",
);
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
    : catalog.data.value?.grok_webhook_url ||
      window.location.origin + "/satellite-webhooks/" + form.value.provider,
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
    next.api_key = t("trunkForm.enterApiKey");
  if (f.provider === "grok" && create && !f.webhook_secret)
    next.webhook_secret = t("trunkForm.enterSecret");
  errors.value = next;
  return !Object.keys(next).length;
}
function errorText(code: string) {
  return te("trunkDrawer.errors." + code)
    ? t("trunkDrawer.errors." + code)
    : te("error." + code)
      ? t("error." + code)
      : t("error.request_failed");
}
function webhookText(check: unknown) {
  return typeof check === "string" && te("trunkDrawer.webhookCheck." + check)
    ? t("trunkDrawer.webhookCheck." + check)
    : "";
}
// Without the SIP lab there is no webhook to report on.
function sipWebhook(check: unknown) {
  return form.value.provider === "openai" && lab.value
    ? webhookText(check)
    : "";
}
async function testCredential() {
  if (testing.value) return;
  const f = form.value;
  const sip = f.provider === "openai" && lab.value;
  testing.value = true;
  testResult.value = null;
  try {
    const result = await request<{
      items: unknown[];
      webhook_check?: string;
    }>("POST", "/trunks/models", {
      provider: f.provider,
      credential_mode: f.credential_mode,
      test: true,
      api_key: f.credential_mode === "dedicated" ? f.api_key : "",
      ...(props.trunk ? { binding_id: props.trunk.binding_id } : {}),
      // Hidden fields are not sent: the backend keeps what is stored.
      ...(sip ? { openai_project_id: f.openai_project_id.trim() } : {}),
      ...(sip && f.webhook_secret ? { webhook_secret: f.webhook_secret } : {}),
    });
    testResult.value = result.items.length
      ? {
          ok: true,
          message: t("credentialValid"),
          webhook: sipWebhook(result.webhook_check),
        }
      : {
          ok: false,
          message: t("error.provider_model_unavailable"),
          webhook: sipWebhook(result.webhook_check),
        };
  } catch (failure) {
    const code = errorCode(failure),
      details = errorDetails(failure);
    const message = errorText(code);
    if (details.field === "openai_project_id" && showProject.value)
      errors.value = { ...errors.value, openai_project_id: message };
    testResult.value = {
      ok: false,
      message,
      webhook: sipWebhook(details.webhook_check),
    };
  } finally {
    testing.value = false;
  }
}
async function save() {
  if (!validate()) return;
  const f = form.value;
  const name = f.name.trim();
  const credentials = {
    credential_mode: f.credential_mode,
    api_key: f.credential_mode === "dedicated" ? f.api_key : "",
  };
  const trunk =
    f.provider === "cleverai"
      ? {
          name,
          provider: "cleverai",
          openai_project_id: f.openai_project_id.trim(),
        }
      : f.provider === "grok"
        ? {
            name,
            provider: "grok",
            ...credentials,
            grok_phone_number: f.grok_phone_number.trim(),
            sip_auth_mode: f.sip_auth_mode,
            sip_auth_username: f.sip_auth_username,
            sip_password: f.sip_password,
            webhook_secret: f.webhook_secret,
          }
        : {
            name,
            provider: "openai",
            ...credentials,
            sip_auth_mode: "none",
            ...(showProject.value
              ? { openai_project_id: f.openai_project_id.trim() }
              : {}),
            ...(showWebhook.value ? { webhook_secret: f.webhook_secret } : {}),
          };
  await task.run(
    async () => {
      const saved = await request<Trunk>(
        editing.value ? "PUT" : "POST",
        editing.value ? "/trunks/" + props.trunk!.binding_id : "/trunks",
        { trunk, expected_revision: props.trunk?.revision || 0 },
      );
      await queryClient.invalidateQueries({ queryKey: ["trunks"] });
      emit("saved", saved);
      close();
    },
    {
      title: t(editing.value ? "trunkUpdated" : "trunkCreated"),
      description: t(editing.value ? "trunkUpdatedHelp" : "trunkCreatedHelp", {
        name,
      }),
    },
  );
}
function close() {
  form.value.api_key = "";
  form.value.webhook_secret = "";
  form.value.sip_password = "";
  testResult.value = null;
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
    <form class="flex flex-col gap-6" novalidate @submit.prevent="save">
      <FieldCombobox
        v-if="providers.length > 1"
        :model-value="provider"
        :label="t('provider')"
        :options="providers"
        :disabled="editing"
        :helper-text="editing ? t('trunkForm.providerLocked') : ''"
        @update:model-value="provider = $event || provider"
      />
      <div v-else data-testid="trunk-provider">
        <p class="text-secondary-neutral text-sm font-medium">
          {{ t("provider") }}
        </p>
        <p class="text-primary-neutral mt-1">
          {{ providerNames[form.provider] || form.provider }}
        </p>
      </div>
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
        :invalid-message="errors.name"
        @update:model-value="errors.name = ''"
      />
      <NeTextInput
        v-if="showProject"
        v-model="form.openai_project_id"
        :label="t('openaiProject')"
        :optional="form.provider === 'openai'"
        :optional-label="t('optional')"
        :helper-text="
          form.provider === 'openai'
            ? t('trunkDrawer.projectSipHelp')
            : t('trunkDrawer.projectHelp')
        "
        :placeholder="t('trunkDrawer.projectPlaceholder')"
        maxlength="128"
        :invalid-message="errors.openai_project_id"
        @update:model-value="errors.openai_project_id = ''"
      />
      <template v-if="form.provider === 'grok'">
        <NeTextInput
          v-model="form.grok_phone_number"
          :label="t('grokNumber')"
          :placeholder="t('trunkDrawer.numberPlaceholder')"
          :helper-text="t('trunkDrawer.numberHelp')"
          maxlength="32"
          :invalid-message="errors.grok_phone_number"
          @update:model-value="errors.grok_phone_number = ''"
        />
        <NeRadioSelection
          v-model="form.sip_auth_mode"
          :label="t('sipAuthentication')"
          name="sipAuth"
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
            :helper-text="editing ? t('trunkForm.keepPassword') : ''"
            :invalid-message="errors.sip_password"
            @update:model-value="errors.sip_password = ''"
          />
        </template>
      </template>
      <template v-if="form.provider !== 'cleverai'">
        <NeRadioSelection
          v-model="form.credential_mode"
          name="credential-mode"
          :label="t('apiKeySource')"
          :options="[
            { id: 'inherit', label: t('integrationKey') },
            { id: 'dedicated', label: t('dedicatedKey') },
          ]"
        />
        <NeTextInput
          v-if="form.credential_mode === 'dedicated'"
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
          :invalid-message="errors.api_key"
          @update:model-value="errors.api_key = ''"
        />
        <p
          v-if="form.credential_mode === 'inherit' && errors.api_key"
          role="alert"
          class="text-sm text-rose-700 dark:text-rose-400"
        >
          {{ errors.api_key }}
        </p>
        <template v-if="showWebhook">
          <NeTextInput
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
            :invalid-message="errors.webhook_secret"
            @update:model-value="errors.webhook_secret = ''"
          />
          <div>
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
                      :icon="faCopy"
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
        <div
          v-if="form.provider === 'openai'"
          class="flex flex-col items-start gap-2"
        >
          <NeButton
            kind="tertiary"
            size="sm"
            class="-ml-2"
            :loading="testing"
            :disabled="testing || task.pending.value"
            @click="testCredential"
            >{{ t("testCredential") }}</NeButton
          >
          <div
            role="status"
            data-testid="credential-test-result"
            class="flex flex-col gap-1"
          >
            <template v-if="testResult">
              <StatusBadge
                :status="testResult.ok ? 'completed' : 'failed'"
                :label="
                  testResult.ok
                    ? testResult.message
                    : t('trunkDrawer.testFailed')
                "
              />
              <p v-if="!testResult.ok" class="text-secondary-neutral text-sm">
                {{ testResult.message }}
              </p>
              <p
                v-if="testResult.webhook"
                class="text-secondary-neutral text-sm"
              >
                {{ testResult.webhook }}
              </p>
            </template>
          </div>
        </div>
      </template>
      <NeInlineNotification
        v-if="task.error.value"
        kind="error"
        :title="task.error.value"
      />
      <div class="border-divider flex justify-end gap-4 border-t pt-6">
        <NeButton
          kind="tertiary"
          :disabled="task.pending.value"
          @click="close"
          >{{ t("cancel") }}</NeButton
        ><NeButton type="submit" kind="primary" :loading="task.pending.value">{{
          t(editing ? "saveAction" : "create")
        }}</NeButton>
      </div>
    </form>
  </NeSideDrawer>
</template>
