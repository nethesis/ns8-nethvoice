<script setup lang="ts">
import { computed } from "vue";
import {
  NeTextInput,
  NeCheckbox,
  NeButton,
  NeExpandable,
} from "@nethesis/vue-components";
import { useI18n } from "vue-i18n";
import FieldSelect from "./FieldSelect.vue";
import JsonEditor from "./JsonEditor.vue";
import { clone } from "../model";
import type { Schema } from "../types";
const props = defineProps<{
  modelValue: Schema;
  label: string;
  readonly?: boolean;
}>();
const emit = defineEmits<{ "update:modelValue": [value: Schema] }>();
const { t } = useI18n();
const rows = computed(() => Object.entries(props.modelValue.properties || {}));
function set(name: string, key: string, value: unknown) {
  const next = clone(props.modelValue);
  next.properties ||= {};
  next.properties[name] = { ...next.properties[name], [key]: value };
  emit("update:modelValue", next);
}
function rename(name: string, replacement: string) {
  if (!/^[a-z][a-z0-9_]{0,47}$/.test(replacement) || replacement === name)
    return;
  const next = clone(props.modelValue);
  if (next.properties?.[replacement]) return;
  const field = next.properties?.[name];
  if (field && next.properties) {
    delete next.properties[name];
    next.properties[replacement] = field;
    next.required = (next.required || []).map((key) =>
      key === name ? replacement : key,
    );
    emit("update:modelValue", next);
  }
}
function required(name: string, value: boolean) {
  const next = clone(props.modelValue);
  next.required = (next.required || []).filter((key) => key !== name);
  if (value) next.required.push(name);
  emit("update:modelValue", next);
}
function add() {
  let name = "field";
  let index = 1;
  while (props.modelValue.properties?.[name]) name = "field_" + index++;
  const next = clone(props.modelValue);
  next.properties ||= {};
  next.properties[name] = { type: "string" };
  emit("update:modelValue", next);
}
function remove(name: string) {
  const next = clone(props.modelValue);
  delete next.properties?.[name];
  next.required = (next.required || []).filter((key) => key !== name);
  emit("update:modelValue", next);
}
</script>
<template>
  <div class="space-y-4">
    <h3>{{ label }}</h3>
    <div
      v-for="[name, schema] in rows"
      :key="name"
      class="grid items-end gap-4 rounded-md border border-gray-200 p-4 dark:border-gray-600 md:grid-cols-4"
    >
      <NeTextInput
        :disabled="readonly"
        :model-value="name"
        :label="t('field')"
        @update:model-value="rename(name, $event)"
      /><FieldSelect
        :disabled="readonly"
        :model-value="String(schema.type || 'string')"
        :label="t('type')"
        :options="
          ['string', 'integer', 'number', 'boolean', 'object', 'array'].map(
            (id) => ({ id, label: id }),
          )
        "
        @update:model-value="set(name, 'type', $event)"
      /><NeCheckbox
        :disabled="readonly"
        :model-value="(modelValue.required || []).includes(name)"
        :label="t('required')"
        @update:model-value="required(name, $event)"
      /><NeButton v-if="!readonly" kind="tertiary" @click="remove(name)">{{
        t("remove")
      }}</NeButton>
    </div>
    <NeButton v-if="!readonly" @click="add">{{ t("addColumn") }}</NeButton
    ><NeExpandable v-if="!readonly" :label="t('json')"
      ><JsonEditor
        :model-value="modelValue"
        :label="label"
        shape="object"
        @update:model-value="emit('update:modelValue', $event)"
    /></NeExpandable>
  </div>
</template>
