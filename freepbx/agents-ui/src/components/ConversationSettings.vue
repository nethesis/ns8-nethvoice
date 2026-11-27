<script setup lang="ts">
import { computed, watch } from "vue";
import { useQuery } from "@tanstack/vue-query";
import { useI18n } from "vue-i18n";
import {
  NeButton,
  NeTextArea,
  NeTextInput,
  NeInlineNotification,
  NeListbox,
} from "@nethesis/vue-components";
import { faArrowsRotate } from "@fortawesome/free-solid-svg-icons";
import FieldCombobox from "./FieldCombobox.vue";
import AppExpandable from "./AppExpandable.vue";
import { request } from "../api";
import type { ConversationModel, Draft, ModelCatalog, Trunk } from "../types";
const props = defineProps<{
  modelValue: Draft["conversation"];
  binding?: Trunk;
  errors?: Record<string, string>;
  // SIP Realtime models need the media lab: without it only GPT-Live works.
  sipLab: boolean;
  advancedOpen: boolean;
}>();
const emit = defineEmits<{
  "update:modelValue": [value: Draft["conversation"]];
  "update:advancedOpen": [value: boolean];
  clearError: [key: string];
}>();
const { t, te } = useI18n();
const LIVE = "gpt-live-1";
const models = useQuery({
  queryKey: [
    "conversation-models",
    computed(() => props.binding?.binding_id),
    computed(() => props.binding?.revision),
  ],
  enabled: computed(() => !!props.binding),
  queryFn: () =>
    request<ModelCatalog>("POST", "/trunks/models", {
      provider: props.binding!.provider,
      binding_id: props.binding!.binding_id,
    }),
});
const usable = (item: ConversationModel) =>
  props.sipLab || item.adapter === "live";
