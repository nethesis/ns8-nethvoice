<script setup lang="ts">
import { computed, ref } from "vue";
import {
  NeBadgeV2,
  NeButton,
  NeInlineNotification,
  NeMultiselectCombobox,
  NeRadioSelection,
  NeTextInput,
} from "@nethesis/vue-components";
import { faListCheck } from "@fortawesome/free-solid-svg-icons";
import { useI18n } from "vue-i18n";
import { useLoadError } from "../composables/useLoadError";
import { useDestinations } from "../composables/useDestinations";
import AppToggle from "./AppToggle.vue";
import TransferToPeople from "./TransferToPeople.vue";
import DestinationsDrawer, {
  type DestinationSelection,
} from "./DestinationsDrawer.vue";
import type { AgentForm } from "../composables/useAgentForm";
import type {
  Agent,
  Catalog,
  ConfigurationValue,
  DescriptionOverride,
  ToolBinding,
} from "../types";
const props = defineProps<{
  form: AgentForm;
  mode: "create" | "edit";
  catalog?: Catalog;
  agents?: Agent[];
}>();
const { t } = useI18n();
const loadError = useLoadError();
const form = props.form;
const extensions = useDestinations("extension");
const queues = useDestinations("queue");
const bindings = computed(() => form.draft.value.tool_bindings);
const transfer = computed(() =>
  bindings.value.find((b) => b.tool_id === "pbx.transfer"),
);
const hangup = computed(() =>
  bindings.value.find((b) => b.tool_id === "telephony.hangup"),
);
function update(toolId: string, patch: Partial<ToolBinding>) {
  form.draft.value.tool_bindings = bindings.value.map((binding) =>
    binding.tool_id === toolId ? { ...binding, ...patch } : binding,
  );
}
function configure(toolId: string, config: Record<string, ConfigurationValue>) {
  const binding = bindings.value.find((b) => b.tool_id === toolId);
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
const permittedQueues = computed(() =>
  config.value.queues_enabled === true
    ? list(config.value.queue_allowlist)
    : [],
);
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
function label(id: string, inventory: { id: string; name: string }[]) {
  const item = inventory.find((i) => i.id === id);
  return (item ? item.name + " " : "") + "(" + id.split(":")[1] + ")";
}
function badges(ids: string[], inventory: { id: string; name: string }[]) {
  const names = ids.map((id) => label(id, inventory));
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
const clearDestinations = () => form.clearError("destinations");
function toggleTransfer(value: boolean) {
  clearDestinations();
  form.clearError("lookback");
  update("pbx.transfer", { enabled: value });
}
// Create drawer: the destinations are chosen with two lists; routing
// descriptions are added later in the agent page.
const queueOptions = computed(() =>
  (queues.data.value || []).map((item) => ({
    id: item.id,
    label: item.name,
    description: t("destinations.queueNumber", { number: item.number }),
  })),
);
const extensionOptions = computed(() =>
  (extensions.data.value || []).map((item) => ({
    id: item.id,
    label: item.name,
    description: t("destinations.extensionNumber", { number: item.number }),
  })),
);
const selectedQueues = computed(() =>
  queueOptions.value.filter((o) => permittedQueues.value.includes(o.id)),
);
const selectedExtensions = computed(() =>
  extensionOptions.value.filter((o) =>
    permittedExtensions.value.includes(o.id),
  ),
);
function selectQueues(items: { id: string }[]) {
  clearDestinations();
  const ids = items.map((item) => item.id);
  configure("pbx.transfer", {
    queues_enabled: ids.length > 0,
    queue_allowlist: ids,
  });
}
function selectExtensions(items: { id: string }[]) {
  clearDestinations();
  const ids = items.map((item) => item.id);
  configure("pbx.transfer", {
    extensions_enabled: ids.length > 0,
    extension_allowlist: ids,
  });
}
// Agent page: summary and Manage destinations drawer.
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
  clearDestinations();
  const chosenExtensions = (extensions.data.value || [])
    .map((e) => e.id)
    .filter((id) => id in value.extensions);
  const chosenQueues = Object.keys(value.queues);
  configure("pbx.transfer", {
    extensions_enabled: chosenExtensions.length > 0,
    extension_allowlist: chosenExtensions,
    queues_enabled: chosenQueues.length > 0,
    queue_allowlist: chosenQueues,
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
const callbackOptions = computed(() =>
  (extensions.data.value || []).map((e) => ({
    id: e.id,
    label: e.name + " (" + e.number + ")",
  })),
);
const excludedOptions = computed(() =>
  excluded.value.map((id) => ({
    id,
    label:
      callbackOptions.value.find((o) => o.id === id)?.label || id.split(":")[1],
  })),
);
function exclude(items: { id: string }[]) {
  configure("pbx.transfer", {
    recent_caller_denylist: items.map((item) => item.id),
  });
}
function number(key: string, value: string) {
  const goodbye = key === "playback_timeout_seconds";
  form.clearError(goodbye ? "goodbye" : "lookback");
  configure(goodbye ? "telephony.hangup" : "pbx.transfer", {
    [key]: Number(value),
  });
}
const recentOn = computed(
  () =>
    !!transfer.value?.enabled && config.value.recent_callers_enabled === true,
);
const multiselectLabels = computed(() => ({
  noResultsLabel: t("noResults"),
  noOptionsLabel: t("noOptions"),
  userInputLabel: t("userInput"),
  optionalLabel: t("optional"),
  limitedOptionsLabel: t("moreOptions"),
}));
</script>
<template>
  <div class="flex flex-col gap-8">
    <div
      v-if="transfer"
      data-tool="transfer"
      data-field="destinations"
      class="flex flex-col gap-6"
    >
      <AppToggle
        :model-value="transfer.enabled"
        :label="t('agentTools.transfer')"
        :tip="t('agentEditor.transferTip')"
        @update:model-value="toggleTransfer"
      />
      <template v-if="transfer.enabled">
        <template v-if="mode === 'create'">
          <NeMultiselectCombobox
            :model-value="selectedQueues"
            :options="queueOptions"
            :label="t('destinations.queues')"
            :placeholder="t('agentEditor.selectQueues')"
            :invalid-message="form.errors.value.destinations"
            :max-options-shown="50"
            v-bind="multiselectLabels"
            @update:model-value="selectQueues"
          />
          <NeMultiselectCombobox
            :model-value="selectedExtensions"
            :options="extensionOptions"
            :label="t('destinations.extensions')"
            :placeholder="t('agentEditor.selectExtensions')"
            :helper-text="t('agentEditor.routingLater')"
            :max-options-shown="50"
            v-bind="multiselectLabels"
            @update:model-value="selectExtensions"
          />
        </template>
        <div v-else>
          <div
            :class="[
              'bg-elevation-1 rounded-lg border p-4',
              form.errors.value.destinations
                ? 'border-rose-500 dark:border-rose-300'
                : 'border-divider',
            ]"
          >
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
                    :icon="faListCheck"
                    aria-hidden="true" /></template
                >{{ t("destinations.manage") }}</NeButton
              >
            </div>
            <dl
              class="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-6 gap-y-2"
            >
              <dt class="text-muted">{{ t("destinations.queues") }}</dt>
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
              <dt class="text-muted">{{ t("destinations.extensions") }}</dt>
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
            </dl>
            <NeInlineNotification
              v-if="unavailable.length"
              class="mt-4"
              kind="warning"
              :title="t('destinations.unavailable', unavailable.length)"
              :description="t('destinations.unavailableHelp')"
            />
          </div>
          <p
            v-if="form.errors.value.destinations"
            class="mt-2 text-sm text-rose-700 dark:text-rose-400"
          >
            {{ form.errors.value.destinations }}
          </p>
        </div>
        <NeInlineNotification
          v-if="extensions.isError.value || queues.isError.value"
          kind="error"
          :title="loadError(extensions.error.value, queues.error.value)"
        />
        <TransferToPeople :form="form" :catalog="catalog" :agents="agents" />
      </template>
    </div>
    <div v-if="transfer" data-tool="recent" class="flex flex-col gap-6">
      <AppToggle
        :model-value="recentOn"
        :label="t('agentTools.recent')"
        :tip="t('agentEditor.recentTip')"
        :disabled="!transfer.enabled"
        @update:model-value="
          form.clearError('lookback');
          configure('pbx.transfer', { recent_callers_enabled: $event });
        "
      />
      <div v-if="recentOn" data-field="lookback" class="max-w-xs">
        <NeTextInput
          :model-value="String(config.recent_caller_lookback_days ?? '')"
          :label="t('agentTools.lookback')"
          :placeholder="t('agentEditor.lookbackPlaceholder')"
          :helper-text="t('agentTools.lookbackHelp')"
          type="number"
          min="1"
          max="90"
          :invalid-message="form.errors.value.lookback"
          @update:model-value="number('recent_caller_lookback_days', $event)"
        />
      </div>
      <div
        v-if="recentOn && mode === 'edit'"
        class="flex max-w-xl flex-col gap-6"
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
          :options="callbackOptions"
          :label="t('destinationPicker.recent_caller_denylist')"
          :placeholder="t('destinationPickerPlaceholder')"
          :max-options-shown="50"
          v-bind="multiselectLabels"
          @update:model-value="exclude"
        />
      </div>
    </div>
    <div v-if="hangup" data-tool="hangup" class="flex flex-col gap-6">
      <AppToggle
        :model-value="hangup.enabled"
        :label="t('agentTools.endCall')"
        :tip="t('agentTools.endCallHelp')"
        @update:model-value="
          form.clearError('goodbye');
          update('telephony.hangup', { enabled: $event });
        "
      />
      <div v-if="hangup.enabled" data-field="goodbye" class="max-w-xs">
        <NeTextInput
          :model-value="String(hangup.config.playback_timeout_seconds ?? '')"
          :label="t('agentTools.goodbye')"
          :placeholder="t('agentEditor.goodbyePlaceholder')"
          :helper-text="t('agentTools.goodbyeHelp')"
          type="number"
          min="1"
          max="10"
          :invalid-message="form.errors.value.goodbye"
          @update:model-value="number('playback_timeout_seconds', $event)"
        />
      </div>
    </div>
  </div>
  <DestinationsDrawer
    v-if="mode === 'edit'"
    :is-shown="drawer"
    :selection="selection"
    :extensions="extensions.data.value || []"
    :queues="queues.data.value || []"
    @close="drawer = false"
    @save="saveDestinations"
  />
</template>
