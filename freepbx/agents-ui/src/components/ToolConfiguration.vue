<script setup lang="ts">
// Adapted from the former agents SchemaFields: contextual controls use the catalog schema.
import { computed, ref } from "vue";
import { NeToggle, NeTextInput, NeButton } from "@nethesis/vue-components";
import { useI18n } from "vue-i18n";
import DestinationControl from "./DestinationControl.vue";
import type {
  ToolBinding,
  ToolDefinition,
  ConfigurationValue,
  DescriptionOverride,
} from "../types";
const props = defineProps<{
  agentId?: string;
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
  return Array.isArray(value)
    ? value.filter((v): v is string => typeof v === "string")
    : [];
}
function set(key: string, value: ConfigurationValue) {
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
    v-if="definition && !definition.editor?.automatic"
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
    <div
      v-if="modelValue.enabled && definition.editor?.categories"
      class="space-y-6"
    >
      <section
        v-for="category in definition.editor.categories"
        :key="category.enabled_field"
        class="space-y-3"
      >
        <NeToggle
          :model-value="modelValue.config[category.enabled_field] === true"
          :label="
            label(
              'toolSettings.' + category.enabled_field,
              category.enabled_field,
            )
          "
          @update:model-value="set(category.enabled_field, $event)"
        />
        <div
          v-if="modelValue.config[category.enabled_field] === true"
          class="pl-6 border-l border-gray-200 dark:border-gray-700"
        >
          <DestinationControl
            :inventory="category.inventory"
            :selected="selected(category.destinations_field)"
            :selection-mode="category.selection"
            :descriptions="
              (modelValue.config[
                definition.editor.descriptions_field || 'descriptions'
              ] || []) as DescriptionOverride[]
            "
            :agent-id="agentId"
            :disabled="false"
            @selection="set(category.destinations_field, $event)"
            @descriptions="
              set(
                definition.editor?.descriptions_field || 'descriptions',
                $event,
              )
            "
          />
        </div>
      </section>
    </div>
    <div v-else-if="modelValue.enabled" class="space-y-4">
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
        <NeToggle
          v-else-if="field.type === 'boolean'"
          :model-value="modelValue.config[key] === true"
          :label="label('toolSettings.' + key, field.title)"
          :disabled="!modelValue.enabled"
          @update:model-value="set(String(key), $event)"
        />
        <template
          v-else-if="
            field['x-control'] === 'destination-list' ||
            field['x-control'] === 'destination-descriptions'
          "
        >
          <h3>{{ label("toolSettings." + key, field.title) }}</h3>
          <DestinationControl
            :inventory="field['x-inventory']"
            :selected="field['x-inventory'] ? selected(String(key)) : undefined"
            :descriptions="
              field['x-control']
                ? (modelValue.config[key] as DescriptionOverride[])
                : undefined
            "
            :agent-id="agentId"
            :disabled="!modelValue.enabled"
            @selection="set(String(key), $event)"
            @descriptions="set(String(key), $event)"
          />
        </template>
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
    </div>
  </section>
</template>
