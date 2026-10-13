<script setup lang="ts">
import { ref, watch } from "vue";
import { useQuery } from "@tanstack/vue-query";
import {
  NeTextInput,
  NeTextArea,
  NeButton,
  NeInlineNotification,
} from "@nethesis/vue-components";
import { useI18n } from "vue-i18n";
import { request, refreshInventory } from "../api";
import { clone } from "../model";
import { useTask } from "../composables/useTask";
import FieldSelect from "./FieldSelect.vue";
import JsonEditor from "./JsonEditor.vue";
import type { JsonObject } from "../types";
const { t } = useI18n();
const task = useTask();
const revision = ref(0);
const query = useQuery({
  queryKey: ["application"],
  queryFn: () => request("GET", "/application/inventory"),
});
const preset = ref<JsonObject>({
  name: "Support requests",
  provider: "openai_responses",
  model: "",
  secret_ref: "",
  prompt: "",
  operations: [],
  deadline_seconds: 60,
  max_output_tokens: 2048,
  result_retention_hours: 24,
});
watch(
  () => query.data.value,
  (value) => {
    const row = value?.resources.find(
      (r: JsonObject) =>
        r.kind === "preset" && r.resource_id === "support-request",
    );
    if (row && !revision.value) {
      preset.value = clone(row.draft);
      revision.value = row.revision;
    }
  },
  { immediate: true },
);
async function save(publish = false) {
  await task.run(async () => {
    const result = await request(
      "PUT",
      "/application/resources/preset/support-request",
      { definition: preset.value, expected_revision: revision.value },
    );
    revision.value = result.revision;
    if (publish) {
      const version = await request(
        "POST",
        "/application/resources/preset/support-request/publish",
        { expected_revision: revision.value },
      );
      revision.value = version.revision || revision.value;
    }
    await refreshInventory();
  });
}
</script>
<template>
  <div class="nv-panel space-y-5">
    <h2>{{ preset.name }}</h2>
    <NeInlineNotification
      v-if="task.error.value"
      kind="error"
      :title="task.error.value"
    />
    <div class="nv-field-grid">
      <NeTextInput v-model="preset.name" :label="t('name')" /><NeTextInput
        v-model="preset.model"
        :label="t('model')"
      /><FieldSelect
        v-model="preset.secret_ref"
        :label="t('credential')"
        :options="
          (query.data.value?.secrets || [])
            .filter((s: any) => !s.revoked)
            .map((s: any) => ({ id: s.secret_id, label: s.secret_id }))
        "
      />
    </div>
    <NeTextArea
      v-model="preset.prompt"
      :label="t('instructions')"
      :rows="5"
    /><JsonEditor
      v-model="preset.operations"
      :label="t('scopes')"
      shape="array"
    />
    <div class="nv-field-grid">
      <NeTextInput
        :model-value="String(preset.deadline_seconds)"
        :label="t('timeout')"
        type="number"
        @update:model-value="preset.deadline_seconds = Number($event)"
      /><NeTextInput
        :model-value="String(preset.result_retention_hours)"
        :label="t('history') + ' (h)'"
        type="number"
        @update:model-value="preset.result_retention_hours = Number($event)"
      />
    </div>
    <div class="nv-action-bar">
      <NeButton :loading="task.pending.value" @click="save(false)">{{
        t("save")
      }}</NeButton
      ><NeButton
        kind="primary"
        :loading="task.pending.value"
        @click="save(true)"
        >{{ t("publish") }}</NeButton
      >
    </div>
  </div>
</template>
