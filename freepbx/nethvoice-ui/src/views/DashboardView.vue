<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { NeHeading } from '@nethesis/vue-components'
import {
  faNetworkWired,
  faPhone,
  faRoute,
  faUserGroup,
  type IconDefinition,
} from '@fortawesome/free-solid-svg-icons'
import { faOfficePhone } from '@nethesis/nethesis-solid-svg-icons'
import LoadError from '@/components/common/LoadError.vue'
import DashboardBreakdownCard from '@/components/dashboard/DashboardBreakdownCard.vue'
import DashboardCallsCard from '@/components/dashboard/DashboardCallsCard.vue'
import DashboardCounterCard from '@/components/dashboard/DashboardCounterCard.vue'
import DashboardListCard from '@/components/dashboard/DashboardListCard.vue'
import DashboardSystemCard from '@/components/dashboard/DashboardSystemCard.vue'
import TrunkStatusIndicator from '@/components/trunks/TrunkStatusIndicator.vue'
import { usePolling } from '@/composables/usePolling'
import type { ChartBar } from '@/lib/dashboard/chart'
import {
  DASHBOARD_COUNTERS_REFRESH_INTERVAL,
  type DashboardCounterId,
} from '@/lib/dashboard/counters'
import {
  DASHBOARD_LIVE_REFRESH_INTERVAL,
  type DeviceType,
  type PresenceStatus,
} from '@/lib/dashboard/live'
import { listInboundRouteDestinations, listTrunkRegistrations } from '@/lib/dashboard/routing'
import { useDashboardCounter } from '@/queries/dashboard/counters'
import { useDashboardLive } from '@/queries/dashboard/live'
import { useDashboardSubscription } from '@/queries/dashboard/subscription'
import { useInboundRoutes } from '@/queries/routes/inbound'
import { useTrunks } from '@/queries/trunks/trunks'
import { useLoginStore } from '@/stores/login'

type CounterCard = { id: DashboardCounterId; label: string; icon: IconDefinition }

const COUNTER_CARDS_BEFORE_CALLS: CounterCard[] = [
  { id: 'users', label: 'dashboard.counters.users', icon: faUserGroup },
  { id: 'groups', label: 'dashboard.counters.groups', icon: faUserGroup },
  { id: 'physicalPhones', label: 'dashboard.counters.physical_phones', icon: faOfficePhone },
]

const COUNTER_CARDS_AFTER_CALLS: CounterCard[] = [
  { id: 'trunks', label: 'dashboard.counters.trunks', icon: faNetworkWired },
  { id: 'inboundRoutes', label: 'dashboard.counters.inbound_routes', icon: faRoute },
  { id: 'outboundRoutes', label: 'dashboard.counters.outbound_routes', icon: faRoute },
]

const PRESENCE_STYLES: Record<PresenceStatus, { fillClass: string; dotClass: string }> = {
  online: {
    fillClass: 'fill-green-500 dark:fill-green-400',
    dotClass: 'bg-green-500 dark:bg-green-400',
  },
  busy: { fillClass: 'fill-rose-700 dark:fill-rose-500', dotClass: 'bg-rose-700 dark:bg-rose-500' },
  dnd: { fillClass: 'fill-blue-700 dark:fill-blue-500', dotClass: 'bg-blue-700 dark:bg-blue-500' },
  offline: {
    fillClass: 'fill-gray-700 dark:fill-gray-500',
    dotClass: 'bg-gray-700 dark:bg-gray-500',
  },
}

