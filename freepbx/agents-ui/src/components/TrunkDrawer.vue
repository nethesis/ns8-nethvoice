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
import { useI18n } from "vue-i18n";
import { request, queryClient } from "../api";
import { useTask } from "../composables/useTask";
import { useUi } from "../stores/ui";
import type { Catalog, Trunk } from "../types";
const props = defineProps<{ isShown: boolean; trunk?: Trunk }>();
const emit = defineEmits<{ close: []; saved: [trunk: Trunk] }>();
const { t } = useI18n(),
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
  api_key: "",
  webhook_secret: "",
});
const form = ref(blank());
const errors = ref<Record<string, string>>({});
const editing = computed(() => !!props.trunk);
watch(
  () => props.isShown,
  (shown) => {
    if (!shown) return;
    task.error.value = "";
    errors.value = {};
    const trunk = props.trunk;
    form.value = {
      ...blank(),
      ...(trunk
        ? {
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
const providers = [
  { id: "openai", label: "OpenAI" },
  { id: "grok", label: "Grok" },
  { id: "cleverai", label: "CleverAI" },
];
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
const apiKeyHelper = computed(() =>
  editing.value
    ? t("trunkForm.keepApiKey")
    : environmentKey.value
      ? t("trunkForm.environmentApiKey")
      : "",
);
const endpoint = computed(
  () => window.location.origin + "/satellite-webhooks/" + form.value.provider,
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
  if (f.provider !== "grok" && !f.openai_project_id.trim())
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
    create &&
    !f.api_key &&
    !environmentKey.value
  )
    next.api_key = t("trunkForm.enterApiKey");
  if (f.provider !== "cleverai" && create && !f.webhook_secret)
    next.webhook_secret = t("trunkForm.enterSecret");
  errors.value = next;
  return !Object.keys(next).length;
}
async function save() {
  if (!validate()) return;
  const f = form.value;
  const name = f.name.trim();
  const trunk =
    f.provider === "cleverai"
      ? { name, provider: "cleverai", openai_project_id: f.openai_project_id }
      : {
          ...f,
          name,
          ...(f.provider === "openai" ? { sip_auth_mode: "none" } : {}),
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
      <NeRadioSelection
        v-model="provider"
        :label="t('provider')"
        name="voiceProvider"
        :options="providers"
        :disabled="editing"
        :description="editing ? t('trunkForm.providerLocked') : ''"
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
        :invalid-message="errors.name"
        @update:model-value="errors.name = ''"
      />
      <NeTextInput
        v-if="form.provider !== 'grok'"
        v-model="form.openai_project_id"
        :label="t('openaiProject')"
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
        <NeTextInput
          v-model="form.api_key"
          :label="t('providerApiKey')"
          is-password
          :show-password-label="t('showApiKey')"
          :hide-password-label="t('hideApiKey')"
          :optional="editing || environmentKey"
          :optional-label="t('optional')"
          :helper-text="apiKeyHelper"
          maxlength="4096"
          autocomplete="new-password"
          :invalid-message="errors.api_key"
          @update:model-value="errors.api_key = ''"
        />
        <NeTextInput
          v-model="form.webhook_secret"
          :label="t('webhookSigningSecret')"
          is-password
          :show-password-label="t('showSecret')"
          :hide-password-label="t('hideSecret')"
          :helper-text="
            t(editing ? 'trunkForm.keepSecret' : 'trunkForm.secretEncrypted')
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
