<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed } from 'vue'
import { useNow } from '@vueuse/core'
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
  NeTooltip,
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
import TablePaginator from '@/components/common/TablePaginator.vue'
import { useClientPagination } from '@/composables/useClientPagination'
import { needsPaginator } from '@/lib/common'
import { DASHBOARD_LIST_PAGE_SIZE } from '@/lib/dashboard/routing'
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

defineSlots<{ handle?(): unknown }>()

const { t } = useI18n()

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

const { pageNum, pageSize, page } = useClientPagination(rows)
pageSize.value = DASHBOARD_LIST_PAGE_SIZE
</script>

<template>
  <NeCard data-testid="calls-card">
    <template #title>
      <span class="flex items-center gap-2">
        <slot name="handle" />
        <span class="text-secondary-neutral text-sm font-normal">
          {{ t('dashboard.calls.title') }}
        </span>
      </span>
    </template>
    <NeSkeleton v-if="loading" :lines="6" class="w-full" />
    <NeEmptyState
      v-else-if="rows.length === 0"
      :title="t('dashboard.calls.no_calls')"
      :description="t('dashboard.calls.no_calls_description')"
      :icon="faPhoneSlash"
    />
    <NeTable v-else :aria-label="t('dashboard.calls.title')" card-breakpoint="md">
      <NeTableHead>
        <NeTableHeadCell>{{ t('dashboard.calls.call_type') }}</NeTableHeadCell>
        <NeTableHeadCell>{{ t('dashboard.calls.source') }}</NeTableHeadCell>
        <NeTableHeadCell>{{ t('dashboard.calls.destination') }}</NeTableHeadCell>
        <NeTableHeadCell>{{ t('dashboard.calls.duration') }}</NeTableHeadCell>
      </NeTableHead>
      <NeTableBody>
        <NeTableRow v-for="row in page" :key="row.id" data-testid="call-row">
          <NeTableCell :data-label="t('dashboard.calls.call_type')">
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
          </NeTableCell>
          <NeTableCell :data-label="t('dashboard.calls.source')">
            <span class="text-primary-neutral font-medium wrap-anywhere">
              {{ row.source || t('dashboard.calls.unknown_party') }}
            </span>
          </NeTableCell>
          <NeTableCell :data-label="t('dashboard.calls.destination')">
            <span class="flex items-center gap-2">
              <NeTooltip v-if="row.throughQueue" trigger-event="mouseenter focus" placement="top">
                <template #trigger>
                  <span
                    tabindex="0"
                    class="focus-visible:ring-primary-500 dark:focus-visible:ring-primary-300 flex rounded-sm focus:outline-hidden focus-visible:ring-2"
                    data-testid="through-queue"
                  >
                    <FontAwesomeIcon :icon="faUsers" class="size-4 shrink-0" aria-hidden="true" />
                    <span class="sr-only">{{ t('dashboard.calls.through_queue') }}</span>
                  </span>
                </template>
                <template #content>{{ t('dashboard.calls.through_queue') }}</template>
              </NeTooltip>
              <span class="text-primary-neutral font-medium wrap-anywhere">
                {{ row.destination || t('dashboard.calls.unknown_party') }}
              </span>
            </span>
          </NeTableCell>
          <NeTableCell :data-label="t('dashboard.calls.duration')">
            <span class="text-danger font-mono whitespace-nowrap tabular-nums">
              {{ row.elapsed }}
            </span>
          </NeTableCell>
        </NeTableRow>
      </NeTableBody>
      <template v-if="needsPaginator(rows.length, pageSize, DASHBOARD_LIST_PAGE_SIZE)" #paginator>
        <TablePaginator
          v-model:page-num="pageNum"
          v-model:page-size="pageSize"
          :total-rows="rows.length"
        />
      </template>
    </NeTable>
  </NeCard>
</template>
