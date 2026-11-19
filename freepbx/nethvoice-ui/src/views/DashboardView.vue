<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef } from 'vue'
import { useEventListener } from '@vueuse/core'
import { useI18n } from 'vue-i18n'
import type { RouteLocationRaw } from 'vue-router'
import { NeHeading, NeInlineNotification } from '@nethesis/vue-components'
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
import DashboardBreakdownCard from '@/components/dashboard/DashboardBreakdownCard.vue'
import DashboardCallsCard from '@/components/dashboard/DashboardCallsCard.vue'
import DashboardCounterCard from '@/components/dashboard/DashboardCounterCard.vue'
import DashboardDragHandle from '@/components/dashboard/DashboardDragHandle.vue'
import DashboardHourlyCard from '@/components/dashboard/DashboardHourlyCard.vue'
import DashboardListCard from '@/components/dashboard/DashboardListCard.vue'
import DashboardSystemCard from '@/components/dashboard/DashboardSystemCard.vue'
import TrunkStatusIndicator from '@/components/trunks/TrunkStatusIndicator.vue'
import { usePolling } from '@/composables/usePolling'
import { CALL_OUTCOMES, type CallOutcome } from '@/lib/dashboard/calls'
import type { ChartBar } from '@/lib/dashboard/chart'
import { getPhoneStatusBars } from '@/lib/dashboard/phones'
import {
  findCardInAdjacentRow,
  moveCardBy,
  moveCardTo,
  type CardMoveDirection,
  type CardRect,
  type DashboardCardId,
} from '@/lib/dashboard/layout'
import { canReadCtiLiveData, isCtiAccessDenied } from '@/lib/dashboard/ctiClient'
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
import { useDashboardCalls, useDashboardCallsHistory } from '@/queries/dashboard/calls'
import { useDashboardCounter } from '@/queries/dashboard/counters'
import { useDashboardPhones } from '@/queries/dashboard/phones'
import {
  useDashboardLiveExtensions,
  useDashboardLiveTrunks,
  useDashboardLiveUsers,
} from '@/queries/dashboard/live'
import { useDashboardSubscription } from '@/queries/dashboard/subscription'
import { useDashboardSystem } from '@/queries/dashboard/system'
import { useInboundRoutes } from '@/queries/routes/inbound'
import { useTrunks } from '@/queries/trunks/trunks'
import { useDashboardLayoutStore } from '@/stores/dashboardLayout'
import { useLoginStore } from '@/stores/login'
import type { Section } from '@/lib/permissions/permissions'
import { usePermissions } from '@/queries/permissions/me'
import { describeError } from '@/stores/notifications'

type CounterCard = {
  id: DashboardCounterId
  label: string
  icon: IconDefinition
  to: RouteLocationRaw
  section: Section
}

type LoadFailure = {
  part: string
  title: string
  error: unknown
  retry: () => void
  serverDetail?: boolean
}

const COUNTER_CARDS_BEFORE_CALLS: CounterCard[] = [
  {
    id: 'users',
    label: 'dashboard.counters.users',
    icon: faUserGroup,
    to: { name: 'users', params: { tab: 'users' } },
    section: 'users',
  },
  {
    id: 'groups',
    label: 'dashboard.counters.groups',
    icon: faUserGroup,
    to: { name: 'users', params: { tab: 'groups' } },
    section: 'users',
  },
  {
    id: 'physicalPhones',
    label: 'dashboard.counters.physical_phones',
    icon: faOfficePhone,
    to: { name: 'phones', params: { tab: 'phones' } },
    section: 'phones',
  },
]

const COUNTER_CARDS_AFTER_CALLS: CounterCard[] = [
  {
    id: 'trunks',
    label: 'dashboard.counters.trunks',
    icon: faNetworkWired,
    to: { name: 'trunks' },
    section: 'trunks',
  },
  {
    id: 'inboundRoutes',
    label: 'dashboard.counters.inbound_routes',
    icon: faRoute,
    to: { name: 'routes', params: { tab: 'inbound' } },
    section: 'routes',
  },
  {
    id: 'outboundRoutes',
    label: 'dashboard.counters.outbound_routes',
    icon: faRoute,
    to: { name: 'routes', params: { tab: 'outbound' } },
    section: 'routes',
  },
]

