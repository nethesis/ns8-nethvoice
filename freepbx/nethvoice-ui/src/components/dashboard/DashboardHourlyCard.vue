<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed, ref, useId, useTemplateRef, watch } from 'vue'
import { useElementSize, useEventListener } from '@vueuse/core'
import { useI18n } from 'vue-i18n'
import { NeButton, NeCard, NeEmptyState, NeSkeleton } from '@nethesis/vue-components'
import { faPhoneSlash } from '@fortawesome/free-solid-svg-icons'
import { faEmptySet } from '@nethesis/nethesis-solid-svg-icons'
import {
  VisArea,
  VisAxis,
  VisCrosshair,
  VisPlotband,
  VisTooltip,
  VisXYContainer,
} from '@unovis/vue'
import { AxisType, CurveType, type XYContainer } from '@unovis/ts'
import { isHistoryPartial, type CallsHistory, type CallsPoint } from '@/lib/dashboard/calls'
import {
  formatCallCount,
  formatDateTime,
  formatPeriod,
  formatPointTime,
  formatTimeTick,
  getIntegerTicks,
  getMaxTicks,
  getTimeTicks,
  getVisiblePoints,
  getZoomDomain,
  keepZoom,
  MIN_DRAG_DISTANCE,
  panZoom,
  scaleZoom,
  splitIntoSegments,
  summarizeSeries,
  type TimeDomain,
} from '@/lib/dashboard/chart'

const CHART_HEIGHT = 304
const AREA_OPACITY = 0.6
const ZOOM_IN_FACTOR = 0.5
const ZOOM_OUT_FACTOR = 2
const PAN_RATIO = 0.25

type Drag = { pointerId: number; startX: number; from: number; to: number; moved: boolean }

const { history, loading = false } = defineProps<{
  history?: CallsHistory
  loading?: boolean
}>()

const { t, locale } = useI18n()

const hintId = useId()

const series = computed<CallsPoint[]>(() => history?.series ?? [])

const dataDomain = computed<TimeDomain>(() => [
  series.value[0]?.time ?? 0,
  series.value.at(-1)?.time ?? 1,
])

const zoom = ref<TimeDomain | null>(null)

watch(dataDomain, (data) => {
  zoom.value = keepZoom(zoom.value, data)
})

const visibleDomain = computed(() => zoom.value ?? dataDomain.value)

const visibleSeries = computed(() => getVisiblePoints(series.value, visibleDomain.value))

const segments = computed(() => splitIntoSegments(visibleSeries.value))

const total = computed(() => summarizeSeries(series.value).total)

const summary = computed(() => summarizeSeries(visibleSeries.value))

const period = computed(() => formatPeriod(visibleDomain.value, locale.value))

const availableFrom = computed(() =>
  history && history.historyStart !== null && isHistoryPartial(history)
    ? formatDateTime(history.historyStart, locale.value)
    : '',
)

const chartElement = useTemplateRef<HTMLElement>('chart')
const container = useTemplateRef<{ component?: XYContainer<CallsPoint> }>('container')
const { width: chartWidth } = useElementSize(chartElement)

const xTicks = computed(() =>
  getTimeTicks(
    visibleSeries.value.map((point) => point.time),
    getMaxTicks(chartWidth.value),
  ),
)

const yTicks = computed(() => getIntegerTicks(summary.value.peak?.calls ?? 0))

const yDomain = computed<[number, number]>(() => [0, yTicks.value.at(-1) ?? 1])

const formatTick = (time: number | Date) => formatTimeTick(Number(time), locale.value)

const formatAxisCalls = (calls: number | Date) =>
  new Intl.NumberFormat(locale.value).format(Number(calls))

const summaryText = computed(() => {
  const { total, peak } = summary.value

  return peak
    ? t('dashboard.hourly_calls.summary', {
        period: period.value,
        total: formatCallCount(total, locale.value),
        time: formatPointTime(peak.time, locale.value),
        calls: formatCallCount(peak.calls, locale.value),
      })
    : t('dashboard.hourly_calls.no_calls')
})

const announcement = ref('')

watch(zoom, () => {
  announcement.value = summaryText.value
})

const drag = ref<Drag | null>(null)

const selection = computed(() =>
  drag.value?.moved
    ? {
        from: Math.min(drag.value.from, drag.value.to),
        to: Math.max(drag.value.from, drag.value.to),
      }
    : null,
)

const timeAt = (clientX: number, clamp: boolean): number | null => {
  const plot = container.value?.component?.components[0]
  const matrix = plot?.g.node()?.getScreenCTM()

  if (!plot || !matrix) {
    return null
  }
  const [left, right] = plot.xScale.range()
  const x = (clientX - matrix.e) / matrix.a

  if (!clamp && (x < left || x > right)) {
    return null
  }
  return Number(plot.xScale.invert(Math.min(Math.max(x, left), right)))
}

