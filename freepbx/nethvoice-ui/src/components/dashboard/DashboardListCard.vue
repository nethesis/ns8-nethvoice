<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts" generic="TItem extends { id: string; label: string }">
import { computed } from 'vue'
import { NeCard, NeEmptyState, NeSkeleton } from '@nethesis/vue-components'
import type { IconDefinition } from '@fortawesome/free-solid-svg-icons'
import TablePaginator from '@/components/common/TablePaginator.vue'
import { useClientPagination } from '@/composables/useClientPagination'
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
    <div v-else class="flex flex-col gap-4">
      <table class="w-full text-left text-sm">
        <caption class="sr-only">
          {{
            title
          }}
        </caption>
        <thead>
          <tr class="text-tertiary-neutral border-b border-gray-200 dark:border-gray-700">
            <th scope="col" class="py-3 pr-4 font-medium">{{ labelHeader }}</th>
            <th scope="col" class="py-3 font-medium">{{ valueHeader }}</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="item in page"
            :key="item.id"
            class="border-b border-gray-200 last:border-b-0 dark:border-gray-700"
            data-testid="list-row"
          >
            <th scope="row" class="text-primary-neutral py-3 pr-4 font-medium wrap-anywhere">
              {{ item.label || '-' }}
            </th>
            <td class="text-secondary-neutral py-3 wrap-anywhere">
              <slot name="value" :item="item" />
            </td>
          </tr>
        </tbody>
      </table>
      <TablePaginator
        v-model:page-num="pageNum"
        v-model:page-size="pageSize"
        :total-rows="items.length"
      />
    </div>
  </NeCard>
</template>
