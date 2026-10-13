<script setup lang="ts">
import { NeTextInput, NeTextArea, NeToggle } from "@nethesis/vue-components";
import { useI18n } from "vue-i18n";
import FieldSelect from "./FieldSelect.vue";
import JsonEditor from "./JsonEditor.vue";
import type { JsonObject, Schema } from "../types";
const props = defineProps<{
  modelValue: JsonObject;
  schema: Schema;
  prefix?: string;
}>();
const emit = defineEmits<{ "update:modelValue": [value: JsonObject] }>();
const { t } = useI18n();
function set(key: string, value: unknown) {
  emit("update:modelValue", { ...props.modelValue, [key]: value });
}
function kind(schema: Schema) {
  return Array.isArray(schema.type)
    ? schema.type.find((x) => x !== "null")
    : schema.type;
}
</script>
<template>
  <div class="space-y-5">
    <template v-for="(field, key) in schema.properties || {}" :key="key">
      <FieldSelect
        v-if="field.enum"
        :model-value="String(modelValue[key] ?? '')"
        :label="String(key)"
        :options="field.enum.map((v) => ({ id: String(v), label: String(v) }))"
        @update:model-value="set(String(key), $event)"
      />
      <NeToggle
        v-else-if="kind(field) === 'boolean'"
        :model-value="Boolean(modelValue[key])"
        :label="String(key)"
        @update:model-value="set(String(key), $event)"
      />
      <NeTextInput
        v-else-if="['number', 'integer'].includes(kind(field) || '')"
        :model-value="String(modelValue[key] ?? '')"
        :label="String(key)"
        type="number"
        :helper-text="field.description"
        @update:model-value="set(String(key), Number($event))"
      />
      <NeTextArea
        v-else-if="kind(field) === 'string'"
        :model-value="String(modelValue[key] ?? '')"
        :label="String(key)"
        :helper-text="field.description"
        :rows="String(modelValue[key] || '').length > 150 ? 4 : 2"
        @update:model-value="set(String(key), $event)"
      />
      <JsonEditor
        v-else
        :model-value="modelValue[key] ?? (kind(field) === 'array' ? [] : {})"
        :label="String(key)"
        :shape="kind(field) === 'array' ? 'array' : 'object'"
        @update:model-value="set(String(key), $event)"
      />
    </template>
    <JsonEditor
      v-if="!Object.keys(schema.properties || {}).length"
      :model-value="modelValue"
      :label="t('config')"
      shape="object"
      @update:model-value="emit('update:modelValue', $event)"
    />
  </div>
</template>
