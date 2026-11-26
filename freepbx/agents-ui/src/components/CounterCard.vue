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
  <!-- Title on top, value and note at the bottom: in a row of cards the
       values line up even when a title wraps. -->
  <NeCard class="flex h-full flex-col">
    <div class="flex h-full flex-col gap-4">
      <div class="flex items-start gap-3">
        <FontAwesomeIcon
          v-if="icon"
          :icon="icon"
          class="text-tertiary-neutral size-5 shrink-0"
          aria-hidden="true"
        />
        <NeHeading tag="h6" class="text-tertiary-neutral uppercase">{{
          title
        }}</NeHeading>
        <InfoTip
          v-if="tooltip"
          :text="tooltip"
          :label="t('agentEditor.moreInfo', { name: title })"
        />
      </div>
      <div class="mt-auto flex flex-col gap-2">
        <div
          class="text-counter text-4xl font-medium whitespace-nowrap"
          :data-testid="testid"
        >
          {{ value }}
        </div>
        <p class="text-tertiary-neutral min-h-5 text-sm">{{ note }}</p>
      </div>
    </div>
  </NeCard>
</template>
