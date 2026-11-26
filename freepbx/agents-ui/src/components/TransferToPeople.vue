<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import {
  NeCheckbox,
  NeInlineNotification,
  NeRadioSelection,
} from "@nethesis/vue-components";
import FieldCombobox from "./FieldCombobox.vue";
import type { AgentForm } from "../composables/useAgentForm";
import type { Agent, Catalog } from "../types";
// Transfer to people: direct, or consult the colleague first through a
// published internal consultation assistant. Queues always use direct
// transfer.
const props = defineProps<{
  form: AgentForm;
  catalog?: Catalog;
  agents?: Agent[];
}>();
const { t } = useI18n();
const router = useRouter();
const form = props.form;
const assistants = computed(() => props.catalog?.consultation_assistants || []);
const consultation = computed(() => form.draft.value.consultation);
const mode = computed(() => consultation.value?.mode || "direct");
const selected = computed(() => consultation.value?.assistant_id || "");
const known = computed(() =>
  assistants.value.find((item) => item.agent_id === selected.value),
);
// An internal assistant that exists but is not published yet.
const unpublished = computed(() =>
  (props.agents || []).find(
    (item) => item.agent_type === "consultation" && !item.workflow_version,
  ),
);
function setMode(value: string) {
  form.clearError("consultation");
  if (mode.value === value) return;
  const draft = form.draft.value;
  const attended = value === "attended";
  // Consultation needs the v9 contract and version 3 of the transfer tool.
  draft.contract_version = 9;
  draft.role = "public";
  draft.chat_model = null;
  draft.consultation = {
    mode: attended ? "attended" : "direct",
    phone: attended,
    chat: false,
    assistant_id:
      attended && assistants.value.length === 1
        ? assistants.value[0].agent_id
        : null,
  };
  for (const binding of draft.tool_bindings)
    if (binding.tool_id === "pbx.transfer") binding.tool_version = 3;
}
function setAssistant(value: string) {
  if (
    !consultation.value ||
    (value || null) === consultation.value.assistant_id
  )
    return;
  form.clearError("consultation");
  consultation.value.assistant_id = value || null;
}
function setChannel(key: "phone" | "chat", value: boolean) {
  form.clearError("consultation");
  if (consultation.value) consultation.value[key] = value;
}
const assistantOptions = computed(() => [
  ...assistants.value.map((item) => ({ id: item.agent_id, label: item.name })),
  ...(selected.value && !known.value
    ? [
        {
          id: selected.value,
          label:
            (props.agents || []).find((a) => a.agent_id === selected.value)
              ?.name ||
            selected.value +
              " (" +
              t("agentEditor.consultation.notPublished") +
              ")",
          disabled: true,
        },
      ]
    : []),
]);
function openAssistant() {
  void router.push(
    unpublished.value
      ? "/agents/" + unpublished.value.agent_id
      : "/agents/new?type=consultation",
  );
}
</script>
<template>
  <div class="flex flex-col gap-6" data-field="consultation">
    <NeRadioSelection
      :model-value="mode"
      name="transferMode"
      :label="t('peopleTransferMode')"
      :options="[
        {
          id: 'direct',
          label: t('directTransfer'),
          description: t('agentEditor.consultation.directHelp'),
        },
        {
          id: 'attended',
          label: t('agentEditor.consultation.attended'),
          description: t('agentEditor.consultation.attendedHelp'),
        },
      ]"
      @update:model-value="setMode"
    />
    <div
      v-if="mode === 'attended' && consultation"
      class="ml-7 flex flex-col gap-6"
    >
      <NeInlineNotification
        v-if="!assistants.length && !selected"
        kind="info"
        :title="t('agentEditor.consultation.noneTitle')"
        :description="
          t(
            unpublished
              ? 'agentEditor.consultation.unpublishedHelp'
              : 'agentEditor.consultation.noneHelp',
            { name: unpublished?.name },
          )
        "
        :primary-button-label="
          t(
            unpublished
              ? 'agentEditor.consultation.goToAssistant'
              : 'agentEditor.consultation.createAssistant',
          )
        "
        @primary-click="openAssistant"
      />
      <p v-else-if="assistants.length === 1 && known" class="text-muted">
        {{ t("agentEditor.consultation.single", { name: known.name }) }}
      </p>
      <FieldCombobox
        v-else
        :model-value="selected"
        :label="t('internalAssistant')"
        :options="assistantOptions"
        :placeholder="t('agentEditor.consultation.assistantPlaceholder')"
        :helper-text="t('agentEditor.consultation.assistantHelp')"
        @update:model-value="setAssistant"
      />
      <fieldset class="flex flex-col gap-3">
        <legend class="text-primary-neutral mb-2 text-sm font-medium">
          {{ t("agentEditor.consultation.channels") }}
        </legend>
        <NeCheckbox
          id="consult-phone"
          :model-value="consultation.phone"
          :label="t('agentEditor.consultation.phone')"
          @update:model-value="setChannel('phone', $event)"
        />
        <NeCheckbox
          id="consult-chat"
          :model-value="consultation.chat"
          :label="t('agentEditor.consultation.chat')"
          @update:model-value="setChannel('chat', $event)"
          ><template #description>{{
            t("agentEditor.consultation.chatHelp")
          }}</template></NeCheckbox
        >
      </fieldset>
      <p
        v-if="form.errors.value.consultation"
        class="text-sm text-rose-700 dark:text-rose-400"
      >
        {{ form.errors.value.consultation }}
      </p>
    </div>
  </div>
</template>
