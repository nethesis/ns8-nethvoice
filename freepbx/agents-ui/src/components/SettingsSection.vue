<script setup lang="ts">
import { NeHeading } from "@nethesis/vue-components";
defineProps<{ title: string; description?: string; divider?: boolean }>();
</script>
<template>
  <section
    :class="['flex flex-col gap-6', divider && 'border-divider border-t pt-10']"
  >
    <div>
      <NeHeading tag="h5">{{ title }}</NeHeading>
      <p v-if="description" class="text-muted mt-1 max-w-2xl">
        {{ description }}
      </p>
    </div>
    <slot />
  </section>
</template>
