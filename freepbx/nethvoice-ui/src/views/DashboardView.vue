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
  faTriangleExclamation,
  faUserGroup,
  type IconDefinition,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
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
  combineLiveCalls,
  DASHBOARD_LIVE_REFRESH_INTERVAL,
  summarizeDevices,
  summarizePresence,
  summarizeTrunks,
  type DeviceType,
  type PresenceStatus,
} from '@/lib/dashboard/live'
import { listInboundRouteDestinations, listTrunkStatuses } from '@/lib/dashboard/routing'
import { useDashboardCounter } from '@/queries/dashboard/counters'
import {
  useDashboardLiveExtensions,
  useDashboardLiveTrunks,
  useDashboardLiveUsers,
} from '@/queries/dashboard/live'
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
const {
  state: subscriptionState,
  refetch: refetchSubscription,
  refresh: refreshSubscription,
} = useDashboardSubscription()
const { state: trunksState, refetch: refetchTrunks, refresh: refreshTrunks } = useTrunks()
const {
  state: inboundRoutesState,
  refetch: refetchInboundRoutes,
  refresh: refreshInboundRoutes,
} = useInboundRoutes()
const liveExtensionsQuery = useDashboardLiveExtensions()
const liveTrunksQuery = useDashboardLiveTrunks()
const liveUsersQuery = useDashboardLiveUsers()
const liveQueries = [liveExtensionsQuery, liveTrunksQuery, liveUsersQuery]

const toCounterQuery = (card: CounterCard) => {
  const { state, refetch, refresh } = useDashboardCounter(card.id)
  return { ...card, state, refetch, refresh }
}

const countersBeforeCalls = COUNTER_CARDS_BEFORE_CALLS.map(toCounterQuery)
const countersAfterCalls = COUNTER_CARDS_AFTER_CALLS.map(toCounterQuery)
const counterQueries = [...countersBeforeCalls, ...countersAfterCalls]

const failedCounters = computed(() =>
  counterQueries.filter((query) => query.state.value.status === 'error'),
)

const liveExtensions = computed(() => liveExtensionsQuery.state.value.data)
const liveTrunks = computed(() => liveTrunksQuery.state.value.data)
const liveUsers = computed(() => liveUsersQuery.state.value.data)

const extensionsLoading = computed(() => liveExtensionsQuery.state.value.status === 'pending')
const liveTrunksLoading = computed(() => liveTrunksQuery.state.value.status === 'pending')
const usersLoading = computed(() => liveUsersQuery.state.value.status === 'pending')

const presenceLoading = usersLoading
const devicesLoading = computed(() => usersLoading.value || extensionsLoading.value)
const callsLoading = computed(() => extensionsLoading.value || liveTrunksLoading.value)

const failedLiveQueries = computed(() =>
  liveQueries.filter((query) => query.state.value.status === 'error'),
)

const presence = computed(() => (liveUsers.value ? summarizePresence(liveUsers.value.data) : null))

const devices = computed(() =>
  liveUsers.value && liveExtensions.value
    ? summarizeDevices(liveUsers.value.data, liveExtensions.value.data)
    : null,
)

const liveCalls = computed(() =>
  liveExtensions.value && liveTrunks.value
    ? combineLiveCalls(liveExtensions.value, liveTrunks.value)
    : null,
)

const updatedAt = computed(() => {
  const fetchedAt = Math.max(
    0,
    ...[liveExtensions.value, liveTrunks.value, liveUsers.value].map(
      (snapshot) => snapshot?.fetchedAt ?? 0,
    ),
  )

  return fetchedAt
    ? new Intl.DateTimeFormat(locale.value, { timeStyle: 'medium' }).format(fetchedAt)
    : ''
})

const presenceBars = computed<ChartBar[]>(() =>
  (Object.keys(PRESENCE_STYLES) as PresenceStatus[]).map((status) => ({
    id: status,
    label: t(`dashboard.presence.${status}`),
    value: presence.value?.[status] ?? 0,
    ...PRESENCE_STYLES[status],
  })),
)

const deviceBars = computed<ChartBar[]>(() =>
  (Object.keys(DEVICE_STYLES) as DeviceType[]).map((deviceType) => ({
    id: deviceType,
    label: t(DEVICE_STYLES[deviceType].label),
    value: devices.value?.[deviceType] ?? 0,
    fillClass: DEVICE_STYLES[deviceType].fillClass,
    dotClass: DEVICE_STYLES[deviceType].dotClass,
  })),
)

