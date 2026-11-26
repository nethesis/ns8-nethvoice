<script setup lang="ts">
import { NeEmptyState } from "@nethesis/vue-components";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
// NeEmptyState, with its action slot only when there is an action.
defineProps<{ icon?: IconDefinition; title: string; description?: string }>();
</script>
<template>
  <NeEmptyState
    :title="title"
    :description="description || ''"
    :icon="icon"
    class="text-center"
  >
    <template v-if="$slots.default" #default><slot /></template>
  </NeEmptyState>
</template>
