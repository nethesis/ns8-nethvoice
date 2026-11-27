<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { NeCombobox } from '@nethesis/vue-components'
import type { Focusable } from '@/lib/common'
import {
  type FieldOption,
  getAvailableFields,
  getMappingColumns,
  NOT_IMPORTED,
} from '@/lib/integrations/phonebookSources'
import type { FieldIssues } from '@/lib/integrations/validation'
import { usePhonebookFieldLabel } from '@/composables/usePhonebookFieldLabel'

const {
  columns,
  mapping,
  fields,
  withOwner,
  issues = {},
  disabled = false,
} = defineProps<{
  columns: string[]
  mapping: Record<string, string>
  fields: string[]
  withOwner: boolean
  issues?: FieldIssues
  disabled?: boolean
}>()

const emit = defineEmits<{ change: [column: string, field: string] }>()

const { t } = useI18n()
const fieldLabel = usePhonebookFieldLabel()
const comboboxRefs = new Map<string, Focusable>()

const mappingColumns = computed(() => getMappingColumns(columns))

const optionsByColumn = computed<Record<string, FieldOption[]>>((previous) => {
  const notImported = { id: NOT_IMPORTED, label: t('integrations.phonebook.not_imported') }

  return Object.fromEntries(
    mappingColumns.value.map((column) => {
      const options = [
        notImported,
        ...getAvailableFields(fields, mapping, column, withOwner).map((field) => ({
          id: field,
          label: fieldLabel(field),
          description: field,
        })),
      ]
      const previousOptions = previous?.[column]

      return [
        column,
        previousOptions && haveSameOptions(previousOptions, options) ? previousOptions : options,
      ]
    }),
  )
})

function haveSameOptions(a: FieldOption[], b: FieldOption[]): boolean {
  return (
    a.length === b.length &&
    a.every((option, index) => option.id === b[index]?.id && option.label === b[index]?.label)
  )
}

function setRef(column: string, element: unknown) {
  if (element) {
    comboboxRefs.set(column, element as Focusable)
  } else {
    comboboxRefs.delete(column)
  }
}

function focusColumn(column: string | undefined) {
  if (column !== undefined) {
    comboboxRefs.get(column)?.focus()
  }
}

function focusFirstInvalid() {
  focusColumn(mappingColumns.value.find((column) => issues[column]))
}

function focusFirst() {
  focusColumn(mappingColumns.value[0])
}

defineExpose({ focusFirstInvalid, focusFirst, focusColumn })
</script>

<template>
  <div class="flex flex-col gap-6">
    <NeCombobox
      v-for="column in mappingColumns"
      :key="column"
      :ref="(element) => setRef(column, element)"
      :model-value="mapping[column] ?? ''"
      :label="column"
      :placeholder="t('integrations.phonebook.choose_field')"
      :options="optionsByColumn[column] ?? []"
      :invalid-message="issues[column] ? t(issues[column]) : ''"
      :disabled="disabled"
      :no-results-label="t('ne_combobox.no_results')"
      :limited-options-label="t('ne_combobox.limited_options_label')"
      :no-options-label="t('ne_combobox.no_options_label')"
      :selected-label="t('ne_combobox.selected')"
      :user-input-label="t('ne_combobox.user_input_label')"
      :optional-label="t('common.optional')"
      @update:model-value="(value: unknown) => emit('change', column, String(value ?? ''))"
    />
  </div>
</template>
