<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import CreateInboundRouteButton from './CreateInboundRouteButton.vue'
import InboundRoutesTable from './InboundRoutesTable.vue'
</script>

<template>
  <div class="flex flex-col gap-6">
    <div class="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
      <p class="text-secondary-neutral max-w-2xl">
        {{ $t('routes.inbound_description_line_1') }}<br />
        {{ $t('routes.inbound_description_line_2') }}
      </p>
      <CreateInboundRouteButton />
    </div>
    <InboundRoutesTable />
  </div>
</template>
