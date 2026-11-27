<script setup lang="ts">
import { NeTooltip } from "@nethesis/vue-components";
import { faCircleInfo } from "@fortawesome/free-solid-svg-icons";
defineProps<{ text: string; label: string }>();
</script>
<template>
  <NeTooltip trigger-event="mouseenter focus" placement="top">
    <template #trigger>
      <button
        type="button"
        class="focus-visible:outline-primary-500 rounded-sm align-middle text-indigo-800 focus-visible:outline-2 focus-visible:outline-offset-2 dark:text-indigo-300"
        :aria-label="label"
      >
        <FontAwesomeIcon
          :icon="faCircleInfo"
          class="size-4"
          aria-hidden="true"
        />
      </button>
    </template>
    <template #content>{{ text }}</template>
  </NeTooltip>
</template>