const items = computed(() => (models.data.value?.items || []).filter(usable));
const selected = computed(() =>
  items.value.find((item) => item.id === props.modelValue.model),
);
const voices = useQuery({
  queryKey: [
    "provider-voices",
    computed(() => props.binding?.binding_id),
    computed(() => props.modelValue.model),
  ],
  enabled: computed(
    () => !!props.binding && selected.value?.voice_source === "provider_api",
  ),
  queryFn: () =>
    request<{ items: { id: string; label: string }[] }>(
      "GET",
      "/trunks/" + encodeURIComponent(props.binding!.binding_id) + "/voices",
    ),
});
function hint(item: ConversationModel) {
  if (item.id === "provider-default") return t("agentEditor.modelHints.grok");
  const key = "agentEditor.modelHints." + item.id.replace(/[^a-z0-9]/gi, "_");
  return te(key) ? t(key) : item.id;
}
const modelOptions = computed(() => [
  ...(props.modelValue.model && !selected.value
    ? [
        {
          id: props.modelValue.model,
          label:
            props.modelValue.model +
            (models.data.value ? " (" + t("modelUnavailable") + ")" : ""),
          disabled: true,
        },
      ]
    : []),
  ...items.value.map((item) => ({
    id: item.id,
    label:
      item.id === "provider-default" ? t("providerManagedModel") : item.label,
    description: hint(item),
  })),
]);
const availableVoices = computed(() =>
  selected.value?.voice_source === "provider_api"
    ? voices.data.value?.items || []
    : selected.value?.voices || [],
);
const voiceOptions = computed(() => [
  ...availableVoices.value,
  ...(props.modelValue.voice &&
  !availableVoices.value.some((item) => item.id === props.modelValue.voice)
    ? [
        {
          id: props.modelValue.voice,
          label: props.modelValue.voice + " (" + t("modelUnavailable") + ")",
          disabled: true,
        },
      ]
    : []),
]);
const modelHelper = computed(() => {
  if (models.isFetching.value) return t("modelsLoading");
  if (models.data.value && !items.value.length) return t("modelsEmpty");
  if (selected.value?.status === "experimental")
    return t("agentEditor.liveExperimental");
  return "";
});
const savedUnavailable = computed(
  () => !!props.modelValue.model && !!models.data.value && !selected.value,
);
function chooseModel(value: string) {
  const item = items.value.find((item) => item.id === value);
  if (!item || value === props.modelValue.model) return;
  emit("clearError", "model");
  emit("update:modelValue", {
    ...props.modelValue,
    model: value,
    options: JSON.parse(JSON.stringify(item.defaults)),
    voice: item.voices.some((voice) => voice.id === props.modelValue.voice)
      ? props.modelValue.voice
      : "",
  });
}
// A new agent gets the default model of the trunk, or GPT-Live when the
// default needs the SIP lab and the lab is off.
watch(
  () => models.data.value,
  (value) => {
    if (!value || !props.binding || props.modelValue.model !== null) return;
    const preferred = items.value.find(
      (item) => item.id === value.default_model,
    )
      ? value.default_model
      : items.value.find((item) => item.id === LIVE)?.id;
    if (preferred) chooseModel(preferred);
  },
  { immediate: true },
);
function chooseVoice(value: string) {
  if (value === props.modelValue.voice) return;
  emit("clearError", "voice");
  if (availableVoices.value.some((item) => item.id === value))
    emit("update:modelValue", { ...props.modelValue, voice: value });
}
const schema = computed(() => selected.value?.options_schema.properties || {});
function setOption(key: string, value: string | number) {
  if (value === props.modelValue.options?.[key]) return;
  emit("clearError", key);
  const field = schema.value[key];
  if (field?.enum && (typeof value !== "string" || !field.enum.includes(value)))
    return;
  emit("update:modelValue", {
    ...props.modelValue,
    options: { ...props.modelValue.options, [key]: value },
  });
}
// Readable options for the GPT-Live settings, with the saved value kept
// when the catalog no longer offers it.
function choices(key: string) {
  const saved = props.modelValue.options?.[key];
  const available =
    key === "backend_model"
      ? (models.data.value?.backend_models || []).map((item) => ({
          id: item.id,
          label: item.label,
          description: item.id,
        }))
      : (schema.value[key]?.enum || []).map((id) => ({
          id,
          label: te(`agentEditor.liveOptions.${key}.${id}`)
            ? t(`agentEditor.liveOptions.${key}.${id}`)
            : id,
          description: te(`agentEditor.liveOptions.${key}.${id}Help`)
            ? t(`agentEditor.liveOptions.${key}.${id}Help`)
            : undefined,
        }));
  return [
    ...available,
    ...(typeof saved === "string" &&
    !available.some((item) => item.id === saved)
      ? [
          {
            id: saved,
            label: saved + " (" + t("modelUnavailable") + ")",
            disabled: true,
          },
        ]
      : []),
  ];
}
const listKeys = computed(() =>
  ["reasoning_effort", "verbosity", "service_tier"].filter(
    (key) => schema.value[key]?.enum,
  ),
);
const option = (key: string) => String(props.modelValue.options?.[key] ?? "");
</script>
<template>
  <NeInlineNotification
    v-if="!binding"
    kind="info"
    :title="t('agentEditor.selectTrunkTitle')"
    :description="t('agentEditor.selectTrunkHelp')"
  />
  <div v-else class="flex flex-col gap-6" :aria-busy="models.isFetching.value">
    <div data-field="model">
      <FieldCombobox
        :model-value="modelValue.model || ''"
        :label="t('voiceModel')"
        :invalid-message="errors?.model"
        :options="modelOptions"
        :placeholder="t('modelHelp.placeholder')"
        :helper-text="modelHelper"
        :disabled="
          models.isPending.value ||
          models.data.value?.selection === 'provider_managed'
        "
        @update:model-value="chooseModel"
      />
      <div class="mt-2 -ml-2.5 flex flex-wrap items-center gap-2">
        <NeButton
          :loading="models.isFetching.value"
          kind="tertiary"
          size="sm"
          @click="models.refetch()"
          ><template #prefix
            ><FontAwesomeIcon
              :icon="faArrowsRotate"
              aria-hidden="true" /></template
          >{{ t("refreshModels") }}</NeButton
        ><NeButton
          v-if="voices.isError.value"
          kind="tertiary"
          size="sm"
          @click="voices.refetch()"
          >{{ t("retry") }}</NeButton
        >
      </div>
      <p v-if="models.data.value" class="text-muted mt-1 text-sm">
        {{ t("modelSources." + models.data.value.source) }}
      </p>
      <AppExpandable
        v-if="selected && Object.keys(schema).length"
        class="mt-4"
        data-testid="advanced-settings"
        :label="t('agentEditor.advancedSettingsOf', { model: selected.label })"
        :model-value="advancedOpen"
        @update:model-value="emit('update:advancedOpen', $event)"
      >
        <div class="mt-4 flex flex-col gap-6">
          <div v-if="schema.backend_model" data-field="backend_model">
            <FieldCombobox
              :model-value="option('backend_model')"
              :label="t('agentEditor.live.backend_model')"
              :options="choices('backend_model')"
              :invalid-message="errors?.backend_model"
              @update:model-value="setOption('backend_model', $event)"
            />
          </div>
          <div v-for="key in listKeys" :key="key" :data-field="key">
            <NeListbox
              :model-value="option(key)"
              :label="t('agentEditor.live.' + key)"
              :options="choices(key)"
              :invalid-message="errors?.[key]"
              :no-options-label="t('noOptions')"
              :optional-label="t('optional')"
              @update:model-value="setOption(key, String($event))"
            />
          </div>
          <div v-if="schema.max_output_tokens" data-field="max_output_tokens">
            <NeTextInput
              :model-value="option('max_output_tokens')"
              :label="t('agentEditor.live.max_output_tokens')"
              :placeholder="t('agentEditor.live.max_output_tokensPlaceholder')"
              type="number"
              :min="schema.max_output_tokens.minimum"
              :max="schema.max_output_tokens.maximum"
              :invalid-message="errors?.max_output_tokens"
              @update:model-value="
                setOption('max_output_tokens', Number($event))
              "
            />
          </div>
          <div
            v-if="schema.backend_instructions"
            data-field="backend_instructions"
          >
            <NeTextArea
              :model-value="option('backend_instructions')"
              :label="t('agentEditor.live.backend_instructions')"
              :maxlength="schema.backend_instructions.maxLength"
              :rows="5"
              :invalid-message="errors?.backend_instructions"
              @update:model-value="setOption('backend_instructions', $event)"
            />
          </div>
        </div>
      </AppExpandable>
    </div>
    <NeInlineNotification
      v-if="models.isError.value"
      kind="error"
      :title="t('modelsDiscoveryFailed')"
    />
    <NeInlineNotification
      v-if="savedUnavailable"
      kind="warning"
      :title="
        t(
          sipLab || modelValue.model === LIVE
            ? 'savedModelUnavailable'
            : 'agentEditor.sipModelUnavailable',
        )
      "
    />
    <div data-field="voice">
      <FieldCombobox
        :model-value="modelValue.voice"
        :label="t('voiceName')"
        :invalid-message="errors?.voice"
        :options="voiceOptions"
        :placeholder="t('voicePlaceholder')"
        :disabled="
          !selected ||
          (selected.voice_source === 'provider_api' && voices.isPending.value)
        "
        @update:model-value="chooseVoice"
      />
    </div>
    <NeInlineNotification
      v-if="voices.isError.value"
      kind="error"
      :title="t('voiceCatalogError')"
    />
  </div>
</template>
