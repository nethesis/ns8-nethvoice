<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useQuery } from "@tanstack/vue-query";
import {
  NeTextInput,
  NeTextArea,
  NeToggle,
  NeButton,
  NeMultiselectCombobox,
  NeExpandable,
  NeInlineNotification,
} from "@nethesis/vue-components";
import { useI18n } from "vue-i18n";
import { request, refreshInventory } from "../api";
import { clone, operationKey } from "../model";
import { useTask } from "../composables/useTask";
import FieldSelect from "./FieldSelect.vue";
import JsonEditor from "./JsonEditor.vue";
import type { JsonObject } from "../types";
const props = defineProps<{ id: string }>();
const { t } = useI18n();
const task = useTask();
const query = useQuery({
  queryKey: ["native"],
  queryFn: () => request("GET", "/native/inventory"),
});
const profile = ref<JsonObject>(),
  directory = ref<JsonObject>({}),
  grants = ref<{ id: string; label: string; rawObj: JsonObject }[]>([]),
  grantRevision = ref(0),
  grantInitialized = ref(false);
const application = useQuery({
  queryKey: ["application"],
  queryFn: () => request("GET", "/application/inventory"),
});
const workflows = useQuery({
  queryKey: ["inventory"],
  queryFn: () => request("GET", "/application/workflows/inventory"),
});
const operationOptions = computed(() =>
  (workflows.data.value?.connector_operations || []).map((o: JsonObject) => ({
    id: o.id,
    label: o.name,
    rawObj: o.reference,
  })),
);
watch(
  [() => application.data.value, () => workflows.data.value],
  ([value, inventory]) => {
    if (!value || !inventory || grantInitialized.value) return;
    const stored = value.grants.find(
      (g: JsonObject) => g.agent_id === props.id,
    );
    grantRevision.value = stored?.revision || 0;
    grants.value = operationOptions.value.filter((o: JsonObject) =>
      stored?.operations.some(
        (r: JsonObject) => operationKey(r) === operationKey(o.rawObj),
      ),
    );
    grantInitialized.value = true;
  },
);
async function saveGrants() {
  await task.run(async () => {
    const result = await request("PUT", "/application/grants/" + props.id, {
      operations: grants.value.map((g) => g.rawObj),
      expected_revision: grantRevision.value,
    });
    grantRevision.value = result.revision;
    await refreshInventory();
  });
}

