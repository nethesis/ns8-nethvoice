<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed, useId, useTemplateRef } from 'vue'
import { unrefElement, useElementSize, useNow } from '@vueuse/core'
import {
  NeCard,
  NeEmptyState,
  NeSkeleton,
  NeTable,
  NeTableBody,
  NeTableCell,
  NeTableHead,
  NeTableHeadCell,
  NeTableRow,
} from '@nethesis/vue-components'
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

const callsTable = useTemplateRef<InstanceType<typeof NeTable>>('callsTable')
const tableElement = computed<HTMLElement | SVGElement | null | undefined>(() =>
  unrefElement(callsTable),
)
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
      <span :id="titleId" class="text-secondary-neutral text-sm font-normal">
        {{ t('dashboard.calls.title') }}
      </span>
    </template>
    <NeSkeleton v-if="loading" :lines="8" class="w-full" />
    <NeEmptyState
      v-else-if="rows.length === 0"
      :title="t('dashboard.calls.no_calls')"
      :description="t('dashboard.calls.no_calls_description')"
      :icon="faPhoneSlash"
    />
    <NeTable
      v-else
      ref="callsTable"
      :aria-label="t('dashboard.calls.title')"
      card-breakpoint="md"
      class="md:max-h-99 md:overflow-y-auto"
      :role="scrollable ? 'region' : undefined"
      :tabindex="scrollable ? 0 : undefined"
      :aria-labelledby="scrollable ? titleId : undefined"
      data-testid="calls-scroll"
    >
      <NeTableHead class="sticky top-0 z-10">
        <NeTableHeadCell>{{ t('dashboard.calls.call_type') }}</NeTableHeadCell>
        <NeTableHeadCell>{{ t('dashboard.calls.source') }}</NeTableHeadCell>
        <NeTableHeadCell>{{ t('dashboard.calls.destination') }}</NeTableHeadCell>
        <NeTableHeadCell>{{ t('dashboard.calls.duration') }}</NeTableHeadCell>
      </NeTableHead>
      <NeTableBody>
        <NeTableRow v-for="row in rows" :key="row.id" data-testid="call-row">
          <NeTableCell :data-label="t('dashboard.calls.call_type')">
            <span class="text-primary-neutral flex items-center gap-2.5 whitespace-nowrap">
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
          </NeTableCell>
          <NeTableCell :data-label="t('dashboard.calls.source')">
            <span class="text-primary-neutral wrap-break-word">
              {{ row.source || t('dashboard.calls.unknown_party') }}
            </span>
          </NeTableCell>
          <NeTableCell :data-label="t('dashboard.calls.destination')">
            <span class="text-primary-neutral flex items-center gap-2 wrap-break-word">
              <template v-if="row.throughQueue">
                <FontAwesomeIcon
                  :icon="faUsers"
                  class="text-secondary-neutral size-4 shrink-0"
                  aria-hidden="true"
                />
                <span class="sr-only">{{ t('dashboard.calls.through_queue') }}</span>
              </template>
              {{ row.destination || t('dashboard.calls.unknown_party') }}
            </span>
          </NeTableCell>
          <NeTableCell :data-label="t('dashboard.calls.duration')">
            <span class="font-mono whitespace-nowrap text-rose-700 tabular-nums dark:text-rose-500">
              {{ row.elapsed }}
            </span>
          </NeTableCell>
        </NeTableRow>
      </NeTableBody>
    </NeTable>
  </NeCard>
</template>