function onPointerDown(event: PointerEvent) {
  const time = event.button === 0 ? timeAt(event.clientX, false) : null

  if (time !== null) {
    drag.value = {
      pointerId: event.pointerId,
      startX: event.clientX,
      from: time,
      to: time,
      moved: false,
    }
  }
}

function onPointerMove(event: PointerEvent) {
  if (drag.value?.pointerId !== event.pointerId) {
    return
  }
  drag.value.to = timeAt(event.clientX, true) ?? drag.value.to
  drag.value.moved ||= Math.abs(event.clientX - drag.value.startX) >= MIN_DRAG_DISTANCE
}

function onPointerUp(event: PointerEvent) {
  if (drag.value?.pointerId !== event.pointerId) {
    return
  }
  if (selection.value) {
    zoom.value = getZoomDomain(selection.value.from, selection.value.to, dataDomain.value)
  }
  drag.value = null
}

function cancelDrag(event: PointerEvent) {
  if (drag.value?.pointerId === event.pointerId) {
    drag.value = null
  }
}

useEventListener(window, 'pointermove', onPointerMove)
useEventListener(window, 'pointerup', onPointerUp)
useEventListener(window, 'pointercancel', cancelDrag)

function resetZoom() {
  zoom.value = null
}

function resetZoomFromButton() {
  resetZoom()
  chartElement.value?.focus()
}

const KEY_ZOOMS: Record<string, (domain: TimeDomain) => TimeDomain | null | undefined> = {
  '+': (domain) => scaleZoom(domain, ZOOM_IN_FACTOR, dataDomain.value),
  '=': (domain) => scaleZoom(domain, ZOOM_IN_FACTOR, dataDomain.value),
  '-': (domain) => scaleZoom(domain, ZOOM_OUT_FACTOR, dataDomain.value),
  _: (domain) => scaleZoom(domain, ZOOM_OUT_FACTOR, dataDomain.value),
  ArrowLeft: (domain) => (zoom.value ? panZoom(domain, -PAN_RATIO, dataDomain.value) : undefined),
  ArrowRight: (domain) => (zoom.value ? panZoom(domain, PAN_RATIO, dataDomain.value) : undefined),
  Escape: () => (zoom.value && !drag.value ? null : undefined),
}

function onKeydown(event: KeyboardEvent) {
  const next =
    event.ctrlKey || event.metaKey || event.altKey
      ? undefined
      : KEY_ZOOMS[event.key]?.(visibleDomain.value)

  if (event.key === 'Escape' && drag.value) {
    event.preventDefault()
    drag.value = null
  } else if (next !== undefined) {
    event.preventDefault()
    zoom.value = next
  }
}

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
      <div v-if="zoom" class="flex flex-wrap items-center justify-end gap-x-4 gap-y-1">
        <span class="text-secondary-neutral text-sm" data-testid="hourly-calls-period">
          {{ period }}
        </span>
        <NeButton
          kind="tertiary"
          size="sm"
          data-testid="hourly-calls-reset-zoom"
          @click="resetZoomFromButton"
        >
          {{ $t('dashboard.hourly_calls.reset_zoom') }}
        </NeButton>
      </div>
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
        v-else-if="total === 0"
        data-testid="hourly-calls-empty"
        :title="$t('dashboard.hourly_calls.no_calls')"
        :icon="faPhoneSlash"
      />
      <div v-else class="flex flex-col gap-6">
        <div class="flex flex-col gap-2">
          <div
            ref="chart"
            role="img"
            tabindex="0"
            :aria-label="summaryText"
            :aria-describedby="hintId"
            class="dashboard-hourly-chart peer focus-visible:ring-primary-500 dark:focus-visible:ring-primary-300 dark:focus-visible:ring-offset-primary-950 w-full cursor-crosshair touch-pan-y touch-pinch-zoom rounded-sm select-none focus:outline-hidden focus-visible:ring-2 focus-visible:ring-offset-2"
            data-testid="hourly-chart"
            @pointerdown="onPointerDown"
            @dblclick="resetZoom"
            @keydown="onKeydown"
          >
            <VisXYContainer
              ref="container"
              :height="CHART_HEIGHT"
              :x-domain="visibleDomain"
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
                :data="visibleSeries"
                :x="getTime"
                :y="getCalls"
                :template="describePoint"
                color="var(--accent-indigo)"
              />
              <VisTooltip />
              <VisPlotband
                v-if="selection"
                :axis="AxisType.X"
                :from="selection.from"
                :to="selection.to"
                :duration="0"
              />
            </VisXYContainer>
          </div>
          <p
            :id="hintId"
            class="text-tertiary-neutral sr-only text-sm peer-focus-visible:not-sr-only"
            data-testid="hourly-chart-hint"
          >
            {{ $t('dashboard.hourly_calls.zoom_hint') }}
          </p>
          <p class="sr-only" aria-live="polite" data-testid="hourly-chart-announcement">
            {{ announcement }}
          </p>
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
  --vis-plotband-color: color-mix(in oklab, var(--accent-indigo) 20%, transparent);
}
</style>