const PRESENCE_STYLES: Record<PresenceStatus, { color: string; dotClass: string }> = {
  online: {
    color: 'var(--accent-green)',
    dotClass: 'size-3 border-2 border-white bg-accent-green',
  },
  busy: { color: 'var(--accent-rose)', dotClass: 'size-3 border-2 border-white bg-accent-rose' },
  dnd: { color: 'var(--accent-blue)', dotClass: 'size-3 border-2 border-white bg-accent-blue' },
  offline: { color: 'var(--accent-gray)', dotClass: 'size-3 border-2 border-white bg-accent-gray' },
}

const DEVICE_STYLES: Record<DeviceType, { label: string; color: string; dotClass: string }> = {
  webPhone: {
    label: 'dashboard.devices.web_phone',
    color: 'var(--accent-indigo)',
    dotClass: 'size-4 bg-accent-indigo',
  },
  desktopPhone: {
    label: 'dashboard.devices.desktop_phone',
    color: 'var(--accent-rose)',
    dotClass: 'size-4 bg-accent-rose',
  },
  mobileApp: {
    label: 'dashboard.devices.mobile_app',
    color: 'var(--accent-amber)',
    dotClass: 'size-4 bg-accent-amber',
  },
}

const CALL_OUTCOME_STYLES: Record<CallOutcome, { color: string; dotClass: string }> = {
  total: { color: 'var(--accent-indigo)', dotClass: 'size-4 bg-accent-indigo' },
  answered: { color: 'var(--accent-green)', dotClass: 'size-4 bg-accent-green' },
  missed: { color: 'var(--accent-rose)', dotClass: 'size-4 bg-accent-rose' },
  invalid: { color: 'var(--accent-amber)', dotClass: 'size-4 bg-accent-amber' },
}

const { t, locale } = useI18n()
const loginStore = useLoginStore()
const { can } = usePermissions()
const {
  state: subscriptionState,
  refetch: refetchSubscription,
  refresh: refreshSubscription,
} = useDashboardSubscription()
const { state: systemState, refetch: refetchSystem, refresh: refreshSystem } = useDashboardSystem()
const { state: trunksState, refetch: refetchTrunks, refresh: refreshTrunks } = useTrunks()
const {
  state: inboundRoutesState,
  refetch: refetchInboundRoutes,
  refresh: refreshInboundRoutes,
} = useInboundRoutes()
const isEnterprise = computed(() => subscriptionState.value.data?.plan === 'enterprise')
const {
  state: callsState,
  refetch: refetchCalls,
  refresh: refreshCalls,
} = useDashboardCalls(() => isEnterprise.value)
const dashboardLayoutStore = useDashboardLayoutStore()
const {
  state: callsHistoryState,
  refetch: refetchCallsHistory,
  refresh: refreshCallsHistory,
} = useDashboardCallsHistory(
  () => dashboardLayoutStore.callsRange,
  () => isEnterprise.value,
)
const {
  state: phonesState,
  refetch: refetchPhones,
  refresh: refreshPhones,
} = useDashboardPhones(() => isEnterprise.value)
const liveExtensionsQuery = useDashboardLiveExtensions()
const liveTrunksQuery = useDashboardLiveTrunks()
const liveUsersQuery = useDashboardLiveUsers()
const liveQueries = [liveExtensionsQuery, liveTrunksQuery, liveUsersQuery]
const activeLiveQueries = computed(() =>
  isEnterprise.value ? liveQueries : [liveExtensionsQuery, liveTrunksQuery],
)
const liveDataAvailable = computed(
  () =>
    canReadCtiLiveData(loginStore.username) &&
    !liveQueries.some((query) => isCtiAccessDenied(query.state.value.error)),
)

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
  liveDataAvailable.value
    ? activeLiveQueries.value.filter((query) => query.state.value.status === 'error')
    : [],
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
    color: DEVICE_STYLES[deviceType].color,
    dotClass: DEVICE_STYLES[deviceType].dotClass,
  })),
)

const callOutcomeBars = computed<ChartBar[]>(() =>
  CALL_OUTCOMES.map((outcome) => ({
    id: outcome,
    label: t(`dashboard.calls_summary.${outcome}`),
    value: callsState.value.data?.[outcome] ?? 0,
    ...CALL_OUTCOME_STYLES[outcome],
  })),
)

