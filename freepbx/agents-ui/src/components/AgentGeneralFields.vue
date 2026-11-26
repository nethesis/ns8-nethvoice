<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { NeInlineNotification, NeTextInput } from "@nethesis/vue-components";
import FieldCombobox from "./FieldCombobox.vue";
import type { AgentForm } from "../composables/useAgentForm";
import type { Catalog, Trunk } from "../types";
const props = defineProps<{
  form: AgentForm;
  mode: "create" | "edit";
  trunks: Trunk[] | undefined;
  catalog?: Catalog;
  types?: string[];
}>();
const emit = defineEmits<{ type: [value: string]; createTrunk: [] }>();
const { t } = useI18n();
const form = props.form;
const providers: Record<string, string> = {
  openai: "OpenAI",
  grok: "Grok",
  cleverai: "CleverAI",
};
const compatible = computed(() =>
  (props.trunks || []).filter(
    (item) => (item.provider === "cleverai") === form.isExternal.value,
  ),
);
const trunkOptions = computed(() =>
  compatible.value.map((item) => ({
    id: item.binding_id,
    label: item.name,
    description: providers[item.provider] || item.provider,
  })),
);
const typeOptions = computed(() =>
  (props.types || []).map((id) => ({
    id,
    label: t("agentTypes." + id),
    description: t("agentEditor.typeHelp." + id),
  })),
);
function chooseLanguage(value: string) {
  const conversation = form.draft.value.conversation;
  if (!value || value === conversation.language) return;
  conversation.language = value;
  form.clearError("language");
}
const languageOptions = computed(() => {
  const options = props.catalog?.languages || [];
  const selected = form.draft.value.conversation.language;
  return options.some((item) => item.id === selected)
    ? options
    : [...options, { id: selected, label: selected }];
});
// The combobox also reports its current value: only a change clears the
// error of the field.
function chooseTrunk(value: string) {
  const id = value || null;
  if (id === form.configuration.value.provider_binding_id) return;
  form.clearError("trunk");
  if (form.isExternal.value) {
    form.external.value.provider_binding_id = id;
    return;
  }
  const draft = form.draft.value;
  draft.provider_binding_id = id;
  draft.conversation.model = null;
  draft.conversation.options = null;
  draft.conversation.voice = "";
}
</script>
<template>
  <div class="flex flex-col gap-6">
    <FieldCombobox
      v-if="mode === 'create'"
      :model-value="form.agentType.value"
      :label="t('agentType')"
      :options="typeOptions"
      @update:model-value="$event && emit('type', $event)"
    />
    <NeTextInput
      v-else
      :label="t('agentType')"
      :model-value="t('agentTypes.' + form.agentType.value)"
      readonly
      :helper-text="t('agentEditor.typeLocked')"
    />
    <div data-field="name">
      <NeTextInput
        v-model="form.name.value"
        :label="t('name')"
        :placeholder="t('agentForm.namePlaceholder')"
        maxlength="100"
        :invalid-message="form.errors.value.name"
        @update:model-value="form.clearError('name')"
      />
    </div>
    <NeInlineNotification
      v-if="trunks && !compatible.length"
      kind="info"
      :title="t('agentForm.noTrunks')"
      :description="
        t(
          form.isExternal.value
            ? 'agentEditor.noTrunksExternalHelp'
            : 'agentEditor.noTrunksHelp',
        )
      "
      :primary-button-label="mode === 'edit' ? t('newTrunk') : undefined"
      @primary-click="emit('createTrunk')"
    />
    <div data-field="trunk">
      <FieldCombobox
        :model-value="form.configuration.value.provider_binding_id || ''"
        :label="t('trunk')"
        :options="trunkOptions"
        :placeholder="t('agentForm.trunkPlaceholder')"
        :disabled="!compatible.length"
        :helper-text="t('agentEditor.trunkHelp')"
        :invalid-message="form.errors.value.trunk"
        @update:model-value="chooseTrunk"
      />
    </div>
    <template v-if="!form.isExternal.value">
      <div data-field="language">
        <FieldCombobox
          :model-value="form.draft.value.conversation.language"
          :label="t('defaultLanguage')"
          :options="languageOptions"
          :helper-text="t('agentForm.languageHelp')"
          :invalid-message="form.errors.value.language"
          @update:model-value="chooseLanguage"
        />
      </div>
      <div data-field="duration" class="max-w-xs">
        <NeTextInput
          :model-value="String(form.draft.value.max_call_duration_seconds)"
          :label="t('maxDuration')"
          :placeholder="t('agentEditor.durationPlaceholder')"
          :helper-text="t('agentForm.durationHelp')"
          type="number"
          min="30"
          max="3600"
          :invalid-message="form.errors.value.duration"
          @update:model-value="
            form.draft.value.max_call_duration_seconds = Number($event);
            form.clearError('duration');
          "
        />
      </div>
    </template>
  </div>
</template>
