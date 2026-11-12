<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { NeButton } from '@nethesis/vue-components'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { faArrowUpRightFromSquare } from '@fortawesome/free-solid-svg-icons'
import OutboundRoutesTable from './OutboundRoutesTable.vue'
import { OUTBOUND_ROUTES_ADVANCED_URL } from '@/lib/config'

function openAdvancedSettings() {
  window.open(OUTBOUND_ROUTES_ADVANCED_URL, '_blank', 'noopener')
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
      <p class="text-secondary-neutral max-w-2xl">
        {{ $t('routes.outbound_description_line_1') }}<br />
        {{ $t('routes.outbound_description_line_2') }}
      </p>
      <NeButton kind="tertiary" size="lg" class="shrink-0" @click="openAdvancedSettings">
        <template #prefix>
          <FontAwesomeIcon :icon="faArrowUpRightFromSquare" class="h-4 w-4" aria-hidden="true" />
        </template>
        {{ $t('routes.advanced_settings') }}
        <span class="sr-only">{{ $t('routes.opens_in_new_tab') }}</span>
      </NeButton>
    </div>
    <OutboundRoutesTable />
  </div>
</template>
