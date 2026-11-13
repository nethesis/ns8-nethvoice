<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useQueryCache } from '@pinia/colada'
import { NeInlineNotification, NeModal, NeSpinner } from '@nethesis/vue-components'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { faCircleInfo, faCheck } from '@fortawesome/free-solid-svg-icons'
import SetupStepLayout from './SetupStepLayout.vue'
import SetupSummarySection from './SetupSummarySection.vue'
import BrandLogo from '@/components/shell/BrandLogo.vue'
import { useOutboundRouteLabels } from '@/composables/useOutboundRouteLabels'
import { usePbxLanguages } from '@/queries/settings/system'
import { useUsers } from '@/queries/users/users'
import { useTrunks } from '@/queries/trunks/trunks'
import { useGateways } from '@/queries/trunks/gateways'
import { useInboundRoutes } from '@/queries/routes/inbound'
import { useOutboundRoutes } from '@/queries/routes/outbound'
import { getCountryLabel } from '@/lib/settings/system'
import { countConfiguredUsers } from '@/lib/users/users'
import { getVoipTrunks } from '@/lib/trunks/trunks'
import { getGatewayTrunkIds } from '@/lib/trunks/gateways'
import { getInboundRouteName } from '@/lib/routes/inbound'
import { getRoutesLocale } from '@/lib/routes/outbound'
import { getLanguageName, getSummaryWarnings } from '@/lib/setup/summary'
import { LEGACY_FINAL_STEP } from '@/lib/setup/steps'
import { postWizardState, WIZARD_STATE_KEY } from '@/lib/setup/wizard'
import { useSetupStore } from '@/stores/setup'
import { useRuntimeConfigStore } from '@/stores/runtimeConfig'
import { describeError } from '@/stores/notifications'

const { t, locale } = useI18n()
const router = useRouter()
const queryCache = useQueryCache()
const setupStore = useSetupStore()
const runtimeConfigStore = useRuntimeConfigStore()
const { getRouteTitle } = useOutboundRouteLabels()

const { state: languagesState, refetch: refetchLanguages } = usePbxLanguages()
const { state: usersState, refetch: refetchUsers } = useUsers()
const { state: trunksState, refetch: refetchTrunks } = useTrunks()
const { state: gatewaysState, refetch: refetchGateways } = useGateways()
const { state: inboundState, refetch: refetchInbound } = useInboundRoutes()
const { state: outboundState, refetch: refetchOutbound } = useOutboundRoutes()

const completing = ref(false)
const isFinishModalShown = ref(false)
const completionError = ref<unknown>(null)
let completionStarted = false

const country = computed(
  () => setupStore.country || getRoutesLocale(outboundState.value.data ?? []),
)

const configuredUsers = computed(() =>
  usersState.value.data ? countConfiguredUsers(usersState.value.data) : undefined,
)

const gateways = computed(() => gatewaysState.value.data ?? [])

const voipTrunks = computed(() =>
  trunksState.value.data && gatewaysState.value.data
    ? getVoipTrunks(trunksState.value.data, getGatewayTrunkIds(gatewaysState.value.data))
    : undefined,
)

const warnings = computed(() =>
  getSummaryWarnings({
    usersWithExtension: configuredUsers.value,
    physicalTrunks: gatewaysState.value.data?.length,
    voipTrunks: voipTrunks.value?.length,
    inboundRoutes: inboundState.value.data?.length,
    outboundRoutes: outboundState.value.data?.length,
    outboundRoutesWithoutTrunks: outboundState.value.data?.filter(
      (route) => route.trunks.length === 0,
    ).length,
  }),
)

function askToCompleteSetup() {
  if (!completionStarted) {
    isFinishModalShown.value = true
  }
}

async function completeSetup() {
  if (completionStarted) {
    return
  }
  isFinishModalShown.value = false
  completionStarted = true
  completing.value = true
  completionError.value = null

  try {
    await postWizardState(LEGACY_FINAL_STEP, false)
    setupStore.reset()
    await queryCache.invalidateQueries({ key: [WIZARD_STATE_KEY] })
    await router.replace({ name: 'dashboard' })
  } catch (error) {
    completionStarted = false
    completionError.value = error
  } finally {
    completing.value = false
  }
}
</script>

