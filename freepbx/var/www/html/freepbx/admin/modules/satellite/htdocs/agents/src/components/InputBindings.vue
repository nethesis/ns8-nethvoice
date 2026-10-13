<script setup lang="ts">
import { computed } from "vue";
import { NeTextInput, NeToggle, NeExpandable } from "@nethesis/vue-components";
import { useI18n } from "vue-i18n";
import FieldSelect from "./FieldSelect.vue";
import JsonEditor from "./JsonEditor.vue";
import type { Graph, JsonObject } from "../types";
const props = defineProps<{
  modelValue: JsonObject;
  schema: JsonObject;
  graph: Graph;
  nodeId: string;
}>();
const emit = defineEmits<{ "update:modelValue": [value: JsonObject] }>();
const { t } = useI18n();
const fields = computed(
  () => Object.entries(props.schema.properties || {}) as [string, JsonObject][],
);
const steps = computed(() =>
  props.graph.nodes
    .filter((n) => n.id !== props.nodeId)
    .map((n) => ({ id: n.id, label: n.name })),
);
function set(name: string, binding: JsonObject) {
  emit("update:modelValue", { ...props.modelValue, [name]: binding });
}
function mode(name: string) {
  return props.modelValue[name] && "node" in props.modelValue[name]
    ? "output"
    : "literal";
}
function literal(name: string, type: string, text: string) {
  set(name, {
    value: ["integer", "number"].includes(type) ? Number(text) : text,
  });
}
</script>
<template>
  <div class="space-y-5">
    <div
      v-for="[name, schemaField] in fields"
      :key="name"
      class="space-y-3 rounded-md border border-gray-200 p-4 dark:border-gray-600"
    >
      <p class="font-medium">
        {{ schemaField.title || name }}
        <span v-if="schema.required?.includes(name)" class="nv-muted">*</span>
      </p>
      <FieldSelect
        :model-value="mode(name)"
        :label="t('bindingSource')"
        :options="[
          { id: 'literal', label: t('fixedValue') },
          { id: 'output', label: t('stepOutput') },
        ]"
        @update:model-value="
          set(
            name,
            $event === 'output'
              ? { node: '', path: '' }
              : { value: schemaField.type === 'boolean' ? false : '' },
          )
        "
      />
      <template v-if="mode(name) === 'output' || modelValue[name]?.node === ''">
        <FieldSelect
          :model-value="modelValue[name]?.node || ''"
          :label="t('node')"
          :options="steps"
          @update:model-value="set(name, { ...modelValue[name], node: $event })"
        />
        <NeTextInput
          :model-value="modelValue[name]?.path || ''"
          :label="t('outputPath')"
          :helper-text="t('outputPathHelp')"
          @update:model-value="set(name, { ...modelValue[name], path: $event })"
        />
      </template>
      <NeToggle
        v-else-if="schemaField.type === 'boolean'"
        :model-value="modelValue[name]?.value || false"
        :label="t('fixedValue')"
        @update:model-value="set(name, { value: $event })"
      />
      <JsonEditor
        v-else-if="['object', 'array'].includes(schemaField.type)"
        :model-value="
          modelValue[name]?.value ?? (schemaField.type === 'array' ? [] : {})
        "
        :label="t('fixedValue')"
        :shape="schemaField.type"
        @update:model-value="set(name, { value: $event })"
      />
      <NeTextInput
        v-else
        :model-value="String(modelValue[name]?.value ?? '')"
        :label="t('fixedValue')"
        :type="
          ['integer', 'number'].includes(schemaField.type) ? 'number' : 'text'
        "
        @update:model-value="literal(name, schemaField.type, $event)"
      />
    </div>
    <NeExpandable :label="t('advanced')"
      ><JsonEditor
        :model-value="modelValue"
        :label="t('inputs')"
        shape="object"
        @update:model-value="emit('update:modelValue', $event)"
    /></NeExpandable>
  </div>
</template>
