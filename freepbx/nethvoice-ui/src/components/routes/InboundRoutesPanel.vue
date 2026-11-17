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

const isEmpty = computed(
  () => state.value.status === 'success' && (state.value.data ?? []).length === 0,
)
</script>

<template>
  <div>
    <div class="mb-8 flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
      <p class="text-secondary-neutral max-w-2xl">
        {{ $t('routes.inbound_description_line_1') }}<br />
        {{ $t('routes.inbound_description_line_2') }}
      </p>
      <CreateInboundRouteButton v-if="!isEmpty" size="lg" />
    </div>
    <InboundRoutesTable>
      <template #empty-state-action>
        <CreateInboundRouteButton size="lg" />
      </template>
    </InboundRoutesTable>
  </div>
</template>
