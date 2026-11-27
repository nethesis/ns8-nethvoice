<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts" generic="TItem extends { id: string; label: string }">
import { computed } from 'vue'
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
import type { IconDefinition } from '@fortawesome/free-solid-svg-icons'
import LoadError from '@/components/common/LoadError.vue'
import TablePaginator from '@/components/common/TablePaginator.vue'
import { useClientPagination } from '@/composables/useClientPagination'
import { needsPaginator } from '@/lib/common'
import { DASHBOARD_LIST_PAGE_SIZE } from '@/lib/dashboard/routing'

const {
  title,
  items,
  labelHeader,
  valueHeader,
  emptyTitle,
  emptyIcon,
  loading = false,
  error = null,
  errorTitle = '',
  hasData = false,
} = defineProps<{
  title: string
  items: TItem[]
  labelHeader: string
  valueHeader: string
  emptyTitle: string
  emptyIcon: IconDefinition
  loading?: boolean
  error?: unknown
  errorTitle?: string
  hasData?: boolean
}>()

const emit = defineEmits<{ retry: [] }>()

defineSlots<{ value(props: { item: TItem }): unknown; handle?(): unknown }>()

const { pageNum, pageSize, page } = useClientPagination(computed(() => items))
pageSize.value = DASHBOARD_LIST_PAGE_SIZE
</script>

<template>
  <NeCard>
    <template #title>
      <span class="flex items-center gap-2">
        <slot name="handle" />
        <span class="text-secondary-neutral text-sm font-normal">{{ title }}</span>
      </span>
    </template>
    <NeSkeleton v-if="loading" :lines="6" class="w-full" />
    <div v-else class="flex flex-col gap-4">
      <LoadError v-if="error" :error="error" :title="errorTitle" @retry="emit('retry')" />
      <template v-if="!error || hasData">
        <NeEmptyState v-if="items.length === 0" :title="emptyTitle" :icon="emptyIcon" />
        <NeTable v-else :aria-label="title" card-breakpoint="md">
          <NeTableHead>
            <NeTableHeadCell>{{ labelHeader }}</NeTableHeadCell>
            <NeTableHeadCell>{{ valueHeader }}</NeTableHeadCell>
          </NeTableHead>
          <NeTableBody>
            <NeTableRow v-for="item in page" :key="item.id" data-testid="list-row">
              <NeTableCell :data-label="labelHeader">
                <span class="text-primary-neutral font-medium wrap-anywhere">{{
                  item.label || '-'
                }}</span>
              </NeTableCell>
              <NeTableCell :data-label="valueHeader">
                <span class="wrap-anywhere">
                  <slot name="value" :item="item" />
                </span>
              </NeTableCell>
            </NeTableRow>
          </NeTableBody>
          <template
            v-if="needsPaginator(items.length, pageSize, DASHBOARD_LIST_PAGE_SIZE)"
            #paginator
          >
            <TablePaginator
              v-model:page-num="pageNum"
              v-model:page-size="pageSize"
              :total-rows="items.length"
            />
          </template>
        </NeTable>
      </template>
    </div>
  </NeCard>
</template>