const phoneStatusBars = computed<ChartBar[]>(() =>
  getPhoneStatusBars(phonesState.value.data, (status) => t(`dashboard.phone_status.${status}`)),
)

const CARD_TITLES: Record<DashboardCardId, string> = {
  presence: 'dashboard.presence.title',
  devices: 'dashboard.devices.title',
  phoneStatus: 'dashboard.phone_status.title',
  callsSummary: 'dashboard.calls_summary.title',
  calls: 'dashboard.calls.title',
  hourlyCalls: 'dashboard.hourly_calls.title',
  trunks: 'dashboard.trunks.title',
  inboundRoutes: 'dashboard.inbound_routes.title',
}

const CARD_SPANS: Record<DashboardCardId, string> = {
  presence: '',
  devices: '',
  phoneStatus: '',
  callsSummary: '',
  calls: 'md:col-span-2',
  hourlyCalls: 'md:col-span-2',
  trunks: '2xl:col-span-2',
  inboundRoutes: '2xl:col-span-2',
}

const cardGrid = useTemplateRef<HTMLUListElement>('cardGrid')

const showTrunks = computed(() => can('trunks') && liveDataAvailable.value)
const showInboundRoutes = computed(() => can('routes'))

const cardVisibility = computed<Record<DashboardCardId, boolean>>(() => ({
  presence: liveDataAvailable.value && (presenceLoading.value || presence.value !== null),
  devices: liveDataAvailable.value && (devicesLoading.value || devices.value !== null),
  phoneStatus: !phonesState.value.error || phonesState.value.data !== undefined,
  callsSummary: !callsState.value.error || callsState.value.data !== undefined,
  calls: liveDataAvailable.value && (callsLoading.value || liveCalls.value !== null),
  hourlyCalls: true,
  trunks: showTrunks.value && (!trunksState.value.error || trunksState.value.data !== undefined),
  inboundRoutes:
    showInboundRoutes.value &&
    (!inboundRoutesState.value.error || inboundRoutesState.value.data !== undefined),
}))

const visibleCards = computed(() =>
  dashboardLayoutStore.cardOrder.filter((card) => cardVisibility.value[card]),
)

const armedCard = ref<DashboardCardId | null>(null)
const draggedCard = ref<DashboardCardId | null>(null)
const dropTarget = ref<DashboardCardId | null>(null)
const moveAnnouncement = ref('')

const cardTitle = (card: DashboardCardId) => t(CARD_TITLES[card])

function announceMove(card: DashboardCardId) {
  moveAnnouncement.value = t('dashboard.card_moved', {
    card: cardTitle(card),
    position: visibleCards.value.indexOf(card) + 1,
    total: visibleCards.value.length,
  })
}

function resetDrag() {
  armedCard.value = null
  draggedCard.value = null
  dropTarget.value = null
}

function onDragStart(event: DragEvent, card: DashboardCardId) {
  if (armedCard.value !== card) {
    event.preventDefault()
    return
  }
  draggedCard.value = card

  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', card)
  }
}

function onDragOver(event: DragEvent, card: DashboardCardId) {
  if (draggedCard.value === null) {
    return
  }
  event.preventDefault()
  dropTarget.value = card
}

function onDragLeave(event: DragEvent, card: DashboardCardId) {
  const target = event.currentTarget
  const related = event.relatedTarget

  if (target instanceof HTMLElement && related instanceof Node && target.contains(related)) {
    return
  }
  if (dropTarget.value === card) {
    dropTarget.value = null
  }
}

function onDrop(event: DragEvent, card: DashboardCardId) {
  event.preventDefault()
  const dragged = draggedCard.value

  if (dragged !== null && dragged !== card) {
    dashboardLayoutStore.setCardOrder(moveCardTo(dashboardLayoutStore.cardOrder, dragged, card))
    announceMove(dragged)
  }
  resetDrag()
}

function readCardRects(): CardRect[] {
  return visibleCards.value.flatMap((card) => {
    const element = cardGrid.value?.querySelector<HTMLElement>(`[data-card="${card}"]`)

    if (!element) {
      return []
    }
    const { top, left, width } = element.getBoundingClientRect()

    return [{ card, top, left, width }]
  })
}

