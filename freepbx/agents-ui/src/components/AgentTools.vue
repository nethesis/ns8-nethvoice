<script setup lang="ts">
import { computed, ref } from "vue";
import {
  NeBadgeV2,
  NeButton,
  NeInlineNotification,
  NeMultiselectCombobox,
  NeRadioSelection,
  NeTextInput,
  NeToggle,
} from "@nethesis/vue-components";
import { useI18n } from "vue-i18n";
import { useDestinations } from "../composables/useDestinations";
import DestinationsDrawer, {
  type DestinationSelection,
} from "./DestinationsDrawer.vue";
import type {
  ConfigurationValue,
  DescriptionOverride,
  ToolBinding,
} from "../types";
const props = defineProps<{ modelValue: ToolBinding[] }>();
const emit = defineEmits<{ "update:modelValue": [value: ToolBinding[]] }>();
const { t } = useI18n();
const extensions = useDestinations("extension");
const queues = useDestinations("queue");
const transfer = computed(() =>
  props.modelValue.find((b) => b.tool_id === "pbx.transfer"),
);
const hangup = computed(() =>
  props.modelValue.find((b) => b.tool_id === "telephony.hangup"),
);
function update(toolId: string, patch: Partial<ToolBinding>) {
  emit(
    "update:modelValue",
    props.modelValue.map((binding) =>
      binding.tool_id === toolId ? { ...binding, ...patch } : binding,
    ),
  );
}
function configure(toolId: string, config: Record<string, ConfigurationValue>) {
  const binding = props.modelValue.find((b) => b.tool_id === toolId);
  if (binding) update(toolId, { config: { ...binding.config, ...config } });
}
const list = (value: ConfigurationValue | undefined) =>
  Array.isArray(value)
    ? value.filter((v): v is string => typeof v === "string")
    : [];
