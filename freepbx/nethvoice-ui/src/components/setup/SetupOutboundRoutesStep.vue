<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import SetupStepLayout from './SetupStepLayout.vue'
import OutboundRoutesTable from '@/components/routes/OutboundRoutesTable.vue'
import { useSetupNavigation } from '@/composables/useSetupNavigation'
import { useOutboundRoutes } from '@/queries/routes/outbound'
import { usePbxCountry } from '@/queries/setup/pbxCountry'

const { state: routesState } = useOutboundRoutes()
const { advancing, goToNextStep } = useSetupNavigation('outbound-routes')

usePbxCountry()
</script>

<template>
  <SetupStepLayout
    step-id="outbound-routes"
    :title="$t('setup.outbound_routes.title')"
    :next-loading="advancing"
    :next-disabled="routesState.status === 'pending'"
    @next="goToNextStep()"
  >
    <template #description>
      <p class="text-secondary-neutral max-w-3xl">
        {{ $t('setup.outbound_routes.description_line_1') }}<br />
        {{ $t('setup.outbound_routes.description_line_2') }}
      </p>
    </template>
    <OutboundRoutesTable :show-filters="false" />
  </SetupStepLayout>
</template>
