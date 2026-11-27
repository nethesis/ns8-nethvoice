<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useEventListener } from '@vueuse/core'
import { NeCombobox, type NeComboboxOption } from '@nethesis/vue-components'

defineProps<{
  label: string
  options: NeComboboxOption[]
  helperText?: string
  invalidMessage?: string
  disabled?: boolean
  optional?: boolean
  optionsWidth?: string
}>()

const model = defineModel<string>({ required: true })

const { t } = useI18n()

// An option is chosen on mouse down. Applying it then can move the fields (an issue
// disappears) and put another option under the pointer, so the list misses the click
// that closes it. Apply the choice once the click is over.
let pointerDown = false
let pending: string | null = null

useEventListener(window, 'pointerdown', () => (pointerDown = true), { capture: true })
useEventListener(
  window,
  ['pointerup', 'pointercancel'],
  () => {
    pointerDown = false
    if (pending === null) return
    const value = pending
    pending = null
    setTimeout(() => (model.value = value))
  },
  { capture: true },
)

function select(value: string) {
  if (pointerDown) {
    pending = value
  } else {
    model.value = value
  }
}
</script>

<template>
  <NeCombobox
    :model-value="model"
    :label="label"
    :options="options"
    :placeholder="t('ne_combobox.choose')"
    :helper-text="helperText ?? ''"
    :invalid-message="invalidMessage ?? ''"
    :disabled="disabled"
    :optional="optional"
    :no-results-label="t('ne_combobox.no_results')"
    :limited-options-label="t('ne_combobox.limited_options_label')"
    :no-options-label="t('ne_combobox.no_options_label')"
    :selected-label="t('ne_combobox.selected')"
    :user-input-label="t('ne_combobox.user_input_label')"
    :optional-label="t('common.optional')"
    :custom-options-width="optionsWidth"
    @update:model-value="select"
  />
</template>
