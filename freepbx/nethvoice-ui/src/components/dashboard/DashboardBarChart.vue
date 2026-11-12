<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed, useTemplateRef } from 'vue'
import { useElementSize } from '@vueuse/core'
import { useI18n } from 'vue-i18n'
import {
  getBarRatios,
  horizontalBarPath,
  layoutVerticalBars,
  verticalBarPath,
  type ChartBar,
  type ChartOrientation,
} from '@/lib/dashboard/chart'

const CHART_HEIGHT = 148
const VERTICAL_MAX_BAR_HEIGHT = 116
const VERTICAL_MAX_BAR_WIDTH = 49
const BAR_GAP = 12
const HORIZONTAL_BAR_THICKNESS = 16
const HORIZONTAL_TOP_OFFSET = 36

const { bars, orientation } = defineProps<{
  bars: ChartBar[]
  orientation: ChartOrientation
}>()

const { t } = useI18n()
const container = useTemplateRef<HTMLDivElement>('container')
const { width } = useElementSize(container)

const describeBar = (bar: ChartBar) =>
  t('dashboard.chart_value', { label: bar.label, value: bar.value })

const summary = computed(() => bars.map(describeBar).join(', '))

const shapes = computed(() => {
  const ratios = getBarRatios(bars.map((bar) => bar.value))

  if (orientation === 'vertical') {
    const layout = layoutVerticalBars(bars.length, width.value, VERTICAL_MAX_BAR_WIDTH, BAR_GAP)

    return bars.map((bar, index) => ({
      bar,
      path: verticalBarPath(
        layout.offset + layout.step * index,
        layout.barWidth,
        ratios[index] * VERTICAL_MAX_BAR_HEIGHT,
        CHART_HEIGHT,
      ),
    }))
  }

  return bars.map((bar, index) => ({
    bar,
    path: horizontalBarPath(
      HORIZONTAL_TOP_OFFSET + (HORIZONTAL_BAR_THICKNESS + BAR_GAP) * index,
      ratios[index] * width.value,
      HORIZONTAL_BAR_THICKNESS,
    ),
  }))
})
</script>

<template>
  <div
    ref="container"
    :class="[
      'w-full border-gray-200 dark:border-gray-700',
      orientation === 'vertical' ? 'border-b' : 'border-l',
    ]"
  >
    <svg
      role="img"
      :aria-label="summary"
      :width="width"
      :height="CHART_HEIGHT"
      :viewBox="`0 0 ${Math.max(width, 1)} ${CHART_HEIGHT}`"
      class="block"
    >
      <template v-for="shape in shapes" :key="shape.bar.id">
        <path v-if="shape.path" :d="shape.path" :class="shape.bar.fillClass">
          <title>{{ describeBar(shape.bar) }}</title>
        </path>
      </template>
    </svg>
  </div>
</template>
