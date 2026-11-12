<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed } from 'vue'
import { NeCard, NeSkeleton, NeTooltip } from '@nethesis/vue-components'
import { faCircleInfo } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import DashboardBarChart from './DashboardBarChart.vue'
import type { ChartBar, ChartOrientation } from '@/lib/dashboard/chart'

const {
  title,
  bars,
  orientation,
  tooltip = '',
  emptyText = '',
  loading = false,
} = defineProps<{
  title: string
  bars: ChartBar[]
  orientation: ChartOrientation
  tooltip?: string
  emptyText?: string
  loading?: boolean
}>()

const empty = computed(() => Boolean(emptyText) && bars.every((bar) => bar.value === 0))
</script>

<template>
  <NeCard>
    <template #title>
      <span class="text-secondary-neutral text-sm font-normal">{{ title }}</span>
    </template>
    <template v-if="tooltip" #titleTooltip>
      <NeTooltip trigger-event="mouseenter focus" placement="top">
        <template #trigger>
          <button type="button" class="inline-flex" data-testid="breakdown-info">
            <FontAwesomeIcon
              :icon="faCircleInfo"
              class="size-4 text-indigo-500 dark:text-indigo-300"
              aria-hidden="true"
            />
            <span class="sr-only">{{ tooltip }}</span>
          </button>
        </template>
        <template #content>{{ tooltip }}</template>
      </NeTooltip>
    </template>
    <NeSkeleton v-if="loading" :lines="8" class="w-full" />
    <div v-else class="flex flex-col gap-6">
      <p
        v-if="empty"
        class="text-tertiary-neutral py-6 text-center text-sm"
        data-testid="breakdown-empty"
      >
        {{ emptyText }}
      </p>
      <DashboardBarChart v-else :bars="bars" :orientation="orientation" />
      <dl>
        <div
          v-for="bar in bars"
          :key="bar.id"
          class="flex items-center justify-between gap-4 border-b border-gray-200 py-3 last:border-b-0 dark:border-gray-700"
        >
          <dt class="text-primary-neutral flex min-w-0 items-center gap-2.5 font-medium">
            <span :class="['size-3 shrink-0 rounded-full', bar.dotClass]" aria-hidden="true" />
            <span class="truncate">{{ bar.label }}</span>
          </dt>
          <dd class="text-tertiary-neutral tabular-nums" :data-testid="`breakdown-${bar.id}`">
            {{ bar.value }}
          </dd>
        </div>
      </dl>
    </div>
  </NeCard>
</template>