function getKeyboardMove(card: DashboardCardId, direction: CardMoveDirection) {
  const order = dashboardLayoutStore.cardOrder

  if (direction === 'previous' || direction === 'next') {
    return moveCardBy(order, visibleCards.value, card, direction === 'previous' ? -1 : 1)
  }
  const target = findCardInAdjacentRow(readCardRects(), card, direction)

  return target ? moveCardTo(order, card, target) : order
}

async function moveWithKeyboard(card: DashboardCardId, direction: CardMoveDirection) {
  const order = dashboardLayoutStore.cardOrder
  const next = getKeyboardMove(card, direction)

  if (next === order) {
    return
  }
  dashboardLayoutStore.setCardOrder(next)
  announceMove(card)
  await nextTick()
  cardGrid.value
    ?.querySelector<HTMLElement>(`[data-card="${card}"] [data-testid="drag-handle"]`)
    ?.focus()
}

useEventListener(window, 'pointerup', () => {
  if (draggedCard.value === null) {
    armedCard.value = null
  }
})

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

const loadFailures = computed(() => {
  const failures: LoadFailure[] = []

  if (subscriptionState.value.error || systemState.value.error) {
    failures.push({
      part: 'dashboard.load_error.system',
      title: 'dashboard.cannot_load_system',
      error: subscriptionState.value.error ?? systemState.value.error,
      retry: () => {
        if (subscriptionState.value.error) {
          refetchSubscription()
        }
        if (systemState.value.error) {
          refetchSystem()
        }
      },
    })
  }
  if (failedCounters.value.length) {
    failures.push({
      part: 'dashboard.load_error.counters',
      title: 'dashboard.cannot_load_counters',
      error: failedCounters.value[0].state.value.error,
      retry: () => failedCounters.value.forEach((query) => query.refetch()),
    })
  }
  if (isEnterprise.value && callsState.value.error) {
    failures.push({
      part: 'dashboard.load_error.calls',
      title: 'dashboard.cannot_load_calls',
      error: callsState.value.error,
      retry: () => refetchCalls(),
    })
  }
  if (isEnterprise.value && callsHistoryState.value.error) {
    failures.push({
      part: 'dashboard.load_error.calls_per_hour',
      title: 'dashboard.cannot_load_calls_per_hour',
      error: callsHistoryState.value.error,
      retry: () => refetchCallsHistory(),
      serverDetail: false,
    })
  }
  if (isEnterprise.value && phonesState.value.error) {
    failures.push({
      part: 'dashboard.load_error.phones',
      title: 'dashboard.cannot_load_phones',
      error: phonesState.value.error,
      retry: () => refetchPhones(),
    })
  }
  if (failedLiveQueries.value.length) {
    failures.push({
      part: 'dashboard.load_error.live_data',
      title: 'dashboard.cannot_load_live_data',
      error: failedLiveQueries.value[0].state.value.error,
      retry: () => failedLiveQueries.value.forEach((query) => query.refetch()),
    })
  }
  if (isEnterprise.value && showTrunks.value && trunksState.value.error) {
    failures.push({
      part: 'dashboard.load_error.trunks',
      title: 'dashboard.cannot_load_trunks',
      error: trunksState.value.error,
      retry: () => refetchTrunks(),
    })
  }
  if (isEnterprise.value && showInboundRoutes.value && inboundRoutesState.value.error) {
    failures.push({
      part: 'dashboard.load_error.inbound_routes',
      title: 'dashboard.cannot_load_inbound_routes',
      error: inboundRoutesState.value.error,
      retry: () => refetchInboundRoutes(),
    })
  }
  return failures
})

const loadErrorTitle = computed(() =>
  loadFailures.value.length === 1
    ? t(loadFailures.value[0].title)
    : t('dashboard.load_error.title'),
)

