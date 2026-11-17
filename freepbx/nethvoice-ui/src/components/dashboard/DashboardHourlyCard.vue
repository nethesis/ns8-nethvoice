<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { NeCard, NeSkeleton } from '@nethesis/vue-components'
import { VisArea, VisCrosshair, VisTooltip, VisXYContainer } from '@unovis/vue'
import { CurveType } from '@unovis/ts'

const CHART_HEIGHT = 304
const AREA_OPACITY = 0.6

type Datum = { hour: number; calls: number }

const { hourlyCalls, loading = false } = defineProps<{
  hourlyCalls: number[]
  loading?: boolean
}>()

const { t } = useI18n()

const data = computed<Datum[]>(() => hourlyCalls.map((calls, hour) => ({ hour, calls })))

const totalCalls = computed(() => hourlyCalls.reduce((sum, calls) => sum + calls, 0))

const peak = computed(() =>
  data.value.reduce<Datum | null>(
    (best, datum) => (datum.calls > (best?.calls ?? 0) ? datum : best),
    null,
  ),
)

const formatHour = (hour: number) => `${String(hour).padStart(2, '0')}:00`

const summary = computed(() =>
  peak.value
    ? t('dashboard.hourly_calls.summary', {
        total: totalCalls.value,
        hour: formatHour(peak.value.hour),
        calls: peak.value.calls,
      })
    : t('dashboard.hourly_calls.no_calls'),
)

const xDomain = computed<[number, number]>(() => [0, Math.max(1, hourlyCalls.length - 1)])

const yDomain = computed<[number, number]>(() => [0, Math.max(1, peak.value?.calls ?? 0)])

const getHour = (datum: Datum) => datum.hour
const getCalls = (datum: Datum) => datum.calls

const describeHour = (datum: Datum) =>
  t('dashboard.hourly_calls.hour_value', { hour: formatHour(datum.hour), calls: datum.calls })
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
    <NeSkeleton v-if="loading" :lines="10" class="w-full" />
    <p
      v-else-if="totalCalls === 0"
      class="text-tertiary-neutral py-6 text-center text-sm"
      data-testid="hourly-calls-empty"
    >
      {{ $t('dashboard.hourly_calls.no_calls') }}
    </p>
    <div v-else class="flex flex-col gap-6">
      <div
        role="img"
        :aria-label="summary"
        class="dashboard-hourly-chart w-full"
        data-testid="hourly-chart"
      >
        <VisXYContainer
          :data="data"
          :height="CHART_HEIGHT"
          :x-domain="xDomain"
          :y-domain="yDomain"
          :auto-margin="false"
          aria-hidden="true"
        >
          <VisArea
            :x="getHour"
            :y="getCalls"
            color="var(--accent-indigo)"
            :opacity="AREA_OPACITY"
            :curve-type="CurveType.MonotoneX"
          />
          <VisCrosshair :template="describeHour" color="var(--accent-indigo)" />
          <VisTooltip />
        </VisXYContainer>
      </div>
      <p class="text-primary-neutral flex items-center justify-center gap-2.5 py-3 font-medium">
        <span class="bg-accent-indigo/60 h-4 w-6 shrink-0 rounded-sm" aria-hidden="true" />
        {{ $t('dashboard.hourly_calls.legend') }}
      </p>
    </div>
  </NeCard>
</template>

<style scoped>
.dashboard-hourly-chart {
  --vis-font-family: inherit;
  --vis-tooltip-background-color: var(--elevation-0);
  --vis-tooltip-border-color: var(--border-secondary);
  --vis-tooltip-text-color: var(--primary-neutral);
  --vis-crosshair-line-stroke-color: var(--border-secondary);
  --vis-crosshair-circle-stroke-color: var(--elevation-0);
}
</style>
