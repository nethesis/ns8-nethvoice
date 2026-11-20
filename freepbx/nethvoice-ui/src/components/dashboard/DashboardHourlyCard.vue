<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed, useTemplateRef } from 'vue'
import { useElementSize } from '@vueuse/core'
import { useI18n } from 'vue-i18n'
import {
  NeBadgeV2,
  NeCard,
  NeDropdownFilterV2,
  NeEmptyState,
  NeSkeleton,
  type NeDropdownFilterV2Option,
} from '@nethesis/vue-components'
import { faChevronDown, faPhoneSlash } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { faEmptySet } from '@nethesis/nethesis-solid-svg-icons'
import { VisArea, VisAxis, VisCrosshair, VisTooltip, VisXYContainer } from '@unovis/vue'
import { CurveType } from '@unovis/ts'
import {
  CALLS_RANGES,
  isCallsRange,
  isHistoryPartial,
  type CallsHistory,
  type CallsPoint,
  type CallsRange,
} from '@/lib/dashboard/calls'
import {
  formatCallCount,
  formatDateTime,
  formatPointTime,
  formatTimeTick,
  getIntegerTicks,
  getMaxTicks,
  getTimeTicks,
  splitIntoSegments,
  summarizeSeries,
} from '@/lib/dashboard/chart'

const CHART_HEIGHT = 304
const AREA_OPACITY = 0.6

const RANGE_LABELS: Record<CallsRange, string> = {
  '24h': 'dashboard.hourly_calls.range.last_24_hours',
  '7d': 'dashboard.hourly_calls.range.last_7_days',
  '15d': 'dashboard.hourly_calls.range.last_15_days',
}

const { history, loading = false } = defineProps<{
  history?: CallsHistory
  loading?: boolean
}>()

const range = defineModel<CallsRange>('range', { required: true })

const { t, locale } = useI18n()

const rangeOptions = computed<NeDropdownFilterV2Option[]>(() =>
  CALLS_RANGES.map((id) => ({ id, label: t(RANGE_LABELS[id]) })),
)

const selectedRange = computed<NeDropdownFilterV2Option[]>({
  get: () => rangeOptions.value.filter((option) => option.id === range.value),
  set: (selection) => {
    const id = selection[0]?.id

    if (isCallsRange(id)) {
      range.value = id
    }
  },
})

const selectedRangeLabel = computed(() => t(RANGE_LABELS[range.value]))

const filterLabels = computed(() => ({
  clearFilterLabel: t('ne_dropdown_filter.reset_selection'),
  openMenuAriaLabel: t('ne_dropdown_filter.open_filter'),
  noOptionsLabel: t('ne_dropdown_filter.no_options'),
  moreOptionsHiddenLabel: t('ne_dropdown_filter.more_options_hidden'),
  clearSearchLabel: t('ne_dropdown_filter.clear_search'),
}))

const series = computed<CallsPoint[]>(() => history?.series ?? [])

const segments = computed(() => splitIntoSegments(series.value))

const summary = computed(() => summarizeSeries(series.value))

const availableFrom = computed(() =>
  history && history.historyStart !== null && isHistoryPartial(history)
    ? formatDateTime(history.historyStart, locale.value)
    : '',
)

const chartElement = useTemplateRef<HTMLElement>('chart')
const { width: chartWidth } = useElementSize(chartElement)

const xDomain = computed<[number, number]>(() => [
  series.value[0]?.time ?? 0,
  series.value.at(-1)?.time ?? 1,
])

const xTicks = computed(() =>
  getTimeTicks(
    series.value.map((point) => point.time),
    range.value,
    getMaxTicks(chartWidth.value),
  ),
)

const yTicks = computed(() => getIntegerTicks(summary.value.peak?.calls ?? 0))

const yDomain = computed<[number, number]>(() => [0, yTicks.value.at(-1) ?? 1])

const formatTick = (time: number | Date) => formatTimeTick(Number(time), range.value, locale.value)

const formatAxisCalls = (calls: number | Date) =>
  new Intl.NumberFormat(locale.value).format(Number(calls))

const summaryText = computed(() => {
  const { total, peak } = summary.value

  return peak
    ? t('dashboard.hourly_calls.summary', {
        period: selectedRangeLabel.value,
        total: formatCallCount(total, locale.value),
        time: formatPointTime(peak.time, locale.value),
        calls: formatCallCount(peak.calls, locale.value),
      })
    : t('dashboard.hourly_calls.no_calls')
})

const getTime = (point: CallsPoint) => point.time
const getCalls = (point: CallsPoint) => point.calls

const describePoint = (point: CallsPoint) => {
  const value =
    point.calls === null
      ? t('dashboard.hourly_calls.tooltip_no_data')
      : t('dashboard.hourly_calls.tooltip_calls', {
          calls: formatCallCount(point.calls, locale.value),
        })

  return `<div class="text-secondary-neutral">${formatPointTime(point.time, locale.value)}</div><div class="font-medium">${value}</div>`
}
</script>