const DEVICE_STYLES: Record<DeviceType, { label: string; fillClass: string; dotClass: string }> = {
  webPhone: {
    label: 'dashboard.devices.web_phone',
    fillClass: 'fill-indigo-500 dark:fill-indigo-400',
    dotClass: 'bg-indigo-500 dark:bg-indigo-400',
  },
  desktopPhone: {
    label: 'dashboard.devices.desktop_phone',
    fillClass: 'fill-rose-700 dark:fill-rose-500',
    dotClass: 'bg-rose-700 dark:bg-rose-500',
  },
  mobileApp: {
    label: 'dashboard.devices.mobile_app',
    fillClass: 'fill-amber-500 dark:fill-amber-400',
    dotClass: 'bg-amber-500 dark:bg-amber-400',
  },
}

const { t, locale } = useI18n()
const loginStore = useLoginStore()
const { state: subscriptionState, refetch: refetchSubscription } = useDashboardSubscription()
const { state: liveState, refetch: refetchLive } = useDashboardLive()
const { state: trunksState, refetch: refetchTrunks } = useTrunks()
const { state: inboundRoutesState, refetch: refetchInboundRoutes } = useInboundRoutes()

const toCounterQuery = (card: CounterCard) => {
  const { state, refetch } = useDashboardCounter(card.id)
  return { ...card, state, refetch }
}

const countersBeforeCalls = COUNTER_CARDS_BEFORE_CALLS.map(toCounterQuery)
const countersAfterCalls = COUNTER_CARDS_AFTER_CALLS.map(toCounterQuery)
const counterQueries = [...countersBeforeCalls, ...countersAfterCalls]

const failedCounters = computed(() =>
  counterQueries.filter((query) => query.state.value.status === 'error'),
)

const live = computed(() => liveState.value.data)
const liveLoading = computed(() => liveState.value.status === 'pending')

const updatedAt = computed(() =>
  live.value
    ? new Intl.DateTimeFormat(locale.value, { timeStyle: 'medium' }).format(live.value.fetchedAt)
    : '',
)

const presenceBars = computed<ChartBar[]>(() =>
  (Object.keys(PRESENCE_STYLES) as PresenceStatus[]).map((status) => ({
    id: status,
    label: t(`dashboard.presence.${status}`),
    value: live.value?.presence[status] ?? 0,
    ...PRESENCE_STYLES[status],
  })),
)

const deviceBars = computed<ChartBar[]>(() =>
  (Object.keys(DEVICE_STYLES) as DeviceType[]).map((deviceType) => ({
    id: deviceType,
    label: t(DEVICE_STYLES[deviceType].label),
    value: live.value?.devices[deviceType] ?? 0,
    fillClass: DEVICE_STYLES[deviceType].fillClass,
    dotClass: DEVICE_STYLES[deviceType].dotClass,
  })),
)

const trunkRows = computed(() =>
  listTrunkRegistrations(trunksState.value.data ?? [], live.value?.trunks),
)

const inboundRouteRows = computed(() =>
  listInboundRouteDestinations(inboundRoutesState.value.data ?? [], (kind) =>
    t(`routes.destination_kind.${kind}`),
  ),
)

function retryCounters() {
  failedCounters.value.forEach((query) => query.refetch())
}

usePolling(() => {
  if (loginStore.isAuthenticated) {
    refetchLive()
  }
}, DASHBOARD_LIVE_REFRESH_INTERVAL)

usePolling(() => {
  if (loginStore.isAuthenticated) {
    counterQueries.forEach((query) => query.refetch())
    refetchSubscription()
    refetchTrunks()
    refetchInboundRoutes()
  }
}, DASHBOARD_COUNTERS_REFRESH_INTERVAL)
</script>

