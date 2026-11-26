<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { NeTextArea, NeTextInput } from "@nethesis/vue-components";
import ConversationSettings from "./ConversationSettings.vue";
import type { AgentForm } from "../composables/useAgentForm";
import type { Trunk } from "../types";
const props = defineProps<{
  form: AgentForm;
  trunks: Trunk[] | undefined;
  sipLab: boolean;
}>();
const { t } = useI18n();
const form = props.form;
const binding = computed(() =>
  props.trunks?.find(
    (item) => item.binding_id === form.draft.value.provider_binding_id,
  ),
);
</script>
<template>
  <div class="flex flex-col gap-6">
    <ConversationSettings
      v-model="form.draft.value.conversation"
      v-model:advanced-open="form.advancedOpen.value"
      :binding="binding"
      :errors="form.errors.value"
      :sip-lab="sipLab"
      @clear-error="form.clearError"
    />
    <div data-field="greeting">
      <NeTextArea
        v-model="form.draft.value.conversation.greeting"
        :label="t('greeting')"
        optional
        :optional-label="t('optional')"
        :helper-text="t('agentEditor.greetingHelp')"
        :rows="3"
        maxlength="4096"
        :invalid-message="form.errors.value.greeting"
        @update:model-value="form.clearError('greeting')"
      />
    </div>
    <div data-field="instructions">
      <NeTextArea
        v-model="form.draft.value.conversation.instructions"
        :label="t('instructions')"
        :helper-text="t('agentForm.instructionsHelp')"
        :rows="8"
        maxlength="32768"
        :invalid-message="form.errors.value.instructions"
        @update:model-value="form.clearError('instructions')"
      />
    </div>
    <div v-if="form.agentType.value === 'consultation'" data-field="chat_model">
      <NeTextInput
        :model-value="form.draft.value.chat_model || ''"
        :label="t('agentEditor.chatModel')"
        optional
        :optional-label="t('optional')"
        :placeholder="t('agentEditor.chatModelPlaceholder')"
        :helper-text="t('agentEditor.chatModelHelp')"
        maxlength="128"
        :invalid-message="form.errors.value.chat_model"
        @update:model-value="
          form.draft.value.chat_model = String($event).trim() || null;
          form.clearError('chat_model');
        "
      />
    </div>
  </div>
</template>
