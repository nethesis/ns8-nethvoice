<script setup lang="ts">
import { NeCard, NeHeading } from "@nethesis/vue-components";
defineProps<{ title: string; description?: string }>();
</script>
<template>
  <section class="grid grid-cols-1 gap-x-8 gap-y-4 lg:grid-cols-3">
    <div>
      <NeHeading tag="h6">{{ title }}</NeHeading>
      <p v-if="description" class="text-muted mt-1">
        {{ description }}
      </p>
    </div>
    <NeCard class="min-w-0 overflow-x-clip! overflow-y-visible! lg:col-span-2"
      ><slot
    /></NeCard>
  </section>
</template>