watch(
  () => query.data.value,
  (value) => {
    if (value && !profile.value) {
      profile.value = clone(
        value.profiles.find((p: JsonObject) => p.profile_key === props.id),
      );
      directory.value = Object.fromEntries(
        value.directory.map((d: JsonObject) => [
          d.id,
          {
            description: d.description,
            synonyms: d.synonyms,
            allowed: Boolean(d[props.id + "_allowed"]),
          },
        ]),
      );
    }
  },
  { immediate: true },
);
const fallbackOptions = computed(() => [
  { id: "", label: t("optional") },
  ...(query.data.value?.fallback_destinations || []),
]);
async function save() {
  await task.run(async () => {
    if (!profile.value) return;
    const fields = [
      "display_name",
      "trunk_id",
      "model",
      "voice",
      "language",
      "greeting",
      "prompt",
      "permissions",
      "tools",
      "transfer_policy",
      "knowledge",
      "max_call_duration_seconds",
      "fallback_destination",
      "company",
      "calendar_services",
    ];
    const value = Object.fromEntries(
      fields
        .filter((field) => field in profile.value!)
        .map((field) => [field, profile.value![field]]),
    );
    const result = await request("PUT", "/native/profiles/" + props.id, {
      profile: value,
      directory: directory.value,
      expected_revision: Number(profile.value.config_revision),
    });
    profile.value = result.profile;
    await refreshInventory();
  });
}
</script>
<template>
  <div v-if="profile" class="nv-panel space-y-6">
    <NeInlineNotification
      v-if="task.error.value"
      kind="error"
      :title="task.error.value"
    />
    <h2>{{ t("identity") }}</h2>
    <div class="nv-field-grid">
      <NeTextInput
        v-model="profile.display_name"
        :label="t('name')"
      /><FieldSelect
        :model-value="String(profile.trunk_id || '')"
        :label="t('provider')"
        :options="[
          { id: '', label: t('optional') },
          ...(query.data.value?.trunks || [])
            .filter((r: any) => r.runtime_owner === 'builtin')
            .map((r: any) => ({ id: String(r.id), label: r.name })),
        ]"
        @update:model-value="profile.trunk_id = $event ? Number($event) : null"
      /><NeTextInput v-model="profile.model" :label="t('model')" /><NeTextInput
        v-model="profile.voice"
        :label="t('voiceName')"
      /><NeTextInput
        v-model="profile.language"
        :label="t('language')"
      /><FieldSelect
        :model-value="profile.fallback_destination || ''"
        :label="t('fallback')"
        :options="fallbackOptions"
        @update:model-value="profile.fallback_destination = $event || null"
      />
    </div>
    <NeTextArea
      v-model="profile.greeting"
      :label="t('goal')"
      :rows="3"
    /><NeTextArea
      v-model="profile.prompt"
      :label="t('instructions')"
      :rows="5"
    />
    <NeTextInput
      :model-value="String(profile.max_call_duration_seconds)"
      :label="t('timeout')"
      type="number"
      @update:model-value="profile.max_call_duration_seconds = Number($event)"
    />
    <NeExpandable :label="t('permissions')"
      ><div class="mt-4 grid gap-5 md:grid-cols-2">
        <NeToggle
          v-for="scope in query.data.value?.permissions || []"
          :key="scope"
          :model-value="profile.permissions[scope] === 'allow'"
          :label="t('permissionNames.' + scope.replaceAll('.', '_'))"
          @update:model-value="
            profile.permissions[scope] = $event ? 'allow' : 'deny'
          "
        /></div
    ></NeExpandable>
    <NeExpandable :label="t('tools')"
      ><div class="mt-4 space-y-4">
        <NeToggle
          v-for="tool in query.data.value?.tools || []"
          :key="tool.id"
          :model-value="profile.tools[tool.id] === 'enabled'"
          :label="tool.description"
          @update:model-value="
            profile.tools[tool.id] = $event ? 'enabled' : 'disabled'
          "
        /></div
    ></NeExpandable>
    <NeExpandable :label="t('directory')"
      ><div
        v-for="item in query.data.value?.directory || []"
        :key="item.id"
        class="mt-5 space-y-3 border-b border-gray-200 pb-4 dark:border-gray-600"
      >
        <NeToggle
          v-model="directory[item.id].allowed"
          :label="item.name"
        /><NeTextInput
          v-model="directory[item.id].description"
          :label="t('description')"
        /><NeTextInput
          :model-value="directory[item.id].synonyms.join(', ')"
          :label="t('synonyms')"
          @update:model-value="
            directory[item.id].synonyms = $event
              .split(',')
              .map((s: string) => s.trim())
              .filter(Boolean)
          "
        /></div
    ></NeExpandable>
    <NeExpandable :label="t('connections')"
      ><div class="mt-4 space-y-4">
        <NeMultiselectCombobox
          v-model="grants"
          :options="operationOptions"
          :label="t('legacyOperations')"
          :no-options-label="t('noOptions')"
          :no-results-label="t('noResults')"
          :optional-label="t('optional')"
          :user-input-label="t('choose')"
          :limited-options-label="t('tools')"
        /><NeButton :loading="task.pending.value" @click="saveGrants">{{
          t("saveSettings")
        }}</NeButton>
      </div></NeExpandable
    >
    <NeExpandable :label="t('advanced')"
      ><div class="mt-4 space-y-5">
        <JsonEditor
          v-model="profile.company"
          label="Company"
          shape="object"
        /><JsonEditor
          v-model="profile.calendar_services"
          label="Calendar services"
          shape="object"
        /><JsonEditor
          v-model="profile.transfer_policy"
          label="Transfer policy"
          shape="object"
        /><JsonEditor
          v-model="profile.knowledge"
          label="Knowledge"
          shape="object"
        /></div
    ></NeExpandable>
    <NeButton kind="primary" :loading="task.pending.value" @click="save">{{
      t("saveSettings")
    }}</NeButton>
  </div>
</template>
