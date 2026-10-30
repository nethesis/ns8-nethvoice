<script setup lang="ts">
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
defineProps<{ icon?: IconDefinition; title: string; description?: string }>();
</script>
<template>
  <div
    class="bg-elevation-2 flex flex-col items-center gap-5 rounded-md px-6 py-5 text-center sm:px-8 sm:py-7"
  >
    <FontAwesomeIcon
      v-if="icon"
      :icon="icon"
      class="size-8 text-gray-400 sm:size-12 dark:text-gray-500"
      aria-hidden="true"
    />
    <div class="flex flex-col items-center gap-1">
      <p
        class="text-secondary-neutral text-sm leading-6 font-medium sm:text-base"
      >
        {{ title }}
      </p>
      <p v-if="description" class="text-tertiary-neutral text-xs sm:text-sm">
        {{ description }}
      </p>
    </div>
    <slot />
  </div>
</template>
