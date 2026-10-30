<script setup lang="ts">
import { computed, ref, watch } from "vue";
import {
  NeButton,
  NeCheckbox,
  NeInlineNotification,
  NeSideDrawer,
  NeTabs,
  NeTextInput,
} from "@nethesis/vue-components";
import { useI18n } from "vue-i18n";
import type { Destination } from "../composables/useDestinations";
export type DestinationSelection = {
  extensions: Record<string, string>;
  queues: Record<string, string>;
};
const props = defineProps<{
  isShown: boolean;
  selection: DestinationSelection;
  extensions: Destination[];
  queues: Destination[];
}>();
const emit = defineEmits<{ close: []; save: [value: DestinationSelection] }>();
const { t } = useI18n();
const MAX_EXTENSIONS = 100;
const draft = ref<DestinationSelection>({ extensions: {}, queues: {} });
const tab = ref<"extensions" | "queues">("extensions");
const search = ref("");
watch(
  () => props.isShown,
  (shown) => {
    if (!shown) return;
    draft.value = JSON.parse(JSON.stringify(props.selection));
    tab.value = "extensions";
    search.value = "";
  },
  { immediate: true },
);
const list = computed(() =>
  tab.value === "queues" ? props.queues : props.extensions,
);
const map = computed(() => draft.value[tab.value]);
const count = computed(() => Object.keys(map.value).length);
const visible = computed(() => {
  const query = search.value.trim().toLocaleLowerCase();
  return list.value.filter(
    (item) =>
      !query ||
      item.name.toLocaleLowerCase().includes(query) ||
      item.number.includes(query),
  );
});
const tabs = computed(() => [
  {
    name: "extensions",
    label: t("destinations.extensionsTab", {
      count: Object.keys(draft.value.extensions).length,
    }),
  },
  {
    name: "queues",
    label: t("destinations.queuesTab", {
      count: Object.keys(draft.value.queues).length,
    }),
  },
]);
const tooMany = computed(
  () => Object.keys(draft.value.extensions).length > MAX_EXTENSIONS,
);
function toggle(id: string, on: boolean) {
  if (on) {
    if (!(id in map.value)) map.value[id] = "";
  } else delete map.value[id];
}
function setAll(on: boolean) {
  for (const item of list.value) toggle(item.id, on);
}
function selectTab(value: string) {
  tab.value = value === "queues" ? "queues" : "extensions";
  search.value = "";
}
</script>
<template>
  <NeSideDrawer
    :is-shown="isShown"
    :title="t('destinations.manage')"
    :close-aria-label="t('closeDrawer')"
    @close="emit('close')"
  >
    <div class="flex flex-col gap-6">
      <p class="text-tertiary-neutral">{{ t("destinations.help") }}</p>
      <NeTabs
        :tabs="tabs"
        :selected="tab"
        :sr-select-tab-label="t('destinations.selectTab')"
        :sr-tabs-label="t('destinations.types')"
        @select-tab="selectTab"
      />
      <NeTextInput
        v-model="search"
        is-search
        :placeholder="
          t(
            tab === 'queues'
              ? 'destinations.filterQueues'
              : 'destinations.filterExtensions',
          )
        "
        :clear-search-label="t('clear')"
      />
      <div class="-mt-2 flex items-center gap-2">
        <span class="text-tertiary-neutral">{{
          t("destinations.selectedCount", { count, total: list.length })
        }}</span>
        <NeButton
          v-if="list.length && count === list.length"
          kind="tertiary"
          size="sm"
          @click="setAll(false)"
          >{{ t("clearSelection") }}</NeButton
        >
        <NeButton
          v-else-if="list.length"
          kind="tertiary"
          size="sm"
          @click="setAll(true)"
          >{{ t("selectAll") }}</NeButton
        >
      </div>
      <NeInlineNotification
        v-if="tooMany"
        kind="error"
        :title="t('destinations.tooMany', { max: MAX_EXTENSIONS })"
      />
      <p v-if="!visible.length" class="text-tertiary-neutral py-6 text-center">
        {{ t("noOptions") }}
      </p>
      <ul v-else class="divide-divider -mt-2 divide-y">
        <li
          v-for="item in visible"
          :key="item.id"
          class="flex flex-col gap-3 py-4"
        >
          <NeCheckbox
            :id="'dest-' + item.id"
            :model-value="item.id in map"
            :label="item.name"
            @update:model-value="toggle(item.id, $event)"
            ><template #description>{{
              t(
                tab === "queues"
                  ? "destinations.queueNumber"
                  : "destinations.extensionNumber",
                { number: item.number },
              )
            }}</template></NeCheckbox
          >
          <div v-if="item.id in map" class="ml-7">
            <NeTextInput
              v-model="map[item.id]"
              :label="t('destinations.routingDescription')"
              optional
              :optional-label="t('optional')"
              :placeholder="t('destinations.routingPlaceholder')"
              maxlength="500"
            />
          </div>
        </li>
      </ul>
      <div class="border-divider flex justify-end gap-4 border-t pt-6">
        <NeButton kind="tertiary" @click="emit('close')">{{
          t("cancel")
        }}</NeButton>
        <NeButton
          kind="primary"
          :disabled="tooMany"
          @click="emit('save', draft)"
          >{{ t("saveAction") }}</NeButton
        >
      </div>
    </div>
  </NeSideDrawer>
</template>
