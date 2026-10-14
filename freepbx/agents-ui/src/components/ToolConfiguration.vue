<script setup lang="ts">
// Adapted from the former agents SchemaFields: contextual controls use the catalog schema.
import { computed, ref } from "vue";
import { NeToggle, NeTextInput, NeButton } from "@nethesis/vue-components";
import { useI18n } from "vue-i18n";
import type { ToolBinding, ToolDefinition } from "../types";
const props = defineProps<{
  modelValue: ToolBinding;
  definition?: ToolDefinition;
  extensions: { id: string; name: string }[];
}>();
const emit = defineEmits<{ "update:modelValue": [value: ToolBinding] }>();
const { t, te } = useI18n();
const query = ref("");
const filtered = computed(() =>
  props.extensions.filter((item) =>
    (item.name + " " + item.id)
      .toLocaleLowerCase()
      .includes(query.value.toLocaleLowerCase()),
  ),
);
function label(key: string, fallback: string) {
  return te(key) ? t(key) : fallback;
}
function selected(key: string): string[] {
  const value = props.modelValue.config[key];
  return Array.isArray(value) ? value : [];
}
function set(key: string, value: number | string[]) {
  emit("update:modelValue", {
    ...props.modelValue,
    config: { ...props.modelValue.config, [key]: value },
  });
}
function toggle(key: string, id: string, enabled: boolean) {
  set(
    key,
    enabled
      ? [...new Set([...selected(key), id])]
      : selected(key).filter((value) => value !== id),
  );
}
function unavailable(key: string) {
  return selected(key).filter(
    (id) => !props.extensions.some((item) => item.id === id),
  );
}
</script>
<template>
  <section
    v-if="definition"
    class="rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-4"
  >
    <NeToggle
      :model-value="modelValue.enabled"
      :label="
        label(
          'toolNames.' + definition.id.replaceAll('.', '_'),
          definition.name,
        )
      "
      @update:model-value="
        emit('update:modelValue', { ...modelValue, enabled: $event })
      "
    />
    <details :open="modelValue.enabled" class="space-y-4">
      <summary class="cursor-pointer">{{ t("config") }}</summary>
      <p class="nv-muted">{{ t("toolConfigHelp") }}</p>
      <div
        v-for="(field, key) in definition.configuration_schema.properties"
        :key="key"
        class="space-y-3"
      >
        <NeTextInput
          v-if="field.type === 'integer'"
          :model-value="String(modelValue.config[key])"
          :label="label('toolSettings.' + key, field.title)"
          type="number"
          :min="field.minimum"
          :max="field.maximum"
          :disabled="!modelValue.enabled"
          required
          @update:model-value="set(String(key), Number($event))"
        />
        <template v-else-if="field['x-inventory'] === 'extensions'">
          <h3>{{ label("toolSettings." + key, field.title) }}</h3>
          <p class="nv-muted">{{ t("approvedExtensionsHelp") }}</p>
          <NeTextInput
            v-model="query"
            :label="t('searchExtensions')"
            :disabled="!modelValue.enabled"
          />
          <div
            v-for="id in unavailable(String(key))"
            :key="id"
            class="flex gap-3 items-center"
          >
            <span>{{ id }} · {{ t("destinationUnavailable") }}</span>
            <NeButton
              kind="tertiary"
              :disabled="!modelValue.enabled"
              @click="toggle(String(key), id, false)"
              >{{ t("removeGrant") }}</NeButton
            >
          </div>
          <div class="space-y-3 max-h-80 overflow-auto">
            <NeToggle
              v-for="extension in filtered"
              :key="extension.id"
              :model-value="selected(String(key)).includes(extension.id)"
              :label="extension.name + ' (' + extension.id.split(':')[1] + ')'"
              :disabled="!modelValue.enabled"
              @update:model-value="toggle(String(key), extension.id, $event)"
            />
            <p v-if="!filtered.length" class="nv-muted">
              {{ t("noMatchingExtensions") }}
            </p>
          </div>
        </template>
      </div>
    </details>
  </section>
</template>
