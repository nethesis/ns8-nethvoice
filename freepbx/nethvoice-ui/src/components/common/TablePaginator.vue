<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { NePaginator } from '@nethesis/vue-components'
import { PAGE_SIZES } from '@/lib/common'

const { totalRows } = defineProps<{
  totalRows: number
}>()

const pageNum = defineModel<number>('pageNum', { required: true })
const pageSize = defineModel<number>('pageSize', { required: true })
</script>

<template>
  <div class="relative max-w-full overflow-x-auto">
    <NePaginator
      :current-page="pageNum"
      :total-rows="totalRows"
      :page-size="pageSize"
      :page-sizes="PAGE_SIZES"
      :nav-pagination-label="$t('ne_table.pagination')"
      :next-label="$t('ne_table.go_to_next_page')"
      :previous-label="$t('ne_table.go_to_previous_page')"
      :range-of-total-label="$t('ne_table.of')"
      :page-size-label="$t('ne_table.show')"
      @select-page="
        (page: number) => {
          pageNum = page
        }
      "
      @select-page-size="
        (size: number) => {
          pageSize = size
        }
      "
    />
  </div>
</template>