const config = computed(() => transfer.value?.config || {});
const permittedExtensions = computed(() =>
  config.value.extensions_enabled === true
    ? list(config.value.extension_allowlist)
    : [],
);
const permittedQueues = computed(() => {
  if (config.value.queues_enabled !== true) return [];
  const excluded = list(config.value.queue_denylist);
  return (queues.data.value || [])
    .map((q) => q.id)
    .filter((id) => !excluded.includes(id));
});
const unavailable = computed(() =>
  extensions.data.value
    ? permittedExtensions.value.filter(
        (id) => !extensions.data.value!.some((e) => e.id === id),
      )
    : [],
);
const descriptions = computed(
  () => (config.value.descriptions || []) as DescriptionOverride[],
);
function badges(ids: string[], inventory: { id: string; name: string }[]) {
  const names = ids.map((id) => {
    const item = inventory.find((i) => i.id === id);
    return (item ? item.name + " " : "") + "(" + id.split(":")[1] + ")";
  });
  return names.length > 6
    ? [
        ...names.slice(0, 6),
        t("destinations.more", { count: names.length - 6 }),
      ]
    : names;
}
const extensionBadges = computed(() =>
  badges(
    permittedExtensions.value.filter((id) => !unavailable.value.includes(id)),
    extensions.data.value || [],
  ),
);
const queueBadges = computed(() =>
  badges(permittedQueues.value, queues.data.value || []),
);
const drawer = ref(false);
const selection = computed<DestinationSelection>(() => {
  const text = (id: string) =>
    descriptions.value.find((d) => d.destination_id === id)?.description || "";
  return {
    extensions: Object.fromEntries(
      permittedExtensions.value
        .filter((id) => !unavailable.value.includes(id))
        .map((id) => [id, text(id)]),
    ),
    queues: Object.fromEntries(
      permittedQueues.value.map((id) => [id, text(id)]),
    ),
  };
});
function saveDestinations(value: DestinationSelection) {
  const selectedExtensions = (extensions.data.value || [])
    .map((e) => e.id)
    .filter((id) => id in value.extensions);
  const selectedQueues = Object.keys(value.queues);
  const allQueues = (queues.data.value || []).map((q) => q.id);
  configure("pbx.transfer", {
    extensions_enabled: selectedExtensions.length > 0,
    extension_allowlist: selectedExtensions,
    queues_enabled: selectedQueues.length > 0,
    queue_denylist: selectedQueues.length
      ? allQueues.filter((id) => !selectedQueues.includes(id))
      : [],
    descriptions: Object.entries({ ...value.extensions, ...value.queues })
      .filter(([, text]) => text.trim())
      .map(([destination_id, description]) => ({
        destination_id,
        description: description.trim(),
      })),
  });
  drawer.value = false;
}
const excluded = computed(() => list(config.value.recent_caller_denylist));
const restricted = ref(excluded.value.length > 0);
const scope = computed({
  get: () => (restricted.value ? "except" : "all"),
  set: (value: string) => {
    restricted.value = value === "except";
    if (!restricted.value && excluded.value.length)
      configure("pbx.transfer", { recent_caller_denylist: [] });
  },
});
const extensionOptions = computed(() =>
  (extensions.data.value || []).map((e) => ({
    id: e.id,
    label: e.name + " (" + e.number + ")",
  })),
);
const excludedOptions = computed(() =>
  excluded.value.map((id) => ({
    id,
    label:
      extensionOptions.value.find((o) => o.id === id)?.label ||
      id.split(":")[1],
  })),
);
function exclude(items: { id: string }[]) {
  configure("pbx.transfer", {
    recent_caller_denylist: items.map((item) => item.id),
  });
}
function number(key: string, value: string) {
  configure(
    key === "playback_timeout_seconds" ? "telephony.hangup" : "pbx.transfer",
    {
      [key]: Number(value),
    },
  );
}
</script>
<template>
  <div class="divide-divider flex flex-col divide-y">
    <div v-if="transfer" data-tool="transfer" class="flex flex-col gap-4 pb-6">
      <div>
        <NeToggle
          :model-value="transfer.enabled"
          :label="t('agentTools.transfer')"
          @update:model-value="update('pbx.transfer', { enabled: $event })"
        />
        <p class="text-muted mt-1 ml-14">
          {{ t("agentTools.transferHelp") }}
        </p>
      </div>
      <div v-if="transfer.enabled" class="ml-14 flex flex-col gap-6">
        <div class="border-divider bg-elevation-1 rounded-lg border p-4">
          <div class="mb-3 flex flex-wrap items-center justify-between gap-3">
            <span class="text-primary-neutral font-medium">{{
              t("destinations.permitted")
            }}</span>
            <NeButton
              kind="secondary"
              size="sm"
              :disabled="!extensions.data.value || !queues.data.value"
              :loading="extensions.isLoading.value || queues.isLoading.value"
              @click="drawer = true"
              ><template #prefix
                ><FontAwesomeIcon
                  icon="list-check"
                  aria-hidden="true" /></template
              >{{ t("destinations.manage") }}</NeButton
            >
          </div>
          <dl
            class="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-6 gap-y-2"
          >
            <dt class="text-muted">
              {{ t("destinations.extensions") }}
            </dt>
            <dd class="flex flex-wrap items-center gap-1.5">
              <span v-if="!extensionBadges.length">{{
                t("destinations.none")
              }}</span>
              <NeBadgeV2
                v-for="badge in extensionBadges"
                :key="badge"
                kind="gray"
                >{{ badge }}</NeBadgeV2
              >
            </dd>
            <dt class="text-muted">
              {{ t("destinations.queues") }}
            </dt>
            <dd class="flex flex-wrap items-center gap-1.5">
              <span v-if="!queueBadges.length">{{
                t("destinations.none")
              }}</span>
              <NeBadgeV2
                v-for="badge in queueBadges"
                :key="badge"
                kind="gray"
                >{{ badge }}</NeBadgeV2
              >
            </dd>
          </dl>
          <NeInlineNotification
            v-if="unavailable.length"
            class="mt-4"
            kind="warning"
            :title="t('destinations.unavailable', unavailable.length)"
            :description="t('destinations.unavailableHelp')"
          />
          <NeInlineNotification
            v-if="extensions.isError.value || queues.isError.value"
            class="mt-4"
            kind="error"
            :title="t('error.request_failed')"
          />
        </div>
      </div>
    </div>
    <div v-if="transfer" data-tool="recent" class="flex flex-col gap-4 py-6">
      <div>
        <NeToggle
          :model-value="
            transfer.enabled && config.recent_callers_enabled === true
          "
          :label="t('agentTools.recent')"
          :disabled="!transfer.enabled"
          @update:model-value="
            configure('pbx.transfer', { recent_callers_enabled: $event })
          "
        />
        <p class="text-muted mt-1 ml-14">
          {{ t("agentTools.recentHelp") }}
        </p>
      </div>
      <div
        v-if="transfer.enabled && config.recent_callers_enabled === true"
        class="ml-14 max-w-xs"
      >
        <NeTextInput
          :model-value="String(config.recent_caller_lookback_days ?? '')"
          :label="t('agentTools.lookback')"
          :helper-text="t('agentTools.lookbackHelp')"
          type="number"
          min="1"
          max="90"
          @update:model-value="number('recent_caller_lookback_days', $event)"
        />
      </div>
      <div
        v-if="transfer.enabled && config.recent_callers_enabled === true"
        class="ml-14 flex max-w-xl flex-col gap-6"
      >
        <NeRadioSelection
          v-model="scope"
          name="recentScope"
          :label="t('destinationScope.recent_caller_denylist.label')"
          :options="[
            {
              id: 'all',
              label: t('destinationScope.recent_caller_denylist.all'),
            },
            {
              id: 'except',
              label: t('destinationScope.recent_caller_denylist.except'),
            },
          ]"
        />
        <NeMultiselectCombobox
          v-if="restricted"
          :model-value="excludedOptions"
          :options="extensionOptions"
          :label="t('destinationPicker.recent_caller_denylist')"
          :placeholder="t('destinationPickerPlaceholder')"
          :max-options-shown="50"
          :limited-options-label="t('moreOptions')"
          :no-results-label="t('noResults')"
          :no-options-label="t('noOptions')"
          :user-input-label="t('userInput')"
          :optional-label="t('optional')"
          @update:model-value="exclude"
        />
      </div>
    </div>
    <div v-if="hangup" data-tool="hangup" class="flex flex-col gap-4 pt-6">
      <div>
        <NeToggle
          :model-value="hangup.enabled"
          :label="t('agentTools.endCall')"
          @update:model-value="update('telephony.hangup', { enabled: $event })"
        />
        <p class="text-muted mt-1 ml-14">
          {{ t("agentTools.endCallHelp") }}
        </p>
      </div>
      <div v-if="hangup.enabled" class="ml-14 max-w-xs">
        <NeTextInput
          :model-value="String(hangup.config.playback_timeout_seconds ?? '')"
          :label="t('agentTools.goodbye')"
          :helper-text="t('agentTools.goodbyeHelp')"
          type="number"
          min="1"
          max="10"
          @update:model-value="number('playback_timeout_seconds', $event)"
        />
      </div>
    </div>
  </div>
  <DestinationsDrawer
    :is-shown="drawer"
    :selection="selection"
    :extensions="extensions.data.value || []"
    :queues="queues.data.value || []"
    @close="drawer = false"
    @save="saveDestinations"
  />
</template>