<template>
  <NeCard data-testid="hourly-calls-card">
    <template #title>
      <span class="flex items-center gap-2">
        <slot name="handle" />
        <span class="text-secondary-neutral text-sm font-normal">
          {{ $t('dashboard.hourly_calls.title') }}
        </span>
      </span>
    </template>
    <template #topRight>
      <NeDropdownFilterV2
        v-model="selectedRange"
        kind="radio"
        size="sm"
        :label="$t('dashboard.hourly_calls.period')"
        :options="rangeOptions"
        :show-clear-filter="false"
        align-to-right
        v-bind="filterLabels"
        class="*:focus-visible:outline-hidden"
        data-testid="hourly-calls-range"
      >
        <template #button>
          <span
            class="in-focus-visible:ring-primary-500 dark:in-focus-visible:ring-primary-300 dark:in-focus-visible:ring-offset-primary-950 flex items-center rounded px-2 py-1 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-gray-300 transition-colors duration-200 hover:bg-gray-200/70 hover:text-gray-800 in-focus-visible:ring-2 in-focus-visible:ring-offset-2 in-focus-visible:ring-offset-white dark:text-gray-100 dark:ring-gray-500 dark:hover:bg-gray-600/30 dark:hover:text-gray-50"
          >
            {{ $t('dashboard.hourly_calls.period') }}
            <NeBadgeV2 size="xs" kind="indigo" class="ml-2">{{ selectedRangeLabel }}</NeBadgeV2>
            <FontAwesomeIcon :icon="faChevronDown" class="ml-2 h-3 w-3" aria-hidden="true" />
          </span>
        </template>
      </NeDropdownFilterV2>
    </template>
    <div class="flex flex-col gap-4">
      <p
        v-if="!loading && availableFrom"
        class="text-tertiary-neutral text-sm"
        data-testid="hourly-calls-available-from"
      >
        {{ $t('dashboard.hourly_calls.available_from', { time: availableFrom }) }}
      </p>
      <NeSkeleton v-if="loading" :lines="10" class="w-full" />
      <p
        v-else-if="!history"
        class="text-tertiary-neutral py-6 text-center text-sm"
        data-testid="hourly-calls-unavailable"
      >
        {{ $t('dashboard.not_available') }}
      </p>
      <NeEmptyState
        v-else-if="history.historyStart === null"
        data-testid="hourly-calls-no-data"
        :title="$t('dashboard.hourly_calls.no_data')"
        :description="$t('dashboard.hourly_calls.no_data_description')"
        :icon="faEmptySet"
      />
      <NeEmptyState
        v-else-if="summary.total === 0"
        data-testid="hourly-calls-empty"
        :title="$t('dashboard.hourly_calls.no_calls')"
        :icon="faPhoneSlash"
      />
      <div v-else class="flex flex-col gap-6">
        <div
          ref="chart"
          role="img"
          :aria-label="summaryText"
          class="dashboard-hourly-chart w-full"
          data-testid="hourly-chart"
        >
          <VisXYContainer
            :height="CHART_HEIGHT"
            :x-domain="xDomain"
            :y-domain="yDomain"
            aria-hidden="true"
          >
            <VisArea
              v-for="segment in segments"
              :key="segment[0].time"
              :data="segment"
              :x="getTime"
              :y="getCalls"
              color="var(--accent-indigo)"
              :opacity="AREA_OPACITY"
              :curve-type="CurveType.MonotoneX"
            />
            <VisAxis
              type="x"
              :tick-values="xTicks"
              :tick-format="formatTick"
              :grid-line="false"
              :tick-line="false"
            />
            <VisAxis
              type="y"
              :tick-values="yTicks"
              :tick-format="formatAxisCalls"
              :domain-line="false"
              :tick-line="false"
            />
            <VisCrosshair
              :data="series"
              :x="getTime"
              :y="getCalls"
              :template="describePoint"
              color="var(--accent-indigo)"
            />
            <VisTooltip />
          </VisXYContainer>
        </div>
        <p class="text-primary-neutral flex items-center justify-center gap-2.5 py-3 font-medium">
          <span class="bg-accent-indigo/60 h-4 w-6 shrink-0 rounded-sm" aria-hidden="true" />
          {{ $t('dashboard.hourly_calls.legend') }}
        </p>
      </div>
    </div>
  </NeCard>
</template>

<style scoped>
.dashboard-hourly-chart {
  --vis-font-family: inherit;
  --vis-axis-font-family: inherit;
  --vis-axis-tick-label-color: var(--tertiary-neutral);
  --vis-axis-tick-label-font-size: var(--text-xs);
  --vis-axis-tick-label-weight: 400;
  --vis-axis-grid-color: var(--border-secondary);
  --vis-axis-domain-color: var(--border-secondary);
  --vis-tooltip-background-color: var(--elevation-0);
  --vis-tooltip-border-color: var(--border-secondary);
  --vis-tooltip-text-color: var(--primary-neutral);
  --vis-crosshair-line-stroke-color: var(--border-secondary);
  --vis-crosshair-circle-stroke-color: var(--elevation-0);
}
</style>
