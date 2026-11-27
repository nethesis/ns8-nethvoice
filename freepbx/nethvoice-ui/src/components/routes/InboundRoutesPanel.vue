<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed } from 'vue'
import CreateInboundRouteButton from './CreateInboundRouteButton.vue'
import InboundRoutesTable from './InboundRoutesTable.vue'
import { useInboundRoutes } from '@/queries/routes/inbound'

const { state } = useInboundRoutes()

const isLoading = computed(() => state.value.status === 'pending')

const isEmpty = computed(
  () => state.value.status === 'success' && (state.value.data ?? []).length === 0,
)
</script>

<template>
  <div>
    <div v-if="!isEmpty" class="mb-6 grid gap-x-4 gap-y-2 sm:grid-cols-[1fr_auto] sm:items-center">
      <p class="max-w-2xl text-gray-600 dark:text-gray-400">
        {{ $t('routes.inbound_description') }}
      </p>
      <CreateInboundRouteButton size="lg" class="justify-self-start" :disabled="isLoading" />
    </div>
    <InboundRoutesTable>
      <template #empty-state-action>
        <CreateInboundRouteButton size="lg" />
      </template>
    </InboundRoutesTable>
  </div>
</template>
