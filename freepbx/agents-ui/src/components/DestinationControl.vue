<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useQuery } from "@tanstack/vue-query";
import {
  NeTextInput,
  NeToggle,
  NeButton,
  NeInlineNotification,
} from "@nethesis/vue-components";
import { useI18n } from "vue-i18n";
import { request } from "../api";
import type { DestinationPage, DescriptionOverride } from "../types";
const props = defineProps<{
  inventory?: string;
  selected?: string[];
  selectionMode?: "allowlist" | "denylist";
  descriptions?: DescriptionOverride[];
  agentId?: string;
  disabled: boolean;
  showDescriptions?: boolean;
}>();
const emit = defineEmits<{
  selection: [value: string[]];
  descriptions: [value: DescriptionOverride[]];
}>();
const { t } = useI18n();
const query = ref("");
const offset = ref(0);
watch(query, () => {
  offset.value = 0;
});
const kind = computed(() => props.inventory?.replace(/s$/, ""));
const directory = useQuery({
  queryKey: ["destinations", query, offset, kind, () => props.agentId],
  queryFn: () =>
    request<DestinationPage>("GET", "/destinations", undefined, {
      query: query.value,
      offset: offset.value,
      limit: 20,
      ...(kind.value ? { type: kind.value } : {}),
      ...(props.agentId ? { agent_id: props.agentId } : {}),
    }),
});
const missing = computed(() =>
  (directory.data.value?.unavailable_ids || []).filter((id) =>
    props.selected?.includes(id),
  ),
);
function allowed(id: string) {
  return props.selectionMode === "denylist"
    ? !props.selected?.includes(id)
    : !!props.selected?.includes(id);
}
function destinationLabel(row: { id: string; name: string }) {
  return row.id.startsWith("ivr:")
    ? row.name
    : row.name + " (" + row.id.split(":")[1] + ")";
}
function toggle(id: string, enabled: boolean) {
  const listed = props.selectionMode === "denylist" ? !enabled : enabled;
  emit(
    "selection",
    listed
      ? [...new Set([...(props.selected || []), id])]
      : (props.selected || []).filter((v) => v !== id),
  );
}
function describe(id: string, description: string) {
  const values = (props.descriptions || []).filter(
    (v) => v.destination_id !== id,
  );
  if (description) values.push({ destination_id: id, description });
  emit("descriptions", values);
}
</script>
<template>
  <div class="space-y-3">
    <NeTextInput
      v-model="query"
      :label="
        t(inventory ? 'destinationSearch.' + inventory : 'searchDestinations')
      "
    />
    <NeInlineNotification
      v-if="directory.isError.value"
      kind="error"
      :title="t('error.request_failed')"
    />
    <p
      v-if="kind && directory.data.value?.modules[kind] === false"
      class="nv-muted"
    >
      {{ t("destinationModuleUnavailable") }}
    </p>
    <div v-for="id in missing" :key="id" class="flex items-center gap-3">
      <span>{{ id.split(":")[1] }} · {{ t("destinationUnavailable") }}</span>
      <NeButton
        :disabled="disabled"
        kind="tertiary"
        @click="toggle(id, selectionMode === 'denylist')"
        >{{ t("removeGrant") }}</NeButton
      >
    </div>
    <div
      v-for="row in directory.data.value?.items || []"
      :key="row.id"
      class="space-y-2"
    >
      <NeToggle
        v-if="selected"
        :model-value="allowed(row.id)"
        :disabled="disabled || (!row.available && !allowed(row.id))"
        :label="destinationLabel(row)"
        @update:model-value="toggle(row.id, $event)"
      />
      <NeTextInput
        v-if="showDescriptions !== false && row.available && allowed(row.id)"
        :model-value="
          descriptions?.find((v) => v.destination_id === row.id)?.description ||
          ''
        "
        :label="t('additionalDescription')"
        maxlength="500"
        :disabled="disabled"
        @update:model-value="describe(row.id, $event)"
      />
      <p v-if="!row.available" class="nv-muted">
        {{ t("destinationUnavailable") }}
      </p>
    </div>
    <p
      v-if="!directory.isLoading.value && !directory.data.value?.items.length"
      class="nv-muted"
    >
      {{ t("noMatchingDestinations") }}
    </p>
    <div
      v-if="offset > 0 || directory.data.value?.next_offset != null"
      class="flex gap-3"
    >
      <NeButton
        :disabled="offset === 0 || directory.isFetching.value"
        @click="offset = Math.max(0, offset - 20)"
        >{{ t("previous") }}</NeButton
      >
      <NeButton
        :disabled="
          directory.data.value?.next_offset == null ||
          directory.isFetching.value
        "
        @click="offset = directory.data.value?.next_offset || 0"
        >{{ t("next") }}</NeButton
      >
    </div>
  </div>
</template>
