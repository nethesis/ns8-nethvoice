<script setup lang="ts">
import { NeCard, NeHeading, NeTooltip } from "@nethesis/vue-components";
defineProps<{
  title: string;
  value: string | number;
  icon?: string;
  tooltip?: string;
  note?: string;
  testid?: string;
}>();
</script>
<template>
  <NeCard class="counter-card flex h-full flex-col">
    <template #title>
      <div class="flex items-start gap-3">
        <FontAwesomeIcon
          v-if="icon"
          :icon="icon"
          class="text-tertiary-neutral size-5 shrink-0"
          aria-hidden="true"
        />
        <div class="text-tertiary-neutral">
          <NeHeading tag="h6" class="text-inherit uppercase">{{
            title
          }}</NeHeading>
        </div>
        <NeTooltip
          v-if="tooltip"
          trigger-event="mouseenter focus"
          placement="auto"
        >
          <template #trigger
            ><button
              type="button"
              class="text-indigo-800 dark:text-indigo-300"
              :aria-label="tooltip"
            >
              <FontAwesomeIcon
                icon="circle-info"
                class="size-4"
                aria-hidden="true"
              /></button
          ></template>
          <template #content>{{ tooltip }}</template>
        </NeTooltip>
      </div>
    </template>
    <template #topRight>
      <div class="text-counter text-4xl font-medium" :data-testid="testid">
        {{ value }}
      </div>
    </template>
    <p v-if="note" class="text-tertiary-neutral mt-2 text-sm">{{ note }}</p>
  </NeCard>
</template>
