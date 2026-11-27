<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { NeMultiselectCombobox, type NeMultiselectComboboxOption } from '@nethesis/vue-components'
import { useVisualPlanStore } from '@/stores/visualPlan'

// Extensions to call; with `acceptUserInput` also numbers that are not extensions.
const props = defineProps<{
  label: string
  helperText?: string
  invalidMessage?: string
  disabled?: boolean
  optional?: boolean
  acceptUserInput?: boolean
}>()

const model = defineModel<string[]>({ required: true })

const { t } = useI18n()
const store = useVisualPlanStore()

const extensionOptions = computed<NeMultiselectComboboxOption[]>(() =>
  (store.data?.extensions ?? []).map((item) => ({
    id: item.extension,
    label: item.name ? `${item.name} (${item.extension})` : item.extension,
  })),
)

// Members that are not extensions, such as external numbers, are kept as they are.
const options = computed(() => [
  ...extensionOptions.value,
  ...model.value
    .filter((value) => !extensionOptions.value.some((option) => option.id === value))
    .map((value) => ({ id: value, label: value })),
])

const selected = computed({
  get: () =>
    model.value.map(
      (value) => options.value.find((option) => option.id === value) ?? { id: value, label: value },
    ),
  set: (items: NeMultiselectComboboxOption[]) => {
    model.value = items.map((item) => item.id.trim()).filter(Boolean)
  },
})
</script>

<template>
  <NeMultiselectCombobox
    v-model="selected"
    :label="props.label"
    :options="options"
    :placeholder="t('visual_plan.fields.choose_extensions')"
    :helper-text="props.helperText ?? ''"
    :invalid-message="props.invalidMessage ?? ''"
    :disabled="props.disabled"
    :optional="props.optional"
    :accept-user-input="props.acceptUserInput"
    :no-results-label="t('ne_combobox.no_results')"
    :no-options-label="t('ne_combobox.no_options_label')"
    :user-input-label="t('ne_combobox.user_input_label')"
    :optional-label="t('common.optional')"
    :limited-options-label="t('ne_combobox.limited_options_label')"
    :remove-label="t('common.remove')"
  />
</template>
