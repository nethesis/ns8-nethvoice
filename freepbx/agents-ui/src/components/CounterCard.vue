<script setup lang="ts">
import { NeCard, NeHeading } from "@nethesis/vue-components";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { useI18n } from "vue-i18n";
import InfoTip from "./InfoTip.vue";
defineProps<{
  title: string;
  value: string | number;
  icon?: IconDefinition;
  tooltip?: string;
  note?: string;
  testid?: string;
}>();
const { t } = useI18n();
</script>
<template>
  <!-- The counter card of My Nethesis: icon and title on the left, the
       counter on the top right, the note below. -->
  <NeCard class="flex h-full flex-col">
    <template #title>
      <div class="flex items-start gap-3">
        <FontAwesomeIcon
          v-if="icon"
          :icon="icon"
          class="text-secondary-neutral size-5 shrink-0"
          aria-hidden="true"
        />
        <div class="min-w-0">
          <NeHeading tag="h6" class="text-secondary-neutral inline uppercase">{{
            title
          }}</NeHeading>
          <InfoTip
            v-if="tooltip"
            class="ml-2 align-middle"
            :text="tooltip"
            :label="t('agentEditor.moreInfo', { name: title })"
          />
        </div>
      </div>
    </template>
    <template #topRight>
      <div
        class="text-counter text-4xl font-medium whitespace-nowrap"
        :data-testid="testid"
      >
        {{ value }}
      </div>
    </template>
    <p v-if="note" class="text-tertiary-neutral pt-2 text-sm">{{ note }}</p>
  </NeCard>
</template>