<template>
  <SetupStepLayout
    step-id="summary"
    :title="t('setup.summary.title')"
    :description="t('setup.summary.description')"
    :next-label="t('setup.summary.finish_setup')"
    :next-loading="completing"
    hide-next-icon
    :next-prefix-icon="faCheck"
    :inert="completing || undefined"
    @next="askToCompleteSetup"
  >
    <div class="flex flex-col gap-8">
      <NeInlineNotification
        v-if="warnings.length"
        kind="warning"
        :title="t('setup.summary.warnings_title')"
        class="max-w-3xl"
      >
        <template #description>
          <ul class="list-inside list-disc">
            <li v-for="warning in warnings" :key="warning">
              {{ t(`setup.summary.warning.${warning}`) }}
            </li>
          </ul>
        </template>
      </NeInlineNotification>
      <SetupSummarySection
        :title="`1. ${t('setup.system.title')}`"
        :loading="languagesState.status === 'pending'"
        :error="languagesState.error"
        @retry="refetchLanguages()"
      >
        <p>
          <span class="font-medium">{{ t('setup.system.pbx_country') }}:</span>
          {{ country ? getCountryLabel(country, locale) : t('setup.summary.not_set') }}
        </p>
        <p>
          <span class="font-medium">{{ t('setup.system.pbx_language') }}:</span>
          {{
            languagesState.data?.defaultLanguage
              ? getLanguageName(languagesState.data.defaultLanguage, locale)
              : t('setup.summary.not_set')
          }}
        </p>
      </SetupSummarySection>
      <SetupSummarySection
        :title="`2. ${t('setup.summary.extensions')}`"
        :loading="usersState.status === 'pending'"
        :error="usersState.error"
        @retry="refetchUsers()"
      >
        <p>
          {{
            t('setup.summary.users_with_extension', {
              configured: configuredUsers ?? 0,
              total: usersState.data?.length ?? 0,
            })
          }}
        </p>
        <p class="flex items-center gap-2">
          <FontAwesomeIcon
            :icon="faCircleInfo"
            class="h-4 w-4 shrink-0 text-indigo-500 dark:text-indigo-400"
            aria-hidden="true"
          />
          {{ t('setup.summary.users_defaults') }}
        </p>
      </SetupSummarySection>
      <SetupSummarySection
        :title="`3. ${t('setup.summary.physical_trunks')}`"
        :loading="gatewaysState.status === 'pending'"
        :error="gatewaysState.error"
        @retry="refetchGateways()"
      >
        <ul v-if="gateways.length">
          <li v-for="gateway in gateways" :key="gateway.id" class="wrap-anywhere">
            {{
              [gateway.name || gateway.manufacturer, gateway.ipAddress].filter(Boolean).join(' ')
            }}
          </li>
        </ul>
        <p v-else>{{ t('setup.summary.no_physical_trunks') }}</p>
      </SetupSummarySection>
      <SetupSummarySection
        :title="`4. ${t('setup.voip_trunks.title')}`"
        :loading="trunksState.status === 'pending' || gatewaysState.status === 'pending'"
        :error="trunksState.error ?? gatewaysState.error"
        @retry="trunksState.error ? refetchTrunks() : refetchGateways()"
      >
        <ul v-if="voipTrunks?.length">
          <li v-for="trunk in voipTrunks" :key="trunk.id" class="flex flex-wrap gap-x-2">
            <span class="wrap-anywhere">{{ trunk.name }}</span>
            <span v-if="trunk.phoneNumber" class="wrap-anywhere">{{ trunk.phoneNumber }}</span>
          </li>
        </ul>
        <p v-else>{{ t('setup.summary.no_voip_trunks') }}</p>
      </SetupSummarySection>
      <SetupSummarySection
        :title="`5. ${t('setup.inbound_routes.title')}`"
        :loading="inboundState.status === 'pending'"
        :error="inboundState.error"
        @retry="refetchInbound()"
      >
        <ul v-if="inboundState.data?.length">
          <li v-for="route in inboundState.data" :key="route.id" class="wrap-anywhere">
            <span class="font-medium">{{ getInboundRouteName(route) }}:</span>
            {{ route.description || '-' }}
          </li>
        </ul>
        <p v-else>{{ t('setup.summary.no_inbound_routes') }}</p>
      </SetupSummarySection>
      <SetupSummarySection
        :title="`6. ${t('setup.outbound_routes.title')}`"
        :loading="outboundState.status === 'pending'"
        :error="outboundState.error"
        @retry="refetchOutbound()"
      >
        <ul v-if="outboundState.data?.length">
          <li v-for="route in outboundState.data" :key="route.id" class="wrap-anywhere">
            <span class="font-medium">{{ getRouteTitle(route) }}:</span>
            {{
              route.trunks.length
                ? route.trunks.map((trunk) => trunk.name).join(', ')
                : t('routes.no_trunks')
            }}
          </li>
        </ul>
        <p v-else>{{ t('setup.summary.no_outbound_routes') }}</p>
      </SetupSummarySection>
      <NeInlineNotification
        v-if="completionError"
        kind="error"
        :title="t('setup.summary.cannot_complete_setup')"
        :description="describeError(completionError)"
        class="max-w-3xl"
      />
    </div>
  </SetupStepLayout>
  <NeModal
    :visible="isFinishModalShown"
    kind="warning"
    :title="t('setup.summary.finish_setup')"
    :primary-label="t('setup.summary.finish')"
    :cancel-label="t('common.cancel')"
    :close-aria-label="t('common.close')"
    @close="isFinishModalShown = false"
    @primary-click="completeSetup"
  >
    <p>{{ t('setup.summary.finish_setup_description') }}</p>
  </NeModal>
  <Teleport to="body">
    <div
      v-if="completing"
      class="fixed inset-0 z-100 flex flex-col items-center justify-center gap-10 bg-gray-50 dark:bg-gray-950"
      role="status"
      aria-live="polite"
    >
      <NeSpinner size="8" />
      <BrandLogo class="h-12 w-auto" />
      <p class="text-primary-neutral">
        {{ t('setup.summary.completing', { brand: runtimeConfigStore.config.brandName }) }}
      </p>
    </div>
  </Teleport>
</template>
