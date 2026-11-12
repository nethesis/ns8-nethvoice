<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed } from 'vue'
import { useNow } from '@vueuse/core'
import { NeCard, NeEmptyState, NeSkeleton } from '@nethesis/vue-components'
import {
  faArrowDown,
  faArrowRightArrowLeft,
  faArrowUp,
  faPhoneSlash,
  faUsers,
  type IconDefinition,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import {
  formatCallDuration,
  getElapsedCallDuration,
  type CallInProgress,
  type CallType,
} from '@/lib/dashboard/live'

const {
  calls,
  fetchedAt,
  loading = false,
} = defineProps<{
  calls: CallInProgress[]
  fetchedAt: number
  loading?: boolean
}>()

const CALL_TYPE_ICONS: Record<CallType, { icon: IconDefinition; classes: string }> = {
  incoming: { icon: faArrowDown, classes: 'rotate-45' },
  outgoing: { icon: faArrowUp, classes: 'rotate-45' },
  internal: { icon: faArrowRightArrowLeft, classes: '' },
}

const now = useNow({ interval: 1000 })

const rows = computed(() =>
  calls.map((call) => ({
    ...call,
    elapsed: formatCallDuration(getElapsedCallDuration(call, fetchedAt, now.value.getTime())),
  })),
)
</script>

<template>
  <NeCard data-testid="calls-card">
    <template #title>
      <span class="text-secondary-neutral text-sm font-normal">
        {{ $t('dashboard.calls.title') }}
      </span>
    </template>
    <NeSkeleton v-if="loading" :lines="8" class="w-full" />
    <NeEmptyState
      v-else-if="rows.length === 0"
      :title="$t('dashboard.calls.no_calls')"
      :description="$t('dashboard.calls.no_calls_description')"
      :icon="faPhoneSlash"
    />
    <div v-else class="max-h-[396px] overflow-y-auto">
      <table class="w-full text-left text-sm">
        <thead class="sticky top-0 bg-white dark:bg-gray-950">
          <tr class="text-tertiary-neutral border-b border-gray-200 dark:border-gray-700">
            <th scope="col" class="py-3 pr-4 font-medium">
              {{ $t('dashboard.calls.call_type') }}
            </th>
            <th scope="col" class="py-3 pr-4 font-medium">{{ $t('dashboard.calls.source') }}</th>
            <th scope="col" class="py-3 pr-4 font-medium">
              {{ $t('dashboard.calls.destination') }}
            </th>
            <th scope="col" class="py-3 font-medium">{{ $t('dashboard.calls.duration') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in rows"
            :key="row.id"
            class="text-primary-neutral border-b border-gray-200 last:border-b-0 dark:border-gray-700"
            data-testid="call-row"
          >
            <td class="py-3 pr-4 whitespace-nowrap">
              <span class="flex items-center gap-2.5">
                <FontAwesomeIcon
                  :icon="CALL_TYPE_ICONS[row.type].icon"
                  :class="[
                    'size-4 shrink-0 text-green-700 dark:text-green-500',
                    CALL_TYPE_ICONS[row.type].classes,
                  ]"
                  aria-hidden="true"
                />
                {{ $t(`dashboard.calls.${row.type}`) }}
              </span>
            </td>
            <td class="py-3 pr-4">{{ row.source || $t('dashboard.calls.unknown_party') }}</td>
            <td class="py-3 pr-4">
              <span class="flex items-center gap-2">
                <template v-if="row.throughQueue">
                  <FontAwesomeIcon
                    :icon="faUsers"
                    class="text-secondary-neutral size-4 shrink-0"
                    aria-hidden="true"
                  />
                  <span class="sr-only">{{ $t('dashboard.calls.through_queue') }}</span>
                </template>
                {{ row.destination || $t('dashboard.calls.unknown_party') }}
              </span>
            </td>
            <td class="py-3 font-mono text-rose-700 tabular-nums dark:text-rose-500">
              {{ row.elapsed }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </NeCard>
</template>