<template>
  <div>
    <div class="mb-8 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
      <NeHeading tag="h3">{{ $t('dashboard.title') }}</NeHeading>
      <p v-if="updatedAt" class="text-tertiary-neutral" data-testid="updated-at">
        {{ $t('dashboard.updated_at', { time: updatedAt }) }}
      </p>
    </div>
    <div class="flex flex-col gap-6">
      <LoadError
        v-if="subscriptionState.error"
        :error="subscriptionState.error"
        :title="$t('dashboard.cannot_load_system')"
        @retry="refetchSubscription()"
      />
      <LoadError
        v-if="failedCounters.length"
        :error="failedCounters[0].state.value.error"
        :title="$t('dashboard.cannot_load_counters')"
        @retry="retryCounters"
      />
      <LoadError
        v-if="liveState.error"
        :error="liveState.error"
        :title="$t('dashboard.cannot_load_live_data')"
        @retry="refetchLive()"
      />
      <LoadError
        v-if="trunksState.error"
        :error="trunksState.error"
        :title="$t('dashboard.cannot_load_trunks')"
        @retry="refetchTrunks()"
      />
      <LoadError
        v-if="inboundRoutesState.error"
        :error="inboundRoutesState.error"
        :title="$t('dashboard.cannot_load_inbound_routes')"
        @retry="refetchInboundRoutes()"
      />
      <div class="grid grid-cols-1 gap-6 md:grid-cols-2 2xl:grid-cols-4">
        <DashboardSystemCard
          class="md:row-span-3"
          :subscription="subscriptionState.data"
          :loading="subscriptionState.status === 'pending'"
        />
        <DashboardCounterCard
          v-for="counter in countersBeforeCalls"
          :key="counter.id"
          :counter-id="counter.id"
          :title="$t(counter.label)"
          :icon="counter.icon"
          :counter="counter.state.value.data"
          :loading="counter.state.value.status === 'pending'"
        />
        <DashboardCounterCard
          counter-id="callsInProgress"
          :title="$t('dashboard.counters.calls_in_progress')"
          :icon="faPhone"
          :counter="live?.calls.length"
          :loading="liveLoading"
        />
        <DashboardCounterCard
          v-for="counter in countersAfterCalls"
          :key="counter.id"
          :counter-id="counter.id"
          :title="$t(counter.label)"
          :icon="counter.icon"
          :counter="counter.state.value.data"
          :loading="counter.state.value.status === 'pending'"
        />
      </div>
      <div v-if="liveLoading || live" class="grid grid-cols-1 gap-6 md:grid-cols-2 2xl:grid-cols-4">
        <DashboardBreakdownCard
          data-testid="presence-card"
          :title="$t('dashboard.presence.title')"
          :bars="presenceBars"
          orientation="vertical"
          :loading="liveLoading"
        />
        <DashboardBreakdownCard
          data-testid="devices-card"
          :title="$t('dashboard.devices.title')"
          :tooltip="$t('dashboard.devices.tooltip')"
          :bars="deviceBars"
          orientation="horizontal"
          :loading="liveLoading"
        />
        <DashboardCallsCard
          class="md:col-span-2"
          :calls="live?.calls ?? []"
          :fetched-at="live?.fetchedAt ?? 0"
          :loading="liveLoading"
        />
      </div>
      <div class="grid grid-cols-1 gap-6 md:grid-cols-2 2xl:grid-cols-4">
        <DashboardListCard
          v-if="!trunksState.error"
          data-testid="trunks-card"
          :title="$t('dashboard.trunks.title')"
          :items="trunkRows"
          :empty-title="$t('dashboard.trunks.no_trunks')"
          :empty-icon="faNetworkWired"
          :loading="trunksState.status === 'pending'"
        >
          <template #value="{ item }">
            <TrunkStatusIndicator class="whitespace-nowrap" :status="item.registration" />
          </template>
        </DashboardListCard>
        <DashboardListCard
          v-if="!inboundRoutesState.error"
          data-testid="inbound-routes-card"
          :title="$t('dashboard.inbound_routes.title')"
          :items="inboundRouteRows"
          :empty-title="$t('dashboard.inbound_routes.no_routes')"
          :empty-icon="faRoute"
          :loading="inboundRoutesState.status === 'pending'"
        >
          <template #value="{ item }">{{ item.destination || '-' }}</template>
        </DashboardListCard>
      </div>
    </div>
  </div>
</template>
