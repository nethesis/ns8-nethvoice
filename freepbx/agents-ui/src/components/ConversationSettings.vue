<script setup lang="ts">
import { computed, watch } from "vue";
import { useQuery } from "@tanstack/vue-query";
import { useI18n } from "vue-i18n";
import {
  NeButton,
  NeTextArea,
  NeTextInput,
  NeInlineNotification,
} from "@nethesis/vue-components";
import FieldCombobox from "./FieldCombobox.vue";
import { request } from "../api";
import type { Draft, ModelCatalog, Trunk } from "../types";
const props = defineProps<{
  modelValue: Draft["conversation"];
  binding?: Trunk;
}>();
const emit = defineEmits<{
  "update:modelValue": [value: Draft["conversation"]];
}>();
const { t } = useI18n();
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
const selected = computed(() =>
  models.data.value?.items.find((item) => item.id === props.modelValue.model),
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
  ...(models.data.value?.items || []).map((item) => ({
    id: item.id,
    label:
      item.id === "provider-default" ? t("providerManagedModel") : item.label,
    description: item.id === "provider-default" ? undefined : item.id,
  })),
]);
const availableVoices = computed(() =>
  selected.value?.voice_source === "provider_api"
    ? voices.data.value?.items || []
    : selected.value?.voices || [],
);
const advancedFields = computed(() =>
  Object.fromEntries(
    Object.entries(selected.value?.options_schema.properties || {}).filter(
      ([key]) => key !== "backend_model",
    ),
  ),
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
  if (!props.binding) return t("modelHelp.noTrunk");
  if (models.isFetching.value) return t("modelsLoading");
  if (models.data.value && !models.data.value.items.length)
    return t("modelsEmpty");
  if (selected.value?.status === "experimental") return t("liveExperimental");
  return t("modelHelp.ready");
});
const voiceHelper = computed(() =>
  selected.value &&
  (selected.value.voice_source !== "provider_api" || voices.data.value)
    ? t("modelVoicesHelp", {
        model: selected.value.label,
        count: availableVoices.value.length,
      })
    : "",
);
function chooseModel(value: string) {
  const item = models.data.value?.items.find((item) => item.id === value);
  if (!item || value === props.modelValue.model) return;
  emit("update:modelValue", {
    ...props.modelValue,
    model: value,
    options: JSON.parse(JSON.stringify(item.defaults)),
    voice: item.voices.some((item) => item.id === props.modelValue.voice)
      ? props.modelValue.voice
      : "",
  });
}
watch(
  () => models.data.value,
  (value) => {
    if (
      value &&
      props.binding &&
      props.modelValue.model === null &&
      value.items.some((item) => item.id === value.default_model)
    )
      chooseModel(value.default_model);
  },
  { immediate: true },
);
function chooseVoice(value: string) {
  if (value === props.modelValue.voice) return;
  if (availableVoices.value.some((item) => item.id === value))
    emit("update:modelValue", { ...props.modelValue, voice: value });
}
function setOption(key: string, value: string | number) {
  if (value === props.modelValue.options?.[key]) return;
  const field = selected.value?.options_schema.properties?.[key];
  if (field?.enum && (typeof value !== "string" || !field.enum.includes(value)))
    return;
  if (
    key === "backend_model" &&
    !models.data.value?.backend_models.some((item) => item.id === value)
  )
    return;
  emit("update:modelValue", {
    ...props.modelValue,
    options: { ...props.modelValue.options, [key]: value },
  });
}
function choices(key: string, values: string[]) {
  const available =
    key === "backend_model"
      ? models.data.value?.backend_models || []
      : values.map((id) => ({ id, label: id }));
  const saved = props.modelValue.options?.[key];
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
</script>
<template>
  <div
    class="grid grid-cols-1 gap-6 lg:grid-cols-2"
    aria-live="polite"
    :aria-busy="models.isFetching.value"
  >
    <FieldCombobox
      :model-value="modelValue.model || ''"
      :label="t('voiceModel')"
      :options="modelOptions"
      :placeholder="t('modelHelp.placeholder')"
      :helper-text="modelHelper"
      :disabled="
        !binding ||
        models.isPending.value ||
        models.data.value?.selection === 'provider_managed'
      "
      @update:model-value="chooseModel"
    />
    <FieldCombobox
      :model-value="modelValue.voice"
      :label="t('voiceName')"
      :options="voiceOptions"
      :placeholder="t('voicePlaceholder')"
      :helper-text="voiceHelper"
      :disabled="
        !selected ||
        (selected.voice_source === 'provider_api' && voices.isPending.value)
      "
      @update:model-value="chooseVoice"
    />
    <div class="-mt-3 flex flex-wrap items-center gap-2 lg:col-span-2">
      <NeButton
        :disabled="!binding"
        :loading="models.isFetching.value"
        kind="tertiary"
        size="sm"
        @click="models.refetch()"
        ><template #prefix
          ><FontAwesomeIcon icon="arrows-rotate" aria-hidden="true" /></template
        >{{ t("refreshModels") }}</NeButton
      ><NeButton
        v-if="voices.isError.value"
        kind="tertiary"
        size="sm"
        @click="voices.refetch()"
        >{{ t("retry") }}</NeButton
      >
      <span v-if="models.data.value" class="text-tertiary-neutral text-xs">{{
        t("modelSources." + models.data.value.source)
      }}</span>
    </div>
    <NeInlineNotification
      v-if="models.isError.value"
      class="lg:col-span-2"
      kind="error"
      :title="t('modelsDiscoveryFailed')"
    />
    <NeInlineNotification
      v-if="modelValue.model && models.data.value && !selected"
      class="lg:col-span-2"
      kind="warning"
      :title="t('savedModelUnavailable')"
    />
    <NeInlineNotification
      v-if="voices.isError.value"
      class="lg:col-span-2"
      kind="error"
      :title="t('voiceCatalogError')"
    />
    <div
      v-if="selected?.adapter === 'live' || selected?.options_schema.properties"
      class="border-divider bg-elevation-1 grid grid-cols-1 gap-6 rounded-lg border p-4 lg:col-span-2 lg:grid-cols-2"
    >
      <FieldCombobox
        v-if="selected?.adapter === 'live'"
        class="lg:col-span-2"
        :model-value="String(modelValue.options?.backend_model ?? '')"
        :label="t('backendModel')"
        :options="
          choices(
            'backend_model',
            selected.options_schema.properties?.backend_model?.enum || [],
          )
        "
        :helper-text="t('companionModelHelp')"
        @update:model-value="setOption('backend_model', $event)"
      />
      <template v-if="selected?.options_schema.properties">
        <p class="text-tertiary-neutral lg:col-span-2">
          {{ t("liveBackendHelp") }}
        </p>
        <div
          v-for="(field, key) in advancedFields"
          :key="key"
          :class="{ 'lg:col-span-2': field['x-control'] === 'textarea' }"
        >
          <FieldCombobox
            v-if="field.enum"
            :model-value="String(modelValue.options?.[key] ?? '')"
            :label="t(field.title)"
            :options="choices(String(key), field.enum)"
            @update:model-value="setOption(String(key), $event)"
          />
          <NeTextArea
            v-else-if="field['x-control'] === 'textarea'"
            :model-value="String(modelValue.options?.[key] ?? '')"
            :label="t(field.title)"
            :maxlength="field.maxLength"
            @update:model-value="setOption(String(key), $event)"
          />
          <NeTextInput
            v-else-if="field.type === 'integer'"
            :model-value="String(modelValue.options?.[key] ?? '')"
            :label="t(field.title)"
            type="number"
            :min="field.minimum"
            :max="field.maximum"
            @update:model-value="setOption(String(key), Number($event))"
          />
        </div>
      </template>
    </div>
  </div>
</template>
