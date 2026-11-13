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
import TablePaginator from '@/components/common/TablePaginator.vue'
import { useClientPagination } from '@/composables/useClientPagination'
import { PAGE_SIZES } from '@/lib/common'
import { DASHBOARD_LIST_PAGE_SIZE } from '@/lib/dashboard/routing'

const {
  title,
  items,
  labelHeader,
  valueHeader,
  emptyTitle,
  emptyIcon,
  loading = false,
} = defineProps<{
  title: string
  items: TItem[]
  labelHeader: string
  valueHeader: string
  emptyTitle: string
  emptyIcon: IconDefinition
  loading?: boolean
}>()

defineSlots<{ value(props: { item: TItem }): unknown }>()

const { pageNum, pageSize, page } = useClientPagination(computed(() => items))
pageSize.value = DASHBOARD_LIST_PAGE_SIZE
</script>

<template>
  <NeCard>
    <template #title>
      <span class="text-secondary-neutral text-sm font-normal">{{ title }}</span>
    </template>
    <NeSkeleton v-if="loading" :lines="6" class="w-full" />
    <NeEmptyState v-else-if="items.length === 0" :title="emptyTitle" :icon="emptyIcon" />
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
      <template v-if="items.length > PAGE_SIZES[0]" #paginator>
        <TablePaginator
          v-model:page-num="pageNum"
          v-model:page-size="pageSize"
          :total-rows="items.length"
        />
      </template>
    </NeTable>
  </NeCard>
</template>
