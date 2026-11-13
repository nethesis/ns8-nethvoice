<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import SetupStepLayout from './SetupStepLayout.vue'
import CreateInboundRouteButton from '@/components/routes/CreateInboundRouteButton.vue'
import InboundRoutesTable from '@/components/routes/InboundRoutesTable.vue'
import { useSetupNavigation } from '@/composables/useSetupNavigation'

const { advancing, goToNextStep } = useSetupNavigation('inbound-routes')
</script>

<template>
  <SetupStepLayout
    step-id="inbound-routes"
    :title="$t('setup.inbound_routes.title')"
    :next-loading="advancing"
    @next="goToNextStep()"
  >
    <template #description>
      <div class="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
        <p class="text-secondary-neutral max-w-3xl">
          {{ $t('setup.inbound_routes.description_line_1') }}<br />
          {{ $t('setup.inbound_routes.description_line_2') }}
        </p>
        <CreateInboundRouteButton kind="secondary" size="md" />
      </div>
    </template>
    <InboundRoutesTable />
  </SetupStepLayout>
</template>
