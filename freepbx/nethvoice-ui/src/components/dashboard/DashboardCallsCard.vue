<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed, useId, useTemplateRef } from 'vue'
import { useElementSize, useNow } from '@vueuse/core'
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
import { useI18n } from 'vue-i18n'
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

const { t } = useI18n()

const CALL_TYPE_ICONS: Record<CallType, { icon: IconDefinition; classes: string }> = {
  incoming: { icon: faArrowDown, classes: 'rotate-45' },
  outgoing: { icon: faArrowUp, classes: 'rotate-45' },
  internal: { icon: faArrowRightArrowLeft, classes: '' },
}

const titleId = useId()

const now = useNow({ interval: 1000 })

const tableElement = useTemplateRef<HTMLDivElement>('callsScroll')
const { height: tableHeight } = useElementSize(tableElement)

const rows = computed(() =>
  calls.map((call) => ({
    ...call,
    elapsed: formatCallDuration(getElapsedCallDuration(call, fetchedAt, now.value.getTime())),
  })),
)

const scrollable = computed<boolean>(() => {
  const element = tableElement.value
  return (
    rows.value.length > 0 &&
    tableHeight.value > 0 &&
    !!element &&
    element.scrollHeight > element.clientHeight + 1
  )
})
</script>

<template>
  <NeCard data-testid="calls-card">
    <template #title>
      <span class="flex items-center gap-2">
        <slot name="handle" />
        <span :id="titleId" class="text-secondary-neutral text-sm font-normal">
          {{ t('dashboard.calls.title') }}
        </span>
      </span>
    </template>
    <NeSkeleton v-if="loading" :lines="8" class="w-full" />
    <NeEmptyState
      v-else-if="rows.length === 0"
      :title="t('dashboard.calls.no_calls')"
      :description="t('dashboard.calls.no_calls_description')"
      :icon="faPhoneSlash"
    />
    <div
      v-else
      ref="callsScroll"
      class="overflow-x-auto md:max-h-99 md:overflow-y-auto"
      :role="scrollable ? 'region' : undefined"
      :tabindex="scrollable ? 0 : undefined"
      :aria-labelledby="scrollable ? titleId : undefined"
      data-testid="calls-scroll"
    >
      <table :aria-labelledby="titleId" class="w-full min-w-xl table-fixed text-left text-sm">
        <thead class="bg-elevation-0 sticky top-0 z-10">
          <tr class="text-tertiary-neutral border-b border-gray-200 dark:border-gray-700">
            <th scope="col" class="w-36 py-3 pr-10 font-medium">
              {{ t('dashboard.calls.call_type') }}
            </th>
            <th scope="col" class="py-3 pr-10 font-medium">{{ t('dashboard.calls.source') }}</th>
            <th scope="col" class="py-3 pr-10 font-medium">
              {{ t('dashboard.calls.destination') }}
            </th>
            <th scope="col" class="w-25 py-3 font-medium">{{ t('dashboard.calls.duration') }}</th>
          </tr>
        </thead>
        <tbody class="text-secondary-neutral font-medium">
          <tr
            v-for="row in rows"
            :key="row.id"
            class="border-b border-gray-200 dark:border-gray-700"
            data-testid="call-row"
          >
            <td class="py-3 pr-10">
              <span class="flex items-center gap-2.5 whitespace-nowrap">
                <FontAwesomeIcon
                  :icon="CALL_TYPE_ICONS[row.type].icon"
                  :class="[
                    'size-4 shrink-0 text-green-700 dark:text-green-500',
                    CALL_TYPE_ICONS[row.type].classes,
                  ]"
                  aria-hidden="true"
                />
                {{ t(`dashboard.calls.${row.type}`) }}
              </span>
            </td>
            <td class="py-3 pr-10 wrap-break-word">
              {{ row.source || t('dashboard.calls.unknown_party') }}
            </td>
            <td class="py-3 pr-10">
              <span class="flex items-center gap-2 wrap-break-word">
                <template v-if="row.throughQueue">
                  <FontAwesomeIcon :icon="faUsers" class="size-4 shrink-0" aria-hidden="true" />
                  <span class="sr-only">{{ t('dashboard.calls.through_queue') }}</span>
                </template>
                {{ row.destination || t('dashboard.calls.unknown_party') }}
              </span>
            </td>
            <td class="text-danger py-3 font-mono font-normal whitespace-nowrap tabular-nums">
              {{ row.elapsed }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </NeCard>
</template>
