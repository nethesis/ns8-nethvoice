<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMutation, useQueryCache } from '@pinia/colada'
import { NeInlineNotification } from '@nethesis/vue-components'
import SetupStepLayout from './SetupStepLayout.vue'
import OutboundRoutesTable from '@/components/routes/OutboundRoutesTable.vue'
import { useOutboundRouteLabels } from '@/composables/useOutboundRouteLabels'
import { useSetupNavigation } from '@/composables/useSetupNavigation'
import { useOutboundRoutes } from '@/queries/routes/outbound'
import { OUTBOUND_ROUTES_KEY, postDefaultOutboundRoutes } from '@/lib/routes/outbound'
import { useSetupStore } from '@/stores/setup'

const { t } = useI18n()
const queryCache = useQueryCache()
const setupStore = useSetupStore()
const { describeRouteError } = useOutboundRouteLabels()
const { state: routesState } = useOutboundRoutes()
const { advancing, goToNextStep } = useSetupNavigation('outbound-routes')

const defaultRoutesRequested = ref(false)

const {
  mutate: createDefaultRoutesMutate,
  isLoading: createDefaultRoutesLoading,
  error: createDefaultRoutesError,
} = useMutation({
  mutation: (pbxLocale: string) => postDefaultOutboundRoutes(pbxLocale),
  onSettled: () => queryCache.invalidateQueries({ key: [OUTBOUND_ROUTES_KEY] }),
})

watch(
  () => routesState.value,
  (routes) => {
    if (
      routes.status === 'success' &&
      routes.data.length === 0 &&
      setupStore.country &&
      !defaultRoutesRequested.value
    ) {
      defaultRoutesRequested.value = true
      createDefaultRoutesMutate(setupStore.country)
    }
  },
  { immediate: true },
)
</script>

<template>
  <SetupStepLayout
    step-id="outbound-routes"
    :title="$t('setup.outbound_routes.title')"
    :next-loading="advancing"
    :next-disabled="routesState.status === 'pending' || createDefaultRoutesLoading"
    @next="goToNextStep()"
  >
    <template #description>
      <p class="text-secondary-neutral max-w-3xl">
        {{ $t('setup.outbound_routes.description_line_1') }}<br />
        {{ $t('setup.outbound_routes.description_line_2') }}
      </p>
    </template>
    <NeInlineNotification
      v-if="createDefaultRoutesError"
      kind="error"
      :title="t('routes.cannot_create_default_routes')"
      :description="describeRouteError(createDefaultRoutesError)"
    />
    <OutboundRoutesTable :show-filters="false" :busy="createDefaultRoutesLoading" />
  </SetupStepLayout>
</template>
