<script setup lang="ts">
defineProps<{ title: string; description?: string }>();
</script>
<template>
  <header class="mb-8 flex flex-wrap items-start justify-between gap-4">
    <div>
      <h1>{{ title }}</h1>
      <p v-if="description" class="nv-muted mt-2 max-w-4xl">
        {{ description }}
      </p>
    </div>
    <div class="nv-action-bar"><slot /></div>
  </header>
</template>
