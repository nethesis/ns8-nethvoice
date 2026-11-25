<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed } from 'vue'
import { NeCard, NeSkeleton } from '@nethesis/vue-components'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import LoadError from '@/components/common/LoadError.vue'
import DashboardBarChart from './DashboardBarChart.vue'
import type { ChartBar, ChartOrientation } from '@/lib/dashboard/chart'

const {
  title,
  bars,
  orientation,
  emptyText = '',
  loading = false,
  outlined = false,
  error = null,
  errorTitle = '',
  hasData = false,
} = defineProps<{
  title: string
  bars: ChartBar[]
  orientation: ChartOrientation
  emptyText?: string
  loading?: boolean
  outlined?: boolean
  error?: unknown
  errorTitle?: string
  hasData?: boolean
}>()

const emit = defineEmits<{ retry: [] }>()

const empty = computed(() => Boolean(emptyText) && bars.every((bar) => bar.value === 0))
</script>

<template>
  <NeCard>
    <template #title>
      <span class="flex items-center gap-2">
        <slot name="handle" />
        <span class="text-secondary-neutral text-sm font-normal">{{ title }}</span>
      </span>
    </template>
    <NeSkeleton v-if="loading" :lines="8" class="w-full" />
    <div v-else class="flex flex-col gap-6">
      <LoadError v-if="error" :error="error" :title="errorTitle" @retry="emit('retry')" />
      <template v-if="!error || hasData">
        <p
          v-if="empty"
          class="text-tertiary-neutral py-6 text-center text-sm"
          data-testid="breakdown-empty"
        >
          {{ emptyText }}
        </p>
        <DashboardBarChart v-else :bars="bars" :orientation="orientation" :outlined="outlined" />
        <dl>
          <div
            v-for="bar in bars"
            :key="bar.id"
            class="flex items-center justify-between gap-4 border-b border-gray-200 py-3 last:border-b-0 dark:border-gray-700"
          >
            <dt class="text-primary-neutral flex min-w-0 items-center gap-2.5 font-medium">
              <FontAwesomeIcon
                v-if="bar.icon"
                :icon="bar.icon"
                :class="['shrink-0', bar.dotClass]"
                aria-hidden="true"
              />
              <span v-else :class="['shrink-0 rounded-full', bar.dotClass]" aria-hidden="true" />
              <span class="truncate">{{ bar.label }}</span>
            </dt>
            <dd class="text-tertiary-neutral tabular-nums" :data-testid="`breakdown-${bar.id}`">
              {{ bar.value }}
            </dd>
          </div>
        </dl>
      </template>
    </div>
  </NeCard>
</template>
