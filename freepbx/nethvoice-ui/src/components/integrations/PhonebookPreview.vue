<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NeTable,
  NeTableBody,
  NeTableCell,
  NeTableHead,
  NeTableHeadCell,
  NeTableRow,
} from '@nethesis/vue-components'
import type { PhonebookPreview } from '@/lib/integrations/phonebookSources'

const { preview, columnLabel = (column: string) => column } = defineProps<{
  preview: PhonebookPreview
  columnLabel?: (column: string) => string
}>()

const { t, locale } = useI18n()

const rowsText = computed(() => {
  const shown = preview.rows.length
  const { total } = preview

  if (total === undefined) {
    return t('integrations.phonebook.preview_first_rows', { count: shown }, shown)
  }

  if (total === 0) {
    return t('integrations.phonebook.preview_no_rows')
  }
  const format = new Intl.NumberFormat(locale.value)

  return total > shown
    ? t('integrations.phonebook.preview_rows_of_total', {
        count: format.format(shown),
        total: format.format(total),
      })
    : t('integrations.phonebook.preview_all_rows', { count: format.format(total) }, total)
})
</script>

<template>
  <div class="flex flex-col gap-2">
    <p class="text-primary-neutral text-sm font-medium">
      {{ t('integrations.phonebook.preview') }}
    </p>
    <NeTable
      v-if="preview.rows.length > 0"
      :aria-label="t('integrations.phonebook.preview')"
      card-breakpoint="sm"
    >
      <NeTableHead>
        <NeTableHeadCell v-for="column in preview.columns" :key="column">
          <span class="whitespace-nowrap">{{ columnLabel(column) }}</span>
        </NeTableHeadCell>
      </NeTableHead>
      <NeTableBody>
        <NeTableRow v-for="(row, index) in preview.rows" :key="index">
          <NeTableCell
            v-for="column in preview.columns"
            :key="column"
            :data-label="columnLabel(column)"
          >
            <span class="block max-w-48 truncate">{{ row[column] || '-' }}</span>
          </NeTableCell>
        </NeTableRow>
      </NeTableBody>
    </NeTable>
    <p class="text-tertiary-neutral text-sm">{{ rowsText }}</p>
  </div>
</template>