const trunkRows = computed(() =>
  listTrunkStatuses(
    trunksState.value.data ?? [],
    liveTrunks.value ? summarizeTrunks(liveTrunks.value.data) : undefined,
  ),
)

const inboundRouteRows = computed(() =>
  listInboundRouteDestinations(inboundRoutesState.value.data ?? [], {
    describeKind: (kind) => t(`routes.destination_kind.${kind}`),
    anyDid: t('dashboard.inbound_routes.any_did'),
  }),
)

function retryCounters() {
  failedCounters.value.forEach((query) => query.refetch())
}

function retryLive() {
  failedLiveQueries.value.forEach((query) => query.refetch())
}

usePolling(() => {
  if (loginStore.isAuthenticated) {
    liveQueries
      .filter((query) => query.asyncStatus.value === 'idle')
      .forEach((query) => query.refetch())
  }
}, DASHBOARD_LIVE_REFRESH_INTERVAL)

usePolling(() => {
  if (loginStore.isAuthenticated) {
    counterQueries.forEach((query) => query.refresh())
    refreshSubscription()
    refreshTrunks()
    refreshInboundRoutes()
  }
}, DASHBOARD_COUNTERS_REFRESH_INTERVAL)
</script>

<template>
  <div>
    <div class="mb-8 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
      <NeHeading tag="h3" aria-level="1">{{ $t('dashboard.title') }}</NeHeading>
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
        v-if="failedLiveQueries.length"
        :error="failedLiveQueries[0].state.value.error"
        :title="$t('dashboard.cannot_load_live_data')"
        @retry="retryLive"
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
          :counter="liveCalls?.calls.length"
          :loading="callsLoading"
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
      <div
        v-if="presenceLoading || presence || devicesLoading || devices || callsLoading || liveCalls"
        class="grid grid-cols-1 gap-6 md:grid-cols-2 2xl:grid-cols-4"
      >
        <DashboardBreakdownCard
          v-if="presenceLoading || presence"
          data-testid="presence-card"
          :title="$t('dashboard.presence.title')"
          :bars="presenceBars"
          orientation="vertical"
          :loading="presenceLoading"
        />
        <DashboardBreakdownCard
          v-if="devicesLoading || devices"
          data-testid="devices-card"
          :title="$t('dashboard.devices.title')"
          :tooltip="$t('dashboard.devices.tooltip')"
          :empty-text="$t('dashboard.devices.no_devices')"
          :bars="deviceBars"
          orientation="horizontal"
          :loading="devicesLoading"
        />
        <DashboardCallsCard
          v-if="callsLoading || liveCalls"
          class="md:col-span-2"
          :calls="liveCalls?.calls ?? []"
          :fetched-at="liveCalls?.fetchedAt ?? 0"
          :loading="callsLoading"
        />
      </div>
      <div class="grid grid-cols-1 gap-6 md:grid-cols-2 2xl:grid-cols-4">
        <DashboardListCard
          v-if="!trunksState.error || trunksState.data"
          data-testid="trunks-card"
          :title="$t('dashboard.trunks.title')"
          :items="trunkRows"
          :empty-title="$t('dashboard.trunks.no_trunks')"
          :empty-icon="faNetworkWired"
          :loading="trunksState.status === 'pending'"
        >
          <template #value="{ item }">
            <TrunkStatusIndicator class="whitespace-nowrap" :status="item.status" />
          </template>
        </DashboardListCard>
        <DashboardListCard
          v-if="!inboundRoutesState.error || inboundRoutesState.data"
          data-testid="inbound-routes-card"
          :title="$t('dashboard.inbound_routes.title')"
          :items="inboundRouteRows"
          :empty-title="$t('dashboard.inbound_routes.no_routes')"
          :empty-icon="faRoute"
          :loading="inboundRoutesState.status === 'pending'"
        >
          <template #value="{ item }">
            <span
              v-if="item.invalidDestination"
              class="inline-flex items-center gap-2 text-amber-700 dark:text-amber-500"
            >
              <FontAwesomeIcon
                :icon="faTriangleExclamation"
                class="size-4 shrink-0"
                aria-hidden="true"
              />
              {{ $t('dashboard.inbound_routes.invalid_destination') }}
            </span>
            <template v-else>{{ item.destination || '-' }}</template>
          </template>
        </DashboardListCard>
      </div>
    </div>
  </div>
</template>