const loadErrorDescription = computed(() => {
  const reasons = [
    ...new Set(
      loadFailures.value.map((failure) =>
        describeError(failure.error, { serverDetail: failure.serverDetail ?? true }),
      ),
    ),
  ]

  if (loadFailures.value.length === 1) {
    return reasons[0]
  }
  const parts = new Intl.ListFormat(locale.value, { type: 'conjunction' }).format(
    loadFailures.value.map((failure) => t(failure.part)),
  )
  const unavailable = t('dashboard.load_error.unavailable', { parts })

  return reasons.length === 1 && reasons[0] ? `${unavailable} ${reasons[0]}` : unavailable
})

function retryFailedSources() {
  loadFailures.value.forEach((failure) => failure.retry())
}

usePolling(() => {
  if (loginStore.isAuthenticated && liveDataAvailable.value) {
    activeLiveQueries.value
      .filter((query) => query.asyncStatus.value === 'idle')
      .forEach((query) => query.refetch())
  }
}, DASHBOARD_LIVE_REFRESH_INTERVAL)

usePolling(() => {
  if (loginStore.isAuthenticated) {
    counterQueries.forEach((query) => query.refresh())
    refreshSubscription()
    refreshSystem()
    if (isEnterprise.value) {
      refreshCalls()
      refreshCallsHistory()
      refreshPhones()
      if (showTrunks.value) {
        refreshTrunks()
      }
      if (showInboundRoutes.value) {
        refreshInboundRoutes()
      }
    }
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
      <NeInlineNotification
        v-if="loadFailures.length"
        kind="error"
        data-testid="dashboard-load-error"
        :title="loadErrorTitle"
        :description="loadErrorDescription"
        :primary-button-label="$t('common.retry')"
        @primary-click="retryFailedSources"
      />
      <NeInlineNotification
        v-if="!liveDataAvailable"
        kind="info"
        data-testid="dashboard-live-unavailable"
        :title="$t('dashboard.live_unavailable.title')"
        :description="$t('dashboard.live_unavailable.description')"
      />
      <div class="grid grid-cols-1 gap-6 md:grid-cols-2 2xl:grid-cols-4">
        <DashboardSystemCard
          class="md:row-span-3"
          :subscription="subscriptionState.data"
          :loading="subscriptionState.status === 'pending'"
          :system="systemState.data"
          :system-loading="systemState.status === 'pending'"
        />
        <DashboardCounterCard
          v-for="counter in countersBeforeCalls"
          :key="counter.id"
          :counter-id="counter.id"
          :title="$t(counter.label)"
          :icon="counter.icon"
          :counter="counter.state.value.data"
          :loading="counter.state.value.status === 'pending'"
          :to="can(counter.section) ? counter.to : undefined"
        />
        <DashboardCounterCard
          v-if="liveDataAvailable"
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
          :to="can(counter.section) ? counter.to : undefined"
        />
      </div>
      <p v-if="isEnterprise" class="sr-only" aria-live="polite" data-testid="card-move-status">
        {{ moveAnnouncement }}
      </p>
      <ul
        v-if="isEnterprise"
        ref="cardGrid"
        class="grid grid-cols-1 gap-6 md:grid-cols-2 2xl:grid-cols-4"
        data-testid="dashboard-cards"
      >
        <li
          v-for="card in visibleCards"
          :key="card"
          :data-card="card"
          :draggable="armedCard === card"
          :class="[
            'rounded-lg',
            CARD_SPANS[card],
            dropTarget === card && draggedCard !== card
              ? 'bg-emerald-100 dark:bg-emerald-700 [&>*]:invisible'
              : '',
            draggedCard ? '[&_*]:pointer-events-none' : '',
          ]"
          @dragstart="onDragStart($event, card)"
          @dragover="onDragOver($event, card)"
          @dragleave="onDragLeave($event, card)"
          @drop="onDrop($event, card)"
          @dragend="resetDrag"
        >
          <DashboardBreakdownCard
            v-if="card === 'presence'"
            class="h-full"
            data-testid="presence-card"
            :title="$t('dashboard.presence.title')"
            :bars="presenceBars"
            orientation="vertical"
            :loading="presenceLoading"
          >
            <template #handle>
              <DashboardDragHandle
                :card="cardTitle(card)"
                @arm="armedCard = card"
                @move="moveWithKeyboard(card, $event)"
              />
            </template>
          </DashboardBreakdownCard>
          <DashboardBreakdownCard
            v-else-if="card === 'devices'"
            class="h-full"
            data-testid="devices-card"
            :title="$t('dashboard.devices.title')"
            :empty-text="$t('dashboard.devices.no_devices')"
            :bars="deviceBars"
            orientation="horizontal"
            :loading="devicesLoading"
          >
            <template #handle>
              <DashboardDragHandle
                :card="cardTitle(card)"
                @arm="armedCard = card"
                @move="moveWithKeyboard(card, $event)"
              />
            </template>
          </DashboardBreakdownCard>
          <DashboardBreakdownCard
            v-else-if="card === 'phoneStatus'"
            class="h-full"
            data-testid="phone-status-card"
            :title="$t('dashboard.phone_status.title')"
            :empty-text="$t('dashboard.phone_status.no_phones')"
            :bars="phoneStatusBars"
            orientation="vertical"
            :loading="phonesState.status === 'pending'"
          >
            <template #handle>
              <DashboardDragHandle
                :card="cardTitle(card)"
                @arm="armedCard = card"
                @move="moveWithKeyboard(card, $event)"
              />
            </template>
          </DashboardBreakdownCard>
          <DashboardBreakdownCard
            v-else-if="card === 'callsSummary'"
            class="h-full"
            data-testid="calls-summary-card"
            :title="$t('dashboard.calls_summary.title')"
            :empty-text="$t('dashboard.calls_summary.no_calls')"
            :bars="callOutcomeBars"
            orientation="horizontal"
            :loading="callsState.status === 'pending'"
          >
            <template #handle>
              <DashboardDragHandle
                :card="cardTitle(card)"
                @arm="armedCard = card"
                @move="moveWithKeyboard(card, $event)"
              />
            </template>
          </DashboardBreakdownCard>
          <DashboardHourlyCard
            v-else-if="card === 'hourlyCalls'"
            class="h-full"
            :range="dashboardLayoutStore.callsRange"
            :history="callsHistoryState.data"
            :loading="callsHistoryState.status === 'pending'"
            @update:range="dashboardLayoutStore.setCallsRange"
          >
            <template #handle>
              <DashboardDragHandle
                :card="cardTitle(card)"
                @arm="armedCard = card"
                @move="moveWithKeyboard(card, $event)"
              />
            </template>
          </DashboardHourlyCard>
          <DashboardCallsCard
            v-else-if="card === 'calls'"
            class="h-full"
            :calls="liveCalls?.calls ?? []"
            :fetched-at="liveCalls?.fetchedAt ?? 0"
            :loading="callsLoading"
          >
            <template #handle>
              <DashboardDragHandle
                :card="cardTitle(card)"
                @arm="armedCard = card"
                @move="moveWithKeyboard(card, $event)"
              />
            </template>
          </DashboardCallsCard>
          <DashboardListCard
            v-else-if="card === 'trunks'"
            class="h-full"
            data-testid="trunks-card"
            :title="$t('dashboard.trunks.title')"
            :items="trunkRows"
            :label-header="$t('common.name')"
            :value-header="$t('common.status')"
            :empty-title="$t('dashboard.trunks.no_trunks')"
            :empty-icon="faNetworkWired"
            :loading="trunksState.status === 'pending'"
          >
            <template #handle>
              <DashboardDragHandle
                :card="cardTitle(card)"
                @arm="armedCard = card"
                @move="moveWithKeyboard(card, $event)"
              />
            </template>
            <template #value="{ item }">
              <TrunkStatusIndicator class="whitespace-nowrap" :status="item.status" />
            </template>
          </DashboardListCard>
          <DashboardListCard
            v-else
            class="h-full"
            data-testid="inbound-routes-card"
            :title="$t('dashboard.inbound_routes.title')"
            :items="inboundRouteRows"
            :label-header="$t('routes.route')"
            :value-header="$t('routes.destination')"
            :empty-title="$t('dashboard.inbound_routes.no_routes')"
            :empty-icon="faRoute"
            :loading="inboundRoutesState.status === 'pending'"
          >
            <template #handle>
              <DashboardDragHandle
                :card="cardTitle(card)"
                @arm="armedCard = card"
                @move="moveWithKeyboard(card, $event)"
              />
            </template>
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
        </li>
      </ul>
    </div>
  </div>
</template>
