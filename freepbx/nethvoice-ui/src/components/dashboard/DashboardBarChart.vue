<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed, useTemplateRef } from 'vue'
import { useElementSize } from '@vueuse/core'
import { useI18n } from 'vue-i18n'
import { VisStackedBar, VisTooltip, VisXYContainer } from '@unovis/vue'
import { Orientation, StackedBar } from '@unovis/ts'
import {
  getBarRatios,
  getCenteredBarDomain,
  type ChartBar,
  type ChartOrientation,
} from '@/lib/dashboard/chart'

const CHART_HEIGHT = 148
const VERTICAL_MAX_BAR_WIDTH = 49
const VERTICAL_MAX_BAR_HEIGHT = 116
const HORIZONTAL_BAR_THICKNESS = 16
const BAR_GAP = 12
const BAR_RADIUS = 4

type Datum = { position: number; ratio: number; bar: ChartBar }

const {
  bars,
  orientation,
  outlined = false,
} = defineProps<{
  bars: ChartBar[]
  orientation: ChartOrientation
  outlined?: boolean
}>()

const { t } = useI18n()
const container = useTemplateRef<HTMLDivElement>('container')
const { width } = useElementSize(container)

const isVertical = computed(() => orientation === 'vertical')

const describeBar = (bar: ChartBar) =>
  t('dashboard.chart_value', { label: bar.label, value: bar.value })

const summary = computed(() => bars.map(describeBar).join(', '))

const data = computed<Datum[]>(() => {
  const ratios = getBarRatios(bars.map((bar) => bar.value))

  return bars.map((bar, index) => ({
    position: isVertical.value ? index : bars.length - 1 - index,
    ratio: ratios[index],
    bar,
  }))
})

const barWidth = computed(() => {
  if (!isVertical.value) {
    return HORIZONTAL_BAR_THICKNESS
  }
  const count = Math.max(bars.length, 1)
  const available = (width.value - BAR_GAP * (count - 1)) / count

  return Math.max(1, Math.min(VERTICAL_MAX_BAR_WIDTH, available))
})

const positionDomain = computed(() =>
  getCenteredBarDomain(
    bars.length,
    isVertical.value ? width.value : CHART_HEIGHT,
    barWidth.value,
    BAR_GAP,
  ),
)

const valueDomain = computed<[number, number]>(() => [
  0,
  isVertical.value ? CHART_HEIGHT / VERTICAL_MAX_BAR_HEIGHT : 1,
])

const xDomain = computed(() => (isVertical.value ? positionDomain.value : valueDomain.value))
const yDomain = computed(() => (isVertical.value ? valueDomain.value : positionDomain.value))

const getPosition = (datum: Datum) => datum.position
const getRatio = (datum: Datum) => datum.ratio
const getColor = (datum: Datum) => datum.bar.color

const toDatum = (record: Datum | { datum: Datum }): Datum =>
  'bar' in record ? record : record.datum

const tooltipTriggers = {
  [StackedBar.selectors.bar]: (record: Datum | { datum: Datum }) =>
    describeBar(toDatum(record).bar),
}
</script>

<template>
  <div
    ref="container"
    role="img"
    :aria-label="summary"
    :class="[
      'dashboard-bar-chart w-full border-gray-200 dark:border-gray-700',
      isVertical ? 'border-b' : 'border-l',
      { 'dashboard-bar-chart-outlined': outlined },
    ]"
    data-testid="bar-chart"
  >
    <VisXYContainer
      :data="data"
      :height="CHART_HEIGHT"
      :x-domain="xDomain"
      :y-domain="yDomain"
      :auto-margin="false"
      aria-hidden="true"
    >
      <VisStackedBar
        :x="getPosition"
        :y="getRatio"
        :color="getColor"
        :orientation="isVertical ? Orientation.Vertical : Orientation.Horizontal"
        :bar-width="barWidth"
        :rounded-corners="BAR_RADIUS"
      />
      <VisTooltip :triggers="tooltipTriggers" />
    </VisXYContainer>
  </div>
</template>

<style scoped>
.dashboard-bar-chart {
  --vis-font-family: inherit;
  --vis-tooltip-background-color: var(--elevation-0);
  --vis-tooltip-border-color: var(--border-secondary);
  --vis-tooltip-text-color: var(--primary-neutral);
}

.dark .dashboard-bar-chart-outlined {
  --vis-stacked-bar-stroke-color: var(--border-secondary);
  --vis-stacked-bar-stroke-width: 1px;
}
</style>
