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
import FieldSelect from "./FieldSelect.vue";
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
  { id: "", label: t("choose") },
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
      item.id === "provider-default"
        ? t("providerManagedModel")
        : item.label + " (" + item.id + ")",
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
  { id: "", label: t("choose") },
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
  <section
    class="space-y-4"
    aria-live="polite"
    :aria-busy="models.isFetching.value"
  >
    <h2>{{ t("conversationSettings") }}</h2>
    <div class="nv-field-grid">
      <FieldSelect
        :model-value="modelValue.model || ''"
        :label="t('voiceModel')"
        :options="modelOptions"
        :disabled="
          !binding ||
          models.isPending.value ||
          models.data.value?.selection === 'provider_managed'
        "
        @update:model-value="chooseModel"
      />
      <FieldSelect
        :model-value="modelValue.voice"
        :label="t('voiceName')"
        :options="voiceOptions"
        :disabled="
          !selected ||
          (selected.voice_source === 'provider_api' && voices.isPending.value)
        "
        @update:model-value="chooseVoice"
      />
    </div>
    <p
      v-if="
        selected &&
        (selected.voice_source !== 'provider_api' || voices.data.value)
      "
      class="nv-muted"
    >
      {{
        t("modelVoicesHelp", {
          model: selected.label,
          count: availableVoices.length,
        })
      }}
    </p>
    <div v-if="selected?.adapter === 'live'" class="space-y-4">
      <FieldSelect
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
    </div>
    <p v-if="models.isFetching.value" class="nv-muted">
      {{ t("modelsLoading") }}
    </p>
    <p v-if="models.data.value" class="nv-muted">
      {{ t("modelSources." + models.data.value.source) }}
    </p>
    <p
      v-if="models.data.value && !models.data.value.items.length"
      class="nv-muted"
    >
      {{ t("modelsEmpty") }}
    </p>
    <NeInlineNotification
      v-if="models.isError.value"
      kind="error"
      :title="t('modelsDiscoveryFailed')"
    />
    <NeInlineNotification
      v-if="modelValue.model && models.data.value && !selected"
      kind="warning"
      :title="t('savedModelUnavailable')"
    />
    <NeInlineNotification
      v-if="voices.isError.value"
      kind="error"
      :title="t('voiceCatalogError')"
    />
    <p v-if="selected?.status === 'experimental'" class="nv-muted">
      {{ t("liveExperimental") }}
    </p>
    <NeButton
      :disabled="!binding"
      :loading="models.isFetching.value"
      kind="tertiary"
      @click="models.refetch()"
      >{{ t("refreshModels") }}</NeButton
    >
    <NeButton
      v-if="voices.isError.value"
      kind="tertiary"
      @click="voices.refetch()"
      >{{ t("retry") }}</NeButton
    >
    <div v-if="selected?.options_schema.properties" class="space-y-4">
      <p class="nv-muted">{{ t("liveBackendHelp") }}</p>
      <div v-for="(field, key) in advancedFields" :key="key">
        <FieldSelect
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
    </div>
  </section>
</template>
