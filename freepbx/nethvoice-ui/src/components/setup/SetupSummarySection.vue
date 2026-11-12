<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { NeSkeleton } from '@nethesis/vue-components'
import LoadError from '@/components/common/LoadError.vue'

const {
  title,
  loading = false,
  error = null,
} = defineProps<{
  title: string
  loading?: boolean
  error?: unknown
}>()

const emit = defineEmits<{ retry: [] }>()
</script>

<template>
  <section class="flex flex-col gap-1">
    <h2 class="text-primary-neutral text-lg font-medium">{{ title }}</h2>
    <NeSkeleton v-if="loading" :lines="2" class="max-w-md" />
    <LoadError v-else-if="error" :error="error" class="max-w-3xl" @retry="emit('retry')" />
    <div v-else class="text-tertiary-neutral flex flex-col gap-1">
      <slot />
    </div>
  </section>
</template>
